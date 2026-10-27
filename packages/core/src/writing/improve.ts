import type { CareerProfile, ImprovementSuggestion, JobDescription, ProjectEntry } from '../types';
import { findLexiconHits } from '../skills/graph';
import { countTerm, makeId, normalizeWhitespace } from '../util/text';

/** Weak openers mapped onto concrete, past-tense action verbs. */
const OPENER_REWRITES: { pattern: RegExp; verb: string }[] = [
  { pattern: /^(i\s+)?(was\s+)?(tasked|responsible)\s+(with|for)\s+/i, verb: 'Owned' },
  { pattern: /^(i\s+)?worked\s+(on|with)\s+/i, verb: 'Delivered' },
  { pattern: /^(i\s+)?helped\s+(to\s+)?(with\s+)?/i, verb: 'Supported' },
  { pattern: /^(i\s+)?assisted\s+(with\s+|in\s+)?/i, verb: 'Supported' },
  { pattern: /^(i\s+)?participated\s+in\s+/i, verb: 'Contributed to' },
  { pattern: /^(i\s+)?was\s+involved\s+in\s+/i, verb: 'Contributed to' },
  { pattern: /^(i\s+)?was\s+part\s+of\s+/i, verb: 'Contributed to' },
  { pattern: /^(i\s+)?handled\s+/i, verb: 'Managed' },
  { pattern: /^(i\s+)?used\s+/i, verb: 'Applied' },
  { pattern: /^(i\s+)?learned\s+/i, verb: 'Applied' },
  { pattern: /^(i\s+)?did\s+/i, verb: 'Delivered' },
  { pattern: /^(i\s+)?made\s+/i, verb: 'Built' },
  { pattern: /^(i\s+)?created\s+/i, verb: 'Built' },
  { pattern: /^(i\s+)?took\s+part\s+in\s+/i, verb: 'Contributed to' },
];

const STRONG_VERBS = [
  'built', 'developed', 'designed', 'implemented', 'delivered', 'led', 'owned', 'launched',
  'automated', 'improved', 'reduced', 'increased', 'analysed', 'analyzed', 'migrated', 'tested',
  'documented', 'configured', 'integrated', 'refactored', 'optimised', 'optimized', 'shipped',
  'researched', 'supported', 'managed', 'contributed', 'created', 'established', 'coordinated',
];

const METRIC_RE = /\b\d+([.,]\d+)?\s*(%|percent|users?|customers?|clients?|staff|people|students?|developers?|engineers?|requests?|hours?|minutes?|seconds?|ms|days?|weeks?|k|m|x|reports?|records?|tickets?|accounts?|orders?|projects?|features?|components?|pages?|tests?)\b/i;
const FIRST_PERSON_RE = /\b(I|we|my|our|me|us)\b/gi;

