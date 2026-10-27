import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Plus, RefreshCw, Route as RouteIcon, RotateCcw, Trash2 } from 'lucide-react';
import {
  addCustomTask,
  analyseSkillGaps,
  computeRoadmapProgress,
  generateRoadmap,
  groupTasksByPhase,
  preserveTaskState,
  removeTask,
  updateTask,
  type LearningRoadmap,
  type RoadmapTask,
  type TaskStatus,
  type Workspace,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useToast } from '../../components/ui/Toast';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Progress, Select, SourceBadge, Textarea } from '../../components/ui/primitives';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { RoadmapProgressChart } from '../../components/charts/Charts';
import { formatDateTime } from '../../lib/format';

const STATUS_TONE: Record<TaskStatus, 'success' | 'brand' | 'neutral'> = {
  completed: 'success',
  'in-progress': 'brand',
  'not-started': 'neutral',
};

export default function RoadmapPage() {
  const { workspace, dispatch } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState(workspace.roadmaps[0]?.id ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RoadmapTask | null>(null);
  const [editing, setEditing] = useState<RoadmapTask | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', phase: 'Practice' as RoadmapTask['phase'], estimatedHours: 4 });

  const roadmap = useMemo(
    () => workspace.roadmaps.find((item) => item.id === selectedId) ?? workspace.roadmaps[0],
    [workspace.roadmaps, selectedId],
  );

  const progress = roadmap ? computeRoadmapProgress(roadmap) : null;
  const groups = roadmap ? groupTasksByPhase(roadmap) : [];

  const save = (next: LearningRoadmap, message?: string) => {
    dispatch({
      type: 'save-roadmap',
      roadmap: next,
      activity: message ? { kind: 'task-completed', message } : undefined,
    });
  };

  const setStatus = (task: RoadmapTask, status: TaskStatus) => {
    if (!roadmap) return;
    const next = updateTask(roadmap, task.id, { status });
    save(
      next,
      status === 'completed'
        ? `Completed the task “${task.title}”.`
        : status === 'in-progress'
          ? `Started the task “${task.title}”.`
          : `Reopened the task “${task.title}”.`,
    );
    if (status === 'completed') toast.success('Task completed', 'Roadmap progress updated from the actual task state.');
  };

  const recalculate = (jobIdOverride?: string) => {
    if (!roadmap) return;
    const job = workspace.jobs.find((item) => item.id === (jobIdOverride ?? roadmap.jobId));
    const report = job ? workspace.matches.find((match) => match.jobId === job.id) : undefined;
    if (!job || !report) {
      toast.error('No advert available', 'Rework the target role by analysing an advert first.');
      return;
    }
    const generated = generateRoadmap({
      targetRole: job.title,
      jobId: job.id,
      profile: workspace.profile,
      gaps: gapsForJob(workspace, job.id),
      weeklyHours: workspace.profile.weeklyLearningHours,
      horizonWeeks: workspace.settings.defaultHorizonWeeks,
    });
    save(preserveTaskState(roadmap, generated), `Recalculated the roadmap for ${job.title}.`);
    toast.success('Roadmap recalculated', 'Completed tasks were carried over.');
  };

  if (!roadmap) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Learning Roadmap"
          description="Roadmaps are generated from the gaps of a specific advert, so the plan always targets a real role rather than a generic checklist."
        />
        <EmptyState
          icon={<RouteIcon aria-hidden className="h-8 w-8" />}
          title="No roadmap yet"
          description="Analyse an advert, review the skill gaps, then generate a roadmap from the gaps page. Tasks arrive in four phases: Foundation, Practice, Portfolio and Applications."
          action={
            <Link to="/jobs" className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-brand-hover">
              Analyse an advert
            </Link>
          }
        />
        {workspace.jobs.length ? (
          <Card>
            <CardHeader title="Generate immediately" description="Create a plan from the most recent advert and profile." />
            <div className="mt-4">
              <Button
                onClick={() => navigate('/gaps')}
                icon={<Plus aria-hidden className="h-4 w-4" />}
              >
                Open the gaps page
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Roadmap"
        description={roadmap.title}
        action={
          <>
            <SourceBadge source={roadmap.generation.method === 'ai-personalised' ? 'ai' : 'local'} />
            <Button size="sm" variant="secondary" onClick={() => recalculate()} icon={<RefreshCw aria-hidden className="h-3.5 w-3.5" />}>
              Recalculate
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmReset(true)} icon={<RotateCcw aria-hidden className="h-3.5 w-3.5" />}>
              Reset plan
            </Button>
          </>
        }
      />

      {workspace.roadmaps.length > 1 ? (
        <Card>
          <CardHeader title="Roadmaps in this workspace" description="Each roadmap targets one role." />
          <div className="mt-4 max-w-xl">
            <Select aria-label="Select a roadmap" value={roadmap.id} onChange={(event) => setSelectedId(event.target.value)}>
              {workspace.roadmaps.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader title="Progress" description="Computed from task states, never estimated separately." />
            <div className="mt-4 space-y-3">
              <Progress value={progress?.percentComplete ?? 0} tone={(progress?.percentComplete ?? 0) > 60 ? 'success' : 'brand'} label="Roadmap progress" />
              <p className="text-2xl font-extrabold text-brand">{progress?.percentComplete ?? 0}%</p>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Completed', value: progress?.completed ?? 0 },
                  { label: 'In progress', value: progress?.inProgress ?? 0 },
                  { label: 'Not started', value: progress?.notStarted ?? 0 },
                  { label: 'Total tasks', value: progress?.total ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-ink-600 bg-ink-850 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-brand/55">{item.label}</dt>
                    <dd className="mt-0.5 text-base font-extrabold text-brand">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[11px] leading-relaxed text-brand/65">
                {progress?.completedHours}h of {progress?.totalHours}h complete · about {progress?.estimatedWeeksRemaining} weeks remaining at{' '}
                {roadmap.weeklyHours}h per week.
              </p>
              <p className="text-[10px] leading-relaxed text-brand/45">
                Completing this plan is not a guarantee of employment. It is a structured way to close the gaps this advert identified.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Phase progress" description="Where the work sits across the plan." />
            <div className="mt-3">
              <RoadmapProgressChart roadmap={roadmap} />
            </div>
          </Card>

          <Card>
            <CardHeader title="How this plan was produced" description={`Generated ${formatDateTime(roadmap.createdAt)}`} />
            <ul className="mt-3 space-y-2">
              {roadmap.generation.notes.map((note, index) => (
                <li key={index} className="text-[11px] leading-relaxed text-brand/70">
                  · {note}
                </li>
              ))}
            </ul>
            {roadmap.sourceSkillGaps.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {roadmap.sourceSkillGaps.map((gap) => (
                  <Badge key={gap} tone="brand">
                    {gap}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader
              title="Tasks"
              icon={<RouteIcon aria-hidden className="h-4 w-4" />}
              description="Mark tasks complete or reopen them at any time. Progress updates immediately."
              action={
                <Button size="sm" variant="secondary" onClick={() => setAdding(true)} icon={<Plus aria-hidden className="h-3.5 w-3.5" />}>
                  Add custom task
                </Button>
              }
            />

            <div className="mt-4 space-y-6">
              {groups.map((group) => (
                <section key={group.phase}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand/60">{group.phase}</h3>
                    <span className="text-[11px] text-brand/50">
                      {group.tasks.filter((task) => task.status === 'completed').length}/{group.tasks.length} complete
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {group.tasks.map((task) => (
                      <li
                        key={task.id}
                        className={`rounded-xl border p-3.5 ${
                          task.status === 'completed' ? 'border-success/30 bg-success-soft' : 'border-ink-600 bg-ink-850'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand">
                              <span className={task.status === 'completed' ? 'line-through opacity-70' : ''}>{task.title}</span>
                              <Badge tone={STATUS_TONE[task.status]}>{task.status}</Badge>
                              {task.skillLabel ? <Badge tone="neutral">{task.skillLabel}</Badge> : null}
                              {task.custom ? <Badge tone="brand">custom</Badge> : null}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-brand/70">{task.description}</p>
                            <p className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-brand/50">
                              <span className="inline-flex items-center gap-1">
                                <Clock aria-hidden className="h-3 w-3" /> {task.estimatedHours}h
                              </span>
                              <span>priority {task.priority}</span>
                              {task.prerequisites.length ? <span>after {task.prerequisites.length} earlier task(s)</span> : null}
                            </p>
                            <div className="mt-2 rounded-lg border border-ink-600/60 bg-ink-900/40 p-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-brand/50">Exercise</p>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-brand/75">{task.exercise}</p>
                              <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-brand/50">Done when</p>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-brand/75">{task.completionCriteria}</p>
                              {task.notes ? <p className="mt-1.5 text-[11px] italic text-brand/60">Your note: {task.notes}</p> : null}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 flex-col gap-1.5">
                            {task.status !== 'completed' ? (
                              <Button size="sm" onClick={() => setStatus(task, 'completed')} icon={<CheckCircle2 aria-hidden className="h-3.5 w-3.5" />}>
                                Complete
                              </Button>
                            ) : (
                              <Button size="sm" variant="secondary" onClick={() => setStatus(task, 'in-progress')}>
                                Reopen
                              </Button>
                            )}
                            {task.status === 'not-started' ? (
                              <Button size="sm" variant="ghost" onClick={() => setStatus(task, 'in-progress')}>
                                Start
                              </Button>
                            ) : null}
                            <Button size="sm" variant="ghost" onClick={() => setEditing(task)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(task)} className="text-danger hover:bg-danger-soft">
                              <Trash2 aria-hidden className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a custom task"
        description="Anything the generated plan missed: a course, a specific project, a piece of interview practice."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newTask.title.trim()) {
                  toast.error('A title is required');
                  return;
                }
                save(addCustomTask(roadmap, newTask), `Added the custom task “${newTask.title}”.`);
                setNewTask({ title: '', description: '', phase: 'Practice', estimatedHours: 4 });
                setAdding(false);
                toast.success('Task added');
              }}
            >
              Add task
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title">
            <Input value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} placeholder="Write a blog post about Docker" />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={newTask.description} onChange={(event) => setNewTask({ ...newTask, description: event.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phase">
              <Select value={newTask.phase} onChange={(event) => setNewTask({ ...newTask, phase: event.target.value as RoadmapTask['phase'] })}>
                <option value="Foundation">Foundation</option>
                <option value="Practice">Practice</option>
                <option value="Portfolio">Portfolio</option>
                <option value="Applications">Applications</option>
              </Select>
            </Field>
            <Field label="Estimated hours">
              <Input
                type="number"
                min={1}
                max={100}
                value={newTask.estimatedHours}
                onChange={(event) => setNewTask({ ...newTask, estimatedHours: Number(event.target.value) })}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit task"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editing) return;
                if (!editing.title.trim()) {
                  toast.error('A title is required');
                  return;
                }
                save(updateTask(roadmap, editing.id, {
                  title: editing.title,
                  description: editing.description,
                  estimatedHours: editing.estimatedHours,
                  notes: editing.notes,
                }), `Edited the task “${editing.title}”.`);
                setEditing(null);
                toast.success('Task updated');
              }}
            >
              Save task
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-3">
            <Field label="Title">
              <Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea rows={2} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
            </Field>
            <Field label="Estimated hours">
              <Input
                type="number"
                min={1}
                max={200}
                value={editing.estimatedHours}
                onChange={(event) => setEditing({ ...editing, estimatedHours: Number(event.target.value) })}
              />
            </Field>
            <Field label="Your notes" hint="Kept with the task so you can record what you actually did.">
              <Textarea rows={2} value={editing.notes ?? ''} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} />
            </Field>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="Reset this roadmap?"
        message="Every task, including completed ones and their notes, will be removed and a fresh plan generated from the current gaps. Your profile and adverts are not affected."
        confirmLabel="Reset plan"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          recalculate();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this task?"
        message={`“${confirmDelete?.title ?? ''}” will be removed from the plan. Tasks that depend on it keep their other prerequisites.`}
        confirmLabel="Delete task"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            save(removeTask(roadmap, confirmDelete.id), `Deleted the task “${confirmDelete.title}”.`);
            toast.info('Task deleted');
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

/** Recomputes the gaps for a job from the stored report, keeping the page honest. */
function gapsForJob(workspace: Workspace, jobId: string) {
  const job = workspace.jobs.find((item) => item.id === jobId);
  const report = workspace.matches.find((match) => match.jobId === jobId);
  if (!job || !report) return [];
  return analyseSkillGaps({ profile: workspace.profile, job, report });
}
