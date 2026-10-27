import { Router } from 'express';
import { z } from 'zod';
import {
  createJobDescription,
  jobAnalyzeRequestSchema,
  MATCH_CONFIG,
  resolveSkillLabel,
  titleCase,
  type JobRequirement,
} from '@careerlens/core';
import { aiRefineRequirements } from '../ai/services';
import { aiAvailable } from '../ai/provider';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

export const jobsRouter = Router();

type AnalyzeBody = z.infer<typeof jobAnalyzeRequestSchema>;

/**
 * Merges AI-extracted requirements into the rule-based ones.
 * The user's advert text remains the source of truth: AI can add or recategorise
 * criteria but never introduces a technology that is not in the text.
 */
function mergeAiRequirements(local: JobRequirement[], aiLabels: { label: string; status: 'required' | 'preferred'; learnHours?: number }[]): JobRequirement[] {
  const byKey = new Map<string, JobRequirement>();
  for (const requirement of local) {
    byKey.set((requirement.skillId ?? requirement.label).toLowerCase(), requirement);
  }

  for (const entry of aiLabels) {
    const resolved = resolveSkillLabel(entry.label);
    const key = (resolved?.id ?? entry.label).toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        status: entry.status,
        weight: MATCH_CONFIG.weights[entry.status],
        learnHours: existing.learnHours ?? entry.learnHours ?? resolved?.learnHours,
      });
      continue;
    }
    byKey.set(key, {
      id: `req_ai_${key.replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
      skillId: resolved?.id,
      label: resolved?.name ?? titleCase(entry.label.toLowerCase()),
      category: resolved?.category,
      status: entry.status,
      weight: MATCH_CONFIG.weights[entry.status],
      emphasis: MATCH_CONFIG.emphasis.min,
      learnHours: entry.learnHours ?? resolved?.learnHours,
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => (a.status === b.status ? b.weight * b.emphasis - a.weight * a.emphasis : a.status === 'required' ? -1 : 1))
    .slice(0, 60);
}

/** POST /api/jobs/analyze - extract structured requirements from advert text. */
jobsRouter.post(
  '/analyze',
  rateLimit({ name: 'job-analyze', windowMs: 60_000, max: 40 }),
  validateBody(jobAnalyzeRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as AnalyzeBody;
    const job = createJobDescription({
      title: body.title,
      company: body.company,
      location: body.location,
      experienceLevel: body.experienceLevel,
      sourceUrl: body.sourceUrl,
      rawText: body.rawText,
    });

    let ai: { used: boolean; reason?: string; model?: string } = { used: false };

    if (body.useAi) {
      if (!aiAvailable()) {
        ai.reason = 'No AI provider is configured; the deterministic rule-based extraction was used instead.';
      } else {
        const result = await aiRefineRequirements({
          jobText: job.rawText.slice(0, 12000),
          title: job.title,
          knownSkills: job.requirements.map((requirement) => requirement.label),
        });
        if (result.ok) {
          const before = job.requirements.length;
          job.requirements = mergeAiRequirements(job.requirements, result.value.requirements);
          if (result.value.responsibilities?.length) job.responsibilities = result.value.responsibilities.slice(0, 20);
          if (result.value.educationRequirement) job.educationRequirement = result.value.educationRequirement.slice(0, 200);
          job.extraction = {
            method: 'ai',
            notes: [
              `AI-assisted extraction reviewed the advert and produced ${result.value.requirements.length} criteria (${before} were already found by keyword matching).`,
              'The original advert text is unchanged and remains the source of truth - edit the requirement list if anything looks wrong.',
            ],
            extractedAt: new Date().toISOString(),
          };
          ai = { used: true, model: result.model };
        } else {
          ai.reason = result.message;
        }
      }
    }

    res.json({ job, source: job.extraction.method, ai });
  }),
);
