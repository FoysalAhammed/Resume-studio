/**
 * CareerLens AI - shared domain types.
 *
 * This module is the single source of truth for the data that flows through the
 * whole platform (web app, API and tests). It is intentionally free of any
 * framework or runtime dependency so it can be unit tested in isolation.
 */

export const SCHEMA_VERSION = 1;
export const MATCH_ENGINE_VERSION = '1.0.0';

export type SkillCategory =
  | 'Programming Languages'
  | 'Frontend'
  | 'Backend'
  | 'Databases'
  | 'Cloud & DevOps'
  | 'Data & Analytics'
  | 'AI & Machine Learning'
  | 'Mobile'
  | 'Testing & Quality'
  | 'Security'
  | 'Design & UX'
  | 'Product & Business'
  | 'Marketing & Growth'
  | 'Tools & Workflow'
  | 'Soft Skills'
  | 'Other';

export type Proficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type EvidenceSource =
  | 'self-reported'
  | 'resume-derived'
  | 'project-supported'
  | 'experience-supported'
  | 'assessment-supported'
  | 'verified';

export interface SkillEvidence {
  source: EvidenceSource;
  detail: string;
  /** Optional link proving the evidence (repository, certificate, assessment). */
  link?: string;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  /** Canonical lexicon id when the skill was recognised, otherwise undefined. */
  lexiconId?: string;
  proficiency: Proficiency;
  yearsExperience?: number;
  evidence: SkillEvidence[];
  /** Where the entry came from. Sample data is always labelled. */
  origin: 'user' | 'sample';
  updatedAt: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  grade?: string;
  details?: string;
  origin: 'user' | 'sample';
}

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  summary: string;
  achievements: string[];
  origin: 'user' | 'sample';
}

export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  role?: string;
  link?: string;
  technologies: string[];
  outcomes: string[];
  origin: 'user' | 'sample';
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  year?: number;
  credentialId?: string;
  link?: string;
  origin: 'user' | 'sample';
}

export type ExperienceLevel = 'student' | 'entry' | 'mid' | 'senior';
export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'flexible';

