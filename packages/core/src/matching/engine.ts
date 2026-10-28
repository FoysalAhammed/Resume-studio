import type {
  CareerProfile,
  JobDescription,
  JobRequirement,
  MatchEvidence,
  MatchReport,
  MatchStatus,
  Proficiency,
  RequirementMatch,
} from '../types';
import { EVIDENCE_SOURCE_LABELS, MATCH_CONFIG, MATCH_DISCLAIMER, PROFICIENCY_ORDER } from '../constants';
import { getRelatedSkills, resolveSkillLabel } from '../skills/graph';
import { containsTerm, makeId, roundTo, uniqueBy } from '../util/text';

/** A skill the candidate gets credit for, resolved against the lexicon. */
interface CandidateSkill {
  label: string;
  lexiconId?: string;
  proficiency: Proficiency;
  evidence: MatchEvidence[];
}

export interface CandidateEvidenceIndex {
  skills: CandidateSkill[];
  projectText: string;
  projectTechnologies: string;
  experienceText: string;
  certificationText: string;
  narrativeText: string;
  /** Everything the candidate told us, used for fallback phrase matching. */
  fullText: string;
}

export function buildEvidenceIndex(profile: CareerProfile): CandidateEvidenceIndex {
  const skills: CandidateSkill[] = profile.skills.map((skill) => {
    const resolved = skill.lexiconId ? undefined : resolveSkillLabel(skill.name);
    const evidence: MatchEvidence[] = skill.evidence.length
      ? skill.evidence.map((item) => ({ source: item.source, detail: item.detail }))
      : [{ source: 'self-reported', detail: `Listed in your profile as ${skill.proficiency}` }];
    return {
      label: skill.name,
      lexiconId: skill.lexiconId ?? resolved?.id,
      proficiency: skill.proficiency,
      evidence,
    };
  });

  const projectText = profile.projects.map((p) => `${p.name}. ${p.description} ${p.outcomes.join(' ')}`).join('\n');
  const projectTechnologies = profile.projects.flatMap((p) => p.technologies).join(', ');
  const experienceText = profile.experience
    .map((e) => `${e.title} at ${e.company}. ${e.summary} ${e.achievements.join(' ')}`)
    .join('\n');
  const certificationText = profile.certifications.map((c) => `${c.name} (${c.issuer})`).join(', ');
  const narrativeText = [profile.headline, profile.summary, profile.interests.join(', '), profile.learningGoals.join(', ')].join('\n');

  return {
    skills,
    projectText,
    projectTechnologies,
    experienceText,
    certificationText,
    narrativeText,
    fullText: [narrativeText, projectText, experienceText, certificationText, skills.map((s) => s.label).join(', ')].join('\n'),
  };
}

function proficiencyRank(value: Proficiency): number {
  return PROFICIENCY_ORDER.indexOf(value);
}

function findDirectSkill(index: CandidateEvidenceIndex, requirement: JobRequirement): CandidateSkill | undefined {
  const target = requirement.skillId ?? resolveSkillLabel(requirement.label)?.id;
  return index.skills.find((skill) => {
    if (target && skill.lexiconId === target) return true;
    if (skill.label.toLowerCase() === requirement.label.toLowerCase()) return true;
    if (target && resolveSkillLabel(skill.label)?.id === target) return true;
    return false;
  });
}

function statusFor(value: number): MatchStatus {
  if (value >= MATCH_CONFIG.statusThresholds.confirmed) return 'confirmed';
  if (value >= MATCH_CONFIG.statusThresholds.partial) return 'partial';
  if (value > 0) return 'insufficient';
  return 'missing';
}

interface Assessment {
  value: number;
  evidence: MatchEvidence[];
  missing: string[];
}

/**
 * Scores one requirement. Several independent sources add a small capped bonus.
 */
