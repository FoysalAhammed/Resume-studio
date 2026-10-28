import express, { Router } from 'express';
import { z } from 'zod';
import { analyseResumeText, buildProfilePatch, resumeTextParseRequestSchema } from '@careerlens/core';
import { aiExtractResumeStructure } from '../ai/services';
import { aiAvailable } from '../ai/provider';
import { extractResumeText, fromPastedText } from '../parsers/resumeFile';
import { AppError } from '../middleware/errors';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { safeHeader } from '../middleware/validate';
import { config } from '../env';

export const resumesRouter = Router();

const rawBody = express.raw({
  type: [
    'application/pdf',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ],
  limit: config.maxUploadBytes,
});
const jsonBody = express.json({ limit: '2mb' });

const textBodySchema = resumeTextParseRequestSchema;

// Accepts a raw file body (file name in the x-file-name header) or JSON { text, fileName }
// for pasted content. Nothing is written to disk or kept after the response.
resumesRouter.post(
  '/parse',
  rateLimit({ name: 'resume-parse', windowMs: 60_000, max: 20 }),
  rawBody,
  jsonBody,
  asyncHandler(async (req, res) => {
    const wantsAi = safeHeader(req, 'x-use-ai', 8) === 'true' || req.query.useAi === 'true';

    let parsed;
    if (Buffer.isBuffer(req.body)) {
      parsed = await extractResumeText(req.body, safeHeader(req, 'x-file-name', 200));
    } else {
      const body = textBodySchema.parse(req.body ?? {}) as z.infer<typeof textBodySchema>;
      parsed = fromPastedText(body.text, body.fileName);
    }

    if (!parsed.text.trim()) {
      throw new AppError(422, 'No readable text was found in the document. Paste the text instead so it can be analysed.', 'no_text_extracted');
    }

    const analysis = analyseResumeText(parsed.text, {
      fileName: parsed.fileName,
      fileType: parsed.kind,
      fileSizeBytes: parsed.bytes,
      origin: 'user',
    });
    analysis.warnings = [...parsed.warnings, ...analysis.warnings];

    let ai: { used: boolean; reason?: string } = { used: false };
    if (wantsAi) {
      if (!aiAvailable()) {
        ai.reason = 'No AI provider is configured, so the deterministic parser was used.';
      } else {
        const result = await aiExtractResumeStructure({
          resumeText: parsed.text.slice(0, 12000),
          detectedSkills: analysis.skills.map((skill) => skill.label),
          detectedSections: analysis.sectionsDetected,
        });
        if (result.ok) {
          ai = { used: true };
          // AI may only add skills the local pass missed; it never overwrites parsed facts.
          const known = new Set(analysis.skills.map((skill) => skill.label.toLowerCase()));
          for (const label of result.value.skills) {
            if (known.has(label.toLowerCase())) continue;
            const extra = analyseResumeText(label, { fileName: 'skill-probe', fileType: 'text/plain', fileSizeBytes: label.length });
            const match = extra.skills[0];
            if (match) {
              known.add(label.toLowerCase());
              analysis.skills.push(match);
            }
          }
          analysis.warnings.push('AI added skills that keyword matching missed. Everything else came from the document.');
        } else {
          ai.reason = result.message;
        }
      }
    }

    res.json({
      analysis,
      patch: buildProfilePatch(analysis),
      source: ai.used ? 'ai' : 'local',
      ai,
      retained: false,
      notice: 'The file is processed in memory and is not stored by the server.',
    });
  }),
);
