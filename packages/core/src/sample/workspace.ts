import type { CareerProfile, JobDescription, LearningRoadmap, MatchReport, SkillGap, StoredProfile, Workspace } from '../types';
import { SCHEMA_VERSION } from '../types';
import { createJobDescription } from '../jobs/extract';
import { computeMatch } from '../matching/engine';
import { analyseSkillGaps } from '../gap/analyze';
import { generateRoadmap } from '../roadmap/generate';
import { analyseResumeText, buildProfilePatch, mergePatchIntoProfile } from '../resume/parse';
import { generateCoverLetter } from '../writing/coverLetter';
import { makeId, uniqueBy } from '../util/text';

/** A fixed clock so the demonstration workspace is byte-for-byte reproducible. */
export const SAMPLE_CREATED_AT = '2026-01-05T09:00:00.000Z';

export const SAMPLE_RESUME_TEXT = `AYESHA RAHMAN
Junior Frontend Developer
ayesha.rahman@example.edu | +44 7700 900123 | Manchester, United Kingdom
github.com/ayesha-rahman-example | linkedin.com/in/ayesha-rahman-example

PROFILE
Final year computer science student and part time frontend developer with two years of
hands on experience building React applications. Comfortable across the JavaScript and
TypeScript toolchain, and keen on accessible, well tested interfaces.

SKILLS
JavaScript, TypeScript, React, HTML, CSS, Tailwind CSS, Git, GitHub, REST APIs, Node.js,
Jest, Figma, responsive design, web accessibility, problem solving, teamwork

EXPERIENCE
Junior Frontend Developer - Northwind Retail Systems, Manchester
Jun 2025 - Present
- Built and maintained 14 reusable React components used across three internal dashboards.
- Reduced the dashboard bundle size by 22% by replacing a charting dependency with SVG components.
- Wrote Jest and React Testing Library tests, raising coverage on the checkout module from 45% to 78%.
- Worked with the design team in Figma to deliver an accessible checkout flow to WCAG 2.1 AA.

Software Engineering Intern - Brightpath Digital, Remote
Jul 2024 - Sep 2024
- Developed a customer feedback form in React that collected 1200 responses in its first month.
- Fixed 30 reported defects in a Node.js and Express service, including two race conditions.
- Documented the deployment steps for the team wiki, cutting onboarding questions to new starters.

PROJECTS
StudyBuddy - Collaborative revision planner
React, TypeScript and Tailwind CSS single page application with a Node.js and Express API.
Implemented scheduling logic and an offline first cache; 300 student accounts created during beta.

CampusRoute - Accessibility mapping tool
Web application that records step free routes across campus. Used Leaflet, vanilla JavaScript
and the browser Geolocation API. Won second place in the university hackathon.

EDUCATION
BSc Computer Science - University of Manchester
2022 - 2026
Predicted first class honours. Modules included algorithms, databases, web development and HCI.

CERTIFICATIONS
Responsive Web Design - freeCodeCamp, 2023
Microsoft Azure Fundamentals AZ-900 - Microsoft, 2024`;

export const SAMPLE_JOB_ONE = `JUNIOR FRONTEND ENGINEER
Northwind Labs - Manchester, United Kingdom (Hybrid)

About the role
We are looking for a junior frontend engineer to join our product team building internal
tools used by 4000 colleagues across Europe. You will work closely with designers and
backend engineers.

Requirements
- 1+ years of professional experience with JavaScript and React.
- Working knowledge of TypeScript, including interfaces and generics.
- Strong CSS skills and experience with a utility framework such as Tailwind CSS.
- Experience consuming REST APIs and handling loading and error states.
- Familiarity with Git based workflows and code review.
- Understanding of web accessibility standards (WCAG) and semantic HTML.
- Experience writing automated tests with Jest or React Testing Library.

Nice to have
- Experience with Next.js or another server side rendering framework.
- Exposure to Docker and continuous integration pipelines.
- Experience with data visualisation libraries.

We are an equal opportunities employer.`;

export const SAMPLE_JOB_TWO = `FULL STACK DEVELOPER
Brightpath Digital - Remote (United Kingdom)

What you'll do
- Design and ship features across our React frontend and Node.js services.
- Model data in PostgreSQL and write efficient SQL queries.
- Containerise services with Docker and improve our CI/CD pipelines.
- Review code and mentor two junior engineers.

Requirements
- 3+ years of experience with JavaScript or TypeScript in production.
- Strong experience with Node.js and Express.
- Solid understanding of relational databases, SQL and schema design.
- Experience with Docker and containerised deployment.
- Experience with CI/CD tooling such as GitHub Actions.
- Knowledge of authentication and authorisation patterns such as JWT and OAuth.

Preferred qualifications
- Experience with Kubernetes.
- Experience with Redis or another caching layer.
- Familiarity with AWS services.`;

