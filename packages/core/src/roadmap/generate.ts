import type {
  CareerProfile,
  LearningRoadmap,
  RoadmapProgress,
  RoadmapTask,
  SkillGap,
  TaskStatus,
} from '../types';
import { PHASE_ORDER, PHASE_SHARE, applicationsTasks, foundationTask, portfolioTask, practiceTask } from './templates';
import { makeId, roundTo } from '../util/text';

export interface RoadmapRequest {
  targetRole: string;
  jobId?: string;
  profile: CareerProfile;
  gaps: SkillGap[];
  /** Only these gaps are scheduled. Defaults to every gap. */
  selectedGapIds?: string[];
  weeklyHours?: number;
  horizonWeeks?: number;
  /** How many distinct gaps to schedule. Defaults to 5. */
  maxGaps?: number;
  /** Optional AI-personalised task text keyed by the deterministic task id. */
  personalised?: Record<string, Partial<Pick<RoadmapTask, 'title' | 'description' | 'exercise'>>>;
}

function taskHours(total: number, share: number): number {
  return Math.max(2, Math.round(total * share));
}

function buildGapTasks(gap: SkillGap, priority: number): RoadmapTask[] {
  const base = Math.max(10, gap.estimatedHours);
  const now = new Date().toISOString();
  const foundationId = makeId('task', `${gap.id}:foundation`);
  const practiceId = makeId('task', `${gap.id}:practice`);
  const portfolioId = makeId('task', `${gap.id}:portfolio`);
  const category = gap.category;

  const foundation = foundationTask(gap.label, category, base);
  const practice = practiceTask(gap.label, category);
  const portfolio = portfolioTask(gap.label);

  return [
    {
      id: foundationId,
      title: foundation.title,
      description: foundation.description,
      skillId: gap.skillId,
      skillLabel: gap.label,
      phase: 'Foundation',
      estimatedHours: taskHours(base, PHASE_SHARE.Foundation),
      priority,
      prerequisites: [],
      exercise: foundation.exercise,
      completionCriteria: foundation.completionCriteria,
      status: 'not-started',
      updatedAt: now,
    },
    {
      id: practiceId,
      title: practice.title,
      description: practice.description,
      skillId: gap.skillId,
      skillLabel: gap.label,
      phase: 'Practice',
      estimatedHours: taskHours(base, PHASE_SHARE.Practice),
      priority,
      prerequisites: [foundationId],
      exercise: practice.exercise,
      completionCriteria: practice.completionCriteria,
      status: 'not-started',
      updatedAt: now,
    },
    {
      id: portfolioId,
      title: portfolio.title,
      description: portfolio.description,
      skillId: gap.skillId,
      skillLabel: gap.label,
      phase: 'Portfolio',
      estimatedHours: taskHours(base, PHASE_SHARE.Portfolio),
      priority,
      prerequisites: [practiceId],
      exercise: portfolio.exercise,
      completionCriteria: portfolio.completionCriteria,
      status: 'not-started',
      updatedAt: now,
    },
  ];
}

/**
 * Deterministic roadmap generation.
 * The same profile, gaps and settings always produce the same plan, which keeps
 * demonstrations reproducible and makes the output testable.
 */
export function generateRoadmap(request: RoadmapRequest): LearningRoadmap {
  const weeklyHours = request.weeklyHours && request.weeklyHours > 0 ? request.weeklyHours : 6;
  const horizonWeeks = request.horizonWeeks && request.horizonWeeks > 0 ? request.horizonWeeks : 12;
  const maxGaps = request.maxGaps ?? 5;
  const capacity = weeklyHours * horizonWeeks;

  const selected = request.selectedGapIds?.length
    ? request.gaps.filter((gap) => request.selectedGapIds!.includes(gap.id))
    : request.gaps;

  const ordered = [...selected].sort((a, b) => b.priorityScore - a.priorityScore || a.label.localeCompare(b.label));
  const notes: string[] = [];

  if (ordered.length === 0) {
    notes.push('No skill gaps were supplied, so this plan only contains application tasks. Add gaps from the Skill Gap Analysis page for a targeted plan.');
  }

  const tasks: RoadmapTask[] = [];
  let usedHours = 0;

  // Application tasks are always included - a plan that never reaches applying is not a plan.
  const applicationBlueprints = applicationsTasks(request.targetRole || 'your target role');
  const applicationTasks: RoadmapTask[] = applicationBlueprints.map((blueprint, i) => ({
    id: makeId('task', `applications:${request.targetRole}:${i}`),
    title: blueprint.title,
    description: blueprint.description,
    phase: 'Applications',
    estimatedHours: i === 0 ? 6 : 5,
    priority: 900 + i,
    prerequisites: [],
    exercise: blueprint.exercise,
    completionCriteria: blueprint.completionCriteria,
    status: 'not-started',
    updatedAt: new Date().toISOString(),
  }));
  const applicationHours = applicationTasks.reduce((sum, task) => sum + task.estimatedHours, 0);

  let scheduled = 0;
  for (const gap of ordered) {
    if (scheduled >= maxGaps) {
      notes.push(`Only the top ${maxGaps} gaps were scheduled. Recalculate the roadmap to focus on different gaps.`);
      break;
    }
    const gapTasks = buildGapTasks(gap, scheduled + 1);
    const gapHours = gapTasks.reduce((sum, task) => sum + task.estimatedHours, 0);
    if (usedHours + gapHours + applicationHours > capacity && scheduled > 0) {
      notes.push(`Stopped after ${scheduled} gaps because the plan would exceed the ${horizonWeeks} week / ${weeklyHours}h budget. Increase your weekly hours or shorten the gap list to cover more.`);
      break;
    }
    tasks.push(...gapTasks);
    usedHours += gapHours;
    scheduled += 1;
  }

  tasks.push(...applicationTasks);

  const personalised = request.personalised ?? {};
  const finalTasks = tasks.map((task) => {
    const override = personalised[task.id];
    return override ? { ...task, ...override } : task;
  });

  const now = new Date().toISOString();
  const totalHours = finalTasks.reduce((sum, task) => sum + task.estimatedHours, 0);

  if (totalHours > capacity) {
    notes.push(
      `Heads up: the minimum viable plan is about ${totalHours} hours, which is more than the ${capacity} hours available at ${weeklyHours}h per week for ${horizonWeeks} weeks. Extend the horizon or increase your weekly availability.`,
    );
  }

  return {
    id: makeId('roadmap', `${request.targetRole}:${request.jobId ?? 'no-job'}:${finalTasks.map((t) => t.id).join('|')}`),
    title: `${request.targetRole || 'Career'} - ${horizonWeeks} week plan`,
    targetRole: request.targetRole,
    jobId: request.jobId,
    weeklyHours,
    horizonWeeks,
    tasks: finalTasks,
    sourceSkillGaps: ordered.filter((gap) => finalTasks.some((task) => task.skillLabel === gap.label)).map((gap) => gap.label),
    generation: {
      method: Object.keys(personalised).length ? 'ai-personalised' : 'deterministic-template',
      notes: [
        `Deterministic template plan: ${finalTasks.length} tasks, about ${totalHours} hours of focused work at ${weeklyHours}h per week.`,
        ...notes,
      ],
    },
    origin: 'user' as const,
    createdAt: now,
    updatedAt: now,
  };
}

