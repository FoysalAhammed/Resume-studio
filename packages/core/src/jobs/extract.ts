import type { JobDescription, JobRequirement, RequirementStatus, SkillCategory } from '../types';
import { LIMITS, MATCH_CONFIG } from '../constants';
import { findLexiconHits, resolveSkillLabel } from '../skills/graph';
import { countWords, makeId, normalizeWhitespace, splitLines, titleCase, uniqueBy } from '../util/text';

/** Heading detection for job adverts. Order matters: first match wins. */
const SECTION_RULES: { id: 'required' | 'preferred' | 'responsibilities' | 'about' | 'benefits'; patterns: RegExp[] }[] = [
  {
    id: 'preferred',
    patterns: [
      /^(nice|good|great)\s+to\s+have/i,
      /^preferred(\s+qualifications|\s+skills)?\b/i,
      /^bonus(\s+points)?\b/i,
      /^desirable\b/i,
      /^plus(es)?\b/i,
      /^advantageous\b/i,
      /^(additional|other)\s+(skills|qualifications)/i,
    ],
  },
  {
    id: 'required',
    patterns: [
      /^(minimum\s+)?(requirements?|qualifications?)\b/i,
      /^what\s+(you.?ll\s+need|we.?re\s+looking\s+for|you\s+bring)/i,
      /^(must\s+have|essential|required)\b/i,
      /^(key|core)\s+(requirements?|skills|competencies)/i,
      /^skills?\s*(and|&)\s*(experience|qualifications)/i,
      /^(your|the)\s+(profile|background|experience)\b/i,
      /^about\s+you\b/i,
    ],
  },
  {
    id: 'responsibilities',
    patterns: [
      /^(key\s+)?(responsibilities|duties)\b/i,
      /^what\s+you.?ll\s+do\b/i,
      /^(the\s+)?role\b/i,
      /^(day\s+to\s+day|your\s+day)\b/i,
      /^(you\s+will|you.?ll)\b/i,
    ],
  },
  {
    id: 'benefits',
    patterns: [/^(benefits|perks|what\s+we\s+offer|why\s+join|we\s+offer)\b/i],
  },
  {
    id: 'about',
    patterns: [
      /^about\s+(us|you|the\s+company|the\s+team|the\s+role|this\s+role|the\s+position|the\s+job|the\s+opportunity)\b/i,
      /^(company\s+overview|who\s+we\s+are)\b/i,
    ],
  },
];

type SectionId = (typeof SECTION_RULES)[number]['id'];

export interface SectionSlice {
  id: SectionId | 'unclassified';
  heading: string;
  lines: string[];
}

export function splitIntoSections(text: string): SectionSlice[] {
  const lines = splitLines(normalizeWhitespace(text)).filter((line) => line.length > 0);
  const sections: SectionSlice[] = [];
  let current: SectionSlice = { id: 'unclassified', heading: 'Introduction', lines: [] };

  for (const line of lines) {
    const bare = line.replace(/[:\-–—\s]+$/, '');
    const isShort = bare.length <= 60 && !/[.!?]$/.test(bare);
    const rule = isShort ? SECTION_RULES.find((r) => r.patterns.some((p) => p.test(bare))) : undefined;

    if (rule) {
      if (current.lines.length > 0 || current.id !== 'unclassified') sections.push(current);
      current = { id: rule.id, heading: bare, lines: [] };
      continue;
    }

    // Inline form: "Skills: React, Node.js"
    const inline = bare.match(/^([A-Za-z][A-Za-z &/]{2,30})\s*:\s*(.+)$/);
    if (inline) {
      const inlineRule = SECTION_RULES.find((r) => r.patterns.some((p) => p.test(inline[1].trim())));
      if (inlineRule) {
        if (current.lines.length > 0 || current.id !== 'unclassified') sections.push(current);
        current = { id: inlineRule.id, heading: inline[1].trim(), lines: [inline[2].trim()] };
        continue;
      }
    }

    current.lines.push(line);
  }

  sections.push(current);
  return sections.filter((section) => section.lines.length > 0 || section.id !== 'unclassified');
}

const BULLET_PREFIX = /^[\s\u2022\u25cf\u25aa\u2013\u2014*\-\u00b7\d.)\]]+/;

function stripBullet(line: string): string {
  return line.replace(BULLET_PREFIX, '').trim();
}

