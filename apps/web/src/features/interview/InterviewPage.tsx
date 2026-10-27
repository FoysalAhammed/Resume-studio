import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessagesSquare, RefreshCw, Send, Sparkles } from 'lucide-react';
import {
  availableInterviewTopics,
  createInterviewSession,
  evaluateAnswer,
  generateInterviewQuestions,
  recordAnswer,
  type InterviewFeedback,
  type InterviewQuestion,
  type InterviewQuestionType,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useApiStatus } from '../../state/ApiStatusProvider';
import { useToast } from '../../components/ui/Toast';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  Field,
  PageHeader,
  Progress,
  Select,
  SourceBadge,
  Textarea,
} from '../../components/ui/primitives';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

const DIFFICULTIES = ['foundation', 'intermediate', 'advanced'] as const;
const TYPES: { id: InterviewQuestionType; label: string }[] = [
  { id: 'technical', label: 'Technical knowledge' },
  { id: 'practical', label: 'Practical problem solving' },
  { id: 'project', label: 'Project explanation' },
  { id: 'behavioural', label: 'Behavioural' },
];

export default function InterviewPage() {
  const { workspace, dispatch } = useWorkspace();
  const { aiAvailable } = useApiStatus();
  const toast = useToast();

  const [jobId, setJobId] = useState(workspace.jobs[0]?.id ?? '');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('intermediate');
  const [types, setTypes] = useState<InterviewQuestionType[]>(['technical', 'behavioural']);
  const [topic, setTopic] = useState('all');
  const [count, setCount] = useState(6);
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [source, setSource] = useState<'local' | 'ai'>('local');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, InterviewFeedback>>({});
  const [notice, setNotice] = useState('');

  const job = workspace.jobs.find((item) => item.id === jobId);
  const topics = useMemo(() => availableInterviewTopics(workspace.profile, job), [workspace.profile, job]);

  const generate = async () => {
    if (types.length === 0) {
      toast.error('Choose at least one question type');
      return;
    }
    setBusy(true);
    setFeedback({});
    setAnswers({});
    try {
      if (useAi && aiAvailable) {
        const response = await api.generateInterview({
          profile: workspace.profile,
          job,
          difficulty,
          types,
          topic: topic === 'all' ? undefined : topic,
          count,
          useAi: true,
        });
        if (response.ok) {
          setQuestions(response.data.questions);
          setSource(response.data.source);
          setNotice(response.data.feedbackNotice);
          toast.success('AI-assisted question set ready', 'Feedback on your answers stays heuristic.');
          return;
        }
        toast.warning('AI generation unavailable', `${response.error} Curated questions were used instead.`);
      }

      const generated = generateInterviewQuestions({
        profile: workspace.profile,
        job,
        difficulty,
        types,
        topic: topic === 'all' ? undefined : topic,
        count,
      });
      setQuestions(generated);
      setSource('local');
      setNotice('Answer feedback is a keyword and structure heuristic, not a validated assessment.');
      toast.success('Practice set ready', `${generated.length} questions drawn from the advert, your skills and curated templates.`);
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (question: InterviewQuestion) => {
    const text = (answers[question.id] ?? '').trim();
    if (!text) {
      toast.error('Write an answer first', 'Even a few sentences help you practise structuring a response.');
      return;
    }
    // The API evaluates with the same heuristic when reachable; the local
    // evaluator is identical, so the offline path is not a downgrade.
    const response = await api.evaluateInterview(question, text);
    const result = response.ok ? response.data.feedback : evaluateAnswer(question, text);
    setFeedback((current) => ({ ...current, [question.id]: result }));
    if (response.ok) setNotice(response.data.notice);
  };

  const saveSession = () => {
    if (questions.length === 0) return;
    let session = createInterviewSession(job?.title || workspace.profile.headline || 'Practice session', difficulty, questions);
    for (const [questionId, text] of Object.entries(answers)) {
      if (text.trim()) session = recordAnswer(session, questionId, text);
    }
    dispatch({
      type: 'save-interview',
      session,
      activity: { kind: 'draft-generated', message: `Saved an interview practice session with ${session.questions.length} questions.` },
    });
    toast.success('Session saved', 'Question set and your answers were stored in this browser.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview Preparation"
        description="Questions are drawn from the advert's requirements, your recorded skills and projects, and a curated bank. Feedback on your answers is a keyword and structure heuristic — it is not a validated assessment and cannot predict an interview outcome."
        action={
          <>
            <SourceBadge source={questions.length ? source : 'local'} />
            {source === 'local' && questions.length ? <Badge tone="neutral">curated templates</Badge> : null}
          </>
        }
      />

      <Card>
        <CardHeader
          title="Build a practice set"
          icon={<MessagesSquare aria-hidden className="h-4 w-4" />}
          description="Pick a target role and the question types you want to rehearse."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Target advert (optional)">
            <Select value={jobId} onChange={(event) => setJobId(event.target.value)}>
              <option value="">No advert — use my profile only</option>
              {workspace.jobs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {item.company}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty">
            <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
              {DIFFICULTIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Focus topic" hint="Filter to a single skill, or keep the full mix.">
            <Select value={topic} onChange={(event) => setTopic(event.target.value)}>
              <option value="all">All topics</option>
              {topics.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <p className="label">Question types</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TYPES.map((item) => (
              <Checkbox
                key={item.id}
                label={item.label}
                checked={types.includes(item.id)}
                onChange={(event) =>
                  setTypes((current) => (event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id)))
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={`Number of questions: ${count}`} hint="Between 1 and 15.">
            <input
              type="range"
              min={1}
              max={15}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="w-full accent-brand"
              aria-label="Number of questions"
            />
          </Field>
          {aiAvailable ? (
            <Checkbox
              label="Generate questions with the configured AI provider"
              description="The model receives requirement labels, your skill names and project names — not your full profile."
              checked={useAi}
              onChange={(event) => setUseAi(event.target.checked)}
            />
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => void generate()} loading={busy} icon={<Sparkles aria-hidden className="h-4 w-4" />}>
            Generate questions
          </Button>
          {questions.length ? (
            <Button variant="secondary" size="sm" onClick={saveSession} icon={<CheckCircle2 aria-hidden className="h-3.5 w-3.5" />}>
              Save session
            </Button>
          ) : null}
          {notice ? <p className="text-[11px] text-brand/60">{notice}</p> : null}
        </div>
      </Card>

      {questions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessagesSquare aria-hidden className="h-8 w-8" />}
            title="No questions generated yet"
            description="Generate a set above. Technical questions come from the advert and your skills, project questions from your own work, and behavioural questions from a curated bank."
            action={
              !workspace.profile.skills.length ? (
                <Link to="/profile" className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-brand-hover">
                  Add skills first
                </Link>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => {
            const result = feedback[question.id];
            return (
              <Card key={question.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[11px]">
                      <Badge tone="neutral">Q{index + 1}</Badge>
                      <Badge tone="brand">{question.type}</Badge>
                      <Badge tone="neutral">{question.difficulty}</Badge>
                      <Badge tone={question.origin === 'job-requirement' ? 'caution' : 'neutral'}>{question.topic}</Badge>
                      <span className="text-brand/45">{question.origin === 'job-requirement' ? 'from the advert' : 'curated'}</span>
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-brand">{question.question}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <Field label="Your answer" hint="Aim for a specific situation, what you did and what changed.">
                    <Textarea
                      rows={4}
                      value={answers[question.id] ?? ''}
                      onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
                      placeholder="Structure it: situation, what you did, the result…"
                    />
                  </Field>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void submitAnswer(question)} icon={<Send aria-hidden className="h-3.5 w-3.5" />}>
                      Get feedback
                    </Button>
                    {result ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setFeedback((current) => {
                            const next = { ...current };
                            delete next[question.id];
                            return next;
                          })
                        }
                      >
                        <RefreshCw aria-hidden className="h-3.5 w-3.5" /> Clear feedback
                      </Button>
                    ) : null}
                  </div>
                </div>

                {result ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-ink-600 bg-ink-850 p-3.5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: 'Rubric coverage', value: result.coverageScore },
                        { label: 'Structure', value: result.structureScore },
                        { label: 'Heuristic score', value: result.heuristicScore },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">{item.label}</p>
                          <p className="mt-0.5 text-base font-extrabold text-brand">{item.value}%</p>
                          <Progress value={item.value} tone={item.value >= 65 ? 'success' : item.value >= 35 ? 'brand' : 'caution'} label={item.label} />
                        </div>
                      ))}
                    </div>

                    {result.matchedPoints.length ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Points you covered</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {result.matchedPoints.map((point) => (
                            <Badge key={point} tone="success">
                              {point}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {result.missingPoints.length ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Consider adding</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {result.missingPoints.map((point) => (
                            <Badge key={point} tone="caution">
                              {point}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <ul className="space-y-1.5">
                      {result.notes.map((note, noteIndex) => (
                        <li key={noteIndex} className="text-[11px] leading-relaxed text-brand/70">
                          · {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <details className="mt-3 rounded-xl border border-ink-600 bg-ink-900/40 p-3">
                    <summary className="cursor-pointer text-[11px] font-semibold text-brand/70">
                      Show what a strong answer should cover (hints)
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {question.rubricHints.map((hint) => (
                        <li key={hint} className="text-[11px] text-brand/70">
                          · {hint}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader title="Past practice sessions" description="Stored in this browser so you can see what you rehearsed." />
        {workspace.interviewSessions.length ? (
          <ul className="mt-4 space-y-2.5">
            {workspace.interviewSessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-850 p-3.5">
                <div>
                  <p className="text-xs font-bold text-brand">{session.role}</p>
                  <p className="mt-0.5 text-[11px] text-brand/60">
                    {session.questions.length} questions · {session.answers.length} answered · {session.difficulty} ·{' '}
                    {formatDateTime(session.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[11px] text-brand/55">No sessions saved yet.</p>
        )}
      </Card>
    </div>
  );
}
