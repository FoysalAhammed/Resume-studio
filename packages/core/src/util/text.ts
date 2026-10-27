/**
 * Small, dependency-free text utilities shared by extraction, matching,
 * roadmap generation and the diff viewer.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has',
  'have', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'to', 'was',
  'were', 'will', 'with', 'you', 'your', 'our', 'we', 'us', 'if', 'while',
]);

export function normalizeWhitespace(input: string): string {
  return input.replace(/\r\n?/g, '\n').replace(/[ \t\u00a0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function titleCase(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length <= 3 && word === word.toLowerCase() ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function countWords(input: string): number {
  return input.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

export function splitSentences(input: string): string[] {
  return input
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

export function splitLines(input: string): string[] {
  return input.split('\n').map((line) => line.trim());
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function keywordSet(input: string): Set<string> {
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

/** Counts how many keywords of `needle` appear inside `haystack`. */
export function keywordOverlap(needle: string, haystack: string): { matched: string[]; ratio: number } {
  const target = keywordSet(needle);
  if (target.size === 0) return { matched: [], ratio: 0 };
  const hay = keywordSet(haystack);
  const matched = Array.from(target).filter((word) => hay.has(word) || haystack.toLowerCase().includes(word));
  return { matched, ratio: matched.length / target.size };
}

/**
 * True when `needle` appears in `haystack` as a whole token sequence.
 * Prevents "Java" matching inside "JavaScript".
 */
export function containsTerm(haystack: string, needle: string): boolean {
  const escaped = escapeRegExp(needle.trim());
  if (!escaped) return false;
  const pattern = new RegExp(`(^|[^a-z0-9+#])${escaped}(?![a-z0-9+#])`, 'i');
  return pattern.test(haystack);
}

/** Counts non-overlapping occurrences of a term in a text. */
export function countTerm(haystack: string, needle: string): number {
  const escaped = escapeRegExp(needle.trim());
  if (!escaped) return 0;
  const pattern = new RegExp(`(^|[^a-z0-9+#])${escaped}(?![a-z0-9+#])`, 'gi');
  return (haystack.match(pattern) ?? []).length;
}

/** Deterministic hash - used for stable synthetic ids, never for scoring. */
export function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return h1.toString(36).padStart(7, '0').slice(0, 7);
}

export function makeId(prefix: string, seed: string): string {
  return `${prefix}_${stableHash(seed)}`;
}

/**
 * Word level diff based on the longest common subsequence. Whitespace is not a
 * token, so `same + added` always reconstructs the revised text and
 * `same + removed` always reconstructs the original.
 */
export function diffWords(original: string, revised: string): { type: 'same' | 'added' | 'removed'; value: string }[] {
  const a = original.split(/\s+/).filter(Boolean);
  const b = revised.split(/\s+/).filter(Boolean);

  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      table[i][j] = a[i - 1] === b[j - 1]
        ? table[i - 1][j - 1] + 1
        : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const out: { type: 'same' | 'added' | 'removed'; value: string }[] = [];
  // Tokens are visited back to front, so a merge must prepend to keep word order.
  const push = (type: 'same' | 'added' | 'removed', value: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.value = `${value} ${last.value}`;
    else out.push({ type, value });
  };

  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      push('same', a[i - 1]);
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      push('added', b[j - 1]);
      j -= 1;
    } else {
      push('removed', a[i - 1]);
      i -= 1;
    }
  }

  return out.reverse();
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
