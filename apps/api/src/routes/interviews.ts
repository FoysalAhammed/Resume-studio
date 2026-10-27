import { Router } from 'express';
import { z } from 'zod';
import {
  createInterviewSession,
  evaluateAnswer,
  generateInterviewQuestions,
  interviewAnalyzeRequestSchema,
  interviewRequestSchema,
  type InterviewQuestion,
} from '@careerlens/core';
import { aiGenerateInterviewQuestions } from '../ai/services';
import { aiAvailable } from '../ai/provider';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

export const interviewsRouter = Router();

type InterviewBody = z.infer<typeof interviewRequestSchema>;
type AnalyzeBody = z.infer<typeof interviewAnalyzeRequestSchema>;

/** POST /api/interviews/generate */
interviewsRouter.post(
  '/generate',
  rateLimit({ name: 'interview-generate', windowMs: 60_000, max: 20 }),
  validateBody(interviewRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as InterviewBody;
    const difficulty = body.difficulty ?? 'intermediate';
    const questions = generateInterviewQuestions({
      profile: body.profile,
      job: body.job,
      difficulty,
      types: body.types,
      topic: body.topic,
      count: body.count,
    });

    let source: 'local' | 'ai' = 'local';
    let ai: { used: boolean; reason?: string; model?: string } = { used: false };

    if (body.useAi) {
      if (!aiAvailable()) {
        ai.reason = 'No AI provider is configured; curated template questions were used instead.';
      } else {
        const result = await aiGenerateInterviewQuestions({
          role: body.job?.title || body.profile.headline || 'the target role',
          difficulty,
          types: body.types,
          requirements: body.job?.requirements.slice(0, 12).map((requirement) => requirement.label) ?? [],
          topics: body.profile.skills.slice(0, 20).map((skill) => skill.name),
          projects: body.profile.projects.slice(0, 3).map((project) => project.name),
          count: body.count ?? 8,
        });
        if (result.ok) {
          const aiQuestions: InterviewQuestion[] = result.value.questions.map((question, index) => ({
            id: `q_ai_${index + 1}`,
            type: question.type,
            topic: question.topic,
            difficulty: question.difficulty,
            question: question.question,
            origin: 'curated-template',
            rubricHints: question.rubricHints,
          }));
          res.json({
            questions: aiQuestions,
            session: createInterviewSession(body.job?.title || 'Practice session', difficulty, aiQuestions),
            source: 'ai',
            ai: { used: true, model: result.model },
            feedbackNotice: 'Answer feedback is a keyword and structure heuristic, not a validated assessment.',
          });
          return;
        }
        ai.reason = result.message;
      }
    }

    res.json({
      questions,
      session: createInterviewSession(body.job?.title || 'Practice session', difficulty, questions),
      source,
      ai,
      feedbackNotice: 'Answer feedback is a keyword and structure heuristic, not a validated assessment.',
    });
  }),
);

/** POST /api/interviews/evaluate - heuristic feedback on one answer. */
interviewsRouter.post(
  '/evaluate',
  rateLimit({ name: 'interview-evaluate', windowMs: 60_000, max: 60 }),
  validateBody(interviewAnalyzeRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as AnalyzeBody;
    const feedback = evaluateAnswer(body.question, body.answer);
    res.json({
      feedback,
      source: 'local',
      notice: 'Heuristic scoring only. It cannot predict an interview outcome and is not a substitute for a human reviewer.',
    });
  }),
);