export const SAMPLE_JOB_THREE = `DATA ANALYST
Cedar Insights - Leeds, United Kingdom (Onsite)

About you
You enjoy turning messy data into decisions that stakeholders can act on.

Key responsibilities
- Build and maintain SQL queries and reporting datasets.
- Produce dashboards and visualisations for non technical stakeholders.
- Clean and analyse data with Excel and Python.
- Present findings in weekly business reviews.

Requirements
- Strong SQL skills, including joins, aggregation and window functions.
- Experience with Excel and at least one of Python or R for analysis.
- Experience with a business intelligence tool such as Power BI or Tableau.
- Solid grounding in statistics and data visualisation.
- Excellent communication skills for presenting to non technical audiences.

Desirable
- Experience with ETL pipelines or Airflow.
- Experience with web analytics tools such as Google Analytics.`;

export function emptyProfile(): StoredProfile {
  return {
    displayName: '',
    headline: '',
    summary: '',
    email: '',
    phone: '',
    location: '',
    experienceLevel: 'student',
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
    updatedAt: new Date().toISOString(),
    origin: 'user',
  };
}

export function emptyWorkspace(): Workspace {
  return {
    schemaVersion: SCHEMA_VERSION,
    origin: 'user',
    profile: emptyProfile(),
    jobs: [],
    matches: [],
    roadmaps: [],
    resumeAnalyses: [],
    drafts: [],
    interviewSessions: [],
    activity: [],
    settings: { reducedMotion: false, defaultHorizonWeeks: 12 },
    updatedAt: new Date().toISOString(),
  };
}

function attachProjectEvidence(profile: CareerProfile): CareerProfile {
  return {
    ...profile,
    skills: profile.skills.map((skill) => {
      const project = profile.projects.find((item) =>
        item.technologies.some((tech) => tech.toLowerCase() === skill.name.toLowerCase()) ||
        item.description.toLowerCase().includes(skill.name.toLowerCase()),
      );
      if (!project) return skill;
      if (skill.evidence.some((item) => item.source === 'project-supported')) return skill;
      return {
        ...skill,
        evidence: [
          ...skill.evidence,
          { source: 'project-supported' as const, detail: `Used in the project "${project.name}"`, link: project.link },
        ],
      };
    }),
  };
}

export interface SampleWorkspaceResult {
  workspace: Workspace;
  primaryJob: JobDescription;
  matches: MatchReport[];
  gaps: SkillGap[];
  roadmap: LearningRoadmap;
}

