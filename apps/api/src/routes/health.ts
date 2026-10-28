import { Router } from 'express';
import { healthPayload } from '../env';
import { MATCH_CONFIG } from '@careerlens/core';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json(healthPayload());
});

healthRouter.get('/meta/match-config', (_req, res) => {
  res.json({
    engineVersion: MATCH_CONFIG.version,
    weights: MATCH_CONFIG.weights,
    emphasisRange: MATCH_CONFIG.emphasis,
    statusThresholds: MATCH_CONFIG.statusThresholds,
    grades: MATCH_CONFIG.grades,
    relatedSkillFormula: '0.4 + 0.4 x relation strength',
    multiSourceBonus: { perSource: MATCH_CONFIG.multiSourceBonus, max: MATCH_CONFIG.maxMultiSourceBonus },
    note: 'Scores are reproducible: the same profile and advert always produce the same result for a given engine version.',
  });
});
