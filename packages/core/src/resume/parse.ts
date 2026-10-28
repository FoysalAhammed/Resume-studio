import type {
  CareerProfile,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  ExtractedField,
  ProjectEntry,
  ResumeAnalysis,
  Skill,
  SkillCategory,
} from '../types';
import { LIMITS } from '../constants';
import { findLexiconHits } from '../skills/graph';
import { countWords, makeId, normalizeWhitespace, percent, splitLines, titleCase, truncate, uniqueBy } from '../util/text';

type SectionId = 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'awards' | 'languages' | 'interests';

const SECTION_PATTERNS: { id: SectionId; label: string; patterns: RegExp[] }[] = [
  { id: 'summary', label: 'Summary', patterns: [/^(professional\s+)?(summary|profile|objective|about\s*(me)?)\b/i] },
  { id: 'experience', label: 'Experience', patterns: [/^(work\s+|professional\s+|employment\s+|relevant\s+)?(experience|history|employment)\b/i, /^(internships?)\b/i] },
  { id: 'education', label: 'Education', patterns: [/^(education|academic\s+background|qualifications)\b/i] },
  { id: 'skills', label: 'Skills', patterns: [/^(technical\s+|core\s+|key\s+|professional\s+)?(skills|competenc(y|ies)|technologies|tech\s+stack|expertise)\b/i] },
  { id: 'projects', label: 'Projects', patterns: [/^(personal\s+|academic\s+|key\s+)?(projects?|portfolio|selected\s+work)\b/i] },
  { id: 'certifications', label: 'Certifications', patterns: [/^(certifications?|licenses?|courses?|training|certificates?)\b/i] },
  { id: 'awards', label: 'Awards', patterns: [/^(awards?|honors?|achievements?|accomplishments?)\b/i] },
  { id: 'languages', label: 'Languages', patterns: [/^languages?\b/i] },
  { id: 'interests', label: 'Interests', patterns: [/^(interests|hobbies|volunteering|activities|extracurricular)\b/i] },
];

export interface DetectedSection {
  id: SectionId;
  label: string;
  heading: string;
  lines: string[];
  /** True when the heading line also carried content, e.g. "Skills: React, Node". */
  inline: boolean;
}

export function detectSections(lines: string[]): DetectedSection[] {
  const sections: DetectedSection[] = [];
  let current: DetectedSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current && current.lines[current.lines.length - 1] !== '') current.lines.push('');
      continue;
    }
    const bare = line.replace(/[:\-–—\s]+$/, '');
    const isHeadingLength = bare.length <= 48;
    const rule = isHeadingLength ? SECTION_PATTERNS.find((s) => s.patterns.some((p) => p.test(bare))) : undefined;

    if (rule) {
      current = { id: rule.id, label: rule.label, heading: bare, lines: [], inline: false };
      sections.push(current);
      continue;
    }

    if (isHeadingLength) {
      const inline = bare.match(/^([A-Za-z][A-Za-z &/]{2,28})\s*[:\-–]\s*(.+)$/);
      if (inline) {
        const inlineRule = SECTION_PATTERNS.find((s) => s.patterns.some((p) => p.test(inline[1].trim())));
        if (inlineRule) {
          current = { id: inlineRule.id, label: inlineRule.label, heading: inline[1].trim(), lines: [inline[2].trim()], inline: true };
          sections.push(current);
          continue;
        }
      }
    }

    if (current) current.lines.push(line);
  }

  return sections.filter((section) => section.lines.some((line) => line.trim().length > 0) || section.inline);
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/;
const URL_RE = /((https?:\/\/)?(www\.)?[a-z0-9-]+\.(com|dev|io|net|org|me|co|ai|app|github\.io))(\/[^\s,;)]*)?/gi;
const LOCATION_RE = /\b([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)?),\s*([A-Z]{2}|[A-Z][a-z]{3,})\b/;

