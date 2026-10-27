import { describe, expect, it } from 'vitest';
import {
  buildStudioSuggestions,
  buildTailoredExperience,
  coverLetterChecklist,
  createJobDescription,
  diffWords,
  draftResumeText,
  generateCoverLetter,
  improveBullet,
  improveSummary,
  SAMPLE_JOB_ONE,
  SAMPLE_RESUME_TEXT,
  analyseResumeText,
  buildProfilePatch,
  mergePatchIntoProfile,
  emptyProfile,
} from '@careerlens/core';

const analysis = analyseResumeText(SAMPLE_RESUME_TEXT, { fileName: 'cv.txt', fileType: 'text/plain', fileSizeBytes: 1000 });
const profile = mergePatchIntoProfile(emptyProfile(), buildProfilePatch(analysis));
const job = createJobDescription({ title: 'Junior Frontend Engineer', company: 'Northwind Labs', rawText: SAMPLE_JOB_ONE });

describe('resume studio rewrites', () => {
  it('replaces passive openers with action verbs', () => {
    const suggestion = improveBullet('worked on the checkout page and fixed layout bugs', 'experience');
    expect(suggestion.revised.startsWith('Delivered')).toBe(true);
    expect(suggestion.rationale).toContain('passive opener');
  });

  it('removes first-person pronouns', () => {
    const suggestion = improveBullet('I was responsible for building my team\u2019s dashboard', 'experience');
    expect(suggestion.revised).not.toMatch(/\bI\b/);
    expect(suggestion.revised.toLowerCase()).toContain('owned');
  });

  it('never invents a metric', () => {
    const suggestion = improveBullet('Built a reporting tool for the finance team', 'experience', { job });
    expect(suggestion.needsUserInput).toBe(true);
    expect(suggestion.revised).not.toMatch(/\d+\s*%/);
    expect(suggestion.promptFor).toContain('verify');
    expect(suggestion.rationale).toContain('never add one you cannot prove');
  });

  it('does not ask for a metric when one is already present', () => {
    const suggestion = improveBullet('Built a reporting tool used by 250 staff', 'experience', { job });
    expect(suggestion.needsUserInput).toBe(false);
  });

  it('highlights advert keyword alignment', () => {
    const suggestion = improveBullet('Built React components with TypeScript for the internal tools', 'experience', { job });
    expect(suggestion.rationale).toContain('Aligns with the advert');
  });

  it('drafts a summary from recorded profile facts only', () => {
    const suggestion = improveSummary(profile, job);
    expect(suggestion.revised).toContain('Junior Frontend Engineer');
    expect(suggestion.rationale).toContain('already recorded');
    expect(suggestion.revised.length).toBeGreaterThan(40);
  });

  it('reorders achievements so advert-relevant bullets come first', () => {
    const tailored = buildTailoredExperience(profile, job);
    expect(tailored.length).toBeGreaterThan(0);
    const first = tailored[0];
    expect(first.bullets).toHaveLength(profile.experience[0].achievements.length);
  });

  it('builds a full set of suggestions for the studio workspace', () => {
    const suggestions = buildStudioSuggestions(profile, job);
    expect(suggestions.some((item) => item.kind === 'summary')).toBe(true);
    expect(suggestions.some((item) => item.kind === 'experience')).toBe(true);
    expect(suggestions.every((item) => item.original.length > 0)).toBe(true);
  });

  it('exports a plain-text resume containing only recorded data', () => {
    const text = draftResumeText(profile, job);
    expect(text).toContain('Ayesha Rahman');
    expect(text).toContain('SKILLS');
    expect(text).toContain('EXPERIENCE');
    expect(text).toContain('EDUCATION');
  });

  it('diffs original against revised text deterministically', () => {
    const segments = diffWords('Built a small app', 'Built and shipped a small app');
    expect(segments.some((segment) => segment.type === 'added')).toBe(true);
    const rebuilt = segments
      .filter((segment) => segment.type !== 'removed')
      .map((segment) => segment.value)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(rebuilt).toBe('Built and shipped a small app');

    const original = segments
      .filter((segment) => segment.type !== 'added')
      .map((segment) => segment.value)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(original).toBe('Built a small app');
  });
});

describe('cover letter generation', () => {
  it('uses only recorded facts and asks for the missing motivation', () => {
    const draft = generateCoverLetter({ profile, job, motivation: '' });
    expect(draft.body).toContain('Ayesha Rahman');
    expect(draft.body).toContain('Junior Frontend Engineer');
    expect(draft.body).toContain('Northwind Labs');
    expect(draft.body).toContain('[Add one or two sentences');
    expect(draft.generated.notes.join(' ')).toContain('placeholder');
    expect(draft.generated.method).toBe('deterministic-template');
  });

  it('includes the user\u2019s own motivation when supplied', () => {
    const draft = generateCoverLetter({ profile, job, motivation: 'I want to work on internal tools at scale.' });
    expect(draft.body).toContain('I want to work on internal tools at scale.');
  });

  it('never invents qualifications or claims to submit anything', () => {
    const draft = generateCoverLetter({ profile, job, motivation: 'Because of the product.' });
    expect(draft.body).not.toMatch(/I am the best|guaranteed|submitted your application/i);
    expect(draft.generated.notes.join(' ')).toContain('no qualification, metric or employer was invented');
    expect(draft.reviewed).toBe(false);
  });

  it('handles an empty profile without producing fake experience', () => {
    const draft = generateCoverLetter({ profile: emptyProfile(), job, motivation: '' });
    expect(draft.body).toContain('My background is summarised in the attached CV.');
    expect(draft.generated.notes.join(' ')).toContain('No experience or education was recorded');
  });

  it('exposes a review checklist', () => {
    expect(coverLetterChecklist().length).toBeGreaterThan(2);
  });
});
