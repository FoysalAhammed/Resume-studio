import { describe, expect, it } from 'vitest';
import {
  analyseResumeText,
  buildProfilePatch,
  createInterviewSession,
  createJobDescription,
  emptyProfile,
  evaluateAnswer,
  generateInterviewQuestions,
  mergePatchIntoProfile,
  recordAnswer,
  SAMPLE_JOB_ONE,
  SAMPLE_RESUME_TEXT,
  type InterviewRequest,
} from '@careerlens/core';

const analysis = analyseResumeText(SAMPLE_RESUME_TEXT, { fileName: 'cv.txt', fileType: 'text/plain', fileSizeBytes: 1000 });
const profile = mergePatchIntoProfile(emptyProfile(), buildProfilePatch(analysis));
const job = createJobDescription({ title: 'Junior Frontend Engineer', company: 'Northwind Labs', rawText: SAMPLE_JOB_ONE });

const request: InterviewRequest = { profile, job, difficulty: 'intermediate', types: ['technical', 'practical', 'project', 'behavioural'], count: 8 };

describe('interview preparation', () => {
  it('generates the requested number of questions deterministically', () => {
    const questions = generateInterviewQuestions(request);
    expect(questions).toHaveLength(8);
    expect(generateInterviewQuestions(request).map((question) => question.id)).toEqual(questions.map((question) => question.id));
  });

  it('covers the requested question types', () => {
    const types = new Set(generateInterviewQuestions({ ...request, count: 12 }).map((question) => question.type));
    expect(types.has('technical')).toBe(true);
    expect(types.has('behavioural')).toBe(true);
  });

  it('draws from the candidate\u2019s own projects', () => {
    const questions = generateInterviewQuestions({ ...request, types: ['project'] });
    expect(questions.some((question) => question.type === 'project')).toBe(true);
    expect(questions.some((question) => question.question.includes('StudyBuddy') || question.question.includes('CampusRoute'))).toBe(true);
  });

  it('filters by topic when one is chosen', () => {
    const questions = generateInterviewQuestions({ ...request, topic: 'TypeScript', types: ['technical', 'practical'] });
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((question) => question.topic === 'TypeScript')).toBe(true);
  });

  it('always attaches rubric hints to a question', () => {
    expect(generateInterviewQuestions(request).every((question) => question.rubricHints.length >= 1)).toBe(true);
  });

  it('scores a structured answer above a bare one, and labels the result as heuristic', () => {
    const question = generateInterviewQuestions({ ...request, count: 1 })[0];
    const strong = evaluateAnswer(
      question,
      'In my last project I had to decide between local state and a shared store. The situation was that three screens needed the same data, so I lifted the state to a context provider. As a result the number of re-renders dropped and the code became easier to test.',
    );
    const weak = evaluateAnswer(question, 'I would just use state.');

    expect(strong.heuristicScore).toBeGreaterThan(weak.heuristicScore);
    expect(strong.structureScore).toBeGreaterThan(weak.structureScore);
    expect(strong.label).toBe('heuristic-feedback');
    expect(strong.notes.join(' ')).toContain('not a validated assessment');
  });

  it('tells the candidate what to cover rather than judging them', () => {
    const question = generateInterviewQuestions({ ...request, count: 1 })[0];
    const feedback = evaluateAnswer(question, 'Short answer.');
    expect(feedback.notes.join(' ')).toMatch(/very short|Consider covering/);
  });

  it('records answers in a session', () => {
    const questions = generateInterviewQuestions({ ...request, count: 3 });
    let session = createInterviewSession(job.title, 'intermediate', questions);
    session = recordAnswer(session, questions[0].id, 'A detailed answer with 3 concrete steps and a result.');
    session = recordAnswer(session, questions[0].id, 'A revised answer.');
    expect(session.answers).toHaveLength(1);
    expect(session.answers[0].text).toBe('A revised answer.');
  });

  it('ignores an answer for a question that is not in the session', () => {
    const session = createInterviewSession('Role', 'foundation', []);
    expect(recordAnswer(session, 'missing', 'text').answers).toHaveLength(0);
  });
});
