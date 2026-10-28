import { Router } from 'express';
import {
  createJobDescription,
  emptyProfile,
  extensionAnalyzeRequestSchema,
  computeMatch,
  makeId,
  resolveSkillLabel,
} from '@careerlens/core';
import type { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

export const extensionRouter = Router();

type ExtensionBody = z.infer<typeof extensionAnalyzeRequestSchema>;

// A browser extension popup calls this. It takes a small skill subset, not a full
// profile, so the endpoint can't be used to pull a whole workspace.
extensionRouter.post(
  '/analyze',
  rateLimit({ name: 'extension', windowMs: 60_000, max: 60 }),
  validateBody(extensionAnalyzeRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as ExtensionBody;

    const profile = emptyProfile();
    profile.skills = body.skills.map((skill) => {
      const resolved = resolveSkillLabel(skill.name);
      return {
        id: makeId('skill', skill.name),
        name: resolved?.name ?? skill.name,
        category: resolved?.category ?? 'Other',
        lexiconId: resolved?.id ?? skill.lexiconId,
        proficiency: skill.proficiency,
        evidence: [{ source: 'self-reported' as const, detail: 'Sent by the extension from the saved workspace' }],
        origin: 'user' as const,
        updatedAt: new Date().toISOString(),
      };
    });

    const job = createJobDescription({
      title: body.jobTitle,
      company: body.company,
      rawText: body.jobText,
    });

    const report = computeMatch({ profile, job });
    const matched = report.matches.filter((match) => match.matchStatus === 'confirmed');
    const partial = report.matches.filter((match) => match.matchStatus === 'partial');
    const missing = report.matches.filter((match) => match.matchStatus === 'missing' || match.matchStatus === 'insufficient');

    res.json({
      score: report.score,
      grade: report.grade,
      engineVersion: report.engineVersion,
      counts: report.counts,
      matched: matched.map((match) => ({ label: match.label, status: match.matchStatus })),
      partial: partial.map((match) => ({ label: match.label, status: match.matchStatus })),
      missing: missing.map((match) => ({ label: match.label, status: match.matchStatus })),
      topReasons: report.matches.slice(0, 5).map((match) => ({ label: match.label, explanation: match.explanation })),
      disclaimer: report.disclaimer,
      notice: 'Analysis used only the skill list supplied by the extension, not the full career profile.',
    });
  }),
);
