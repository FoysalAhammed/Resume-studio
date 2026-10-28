import { Router } from 'express';
import { z } from 'zod';
import { improveBullet, improveRequestSchema, improveSummary } from '@careerlens/core';
import { aiImproveText } from '../ai/services';
import { aiAvailable } from '../ai/provider';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

export const studioRouter = Router();

type ImproveBody = z.infer<typeof improveRequestSchema>;

studioRouter.post(
  '/improve',
  rateLimit({ name: 'studio', windowMs: 60_000, max: 40 }),
  validateBody(improveRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as ImproveBody;
    const suggestion = body.kind === 'summary'
      ? improveSummary(body.profile, body.job)
      : improveBullet(body.text, body.kind, { job: body.job, profile: body.profile });

    let source: 'local' | 'ai' = 'local';
    let ai: { used: boolean; reason?: string; model?: string } = { used: false };

    if (body.useAi) {
      if (!aiAvailable()) {
        ai.reason = 'No AI provider is configured, so the rewrite templates were used.';
      } else {
        const result = await aiImproveText({
          text: body.text,
          kind: body.kind,
          targetRole: body.job?.title,
          requirementKeywords: body.job?.requirements.map((requirement) => requirement.label).slice(0, 12) ?? [],
        });
        if (result.ok) {
          suggestion.revised = result.value.revised;
          suggestion.rationale = `AI-assisted rewrite. ${result.value.rationale}`;
          source = 'ai';
          ai = { used: true, model: result.model };
        } else {
          ai.reason = result.message;
        }
      }
    }

    res.json({
      suggestion,
      source,
      ai,
      reviewNotice: 'This is a draft. Confirm that every statement is accurate before it goes into a real application.',
    });
  }),
);