export function assessRequirement(
  requirement: JobRequirement,
  index: CandidateEvidenceIndex,
  targetProficiency: Proficiency,
): Assessment {
  const evidence: MatchEvidence[] = [];
  const missing: string[] = [];
  let best = 0;

  const direct = findDirectSkill(index, requirement);
  if (direct) {
    const meetsTarget = proficiencyRank(direct.proficiency) >= proficiencyRank(targetProficiency);
    const value = meetsTarget ? MATCH_CONFIG.directMatch : MATCH_CONFIG.proficiencyScore[direct.proficiency];
    best = Math.max(best, value);
    evidence.push({
      source: direct.evidence[0]?.source ?? 'self-reported',
      detail: `Direct match: ${direct.label} in your profile (${direct.proficiency})${meetsTarget ? '' : `, below the ${targetProficiency} target for this advert`}`,
    });
  } else {
    missing.push('No matching skill recorded in your profile');
  }

  const methodName = requirement.label;
  if (containsTerm(index.projectTechnologies, methodName)) {
    best = Math.max(best, MATCH_CONFIG.projectTechnology);
    evidence.push({ source: 'project-supported', detail: `${methodName} appears in the technology list of one of your projects` });
  } else if (containsTerm(index.projectText, methodName)) {
    best = Math.max(best, MATCH_CONFIG.projectMention);
    evidence.push({ source: 'project-supported', detail: `${methodName} is mentioned in a project description` });
  }

  if (containsTerm(index.experienceText, methodName)) {
    best = Math.max(best, MATCH_CONFIG.experienceMention);
    evidence.push({ source: 'experience-supported', detail: `${methodName} appears in your work experience` });
  }

  if (containsTerm(index.certificationText, methodName)) {
    best = Math.max(best, MATCH_CONFIG.certification);
    evidence.push({ source: 'verified', detail: `${methodName} is covered by a recorded certification` });
  }

  if (best < MATCH_CONFIG.statusThresholds.confirmed) {
    // Resolve the canonical skill from the label too, so hand-edited or
    // user-added requirements still receive related-skill credit.
    const targetSkillId = requirement.skillId ?? resolveSkillLabel(requirement.label)?.id;
    if (targetSkillId) {
      const related = getRelatedSkills(targetSkillId);
      for (const candidate of related) {
        const owned = index.skills.find((skill) => skill.lexiconId === candidate.skill.id);
        if (!owned) continue;
        const value = MATCH_CONFIG.relatedSkill(candidate.weight);
        if (value > best) {
          best = value;
          evidence.unshift({
            source: 'self-reported',
            detail: `Partial credit: you recorded ${owned.label}, which is related to ${requirement.label} (${candidate.reason})`,
          });
        }
        break;
      }
    }

    if (best === 0) {
      const relatedNames = targetSkillId ? getRelatedSkills(targetSkillId).slice(0, 2).map((r) => r.skill.name) : [];
      if (relatedNames.length) missing.push(`No evidence found. Related ground you already have: ${relatedNames.join(', ')}`);
    }
  }

  const uniqueSources = uniqueBy(evidence, (item) => item.source);
  if (uniqueSources.length > 1) {
    best = Math.min(1, best + Math.min(MATCH_CONFIG.maxMultiSourceBonus, (uniqueSources.length - 1) * MATCH_CONFIG.multiSourceBonus));
  }

  return { value: roundTo(Math.min(1, best), 2), evidence, missing };
}

function explain(label: string, status: MatchStatus, value: number, assessment: Assessment): string {
  const parts: string[] = [];
  switch (status) {
    case 'confirmed':
      parts.push(`${label} is well supported.`);
      break;
    case 'partial':
      parts.push(`${label} is partially supported (${Math.round(value * 100)}% of the target proficiency).`);
      break;
    case 'insufficient':
      parts.push(`Only weak evidence for ${label} (${Math.round(value * 100)}%).`);
      break;
    default:
      parts.push(`No evidence found for ${label}. The absence of a keyword in your profile is not proof that you lack the skill.`);
  }
  for (const item of assessment.evidence.slice(0, 3)) {
    parts.push(`${EVIDENCE_SOURCE_LABELS[item.source] ?? item.source}: ${item.detail}`);
  }
  for (const item of assessment.missing.slice(0, 2)) parts.push(item);
  return parts.join(' ');
}

