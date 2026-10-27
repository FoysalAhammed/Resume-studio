import { describe, expect, it } from 'vitest';
import { analyseSkillGaps, buildSampleWorkspace, computeMatch, createSampleWorkspace, emptyWorkspace, SAMPLE_CREATED_AT, SAMPLE_JOBS, computeRoadmapProgress } from '@careerlens/core';

describe('sample demonstration workspace', () => {
  const workspace = createSampleWorkspace();

  it('is clearly labelled as demonstration data', () => {
    expect(workspace.origin).toBe('sample');
    expect(workspace.profile.origin).toBe('sample');
    expect(workspace.jobs.every((job) => job.origin === 'sample')).toBe(true);
    expect(workspace.roadmaps.every((roadmap) => roadmap.origin === 'sample')).toBe(true);
    expect(workspace.activity[0].message).toContain('demonstration workspace');
  });

  it('contains a candidate profile built by the real parsing pipeline', () => {
    expect(workspace.profile.displayName).toBe('Ayesha Rahman');
    expect(workspace.profile.skills.length).toBeGreaterThan(5);
    expect(workspace.profile.experience.length).toBeGreaterThan(0);
    expect(workspace.profile.skills.some((skill) => skill.evidence.some((item) => item.source === 'project-supported'))).toBe(true);
  });

  it('ships several adverts with a completed compatibility report for each', () => {
    expect(workspace.jobs).toHaveLength(3);
    expect(workspace.matches).toHaveLength(3);
    expect(workspace.matches.every((report) => report.matches.length > 0)).toBe(true);
    expect(SAMPLE_JOBS).toHaveLength(3);
  });

  it('produces real, reproducible numbers rather than random ones', () => {
    const first = createSampleWorkspace();
    const second = createSampleWorkspace();
    expect(first.matches.map((report) => report.score)).toEqual(second.matches.map((report) => report.score));
    expect(first.roadmaps[0].tasks.map((task) => task.id)).toEqual(second.roadmaps[0].tasks.map((task) => task.id));
    expect(first.updatedAt).toBe(SAMPLE_CREATED_AT);
  });

  it('includes a skill-gap report and a roadmap with visible progress', () => {
    const primary = workspace.jobs[0];
    const report = workspace.matches.find((match) => match.jobId === primary.id)!;
    const gaps = analyseSkillGaps({ profile: workspace.profile, job: primary, report });
    expect(gaps.length).toBeGreaterThan(0);

    const roadmap = workspace.roadmaps[0];
    const progress = computeRoadmapProgress(roadmap);
    expect(progress.total).toBeGreaterThan(4);
    expect(progress.inProgress).toBe(1);
    expect(progress.percentComplete).toBe(0);
  });

  it('includes a cover-letter draft built from the sample profile', () => {
    expect(workspace.drafts).toHaveLength(1);
    expect(workspace.drafts[0].kind).toBe('cover-letter');
    expect(workspace.drafts[0].body).toContain('Ayesha Rahman');
  });

  it('is self-consistent: recomputing the match reproduces the stored score', () => {
    const primary = workspace.jobs[0];
    const stored = workspace.matches.find((match) => match.jobId === primary.id)!;
    const recomputed = computeMatch({ profile: workspace.profile, job: primary });
    expect(recomputed.score).toBe(stored.score);
  });

  it('never appears in an empty workspace', () => {
    const empty = emptyWorkspace();
    expect(empty.origin).toBe('user');
    expect(empty.profile.displayName).toBe('');
    expect(empty.jobs).toHaveLength(0);
    expect(empty.matches).toHaveLength(0);
    expect(empty.roadmaps).toHaveLength(0);
    expect(empty.resumeAnalyses).toHaveLength(0);
    expect(empty.drafts).toHaveLength(0);
    expect(empty.activity).toHaveLength(0);
  });

  it('resetting to empty removes every trace of the sample', () => {
    const loaded = buildSampleWorkspace();
    const reset = emptyWorkspace();
    expect(loaded.workspace.origin).toBe('sample');
    expect(JSON.stringify(reset)).not.toContain('Ayesha');
  });
});