const DATE_TOKEN = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s*\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4}';
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to|until)\\s*(${DATE_TOKEN}|present|current|now|ongoing)`, 'i');
const DEGREE_RE = /\b(bachelor(?:'s)?|master(?:'s)?|mba|phd|doctorate|b\.?sc|b\.?tech|b\.?e\b|m\.?sc|m\.?tech|m\.?e\b|associate(?:'s)?|diploma|higher\s+national|high\s+school|a-?levels?)\b/i;
const INSTITUTION_RE = /\b(university|college|institute|school|academy|polytechnic)\b/i;
const BULLET_RE = /^[\s\u2022\u25cf\u25aa\u2013\u2014*\-\u00b7\u25e6>]+/;
const LINK_HOSTS = ['github.com', 'linkedin.com', 'gitlab.com', 'behance.net', 'dribbble.com', 'portfolio'];

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim();
}

function isContactLine(line: string): boolean {
  return EMAIL_RE.test(line) || /linkedin\.com|github\.com|https?:\/\//i.test(line);
}

function firstMatch<T>(field: ExtractedField<T> | null): T | undefined {
  return field?.value;
}

function field<T>(value: T | undefined | null, confidence: 'found' | 'inferred', source?: string): ExtractedField<T> | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim().length === 0) return null;
  return { value, confidence, source: source ? truncate(source.trim(), 120) : undefined };
}

function detectName(lines: string[], email?: string): ExtractedField<string> | null {
  const candidates = lines.slice(0, 12);
  for (const line of candidates) {
    const clean = line.trim();
    if (!clean || clean.length > 60) continue;
    if (EMAIL_RE.test(clean) || /\d{3}/.test(clean)) continue;
    if (INSTITUTION_RE.test(clean) || SECTION_PATTERNS.some((s) => s.patterns.some((p) => p.test(clean)))) continue;
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 4) continue;
    const letters = clean.replace(/[^a-zA-Z]/g, '').length;
    if (letters / clean.length < 0.75) continue;
    if (/[.]$/.test(clean)) continue;
    return field(titleCase(clean.toLowerCase()), 'found', clean);
  }
  if (email) {
    const local = email.split('@')[0].replace(/[._\d]+/g, ' ').trim();
    if (local.length >= 3) return field(titleCase(local), 'inferred', `derived from the email address ${email}`);
  }
  return null;
}

function parseExperience(section: DetectedSection | undefined): ExperienceEntry[] {
  if (!section) return [];
  const entries: ExperienceEntry[] = [];
  let currentEntry: ExperienceEntry | null = null;
  /** CVs very often put the role on one line and the dates on the next. */
  let pendingHeader: string | null = null;

  for (const rawLine of section.lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const range = line.match(DATE_RANGE_RE);
    if (range) {
      const remainder = line.replace(DATE_RANGE_RE, '').replace(/[|,]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
      const headerSource = remainder || pendingHeader || '';
      const parts = headerSource.split(/\s+(?:at|@|[-\u2013\u2014|])\s+/i).map((part) => part.trim()).filter(Boolean);
      const current = /present|current|now|ongoing/i.test(range[2]);
      currentEntry = {
        id: makeId('exp', `${headerSource}:${range[0]}`),
        title: parts[0] ? titleCase(parts[0]) : 'Role not stated',
        company: parts[1] ?? 'Not stated',
        location: parts[2],
        startDate: range[1],
        endDate: current ? undefined : range[2],
        current,
        summary: '',
        achievements: [],
        origin: 'user',
      };
      entries.push(currentEntry);
      pendingHeader = null;
      continue;
    }

    const isBullet = BULLET_RE.test(rawLine);
    if (isBullet) {
      if (currentEntry) {
        const text = stripBullet(line);
        if (!text) continue;
        if (!currentEntry.summary) currentEntry.summary = text;
        else currentEntry.achievements.push(text);
      }
      continue;
    }

    // Plain line: either this entry's description, or the next entry's header.
    const looksLikeSentence = /[.!?]$/.test(line) || line.length > 90;
    if (currentEntry && !currentEntry.summary && looksLikeSentence) {
      currentEntry.summary = line;
      continue;
    }
    if (line.length <= 120 && /[A-Za-z]/.test(line)) pendingHeader = line;
  }

  return entries
    .map((entry) => ({
      ...entry,
      achievements: uniqueBy(entry.achievements.filter((a) => a.length > 8), (a) => a.toLowerCase()),
      summary: entry.summary || 'No description was detected for this role.',
      company: entry.company || 'Not stated',
    }))
    .slice(0, 12);
}

function parseEducation(section: DetectedSection | undefined, allLines: string[]): EducationEntry[] {
  const source = section ? section.lines : allLines;
  const entries: EducationEntry[] = [];

  for (let i = 0; i < source.length; i += 1) {
    const line = source[i]?.trim() ?? '';
    if (!line || line.length > 160) continue;
    const degreeMatch = line.match(DEGREE_RE);
    const institutionMatch = line.match(INSTITUTION_RE);
    if (!degreeMatch && !institutionMatch) continue;

    const context = [line, source[i + 1] ?? '', source[i + 2] ?? ''].join(' ').slice(0, 240);
    const years = context.match(/\b(19|20)\d{2}\b/g) ?? [];
    const institutionLine = institutionMatch ? line : source[i + 1]?.trim() ?? '';
    const degreeSource = degreeMatch ? line : source[i + 1]?.trim() ?? line;

    entries.push({
      id: makeId('edu', context.slice(0, 80)),
      institution: titleCase(institutionLine.replace(/[,|].*$/, '').trim()) || 'Not stated',
      degree: titleCase(degreeSource.replace(/[,|].*$/, '').trim()) || 'Programme not stated',
      fieldOfStudy: (degreeSource.match(/(?:in|of)\s+([A-Za-z &]{3,40})/i)?.[1] ?? '').trim() || undefined,
      startYear: years.length > 1 ? Number(years[0]) : undefined,
      endYear: years.length > 0 ? Number(years[years.length - 1]) : undefined,
      details: context.length > line.length ? truncate(context, 200) : undefined,
      origin: 'user',
    });
  }

  return uniqueBy(entries, (entry) => `${entry.institution}|${entry.degree}`.toLowerCase()).slice(0, 6);
}

function parseProjects(section: DetectedSection | undefined): ProjectEntry[] {
  if (!section) return [];
  const entries: ProjectEntry[] = [];
  let currentEntry: ProjectEntry | null = null;

  for (const rawLine of section.lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const text = stripBullet(line);
    // A non-bulleted line that is not a full sentence reads as a project title.
    const isTitleLine = !BULLET_RE.test(line) && text.length <= 72 && !/[.!]$/.test(text);

    if (isTitleLine && (!currentEntry || currentEntry.description)) {
      const link = text.match(URL_RE)?.[0];
      currentEntry = {
        id: makeId('proj', text.slice(0, 80)),
        name: titleCase(text.replace(URL_RE, '').replace(/[|–—-]\s*$/, '').trim()) || 'Project',
        description: '',
        link: link && !link.includes('linkedin.com') ? (link.startsWith('http') ? link : `https://${link}`) : undefined,
        technologies: [],
        outcomes: [],
        origin: 'user',
      };
      entries.push(currentEntry);
      continue;
    }

    if (currentEntry) {
      if (!currentEntry.description) currentEntry.description = text;
      else currentEntry.outcomes.push(text);
    }
  }

  return entries
    .map((entry) => {
      const blob = [entry.name, entry.description, ...entry.outcomes].join(' ');
      const technologies = findLexiconHits(blob).map((hit) => hit.skill.name).slice(0, 12);
      return { ...entry, technologies, description: entry.description || 'No description was detected.' };
    })
    .slice(0, 10);
}