function buildNextSteps(report: Omit<MatchReport, 'nextSteps' | 'disclaimer' | 'createdAt'>, job: JobDescription): string[] {
  const steps: string[] = [];
  const missingRequired = report.matches.filter((m) => m.status === 'required' && m.matchValue < MATCH_CONFIG.statusThresholds.partial);
  const partialRequired = report.matches.filter((m) => m.status === 'required' && m.matchValue >= MATCH_CONFIG.statusThresholds.partial && m.matchValue < MATCH_CONFIG.statusThresholds.confirmed);

  if (report.counts.total === 0) {
    steps.push('No requirements were detected in this advert. Paste the full text or add requirements manually, then re-run the analysis.');
  }
  if (missingRequired.length) {
    steps.push(`Address the required gaps first: ${missingRequired.slice(0, 4).map((m) => m.label).join(', ')}. Open Skill Gap Analysis to see suggested practice tasks.`);
  }
  if (partialRequired.length) {
    steps.push(`Strengthen the evidence for: ${partialRequired.slice(0, 4).map((m) => m.label).join(', ')}. Add a project or work example that proves them.`);
  }
  if (report.counts.requiredSatisfied < report.counts.requiredTotal) {
    steps.push(`${report.counts.requiredSatisfied} of ${report.counts.requiredTotal} required criteria are currently satisfied.`);
  }
  if (report.score >= 70) {
    steps.push('Your recorded profile covers most of this advert. Tailor your CV wording to the requirements below, then apply.');
  }
  if (job.extraction.method === 'rule-based') {
    steps.push('Requirements were extracted automatically with keyword rules. Review the list and correct it if a tool was missed.');
  }
  if (report.counts.total > 0 && report.counts.confirmed === 0 && report.counts.partial === 0) {
    steps.push('Nothing matched yet. If you have these skills, record them in your career profile so the engine can see the evidence.');
  }
  return steps.slice(0, 5);
}

export interface MatchInput {
  profile: CareerProfile;
  job: JobDescription;
  /** Optional target proficiency override, keyed by requirement status. */
  targetProficiencyOverride?: Partial<Record<'required' | 'preferred', Proficiency>>;
}

/** Weighted matching. Same inputs always give the same report. */
export function computeMatch(input: MatchInput): MatchReport {
  const { profile, job } = input;
  const index = buildEvidenceIndex(profile);
  const { required: requiredTarget, preferred: preferredTarget } = MATCH_CONFIG.targetProficiency;

  const matches: RequirementMatch[] = job.requirements.map((requirement) => {
    const targetProficiency =
      (requirement.status === 'required' ? input.targetProficiencyOverride?.required : input.targetProficiencyOverride?.preferred) ??
      (requirement.status === 'required' ? requiredTarget : preferredTarget);

    const assessment = assessRequirement(requirement, index, targetProficiency);
    const status = statusFor(assessment.value);
    return {
      requirementId: requirement.id,
      label: requirement.label,
      skillId: requirement.skillId,
      status: requirement.status,
      weight: roundTo(requirement.weight * requirement.emphasis, 3),
      matchValue: assessment.value,
      matchStatus: status,
      evidence: assessment.evidence,
      explanation: explain(requirement.label, status, assessment.value, assessment),
    };
  });

  const totalWeight = matches.reduce((sum, m) => sum + m.weight, 0);
  const weighted = matches.reduce((sum, m) => sum + m.weight * m.matchValue, 0);
  const score = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0;

  const grade = MATCH_CONFIG.grades.find((band) => score >= band.min)?.label ?? 'Early fit';
  const requiredMatches = matches.filter((m) => m.status === 'required');

  const counts = {
    total: matches.length,
    confirmed: matches.filter((m) => m.matchStatus === 'confirmed').length,
    partial: matches.filter((m) => m.matchStatus === 'partial').length,
    missing: matches.filter((m) => m.matchValue === 0).length,
    requiredTotal: requiredMatches.length,
    requiredSatisfied: requiredMatches.filter((m) => m.matchStatus === 'confirmed').length,
  };

  const partial: Omit<MatchReport, 'nextSteps' | 'disclaimer' | 'createdAt'> = {
    id: makeId('match', `${job.id}:${profile.updatedAt}:${MATCH_CONFIG.version}`),
    jobId: job.id,
    jobTitle: job.title,
    engineVersion: MATCH_CONFIG.version,
    score,
    grade,
    matches,
    counts,
  };

  return {
    ...partial,
    nextSteps: buildNextSteps(partial, job),
    disclaimer: MATCH_DISCLAIMER,
    createdAt: new Date().toISOString(),
  };
}

export function matchHasChanged(previous: MatchReport | undefined, next: MatchReport): boolean {
  if (!previous) return true;
  if (previous.matches.length !== next.matches.length) return true;
  if (previous.score !== next.score) return true;
  return previous.matches.some((match, i) => match.matchValue !== next.matches[i]?.matchValue);
}
