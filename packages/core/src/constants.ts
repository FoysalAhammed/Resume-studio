import type { ExperienceLevel, Proficiency } from './types';

/** All the matching numbers live here so runs stay reproducible. */
export const MATCH_CONFIG = {
  version: '1.0.0',
  weights: {
    required: 3,
    preferred: 1.5,
  },
  /** "must have", ALL CAPS or repeated mentions nudge this up. */
  emphasis: {
    min: 1,
    max: 1.3,
  },
  directMatch: 1,
  proficiencyScore: {
    beginner: 0.7,
    intermediate: 0.85,
    advanced: 1,
    expert: 1,
  } satisfies Record<Proficiency, number>,
  /** Partial credit for a related skill, scaled by how close it is. */
  relatedSkill(value: number): number {
    return 0.4 + 0.4 * value;
  },
  /** Evidence from a project description or its technology list. */
  projectMention: 0.7,
  projectTechnology: 0.85,
  experienceMention: 0.8,
  certification: 0.65,
  /** Small bonus per extra independent source, capped below. */
  multiSourceBonus: 0.05,
  maxMultiSourceBonus: 0.1,
  /** Cut-offs that turn the match value into a human status. */
  statusThresholds: {
    confirmed: 0.85,
    partial: 0.4,
  },
  grades: [
    { min: 85, label: 'Strong fit' },
    { min: 70, label: 'Good fit' },
    { min: 50, label: 'Developing fit' },
    { min: 0, label: 'Early fit' },
  ],
  targetProficiency: {
    required: 'intermediate',
    preferred: 'beginner',
  } satisfies Record<'required' | 'preferred', Proficiency>,
} as const;

export const MATCH_DISCLAIMER =
  'This score estimates how well your recorded profile matches the requirements in the job description. ' +
  'It is not a prediction of being hired, and missing evidence is not proof that you lack a skill.';

export const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  'self-reported': 'Self-reported',
  'resume-derived': 'Resume-derived',
  'project-supported': 'Project-supported',
  'experience-supported': 'Work-experience supported',
  'assessment-supported': 'Assessment-supported',
  verified: 'Verified by an approved source',
  'project-technology': 'Listed in a project technology stack',
  'related-skill': 'Related skill',
  certification: 'Certification',
};

export const PROFICIENCY_ORDER: Proficiency[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  student: 'Student / intern',
  entry: 'Entry level (0-2 years)',
  mid: 'Mid level (2-5 years)',
  senior: 'Senior (5+ years)',
};

/** Upload + text limits shared by the API and the browser validator. */
export const LIMITS = {
  maxUploadBytes: 6 * 1024 * 1024,
  acceptedExtensions: ['.pdf', '.docx', '.txt', '.md'] as const,
  acceptedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ] as const,
  minExtractedCharacters: 200,
  maxJobTextChars: 30000,
  maxResumeTextChars: 60000,
  maxProfileJsonChars: 200000,
} as const;

export const APP_NAME = 'CareerLens AI';
export const APP_TAGLINE = 'Understand your skills. Discover your opportunities. Build a path toward your career.';
export const SAMPLE_BADGE = 'Demonstration data';