function parseCertifications(section: DetectedSection | undefined): CertificationEntry[] {
  if (!section) return [];
  const entries: CertificationEntry[] = [];

  for (const rawLine of section.lines) {
    const text = stripBullet(rawLine);
    if (text.length < 4) continue;
    const year = text.match(/\b(19|20)\d{2}\b/)?.[0];
    const withoutYear = text.replace(/\(?\b(19|20)\d{2}\b\)?/, '').replace(/[(),]\s*$/, '');
    const parts = withoutYear.split(/\s+[–—|-]\s+|\s+by\s+|\s+from\s+/i).map((p) => p.trim()).filter(Boolean);
    entries.push({
      id: makeId('cert', text.slice(0, 80)),
      name: titleCase((parts[0] ?? text).replace(/[.]$/, '')) || 'Certification',
      issuer: parts[1] ? titleCase(parts[1]) : 'Issuer not detected',
      year: year ? Number(year) : undefined,
      origin: 'user',
    });
  }

  return uniqueBy(entries, (entry) => entry.name.toLowerCase()).slice(0, 12);
}

const SOFT_SKILL_CATEGORY: SkillCategory = 'Soft Skills';

export interface ResumeMeta {
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  origin?: 'user' | 'sample';
}

/** Parses resume text into a reviewable analysis. Nothing is invented: absent fields stay absent and are reported as missing. */
export function analyseResumeText(rawText: string, meta: ResumeMeta): ResumeAnalysis {
  const text = normalizeWhitespace(rawText).slice(0, LIMITS.maxResumeTextChars);
  const lines = splitLines(text);
  const sections = detectSections(lines);
  const byId = (id: SectionId) => sections.find((section) => section.id === id);
  const wordCount = countWords(text);

  const email = text.match(EMAIL_RE)?.[0];
  const phoneMatch = text.slice(0, 1500).match(PHONE_RE);
  const phone = phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 7 ? phoneMatch[0].trim() : undefined;
  const locationMatch = lines.slice(0, 15).join(' | ').match(LOCATION_RE);

  const name = detectName(lines, email);
  const headlineLine = lines
    .slice(0, 10)
    .map((line) => line.trim())
    .find((line) => {
      if (!line || line.length < 8 || line.length > 90) return false;
      if (isContactLine(line) || /\d{3}/.test(line)) return false;
      if (name && line.toLowerCase() === name.value.toLowerCase()) return false;
      return !SECTION_PATTERNS.some((s) => s.patterns.some((p) => p.test(line)));
    });

  const summarySection = byId('summary');
  const summaryText = summarySection
    ? summarySection.lines.map(stripBullet).filter(Boolean).join(' ').slice(0, 900)
    : '';

  const skillsSection = byId('skills');
  const skillsSource = skillsSection ? skillsSection.lines.join(' ') : '';
  const skillHits = findLexiconHits(skillsSource.length > 20 ? skillsSource : text, { minMentions: 1 })
    .filter((hit) => (skillsSource.length > 20 ? true : hit.mentions >= 2 || hit.skill.category !== SOFT_SKILL_CATEGORY));

  const skills = uniqueBy(
    skillHits.map((hit) => ({
      label: hit.skill.name,
      category: hit.skill.category as SkillCategory,
      lexiconId: hit.skill.id,
      mentions: hit.mentions,
      detectedVia: (skillsSection ? 'found' : 'inferred') as 'found' | 'inferred',
    })),
    (skill) => skill.label.toLowerCase(),
  );

  const experience = parseExperience(byId('experience'));
  const education = parseEducation(byId('education'), lines.slice(0, 40));
  const projects = parseProjects(byId('projects'));
  const certifications = parseCertifications(byId('certifications'));

  const experienceText = experience.map((e) => `${e.summary} ${e.achievements.join(' ')}`).join(' ');
  const quantified = /\b\d+\s*(%|percent|users|customers|clients|requests|ms|seconds|minutes|hours|days|weeks|k\b|m\b)/i.test(experienceText);
  const links = Array.from(new Set((text.match(URL_RE) ?? []).map((link) => link.trim()))).filter((link) =>
    LINK_HOSTS.some((host) => link.includes(host)),
  );

  const checks = [
    { label: 'Contact details present (email or phone)', passed: Boolean(email || phone) },
    { label: 'Headline or professional summary present', passed: Boolean(headlineLine || summaryText.length > 40) },
    { label: 'At least five skills detected', passed: skills.length >= 5 },
    { label: 'At least one work experience entry', passed: experience.length >= 1 },
    { label: 'Education entry present', passed: education.length >= 1 },
    { label: 'At least one project described', passed: projects.length >= 1 },
    { label: 'Quantified result in an experience bullet', passed: quantified },
    { label: 'Portfolio or profile link included', passed: links.length > 0 },
    { label: 'Length is appropriate (150-1200 words)', passed: wordCount >= 150 && wordCount <= 1200 },
  ];
  const completeness = {
    score: percent(checks.filter((check) => check.passed).length, checks.length),
    checks,
  };

  const strengths: string[] = [];
  if (skills.length >= 5) strengths.push(`${skills.length} recognised skills detected, giving the matching engine real evidence to work with.`);
  if (experience.length >= 1) strengths.push(`${experience.length} work experience entr${experience.length === 1 ? 'y' : 'ies'} with dates detected.`);
  if (projects.length >= 1) strengths.push(`${projects.length} project${projects.length === 1 ? '' : 's'} described, so your skills show up in real work.`);
  if (quantified) strengths.push('At least one experience bullet contains a measurable result.');
  if (links.length > 0) strengths.push(`Profile or portfolio links found (${links.length}).`);
  if (sections.length >= 4) strengths.push(`Clear structure: ${sections.map((s) => s.label).join(', ')}.`);

  const missingInformation: string[] = [];
  if (!email) missingInformation.push('No email address was found.');
  if (!phone) missingInformation.push('No phone number was found.');
  if (!headlineLine && summaryText.length <= 40) missingInformation.push('No professional summary or headline was detected.');
  if (skills.length < 5) missingInformation.push(`Only ${skills.length} skill${skills.length === 1 ? '' : 's'} were recognised - matching will be limited.`);
  if (experience.length === 0) missingInformation.push('No work experience entries were detected (unpaid, volunteer and university work all count).');
  if (education.length === 0) missingInformation.push('No education entry was detected.');
  if (links.length === 0) missingInformation.push('No portfolio, GitHub or LinkedIn link was found.');

  const suggestions: string[] = [];
  if (!quantified && experience.length > 0) {
    suggestions.push('Add the measurable outcome to at least one bullet. Only use numbers you can verify.');
  }
  if (!summaryText && !headlineLine) {
    suggestions.push('Add a two to three line summary at the top stating your focus and the roles you are targeting.');
  }
  if (skills.length < 8) {
    suggestions.push('List the specific tools, languages and frameworks you have used. Named technologies are what a keyword filter looks for.');
  }
  if (projects.length === 0) {
    suggestions.push('Add a projects section with the technologies used. It is the strongest evidence for a student or early-career profile.');
  }
  if (wordCount > 1200) {
    suggestions.push('The document is long. Aim for one to two pages focused on relevant experience.');
  }
  if (suggestions.length === 0) {
    suggestions.push('The structure looks complete. Tailor the wording to each advert before applying.');
  }

  const warnings: string[] = [];
  if (text.length < LIMITS.minExtractedCharacters) {
    warnings.push(
      `Only ${text.length} characters of text were extracted. If your CV is a scan or an image-based PDF, the text layer is missing and this build does not perform OCR.`,
    );
  }
  if (sections.length === 0) {
    warnings.push('No standard section headings were detected (Summary, Experience, Education, Skills, Projects). Add clear headings to improve parsing.');
  }
  if (skills.length === 0) {
    warnings.push('No recognisable technology keywords were found, so job matching will rely on the rest of your profile.');
  }

  return {
    id: makeId('resume', `${meta.fileName}:${text.length}:${wordCount}`),
    fileName: meta.fileName,
    fileType: meta.fileType,
    fileSizeBytes: meta.fileSizeBytes,
    charactersExtracted: text.length,
    wordCount,
    sectionsDetected: sections.map((section) => section.label),
    profile: {
      displayName: name,
      headline: field(headlineLine ? titleCase(headlineLine) : undefined, 'inferred', headlineLine),
      summary: field(summaryText || undefined, summarySection ? 'found' : 'inferred', summaryText.slice(0, 120)),
      email: field(email, 'found', email),
      phone: field(phone, 'found', phone),
      location: field(locationMatch?.[0], 'inferred', locationMatch?.[0]),
    },
    skills,
    education,
    experience,
    projects,
    certifications,
    strengths,
    missingInformation,
    completeness,
    suggestions,
    warnings,
    textPreview: truncate(text, 1500),
    // The original upload is never retained by the server or the browser store.
    retained: false,
    createdAt: new Date().toISOString(),
    origin: meta.origin ?? 'user',
  };
}

