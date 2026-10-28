import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Download, Info, Mail, Printer, Sparkles, Trash2, Wand2 } from 'lucide-react';
import {
  coverLetterChecklist,
  generateCoverLetter,
  type DraftDocument,
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
  Select,
  SourceBadge,
  Textarea,
} from '../../components/ui/primitives';
import { ConfirmDialog } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import { copyToClipboard, downloadText, printTextDocument } from '../../lib/download';
import { formatDateTime } from '../../lib/format';

export default function CoverLetterPage() {
  const { workspace, dispatch } = useWorkspace();
  const { aiAvailable, status: apiStatus } = useApiStatus();
  const toast = useToast();

  const [jobId, setJobId] = useState(workspace.jobs[0]?.id ?? '');
  const [motivation, setMotivation] = useState('');
  const [addressGap, setAddressGap] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftDocument | null>(null);
  const [source, setSource] = useState<'local' | 'ai'>('local');
  const [notes, setNotes] = useState<string[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const job = workspace.jobs.find((item) => item.id === jobId);
  const checklist = useMemo(() => coverLetterChecklist(), []);

  const generate = async () => {
    if (!job) {
      toast.error('Choose an advert', 'A cover letter needs a target role and company.');
      return;
    }
    setBusy(true);
    setNotes([]);
    try {
      if (useAi && aiAvailable) {
        const response = await api.coverLetter({ profile: workspace.profile, job, motivation, addressGap, useAi: true });
        if (response.ok) {
          setDraft(response.data.draft);
          setSource(response.data.source);
          setNotes([...response.data.draft.generated.notes, ...(response.data.ai.reason ? [response.data.ai.reason] : [])]);
          toast.success('AI-assisted draft ready', 'Check every sentence before sending it.');
          return;
        }
        toast.warning('AI generation unavailable', `${response.error} A template draft was produced instead.`);
      }

      const local = generateCoverLetter({ profile: workspace.profile, job, motivation, addressGap });
      setDraft(local);
      setSource('local');
      setNotes(local.generated.notes);
      toast.success('Draft ready', 'Built from the facts in your profile.');
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = () => {
    if (!draft) return;
    dispatch({
      type: 'save-draft',
      draft,
      activity: { kind: 'draft-generated', message: `Saved a cover letter draft for ${draft.title}.` },
    });
    toast.success('Draft saved', 'Stored in this browser workspace.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cover Letter Generator"
        description="A draft built from facts already in your profile, plus your own motivation. It never invents a qualification, employer or metric, and it never submits anything for you."
        action={
          <>
            <SourceBadge source={draft ? source : 'local'} />
            {workspace.drafts.length ? <Badge tone="neutral">{workspace.drafts.length} saved</Badge> : null}
          </>
        }
      />

      <Card>
        <CardHeader
          title="Step 1 · Choose the target and add your own words"
          icon={<Mail aria-hidden className="h-4 w-4" />}
          description="The motivation paragraph is the part only you can write. Leave it empty and the draft inserts a bracketed prompt instead of inventing a reason."
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Target advert">
            <Select value={jobId} onChange={(event) => setJobId(event.target.value)}>
              <option value="">Choose an analysed advert…</option>
              {workspace.jobs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {item.company}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <p className="text-[11px] leading-relaxed text-brand/60">
              {job
                ? `Requirements available for the letter: ${job.requirements.slice(0, 6).map((requirement) => requirement.label).join(', ') || 'none extracted'}`
                : 'You can only target an advert you have analysed, so every claim traces back to evidence.'}
            </p>
          </div>
        </div>

        <Field
          label="Why do you want this role?"
          className="mt-4"
          hint="Two or three sentences in your own voice. It goes in word for word."
        >
          <Textarea
            rows={4}
            value={motivation}
            onChange={(event) => setMotivation(event.target.value)}
            placeholder="I have used internal tools like yours daily and I want to build them for a living…"
          />
        </Field>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Checkbox
            label="Include a sentence about closing your biggest gap"
            description="Optional. Only include it if you really want to raise it."
            checked={addressGap}
            onChange={(event) => setAddressGap(event.target.checked)}
          />
          {aiAvailable ? (
            <Checkbox
              label="Draft with the configured AI provider"
              description="The model only receives your profile summary, recent experience, projects, the advert's requirement labels and your motivation."
              checked={useAi}
              onChange={(event) => setUseAi(event.target.checked)}
            />
          ) : (
            <div className="rounded-xl border border-ink-600 bg-ink-850 p-3 text-[11px] leading-relaxed text-brand/60">
              {apiStatus === 'online'
                ? 'No AI provider is configured, so the template letter is used. It is built from your recorded facts and works fine.'
                : 'The API is offline, so the template letter is built in your browser. Nothing leaves this device.'}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => void generate()} loading={busy} icon={<Sparkles aria-hidden className="h-4 w-4" />}>
            Generate draft
          </Button>
          {!workspace.profile.displayName ? (
            <span className="text-[11px] text-caution">
              Add your name on the profile page first. The letter needs a signature.
            </span>
          ) : null}
        </div>
      </Card>

      {draft ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <Card>
              <CardHeader
                title="Step 2 · Review and edit"
                description={draft.title}
                action={
                  <>
                    <SourceBadge source={source} />
                    <Button size="sm" variant="secondary" onClick={saveDraft} icon={<Check aria-hidden className="h-3.5 w-3.5" />}>
                      Save to workspace
                    </Button>
                  </>
                }
              />
              <div className="mt-4">
                <Textarea
                  rows={22}
                  aria-label="Cover letter draft"
                  value={draft.body}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value, reviewed: true })}
                  className="font-mono text-[11px] leading-relaxed"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Copy aria-hidden className="h-3.5 w-3.5" />}
                  onClick={() =>
                    void copyToClipboard(draft.body).then((ok) =>
                      ok ? toast.success('Copied', 'The letter is on your clipboard.') : toast.error('Copy failed'),
                    )
                  }
                >
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download aria-hidden className="h-3.5 w-3.5" />}
                  onClick={() => {
                    downloadText('cover-letter.txt', draft.body);
                    toast.success('Downloaded', 'Saved as a plain text file.');
                  }}
                >
                  Download .txt
                </Button>
                <Button
                  size="sm"
                  icon={<Printer aria-hidden className="h-3.5 w-3.5" />}
                  onClick={() => {
                    if (!printTextDocument(draft.title, draft.body)) toast.error('Pop-up blocked', 'Allow pop-ups to print or save as PDF.');
                  }}
                >
                  Print / Save as PDF
                </Button>
                {aiAvailable && !busy ? (
                  <Button size="sm" variant="ghost" icon={<Wand2 aria-hidden className="h-3.5 w-3.5" />} onClick={() => void generate()}>
                    Regenerate
                  </Button>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader title="Before you send it" icon={<Info aria-hidden className="h-4 w-4" />} description="A checklist, not a guarantee." />
              <ul className="mt-3 space-y-2">
                {checklist.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-brand/75">
                    <span className="text-brand/50">○</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="How this draft was built" description="Where every claim in the letter came from." />
              <ul className="mt-3 space-y-2">
                {notes.map((note, index) => (
                  <li key={index} className="text-[11px] leading-relaxed text-brand/70">
                    · {note}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Mail aria-hidden className="h-8 w-8" />}
            title="No draft generated yet"
            description="Choose an advert, add your motivation, then generate. The template path needs no API server and no API key."
            action={
              workspace.jobs.length === 0 ? (
                <Link to="/jobs" className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-brand-hover">
                  Analyse an advert first
                </Link>
              ) : null
            }
          />
        </Card>
      )}

      <Card>
        <CardHeader title="Saved drafts" description="Drafts stay in this browser only." />
        {workspace.drafts.length ? (
          <ul className="mt-4 space-y-2.5">
            {workspace.drafts.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-850 p-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-brand">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-brand/60">
                    {item.generated.method === 'ai' ? 'AI-assisted' : 'Deterministic template'} · {formatDateTime(item.createdAt)} ·{' '}
                    {item.body.split(/\s+/).filter(Boolean).length} words
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setDraft(item)}>
                    Open
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPendingRemoval(item.id)}
                    aria-label={`Delete draft ${item.title}`}
                    className="rounded-lg p-1.5 text-danger/80 transition-colors hover:bg-danger-soft"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[11px] text-brand/55">No drafts saved yet.</p>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Delete this draft?"
        message="The saved draft will be removed from this browser. Your profile is not affected."
        confirmLabel="Delete draft"
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) {
            dispatch({ type: 'remove-draft', id: pendingRemoval, activity: { kind: 'draft-generated', message: 'Deleted a saved draft.' } });
            toast.info('Draft deleted');
          }
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}