/** Progress is derived from real task states only. */
export function computeRoadmapProgress(roadmap: LearningRoadmap): RoadmapProgress {
  const total = roadmap.tasks.length;
  const completed = roadmap.tasks.filter((task) => task.status === 'completed');
  const inProgress = roadmap.tasks.filter((task) => task.status === 'in-progress');
  const totalHours = roadmap.tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
  const completedHours = completed.reduce((sum, task) => sum + task.estimatedHours, 0)
    + inProgress.reduce((sum, task) => sum + task.estimatedHours * 0.5, 0);
  const remainingHours = Math.max(0, totalHours - completedHours);
  const weekly = roadmap.weeklyHours > 0 ? roadmap.weeklyHours : 1;

  return {
    total,
    completed: completed.length,
    inProgress: inProgress.length,
    notStarted: total - completed.length - inProgress.length,
    percentComplete: total === 0 ? 0 : Math.round((completed.length / total) * 100),
    completedHours: roundTo(completedHours, 1),
    totalHours,
    estimatedWeeksRemaining: roundTo(remainingHours / weekly, 1),
  };
}

/**
 * Reuses statuses from a previous plan when the task ids still match, so
 * recalculating a roadmap never silently loses completed work.
 */
export function preserveTaskState(previous: LearningRoadmap | undefined, next: LearningRoadmap): LearningRoadmap {
  if (!previous) return next;
  const lookup = new Map(previous.tasks.map((task) => [task.id, task]));
  let preserved = 0;
  const tasks = next.tasks.map((task) => {
    const old = lookup.get(task.id);
    if (!old) return task;
    preserved += 1;
    return { ...task, status: old.status, notes: old.notes, updatedAt: old.updatedAt };
  });
  return {
    ...next,
    id: previous.id,
    createdAt: previous.createdAt,
    tasks,
    generation: {
      ...next.generation,
      notes: [...next.generation.notes, `Recalculated: kept the progress of ${preserved} matching task${preserved === 1 ? '' : 's'}.`],
    },
  };
}

export interface TaskUpdate {
  status?: TaskStatus;
  title?: string;
  description?: string;
  estimatedHours?: number;
  notes?: string;
}

export function updateTask(roadmap: LearningRoadmap, taskId: string, update: TaskUpdate): LearningRoadmap {
  const now = new Date().toISOString();
  return {
    ...roadmap,
    updatedAt: now,
    tasks: roadmap.tasks.map((task) => (task.id === taskId ? { ...task, ...update, updatedAt: now } : task)),
  };
}

export function addCustomTask(
  roadmap: LearningRoadmap,
  input: { title: string; description?: string; phase?: RoadmapTask['phase']; estimatedHours?: number },
): LearningRoadmap {
  const now = new Date().toISOString();
  const task: RoadmapTask = {
    id: makeId('task', `custom:${input.title}:${roadmap.tasks.length}:${now}`),
    title: input.title,
    description: input.description ?? 'Custom task added by you.',
    phase: input.phase ?? 'Practice',
    estimatedHours: input.estimatedHours && input.estimatedHours > 0 ? Math.round(input.estimatedHours) : 4,
    priority: 500,
    prerequisites: [],
    exercise: 'Describe what you will produce for this task.',
    completionCriteria: 'You decide the definition of done and mark it complete when it is met.',
    status: 'not-started',
    custom: true,
    updatedAt: now,
  };
  return { ...roadmap, tasks: [...roadmap.tasks, task], updatedAt: now };
}

export function removeTask(roadmap: LearningRoadmap, taskId: string): LearningRoadmap {
  return {
    ...roadmap,
    tasks: roadmap.tasks.filter((task) => task.id !== taskId).map((task) => ({
      ...task,
      prerequisites: task.prerequisites.filter((id) => id !== taskId),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function groupTasksByPhase(roadmap: LearningRoadmap): { phase: RoadmapTask['phase']; tasks: RoadmapTask[] }[] {
  return PHASE_ORDER.map((phase) => ({
    phase,
    tasks: roadmap.tasks.filter((task) => task.phase === phase).sort((a, b) => a.priority - b.priority),
  })).filter((group) => group.tasks.length > 0);
}
