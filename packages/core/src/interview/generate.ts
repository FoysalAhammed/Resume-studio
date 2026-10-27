import type {
  CareerProfile,
  InterviewFeedback,
  InterviewQuestion,
  InterviewQuestionType,
  InterviewSession,
  JobDescription,
} from '../types';
import { countWords, keywordOverlap, makeId, percent, splitSentences, uniqueBy } from '../util/text';
import { resolveSkillLabel } from '../skills/graph';

export type Difficulty = 'foundation' | 'intermediate' | 'advanced';

interface BankEntry {
  difficulty: Difficulty;
  question: string;
  rubricHints: string[];
}

/** Curated question bank for the technologies that appear most often in adverts. */
const BANK: Record<string, BankEntry[]> = {
  react: [
    { difficulty: 'foundation', question: 'What problem does React solve compared with writing plain JavaScript against the DOM?', rubricHints: ['component model', 're-render on state change', 'declarative UI'] },
    { difficulty: 'intermediate', question: 'How would you decide between local component state and lifted or global state in a React app?', rubricHints: ['prop drilling', 'state locality', 'shared state', 'server state'] },
    { difficulty: 'advanced', question: 'How do you avoid unnecessary re-renders in a large React application?', rubricHints: ['memoisation', 'keys', 'component boundaries', 'profiling'] },
  ],
  javascript: [
    { difficulty: 'foundation', question: 'Explain the difference between let, const and var, and when block scope matters.', rubricHints: ['block scope', 'hoisting', 'reassignment', 'temporal dead zone'] },
    { difficulty: 'intermediate', question: 'Walk me through what happens when you call an asynchronous function and why the event loop matters.', rubricHints: ['call stack', 'promise', 'microtask', 'event loop'] },
    { difficulty: 'advanced', question: 'How would you diagnose a memory leak in a long-running browser application?', rubricHints: ['heap snapshot', 'detached DOM', 'timers', 'listeners'] },
  ],
  typescript: [
    { difficulty: 'foundation', question: 'What does TypeScript give you that JavaScript does not, and what does it not protect you from at runtime?', rubricHints: ['static types', 'compile time only', 'no runtime validation'] },
    { difficulty: 'intermediate', question: 'How would you type an API response you do not control?', rubricHints: ['unknown', 'validation', 'boundary', 'schema'] },
  ],
  python: [
    { difficulty: 'foundation', question: 'When would you choose a list, a dictionary or a set in Python?', rubricHints: ['ordering', 'key lookup', 'uniqueness', 'complexity'] },
    { difficulty: 'intermediate', question: 'How do you structure a Python project that reads data, transforms it and writes a report?', rubricHints: ['separation of concerns', 'entry point', 'tests', 'error handling'] },
  ],
  sql: [
    { difficulty: 'foundation', question: 'Explain the difference between an inner join and a left join with an example.', rubricHints: ['matching rows', 'all rows from left', 'nulls'] },
    { difficulty: 'intermediate', question: 'How would you find duplicate records in a table and then remove all but one copy?', rubricHints: ['group by', 'having', 'window function', 'row number'] },
  ],
  postgresql: [
    { difficulty: 'intermediate', question: 'What would you check if a query became slow after the data grew?', rubricHints: ['explain plan', 'index', 'sequential scan', 'selectivity'] },
  ],
  docker: [
    { difficulty: 'foundation', question: 'What problem do containers solve compared with running an app directly on a server?', rubricHints: ['isolation', 'reproducibility', 'dependencies'] },
    { difficulty: 'intermediate', question: 'How would you keep a container image small and fast to build?', rubricHints: ['layer caching', 'multi stage', 'minimal base image', 'gitignore'] },
  ],
  git: [
    { difficulty: 'foundation', question: 'How do you recover a commit you removed by accident?', rubricHints: ['reflog', 'reset', 'cherry-pick'] },
    { difficulty: 'intermediate', question: 'Explain how you would resolve a merge conflict in a shared branch.', rubricHints: ['fetch', 'rebase or merge', 'test after resolution', 'communicate'] },
  ],
  'rest-api': [
    { difficulty: 'foundation', question: 'Which HTTP status codes would you use for success, validation failure and rate limiting?', rubricHints: ['200', '400', '429', '404'] },
    { difficulty: 'intermediate', question: 'How would you version a public API without breaking existing clients?', rubricHints: ['versioning strategy', 'deprecation', 'backwards compatibility'] },
  ],
  'unit-testing': [
    { difficulty: 'foundation', question: 'What makes a test worth keeping?', rubricHints: ['deterministic', 'isolated', 'meaningful failure', 'fast'] },
    { difficulty: 'intermediate', question: 'How do you test code that depends on a network call or the current time?', rubricHints: ['inject dependencies', 'stub or fake', 'clock control'] },
  ],
  accessibility: [
    { difficulty: 'foundation', question: 'How would you make a custom dropdown usable with a keyboard and a screen reader?', rubricHints: ['focus management', 'aria roles', 'escape key', 'labels'] },
  ],
  communication: [
    { difficulty: 'foundation', question: 'Tell me about a time you had to explain something technical to a non-technical person.', rubricHints: ['audience', 'analogy', 'outcome', 'feedback'] },
  ],
  teamwork: [
    { difficulty: 'foundation', question: 'Describe a disagreement in a team project and how it was resolved.', rubricHints: ['situation', 'listened', 'compromise', 'result'] },
  ],
  'problem-solving': [
    { difficulty: 'intermediate', question: 'Walk me through how you approach a problem you have never seen before.', rubricHints: ['clarify', 'break down', 'hypothesis', 'verify'] },
  ],
};

