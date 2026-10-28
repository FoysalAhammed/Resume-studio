import { z } from 'zod';
import { LIMITS } from './constants';

export const skillCategorySchema = z.enum([
  'Programming Languages',
  'Frontend',
  'Backend',
  'Databases',
  'Cloud & DevOps',
  'Data & Analytics',
  'AI & Machine Learning',
  'Mobile',
  'Testing & Quality',
  'Security',
  'Design & UX',
  'Product & Business',
  'Marketing & Growth',
  'Tools & Workflow',
  'Soft Skills',
  'Other',
]);

export const proficiencySchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);
export const evidenceSourceSchema = z.enum([
  'self-reported',
  'resume-derived',
  'project-supported',
  'experience-supported',
  'assessment-supported',
  'verified',
]);
export const experienceLevelSchema = z.enum(['student', 'entry', 'mid', 'senior']);
export const workModeSchema = z.enum(['remote', 'hybrid', 'onsite', 'flexible']);
export const taskStatusSchema = z.enum(['not-started', 'in-progress', 'completed']);
export const requirementStatusSchema = z.enum(['required', 'preferred']);

export const skillEvidenceSchema = z.object({
  source: evidenceSourceSchema,
  detail: z.string().min(1).max(400),
  link: z.string().max(400).optional(),
});

export const skillSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  category: skillCategorySchema,
  lexiconId: z.string().max(80).optional(),
  proficiency: proficiencySchema,
  yearsExperience: z.number().min(0).max(60).optional(),
  evidence: z.array(skillEvidenceSchema).max(20),
  origin: z.enum(['user', 'sample']),
  updatedAt: z.string(),
});

export const educationSchema = z.object({
  id: z.string().min(1).max(80),
  institution: z.string().min(1).max(160),
  degree: z.string().min(1).max(160),
  fieldOfStudy: z.string().max(120).optional(),
  startYear: z.number().int().min(1950).max(2100).optional(),
  endYear: z.number().int().min(1950).max(2100).optional(),
  grade: z.string().max(60).optional(),
  details: z.string().max(600).optional(),
  origin: z.enum(['user', 'sample']),
});

export const experienceSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  company: z.string().min(1).max(120),
  location: z.string().max(120).optional(),
  startDate: z.string().max(40),
  endDate: z.string().max(40).optional(),
  current: z.boolean(),
  summary: z.string().max(1000),
  achievements: z.array(z.string().max(600)).max(20),
  origin: z.enum(['user', 'sample']),
});

export const projectSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().max(1200),
  role: z.string().max(120).optional(),
  link: z.string().max(400).optional(),
  technologies: z.array(z.string().max(60)).max(30),
  outcomes: z.array(z.string().max(600)).max(20),
  origin: z.enum(['user', 'sample']),
});

export const certificationSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  issuer: z.string().min(1).max(160),
  year: z.number().int().min(1950).max(2100).optional(),
  credentialId: z.string().max(120).optional(),
  link: z.string().max(400).optional(),
  origin: z.enum(['user', 'sample']),
});

export const profileSchema = z.object({
  displayName: z.string().max(120),
  headline: z.string().max(160),
  summary: z.string().max(2000),
  email: z.union([z.string().email().max(160), z.literal('')]),
  phone: z.string().max(60),
  location: z.string().max(160),
  experienceLevel: experienceLevelSchema,
  workMode: workModeSchema,
  preferredTitles: z.array(z.string().max(80)).max(10),
  preferredLocations: z.array(z.string().max(80)).max(10),
  interests: z.array(z.string().max(80)).max(20),
  learningGoals: z.array(z.string().max(160)).max(20),
  weeklyLearningHours: z.number().min(0).max(80),
  skills: z.array(skillSchema).max(150),
  education: z.array(educationSchema).max(20),
  experience: z.array(experienceSchema).max(20),
  projects: z.array(projectSchema).max(30),
  certifications: z.array(certificationSchema).max(30),
  updatedAt: z.string(),
});

export const storedProfileSchema = profileSchema.extend({ origin: z.enum(['user', 'sample']) });