export interface CareerProfile {
  displayName: string;
  headline: string;
  summary: string;
  email: string;
  phone: string;
  location: string;
  experienceLevel: ExperienceLevel;
  workMode: WorkMode;
  preferredTitles: string[];
  preferredLocations: string[];
  interests: string[];
  learningGoals: string[];
  weeklyLearningHours: number;
  skills: Skill[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  updatedAt: string;
}

/** A career profile as persisted, tagged with its provenance. */
export interface StoredProfile extends CareerProfile {
  origin: 'user' | 'sample';
}

/* ------------------------------------------------------------------ jobs -- */

export type RequirementStatus = 'required' | 'preferred';

export interface JobRequirement {
  id: string;
  /** Canonical lexicon id when recognised locally. */
  skillId?: string;
  label: string;
  category?: SkillCategory;
  status: RequirementStatus;
  /** Base importance, configurable through MATCH_WEIGHTS. */
  weight: number;
  /** Extra emphasis multiplier derived from the wording of the advert (1 to 1.3). */
  emphasis: number;
  /** Rough hours needed to become productive with this skill from scratch. */
  learnHours?: number;
  /** true when the user manually added or corrected the requirement. */
  editedByUser?: boolean;
}

export interface JobDescription {
  id: string;
  title: string;
  company: string;
  location: string;
  experienceLevel: ExperienceLevel | '';
  sourceUrl?: string;
  rawText: string;
  requirements: JobRequirement[];
  responsibilities: string[];
  educationRequirement: string;
  experienceRequirement: { minYears: number; text: string } | null;
  extraction: {
    method: 'rule-based' | 'ai';
    notes: string[];
    extractedAt: string;
  };
  origin: 'user' | 'sample';
  createdAt: string;
  updatedAt: string;
}

/* --------------------------------------------------------------- matching -- */

export type MatchStatus = 'confirmed' | 'partial' | 'insufficient' | 'missing';

export interface MatchEvidence {
  source: EvidenceSource;
  detail: string;
}

export interface RequirementMatch {
  requirementId: string;
  label: string;
  skillId?: string;
  status: RequirementStatus;
  weight: number;
  /** 0 = no evidence, 1 = strongly supported. */
  matchValue: number;
  matchStatus: MatchStatus;
  evidence: MatchEvidence[];
  explanation: string;
}

export interface MatchReport {
  id: string;
  jobId: string;
  jobTitle: string;
  engineVersion: string;
  /** 0 - 100, deterministic for identical inputs. */
  score: number;
  grade: string;
  matches: RequirementMatch[];
  counts: {
    total: number;
    confirmed: number;
    partial: number;
    missing: number;
    requiredTotal: number;
    requiredSatisfied: number;
  };
  nextSteps: string[];
  disclaimer: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ gaps -- */

export interface SkillGap {
  id: string;
  requirementId: string;
  skillId?: string;
  label: string;
  category?: SkillCategory;
  status: RequirementStatus;
  matchValue: number;
  importance: 'high' | 'medium' | 'low';
  whyItMatters: string;
  existingEvidence: string[];
  targetProficiency: Proficiency;
  suggestedTask: string;
  estimatedHours: number;
  /** Internal recommendation score - NOT a market statistic. */
  priorityScore: number;
  priorityBasis: 'internal-recommendation';
  resources: { label: string; url: string }[];
}

/* -------------------------------------------------------------- roadmap --- */

export type TaskStatus = 'not-started' | 'in-progress' | 'completed';
export type RoadmapPhase = 'Foundation' | 'Practice' | 'Portfolio' | 'Applications';

export interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  skillId?: string;
  skillLabel?: string;
  phase: RoadmapPhase;
  estimatedHours: number;
  priority: number;
  prerequisites: string[];
  exercise: string;
  completionCriteria: string;
  status: TaskStatus;
  notes?: string;
  custom?: boolean;
  updatedAt: string;
}

export interface LearningRoadmap {
  id: string;
  title: string;
  targetRole: string;
  jobId?: string;
  weeklyHours: number;
  horizonWeeks: number;
  tasks: RoadmapTask[];
  sourceSkillGaps: string[];
  generation: {
    method: 'deterministic-template' | 'ai-personalised';
    notes: string[];
  };
  origin: 'user' | 'sample';
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapProgress {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  /** Percentage of tasks actually completed. */
  percentComplete: number;
  completedHours: number;
  totalHours: number;
  /** Estimated weeks left at the configured weekly availability. */
  estimatedWeeksRemaining: number;
}

/* ------------------------------------------------------- resume analysis -- */

export type ExtractionConfidence = 'found' | 'inferred';

export interface ExtractedField<T> {
  value: T;
  confidence: ExtractionConfidence;
  /** Line or snippet the value came from (never invented). */
  source?: string;
}

export interface ResumeAnalysis {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  charactersExtracted: number;
  wordCount: number;
  sectionsDetected: string[];
  profile: {
    displayName: ExtractedField<string> | null;
    headline: ExtractedField<string> | null;
    summary: ExtractedField<string> | null;
    email: ExtractedField<string> | null;
    phone: ExtractedField<string> | null;
    location: ExtractedField<string> | null;
  };
  skills: {
    label: string;
    category: SkillCategory;
    lexiconId?: string;
    mentions: number;
    /** 'found' = read from a skills section, 'inferred' = spotted elsewhere. */
    detectedVia: ExtractionConfidence;
  }[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  strengths: string[];
  missingInformation: string[];
  completeness: { score: number; checks: { label: string; passed: boolean }[] };
  suggestions: string[];
  warnings: string[];
  textPreview: string;
  /** Kept in memory only - the raw upload is never persisted. */
  retained: boolean;
  createdAt: string;
  origin: 'user' | 'sample';
}

/* ---------------------------------------------------------- resume studio -- */

export interface ImprovementSuggestion {
  id: string;
  original: string;
  revised: string;
  kind: 'summary' | 'experience' | 'project';
  rationale: string;
  /** True when the writer cannot improve the text without more information. */
  needsUserInput: boolean;
  promptFor?: string;
}

export interface DiffSegment {
  type: 'same' | 'added' | 'removed';
  value: string;
}

export interface DraftDocument {
  id: string;
  kind: 'cover-letter' | 'resume-section';
  title: string;
  body: string;
  jobId?: string;
  generated: { method: 'deterministic-template' | 'ai'; notes: string[] };
  reviewed: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------- interview -- */

export type InterviewQuestionType = 'technical' | 'practical' | 'project' | 'behavioural';

export interface InterviewQuestion {
  id: string;
  type: InterviewQuestionType;
  topic: string;
  difficulty: 'foundation' | 'intermediate' | 'advanced';
  question: string;
  origin: 'curated-template' | 'job-requirement';
  relatedSkillId?: string;
  /** Curated hints are shown only after the user submits an answer. */
  rubricHints: string[];
}

export interface InterviewFeedback {
  questionId: string;
  coverageScore: number;
  structureScore: number;
  heuristicScore: number;
  matchedPoints: string[];
  missingPoints: string[];
  notes: string[];
  label: 'heuristic-feedback';
}

export interface InterviewSession {
  id: string;
  role: string;
  difficulty: 'foundation' | 'intermediate' | 'advanced';
  questions: InterviewQuestion[];
  answers: { questionId: string; text: string; feedback: InterviewFeedback }[];
  createdAt: string;
}

/* -------------------------------------------------------------- activity -- */

export type ActivityKind =
  | 'profile-updated'
  | 'resume-analysed'
  | 'job-analysed'
  | 'match-computed'
  | 'roadmap-generated'
  | 'task-completed'
  | 'draft-generated'
  | 'sample-loaded'
  | 'workspace-reset';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  at: string;
}

/* ------------------------------------------------------------- workspace -- */

export interface Workspace {
  schemaVersion: number;
  /** 'sample' means the workspace is the clearly-labelled demo dataset. */
  origin: 'user' | 'sample';
  profile: StoredProfile;
  jobs: JobDescription[];
  matches: MatchReport[];
  roadmaps: LearningRoadmap[];
  resumeAnalyses: ResumeAnalysis[];
  drafts: DraftDocument[];
  interviewSessions: InterviewSession[];
  activity: ActivityEvent[];
  /** App-level preferences (never secrets). */
  settings: {
    reducedMotion: boolean;
    defaultHorizonWeeks: number;
  };
  updatedAt: string;
}

export interface ApiHealth {
  status: 'ok';
  mode: 'local' | 'ai';
  ai: { configured: boolean; model: string | null; baseUrl: string | null };
  version: string;
  matchEngineVersion: string;
  limits: { maxUploadMb: number };
}