function cleanSentence(input: string): string {
  let text = normalizeWhitespace(input).replace(/^[\s\u2022\u25cf\u25aa\u2013\u2014*\-\u00b7>]+/, '').trim();
  text = text.replace(FIRST_PERSON_RE, '').replace(/\s{2,}/g, ' ').trim();
  text = text.replace(/^[,;]\s*/, '');
  if (text && !/[.!?]$/.test(text)) text = `${text}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function hasStrongOpener(text: string): boolean {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  return STRONG_VERBS.includes(first) || /ed$/.test(first);
}

function rewriteOpener(text: string): { text: string; rewrote: boolean } {
  for (const rule of OPENER_REWRITES) {
    if (rule.pattern.test(text)) {
      const rest = text.replace(rule.pattern, '');
      const lowered = rest.charAt(0).toLowerCase() + rest.slice(1);
      return { text: `${rule.verb} ${lowered}`, rewrote: true };
    }
  }
  return { text, rewrote: false };
}

function advertiseMentions(text: string, job?: JobDescription): string[] {
  if (!job) return [];
  return job.requirements
    .filter((requirement) => countTerm(text, requirement.label) > 0)
    .map((requirement) => requirement.label)
    .slice(0, 4);
}

/**
 * Rewrites a single resume bullet with deterministic rules.
 * It never invents a metric: when a result is missing it asks the user for one
 * and leaves the sentence in neutral wording.
 */
export function improveBullet(
  original: string,
  kind: ImprovementSuggestion['kind'],
  options: { job?: JobDescription; profile?: CareerProfile } = {},
): ImprovementSuggestion {
  const source = normalizeWhitespace(original);
  const cleaned = cleanSentence(source);
  const rewritten = rewriteOpener(cleaned);
  const hasMetric = METRIC_RE.test(source);
  const skillHits = findLexiconHits(source).map((hit) => hit.skill.name);
  const advertMentions = advertiseMentions(source, options.job);

  const rationale: string[] = [];
  if (rewritten.rewrote) rationale.push('Replaced a passive opener with a concrete action verb.');
  if (!hasStrongOpener(rewritten.text) && !rewritten.rewrote) rationale.push('Starts with a descriptive phrase rather than an action - leading with a verb reads as impact.');
  if (source.match(FIRST_PERSON_RE)) rationale.push('Removed first-person pronouns, which is the convention for CV bullets.');
  if (!/[.!?]$/.test(source.trim())) rationale.push('Added end punctuation for a consistent list.');
  if (skillHits.length) rationale.push(`Named technologies detected: ${skillHits.join(', ')}.`);
  if (advertMentions.length) rationale.push(`Aligns with the advert's wording for: ${advertMentions.join(', ')}.`);
  if (options.job && advertMentions.length === 0) {
    rationale.push(`This bullet does not mention any of the advert's requirement keywords. If you used one of them here, name it explicitly.`);
  }
  if (!hasMetric) {
    rationale.push('No measurable outcome found. A number makes the claim verifiable - but never add one you cannot prove.');
  }

  const needsUserInput = !hasMetric;
  return {
    id: makeId('imp', `${kind}:${source.slice(0, 80)}`),
    original: source,
    revised: rewritten.text,
    kind,
    rationale: rationale.join(' ') || 'The wording is already action-led and concise.',
    needsUserInput,
    promptFor: needsUserInput
      ? 'What changed as a result of this work (users reached, time saved, percentage improved)? Only add it if you can verify the figure.'
      : undefined,
  };
}

export function improveSummary(profile: CareerProfile, job?: JobDescription): ImprovementSuggestion {
  const original = profile.summary.trim();
  const targetRole = job?.title || profile.preferredTitles[0] || 'your target role';
  const topSkills = profile.skills.slice(0, 4).map((skill) => skill.name);
  const focus = profile.experienceLevel === 'student' ? 'a student' : profile.experienceLevel === 'entry' ? 'an early-career professional' : 'an experienced professional';

  const parts: string[] = [];
  parts.push(`${focus} targeting ${targetRole}.`);
  if (topSkills.length) parts.push(`Works with ${topSkills.join(', ')}.`);
  const recentExperience = profile.experience[0];
  const recentProject = profile.projects[0];
  if (recentExperience) parts.push(`Most recently ${recentExperience.title} at ${recentExperience.company}.`);
  else if (recentProject) parts.push(`Recent project work includes ${recentProject.name}.`);
  parts.push('Looking for a role where these skills are used on real products.');

  const rationale: string[] = [];
  if (!original) rationale.push('Your profile has no summary yet, so this draft fills that gap using facts already recorded in your profile.');
  else rationale.push('Restructured so the role, the tools and the most recent experience appear in the first two lines.');
  if (original.length > 500) rationale.push('The original was long; recruiters read the first two lines before deciding.');
  if (job) rationale.push(`Tailored to the "${job.title}" advert.`);
  rationale.push('Review the wording: it only uses information you have already recorded.');

  return {
    id: makeId('imp', `summary:${profile.updatedAt}:${job?.id ?? 'none'}`),
    original: original || '(no summary recorded yet)',
    revised: parts.join(' '),
    kind: 'summary',
    rationale: rationale.join(' '),
    needsUserInput: !original,
    promptFor: !original ? 'Add anything specific about the kind of team or product you want to work on.' : undefined,
  };
}

export function improveProject(project: ProjectEntry, job?: JobDescription): ImprovementSuggestion {
  const original = [project.name, project.description].filter(Boolean).join(' — ');
  const techniques = project.technologies.length ? project.technologies.join(', ') : findLexiconHits(`${project.name} ${project.description}`).map((hit) => hit.skill.name).join(', ');
  const parts = [`${project.name}|`, project.description.replace(/\.$/, '')];
  if (techniques) parts.push(`Built with ${techniques}.`);
  const overstated = /\b(revolutionary|world.class|cutting.edge|game.changing)\b/i.test(original);
  if (overstated) parts.push('Described in plain, factual language.');

  const rationale: string[] = [];
  rationale.push('Leads with the project name and what it does, then the stack — the order a reviewer scans.');
  if (project.technologies.length === 0) rationale.push('No technologies were listed; adding the real stack makes the project useful evidence for matching.');
  if (!project.link) rationale.push('No repository or demo link recorded — adding one makes the claim verifiable.');
  if (job) rationale.push(`Checked against the "${job.title}" advert so you can reuse the wording where it is genuinely accurate.`);

  return {
    id: makeId('imp', `project:${project.id}`),
    original,
    revised: parts.join(' '),
    kind: 'project',
    rationale: rationale.join(' '),
    needsUserInput: !project.link,
    promptFor: !project.link ? 'Paste the repository or live demo link for this project.' : undefined,
  };
}

