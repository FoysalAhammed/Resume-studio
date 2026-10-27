import type { ExperienceLevel, Proficiency } from './types';

/**
 * Every number the explainable matching engine uses lives here so the model is
 * configurable in one place and reproducible across runs.
 */
export const MATCH_CONFIG = {
  version: '1.0.0',
  /** Base importance of a requirement. */
  weights: {
    required: 3,
    preferred: 1.5,
  },
  /** "must have" / ALL CAPS / repeated mentions can raise importance slightly. */
  emphasis: {
    min: 1,
    max: 1.3,
  },
  /** Match value awarded for a direct, aligned skill. */
  directMatch: 1,
  /** Match value awarded for a direct skill below the target proficiency. */
  proficiencyScore: {
    beginner: 0.7,
    intermediate: 0.85,
    advanced: 1,
    expert: 1,
  } satisfies Record<Proficiency, number>,
  /** Related-skill evidence: partial credit scaled by how close the relation is. */
  relatedSkill(value: number): number {
    return 0.4 + 0.4 * value;
  },
  /** Evidence found only in a project description / technology list. */
  projectMention: 0.7,
  projectTechnology: 0.85,
  /** Evidence found in a work-experience description. */
  experienceMention: 0.8,
  /** Evidence from a certification. */
  certification: 0.65,
  /** Bonus per extra independent evidence source (max limited below). */
  multiSourceBonus: 0.05,
  maxMultiSourceBonus: 0.1,
  /** Thresholds that map a numeric match value onto a human status. */
  statusThresholds: {
    confirmed: 0.85,
    partial: 0.4,
  },
  /** Grade bands for the overall score. */
  grades: [
    { min: 85, label: 'Strong fit' },
    { min: 70, label: 'Good fit' },
    { min: 50, label: 'Developing fit' },
    { min: 0, label: 'Early fit' },
  ],
  /** Expected proficiency for a requirement given its status and candidate level. */
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