export const jobRequirementSchema = z.object({
  id: z.string().min(1).max(80),
  skillId: z.string().max(80).optional(),
  label: z.string().min(1).max(120),
  category: skillCategorySchema.optional(),
  status: requirementStatusSchema,
  weight: z.number().min(0).max(10),
  emphasis: z.number().min(0.5).max(2),
  learnHours: z.number().min(0).max(500).optional(),
  editedByUser: z.boolean().optional(),
});

export const jobSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  company: z.string().max(160),
  location: z.string().max(160),
  experienceLevel: z.union([experienceLevelSchema, z.literal('')]),
  sourceUrl: z.string().max(400).optional(),
  rawText: z.string().max(LIMITS.maxJobTextChars),
  requirements: z.array(jobRequirementSchema).max(60),
  responsibilities: z.array(z.string().max(400)).max(20),
  educationRequirement: z.string().max(200),
  experienceRequirement: z.object({ minYears: z.number().min(0).max(40), text: z.string().max(80) }).nullable(),
  extraction: z.object({
    method: z.enum(['rule-based', 'ai']),
    notes: z.array(z.string().max(400)).max(10),
    extractedAt: z.string(),
  }),
  origin: z.enum(['user', 'sample']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const roadmapTaskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  skillId: z.string().max(80).optional(),
  skillLabel: z.string().max(80).optional(),
  phase: z.enum(['Foundation', 'Practice', 'Portfolio', 'Applications']),
  estimatedHours: z.number().min(0).max(400),
  priority: z.number().min(0).max(10000),
  prerequisites: z.array(z.string().max(80)).max(10),
  exercise: z.string().max(1000),
  completionCriteria: z.string().max(600),
  status: taskStatusSchema,
  notes: z.string().max(1000).optional(),
  custom: z.boolean().optional(),
  updatedAt: z.string(),
});