export function buildStudioSuggestions(profile: CareerProfile, job?: JobDescription): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [improveSummary(profile, job)];
  for (const entry of profile.experience.slice(0, 6)) {
    if (entry.summary) suggestions.push(improveBullet(entry.summary, 'experience', { job, profile }));
    for (const achievement of entry.achievements.slice(0, 4)) {
      suggestions.push(improveBullet(achievement, 'experience', { job, profile }));
    }
  }
  for (const project of profile.projects.slice(0, 5)) {
    suggestions.push(improveProject(project, job));
  }
  return suggestions;
}

/** Reorders achievements so advert-relevant ones appear first (real content only). */
export function buildTailoredExperience(profile: CareerProfile, job: JobDescription): { title: string; company: string; bullets: string[] }[] {
  return profile.experience.map((entry) => {
    const bullets = [...entry.achievements];
    const scored = bullets
      .map((bullet, index) => ({
        bullet,
        index,
        score: job.requirements.reduce((sum, requirement) => sum + (countTerm(bullet, requirement.label) > 0 ? 1 : 0), 0),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.bullet);
    return { title: entry.title, company: entry.company, bullets: scored };
  });
}

/** Plain-text resume assembled from verified profile data, for export/copy. */
export function draftResumeText(profile: CareerProfile, job?: JobDescription): string {
  const lines: string[] = [];
  lines.push(profile.displayName || 'Your name');
  if (profile.headline) lines.push(profile.headline);
  const contact = [profile.email, profile.phone, profile.location].filter(Boolean);
  if (contact.length) lines.push(contact.join(' | '));
  lines.push('');

  const summary = improveSummary(profile, job).revised;
  lines.push('PROFILE');
  lines.push(summary, '');

  const relevantSkills = job
    ? profile.skills.filter((skill) => job.requirements.some((requirement) => requirement.skillId && requirement.skillId === skill.lexiconId))
    : [];
  const skills = relevantSkills.length >= 4 ? relevantSkills : profile.skills;
  if (skills.length) {
    lines.push('SKILLS');
    lines.push(skills.map((skill) => skill.name).join(', '), '');
  }

  if (profile.experience.length) {
    lines.push('EXPERIENCE');
    for (const entry of profile.experience) {
      lines.push(`${entry.title} — ${entry.company}${entry.location ? `, ${entry.location}` : ''}`);
      lines.push(`${entry.startDate} - ${entry.current ? 'Present' : entry.endDate ?? ''}`);
      if (entry.summary) lines.push(`- ${entry.summary}`);
      for (const achievement of entry.achievements) lines.push(`- ${achievement}`);
      lines.push('');
    }
  }

  if (profile.projects.length) {
    lines.push('PROJECTS');
    for (const project of profile.projects) {
      lines.push(`${project.name}${project.technologies.length ? ` (${project.technologies.join(', ')})` : ''}`);
      if (project.description) lines.push(`- ${project.description}`);
      for (const outcome of project.outcomes) lines.push(`- ${outcome}`);
      if (project.link) lines.push(`- ${project.link}`);
      lines.push('');
    }
  }

  if (profile.education.length) {
    lines.push('EDUCATION');
    for (const entry of profile.education) {
      const years = [entry.startYear, entry.endYear].filter(Boolean).join(' - ');
      lines.push(`${entry.degree}${entry.fieldOfStudy ? `, ${entry.fieldOfStudy}` : ''} — ${entry.institution}${years ? ` (${years})` : ''}`);
    }
    lines.push('');
  }

  if (profile.certifications.length) {
    lines.push('CERTIFICATIONS');
    for (const entry of profile.certifications) {
      lines.push(`${entry.name} — ${entry.issuer}${entry.year ? ` (${entry.year})` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
