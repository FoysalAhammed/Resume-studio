import { describe, expect, it } from 'vitest';
import { buildProfilePatch, analyseResumeText, emptyProfile, mergePatchIntoProfile, profileCompleteness, SAMPLE_RESUME_TEXT, createSampleWorkspace } from '@careerlens/core';
import { blankProfile, skill } from './helpers';

describe('profile completeness', () => {
  it('scores an empty profile very low and explains what is missing', () => {
    const completeness = profileCompleteness(emptyProfile());
    // A brand new profile already carries a sensible default for weekly hours,
    // so that is the only check satisfied before the user enters anything.
    expect(completeness.score).toBeLessThanOrEqual(10);
    expect(completeness.checks.filter((check) => check.passed).map((check) => check.label)).toEqual(['Learning availability set']);
    expect(completeness.nextActions).toHaveLength(3);
    expect(completeness.nextActions.every((action) => action.length > 10)).toBe(true);
  });

  it('is a checklist of entered data, not an employability verdict', () => {
    const completeness = profileCompleteness(blankProfile({ skills: [skill('React')] }));
    expect(completeness.checks.some((check) => check.label === 'At least 5 skills recorded' && !check.passed)).toBe(true);
    expect(completeness.checks.every((check) => typeof check.hint === 'string' && check.hint.length > 0)).toBe(true);
  });

  it('reaches a high score for the demonstration profile', () => {
    const workspace = createSampleWorkspace();
    const completeness = profileCompleteness(workspace.profile);
    expect(completeness.score).toBeGreaterThanOrEqual(80);
  });

  it('grows as a parsed resume is applied', () => {
    const analysis = analyseResumeText(SAMPLE_RESUME_TEXT, { fileName: 'cv.txt', fileType: 'text/plain', fileSizeBytes: 1000 });
    const merged = mergePatchIntoProfile(emptyProfile(), buildProfilePatch(analysis));
    const before = profileCompleteness(emptyProfile()).score;
    const after = profileCompleteness(merged).score;
    expect(after).toBeGreaterThan(before);
  });
});