const BEHAVIOURAL_BANK: BankEntry[] = [
  { difficulty: 'foundation', question: 'Tell me about a piece of work you are proud of and why it mattered.', rubricHints: ['situation', 'your action', 'result', 'reflection'] },
  { difficulty: 'intermediate', question: 'Describe a time you received difficult feedback. What did you change?', rubricHints: ['specific feedback', 'response', 'action taken', 'outcome'] },
  { difficulty: 'intermediate', question: 'Tell me about a deadline you were going to miss. What did you do?', rubricHints: ['early escalation', 'prioritisation', 'trade-off', 'result'] },
  { difficulty: 'advanced', question: 'Describe a decision you made with incomplete information. How did you reduce the risk?', rubricHints: ['assumptions', 'reversible step', 'checkpoint', 'outcome'] },
];

const PRACTICAL_BANK: BankEntry[] = [
  { difficulty: 'foundation', question: 'You are given an unfamiliar codebase and a bug report. What are your first three actions?', rubricHints: ['reproduce', 'read the failing path', 'logging or debugger'] },
  { difficulty: 'intermediate', question: 'A feature works locally but fails in production. How do you investigate?', rubricHints: ['environment differences', 'logs', 'config', 'data shape'] },
  { difficulty: 'advanced', question: 'A page loads slowly for a subset of users. How would you find and fix the cause?', rubricHints: ['measure first', 'segment users', 'bottleneck', 'verify improvement'] },
];

function questionFromTemplate(
  label: string,
  type: InterviewQuestionType,
  difficulty: Difficulty,
  source: 'curated-template' | 'job-requirement',
  relatedSkillId?: string,
): InterviewQuestion {
  const variants: Record<InterviewQuestionType, string> = {
    technical: `Explain how you would use ${label} to solve a real task. What does it do well and where does it fall short?`,
    practical: `You are asked to deliver a feature that depends on ${label}. How do you approach it, test it and know it is working?`,
    project: `Which of your projects involved ${label}? Walk me through your part and what you would do differently now.`,
    behavioural: `Tell me about a time ${label} affected how you worked with other people.`,
  };
  const hints: Record<InterviewQuestionType, string[]> = {
    technical: ['core purpose', 'trade-offs', 'concrete example', 'limits'],
    practical: ['clarify requirements', 'plan', 'verification', 'what you would monitor'],
    project: ['your contribution', 'decisions', 'difficulty', 'reflection'],
    behavioural: ['situation', 'action', 'result', 'learning'],
  };
  return {
    id: makeId('q', `${label}:${type}:${difficulty}`),
    type,
    topic: label,
    difficulty,
    question: variants[type],
    origin: source,
    relatedSkillId,
    rubricHints: hints[type],
  };
}

