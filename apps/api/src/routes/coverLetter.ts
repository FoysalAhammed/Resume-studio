import { Router } from 'express';
import { z } from 'zod';
import { coverLetterChecklist, coverLetterRequestSchema, generateCoverLetter } from '@careerlens/core';
import { aiDraftCoverLetter } from '../ai/services';
import { aiAvailable } from '../ai/provider';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

export const coverLetterRouter = Router();

type CoverLetterBody = z.infer<typeof coverLetterRequestSchema>;

coverLetterRouter.post(
  '/generate',
  rateLimit({ name: 'cover-letter', windowMs: 60_000, max: 20 }),
  validateBody(coverLetterRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CoverLetterBody;
    const draft = generateCoverLetter({
      profile: body.profile,
      job: body.job,
      motivation: body.motivation,
      addressGap: body.addressGap,
    });

    let source: 'local' | 'ai' = 'local';
    let ai: { used: boolean; reason?: string; model?: string } = { used: false };

    if (body.useAi) {
      if (!aiAvailable()) {
        ai.reason = 'No AI provider is configured, so the template letter was used.';
      } else {
        const result = await aiDraftCoverLetter({
          applicant: {
            name: body.profile.displayName,
            headline: body.profile.headline,
            summary: body.profile.summary,
            experience: body.profile.experience.slice(0, 3).map((entry) => `${entry.title} at ${entry.company}`),
            projects: body.profile.projects.slice(0, 3).map((project) => project.name),
            skills: body.profile.skills.slice(0, 15).map((skill) => skill.name),
          },
          job: {
            title: body.job.title,
            company: body.job.company,
            requirements: body.job.requirements.slice(0, 15).map((requirement) => requirement.label),
          },
          motivation: body.motivation,
          mentionGap: Boolean(body.addressGap),
        });
        if (result.ok) {
          draft.body = result.value.body;
          draft.generated = {
            method: 'ai',
            notes: [
              'Drafted by the configured AI provider, constrained to facts already recorded in your profile.',
              'Review every sentence: the model can still phrase something inaccurately.',
            ],
          };
          source = 'ai';
          ai = { used: true, model: result.model };
        } else {
          ai.reason = result.message;
        }
      }
    }

    res.json({ draft, checklist: coverLetterChecklist(), source, ai });
  }),
);