export function buildSampleWorkspace(): SampleWorkspaceResult {
  const analysis = analyseResumeText(SAMPLE_RESUME_TEXT, {
    fileName: 'ayesha-rahman-sample-cv.txt',
    fileType: 'text/plain',
    fileSizeBytes: SAMPLE_RESUME_TEXT.length,
    origin: 'sample',
  });

  const patch = buildProfilePatch(analysis);
  let profile: StoredProfile = { ...mergePatchIntoProfile(emptyProfile(), patch), origin: 'sample' };
  profile = { ...attachProjectEvidence(profile), origin: 'sample' };
  profile = {
    ...profile,
    displayName: 'Ayesha Rahman',
    headline: 'Junior Frontend Developer | BSc Computer Science',
    experienceLevel: 'entry',
    workMode: 'hybrid',
    preferredTitles: ['Junior Frontend Engineer', 'Frontend Developer', 'Full Stack Developer'],
    preferredLocations: ['Manchester', 'Remote'],
    interests: ['Accessible web interfaces', 'Design systems', 'Developer tooling'],
    learningGoals: ['Become confident with TypeScript generics', 'Learn Docker and CI/CD'],
    weeklyLearningHours: 8,
    updatedAt: SAMPLE_CREATED_AT,
    origin: 'sample',
  };

  const jobInputs = [
    { raw: SAMPLE_JOB_ONE, title: 'Junior Frontend Engineer', company: 'Northwind Labs (fictional)', location: 'Manchester, UK (Hybrid)' },
    { raw: SAMPLE_JOB_TWO, title: 'Full Stack Developer', company: 'Brightpath Digital (fictional)', location: 'Remote, UK' },
    { raw: SAMPLE_JOB_THREE, title: 'Data Analyst', company: 'Cedar Insights (fictional)', location: 'Leeds, UK (Onsite)' },
  ];

  const jobs = jobInputs.map((input) => {
    const job = createJobDescription({
      title: input.title,
      company: input.company,
      location: input.location,
      rawText: input.raw,
      experienceLevel: 'entry',
    });
    return { ...job, origin: 'sample' as const, createdAt: SAMPLE_CREATED_AT, updatedAt: SAMPLE_CREATED_AT };
  });

  const matches = jobs.map((job) => ({ ...computeMatch({ profile, job }), createdAt: SAMPLE_CREATED_AT }));
  const primaryJob = jobs[0];
  const primaryMatch = matches[0];
  const gaps = analyseSkillGaps({ profile, job: primaryJob, report: primaryMatch });

  const roadmap = {
    ...generateRoadmap({
      targetRole: primaryJob.title,
      jobId: primaryJob.id,
      profile,
      gaps,
      weeklyHours: profile.weeklyLearningHours,
      horizonWeeks: 12,
    }),
    origin: 'sample' as const,
    createdAt: SAMPLE_CREATED_AT,
    updatedAt: SAMPLE_CREATED_AT,
  };

  // Mark the first foundation task as in progress so progress maths is visible.
  roadmap.tasks = roadmap.tasks.map((task, index) => (index === 0 ? { ...task, status: 'in-progress' as const } : task));

  const coverLetter = {
    ...generateCoverLetter({
      profile,
      job: primaryJob,
      motivation:
        'Northwind Labs builds tools used by thousands of colleagues internally, and I have seen first hand how much a well built internal interface affects a team\u2019s day. I would like to keep working on React and accessibility in that kind of environment while learning from engineers with more experience than me.',
      matchedSkills: primaryMatch.matches.filter((match) => match.matchValue >= 0.85).map((match) => match.label).slice(0, 5),
    }),
    createdAt: SAMPLE_CREATED_AT,
  };

  const activity = [
    { id: makeId('act', 'sample:loaded'), kind: 'sample-loaded' as const, message: 'Loaded the demonstration workspace (fictional candidate Ayesha Rahman).', at: SAMPLE_CREATED_AT },
    { id: makeId('act', 'sample:resume'), kind: 'resume-analysed' as const, message: `Parsed the sample CV: ${analysis.skills.length} skills, ${analysis.experience.length} experience entries.`, at: SAMPLE_CREATED_AT },
    { id: makeId('act', 'sample:job'), kind: 'job-analysed' as const, message: `Analysed 3 sample adverts, starting with ${primaryJob.title}.`, at: SAMPLE_CREATED_AT },
    { id: makeId('act', 'sample:match'), kind: 'match-computed' as const, message: `Compatibility with ${primaryJob.title} calculated at ${primaryMatch.score}% (engine v${primaryMatch.engineVersion}).`, at: SAMPLE_CREATED_AT },
    { id: makeId('act', 'sample:roadmap'), kind: 'roadmap-generated' as const, message: `Generated a ${roadmap.tasks.length} task learning roadmap covering ${gaps.length} gaps.`, at: SAMPLE_CREATED_AT },
  ];

  const workspace: Workspace = {
    schemaVersion: SCHEMA_VERSION,
    origin: 'sample',
    profile: { ...profile, origin: 'sample' },
    jobs,
    matches,
    roadmaps: [roadmap],
    resumeAnalyses: [analysis],
    drafts: [coverLetter],
    interviewSessions: [],
    activity,
    settings: { reducedMotion: false, defaultHorizonWeeks: 12 },
    updatedAt: SAMPLE_CREATED_AT,
  };

  return { workspace, primaryJob, matches, gaps, roadmap };
}

export function createSampleWorkspace(): Workspace {
  return buildSampleWorkspace().workspace;
}

/** All sample job texts, exposed so the UI can offer them as one-click examples. */
export const SAMPLE_JOBS: { label: string; description: string }[] = [
  { label: 'Junior Frontend Engineer', description: SAMPLE_JOB_ONE },
  { label: 'Full Stack Developer', description: SAMPLE_JOB_TWO },
  { label: 'Data Analyst', description: SAMPLE_JOB_THREE },
];

export function sampleSkillNames(profile: StoredProfile): string[] {
  return uniqueBy(profile.skills.map((skill) => skill.name), (name) => name);
}