export interface InterviewRequest {
  profile: CareerProfile;
  job?: JobDescription;
  difficulty: Difficulty;
  types: InterviewQuestionType[];
  /** Restrict to a skill label; omit for the full mix. */
  topic?: string;
  count?: number;
}

/**
 * Deterministic question generation from the advert, the profile and a curated
 * bank. The requested question types are allocated a quota so a mixed practice
 * session always covers every type the user asked for.
 */
export function generateInterviewQuestions(request: InterviewRequest): InterviewQuestion[] {
  const { profile, job, difficulty, types } = request;
  const count = Math.max(1, request.count ?? 8);
  const wanted = uniqueBy(types, (type) => type);
  const topicFilter = request.topic && request.topic !== 'all' ? request.topic : undefined;

  const relevantSkills = uniqueBy(
    [
      ...(job?.requirements ?? []).filter((requirement) => requirement.skillId).map((requirement) => ({ label: requirement.label, id: requirement.skillId! })),
      ...profile.skills.filter((skill) => skill.lexiconId).map((skill) => ({ label: skill.name, id: skill.lexiconId! })),
    ],
    (item) => item.id,
  ).filter((item) => !topicFilter || item.label === topicFilter);

  const allowedDifficulty: Difficulty[] = difficulty === 'foundation'
    ? ['foundation']
    : difficulty === 'intermediate'
      ? ['foundation', 'intermediate']
      : ['intermediate', 'advanced'];

  const perType: Record<InterviewQuestionType, InterviewQuestion[]> = {
    technical: [],
    practical: [],
    project: [],
    behavioural: [],
  };

  // 1. Curated bank entries for the skills in play.
  for (const skill of relevantSkills) {
    for (const entry of BANK[skill.id] ?? []) {
      if (!allowedDifficulty.includes(entry.difficulty)) continue;
      perType.technical.push({
        id: makeId('q', `bank:${skill.id}:${entry.question}`),
        type: 'technical',
        topic: skill.label,
        difficulty: entry.difficulty,
        question: entry.question,
        origin: 'curated-template',
        relatedSkillId: skill.id,
        rubricHints: entry.rubricHints,
      });
    }
  }

  // 2. Template questions for skills without a curated entry - or, when the user
  //    picked one topic, an extra practical question so the session is not thin.
  for (const skill of relevantSkills) {
    const hasCurated = Boolean(BANK[skill.id]);
    if (!hasCurated) {
      if (wanted.includes('technical')) perType.technical.push(questionFromTemplate(skill.label, 'technical', difficulty, 'job-requirement', skill.id));
      if (wanted.includes('practical')) perType.practical.push(questionFromTemplate(skill.label, 'practical', difficulty, 'job-requirement', skill.id));
    } else if (topicFilter) {
      if (wanted.includes('practical')) perType.practical.push(questionFromTemplate(skill.label, 'practical', difficulty, 'job-requirement', skill.id));
      if (wanted.includes('project')) perType.project.push(questionFromTemplate(skill.label, 'project', difficulty, 'job-requirement', skill.id));
    }
  }

  // 3. Generic pools. A focused topic session stays on that topic.
  if (!topicFilter) {
    for (const project of profile.projects.slice(0, 2)) {
      perType.project.push({
        id: makeId('q', `project:${project.id}`),
        type: 'project',
        topic: project.name,
        difficulty,
        question: `Walk me through ${project.name}. What was the hardest technical decision you made, and why did you choose that option?`,
        origin: 'curated-template',
        rubricHints: ['what it does', 'your specific role', 'the hard decision', 'what you would change'],
      });
    }

    for (const entry of PRACTICAL_BANK) {
      perType.practical.push({
        id: makeId('q', `practical:${entry.question}`),
        type: 'practical',
        topic: 'Problem solving',
        difficulty: entry.difficulty,
        question: entry.question,
        origin: 'curated-template',
        rubricHints: entry.rubricHints,
      });
    }
    for (const entry of BEHAVIOURAL_BANK) {
      perType.behavioural.push({
        id: makeId('q', `behavioural:${entry.question}`),
        type: 'behavioural',
        topic: 'Ways of working',
        difficulty: entry.difficulty,
        question: entry.question,
        origin: 'curated-template',
        rubricHints: entry.rubricHints,
      });
    }
  }

  // 4. Allocate a quota per requested type, then top up if a pool ran short.
  const activeTypes = (['technical', 'practical', 'project', 'behavioural'] as InterviewQuestionType[]).filter((type) => wanted.includes(type));
  const ordered = activeTypes.length ? activeTypes : (['technical'] as InterviewQuestionType[]);
  const base = Math.floor(count / ordered.length);
  let remainder = count - base * ordered.length;

  const selected: InterviewQuestion[] = [];
  for (const type of ordered) {
    const quota = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    selected.push(...perType[type].slice(0, quota));
  }
  if (selected.length < count) {
    for (const type of ordered) {
      for (const question of perType[type]) {
        if (selected.length >= count) break;
        if (!selected.some((existing) => existing.id === question.id)) selected.push(question);
      }
    }
  }

  return uniqueBy(selected, (question) => question.id).slice(0, count);
}

