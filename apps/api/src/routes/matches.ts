import { Router } from 'express';
import { z } from 'zod';
import { analyseSkillGaps, computeMatch, matchRequestSchema, profileCoverageNote, totalGapHours } from '@careerlens/core';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

export const matchesRouter = Router();

type MatchBody = z.infer<typeof matchRequestSchema>;

matchesRouter.post(
  '/analyze',
  rateLimit({ name: 'match', windowMs: 60_000, max: 60 }),
  validateBody(matchRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as MatchBody;
    const report = computeMatch({ profile: body.profile, job: body.job });
    const gaps = analyseSkillGaps({ profile: body.profile, job: body.job, report });

    res.json({
      report,
      gaps,
      summary: {
        coverageNote: profileCoverageNote(body.profile),
        totalGapHours: totalGapHours(gaps),
        highestPriority: gaps.slice(0, 3).map((gap) => gap.label),
      },
      source: 'local',
    });
  }),
);
