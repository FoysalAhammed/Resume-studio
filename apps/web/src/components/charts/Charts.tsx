import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LearningRoadmap, MatchReport, Skill } from '@careerlens/core';
import { computeRoadmapProgress } from '@careerlens/core';
import { scoreTone } from '../../lib/format';

const AXIS = { stroke: 'rgba(177,212,208,0.45)', fontSize: 11 };

const TOOLTIP_STYLE = {
  backgroundColor: '#2f1d19',
  border: '1px solid #6b473d',
  borderRadius: 12,
  color: '#B1D4D0',
  fontSize: 12,
} as const;

const TONE_COLOURS: Record<string, string> = {
  success: '#7ed3a6',
  brand: '#B1D4D0',
  caution: '#f0b429',
  danger: '#f87171',
};

// SVG donut. Only ever shows a value that was actually computed.
export function ScoreRing({ score, grade, size = 132 }: { score: number; grade?: string; size?: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const colour = TONE_COLOURS[scoreTone(score)];

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 110 110" role="img" aria-label={`Compatibility score ${score} out of 100`}>
        <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(177,212,208,0.15)" strokeWidth="9" />
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="52" textAnchor="middle" fontSize="24" fontWeight="800" fill="#B1D4D0">
          {score}%
        </text>
        <text x="55" y="70" textAnchor="middle" fontSize="9" fill="rgba(177,212,208,0.7)">
          compatibility
        </text>
      </svg>
      {grade ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand/55">Verdict</p>
          <p className="text-lg font-extrabold text-brand">{grade}</p>
          <p className="mt-1 max-w-[14rem] text-[11px] leading-relaxed text-brand/60">
            An estimate of how well your profile overlaps the advert. It does not predict whether you get hired.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function MatchBreakdownChart({ report }: { report: MatchReport }) {
  const data = useMemo(
    () => [
      { name: 'Required', confirmed: 0, partial: 0, missing: 0 },
      ...buildBreakdown(report),
    ],
    [report],
  );

  if (report.counts.total === 0) return null;

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid stroke="rgba(177,212,208,0.12)" vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(177,212,208,0.06)' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#B1D4D0' }} />
          <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill={TONE_COLOURS.success} radius={[0, 0, 0, 0]} />
          <Bar dataKey="partial" name="Partial" stackId="a" fill={TONE_COLOURS.brand} />
          <Bar dataKey="missing" name="No evidence" stackId="a" fill={TONE_COLOURS.danger} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildBreakdown(report: MatchReport): { name: string; confirmed: number; partial: number; missing: number }[] {
  const required = report.matches.filter((match) => match.status === 'required');
  const preferred = report.matches.filter((match) => match.status === 'preferred');
  return [
    { name: 'All criteria', ...counts(report.matches.map((match) => match.matchStatus)) },
    { name: 'Required', ...counts(required.map((match) => match.matchStatus)) },
    { name: 'Preferred', ...counts(preferred.map((match) => match.matchStatus)) },
  ];
}

function counts(statuses: string[]): { confirmed: number; partial: number; missing: number } {
  return {
    confirmed: statuses.filter((status) => status === 'confirmed').length,
    partial: statuses.filter((status) => status === 'partial').length,
    missing: statuses.filter((status) => status === 'missing' || status === 'insufficient').length,
  };
}

export function SkillCoverageChart({ skills }: { skills: Skill[] }) {
  const data = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const skill of skills) {
      byCategory.set(skill.category, (byCategory.get(skill.category) ?? 0) + 1);
    }
    return Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [skills]);

  if (data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: Math.max(180, data.length * 34) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="rgba(177,212,208,0.12)" horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={140} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(177,212,208,0.06)' }} />
          <Bar dataKey="value" name="Skills recorded" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={TONE_COLOURS.brand} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RoadmapProgressChart({ roadmap }: { roadmap: LearningRoadmap }) {
  const data = useMemo(() => {
    const phases = ['Foundation', 'Practice', 'Portfolio', 'Applications'] as const;
    return phases
      .map((phase) => {
        const tasks = roadmap.tasks.filter((task) => task.phase === phase);
        const completed = tasks.filter((task) => task.status === 'completed').length;
        return {
          name: phase,
          completed,
          remaining: tasks.length - completed,
          percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
        };
      })
      .filter((entry) => entry.completed + entry.remaining > 0);
  }, [roadmap]);

  const progress = computeRoadmapProgress(roadmap);
  if (data.length === 0) return null;

  return (
    <div>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
            <CartesianGrid stroke="rgba(177,212,208,0.12)" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(177,212,208,0.06)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#B1D4D0' }} />
            <Bar dataKey="completed" name="Completed" stackId="a" fill={TONE_COLOURS.success} />
            <Bar dataKey="remaining" name="Outstanding" stackId="a" fill="rgba(177,212,208,0.25)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-brand/60">
        {progress.completed} of {progress.total} tasks complete ({progress.percentComplete}%). About {progress.estimatedWeeksRemaining} weeks of work remain at{' '}
        {roadmap.weeklyHours}h per week.
      </p>
    </div>
  );
}

export function CompletenessGauge({ value, label }: { value: number; label: string }) {
  const data = [{ name: label, value: Math.max(0, Math.min(100, value)), fill: TONE_COLOURS[scoreTone(value)] }];
  return (
    <div style={{ width: '100%', height: 170 }}>
      <ResponsiveContainer>
        <RadialBarChart data={data} innerRadius="70%" outerRadius="110%" startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'rgba(177,212,208,0.12)' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <p className="-mt-24 text-center text-2xl font-extrabold text-brand">{Math.round(value)}%</p>
      <p className="mt-20 text-center text-[11px] uppercase tracking-wider text-brand/60">{label}</p>
    </div>
  );
}
