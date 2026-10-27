import { describe, expect, it } from 'vitest';
import {
  analyseSkillGaps,
  computeMatch,
  computeRoadmapProgress,
  addCustomTask,
  generateRoadmap,
  groupTasksByPhase,
  preserveTaskState,
  removeTask,
  updateTask,
  type LearningRoadmap,
} from '@careerlens/core';
import { advert, blankProfile, requirement, skill } from './helpers';

function buildPlan(): LearningRoadmap {
  const profile = blankProfile({ skills: [skill('React', 'advanced')], weeklyLearningHours: 8 });
  const job = advert([requirement('React'), requirement('Docker'), requirement('PostgreSQL'), requirement('TypeScript', 'preferred')]);
  const report = computeMatch({ profile, job });
  const gaps = analyseSkillGaps({ profile, job, report });
  return generateRoadmap({ targetRole: 'Junior Frontend Engineer', jobId: job.id, profile, gaps, weeklyHours: 8, horizonWeeks: 12 });
}

describe('learning roadmap', () => {
  it('generates a deterministic plan for the same inputs', () => {
    const first = buildPlan();
    const second = buildPlan();
    expect(first.tasks.map((task) => task.id)).toEqual(second.tasks.map((task) => task.id));
    expect(first.tasks.map((task) => task.title)).toEqual(second.tasks.map((task) => task.title));
  });

  it('schedules tasks across the four phases in order', () => {
    const roadmap = buildPlan();
    const phases = groupTasksByPhase(roadmap).map((group) => group.phase);
    expect(phases).toEqual(['Foundation', 'Practice', 'Portfolio', 'Applications']);
  });

  it('always includes application tasks', () => {
    const roadmap = buildPlan();
    expect(roadmap.tasks.some((task) => task.phase === 'Applications')).toBe(true);
  });

  it('links each phase with prerequisites that exist in the plan', () => {
    const roadmap = buildPlan();
    const ids = new Set(roadmap.tasks.map((task) => task.id));
    for (const task of roadmap.tasks) {
      for (const prerequisite of task.prerequisites) {
        expect(ids.has(prerequisite)).toBe(true);
      }
    }
  });

  it('computes progress from real task states only', () => {
    let roadmap = buildPlan();
    expect(computeRoadmapProgress(roadmap).percentComplete).toBe(0);

    const firstTask = roadmap.tasks[0];
    roadmap = updateTask(roadmap, firstTask.id, { status: 'completed' });
    const progress = computeRoadmapProgress(roadmap);

    expect(progress.completed).toBe(1);
    expect(progress.percentComplete).toBe(Math.round((1 / roadmap.tasks.length) * 100));
    expect(progress.estimatedWeeksRemaining).toBeGreaterThanOrEqual(0);
  });

  it('supports completing and reopening a task', () => {
    let roadmap = buildPlan();
    const taskId = roadmap.tasks[0].id;
    roadmap = updateTask(roadmap, taskId, { status: 'completed' });
    expect(roadmap.tasks.find((task) => task.id === taskId)?.status).toBe('completed');
    roadmap = updateTask(roadmap, taskId, { status: 'in-progress' });
    expect(roadmap.tasks.find((task) => task.id === taskId)?.status).toBe('in-progress');
  });

  it('counts half the hours of an in-progress task toward effort completed', () => {
    let roadmap = buildPlan();
    const taskId = roadmap.tasks[0].id;
    const hours = roadmap.tasks[0].estimatedHours;
    roadmap = updateTask(roadmap, taskId, { status: 'in-progress' });
    const progress = computeRoadmapProgress(roadmap);
    expect(progress.completedHours).toBeCloseTo(hours / 2, 1);
    expect(progress.percentComplete).toBe(0);
  });

  it('keeps progress when the plan is recalculated', () => {
    let roadmap = buildPlan();
    const taskId = roadmap.tasks[0].id;
    roadmap = updateTask(roadmap, taskId, { status: 'completed' });
    const recalculated = buildPlan();
    const merged = preserveTaskState(roadmap, recalculated);
    expect(merged.tasks.find((task) => task.id === taskId)?.status).toBe('completed');
    expect(merged.generation.notes.join(' ')).toContain('kept the progress');
  });

  it('adds and removes custom tasks', () => {
    let roadmap = buildPlan();
    const before = roadmap.tasks.length;
    roadmap = addCustomTask(roadmap, { title: 'Write a blog post about Docker', estimatedHours: 3 });
    expect(roadmap.tasks).toHaveLength(before + 1);
    const custom = roadmap.tasks[roadmap.tasks.length - 1];
    expect(custom.custom).toBe(true);
    expect(custom.estimatedHours).toBe(3);

    roadmap = removeTask(roadmap, custom.id);
    expect(roadmap.tasks).toHaveLength(before);
  });

  it('records how the plan was produced', () => {
    const roadmap = buildPlan();
    expect(roadmap.generation.method).toBe('deterministic-template');
    expect(roadmap.generation.notes.join(' ')).toMatch(/Deterministic template plan/);
  });

  it('respects a weekly-hour budget and explains what was dropped', () => {
    const profile = blankProfile();
    const job = advert([requirement('Docker'), requirement('Kubernetes'), requirement('Terraform')]);
    const gaps = analyseSkillGaps({ profile, job, report: computeMatch({ profile, job }) });
    const roadmap = generateRoadmap({
      targetRole: 'Platform Engineer',
      profile,
      gaps,
      weeklyHours: 2,
      horizonWeeks: 4,
      maxGaps: 3,
    });

    // Only one gap group fits the budget, so the other two are left out.
    const scheduledSkills = new Set(roadmap.tasks.map((task) => task.skillLabel).filter(Boolean));
    expect(scheduledSkills.size).toBe(1);
    expect(roadmap.generation.notes.join(' ')).toMatch(/exceed the 4 week \/ 2h budget/);
    // The application tasks are always present, even when the plan overruns.
    expect(roadmap.tasks.some((task) => task.phase === 'Applications')).toBe(true);
  });

  it('applies AI personalisation without changing task ids', () => {
    const profile = blankProfile();
    const job = advert([requirement('Docker')]);
    const gaps = analyseSkillGaps({ profile, job, report: computeMatch({ profile, job }) });
    const roadmap = generateRoadmap({ targetRole: 'DevOps Engineer', profile, gaps, weeklyHours: 6, horizonWeeks: 8 });
    const target = roadmap.tasks[0];
    const personalised = generateRoadmap({
      targetRole: 'DevOps Engineer',
      profile,
      gaps,
      weeklyHours: 6,
      horizonWeeks: 8,
      personalised: { [target.id]: { title: 'Containerise the class project' } },
    });
    expect(personalised.tasks[0].id).toBe(target.id);
    expect(personalised.tasks[0].title).toBe('Containerise the class project');
    expect(personalised.generation.method).toBe('ai-personalised');
  });
});
