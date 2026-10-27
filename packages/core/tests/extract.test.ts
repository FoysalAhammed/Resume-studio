import { describe, expect, it } from 'vitest';
import { createJobDescription, extractJobRequirements, splitIntoSections, SAMPLE_JOB_ONE, SAMPLE_JOB_TWO } from '@careerlens/core';

describe('job description extraction', () => {
  it('splits an advert into labelled sections', () => {
    const sections = splitIntoSections(SAMPLE_JOB_ONE);
    expect(sections.some((section) => section.id === 'required')).toBe(true);
    expect(sections.some((section) => section.id === 'preferred')).toBe(true);
    expect(sections.some((section) => section.id === 'about')).toBe(true);
  });

  it('extracts required and preferred requirements separately', () => {
    const result = extractJobRequirements(SAMPLE_JOB_ONE);
    const react = result.requirements.find((requirement) => requirement.skillId === 'react');
    const nextjs = result.requirements.find((requirement) => requirement.skillId === 'nextjs');

    expect(react?.status).toBe('required');
    expect(nextjs?.status).toBe('preferred');
    expect(result.requirements.every((requirement) => requirement.weight > 0)).toBe(true);
    expect(result.requirements.every((requirement) => requirement.emphasis >= 1)).toBe(true);
  });

  it('detects experience and education requirements as text, not guesses', () => {
    const result = extractJobRequirements(SAMPLE_JOB_TWO);
    expect(result.experienceRequirement?.minYears).toBe(3);
    expect(result.educationRequirement.length).toBeGreaterThan(0);
  });

  it('captures responsibilities separately from requirements', () => {
    const result = extractJobRequirements(SAMPLE_JOB_TWO);
    expect(result.responsibilities.length).toBeGreaterThan(0);
    expect(result.responsibilities.join(' ')).toContain('PostgreSQL');
  });

  it('keeps a requirement required when it appears in both lists', () => {
    const text = `Requirements\n- Experience with Docker.\n\nNice to have\n- Docker experience in production.`;
    const result = extractJobRequirements(text);
    const docker = result.requirements.find((requirement) => requirement.skillId === 'docker');
    expect(docker?.status).toBe('required');
    expect(result.requirements.filter((requirement) => requirement.skillId === 'docker')).toHaveLength(1);
  });

  it('does not match a technology inside a longer word', () => {
    const result = extractJobRequirements('Requirements\n- Strong Java skills required.');
    const ids = result.requirements.map((requirement) => requirement.skillId);
    expect(ids).toContain('java');
    expect(ids).not.toContain('javascript');
  });

  it('reports clearly when nothing recognisable was extracted', () => {
    const result = extractJobRequirements('We are a friendly team that values curiosity and kindness.');
    expect(result.requirements).toHaveLength(0);
    expect(result.notes.join(' ')).toContain('No recognisable technology keywords');
  });

  it('produces a job description with an honest extraction record', () => {
    const job = createJobDescription({ title: 'Junior Frontend Engineer', company: 'Acme', rawText: SAMPLE_JOB_ONE });
    expect(job.extraction.method).toBe('rule-based');
    expect(job.extraction.notes.length).toBeGreaterThan(0);
    expect(job.title).toBe('Junior Frontend Engineer');
    expect(job.requirements.length).toBeGreaterThan(4);
  });

  it('is deterministic', () => {
    const first = extractJobRequirements(SAMPLE_JOB_ONE);
    const second = extractJobRequirements(SAMPLE_JOB_ONE);
    expect(first.requirements).toEqual(second.requirements);
  });
});
