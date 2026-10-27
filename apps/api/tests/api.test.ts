import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildProfilePatch,
  analyseResumeText,
  emptyProfile,
  mergePatchIntoProfile,
  SAMPLE_JOB_ONE,
  SAMPLE_RESUME_TEXT,
} from '@careerlens/core';
import { createApp } from '../src/app';

/**
 * Integration tests against the real Express app over a real socket.
 * No AI provider is configured in the test environment, which is exactly the
 * local-fallback path the application must always support.
 */
let server: Server;
let baseUrl = '';

const analysis = analyseResumeText(SAMPLE_RESUME_TEXT, { fileName: 'cv.txt', fileType: 'text/plain', fileSizeBytes: 1200 });
const profile = mergePatchIntoProfile(emptyProfile(), buildProfilePatch(analysis));

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /api/health', () => {
  it('reports local mode when no AI provider is configured', async () => {
    const { status, json } = await api('/api/health');
    expect(status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.mode).toBe('local');
    expect(json.ai.configured).toBe(false);
    expect(json.ai.model).toBeNull();
    expect(json.matchEngineVersion).toBeTruthy();
    expect(json.limits.maxUploadMb).toBeGreaterThan(0);
  });

  it('never leaks the API key', async () => {
    const { text } = await api('/api/health');
    expect(text).not.toMatch(/AI_API_KEY|Bearer|sk-/);
  });

  it('exposes the matching model weights so results are auditable', async () => {
    const { status, json } = await api('/api/meta/match-config');
    expect(status).toBe(200);
    expect(json.weights.required).toBeGreaterThan(json.weights.preferred);
    expect(json.engineVersion).toBeTruthy();
  });
});

describe('POST /api/resumes/parse', () => {
  it('analyses pasted resume text and offers a reviewable patch', async () => {
    const { status, json } = await api('/api/resumes/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'cv.txt', fileType: 'text/plain', text: SAMPLE_RESUME_TEXT }),
    });
    expect(status).toBe(200);
    expect(json.analysis.skills.length).toBeGreaterThan(3);
    expect(json.analysis.retained).toBe(false);
    expect(json.patch.fields.length).toBeGreaterThan(2);
    expect(json.notice).toContain('not stored');
    expect(json.source).toBe('local');
  });

  it('accepts a raw text upload validated on the server', async () => {
    const { status, json } = await api('/api/resumes/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-File-Name': 'my cv.txt' },
      body: SAMPLE_RESUME_TEXT,
    });
    expect(status).toBe(200);
    expect(json.analysis.profile.email.value).toBe('ayesha.rahman@example.edu');
  });

  it('rejects a body whose signature does not match its extension', async () => {
    const { status, json } = await api('/api/resumes/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'cv.docx' },
      body: Buffer.from('%PDF-1.4 not really a docx'),
    });
    expect(status).toBe(415);
    expect(json.error.code).toBe('signature_mismatch');
  });

  it('rejects an unsupported extension', async () => {
    const { status, json } = await api('/api/resumes/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'cv.exe' },
      body: Buffer.from('MZ binary'),
    });
    expect(status).toBe(415);
    expect(json.error.code).toBe('unsupported_media_type');
  });

  it('rejects pasted text that is too short', async () => {
    const { status } = await api('/api/resumes/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'cv.txt', text: 'hi' }),
    });
    expect(status).toBe(400);
  });
});

describe('POST /api/jobs/analyze', () => {
  it('extracts requirements with the deterministic analyser', async () => {
    const { status, json } = await api('/api/jobs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Junior Frontend Engineer', company: 'Northwind Labs', rawText: SAMPLE_JOB_ONE }),
    });
    expect(status).toBe(200);
    expect(json.job.requirements.length).toBeGreaterThan(4);
    expect(json.source).toBe('rule-based');
    expect(json.job.extraction.notes.length).toBeGreaterThan(0);
  });

  it('falls back to local extraction when AI is requested but unavailable', async () => {
    const { status, json } = await api('/api/jobs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: SAMPLE_JOB_ONE, useAi: true }),
    });
    expect(status).toBe(200);
    expect(json.ai.used).toBe(false);
    expect(json.ai.reason).toContain('No AI provider is configured');
    expect(json.job.requirements.length).toBeGreaterThan(0);
  });

  it('validates the request body', async () => {
    const { status, json } = await api('/api/jobs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: 'short' }),
    });
    expect(status).toBe(400);
    expect(json.error.code).toBe('validation_failed');
  });
});

