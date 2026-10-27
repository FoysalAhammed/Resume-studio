import type { RoadmapPhase, SkillCategory } from '../types';

export interface TaskBlueprint {
  title: string;
  description: string;
  exercise: string;
  completionCriteria: string;
}

const CATEGORY_EXERCISES: Record<string, string> = {
  Frontend: 'Rebuild one screen of a product you use, including its loading, empty and error states.',
  Backend: 'Build a small endpoint that validates its input and returns a documented JSON response.',
  Databases: 'Model a realistic dataset and write three queries that answer a business question.',
  'Cloud & DevOps': 'Containerise or deploy a throwaway service and write down every step you took.',
  'Data & Analytics': 'Take a public dataset, clean it, and produce one chart plus a written finding.',
  'AI & Machine Learning': 'Train or apply a small model on a dataset you understand, then note what you would improve.',
  'Testing & Quality': 'Add automated tests to an existing project and deliberately break one to prove they fail.',
  Security: 'Audit an app you built against three common risks and write down the fixes you applied.',
  'Design & UX': 'Produce an artefact for a real workflow and ask two people to complete a task with it.',
  'Product & Business': 'Write a one-page artefact covering the problem, users and success measure.',
  'Marketing & Growth': 'Run a small experiment on your own portfolio or a class project and record the result.',
  'Soft Skills': 'Practise it in a structured setting: prepare a short example, deliver it, and ask for feedback.',
  'Tools & Workflow': 'Use it end to end on your own project, from first commit to merged change.',
  'Programming Languages': 'Write a small program with it that reads input, transforms it and writes output.',
  Mobile: 'Ship one screen to a device or emulator and describe the platform constraint you hit.',
};

function exerciseFor(label: string, category?: SkillCategory): string {
  const base = category ? CATEGORY_EXERCISES[category] : undefined;
  return base
    ? `Using ${label}: ${base}`
    : `Complete one focused exercise with ${label} that produces something you can show someone.`;
}

export function foundationTask(label: string, category: SkillCategory | undefined, hours: number): TaskBlueprint {
  const focus = hours > 24 ? 'the five concepts you used most' : 'the three concepts you used most';
  return {
    title: `Learn ${label} fundamentals`,
    description: `Cover the core concepts of ${label}${category ? ` (${category})` : ''} and turn your notes into interview-ready answers.`,
    exercise: `Work through the official ${label} getting-started material and write a one-page summary of ${focus}.`,
    completionCriteria: `You can complete basic ${label} tasks without following a tutorial step by step.`,
  };
}

export function practiceTask(label: string, category: SkillCategory | undefined): TaskBlueprint {
  return {
    title: `${label} practice exercise`,
    description: `Produce one concrete artefact that uses ${label}, so you can talk about it with real detail rather than listing a keyword.`,
    exercise: exerciseFor(label, category),
    completionCriteria: `You have an artefact that uses ${label} and can describe one trade-off you considered.`,
  };
}

export function portfolioTask(label: string): TaskBlueprint {
  return {
    title: `Add ${label} to a portfolio project`,
    description: `Extend an existing project so ${label} becomes defensible evidence in your profile, not just a claim.`,
    exercise: `Add one feature that genuinely needs ${label}, commit it, and rewrite the matching CV bullet to describe what you built.`,
    completionCriteria: `A repository or demo link exists and your profile records ${label} with project evidence attached.`,
  };
}

export function applicationsTasks(role: string): TaskBlueprint[] {
  return [
    {
      title: `Tailor your CV and profile for ${role}`,
      description: `Rewrite your headline, summary and top three bullets so they speak directly to the requirements of a ${role} advert.`,
      exercise: 'Run the job analyser on a real advert and align your wording with the requirement list before you apply.',
      completionCriteria: 'Your CV wording matches the language of the advert without inventing anything.',
    },
    {
      title: 'Apply to five roles and track the responses',
      description: 'Applications are a numbers game with feedback loops; track what you send so you can improve it.',
      exercise: 'Apply to five relevant roles, record the date and channel, and note any rejection reason you receive.',
      completionCriteria: 'Five applications sent and logged.',
    },
  ];
}

export const PHASE_SHARE: Record<RoadmapPhase, number> = {
  Foundation: 0.35,
  Practice: 0.4,
  Portfolio: 0.25,
  Applications: 1,
};

export const PHASE_ORDER: RoadmapPhase[] = ['Foundation', 'Practice', 'Portfolio', 'Applications'];
