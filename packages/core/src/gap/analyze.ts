import type { CareerProfile, JobDescription, MatchReport, Proficiency, SkillGap } from '../types';
import { MATCH_CONFIG } from '../constants';
import { learnHoursFor, resolveSkillLabel, resourcesFor } from '../skills/graph';
import { practiceTask } from '../roadmap/templates';
import { makeId, roundTo } from '../util/text';

export interface GapAnalysisInput {
  profile: CareerProfile;
  job: JobDescription;
  report: MatchReport;
}

function importanceFor(status: 'required' | 'preferred', matchValue: number): SkillGap['importance'] {
  if (status === 'required') return matchValue < MATCH_CONFIG.statusThresholds.partial ? 'high' : 'medium';
  return matchValue < MATCH_CONFIG.statusThresholds.partial ? 'medium' : 'low';
}

function whyItMatters(label: string, status: 'required' | 'preferred', job: JobDescription, matchValue: number): string {
  const role = job.title || 'this role';
  if (matchValue === 0) {
    return status === 'required'
      ? `${label} is listed as a required criterion for ${role}, and no supporting evidence was found in your profile.`
      : `${label} is listed as a preferred criterion for ${role}; it would strengthen an application but is not mandatory.`;
  }
  if (matchValue >= MATCH_CONFIG.statusThresholds.partial) {
    return `${label} is ${status} for ${role}. You have partial evidence, so the fastest win is turning it into a demonstrable example.`;
  }
  return `${label} is ${status} for ${role}. The evidence found is weak or indirect, so it may not convince a reviewer yet.`;
}

/**
 * Converts a match report into an ordered, actionable gap list.
 * Priority is an internal recommendation derived from advert importance and the
 * evidence you already have - it is deliberately NOT presented as market data.
 */
export function analyseSkillGaps(input: GapAnalysisInput): SkillGap[] {
  const { job, report } = input;

  const open = report.matches.filter((match) => match.matchValue < MATCH_CONFIG.statusThresholds.confirmed);
  if (open.length === 0) return [];

  const raw = open.map((match) => {
    const requirement = job.requirements.find((r) => r.id === match.requirementId);
    const label = match.label;
    const importance = importanceFor(match.status, match.matchValue);
    const lexicon = match.skillId ? undefined : resolveSkillLabel(label);
    const learnHours = requirement?.learnHours ?? learnHoursFor(label);
    // Partial credit shortens the estimated effort, never lengthens it.
    const estimatedHours = Math.max(4, Math.round(learnHours * (1 - match.matchValue * 0.6)));
    const priorityScore = roundTo(match.weight * (1 - match.matchValue) * 100, 2);
    const template = practiceTask(label, requirement?.category);

    const targetProficiency: Proficiency = match.status === 'required' ? 'intermediate' : 'beginner';

    const gap: SkillGap = {
      id: makeId('gap', `${job.id}:${label}`),
      requirementId: match.requirementId,
      skillId: match.skillId ?? lexicon?.id,
      label,
      category: requirement?.category ?? lexicon?.category,
      status: match.status,
      matchValue: match.matchValue,
      importance,
      whyItMatters: whyItMatters(label, match.status, job, match.matchValue),
      existingEvidence: match.evidence.map((item) => item.detail),
      targetProficiency,
      suggestedTask: `${template.exercise} Completion criteria: ${template.completionCriteria}`,
      estimatedHours,
      priorityScore,
      priorityBasis: 'internal-recommendation',
      resources: resourcesFor(label),
    };
    return gap;
  });

  const maxScore = Math.max(...raw.map((g) => g.priorityScore), 1);
  return raw
    .map((gap) => ({
      ...gap,
      // normalise onto a 0-100 internal priority scale, still order-stable
      priorityScore: roundTo((gap.priorityScore / maxScore) * 100, 1),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.label.localeCompare(b.label));
}

/** Days of study at the candidate's stated availability. */
export function effortInWeeks(hours: number, weeklyHours: number): number {
  if (weeklyHours <= 0) return 0;
  return roundTo(hours / weeklyHours, 1);
}

export function totalGapHours(gaps: SkillGap[]): number {
  return gaps.reduce((sum, gap) => sum + gap.estimatedHours, 0);
}

export function topGapSummary(gaps: SkillGap[], limit = 3): string {
  if (gaps.length === 0) return 'No open gaps against the analysed role.';
  const top = gaps.slice(0, limit).map((gap) => `${gap.label} (${gap.importance})`);
  return `${gaps.length} gap${gaps.length === 1 ? '' : 's'} detected. Highest priority: ${top.join(', ')}.`;
}

export function profileCoverageNote(profile: CareerProfile): string {
  const skills = profile.skills.length;
  const projects = profile.projects.length;
  const experience = profile.experience.length;
  if (skills === 0 && projects === 0 && experience === 0) {
    return 'Your profile has no skills, projects or experience recorded yet, so every requirement will look like a gap. Add your real skills first.';
  }
  return `Evidence available to the engine: ${skills} skills, ${projects} projects, ${experience} experience entries.`;
}