describe('POST /api/matches/analyze', () => {
  const jobPayload = {
    id: 'job_test',
    title: 'Junior Frontend Engineer',
    company: 'Northwind Labs',
    location: 'Remote',
    experienceLevel: 'entry' as const,
    rawText: SAMPLE_JOB_ONE,
    requirements: [
      { id: 'r1', label: 'React', skillId: 'react', status: 'required' as const, weight: 3, emphasis: 1 },
      { id: 'r2', label: 'Docker', status: 'required' as const, weight: 3, emphasis: 1 },
    ],
    responsibilities: [],
    educationRequirement: 'Not specified',
    experienceRequirement: null,
    extraction: { method: 'rule-based' as const, notes: [], extractedAt: new Date().toISOString() },
    origin: 'user' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('returns a report and the derived gaps', async () => {
    const { status, json } = await api('/api/matches/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, job: jobPayload }),
    });
    expect(status).toBe(200);
    expect(json.report.score).toBeGreaterThan(0);
    expect(json.report.matches).toHaveLength(2);
    expect(json.gaps.some((gap: { label: string }) => gap.label === 'Docker')).toBe(true);
    expect(json.source).toBe('local');
  });

  it('rejects a malformed profile', async () => {
    const { status } = await api('/api/matches/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: { displayName: 'x' }, job: jobPayload }),
    });
    expect(status).toBe(400);
  });
});

describe('writing and interview endpoints', () => {
  it('rewrites a CV line locally and asks for the missing metric', async () => {
    const { status, json } = await api('/api/resume-studio/improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, kind: 'experience', text: 'worked on the checkout page' }),
    });
    expect(status).toBe(200);
    expect(json.suggestion.revised.startsWith('Delivered')).toBe(true);
    expect(json.suggestion.needsUserInput).toBe(true);
    expect(json.source).toBe('local');
  });

  it('generates a cover letter draft and a checklist', async () => {
    const { status, json } = await api('/api/cover-letter/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        job: {
          id: 'j1',
          title: 'Junior Frontend Engineer',
          company: 'Northwind Labs',
          location: 'Remote',
          experienceLevel: 'entry',
          rawText: SAMPLE_JOB_ONE,
          requirements: [],
          responsibilities: [],
          educationRequirement: 'Not specified',
          experienceRequirement: null,
          extraction: { method: 'rule-based', notes: [], extractedAt: new Date().toISOString() },
          origin: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        motivation: 'I enjoy building internal tools.',
        useAi: true,
      }),
    });
    expect(status).toBe(200);
    expect(json.draft.body).toContain('Ayesha Rahman');
    expect(json.checklist.length).toBeGreaterThan(2);
    expect(json.ai.used).toBe(false);
    expect(json.ai.reason).toContain('No AI provider is configured');
  });

  it('generates interview questions and scores an answer heuristically', async () => {
    const generated = await api('/api/interviews/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, difficulty: 'intermediate', types: ['technical', 'behavioural'], count: 5 }),
    });
    expect(generated.status).toBe(200);
    expect(generated.json.questions).toHaveLength(5);
    expect(generated.json.feedbackNotice).toContain('heuristic');

    const evaluated = await api('/api/interviews/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: generated.json.questions[0], answer: 'I would clarify the requirement, then build it and test it with 4 unit tests.' }),
    });
    expect(evaluated.status).toBe(200);
    expect(evaluated.json.feedback.label).toBe('heuristic-feedback');
    expect(evaluated.json.feedback.heuristicScore).toBeGreaterThanOrEqual(0);
  });
});

describe('POST /api/extension/analyze', () => {
  it('analyses a selection using only the supplied skill list', async () => {
    const { status, json } = await api('/api/extension/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobTitle: 'Junior Frontend Engineer',
        jobText: SAMPLE_JOB_ONE,
        skills: [
          { name: 'React', proficiency: 'advanced' },
          { name: 'TypeScript', proficiency: 'intermediate' },
        ],
      }),
    });
    expect(status).toBe(200);
    expect(json.score).toBeGreaterThan(0);
    expect(json.matched.length + json.partial.length + json.missing.length).toBeGreaterThan(3);
    expect(json.notice).toContain('not the full career profile');
    expect(json.disclaimer).toBeTruthy();
  });

  it('rejects a request without skills', async () => {
    const { status } = await api('/api/extension/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobText: SAMPLE_JOB_ONE }),
    });
    expect(status).toBe(400);
  });
});

describe('error handling', () => {
  it('returns a structured 404 without internals', async () => {
    const { status, json } = await api('/api/does-not-exist');
    expect(status).toBe(404);
    expect(json.error.code).toBe('not_found');
    expect(JSON.stringify(json)).not.toMatch(/at Object|node_modules|C:\\/);
  });

  it('never returns a stack trace on a malformed body', async () => {
    const { status, json } = await api('/api/jobs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });
    expect(status).toBe(400);
    expect(json.error.message).toBeTruthy();
    expect(JSON.stringify(json)).not.toContain('at ');
  });
});