export interface ProfilePatch {
  fields: string[];
  displayName?: string;
  headline?: string;
  summary?: string;
  email?: string;
  phone?: string;
  location?: string;
  skills: Skill[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
}

export function buildProfilePatch(analysis: ResumeAnalysis): ProfilePatch {
  const now = new Date().toISOString();
  const patch: ProfilePatch = {
    fields: [],
    skills: [],
    education: analysis.education.map((entry) => ({ ...entry, origin: 'user' })),
    experience: analysis.experience.map((entry) => ({ ...entry, origin: 'user' })),
    projects: analysis.projects.map((entry) => ({ ...entry, origin: 'user' })),
    certifications: analysis.certifications.map((entry) => ({ ...entry, origin: 'user' })),
  };

  const name = firstMatch(analysis.profile.displayName);
  if (name) {
    patch.displayName = name;
    patch.fields.push('Display name');
  }
  const headline = firstMatch(analysis.profile.headline);
  if (headline) {
    patch.headline = headline;
    patch.fields.push('Headline');
  }
  const summary = firstMatch(analysis.profile.summary);
  if (summary && summary.length > 40) {
    patch.summary = summary;
    patch.fields.push('Summary');
  }
  const email = firstMatch(analysis.profile.email);
  if (email) {
    patch.email = email;
    patch.fields.push('Email');
  }
  const phone = firstMatch(analysis.profile.phone);
  if (phone) {
    patch.phone = phone;
    patch.fields.push('Phone');
  }
  const location = firstMatch(analysis.profile.location);
  if (location) {
    patch.location = location;
    patch.fields.push('Location');
  }

  patch.skills = analysis.skills.map((skill) => ({
    id: makeId('skill', skill.label),
    name: skill.label,
    category: skill.category,
    lexiconId: skill.lexiconId,
    proficiency: 'intermediate',
    evidence: [
      {
        source: 'resume-derived',
        detail: `Mentioned ${skill.mentions} time${skill.mentions === 1 ? '' : 's'} in your CV. Proficiency was not verified - review it.`,
      },
    ],
    origin: 'user',
    updatedAt: now,
  }));

  if (patch.skills.length) patch.fields.push(`${patch.skills.length} skills`);
  if (patch.experience.length) patch.fields.push(`${patch.experience.length} experience entries`);
  if (patch.education.length) patch.fields.push(`${patch.education.length} education entries`);
  if (patch.projects.length) patch.fields.push(`${patch.projects.length} projects`);
  if (patch.certifications.length) patch.fields.push(`${patch.certifications.length} certifications`);

  return patch;
}

export function mergePatchIntoProfile(profile: CareerProfile, patch: ProfilePatch): CareerProfile {
  const now = new Date().toISOString();
  const existingSkills = new Map(profile.skills.map((skill) => [skill.name.toLowerCase(), skill]));
  const mergedSkills = [...profile.skills];
  for (const skill of patch.skills) {
    const existing = existingSkills.get(skill.name.toLowerCase());
    if (existing) {
      existingSkills.set(skill.name.toLowerCase(), {
        ...existing,
        evidence: uniqueBy([...existing.evidence, ...skill.evidence], (item) => item.detail),
        updatedAt: now,
      });
    } else {
      mergedSkills.push(skill);
    }
  }

  return {
    ...profile,
    displayName: patch.displayName ?? profile.displayName,
    headline: patch.headline ?? profile.headline,
    summary: patch.summary ?? profile.summary,
    email: patch.email ?? profile.email,
    phone: patch.phone ?? profile.phone,
    location: patch.location ?? profile.location,
    skills: mergedSkills.map((skill) => existingSkills.get(skill.name.toLowerCase()) ?? skill),
    experience: uniqueBy([...profile.experience, ...patch.experience], (entry) => `${entry.title}|${entry.company}`.toLowerCase()),
    education: uniqueBy([...profile.education, ...patch.education], (entry) => `${entry.institution}|${entry.degree}`.toLowerCase()),
    projects: uniqueBy([...profile.projects, ...patch.projects], (entry) => entry.name.toLowerCase()),
    certifications: uniqueBy([...profile.certifications, ...patch.certifications], (entry) => entry.name.toLowerCase()),
    updatedAt: now,
  };
}