export const roadmapSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  targetRole: z.string().max(160),
  jobId: z.string().max(80).optional(),
  weeklyHours: z.number().min(1).max(80),
  horizonWeeks: z.number().min(1).max(104),
  tasks: z.array(roadmapTaskSchema).max(80),
  sourceSkillGaps: z.array(z.string().max(80)).max(40),
  generation: z.object({
    method: z.enum(['deterministic-template', 'ai-personalised']),
    notes: z.array(z.string().max(600)).max(10),
  }),
  origin: z.enum(['user', 'sample']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const resumeAnalysisSchema = z.object({
  id: z.string().min(1).max(80),
  fileName: z.string().max(200),
  fileType: z.string().max(120),
  fileSizeBytes: z.number().min(0),
  charactersExtracted: z.number().min(0),
  wordCount: z.number().min(0),
  sectionsDetected: z.array(z.string().max(60)).max(20),
  profile: z.object({
    displayName: z.object({ value: z.string(), confidence: z.enum(['found', 'inferred']), source: z.string().optional() }).nullable(),
    headline: z.object({ value: z.string(), confidence: z.enum(['found', 'inferred']), source: z.string().optional() }).nullable(),
    summary: z.object({ value: z.string(), confidence: z.enum(['found', 'inferred']), source: z.string().optional() }).nullable(),
    email: z.object({ value: z.string(), confidence: z.enum(['found', 'inferred']), source: z.string().optional() }).nullable(),
    phone: z.object({ value: z.string(), confidence: z.enum(['found', 'inferred']), source: z.string().optional() }).nullable(),
    location: z.object({ value: z.string(), confidence: z.enum(['found', 'inferred']), source: z.string().optional() }).nullable(),
  }),
  skills: z.array(z.object({
    label: z.string().max(80),
    category: skillCategorySchema,
    lexiconId: z.string().max(80).optional(),
    mentions: z.number().min(0),
    detectedVia: z.enum(['found', 'inferred']),
  })).max(80),
  education: z.array(educationSchema).max(20),
  experience: z.array(experienceSchema).max(20),
  projects: z.array(projectSchema).max(30),
  certifications: z.array(certificationSchema).max(30),
  strengths: z.array(z.string().max(400)).max(20),
  missingInformation: z.array(z.string().max(400)).max(20),
  completeness: z.object({
    score: z.number().min(0).max(100),
    checks: z.array(z.object({ label: z.string().max(200), passed: z.boolean() })).max(20),
  }),
  suggestions: z.array(z.string().max(600)).max(20),
  warnings: z.array(z.string().max(600)).max(10),
  textPreview: z.string().max(4000),
  retained: z.boolean(),
  createdAt: z.string(),
  origin: z.enum(['user', 'sample']),
});

export const activitySchema = z.object({
  id: z.string().max(80),
  kind: z.enum([
    'profile-updated', 'resume-analysed', 'job-analysed', 'match-computed',
    'roadmap-generated', 'task-completed', 'draft-generated', 'sample-loaded', 'workspace-reset',
  ]),
  message: z.string().max(400),
  at: z.string(),
});

export const draftSchema = z.object({
  id: z.string().max(80),
  kind: z.enum(['cover-letter', 'resume-section']),
  title: z.string().max(200),
  body: z.string().max(20000),
  jobId: z.string().max(80).optional(),
  generated: z.object({
    method: z.enum(['deterministic-template', 'ai']),
    notes: z.array(z.string().max(600)).max(10),
  }),
  reviewed: z.boolean(),
  createdAt: z.string(),
});

export const interviewFeedbackSchema = z.object({
  questionId: z.string().max(80),
  coverageScore: z.number().min(0).max(100),
  structureScore: z.number().min(0).max(100),
  heuristicScore: z.number().min(0).max(100),
  matchedPoints: z.array(z.string().max(200)).max(20),
  missingPoints: z.array(z.string().max(200)).max(20),
  notes: z.array(z.string().max(600)).max(10),
  label: z.literal('heuristic-feedback'),
});

export const matchReportSchema = z.object({
  id: z.string().max(80),
  jobId: z.string().max(80),
  jobTitle: z.string().max(160),
  engineVersion: z.string().max(40),
  score: z.number().min(0).max(100),
  grade: z.string().max(60),
  matches: z.array(z.object({
    requirementId: z.string().max(80),
    label: z.string().max(120),
    skillId: z.string().max(80).optional(),
    status: requirementStatusSchema,
    weight: z.number().min(0).max(20),
    matchValue: z.number().min(0).max(1),
    matchStatus: z.enum(['confirmed', 'partial', 'insufficient', 'missing']),
    evidence: z.array(z.object({ source: evidenceSourceSchema, detail: z.string().max(600) })).max(10),
    explanation: z.string().max(1500),
  })).max(60),
  counts: z.object({
    total: z.number().min(0),
    confirmed: z.number().min(0),
    partial: z.number().min(0),
    missing: z.number().min(0),
    requiredTotal: z.number().min(0),
    requiredSatisfied: z.number().min(0),
  }),
  nextSteps: z.array(z.string().max(600)).max(10),
  disclaimer: z.string().max(600),
  createdAt: z.string(),
});

export const interviewQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(['technical', 'practical', 'project', 'behavioural']),
  topic: z.string().min(1).max(120),
  difficulty: z.enum(['foundation', 'intermediate', 'advanced']),
  question: z.string().min(10).max(1000),
  origin: z.enum(['curated-template', 'job-requirement']),
  relatedSkillId: z.string().max(80).optional(),
  rubricHints: z.array(z.string().min(1).max(200)).min(1).max(10),
});

export const workspaceSchema = z.object({
  schemaVersion: z.number().int().min(1).max(100),
  origin: z.enum(['user', 'sample']),
  profile: storedProfileSchema,
  jobs: z.array(jobSchema).max(50),
  matches: z.array(matchReportSchema).max(50),
  roadmaps: z.array(roadmapSchema).max(20),
  resumeAnalyses: z.array(resumeAnalysisSchema).max(20),
  drafts: z.array(draftSchema).max(50),
  interviewSessions: z.array(z.object({
    id: z.string().max(80),
    role: z.string().max(160),
    difficulty: z.enum(['foundation', 'intermediate', 'advanced']),
    questions: z.array(interviewQuestionSchema).max(30),
    answers: z.array(z.object({
      questionId: z.string().max(80),
      text: z.string().max(6000),
      feedback: interviewFeedbackSchema,
    })).max(30),
    createdAt: z.string(),
  })).max(20),
  activity: z.array(activitySchema).max(200),
  settings: z.object({
    reducedMotion: z.boolean(),
    defaultHorizonWeeks: z.number().min(1).max(104),
  }),
  updatedAt: z.string(),
});

