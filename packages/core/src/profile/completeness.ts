import type { CareerProfile } from '../types';
import { percent } from '../util/text';

export interface CompletenessCheck {
  label: string;
  passed: boolean;
  /** What the user should do to satisfy the check. */
  hint: string;
}

export interface ProfileCompleteness {
  score: number;
  checks: CompletenessCheck[];
  /** Highest-value actions, in the order the dashboard should suggest them. */
  nextActions: string[];
}

/**
 * A plain checklist over the data the user entered.
 * It is not an employability score and is never shown as one.
 */
export function profileCompleteness(profile: CareerProfile): ProfileCompleteness {
  const checks: CompletenessCheck[] = [
    { label: 'Display name recorded', passed: profile.displayName.trim().length > 1, hint: 'Add the name you want on documents and in the app.' },
    { label: 'Professional headline added', passed: profile.headline.trim().length > 3, hint: 'A one-line headline explains what you do, for example "Junior Frontend Developer".' },
    { label: 'Summary written', passed: profile.summary.trim().length >= 60, hint: 'Write two or three lines about your focus and the roles you are targeting.' },
    { label: 'Contact details present', passed: Boolean(profile.email.trim() || profile.phone.trim()), hint: 'Add an email address or phone number so generated drafts are usable.' },
    { label: 'Location recorded', passed: profile.location.trim().length > 1, hint: 'Location helps job matching for on-site and hybrid roles.' },
    { label: 'At least 5 skills recorded', passed: profile.skills.length >= 5, hint: 'Skills are the evidence the matching engine uses. Add the tools you actually use.' },
    { label: 'Skills have evidence attached', passed: profile.skills.some((skill) => skill.evidence.length > 0), hint: 'Each skill can carry evidence such as a project, a course or work experience.' },
    { label: 'Work experience entry present', passed: profile.experience.length >= 1, hint: 'Internships, part-time work and volunteering all count.' },
    { label: 'At least one project described', passed: profile.projects.length >= 1, hint: 'A project with a technology list is the strongest evidence for early-career profiles.' },
    { label: 'Education recorded', passed: profile.education.length >= 1, hint: 'Add your degree, diploma or current programme.' },
    { label: 'Target job titles chosen', passed: profile.preferredTitles.length >= 1, hint: 'This drives the default target for matching and roadmaps.' },
    { label: 'Learning availability set', passed: profile.weeklyLearningHours > 0, hint: 'Roadmap estimates use your weekly availability.' },
  ];

  const passed = checks.filter((check) => check.passed).length;
  const score = percent(passed, checks.length);
  const nextActions = checks.filter((check) => !check.passed).slice(0, 3).map((check) => check.hint);

  return { score, checks, nextActions };
}
