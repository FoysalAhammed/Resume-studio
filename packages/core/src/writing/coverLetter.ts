import type { CareerProfile, DraftDocument, JobDescription } from '../types';
import { makeId } from '../util/text';

export interface CoverLetterInput {
  profile: CareerProfile;
  job: Pick<JobDescription, 'id' | 'title' | 'company' | 'requirements' | 'location'>;
  /** The user's own reasons for applying - required for a credible letter. */
  motivation: string;
  /** When true the letter names the top open gap and how it is being closed. */
  addressGap?: boolean;
  /** Matched skill labels, already computed by the matching engine. */
  matchedSkills?: string[];
}

const MOTIVATION_PLACEHOLDER =
  '[Add one or two sentences about why this company and this role interest you - a specific product, project or team.]';

/**
 * Deterministic cover-letter draft built only from recorded profile facts.
 * Unverifiable claims are never inserted: missing information becomes a
 * bracketed instruction for the user instead.
 */
export function generateCoverLetter(input: CoverLetterInput): DraftDocument {
  const { profile, job, motivation } = input;
  const notes: string[] = [];

  const matched = (input.matchedSkills?.length
    ? input.matchedSkills
    : job.requirements
        .filter((requirement) => requirement.skillId && profile.skills.some((skill) => skill.lexiconId === requirement.skillId))
        .map((requirement) => requirement.label)
  ).slice(0, 5);

  const project = profile.projects[0];
  const experience = profile.experience[0];
  const education = profile.education[0];
  const role = job.title || 'the advertised role';

  const paragraphs: string[] = [];

  paragraphs.push(`Dear Hiring Manager,`);
  paragraphs.push(
    `I am applying for the ${role} position at ${job.company || 'your organisation'}.` +
      (profile.headline ? ` ${profile.headline}.` : ''),
  );

  const opening: string[] = [];
  if (experience) {
    opening.push(`I have most recently worked as ${experience.title} at ${experience.company}${experience.summary ? `, where ${lowerFirst(experience.summary.replace(/\.$/, ''))}` : ''}.`);
  } else if (education) {
    opening.push(`I am currently completing ${education.degree}${education.fieldOfStudy ? ` in ${education.fieldOfStudy}` : ''} at ${education.institution}.`);
  } else {
    opening.push('My background is summarised in the attached CV.');
    notes.push('No experience or education was recorded, so the opening paragraph falls back to a generic sentence. Add your history to strengthen it.');
  }
  paragraphs.push(opening.join(' '));

  if (matched.length) {
    paragraphs.push(
      `Your advert lists ${matched.join(', ')}${matched.length === 1 ? '' : ' among its requirements'}. These are areas I have recorded experience in${project ? `, most recently through ${project.name}` : ''}. ${project?.description ? `That project involved ${lowerFirst(project.description.replace(/\.$/, ''))}.` : ''}`.trim(),
    );
  } else {
    paragraphs.push('My attached CV sets out my experience; I would welcome the chance to discuss how it maps to your requirements.');
    notes.push('No requirement keywords matched your recorded skills, so the middle paragraph is deliberately general.');
  }

  paragraphs.push(motivation.trim() || MOTIVATION_PLACEHOLDER);
  if (!motivation.trim()) notes.push('The motivation paragraph is a placeholder - replace it with your own reasons before sending.');

  if (input.addressGap) {
    paragraphs.push('I am currently strengthening the areas your advert identifies as gaps and would be glad to discuss my progress on them.');
    notes.push('A gap paragraph was added because you asked to address gaps explicitly.');
  }

  paragraphs.push('Thank you for taking the time to consider my application. I would welcome the opportunity to discuss the role further.');
  paragraphs.push('Yours sincerely,');
  paragraphs.push(`${profile.displayName || '[Your name]'}`);

  const body = [
    ...(profile.displayName ? [profile.displayName, profile.headline].filter(Boolean) as string[] : []),
    ...([profile.email, profile.phone, profile.location].filter(Boolean).length
      ? [[profile.email, profile.phone, profile.location].filter(Boolean).join(' | ')]
      : []),
    '',
    ...paragraphs,
    '',
    '---',
    'Draft generated from your saved CareerLens profile. Review every statement before sending.',
  ].join('\n');

  return {
    id: makeId('draft', `cover:${profile.updatedAt}:${job.id}:${motivation.slice(0, 40)}`),
    kind: 'cover-letter',
    title: `Cover letter - ${role}${job.company ? ` at ${job.company}` : ''}`,
    body,
    jobId: job.id,
    generated: {
      method: 'deterministic-template',
      notes: [
        'Built from verified profile fields only: no qualification, metric or employer was invented.',
        ...notes,
      ],
    },
    reviewed: false,
    createdAt: new Date().toISOString(),
  };
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

export function coverLetterChecklist(): string[] {
  return [
    'Replace the placeholder motivation paragraph with something specific to the company.',
    'Confirm every technology named in the letter appears in your CV.',
    'Check the role title and company name match the advert exactly.',
    'Remove the "draft generated" footer before sending.',
  ];
}
