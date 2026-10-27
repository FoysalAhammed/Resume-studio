import { describe, expect, it } from 'vitest';
import { computeMatch, MATCH_CONFIG, matchHasChanged } from '@careerlens/core';
import { advert, blankProfile, requirement, skill } from './helpers';

describe('matching engine', () => {
  it('is deterministic for identical inputs', () => {
    const profile = blankProfile({ skills: [skill('React'), skill('TypeScript')] });
    const job = advert([requirement('React'), requirement('Docker', 'preferred')]);

    const first = computeMatch({ profile, job });
    const second = computeMatch({ profile, job });

    expect(first.score).toBe(second.score);
    expect(first.matches).toEqual(second.matches);
  });

  it('uses a weighted requirement formula, not a fixed percentage', () => {
    const profile = blankProfile({ skills: [skill('React')] });
    const job = advert([requirement('React'), requirement('Docker')]);

    const report = computeMatch({ profile, job });
    // required weight 3 for both: (3*1 + 3*0) / 6 = 50
    expect(report.score).toBe(50);
    expect(report.matches).toHaveLength(2);
  });

  it('weights a required criterion more heavily than a preferred one', () => {
    const profile = blankProfile({ skills: [skill('React')] });
    const required = computeMatch({ profile, job: advert([requirement('React', 'required'), requirement('Docker', 'required')]) });
    const preferred = computeMatch({ profile, job: advert([requirement('React', 'required'), requirement('Docker', 'preferred')]) });

    expect(preferred.score).toBeGreaterThan(required.score);
  });

  it('awards confirmed, partial and missing statuses with explanations', () => {
    const profile = blankProfile({
      skills: [skill('React', 'advanced'), skill('JavaScript', 'advanced')],
      projects: [{
        id: 'p1',
        name: 'Dashboard',
        description: 'Built a reporting dashboard used by the operations team.',
        technologies: ['GraphQL'],
        outcomes: [],
        origin: 'user',
      }],
    });
    const job = advert([requirement('React'), requirement('TypeScript'), requirement('GraphQL'), requirement('Kubernetes')]);
    const report = computeMatch({ profile, job });

    const react = report.matches.find((match) => match.label === 'React');
    const typescript = report.matches.find((match) => match.label === 'TypeScript');
    const graphql = report.matches.find((match) => match.label === 'GraphQL');
    const kubernetes = report.matches.find((match) => match.label === 'Kubernetes');

    expect(react?.matchStatus).toBe('confirmed');
    expect(react?.matchValue).toBe(1);
    // TypeScript is related to JavaScript, so it earns partial credit only.
    expect(typescript?.matchStatus).toBe('partial');
    expect(typescript?.matchValue).toBeGreaterThan(0);
    expect(typescript?.matchValue).toBeLessThan(MATCH_CONFIG.statusThresholds.confirmed);
    // Evidence found in a project technology list.
    expect(graphql?.matchValue).toBe(MATCH_CONFIG.projectTechnology);
    expect(kubernetes?.matchStatus).toBe('missing');
    expect(kubernetes?.matchValue).toBe(0);
    expect(kubernetes?.explanation).toContain('not proof that you lack the skill');
  });

  it('marks a direct skill below the target proficiency as lower confidence', () => {
    const beginner = computeMatch({ profile: blankProfile({ skills: [skill('React', 'beginner')] }), job: advert([requirement('React')]) });
    const advanced = computeMatch({ profile: blankProfile({ skills: [skill('React', 'advanced')] }), job: advert([requirement('React')]) });

    expect(beginner.score).toBe(Math.round(MATCH_CONFIG.proficiencyScore.beginner * 100));
    expect(advanced.score).toBe(100);
  });

  it('never treats a missing keyword as proof of absence', () => {
    const report = computeMatch({ profile: blankProfile(), job: advert([requirement('Docker')]) });
    expect(report.matches[0].explanation).toContain('No evidence found');
    expect(report.nextSteps.join(' ')).toMatch(/Address the required gaps/);
  });

  it('reports zero for an empty profile and explains what to do', () => {
    const report = computeMatch({ profile: blankProfile(), job: advert([requirement('React'), requirement('SQL')]) });
    expect(report.score).toBe(0);
    expect(report.grade).toBe('Early fit');
    expect(report.nextSteps.join(' ')).toContain('record them in your career profile');
  });

  it('handles an advert with no requirements without dividing by zero', () => {
    const report = computeMatch({ profile: blankProfile({ skills: [skill('React')] }), job: advert([]) });
    expect(report.score).toBe(0);
    expect(report.counts.total).toBe(0);
    expect(report.nextSteps.join(' ')).toContain('No requirements were detected');
  });

  it('counts required criteria separately from the overall score', () => {
    const profile = blankProfile({ skills: [skill('React'), skill('Node.js')] });
    const report = computeMatch({
      profile,
      job: advert([requirement('React'), requirement('Node.js'), requirement('Docker'), requirement('Kubernetes', 'preferred')]),
    });
    expect(report.counts.requiredTotal).toBe(3);
    expect(report.counts.requiredSatisfied).toBe(2);
  });

  it('includes the engine version and the compatibility disclaimer', () => {
    const report = computeMatch({ profile: blankProfile(), job: advert([requirement('React')]) });
    expect(report.engineVersion).toBe(MATCH_CONFIG.version);
    expect(report.disclaimer).toContain('not a prediction of being hired');
  });

  it('detects when a re-run changes the outcome', () => {
    const job = advert([requirement('React')]);
    const before = computeMatch({ profile: blankProfile(), job });
    const after = computeMatch({ profile: blankProfile({ skills: [skill('React')] }), job });
    expect(matchHasChanged(before, after)).toBe(true);
    expect(matchHasChanged(after, after)).toBe(false);
  });
});
