import { describe, expect, it } from 'vitest';
import {
  analyseResumeText,
  buildProfilePatch,
  detectFileKind,
  emptyProfile,
  extensionOf,
  kindForExtension,
  LIMITS,
  mergePatchIntoProfile,
  SAMPLE_RESUME_TEXT,
  validateResumeFile,
} from '@careerlens/core';

const meta = { fileName: 'cv.txt', fileType: 'text/plain', fileSizeBytes: 1000 };

describe('resume file validation', () => {
  it('accepts supported formats within the size limit', () => {
    const result = validateResumeFile({ name: 'cv.pdf', size: 200_000, type: 'application/pdf' });
    expect(result.ok).toBe(true);
    expect(result.kind).toBe('pdf');
  });

  it('rejects unsupported extensions', () => {
    const result = validateResumeFile({ name: 'cv.pages', size: 1000 });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('Unsupported file type');
  });

  it('rejects executable and archive extensions', () => {
    expect(validateResumeFile({ name: 'cv.pdf.exe', size: 1000 }).ok).toBe(false);
    expect(validateResumeFile({ name: 'cv.zip', size: 1000 }).errors.join(' ')).toMatch(/executable|Unsupported/);
  });

  it('rejects empty and oversized files', () => {
    expect(validateResumeFile({ name: 'cv.pdf', size: 0 }).errors.join(' ')).toContain('empty');
    expect(validateResumeFile({ name: 'cv.pdf', size: LIMITS.maxUploadBytes + 1 }).errors.join(' ')).toContain('limit');
  });

  it('warns rather than fails on an unexpected MIME type', () => {
    const result = validateResumeFile({ name: 'cv.docx', size: 5000, type: 'application/octet-stream' });
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('reads the file signature rather than trusting the extension', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]);
    const text = new TextEncoder().encode('Ayesha Rahman, software engineer.');
    expect(detectFileKind(pdf)).toBe('pdf');
    expect(detectFileKind(docx)).toBe('docx');
    expect(detectFileKind(text)).toBe('text');
    // A PDF renamed to .docx is detected from the bytes.
    expect(detectFileKind(pdf, 'docx')).toBe('pdf');
  });

  it('maps extensions to kinds', () => {
    expect(extensionOf('My CV.PDF')).toBe('.pdf');
    expect(kindForExtension('.docx')).toBe('docx');
    expect(kindForExtension('.txt')).toBe('text');
    expect(kindForExtension('.exe')).toBe('unknown');
  });
});

describe('resume text analysis', () => {
  const analysis = analyseResumeText(SAMPLE_RESUME_TEXT, meta);

  it('detects the standard sections', () => {
    expect(analysis.sectionsDetected).toContain('Skills');
    expect(analysis.sectionsDetected).toContain('Experience');
    expect(analysis.sectionsDetected).toContain('Education');
    expect(analysis.sectionsDetected).toContain('Projects');
  });

  it('extracts contact details and marks them as found', () => {
    expect(analysis.profile.email?.value).toBe('ayesha.rahman@example.edu');
    expect(analysis.profile.email?.confidence).toBe('found');
    expect(analysis.profile.phone?.value).toBeTruthy();
  });

  it('detects skills with their categories', () => {
    const labels = analysis.skills.map((skill) => skill.label);
    expect(labels).toContain('React');
    expect(labels).toContain('TypeScript');
    expect(analysis.skills.find((skill) => skill.label === 'React')?.category).toBe('Frontend');
    expect(analysis.skills.every((skill) => skill.detectedVia === 'found' || skill.detectedVia === 'inferred')).toBe(true);
  });

  it('parses experience entries with dates and achievements', () => {
    expect(analysis.experience.length).toBeGreaterThanOrEqual(2);
    const first = analysis.experience[0];
    expect(first.title).toContain('Junior Frontend Developer');
    expect(first.company).toContain('Northwind');
    expect(first.achievements.length).toBeGreaterThan(0);
  });

  it('parses education and projects', () => {
    expect(analysis.education.length).toBeGreaterThan(0);
    expect(analysis.education[0].institution).toContain('Manchester');
    expect(analysis.projects.length).toBeGreaterThan(0);
  });

  it('scores completeness from real checks', () => {
    expect(analysis.completeness.score).toBeGreaterThan(50);
    expect(analysis.completeness.checks.every((check) => typeof check.passed === 'boolean')).toBe(true);
    expect(analysis.completeness.checks.find((check) => check.label.includes('Quantified'))?.passed).toBe(true);
  });

  it('never claims the upload is retained', () => {
    expect(analysis.retained).toBe(false);
  });

  it('reports the scanned-image limitation instead of pretending to read it', () => {
    const empty = analyseResumeText('', meta);
    expect(empty.warnings.join(' ')).toContain('OCR');
    expect(empty.completeness.score).toBeLessThan(50);
  });

  it('flags unusable text on a nonsense document without inventing content', () => {
    const noise = analyseResumeText('%%% ### 12345 ???'.repeat(30), meta);
    expect(noise.skills).toHaveLength(0);
    expect(noise.missingInformation.length).toBeGreaterThan(0);
    expect(noise.profile.displayName).toBeNull();
  });

  it('is deterministic', () => {
    const again = analyseResumeText(SAMPLE_RESUME_TEXT, meta);
    expect(again.skills).toEqual(analysis.skills);
    expect(again.completeness).toEqual(analysis.completeness);
  });
});

describe('applying a parsed resume to the profile', () => {
  const analysis = analyseResumeText(SAMPLE_RESUME_TEXT, meta);
  const patch = buildProfilePatch(analysis);

  it('lists the fields the user is about to apply', () => {
    expect(patch.fields).toContain('Email');
    expect(patch.fields.join(' ')).toMatch(/skills/);
  });

  it('marks every resume-derived skill with an honest evidence label', () => {
    expect(patch.skills.length).toBeGreaterThan(4);
    expect(patch.skills.every((skill) => skill.evidence[0].source === 'resume-derived')).toBe(true);
    expect(patch.skills.every((skill) => skill.origin === 'user')).toBe(true);
  });

  it('merges without dropping existing profile data', () => {
    const existing = emptyProfile();
    existing.skills = [{ id: 's1', name: 'React', category: 'Frontend', proficiency: 'expert', evidence: [{ source: 'self-reported', detail: 'Self reported as expert' }], origin: 'user', updatedAt: '2026-01-01T00:00:00.000Z' }];
    const merged = mergePatchIntoProfile(existing, patch);
    const react = merged.skills.filter((skill) => skill.name === 'React');
    expect(react).toHaveLength(1);
    expect(react[0].proficiency).toBe('expert');
    expect(react[0].evidence.length).toBeGreaterThan(1);
    expect(merged.experience.length).toBe(patch.experience.length);
  });

  it('produces a valid profile that the matching engine can consume', () => {
    const merged = mergePatchIntoProfile(emptyProfile(), patch);
    expect(merged.email).toBe('ayesha.rahman@example.edu');
    expect(merged.skills.length).toBeGreaterThan(5);
    expect(merged.updatedAt).toBeTruthy();
  });
});
