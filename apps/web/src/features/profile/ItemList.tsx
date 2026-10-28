import { useState, type ReactNode } from 'react';
import { ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Textarea } from '../../components/ui/primitives';
import { ConfirmDialog } from '../../components/ui/Modal';
import { classNames } from '../../lib/format';

export interface ItemListProps<T extends { id: string }> {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  addLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  items: T[];
  createEmpty: () => T;
  renderSummary: (item: T) => ReactNode;
  renderForm: (draft: T, update: (patch: Partial<T>) => void) => ReactNode;
  onSave: (item: T) => void;
  onRemove: (item: T) => void;
  validate?: (draft: T) => string | null;
}

export function ItemList<T extends { id: string }>({
  title,
  description,
  icon,
  addLabel,
  emptyTitle,
  emptyDescription,
  items,
  createEmpty,
  renderSummary,
  renderForm,
  onSave,
  onRemove,
  validate,
}: ItemListProps<T>) {
  const [draft, setDraft] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<T | null>(null);

  const startAdd = () => {
    setError(null);
    setDraft(createEmpty());
  };

  const startEdit = (item: T) => {
    setError(null);
    setDraft({ ...item });
  };

  const commit = () => {
    if (!draft) return;
    const problem = validate?.(draft) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    onSave(draft);
    setDraft(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader
        title={title}
        icon={icon}
        description={description}
        action={
          <Button size="sm" variant="secondary" icon={<Plus aria-hidden className="h-3.5 w-3.5" />} onClick={startAdd}>
            {addLabel}
          </Button>
        }
      />

      {draft ? (
        <div className="mt-4 rounded-xl border border-brand/40 bg-ink-850 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-brand/70">
              {items.some((item) => item.id === draft.id) ? 'Edit entry' : 'New entry'}
            </p>
            <button
              type="button"
              onClick={() => setDraft(null)}
              aria-label="Cancel"
              className="rounded-lg p-1 text-brand/60 hover:bg-ink-700 hover:text-brand"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {renderForm(draft, (patch) => setDraft({ ...draft, ...patch }))}
            {error ? (
              <p className="text-[11px] font-semibold text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={commit}>
                Save entry
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {items.length === 0 && !draft ? (
        <div className="mt-4">
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Button size="sm" variant="secondary" icon={<Plus aria-hidden className="h-3.5 w-3.5" />} onClick={startAdd}>
                {addLabel}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-ink-600 bg-ink-850 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">{renderSummary(item)}</div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label="Edit entry"
                    className="rounded-lg p-1.5 text-brand/70 transition-colors hover:bg-ink-700 hover:text-brand"
                  >
                    <Pencil aria-hidden className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRemove(item)}
                    aria-label="Delete entry"
                    className="rounded-lg p-1.5 text-danger/80 transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title="Delete this entry?"
        message="This removes the entry from your saved profile. It cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) onRemove(pendingRemove);
          setPendingRemove(null);
        }}
      />
    </Card>
  );
}

export function Disclosure({ label, children, defaultOpen = false }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-xs font-semibold text-brand"
      >
        {label}
        <ChevronDown aria-hidden className={classNames('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="border-t border-ink-600 px-3.5 py-3 text-xs leading-relaxed text-brand/75">{children}</div> : null}
    </div>
  );
}

export function EvidenceList({ items }: { items: { source: string; detail: string; link?: string }[] }) {
  if (items.length === 0) return <p className="text-[11px] text-brand/50">No evidence recorded yet.</p>;
  return (
    <ul className="mt-1.5 space-y-1.5">
      {items.map((item, index) => (
        <li key={`${item.detail}-${index}`} className="flex flex-wrap items-center gap-1.5 text-[11px] text-brand/70">
          <Badge tone={item.source === 'verified' ? 'success' : item.source === 'project-supported' ? 'brand' : 'neutral'}>{item.source}</Badge>
          <span className="min-w-0 flex-1">{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}

// Parsed on blur, so a half-typed entry like "React, " isn't wiped mid-keystroke.
export function ListField({
  label,
  values,
  onCommit,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onCommit: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [text, setText] = useState(values.join(', '));
  const [focused, setFocused] = useState(false);

  const commit = () => {
    const parsed = text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 20);
    setText(parsed.join(', '));
    onCommit(parsed);
  };

  return (
    <Field label={label} hint={hint}>
      <Input
        value={focused ? text : values.join(', ')}
        onFocus={() => {
          setFocused(true);
          setText(values.join(', '));
        }}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            (event.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
      />
    </Field>
  );
}

// Keeps blank lines while the user types.
export function LinesField({
  label,
  lines,
  onChange,
  hint,
  rows = 3,
}: {
  label: string;
  lines: string[];
  onChange: (lines: string[]) => void;
  hint?: string;
  rows?: number;
}) {
  const [text, setText] = useState(lines.join('\n'));
  return (
    <Field label={label} hint={hint}>
      <Textarea
        rows={rows}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(event.target.value.split('\n'));
        }}
      />
    </Field>
  );
}