const STAR_MARKERS = ['situation', 'task', 'action', 'result', 'because', 'so that', 'as a result', 'i decided', 'we decided', 'afterwards'];

/**
 * Heuristic-only feedback: keyword coverage plus structural signals.
 * It is explicitly labelled as heuristic and is not a validated assessment.
 */
export function evaluateAnswer(question: InterviewQuestion, answer: string): InterviewFeedback {
  const text = answer.trim();
  const words = countWords(text);

  const matchedPoints: string[] = [];
  const missingPoints: string[] = [];
  for (const hint of question.rubricHints) {
    const overlap = keywordOverlap(hint, text);
    if (overlap.ratio > 0.2 || text.toLowerCase().includes(hint.toLowerCase())) matchedPoints.push(hint);
    else missingPoints.push(hint);
  }
  const coverageScore = question.rubricHints.length ? percent(matchedPoints.length, question.rubricHints.length) : 0;

  const sentences = splitSentences(text).length;
  let structure = 0;
  if (words >= 40) structure += 40;
  else if (words >= 20) structure += 25;
  else if (words >= 8) structure += 12;
  if (sentences >= 3) structure += 25;
  if (STAR_MARKERS.some((marker) => text.toLowerCase().includes(marker))) structure += 20;
  if (/\b\d+/.test(text)) structure += 15;
  structure = Math.min(100, structure);

  const notes: string[] = [
    'Heuristic feedback: keyword coverage of the rubric hints plus structural signals such as length, sentence count and outcome markers.',
    'This is not a validated assessment and cannot predict an interview outcome.',
  ];
  if (words < 30) notes.push('The answer is very short. A useful answer usually gives a specific situation, what you did and what changed.');
  if (missingPoints.length) notes.push(`Consider covering: ${missingPoints.slice(0, 3).join(', ')}.`);
  if (!/\b\d+/.test(text)) notes.push('No concrete detail (number, timeframe, scale) was detected - specifics are what make an answer memorable.');

  return {
    questionId: question.id,
    coverageScore,
    structureScore: structure,
    heuristicScore: Math.round(coverageScore * 0.6 + structure * 0.4),
    matchedPoints,
    missingPoints,
    notes,
    label: 'heuristic-feedback',
  };
}

export function createInterviewSession(role: string, difficulty: Difficulty, questions: InterviewQuestion[]): InterviewSession {
  return {
    id: makeId('interview', `${role}:${difficulty}:${questions.map((q) => q.id).join('|')}`),
    role,
    difficulty,
    questions,
    answers: [],
    createdAt: new Date().toISOString(),
  };
}

export function recordAnswer(session: InterviewSession, questionId: string, text: string): InterviewSession {
  const question = session.questions.find((item) => item.id === questionId);
  if (!question) return session;
  const feedback = evaluateAnswer(question, text);
  return {
    ...session,
    answers: [...session.answers.filter((answer) => answer.questionId !== questionId), { questionId, text, feedback }],
  };
}

export function availableInterviewTopics(profile: CareerProfile, job?: JobDescription): string[] {
  const labels = [
    ...(job?.requirements ?? []).map((requirement) => requirement.label),
    ...profile.skills.map((skill) => skill.name),
  ];
  return uniqueBy(labels, (label) => label).sort((a, b) => a.localeCompare(b));
}

export function topicExists(label: string): boolean {
  return Boolean(resolveSkillLabel(label));
}
