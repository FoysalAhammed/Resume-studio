import { useState } from 'react';
import { BookOpen, ChevronDown, Clock, Flame, Target } from 'lucide-react';
import type { SkillGap } from '@careerlens/core';
import { Badge, Card, CardHeader } from '../../components/ui/primitives';
import { classNames } from '../../lib/format';

const IMPORTANCE_TONE: Record<SkillGap['importance'], 'danger' | 'caution' | 'neutral'> = {
  high: 'danger',
  medium: 'caution',
  low: 'neutral',
};

/** Read-only list, shared with the job detail page. */
export function GapList({ gaps, emptyMessage }: { gaps: SkillGap[]; emptyMessage: string }) {
  const [openId, setOpenId] = useState<string | null>(gaps[0]?.id ?? null);

  if (gaps.length === 0) {
    return (
      <p className="rounded-xl border border-success/30 bg-success-soft p-4 text-xs leading-relaxed text-success">{emptyMessage}</p>
    );
  }

  return (
    <ol className="space-y-3">
      {gaps.map((gap, index) => {
        const open = openId === gap.id;
        return (
          <li key={gap.id}>
            <Card className="p-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : gap.id)}
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-900 text-[11px] font-bold text-brand/70">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-brand">{gap.label}</span>
                      <Badge tone={IMPORTANCE_TONE[gap.importance]}>{gap.importance} priority</Badge>
                      <Badge tone={gap.status === 'required' ? 'danger' : 'neutral'}>{gap.status}</Badge>
                      {gap.category ? <Badge tone="neutral">{gap.category}</Badge> : null}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-brand/60">
                      <span className="inline-flex items-center gap-1">
                        <Clock aria-hidden className="h-3 w-3" /> about {gap.estimatedHours}h
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Flame aria-hidden className="h-3 w-3" /> internal priority {gap.priorityScore}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Target aria-hidden className="h-3 w-3" /> target {gap.targetProficiency}
                      </span>
                      <span>evidence {Math.round(gap.matchValue * 100)}%</span>
                    </span>
                  </span>
                </div>
                <ChevronDown aria-hidden className={classNames('mt-1 h-4 w-4 flex-shrink-0 text-brand/50 transition-transform', open && 'rotate-180')} />
              </button>

              {open ? (
                <div className="space-y-3 border-t border-ink-600/60 p-4">
                  <p className="text-xs leading-relaxed text-brand/80">{gap.whyItMatters}</p>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Evidence found so far</p>
                    {gap.existingEvidence.length ? (
                      <ul className="mt-1.5 space-y-1">
                        {gap.existingEvidence.map((item, evidenceIndex) => (
                          <li key={evidenceIndex} className="text-[11px] leading-relaxed text-brand/70">
                            · {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-brand/60">
                        None yet. That doesn't mean the skill is missing, just that your profile has no evidence for it.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Suggested practical task</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-brand/80">{gap.suggestedTask}</p>
                  </div>

                  {gap.resources.length ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Reference material</p>
                      <ul className="mt-1.5 space-y-1">
                        {gap.resources.map((resource) => (
                          <li key={resource.url} className="flex items-center gap-1.5 text-[11px]">
                            <BookOpen aria-hidden className="h-3 w-3 text-brand/60" />
                            <a href={resource.url} target="_blank" rel="noreferrer noopener" className="link">
                              {resource.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <p className="text-[10px] leading-relaxed text-brand/45">
                    Priority is an internal recommendation from the advert's importance and the evidence you already have. It is not
                    job-market data.
                  </p>
                </div>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

export function GapSummary({ gaps }: { gaps: SkillGap[] }) {
  const required = gaps.filter((gap) => gap.status === 'required');
  const hours = gaps.reduce((sum, gap) => sum + gap.estimatedHours, 0);
  return (
    <Card>
      <CardHeader
        title="What this means"
        description="Every number comes from the requirement matches above, all from the deterministic engine."
      />
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Open gaps', value: gaps.length },
          { label: 'Required gaps', value: required.length },
          { label: 'High priority', value: gaps.filter((gap) => gap.importance === 'high').length },
          { label: 'Focused hours', value: `${hours}h` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-ink-600 bg-ink-850 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-brand/55">{item.label}</dt>
            <dd className="mt-0.5 text-lg font-extrabold text-brand">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
