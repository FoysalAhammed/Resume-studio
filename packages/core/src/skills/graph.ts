import type { SkillCategory } from '../types';
import { LEXICON, LEXICON_BY_ID, type LexiconSkill } from './lexicon';
import { containsTerm, countTerm, normalizeWhitespace } from '../util/text';

export interface LexiconHit {
  skill: LexiconSkill;
  mentions: number;
  matchedAs: string;
}

/** Longest-alias-first ordering keeps "React Native" from matching as "React". */
const SEARCHABLE = LEXICON.flatMap((skill) =>
  [skill.name, ...(skill.aliases ?? [])].map((term) => ({ skill, term, lower: term.toLowerCase() })),
).sort((a, b) => b.term.length - a.term.length);

const LABEL_INDEX = new Map<string, LexiconSkill>();
for (const skill of LEXICON) {
  LABEL_INDEX.set(skill.name.toLowerCase(), skill);
  for (const alias of skill.aliases ?? []) LABEL_INDEX.set(alias.toLowerCase(), skill);
}

export function resolveSkillLabel(label: string): LexiconSkill | undefined {
  const cleaned = label.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned) return undefined;
  const direct = LABEL_INDEX.get(cleaned);
  if (direct) return direct;
  for (const [key, skill] of LABEL_INDEX) {
    if (cleaned === key) return skill;
    if (cleaned.length >= 3 && containsTerm(cleaned, key)) return skill;
  }
  return undefined;
}

/** Finds every lexicon skill mentioned. Mentions are counted for emphasis. */
export function findLexiconHits(text: string, options: { minMentions?: number } = {}): LexiconHit[] {
  const haystack = normalizeWhitespace(text);
  if (!haystack) return [];
  const hits = new Map<string, LexiconHit>();

  for (const entry of SEARCHABLE) {
    const mentions = countTerm(haystack, entry.term);
    if (mentions === 0) continue;
    const existing = hits.get(entry.skill.id);
    if (existing) {
      if (mentions > existing.mentions) {
        existing.mentions = mentions;
        existing.matchedAs = entry.term;
      }
      continue;
    }
    hits.set(entry.skill.id, { skill: entry.skill, mentions, matchedAs: entry.term });
  }

  const min = options.minMentions ?? 1;
  return Array.from(hits.values())
    .filter((hit) => hit.mentions >= min)
    .sort((a, b) => b.mentions - a.mentions || a.skill.name.localeCompare(b.skill.name));
}

export function findLexiconSkills(text: string): LexiconSkill[] {
  return findLexiconHits(text).map((hit) => hit.skill);
}

export interface RelatedSkill {
  skill: LexiconSkill;
  /** 0-1 closeness. */
  weight: number;
  reason: string;
}

const RELATED_CACHE = new Map<string, RelatedSkill[]>();

/** Curated cross-discipline links plus same-category neighbours at a low weight. */
export function getRelatedSkills(skillId: string): RelatedSkill[] {
  const cached = RELATED_CACHE.get(skillId);
  if (cached) return cached;

  const skill = LEXICON_BY_ID.get(skillId);
  if (!skill) return [];

  const results = new Map<string, RelatedSkill>();

  for (const link of skill.related ?? []) {
    const target = LEXICON_BY_ID.get(link.id);
    if (!target || target.id === skill.id) continue;
    results.set(target.id, { skill: target, weight: link.weight, reason: `curated relation: ${skill.name} \u2192 ${target.name}` });
  }

  for (const peer of LEXICON) {
    if (peer.id === skill.id || peer.category !== skill.category) continue;
    if (results.has(peer.id)) continue;
    results.set(peer.id, { skill: peer, weight: 0.3, reason: `same category: ${skill.category}` });
  }

  const out = Array.from(results.values()).sort((a, b) => b.weight - a.weight);
  RELATED_CACHE.set(skillId, out);
  return out;
}

export function categoryOf(label: string): SkillCategory | undefined {
  return resolveSkillLabel(label)?.category;
}

export function learnHoursFor(label: string, fallback = 30): number {
  return resolveSkillLabel(label)?.learnHours ?? fallback;
}

export function resourcesFor(label: string): { label: string; url: string }[] {
  return resolveSkillLabel(label)?.resources ?? [];
}

export const SKILL_CATEGORIES: SkillCategory[] = Array.from(new Set(LEXICON.map((s) => s.category))).sort() as SkillCategory[];