const PHRASE_PATTERNS = [
  /(?:experience|proficiency|proficient|expertise|knowledge|familiarity|background|skilled)\s+(?:with|in|using|of)\s+([A-Za-z0-9.+#/&\-\s]{2,60})/gi,
  /(?:working|hands.?on)\s+(?:knowledge|experience)\s+(?:with|of)\s+([A-Za-z0-9.+#/&\-\s]{2,60})/gi,
  /(?:strong|solid|good|excellent|deep)\s+([A-Za-z0-9.+#/&\-\s]{2,50}?)\s+(?:skills|knowledge|experience|understanding)/gi,
];

const PHRASE_STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'to', 'with', 'team', 'teams', 'our', 'your',
  'their', 'them', 'it', 'this', 'that', 'other', 'others', 'similar', 'related', 'relevant',
  'role', 'job', 'position', 'company', 'candidate', 'candidates', 'years', 'year', 'time',
  'ability', 'willingness', 'passion', 'desire', 'mindset', 'environment', 'problem', 'problems',
]);

function cleanPhrase(phrase: string): string {
  return phrase
    .replace(/[\s,;:.]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^(?:a|an|the|some|any)\s+/i, '')
    .trim();
}

function looksLikeSkillPhrase(phrase: string): boolean {
  const cleaned = cleanPhrase(phrase);
  if (cleaned.length < 2 || cleaned.length > 48) return false;
  const words = cleaned.toLowerCase().split(' ');
  if (words.length > 5) return false;
  if (PHRASE_STOP.has(words[0])) return false;
  if (/^(experience|skills?|knowledge|ability|years?)\b/i.test(cleaned)) return false;
  return true;
}

function emphasisFor(status: RequirementStatus, mentions: number, sentence: string): number {
  let emphasis = MATCH_CONFIG.emphasis.min;
  emphasis += Math.min(0.2, (mentions - 1) * 0.1);
  if (/\b(must|required|essential|mandatory|minimum)\b/i.test(sentence)) emphasis += 0.1;
  if (/\bcritical|key|core|strong|expert|advanced\b/i.test(sentence)) emphasis += 0.05;
  if (status === 'required') emphasis += 0.05;
  return Math.min(MATCH_CONFIG.emphasis.max, Math.round(emphasis * 100) / 100);
}

const RESPONSIBILITY_MAX = 8;
const MAX_REQUIREMENTS = 40;

export interface RequirementExtractionResult {
  requirements: JobRequirement[];
  responsibilities: string[];
  educationRequirement: string;
  experienceRequirement: { minYears: number; text: string } | null;
  notes: string[];
  sections: { id: string; heading: string; lines: number }[];
}

/** Rule-based extraction. No network, no randomness: the same advert gives the same result. */
export function extractJobRequirements(rawText: string): RequirementExtractionResult {
  const text = normalizeWhitespace(rawText).slice(0, LIMITS.maxJobTextChars);
  const sections = splitIntoSections(text);
  const notes: string[] = [];

  type Draft = { requirement: JobRequirement; sentence: string };
  const drafts: Draft[] = [];

  for (const section of sections) {
    if (section.id === 'about' || section.id === 'benefits') continue;
    const status: RequirementStatus = section.id === 'preferred' ? 'preferred' : 'required';

    for (const rawLine of section.lines) {
      const sentence = stripBullet(rawLine);
      if (sentence.length < 3) continue;

      const hits = findLexiconHits(sentence);
      for (const hit of hits) {
        drafts.push({
          sentence,
          requirement: {
            id: makeId('req', `${hit.skill.id}:${sentence.slice(0, 40)}`),
            skillId: hit.skill.id,
            label: hit.skill.name,
            category: hit.skill.category as SkillCategory,
            status,
            weight: MATCH_CONFIG.weights[status],
            emphasis: emphasisFor(status, hit.mentions, sentence),
            learnHours: hit.skill.learnHours,
          },
        });
      }

      for (const pattern of PHRASE_PATTERNS) {
        pattern.lastIndex = 0;
        let match = pattern.exec(sentence);
        while (match) {
          const phrase = cleanPhrase(match[1] ?? '');
          if (looksLikeSkillPhrase(phrase)) {
            const resolved = resolveSkillLabel(phrase);
            if (!resolved) {
              drafts.push({
                sentence,
                requirement: {
                  id: makeId('req', `${phrase.toLowerCase()}:${sentence.slice(0, 40)}`),
                  label: titleCase(phrase.length > 4 ? phrase.toLowerCase() : phrase),
                  status,
                  weight: MATCH_CONFIG.weights[status],
                  emphasis: emphasisFor(status, 1, sentence),
                  learnHours: 30,
                },
              });
            }
          }
          match = pattern.exec(sentence);
        }
      }
    }
  }

  // Merge duplicates: a requirement mentioned in both a required and a preferred
  // list stays required, and the strongest emphasis is kept.
  const merged = new Map<string, JobRequirement>();
  for (const { requirement } of drafts) {
    const key = (requirement.skillId ?? requirement.label.toLowerCase()).trim();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, requirement);
      continue;
    }
    const bestStatus: RequirementStatus = existing.status === 'required' || requirement.status === 'required' ? 'required' : 'preferred';
    merged.set(key, {
      ...existing,
      status: bestStatus,
      weight: MATCH_CONFIG.weights[bestStatus],
      emphasis: Math.max(existing.emphasis, requirement.emphasis),
      learnHours: existing.learnHours ?? requirement.learnHours,
      category: existing.category ?? requirement.category,
      skillId: existing.skillId ?? requirement.skillId,
    });
  }

  const requirements = Array.from(merged.values())
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'required' ? -1 : 1;
      const score = (r: JobRequirement) => r.weight * r.emphasis;
      return score(b) - score(a) || a.label.localeCompare(b.label);
    })
    .slice(0, MAX_REQUIREMENTS);

  const responsibilities = uniqueBy(
    sections
      .filter((s) => s.id === 'responsibilities')
      .flatMap((s) => s.lines.map(stripBullet))
      .filter((line) => line.length > 12),
    (line) => line.toLowerCase(),
  ).slice(0, RESPONSIBILITY_MAX);

  const educationMatch = text.match(
    /\b(bachelor'?s?|master'?s?|mba|phd|doctorate|b\.?s\.?c?|m\.?s\.?c?|b\.?tech|m\.?tech|diploma|degree|associate'?s?)\b[^.\n]{0,80}/i,
  );
  const educationRequirement = educationMatch ? cleanPhrase(educationMatch[0]) : 'Not specified';

  const yearsMatch = text.match(/\b(\d{1,2})\s*\+?\s*(?:to|-|–)?\s*(\d{1,2})?\s*\+?\s*years?\b/i);
  const experienceRequirement = yearsMatch
    ? { minYears: Number(yearsMatch[1]), text: cleanPhrase(yearsMatch[0]) }
    : null;

  if (requirements.length === 0) {
    notes.push('No recognisable technology keywords were found. Check that the advert text was pasted in full, or add requirements manually.');
  }
  const requiredCount = requirements.filter((r) => r.status === 'required').length;
  notes.push(`Rule-based extraction matched ${requirements.length} requirement${requirements.length === 1 ? '' : 's'} (${requiredCount} required, ${requirements.length - requiredCount} preferred) from ${countWords(text)} words.`);
  if (sections.some((s) => s.id === 'unclassified')) {
    notes.push('Some text did not sit under a recognisable heading, so it was treated as required criteria.');
  }
  notes.push('Extraction is keyword and pattern based. Review the list and correct anything that was missed or misread.');

  return {
    requirements,
    responsibilities,
    educationRequirement,
    experienceRequirement,
    notes,
    sections: sections.map((s) => ({ id: s.id, heading: s.heading, lines: s.lines.length })),
  };
}

export interface CreateJobInput {
  title?: string;
  company?: string;
  location?: string;
  experienceLevel?: JobDescription['experienceLevel'];
  sourceUrl?: string;
  rawText: string;
  /** Optional AI-refined requirement list, already validated by a schema. */
  overrideRequirements?: JobRequirement[];
}

function inferTitle(rawText: string, provided?: string): string {
  if (provided && provided.trim()) return provided.trim();
  const firstLine = splitLines(rawText).find((line) => line.trim().length > 2);
  return firstLine ? firstLine.trim().slice(0, 80) : 'Untitled role';
}

export function createJobDescription(input: CreateJobInput): JobDescription {
  const rawText = normalizeWhitespace(input.rawText).slice(0, LIMITS.maxJobTextChars);
  const extraction = extractJobRequirements(rawText);
  const now = new Date().toISOString();
  const requirements = input.overrideRequirements?.length ? input.overrideRequirements : extraction.requirements;

  return {
    id: makeId('job', `${input.title ?? ''}:${input.company ?? ''}:${rawText.slice(0, 200)}`),
    title: inferTitle(rawText, input.title),
    company: (input.company ?? '').trim() || 'Not specified',
    location: (input.location ?? '').trim() || 'Not specified',
    experienceLevel: input.experienceLevel ?? '',
    sourceUrl: input.sourceUrl?.trim() || undefined,
    rawText,
    requirements,
    responsibilities: extraction.responsibilities,
    educationRequirement: extraction.educationRequirement,
    experienceRequirement: extraction.experienceRequirement,
    extraction: {
      method: input.overrideRequirements?.length ? 'ai' : 'rule-based',
      notes: extraction.notes,
      extractedAt: now,
    },
    origin: 'user',
    createdAt: now,
    updatedAt: now,
  };
}
