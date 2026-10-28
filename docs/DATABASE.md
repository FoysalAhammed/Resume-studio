# Database design

## What this build actually uses

**Browser `IndexedDB`.** The whole workspace is a single JSON document stored under one key by
`apps/web/src/lib/persistence.ts`, validated with `workspaceSchema` on the way in and out. If
IndexedDB is unavailable (private browsing, storage disabled), the app keeps working in memory and
Settings says so instead of pretending to have saved anything.

This is deliberately described as **demonstration persistence**:

- it is single-device and single-browser-profile;
- it is not encrypted and not password protected;
- it has no authentication, so anyone with access to the browser profile can read it;
- the API never stores or receives the workspace.

There is **no `DATABASE_URL` requirement and no database server needed**. The API is stateless.

## The PostgreSQL + Prisma design that would replace it

The workspace entity shapes were chosen so they map cleanly onto tables. This is a design for the
next stage and it is not implemented. No Prisma schema, migration or seed script ships in
this repository, because unused database code would be dead weight.

```prisma
// Design only - not implemented in this build.

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  displayName  String
  createdAt    DateTime @default(now())
  profile      CareerProfile?
  jobs         JobDescription[]
  roadmaps     LearningRoadmap[]
  resumes      ResumeDocument[]
  drafts       DraftDocument[]
  interviews   InterviewSession[]
  activity     ActivityEvent[]
}

model CareerProfile {
  id                  String   @id @default(cuid())
  userId              String   @unique
  headline            String?
  summary             String?
  location            String?
  experienceLevel     ExperienceLevel @default(ENTRY)
  workMode            WorkMode        @default(FLEXIBLE)
  weeklyLearningHours Int             @default(6)
  updatedAt           DateTime        @updatedAt
  user                User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  skills              Skill[]
  education           EducationEntry[]
  experience          ExperienceEntry[]
  projects            ProjectEntry[]
  certifications      CertificationEntry[]
  preferredTitles     String[]
  @@index([userId])
}

enum EvidenceSource { SELF_REPORTED RESUME_DERIVED PROJECT_SUPPORTED EXPERIENCE_SUPPORTED ASSESSMENT_SUPPORTED VERIFIED }

model Skill {
  id            String   @id @default(cuid())
  profileId     String
  name          String
  category      String
  lexiconId     String?
  proficiency   Proficiency @default(INTERMEDIATE)
  origin        Origin      @default(USER)
  updatedAt     DateTime    @updatedAt
  profile       CareerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  evidence      SkillEvidence[]
  @@unique([profileId, name])   // a skill is recorded once per profile
  @@index([lexiconId])
}

model SkillEvidence {
  id        String @id @default(cuid())
  skillId   String
  source    EvidenceSource
  detail    String
  link      String?
  skill     Skill  @relation(fields: [skillId], references: [id], onDelete: Cascade)
}

model JobDescription {
  id                    String   @id @default(cuid())
  userId                String
  title                 String
  company               String?
  location              String?
  sourceUrl             String?
  rawText               String
  extractionMethod      String   // 'rule-based' | 'ai'
  educationRequirement  String?
  experienceMinYears    Int?
  createdAt             DateTime @default(now())
  user                  User @relation(fields: [userId], references: [id], onDelete: Cascade)
  requirements          JobRequirement[]
  matches               JobMatch[]
  @@index([userId, createdAt])
}

model JobRequirement {
  id          String @id @default(cuid())
  jobId       String
  skillId     String?
  label       String
  status      RequirementStatus  // REQUIRED | PREFERRED
  weight      Float
  emphasis    Float              @default(1)
  learnHours  Int?
  editedByUser Boolean           @default(false)
  job         JobDescription @relation(fields: [jobId], references: [id], onDelete: Cascade)
  @@index([jobId])
}

model JobMatch {
  id             String @id @default(cuid())
  jobId          String
  profileId      String
  engineVersion  String
  score          Int
  grade          String
  createdAt      DateTime @default(now())
  job            JobDescription @relation(fields: [jobId], references: [id], onDelete: Cascade)
  requirementMatches RequirementMatch[]
  @@unique([jobId, profileId, engineVersion])   // reproducible: one result per input+engine
  @@index([profileId])
}

model RequirementMatch {
  id            String @id @default(cuid())
  jobMatchId    String
  requirementId String
  matchValue    Float
  matchStatus   MatchStatus   // CONFIRMED | PARTIAL | INSUFFICIENT | MISSING
  explanation   String
  jobMatch      JobMatch @relation(fields: [jobMatchId], references: [id], onDelete: Cascade)
}

model LearningRoadmap {
  id            String   @id @default(cuid())
  userId        String
  jobId         String?
  targetRole    String
  weeklyHours   Int
  horizonWeeks  Int
  generationMethod String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks         LearningTask[]
  @@index([userId])
}

model LearningTask {
  id                String @id @default(cuid())
  roadmapId         String
  title             String
  description       String
  skillLabel        String?
  phase             String
  estimatedHours    Int
  priority          Int
  prerequisites     String[]
  exercise          String
  completionCriteria String
  status            TaskStatus @default(NOT_STARTED)
  notes             String?
  custom            Boolean    @default(false)
  updatedAt         DateTime   @updatedAt
  roadmap           LearningRoadmap @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  @@index([roadmapId, status])
}

model ResumeDocument {
  id           String   @id @default(cuid())
  userId       String
  fileName     String
  fileType     String
  fileSizeBytes Int
  // The extracted structure only. The original upload is never stored.
  analysis     Json
  completeness Int
  createdAt    DateTime @default(now())
  user         User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
}

model DraftDocument {
  id        String   @id @default(cuid())
  userId    String
  jobId     String?
  kind      String   // 'cover-letter' | 'resume-section'
  title     String
  body      String
  method    String
  reviewed  Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model InterviewSession {
  id         String   @id @default(cuid())
  userId     String
  role       String
  difficulty String
  questions  Json
  answers    Json
  createdAt  DateTime @default(now())
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ActivityEvent {
  id      String   @id @default(cuid())
  userId  String
  kind    String
  message String
  at      DateTime @default(now())
  user    User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, at])
}
```

### Access rules

- Every table that holds user data carries `userId` (directly or through a parent) so a query can be
  scoped server-side. Cross-user reads must be impossible by construction. Front-end filtering is not enough.
- `onDelete: Cascade` from `User` down means deleting an account removes everything it owned.
- `@@unique([profileId, name])` prevents duplicate skills. `@@unique([jobId, profileId, engineVersion])`
  reflects the deterministic nature of matching: the same inputs and engine produce one result.
- Payloads of extracted text (`ResumeDocument.analysis`) are stored as JSON because their shape is
  already validated by `resumeAnalysisSchema` before they are written.

### Migrations and seeding

A real deployment would use `prisma migrate dev` for schema changes and a `prisma/seed.ts` script that
inserts the same fictional demonstration data currently produced by
`packages/core/src/sample/workspace.ts` (candidate, three adverts, a parsed CV, a roadmap and a cover
letter draft). Nothing would change about the data itself, only where it lives.

### Migration path from the browser

1. Add Prisma + PostgreSQL, generate the models above, run the initial migration.
2. Add authentication. Every `/api` route that touches user data resolves the user server-side.
3. Replace the web app's persistence layer with API calls. The interface already exists: the
   `WorkspaceProvider` actions are the only writers, so the change is contained to one module.
4. Import existing browser workspaces with the JSON export already provided in Settings.
