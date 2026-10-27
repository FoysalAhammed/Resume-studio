import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from 'lucide-react';
import {
  analyseResumeText,
  buildProfilePatch,
  LIMITS,
  validateResumeFile,
  type ProfilePatch,
  type ResumeAnalysis,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useApiStatus } from '../../state/ApiStatusProvider';
import { useToast } from '../../components/ui/Toast';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, PageHeader, Progress, SourceBadge, Skeleton, Textarea } from '../../components/ui/primitives';
import { ConfirmDialog } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import { formatBytes, formatDateTime, pluralise } from '../../lib/format';

type Status = 'idle' | 'validating' | 'uploading' | 'analysing' | 'done' | 'error';

interface AnalysisResult {
  analysis: ResumeAnalysis;
  patch: ProfilePatch;
  source: 'local' | 'ai';
  ai?: { used: boolean; reason?: string };
  aiReason?: string;
  retained: boolean;
}

export default function ResumeAnalyzerPage() {
  const { workspace, dispatch, applyResumePatch } = useWorkspace();
  const { status: apiStatus, aiAvailable } = useApiStatus();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [useAi, setUseAi] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const busy = status === 'validating' || status === 'uploading' || status === 'analysing';

  /** Raw upload with real byte progress rather than a decorative animation. */
  const uploadFile = (file: File) =>
    new Promise<AnalysisResult>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', '/api/resumes/parse');
      request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      request.setRequestHeader('X-File-Name', file.name);
      request.setRequestHeader('X-Use-Ai', String(useAi && aiAvailable));

      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      request.upload.onload = () => {
        setStatus('analysing');
        setStage('Extracting text and structuring the document on the server…');
      };
      request.onerror = () => reject(new Error('The upload failed. Check that the API server is running.'));
      request.ontimeout = () => reject(new Error('The upload timed out.'));
      request.onload = () => {
        try {
          const payload = JSON.parse(request.responseText) as AnalysisResult & { error?: { message?: string } };
          if (request.status >= 400) {
            reject(new Error(payload.error?.message ?? `The server rejected the file (HTTP ${request.status}).`));
            return;
          }
          resolve(payload);
        } catch {
          reject(new Error('The server response could not be read.'));
        }
      };
      request.send(file);
    });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setApplied(false);
    setError(null);
    setStatus('validating');
    setStage('Validating the file…');
    setProgress(0);

    const validation = validateResumeFile({ name: file.name, size: file.size, type: file.type }, LIMITS);
    if (!validation.ok) {
      setStatus('error');
      setError(validation.errors.join(' '));
      toast.error('That file cannot be used', validation.errors[0]);
      return;
    }
    if (validation.warnings.length) {
      toast.warning('Heads up', validation.warnings[0]);
    }

    const kind = validation.kind;

    // Plain text is analysed in the browser, so this path works with no server.
    if (kind === 'text') {
      try {
        const text = await file.text();
        setStatus('analysing');
        setStage('Structuring the document locally…');
        const analysis = analyseResumeText(text, { fileName: file.name, fileType: file.type || 'text/plain', fileSizeBytes: file.size });
        const patch = localPatch(analysis);
        setResult({ analysis, patch, source: 'local', retained: false });
        setStatus('done');
        dispatch({
          type: 'save-resume-analysis',
          analysis,
          activity: { kind: 'resume-analysed', message: `Analysed ${file.name} in the browser: ${pluralise(analysis.skills.length, 'skill')} detected.` },
        });
        if (!analysis.profile.email) {
          toast.info('Text extracted', 'No email address was found in the document. Review the extracted fields before applying them.');
        }
      } catch {
        setStatus('error');
        setError('The text file could not be read.');
      }
      return;
    }

    if (apiStatus !== 'online') {
      setStatus('error');
      setError(
        `PDF and DOCX files are parsed by the API server, which is not reachable right now. Start it with "npm run dev" (or "npm run dev:api"), or paste your CV text below — pasted text is analysed entirely in your browser.`,
      );
      return;
    }

    try {
      setStatus('uploading');
      setStage('Uploading…');
      const payload = await uploadFile(file);
      setResult({ analysis: payload.analysis, patch: payload.patch, source: payload.source, aiReason: payload.ai?.reason, retained: payload.retained });
      setStatus('done');
      setProgress(100);
      dispatch({
        type: 'save-resume-analysis',
        analysis: payload.analysis,
        activity: {
          kind: 'resume-analysed',
          message: `Parsed ${payload.analysis.fileName}: ${pluralise(payload.analysis.skills.length, 'skill')} and ${pluralise(payload.analysis.experience.length, 'experience entry', 'experience entries')} found.`,
        },
      });
      toast.success('Resume analysed', `${payload.analysis.sectionsDetected.length} sections detected. Review the extracted fields before applying them.`);
    } catch (uploadError) {
      setStatus('error');
      const message = uploadError instanceof Error ? uploadError.message : 'The resume could not be processed.';
      setError(message);
      toast.error('Analysis failed', message);
    }
  };

  const handlePastedText = async () => {
    const text = pastedText.trim();
    if (text.length < 60) {
      toast.error('Not enough text', 'Paste at least a few lines of your CV so the analyser has something to work with.');
      return;
    }
    setError(null);
    setResult(null);
    setApplied(false);
    setStatus('analysing');
    setStage('Analysing the pasted text…');

    // The same deterministic analyser runs in the browser, so this always works.
    if (apiStatus !== 'online' || !useAi) {
      const analysis = analyseResumeText(text, { fileName: 'pasted-resume.txt', fileType: 'text/plain', fileSizeBytes: text.length });
      const patch = localPatch(analysis);
      setResult({ analysis, patch, source: 'local', retained: false });
      setStatus('done');
      dispatch({
        type: 'save-resume-analysis',
        analysis,
        activity: { kind: 'resume-analysed', message: `Analysed pasted CV text in the browser: ${pluralise(analysis.skills.length, 'skill')} detected.` },
      });
      return;
    }

    const response = await api.parseResumeText('pasted-resume.txt', text, true);
    if (response.ok) {
      setResult({
        analysis: response.data.analysis,
        patch: response.data.patch,
        source: response.data.source,
        aiReason: response.data.ai?.reason,
        retained: response.data.retained,
      });
      setStatus('done');
      dispatch({
        type: 'save-resume-analysis',
        analysis: response.data.analysis,
        activity: { kind: 'resume-analysed', message: `Analysed pasted CV text (${response.data.source}).` },
      });
    } else {
      setStatus('error');
      setError(`${response.error} Falling back is easy: turn off AI assistance and the same deterministic analyser will run in your browser.`);
    }
  };

  const applyToProfile = () => {
    if (!result) return;
    applyResumePatch(result.patch, {
      kind: 'profile-updated',
      message: `Applied ${result.patch.fields.length} parsed fields from ${result.analysis.fileName} to the career profile.`,
    });
    dispatch({
      type: 'save-resume-analysis',
      analysis: result.analysis,
      activity: { kind: 'resume-analysed', message: `Applied parsed data from ${result.analysis.fileName}.` },
    });
    setApplied(true);
    toast.success('Applied to your profile', 'Existing entries were kept; only missing information was added.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume Analyzer"
        description="Upload a CV or paste its text. CareerLens extracts the structure, scores completeness and proposes profile changes for you to approve — nothing is written to your profile until you say so."
        action={
          <>
            <Badge tone={apiStatus === 'online' ? 'neutral' : 'caution'}>
              {apiStatus === 'online' ? 'File parsing available' : 'File parsing needs the API'}
            </Badge>
            <SourceBadge source={result?.source ?? 'local'} reason={result?.aiReason} />
          </>
        }
      />

      <Card>
        <CardHeader
          title="Step 1 · Provide your CV"
          icon={<Upload aria-hidden className="h-4 w-4" />}
          description={`Accepted formats: PDF, DOCX, TXT and MD, up to ${Math.round(LIMITS.maxUploadBytes / (1024 * 1024))} MB. Files are validated on the server and are never written to disk or kept after the response.`}
        />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? 'border-brand bg-brand-soft' : 'border-ink-600 bg-ink-850'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-ink-600 bg-ink-900 text-brand">
              <FileText aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-brand">Drag and drop your CV here</p>
              <p className="mt-0.5 text-xs text-brand/60">or choose a file — PDF and DOCX are parsed by the API, TXT is parsed in your browser</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="sr-only"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={busy} icon={<Upload aria-hidden className="h-4 w-4" />}>
              Choose a file
            </Button>
          </div>
        </div>

        {busy ? (
          <div className="mt-4 space-y-2 rounded-xl border border-brand/40 bg-brand-soft p-4" aria-live="polite">
            <p className="text-xs font-semibold text-brand">{stage}</p>
            {status === 'uploading' ? <Progress value={progress} label="Upload progress" /> : <Skeleton className="h-2 w-full" />}
            <p className="text-[11px] text-brand/60">
              {status === 'uploading'
                ? `${progress}% uploaded. Parsing happens after the upload completes.`
                : 'Text is being extracted and structured. This is real work, not a decorative animation.'}
            </p>
          </div>
        ) : null}

        <div className="mt-5 border-t border-ink-600/60 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand/60">Or paste the text</p>
          <p className="mt-1 text-[11px] leading-relaxed text-brand/60">
            Paste the contents of your CV. This path always works, even with no API server, because the deterministic analyser runs in your browser.
          </p>
          <div className="mt-3">
            <Textarea
              rows={5}
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Paste your CV text here…"
              aria-label="Pasted CV text"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={() => void handlePastedText()} disabled={busy} icon={<Wand2 aria-hidden className="h-4 w-4" />}>
              Analyse pasted text
            </Button>
            <span className="text-[11px] text-brand/55">{pastedText.trim().length} characters pasted</span>
            {aiAvailable ? (
              <div className="w-full sm:w-auto">
                <Checkbox
                  label="Use the configured AI provider for this parse"
                  description="The AI may only add skills the keyword pass missed; it never overwrites facts read from the document."
                  checked={useAi}
                  onChange={(event) => setUseAi(event.target.checked)}
                />
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft p-3.5">
            <XCircle aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
            <div>
              <p className="text-xs font-bold text-danger">That did not work</p>
              <p className="mt-1 text-[11px] leading-relaxed text-danger/90">{error}</p>
            </div>
          </div>
        ) : null}
      </Card>

      {result ? (
        <>
          <Card>
            <CardHeader
              title="Step 2 · Review what was extracted"
              icon={<CheckCircle2 aria-hidden className="h-4 w-4" />}
              description={`${result.analysis.fileName} · ${formatBytes(result.analysis.fileSizeBytes)} · ${formatDateTime(result.analysis.createdAt)}`}
              action={
                <>
                  <SourceBadge source={result.source} reason={result.aiReason} />
                  {!applied ? (
                    <Button size="sm" onClick={applyToProfile}>
                      Apply to my profile
                    </Button>
                  ) : (
                    <Badge tone="success">Applied to profile</Badge>
                  )}
                </>
              }
            />

            {result.analysis.warnings.length ? (
              <ul className="mt-4 space-y-2">
                {result.analysis.warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-2 rounded-xl border border-caution/40 bg-caution-soft p-3 text-[11px] leading-relaxed text-caution">
                    <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Completeness', value: `${result.analysis.completeness.score}%` },
                { label: 'Words', value: result.analysis.wordCount },
                { label: 'Characters extracted', value: result.analysis.charactersExtracted },
                { label: 'Sections detected', value: result.analysis.sectionsDetected.length },
              ].map((tile) => (
                <div key={tile.label} className="rounded-xl border border-ink-600 bg-ink-850 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">{tile.label}</p>
                  <p className="mt-0.5 text-lg font-extrabold text-brand">{tile.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Progress value={result.analysis.completeness.score} label="Resume completeness" tone={result.analysis.completeness.score >= 70 ? 'success' : 'brand'} />
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {result.analysis.completeness.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-[11px]">
                    <span className={check.passed ? 'text-success' : 'text-caution'}>{check.passed ? '✓' : '○'}</span>
                    <span className={check.passed ? 'text-brand/70' : 'text-brand/60'}>{check.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Extracted profile fields" icon={<Info aria-hidden className="h-4 w-4" />} description="Each field is marked as found in the document or inferred by the parser." />
              <dl className="mt-4 space-y-3">
                {Object.entries(result.analysis.profile).map(([key, value]) => (
                  <div key={key} className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-600/40 pb-2.5 last:border-0">
                    <div className="min-w-0">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-brand/55">{key}</dt>
                      <dd className="mt-0.5 break-words text-xs text-brand/85">{value ? value.value : <span className="text-brand/40">not found</span>}</dd>
                      {value?.source ? <dd className="mt-0.5 text-[10px] text-brand/40">read from: “{value.source}”</dd> : null}
                    </div>
                    {value ? <Badge tone={value.confidence === 'found' ? 'success' : 'caution'}>{value.confidence}</Badge> : null}
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <CardHeader
                title={`Skills detected (${result.analysis.skills.length})`}
                icon={<Sparkles aria-hidden className="h-4 w-4" />}
                description="Matched against the curated technology lexicon. Proficiency is not verified — review each skill after applying."
                action={<Badge tone="neutral">{result.patch.fields.length} fields ready to apply</Badge>}
              />
              {result.analysis.skills.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {result.analysis.skills.map((skill) => (
                    <Badge key={skill.label} tone={skill.detectedVia === 'found' ? 'brand' : 'neutral'} title={`${skill.category} · mentioned ${skill.mentions}x`}>
                      {skill.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[11px] text-brand/60">
                  No recognisable technologies were found. If your CV lists tools, check the spelling or add them manually on the profile page.
                </p>
              )}
              <p className="mt-4 text-[11px] leading-relaxed text-brand/60">
                Applying will add {pluralise(result.patch.skills.length, 'skill')}, {pluralise(result.patch.experience.length, 'experience entry', 'experience entries')},{' '}
                {pluralise(result.patch.education.length, 'education entry', 'education entries')} and {pluralise(result.patch.projects.length, 'project')} to your profile. Existing
                entries with the same name are merged rather than duplicated.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowPreview((value) => !value)}>
                  {showPreview ? 'Hide document text' : 'Show extracted text'}
                </Button>
              </div>
              {showPreview ? (
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-600 bg-ink-900 p-3 font-mono text-[11px] leading-relaxed text-brand/70 scrollbar-thin">
                  {result.analysis.textPreview}
                </pre>
              ) : null}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title={`Strengths (${result.analysis.strengths.length})`} description="Observations grounded in the document." />
              <ul className="mt-3 space-y-2">
                {result.analysis.strengths.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-brand/75">
                    <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title={`Missing information (${result.analysis.missingInformation.length})`} description="Things a reviewer would expect but which were not found." />
              <ul className="mt-3 space-y-2">
                {result.analysis.missingInformation.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-brand/75">
                    <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-caution" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title={`Suggestions (${result.analysis.suggestions.length})`} description="Deterministic advice — never a fabricated metric." />
              <ul className="mt-3 space-y-2">
                {result.analysis.suggestions.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-brand/75">
                    <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/studio" className="link mt-3 inline-block text-[11px] font-semibold">
                Improve the wording in Resume Studio
              </Link>
            </Card>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader
          title="Analyses stored in this workspace"
          icon={<FileText aria-hidden className="h-4 w-4" />}
          description="Only the extracted structure is kept, never the original file. The five most recent analyses are retained."
        />
        {workspace.resumeAnalyses.length ? (
          <ul className="mt-4 space-y-2.5">
            {workspace.resumeAnalyses.map((analysis) => (
              <li key={analysis.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-850 p-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-bold text-brand">
                    {analysis.fileName}
                    {analysis.origin === 'sample' ? <Badge tone="caution">demo</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand/60">
                    {pluralise(analysis.skills.length, 'skill')} · {pluralise(analysis.experience.length, 'experience entry', 'experience entries')} ·{' '}
                    {analysis.completeness.score}% complete · {formatDateTime(analysis.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setResult({ analysis, patch: localPatch(analysis), source: 'local', retained: false })}>
                    Review again
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPendingRemoval(analysis.id)}
                    aria-label={`Remove analysis of ${analysis.fileName}`}
                    className="rounded-lg p-1.5 text-danger/80 transition-colors hover:bg-danger-soft"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No resume analysed yet"
              description="Upload a CV or paste its text above. The extracted structure is stored here so you can review it later without re-uploading anything."
            />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove this analysis?"
        message="The extracted structure for this document will be deleted from this browser. Your profile entries are not affected."
        confirmLabel="Remove analysis"
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) {
            dispatch({ type: 'remove-resume-analysis', id: pendingRemoval, activity: { kind: 'resume-analysed', message: 'Removed a stored resume analysis.' } });
            toast.info('Analysis removed');
          }
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}

/** Builds the same reviewable patch the API returns, entirely in the browser. */
function localPatch(analysis: ResumeAnalysis): ProfilePatch {
  return buildProfilePatch(analysis);
}
