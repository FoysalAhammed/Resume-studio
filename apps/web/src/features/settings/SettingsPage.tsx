import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cpu,
  Database,
  Download,
  HardDriveDownload,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { MATCH_CONFIG, SCHEMA_VERSION, LIMITS } from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useApiStatus } from '../../state/ApiStatusProvider';
import { useToast } from '../../components/ui/Toast';
import { Badge, Button, Card, CardHeader, Checkbox, Field, Input, PageHeader, SourceBadge } from '../../components/ui/primitives';
import { ConfirmDialog } from '../../components/ui/Modal';
import { persistenceMode } from '../../lib/persistence';
import { downloadText, copyToClipboard } from '../../lib/download';
import { formatDateTime, pluralise } from '../../lib/format';

export default function SettingsPage() {
  const { workspace, loadSample, resetToEmpty, eraseEverything, exportJson, importJson, persisted, updateSettings } = useWorkspace();
  const { status, health, error, aiAvailable, refresh } = useApiStatus();
  const toast = useToast();
  const importRef = useRef<HTMLInputElement>(null);

  const [confirmErase, setConfirmErase] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmSample, setConfirmSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const stats = useMemo(
    () => [
      { label: 'Skills', value: workspace.profile.skills.length },
      { label: 'Adverts', value: workspace.jobs.length },
      { label: 'Reports', value: workspace.matches.length },
      { label: 'Roadmaps', value: workspace.roadmaps.length },
      { label: 'CV analyses', value: workspace.resumeAnalyses.length },
      { label: 'Drafts', value: workspace.drafts.length },
      { label: 'Interview sessions', value: workspace.interviewSessions.length },
      { label: 'Activity events', value: workspace.activity.length },
    ],
    [workspace],
  );

  const exportSize = new Blob([exportJson()]).size;
  const hasData = workspace.profile.skills.length > 0 || workspace.jobs.length > 0 || workspace.resumeAnalyses.length > 0;

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    const text = await file.text();
    const result = importJson(text);
    if (result.ok) {
      toast.success('Workspace imported', 'The imported data replaced the current workspace in this browser.');
    } else {
      setImportError(result.error);
      toast.error('Import failed', result.error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Data controls, AI provider status and the limits of this build. Everything here applies to this browser only."
        action={<SourceBadge source={workspace.origin === 'sample' ? 'sample' : 'local'} />}
      />

      <Card>
        <CardHeader
          title="Local workspace storage"
          icon={<Database aria-hidden className="h-4 w-4" />}
          description="Your workspace lives in this browser's IndexedDB. It isn't sent to the API server, synced between devices or encrypted."
          action={<Badge tone={persisted ? 'success' : 'caution'}>{persisted ? `Saved (${persistenceMode()})` : 'Memory only'}</Badge>}
        />

        {!persisted ? (
          <p className="mt-4 rounded-xl border border-caution/40 bg-caution-soft p-3 text-[11px] leading-relaxed text-caution">
            IndexedDB isn't available, so this session runs in memory. Data is lost when the tab closes. Private browsing often blocks
            storage, so export below if you want to keep a copy.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-ink-600 bg-ink-850 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">{stat.label}</p>
              <p className="mt-0.5 text-base font-extrabold text-brand">{stat.value}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-brand/60">
          {pluralise(Math.round(exportSize / 1024), 'KB')} of workspace data · last written {formatDateTime(workspace.updatedAt)} · schema version{' '}
          {workspace.schemaVersion} (current: {SCHEMA_VERSION})
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<Download aria-hidden className="h-4 w-4" />}
            onClick={() => {
              downloadText('careerlens-workspace.json', exportJson());
              toast.success('Exported', 'A JSON backup was downloaded. It contains no credentials.');
            }}
          >
            Export workspace
          </Button>
          <Button variant="secondary" icon={<Upload aria-hidden className="h-4 w-4" />} onClick={() => importRef.current?.click()}>
            Import workspace
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(event) => {
              void onImportFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            onClick={() =>
              void copyToClipboard(exportJson()).then((ok) => (ok ? toast.success('Copied', 'The workspace JSON is on your clipboard.') : toast.error('Copy failed')))
            }
          >
            Copy JSON
          </Button>
        </div>
        {importError ? (
          <p className="mt-2 text-[11px] font-semibold text-danger" role="alert">
            {importError}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Demonstration data"
          icon={<Sparkles aria-hidden className="h-4 w-4" />}
          description="Loading the sample workspace replaces what is in this browser with a fictional candidate, “Ayesha Rahman”. It stays labelled as demo data across the app."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => (hasData ? setConfirmSample(true) : loadSample())}>
            Load demonstration workspace
          </Button>
          <Button variant="secondary" onClick={() => setConfirmEmpty(true)}>
            Start an empty workspace
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Danger zone"
          icon={<AlertTriangle aria-hidden className="h-4 w-4" />}
          description="Destructive actions. Nothing is recoverable once confirmed, unless you exported first."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="danger" icon={<Trash2 aria-hidden className="h-4 w-4" />} onClick={() => setConfirmErase(true)}>
            Erase all workspace data
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="AI provider"
          icon={<Cpu aria-hidden className="h-4 w-4" />}
          description="The provider is configured on the API server through environment variables. No key ever reaches this browser or your workspace."
          action={
            <>
              <Badge tone={status === 'online' ? (aiAvailable ? 'brand' : 'neutral') : 'caution'}>
                {status === 'checking' ? 'Checking…' : status === 'offline' ? 'API offline' : aiAvailable ? 'AI configured' : 'Local mode'}
              </Badge>
              <Button size="sm" variant="secondary" icon={<RefreshCw aria-hidden className="h-3.5 w-3.5" />} onClick={() => void refresh()}>
                Re-check
              </Button>
            </>
          }
        />

        <dl className="mt-4 space-y-2 text-[11px]">
          <div className="flex justify-between gap-3 border-b border-ink-600/40 pb-2">
            <dt className="text-brand/55">Provider configured</dt>
            <dd className="font-semibold text-brand">{health?.ai.configured ? 'Yes' : 'No'}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-ink-600/40 pb-2">
            <dt className="text-brand/55">Model</dt>
            <dd className="font-mono font-semibold text-brand">{health?.ai.model ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-ink-600/40 pb-2">
            <dt className="text-brand/55">Endpoint</dt>
            <dd className="font-mono font-semibold text-brand">{health?.ai.baseUrl ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-ink-600/40 pb-2">
            <dt className="text-brand/55">Matching engine version</dt>
            <dd className="font-mono font-semibold text-brand">{health?.matchEngineVersion ?? MATCH_CONFIG.version}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-brand/55">Upload limit</dt>
            <dd className="font-semibold text-brand">{health?.limits.maxUploadMb ?? Math.round(LIMITS.maxUploadBytes / (1024 * 1024))} MB</dd>
          </div>
        </dl>

        {error ? (
          <p className="mt-3 rounded-xl border border-caution/40 bg-caution-soft p-3 text-[11px] leading-relaxed text-caution">
            {error} Every analysis feature still works in the browser using local rules, so nothing is blocked. Only server-side file parsing
            and optional AI features need the API. Start it with <span className="font-mono">npm run dev:api</span>.
          </p>
        ) : null}

        <div className="mt-4 rounded-xl border border-ink-600 bg-ink-850 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Server configuration (in .env, never here)</p>
          <pre className="mt-1.5 font-mono text-[11px] leading-relaxed text-brand/70">{`AI_API_KEY=your-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=30000`}</pre>
          <p className="mt-2 text-[11px] leading-relaxed text-brand/60">
            Leave AI_API_KEY empty and every screen falls back to local rules, which is the default here. When AI is used, the result is
            labelled AI-assisted and the model's output is validated against a schema before use.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Interface preferences" description="Stored with your workspace." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Checkbox
            label="Reduce motion"
            description="Also honoured automatically when your operating system requests reduced motion."
            checked={workspace.settings.reducedMotion}
            onChange={(event) => updateSettings({ reducedMotion: event.target.checked })}
          />
          <Field label="Default roadmap horizon (weeks)" hint="Used when generating a new plan. Between 1 and 104.">
            <Input
              type="number"
              min={1}
              max={104}
              value={workspace.settings.defaultHorizonWeeks}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value >= 1 && value <= 104) updateSettings({ defaultHorizonWeeks: value });
              }}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Limits of this build"
          icon={<HardDriveDownload aria-hidden className="h-4 w-4" />}
          description="Read this before presenting or relying on any result."
        />
        <ul className="mt-4 space-y-2 text-[11px] leading-relaxed text-brand/75">
          <li>· Browser storage is demonstration persistence for a single device and a single user. It is not secure production storage.</li>
          <li>· There is no authentication and no multi-user isolation in this release; anyone with access to this browser profile can read the workspace.</li>
          <li>· Matching is lexical with a curated relation graph. Semantic similarity is not implemented.</li>
          <li>· Requirement extraction is keyword and pattern based and can miss unusual wording. Correct it on the advert's edit tab.</li>
          <li>· No OCR: scanned or image-only PDFs report that no text layer was found.</li>
          <li>· No live job listings, recruiter data, salary figures or market statistics are used or invented anywhere.</li>
          <li>· Interview feedback and CV rewrites are heuristics and templates. Neither is a validated assessment.</li>
          <li>· The extension page is a preview inside the website, not an installed browser extension.</li>
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-brand/60">
          Full detail is in <span className="font-mono">docs/LIMITATIONS.md</span>, with the demonstration script in{' '}
          <span className="font-mono">docs/DEMO_GUIDE.md</span>.
        </p>
      </Card>

      <ConfirmDialog
        open={confirmSample}
        title="Load the demonstration workspace?"
        message="This replaces the current profile, adverts, roadmaps, drafts and activity with the fictional sample dataset. Export a backup first if you want to keep your current workspace."
        confirmLabel="Replace with demo data"
        tone="primary"
        onCancel={() => setConfirmSample(false)}
        onConfirm={() => {
          setConfirmSample(false);
          loadSample();
          toast.success('Demonstration workspace loaded', 'Everything shown is fictional and labelled as such.');
        }}
      />

      <ConfirmDialog
        open={confirmEmpty}
        title="Start an empty workspace?"
        message="Your profile, adverts, roadmaps, drafts and activity will be cleared from this browser. Exported files and anything you copied elsewhere are unaffected."
        confirmLabel="Clear and start empty"
        busy={busy}
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={() => {
          setBusy(true);
          void resetToEmpty().then(() => {
            setBusy(false);
            setConfirmEmpty(false);
            toast.success('Workspace cleared');
          });
        }}
      />

      <ConfirmDialog
        open={confirmErase}
        title="Erase all workspace data?"
        message="This deletes the workspace from IndexedDB in this browser as well as clearing it from the running app. There is no undo."
        confirmLabel="Erase everything"
        busy={busy}
        onCancel={() => setConfirmErase(false)}
        onConfirm={() => {
          setBusy(true);
          void eraseEverything().then(() => {
            setBusy(false);
            setConfirmErase(false);
            toast.success('All workspace data erased');
          });
        }}
      />
    </div>
  );
}
