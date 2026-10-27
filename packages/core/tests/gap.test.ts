import { describe, expect, it } from 'vitest';
import { analyseSkillGaps, totalGapHours } from '@careerlens/core';
import { advert, blankProfile, requirement, skill } from './helpers';
import { computeMatch } from '@careerlens/core';

describe('skill gap analysis', () => {
  const profile = blankProfile({
    skills: [skill('React', 'advanced'), skill('JavaScript', 'advanced')],
    projects: [{ id: 'p1', name: 'Planner', description: 'A study planner web app.', technologies: ['MongoDB'], outcomes: [], origin: 'user' }],
  });
  const job = advert([requirement('React'), requirement('TypeScript'), requirement('Docker'), requirement('Redis', 'preferred')]);
  const report = computeMatch({ profile, job });
  const gaps = analyseSkillGaps({ profile, job, report });

  it('excludes requirements that are already confirmed', () => {
    expect(gaps.some((gap) => gap.label === 'React')).toBe(false);
    expect(gaps.some((gap) => gap.label === 'Docker')).toBe(true);
  });

  it('identifies missing skills and ranks required gaps above preferred ones', () => {
    const docker = gaps.find((gap) => gap.label === 'Docker');
    const redis = gaps.find((gap) => gap.label === 'Redis');
    expect(docker?.importance).toBe('high');
    expect(redis?.importance).toBe('medium');
    expect(docker!.priorityScore).toBeGreaterThan(redis!.priorityScore);
  });

  it('carries the existing evidence into each gap', () => {
    const typescript = gaps.find((gap) => gap.label === 'TypeScript');
    expect(typescript?.matchValue).toBeGreaterThan(0);
    expect(typescript?.existingEvidence.join(' ')).toContain('related');
  });

  it('provides effort, a practice task and resource links', () => {
    const docker = gaps.find((gap) => gap.label === 'Docker');
    expect(docker?.estimatedHours).toBeGreaterThan(0);
    expect(docker?.suggestedTask).toContain('Docker');
    expect(docker?.targetProficiency).toBe('intermediate');
    expect(docker?.priorityBasis).toBe('internal-recommendation');
    expect(docker?.resources.some((resource) => resource.url.startsWith('https://'))).toBe(true);
  });

  it('labels prioritisation as an internal recommendation, not market data', () => {
    expect(gaps.every((gap) => gap.priorityBasis === 'internal-recommendation')).toBe(true);
  });

  it('shortens the estimate when partial evidence exists', () => {
    const partialGap = gaps.find((gap) => gap.label === 'TypeScript');
    const missingGap = gaps.find((gap) => gap.label === 'Docker');
    // TypeScript has partial credit, so it costs less than its 40 hour baseline.
    expect(partialGap!.estimatedHours).toBeLessThan(40);
    // Docker has no evidence at all, so it keeps its full baseline.
    expect(missingGap!.estimatedHours).toBe(30);
  });

  it('returns no gaps when everything is confirmed', () => {
    const strong = blankProfile({ skills: [skill('React', 'expert')] });
    const simpleJob = advert([requirement('React')]);
    expect(analyseSkillGaps({ profile: strong, job: simpleJob, report: computeMatch({ profile: strong, job: simpleJob }) })).toEqual([]);
  });

  it('totals the estimated effort', () => {
    expect(totalGapHours(gaps)).toBeGreaterThan(0);
  });
});
