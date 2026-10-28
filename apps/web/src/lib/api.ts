import type { ApiHealth, ImprovementSuggestion, InterviewFeedback, InterviewQuestion, JobDescription, MatchReport, ResumeAnalysis, SkillGap, DraftDocument, ProfilePatch } from '@careerlens/core';

/**
 * Client for the CareerLens API. Calls return a result object instead of
 * throwing, so the app keeps working when the server is down. Requests go to
 * same-origin /api/..., proxied by Vite, so no credentials sit in the browser.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

async function request<T>(path: string, init?: RequestInit, timeoutMs = 45000): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const message = (payload as { error?: { message?: string } } | null)?.error?.message;
      return { ok: false, error: message ?? `The API returned HTTP ${response.status}.`, status: response.status };
    }
    return { ok: true, data: payload as T };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      error: aborted ? 'The API request timed out.' : 'The API server could not be reached.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request<ApiHealth>('/api/health', { method: 'GET' }, 8000),

  matchConfig: () =>
    request<{
      engineVersion: string;
      weights: { required: number; preferred: number };
      statusThresholds: { confirmed: number; partial: number };
      grades: { min: number; label: string }[];
      note: string;
    }>('/api/meta/match-config', { method: 'GET' }, 8000),

  // Uploads the raw file body; the file name goes in a header.
  parseResumeFile: (file: File, useAi: boolean) =>
    request<ResumeApiPayload>(
      '/api/resumes/parse',
      {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': file.name,
          'X-Use-Ai': String(useAi),
        },
        body: file,
      },
      60000,
    ),

  parseResumeText: (fileName: string, text: string, useAi: boolean) =>
    request<ResumeApiPayload>(
      '/api/resumes/parse',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Use-Ai': String(useAi) },
        body: JSON.stringify({ fileName, text }),
      },
      60000,
    ),

  analyzeJob: (payload: {
    title?: string;
    company?: string;
    location?: string;
    experienceLevel?: string;
    sourceUrl?: string;
    rawText: string;
    useAi?: boolean;
  }) =>
    request<{ job: JobDescription; source: string; ai: { used: boolean; reason?: string } }>(
      '/api/jobs/analyze',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      60000,
    ),

  analyzeMatch: (profile: unknown, job: JobDescription) =>
    request<{ report: MatchReport; gaps: SkillGap[]; summary: { coverageNote: string; totalGapHours: number } }>(
      '/api/matches/analyze',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, job }) },
      30000,
    ),

  improve: (payload: { profile: unknown; text: string; kind: 'summary' | 'experience' | 'project'; job?: JobDescription; useAi: boolean }) =>
    request<{ suggestion: ImprovementSuggestion; source: 'local' | 'ai'; ai: { used: boolean; reason?: string } }>(
      '/api/resume-studio/improve',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      60000,
    ),

  coverLetter: (payload: { profile: unknown; job: JobDescription; motivation: string; addressGap?: boolean; useAi: boolean }) =>
    request<{ draft: DraftDocument; checklist: string[]; source: 'local' | 'ai'; ai: { used: boolean; reason?: string } }>(
      '/api/cover-letter/generate',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      60000,
    ),

  generateInterview: (payload: { profile: unknown; job?: JobDescription; difficulty: string; types: string[]; topic?: string; count: number; useAi: boolean }) =>
    request<{
      questions: InterviewQuestion[];
      source: 'local' | 'ai';
      ai: { used: boolean; reason?: string };
      feedbackNotice: string;
    }>('/api/interviews/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 60000),

  evaluateInterview: (question: InterviewQuestion, answer: string) =>
    request<{ feedback: InterviewFeedback; notice: string }>(
      '/api/interviews/evaluate',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, answer }) },
      30000,
    ),

  // Extension preview only: just a skill subset leaves the page.
  extensionAnalyze: (payload: {
    jobText: string;
    jobTitle?: string;
    company?: string;
    skills: { name: string; proficiency: string; lexiconId?: string }[];
  }) =>
    request<{
      score: number;
      grade: string;
      engineVersion: string;
      counts: { total: number; confirmed: number; partial: number; missing: number; requiredTotal: number; requiredSatisfied: number };
      matched: { label: string; status: string }[];
      partial: { label: string; status: string }[];
      missing: { label: string; status: string }[];
      topReasons: { label: string; explanation: string }[];
      disclaimer: string;
      notice: string;
    }>('/api/extension/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 30000),
};

export interface ResumeApiPayload {
  analysis: ResumeAnalysis;
  patch: ProfilePatch;
  source: 'local' | 'ai';
  ai: { used: boolean; reason?: string };
  retained: boolean;
  notice: string;
}
