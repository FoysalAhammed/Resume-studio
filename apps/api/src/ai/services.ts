import {
  aiCoverLetterSchema,
  aiImprovedTextSchema,
  aiInterviewQuestionsSchema,
  aiRequirementListSchema,
  aiResumeExtractionSchema,
  aiRoadmapPersonalisationSchema,
  type AiInterviewQuestions,
  type AiRequirementList,
  type Proficiency,
} from '@careerlens/core';
import { asDocument, callAi, parseJsonResponse } from './provider';

// One function per AI capability. Output is validated against a Zod contract before callers see it.

export type ServiceResult<T> = { ok: true; value: T; model: string } | { ok: false; reason: string; message: string };

function validateWith<T>(schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: unknown } }, raw: unknown, label: string, model: string): ServiceResult<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success || parsed.data === undefined) {
    return { ok: false, reason: 'validation-failed', message: `${label} returned unexpected data, so the local result was kept.` };
  }
  return { ok: true, value: parsed.data, model };
}

export interface RequirementPromptInput {
  jobText: string;
  title?: string;
  // Skills already found locally, so the model can concentrate on the rest.
  knownSkills: string[];
}

export async function aiRefineRequirements(input: RequirementPromptInput): Promise<ServiceResult<AiRequirementList>> {
  const result = await callAi({
    json: true,
    maxTokens: 1500,
    system:
      'Extract the hiring criteria from a job advert. Return JSON exactly in this shape: ' +
      '{"requirements":[{"label":"TypeScript","status":"required|preferred","category":"Backend","learnHours":40}],' +
      '"responsibilities":["..."],"educationRequirement":"..."} . ' +
      'Only include criteria that are genuinely stated. Do not invent technologies. Use concise technology names.',
    user: [
      `Role title: ${input.title ?? 'unknown'}`,
      `Technologies already detected by keyword matching: ${input.knownSkills.join(', ') || 'none'}`,
      asDocument('job-advert', input.jobText),
    ].join('\n\n'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return validateWith(aiRequirementListSchema, parseJsonResponse(result.text), 'Requirement extraction', result.model);
}

export interface RoadmapPromptInput {
  targetRole: string;
  weeklyHours: number;
  horizonWeeks: number;
  existingSkills: string[];
  tasks: { id: string; title: string; description: string; skillLabel?: string }[];
}

export async function aiPersonaliseRoadmap(input: RoadmapPromptInput): Promise<ServiceResult<{ tasks: { id: string; title?: string; description?: string; exercise?: string }[] }>> {
  const result = await callAi({
    json: true,
    maxTokens: 1800,
    system:
      'You rewrite learning-plan tasks so they fit one specific person. Return JSON exactly as ' +
      '{"tasks":[{"id":"<unchanged id>","title":"...","description":"...","exercise":"..."}]}. ' +
      'Keep every id exactly as provided. Do not add or remove tasks. Do not promise a job outcome. ' +
      'Do not reference technologies the person has not listed unless the task explicitly targets them.',
    user: [
      `Target role: ${input.targetRole}`,
      `Availability: ${input.weeklyHours} hours per week over ${input.horizonWeeks} weeks`,
      `Skills the person already has: ${input.existingSkills.join(', ') || 'none recorded'}`,
      `Tasks to rewrite:\n${input.tasks.map((task) => `- id=${task.id} | ${task.title} | skill=${task.skillLabel ?? 'n/a'} | ${task.description}`).join('\n')}`,
    ].join('\n\n'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return validateWith(aiRoadmapPersonalisationSchema, parseJsonResponse(result.text), 'Roadmap personalisation', result.model);
}

export interface ImprovePromptInput {
  text: string;
  kind: 'summary' | 'experience' | 'project';
  targetRole?: string;
  requirementKeywords: string[];
}

export async function aiImproveText(input: ImprovePromptInput): Promise<ServiceResult<{ revised: string; rationale: string }>> {
  const result = await callAi({
    json: true,
    maxTokens: 700,
    system:
      'Rewrite a single CV line so it reads as a concise, factual achievement. Return JSON exactly as ' +
      '{"revised":"...","rationale":"..."}. Rules: never invent a metric, employer, technology or outcome; ' +
      'if the original lacks a measurable result, keep the wording neutral; use past tense action verbs; ' +
      'remove first-person pronouns. The rationale explains the change in one or two sentences.',
    user: [
      `Section: ${input.kind}`,
      input.targetRole ? `Target role: ${input.targetRole}` : '',
      input.requirementKeywords.length ? `Advert keywords that may be relevant: ${input.requirementKeywords.join(', ')}` : '',
      asDocument('cv-line', input.text),
    ]
      .filter(Boolean)
      .join('\n\n'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return validateWith(aiImprovedTextSchema, parseJsonResponse(result.text), 'CV rewrite', result.model);
}

export interface CoverLetterPromptInput {
  applicant: {
    name: string;
    headline: string;
    summary: string;
    experience: string[];
    projects: string[];
    skills: string[];
  };
  job: { title: string; company: string; requirements: string[] };
  motivation: string;
  mentionGap: boolean;
}

export async function aiDraftCoverLetter(input: CoverLetterPromptInput): Promise<ServiceResult<{ body: string }>> {
  const result = await callAi({
    json: true,
    maxTokens: 1200,
    temperature: 0.4,
    system:
      'Write a concise, specific cover letter of 250 to 380 words. Return JSON exactly as {"body":"..."}. ' +
      'Address it to "Dear Hiring Manager". Only use facts present in the applicant data. ' +
      'Never invent employers, qualifications or metrics. Where motivation is missing, leave a single ' +
      'bracketed instruction instead of making something up. End with the applicant name. ' +
      'Do not claim the letter has been sent anywhere.',
    user: [
      `Applicant: ${input.applicant.name} - ${input.applicant.headline}`,
      `Applicant summary: ${input.applicant.summary || 'not recorded'}`,
      `Experience: ${input.applicant.experience.join(' | ') || 'not recorded'}`,
      `Projects: ${input.applicant.projects.join(' | ') || 'not recorded'}`,
      `Recorded skills: ${input.applicant.skills.join(', ') || 'none'}`,
      `Target role: ${input.job.title} at ${input.job.company}`,
      `Advert requirements: ${input.job.requirements.join(', ') || 'not extracted'}`,
      input.mentionGap ? 'Include one sentence about actively closing the biggest identified gap.' : '',
      `Applicant motivation (verbatim, may be empty): ${input.motivation || '(empty - insert a bracketed placeholder)'}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return validateWith(aiCoverLetterSchema, parseJsonResponse(result.text), 'Cover letter generation', result.model);
}

export interface InterviewPromptInput {
  role: string;
  difficulty: string;
  types: string[];
  requirements: string[];
  topics: string[];
  projects: string[];
  count: number;
}

export async function aiGenerateInterviewQuestions(input: InterviewPromptInput): Promise<ServiceResult<AiInterviewQuestions>> {
  const result = await callAi({
    json: true,
    maxTokens: 1600,
    system:
      'Write realistic interview questions. Return JSON exactly as ' +
      '{"questions":[{"question":"...","type":"technical|practical|project|behavioural","difficulty":"foundation|intermediate|advanced","topic":"...","rubricHints":["..."]}]}. ' +
      'rubricHints are the 3 to 5 points a strong answer should cover. Never claim to predict interview outcomes.',
    user: [
      `Role: ${input.role}`,
      `Difficulty: ${input.difficulty}`,
      `Question types required: ${input.types.join(', ')}`,
      `Advert requirements: ${input.requirements.join(', ') || 'none'}`,
      `Candidate topics: ${input.topics.join(', ') || 'none'}`,
      `Candidate projects: ${input.projects.join(', ') || 'none'}`,
      `Produce exactly ${input.count} questions.`,
    ].join('\n\n'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return validateWith(aiInterviewQuestionsSchema, parseJsonResponse(result.text), 'Interview question generation', result.model);
}

export interface ResumeStructurePromptInput {
  resumeText: string;
  detectedSkills: string[];
  detectedSections: string[];
}

export async function aiExtractResumeStructure(input: ResumeStructurePromptInput): Promise<ServiceResult<{
  displayName?: string;
  headline?: string;
  summary?: string;
  email?: string;
  phone?: string;
  location?: string;
  skills: string[];
  strengths?: string[];
}>> {
  const result = await callAi({
    json: true,
    maxTokens: 1200,
    system:
      'Read a CV and return JSON exactly as {"displayName":"...","headline":"...","summary":"...",' +
      '"email":"...","phone":"...","location":"...","skills":["..."],"strengths":["..."]}. ' +
      'Only include values that literally appear in the document. Omit anything you cannot find. ' +
      'Never infer a job title, employer, date or qualification that is not written down.',
    user: [
      `Sections detected by local parsing: ${input.detectedSections.join(', ') || 'none'}`,
      `Technologies detected by local parsing: ${input.detectedSkills.join(', ') || 'none'}`,
      asDocument('cv', input.resumeText),
    ].join('\n\n'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return validateWith(aiResumeExtractionSchema, parseJsonResponse(result.text), 'CV structure extraction', result.model);
}

export function proficiencyFromText(value: string): Proficiency {
  const normalised = value.toLowerCase();
  if (normalised.includes('expert')) return 'expert';
  if (normalised.includes('advanced') || normalised.includes('strong')) return 'advanced';
  if (normalised.includes('beginner') || normalised.includes('basic')) return 'beginner';
  return 'intermediate';
}
