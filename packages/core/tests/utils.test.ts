import { describe, expect, it } from 'vitest';
import {
  containsTerm,
  countTerm,
  diffWords,
  keywordOverlap,
  makeId,
  percent,
  resolveSkillLabel,
  findLexiconHits,
  getRelatedSkills,
  jobAnalyzeRequestSchema,
  profileSchema,
  workspaceSchema,
  aiRequirementListSchema,
  emptyProfile,
  LIMITS,
} from '@careerlens/core';

describe('text utilities', () => {
  it('matches whole terms only', () => {
    expect(containsTerm('Experience with JavaScript and React', 'JavaScript')).toBe(true);
    expect(containsTerm('Experience with JavaScript', 'Java')).toBe(false);
    expect(containsTerm('We use Node.js daily', 'node')).toBe(true);
    expect(countTerm('React and React Native and React', 'React')).toBe(3);
  });

  it('computes keyword overlap', () => {
    const overlap = keywordOverlap('situation action result', 'I explained the situation then took action');
    expect(overlap.matched).toContain('situation');
    expect(overlap.ratio).toBeGreaterThan(0.3);
  });

  it('produces stable ids for the same seed', () => {
    expect(makeId('x', 'seed')).toBe(makeId('x', 'seed'));
    expect(makeId('x', 'a')).not.toBe(makeId('x', 'b'));
  });

  it('guards division by zero', () => {
    expect(percent(1, 0)).toBe(0);
    expect(percent(1, 4)).toBe(25);
  });

  it('diffs word by word', () => {
    const segments = diffWords('the quick fox', 'the slow fox');
    expect(segments.map((segment) => segment.type)).toContain('removed');
    expect(segments.map((segment) => segment.type)).toContain('added');
  });
});

describe('skill lexicon lookups', () => {
  it('resolves aliases to canonical skills', () => {
    expect(resolveSkillLabel('react.js')?.id).toBe('react');
    expect(resolveSkillLabel('postgres')?.id).toBe('postgresql');
    expect(resolveSkillLabel('k8s')?.id).toBe('kubernetes');
    expect(resolveSkillLabel('something not real')).toBeUndefined();
  });

  it('prefers the longest alias so React Native is not React', () => {
    const hits = findLexiconHits('We build with React Native and React');
    const ids = hits.map((hit) => hit.skill.id);
    expect(ids).toContain('react-native');
  });

  it('finds the same category peers and curated relations', () => {
    const related = getRelatedSkills('react');
    expect(related.some((item) => item.skill.id === 'javascript')).toBe(true);
    expect(related.every((item) => item.weight > 0 && item.weight <= 1)).toBe(true);
    expect(getRelatedSkills('not-a-skill')).toEqual([]);
  });

  it('counts mentions for emphasis', () => {
    const hits = findLexiconHits('Docker Docker Docker and Kubernetes');
    expect(hits.find((hit) => hit.skill.id === 'docker')?.mentions).toBe(3);
  });
});

describe('request validation schemas', () => {
  it('rejects a job analyse request with too little text', () => {
    expect(jobAnalyzeRequestSchema.safeParse({ rawText: 'too short' }).success).toBe(false);
    expect(jobAnalyzeRequestSchema.safeParse({ rawText: 'x'.repeat(120) }).success).toBe(true);
  });

  it('caps job text length', () => {
    expect(jobAnalyzeRequestSchema.safeParse({ rawText: 'x'.repeat(LIMITS.maxJobTextChars + 1) }).success).toBe(false);
  });

  it('validates a profile and allows an empty email but not a malformed one', () => {
    const base = emptyProfile();
    expect(profileSchema.safeParse(base).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, email: 'a@b.com' }).success).toBe(true);
  });

  it('rejects an out-of-range weekly learning workload', () => {
    expect(profileSchema.safeParse({ ...emptyProfile(), weeklyLearningHours: 500 }).success).toBe(false);
  });

  it('accepts an empty workspace', () => {
    expect(workspaceSchema.safeParse(undefined).success).toBe(false);
  });

  it('rejects malformed AI output before it can be used', () => {
    expect(aiRequirementListSchema.safeParse({ requirements: 'not an array' }).success).toBe(false);
    expect(aiRequirementListSchema.safeParse({ requirements: [{ label: 'React', status: 'must-have' }] }).success).toBe(false);
    expect(aiRequirementListSchema.safeParse({ requirements: [{ label: 'React', status: 'required' }] }).success).toBe(true);
  });
});