export const jobAnalyzeRequestSchema = z.object({
  title: z.string().max(160).optional(),
  company: z.string().max(160).optional(),
  location: z.string().max(160).optional(),
  experienceLevel: z.union([experienceLevelSchema, z.literal('')]).optional(),
  sourceUrl: z.string().max(400).optional(),
  rawText: z.string().min(40, 'Paste at least a few lines of the advert.').max(LIMITS.maxJobTextChars),
  useAi: z.boolean().optional(),
});

export const resumeTextParseRequestSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileType: z.string().max(120).optional(),
  fileSizeBytes: z.number().min(0).max(LIMITS.maxUploadBytes * 4).optional(),
  text: z.string().min(1).max(LIMITS.maxResumeTextChars),
});

export const matchRequestSchema = z.object({
  profile: profileSchema,
  job: jobSchema,
});

export const improveRequestSchema = z.object({
  profile: profileSchema,
  text: z.string().min(3).max(1200),
  kind: z.enum(['summary', 'experience', 'project']).default('experience'),
  job: jobSchema.optional(),
  useAi: z.boolean().optional(),
});

export const coverLetterRequestSchema = z.object({
  profile: profileSchema,
  job: jobSchema,
  motivation: z.string().max(1500).default(''),
  addressGap: z.boolean().optional(),
  useAi: z.boolean().optional(),
});

export const interviewRequestSchema = z.object({
  profile: profileSchema,
  job: jobSchema.optional(),
  difficulty: z.enum(['foundation', 'intermediate', 'advanced']).default('intermediate'),
  types: z.array(z.enum(['technical', 'practical', 'project', 'behavioural'])).min(1).max(4),
  topic: z.string().max(80).optional(),
  count: z.number().int().min(1).max(15).optional(),
  useAi: z.boolean().optional(),
});

export const interviewAnalyzeRequestSchema = z.object({
  question: interviewQuestionSchema,
  answer: z.string().min(1).max(6000),
});

export const extensionAnalyzeRequestSchema = z.object({
  jobText: z.string().min(20).max(LIMITS.maxJobTextChars),
  jobTitle: z.string().max(160).optional(),
  company: z.string().max(160).optional(),
  /** Only the fields needed for matching are accepted; never the whole profile. */
  skills: z.array(z.object({
    name: z.string().min(1).max(80),
    proficiency: proficiencySchema,
    lexiconId: z.string().max(80).optional(),
  })).max(120),
});

export const aiRequirementListSchema = z.object({
  requirements: z.array(z.object({
    label: z.string().min(1).max(120),
    status: requirementStatusSchema,
    category: skillCategorySchema.optional(),
    learnHours: z.number().min(1).max(400).optional(),
  })).max(60),
  responsibilities: z.array(z.string().max(400)).max(20).optional(),
  educationRequirement: z.string().max(200).optional(),
});

export const aiRoadmapPersonalisationSchema = z.object({
  tasks: z.array(z.object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(1000).optional(),
    exercise: z.string().min(1).max(1000).optional(),
  })).max(80),
});

export const aiCoverLetterSchema = z.object({
  body: z.string().min(40).max(8000),
});

export const aiImprovedTextSchema = z.object({
  revised: z.string().min(1).max(1500),
  rationale: z.string().min(1).max(1000),
});

export const aiInterviewQuestionsSchema = z.object({
  questions: z.array(z.object({
    question: z.string().min(10).max(1000),
    type: z.enum(['technical', 'practical', 'project', 'behavioural']),
    difficulty: z.enum(['foundation', 'intermediate', 'advanced']),
    topic: z.string().min(1).max(120),
    rubricHints: z.array(z.string().min(1).max(200)).min(1).max(6),
  })).min(1).max(15),
});

export const aiResumeExtractionSchema = z.object({
  displayName: z.string().max(120).optional(),
  headline: z.string().max(160).optional(),
  summary: z.string().max(2000).optional(),
  email: z.string().max(160).optional(),
  phone: z.string().max(60).optional(),
  location: z.string().max(160).optional(),
  skills: z.array(z.string().min(1).max(80)).max(80),
  strengths: z.array(z.string().max(400)).max(10).optional(),
});

export type AiRequirementList = z.infer<typeof aiRequirementListSchema>;
export type AiRoadmapPersonalisation = z.infer<typeof aiRoadmapPersonalisationSchema>;
export type AiInterviewQuestions = z.infer<typeof aiInterviewQuestionsSchema>;
