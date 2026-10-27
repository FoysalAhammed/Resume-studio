import {
  makeId,
  MATCH_CONFIG,
  type CareerProfile,
  type JobDescription,
  type JobRequirement,
  type Proficiency,
  type RequirementStatus,
  type Skill,
} from '@careerlens/core';

export const FIXED_TIME = '2026-01-05T09:00:00.000Z';

export function skill(name: string, proficiency: Proficiency = 'intermediate', extras: Partial<Skill> = {}): Skill {
  return {
    id: makeId('skill', name),
    name,
    category: 'Other',
    proficiency,
    evidence: [{ source: 'self-reported', detail: `Recorded in the profile as ${proficiency}` }],
    origin: 'user',
    updatedAt: FIXED_TIME,
    ...extras,
  };
}

export function blankProfile(overrides: Partial<CareerProfile> = {}): CareerProfile {
  return {
    displayName: 'Test Candidate',
    headline: '',
    summary: '',
    email: '',
    phone: '',
    location: '',
    experienceLevel: 'entry',
    workMode: 'flexible',
    preferredTitles: [],
    preferredLocations: [],
    interests: [],
    learningGoals: [],
    weeklyLearningHours: 6,
    skills: [],
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

export function requirement(label: string, status: RequirementStatus = 'required', overrides: Partial<JobRequirement> = {}): JobRequirement {
  return {
    id: makeId('req', `${label}:${status}`),
    label,
    status,
    weight: MATCH_CONFIG.weights[status],
    emphasis: 1,
    ...overrides,
  };
}

export function advert(requirements: JobRequirement[], overrides: Partial<JobDescription> = {}): JobDescription {
  return {
    id: makeId('job', requirements.map((r) => r.id).join('|')),
    title: 'Test Role',
    company: 'Test Co',
    location: 'Remote',
    experienceLevel: 'entry',
    rawText: requirements.map((r) => r.label).join(', '),
    requirements,
    responsibilities: [],
    educationRequirement: 'Not specified',
    experienceRequirement: null,
    extraction: { method: 'rule-based', notes: [], extractedAt: FIXED_TIME },
    origin: 'user',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}
