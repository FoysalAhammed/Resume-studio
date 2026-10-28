import { useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  Briefcase,
  FolderKanban,
  GraduationCap,
  Info,
  Plus,
  Trash2,
  UserRound,
  Wrench,
} from 'lucide-react';
import {
  EXPERIENCE_LEVEL_LABELS,
  LEXICON,
  profileCompleteness,
  profileSchema,
  resolveSkillLabel,
  SKILL_CATEGORIES,
  type CertificationEntry,
  type EducationEntry,
  type ExperienceEntry,
  type ProjectEntry,
  type Proficiency,
  type Skill,
  type SkillCategory,
} from '@careerlens/core';
import { useNewId, useWorkspace } from '../../state/WorkspaceProvider';
import { useToast } from '../../components/ui/Toast';
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Progress, Select, Textarea } from '../../components/ui/primitives';
import { Disclosure, EvidenceList, ItemList, LinesField, ListField } from './ItemList';

const PROFICIENCY_OPTIONS: Proficiency[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const SUGGESTED_SKILLS = ['javascript', 'typescript', 'react', 'python', 'sql', 'nodejs', 'docker', 'git', 'figma', 'excel'];

export default function ProfilePage() {
  const { workspace, updateProfile, dispatch } = useWorkspace();
  const profile = workspace.profile;
  const toast = useToast();
  const newId = useNewId('item');

  const completeness = useMemo(() => profileCompleteness(profile), [profile]);
  const [identity, setIdentity] = useState({
    displayName: profile.displayName,
    headline: profile.headline,
    summary: profile.summary,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skillInput, setSkillInput] = useState('');
  const [skillProficiency, setSkillProficiency] = useState<Proficiency>('intermediate');

  const validateIdentity = (): boolean => {
    const candidate = { ...profile, ...identity };
    const parsed = profileSchema.safeParse(candidate);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const nextErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!nextErrors[key]) nextErrors[key] = issue.message;
    }
    setErrors(nextErrors);
    return false;
  };

  const saveIdentity = () => {
    if (!validateIdentity()) {
      toast.error('Some fields need attention', Object.values(errors)[0] ?? 'Check the highlighted fields.');
      return;
    }
    updateProfile(identity, { kind: 'profile-updated', message: 'Updated identity and summary details.' });
    toast.success('Profile saved', 'Your details were written to this browser workspace.');
  };

  const savePreferences = (patch: Record<string, unknown>) => {
    const parsed = profileSchema.safeParse({ ...profile, ...patch });
    if (!parsed.success) {
      toast.error('That value is out of range', parsed.error.issues[0]?.message ?? 'Check the field and try again.');
      return;
    }
    updateProfile(patch, { kind: 'profile-updated', message: 'Updated job preferences.' });
  };

  const addSkill = () => {
    const raw = skillInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
    let added = 0;
    for (const label of parts) {
      const resolved = resolveSkillLabel(label);
      const name = resolved?.name ?? label;
      if (profile.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) continue;
      const skill: Skill = {
        id: newId(name),
        name,
        category: (resolved?.category ?? 'Other') as SkillCategory,
        lexiconId: resolved?.id,
        proficiency: skillProficiency,
        evidence: [{ source: 'self-reported', detail: `Recorded manually as ${skillProficiency}` }],
        origin: 'user',
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'upsert-skill', skill });
      added += 1;
    }
    setSkillInput('');
    if (added > 0) {
      toast.success(`${added} skill${added === 1 ? '' : 's'} added`, 'Your changes are saved to this browser workspace.');
    } else {
      toast.info('Nothing added', 'Those skills are already in your profile.');
    }
  };

  const removeSkill = (skill: Skill) => {
    dispatch({ type: 'remove-skill', id: skill.id, activity: { kind: 'profile-updated', message: `Removed the skill ${skill.name}.` } });
    toast.info('Skill removed', `${skill.name} is no longer part of your profile.`);
  };

  const setProficiency = (skill: Skill, proficiency: Proficiency) => {
    dispatch({
      type: 'upsert-skill',
      skill: { ...skill, proficiency, updatedAt: new Date().toISOString() },
    });
  };

  const groupedSkills = useMemo(() => {
    const groups = new Map<SkillCategory, Skill[]>();
    for (const skill of profile.skills) {
      const bucket = groups.get(skill.category) ?? [];
      bucket.push(skill);
      groups.set(skill.category, bucket);
    }
    return SKILL_CATEGORIES.filter((category) => groups.has(category)).map((category) => ({ category, skills: groups.get(category)! }));
  }, [profile.skills]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Career Profile"
        description="Everything CareerLens works out comes from here. You enter it yourself, or a parsed CV suggests it for you to approve. Added skills are checked against a technology lexicon, so a related skill still earns partial credit."
        action={
          <Badge tone={completeness.score >= 80 ? 'success' : completeness.score >= 50 ? 'brand' : 'caution'}>
            {completeness.score}% complete
          </Badge>
        }
      />

      <Card>
        <CardHeader
          title="Profile completeness"
          icon={<BadgeCheck aria-hidden className="h-4 w-4" />}
          description="A checklist of what you have entered. It only measures profile data."
        />
        <div className="mt-4">
          <Progress value={completeness.score} label="Profile completeness" tone={completeness.score >= 80 ? 'success' : 'brand'} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {completeness.checks.map((check) => (
            <div key={check.label} className="flex items-start gap-2 text-[11px] leading-relaxed">
              <span className={check.passed ? 'text-success' : 'text-caution'}>{check.passed ? '✓' : '○'}</span>
              <span className={check.passed ? 'text-brand/70' : 'text-brand/60'}>
                {check.label}
                {!check.passed ? <span className="block text-brand/45">{check.hint}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Identity and summary"
          icon={<UserRound aria-hidden className="h-4 w-4" />}
          description="Used in generated documents and as your profile headline."
          action={
            <Button size="sm" onClick={saveIdentity}>
              Save changes
            </Button>
          }
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor="displayName" error={errors['displayName']}>
            <Input
              id="displayName"
              value={identity.displayName}
              maxLength={120}
              onChange={(event) => setIdentity({ ...identity, displayName: event.target.value })}
              placeholder="Ayesha Rahman"
              invalid={Boolean(errors['displayName'])}
            />
          </Field>
          <Field label="Professional headline" htmlFor="headline" error={errors['headline']}>
            <Input
              id="headline"
              value={identity.headline}
              maxLength={160}
              onChange={(event) => setIdentity({ ...identity, headline: event.target.value })}
              placeholder="Junior Frontend Developer"
            />
          </Field>
          <Field label="Email" htmlFor="email" error={errors['email']} hint="Leave empty if you would rather not store it.">
            <Input
              id="email"
              type="email"
              value={identity.email}
              maxLength={160}
              onChange={(event) => setIdentity({ ...identity, email: event.target.value })}
              invalid={Boolean(errors['email'])}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors['phone']}>
            <Input id="phone" value={identity.phone} maxLength={60} onChange={(event) => setIdentity({ ...identity, phone: event.target.value })} />
          </Field>
          <Field label="Location" htmlFor="location" error={errors['location']}>
            <Input
              id="location"
              value={identity.location}
              maxLength={160}
              onChange={(event) => setIdentity({ ...identity, location: event.target.value })}
              placeholder="Manchester, United Kingdom"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Experience level" htmlFor="experienceLevel">
              <Select
                id="experienceLevel"
                value={profile.experienceLevel}
                onChange={(event) => updateProfile({ experienceLevel: event.target.value as typeof profile.experienceLevel })}
              >
                {Object.entries(EXPERIENCE_LEVEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Work mode" htmlFor="workMode">
              <Select
                id="workMode"
                value={profile.workMode}
                onChange={(event) => updateProfile({ workMode: event.target.value as typeof profile.workMode })}
              >
                <option value="flexible">Flexible</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </Select>
            </Field>
          </div>
          <Field
            label="Professional summary"
            htmlFor="summary"
            className="sm:col-span-2"
            error={errors['summary']}
            hint="Two or three lines about what you focus on. Resume Studio can draft it from the facts you have recorded."
          >
            <Textarea
              id="summary"
              rows={3}
              maxLength={2000}
              value={identity.summary}
              onChange={(event) => setIdentity({ ...identity, summary: event.target.value })}
              placeholder="Final year computer science student working part time as a frontend developer…"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Job preferences and learning goals"
          icon={<Briefcase aria-hidden className="h-4 w-4" />}
          description="Comma separated values. These drive the default target for matching and roadmap estimates."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ListField
            label="Preferred job titles"
            hint="For example: Junior Frontend Engineer, Full Stack Developer"
            values={profile.preferredTitles}
            onCommit={(values) => savePreferences({ preferredTitles: values })}
            placeholder="Junior Frontend Engineer"
          />
          <ListField
            label="Preferred locations"
            values={profile.preferredLocations}
            onCommit={(values) => savePreferences({ preferredLocations: values })}
            placeholder="Manchester, Remote"
          />
          <ListField
            label="Career interests"
            values={profile.interests}
            onCommit={(values) => savePreferences({ interests: values })}
            placeholder="Accessible interfaces, design systems"
          />
          <ListField
            label="Learning goals"
            values={profile.learningGoals}
            onCommit={(values) => savePreferences({ learningGoals: values })}
            placeholder="Learn Docker, improve TypeScript"
          />
          <Field label="Weekly learning hours" hint="Between 0 and 80. Roadmaps use this to estimate duration.">
            <Input
              type="number"
              min={0}
              max={80}
              value={profile.weeklyLearningHours}
              onChange={(event) => savePreferences({ weeklyLearningHours: Number(event.target.value) })}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Skills"
          icon={<Wrench aria-hidden className="h-4 w-4" />}
          description="Each skill keeps the evidence behind it. Matching treats self-reported, resume-derived, project-supported and verified evidence differently."
          action={<Badge tone="neutral">{profile.skills.length} recorded</Badge>}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Add skills" hint="Separate several skills with commas. Known technologies are recognised automatically.">
            <Input
              value={skillInput}
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addSkill();
              }}
              placeholder="e.g. React, PostgreSQL, Figma"
              list="skill-suggestions"
            />
          </Field>
          <Field label="Proficiency">
            <Select value={skillProficiency} onChange={(event) => setSkillProficiency(event.target.value as Proficiency)}>
              {PROFICIENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button icon={<Plus aria-hidden className="h-4 w-4" />} onClick={addSkill}>
              Add
            </Button>
          </div>
        </div>
        <datalist id="skill-suggestions">
          {SUGGESTED_SKILLS.map((id) => {
            const entry = LEXICON.find((skill) => skill.id === id);
            return entry ? <option key={id} value={entry.name} /> : null;
          })}
        </datalist>

        {profile.skills.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-ink-600 bg-ink-850/60 p-4 text-xs text-brand/60">
            No skills yet. Matching has nothing to work with until you add a few, or apply a parsed CV.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {groupedSkills.map((group) => (
              <div key={group.category}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand/55">
                  {group.category} · {group.skills.length}
                </h3>
                <ul className="space-y-2">
                  {group.skills.map((skill) => (
                    <li key={skill.id} className="rounded-xl border border-ink-600 bg-ink-850 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-brand">{skill.name}</span>
                          {skill.origin === 'sample' ? <Badge tone="caution">demo</Badge> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            aria-label={`Proficiency for ${skill.name}`}
                            className="w-36 py-1.5 text-xs"
                            value={skill.proficiency}
                            onChange={(event) => setProficiency(skill, event.target.value as Proficiency)}
                          >
                            {PROFICIENCY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            aria-label={`Remove ${skill.name}`}
                            className="rounded-lg p-1.5 text-danger/80 transition-colors hover:bg-danger-soft"
                          >
                            <Trash2 aria-hidden className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <EvidenceList items={skill.evidence} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ItemList<ExperienceEntry>
        title="Work experience"
        icon={<Briefcase aria-hidden className="h-4 w-4" />}
        description="Internships, part-time jobs, volunteering and freelance work all count as experience."
        addLabel="Add experience"
        emptyTitle="No experience recorded"
        emptyDescription="Experience entries give the matching engine more to work with than a skills list. Unpaid or academic work counts too."
        items={profile.experience}
        createEmpty={() => ({
          id: newId('experience'),
          title: '',
          company: '',
          location: '',
          startDate: '',
          endDate: '',
          current: false,
          summary: '',
          achievements: [],
          origin: 'user',
        })}
        validate={(draft) => (draft.title.trim() && draft.company.trim() ? null : 'A job title and company are required.')}
        renderSummary={(item) => (
          <div>
            <p className="text-xs font-bold text-brand">
              {item.title} · <span className="font-semibold text-brand/80">{item.company}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-brand/60">
              {item.startDate} – {item.current ? 'Present' : item.endDate || '—'}
            </p>
            {item.summary ? <p className="mt-1 text-[11px] leading-relaxed text-brand/70">{item.summary}</p> : null}
            {item.achievements.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-brand/70">
                {item.achievements.map((achievement, index) => (
                  <li key={index}>{achievement}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        renderForm={(draft, update) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Job title">
                <Input value={draft.title} onChange={(event) => update({ title: event.target.value })} />
              </Field>
              <Field label="Company">
                <Input value={draft.company} onChange={(event) => update({ company: event.target.value })} />
              </Field>
              <Field label="Location">
                <Input value={draft.location ?? ''} onChange={(event) => update({ location: event.target.value })} />
              </Field>
              <Field label="Start date" hint="Free text, for example Jun 2025">
                <Input value={draft.startDate} onChange={(event) => update({ startDate: event.target.value })} />
              </Field>
              <Field label="End date">
                <Input value={draft.endDate ?? ''} onChange={(event) => update({ endDate: event.target.value })} disabled={draft.current} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-brand/75">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={draft.current}
                onChange={(event) => update({ current: event.target.checked })}
              />
              I currently work here
            </label>
            <Field label="Summary">
              <Textarea rows={2} value={draft.summary} onChange={(event) => update({ summary: event.target.value })} />
            </Field>
            <LinesField
              label="Achievements"
              hint="One per line. Avoid numbers you can't verify. Resume Studio will ask instead of inventing them."
              lines={draft.achievements}
              onChange={(lines) => update({ achievements: lines })}
              rows={3}
            />
          </>
        )}
        onSave={(item) => {
          const cleaned = { ...item, achievements: item.achievements.map((line) => line.trim()).filter(Boolean) };
          dispatch({ type: 'upsert-collection', collection: 'experience', item: cleaned, activity: { kind: 'profile-updated', message: `Saved experience: ${cleaned.title}.` } });
          toast.success('Experience saved');
        }}
        onRemove={(item) => {
          dispatch({ type: 'remove-collection-item', collection: 'experience', id: item.id, activity: { kind: 'profile-updated', message: `Removed experience: ${item.title}.` } });
          toast.info('Experience removed');
        }}
      />

      <ItemList<EducationEntry>
        title="Education"
        icon={<GraduationCap aria-hidden className="h-4 w-4" />}
        addLabel="Add education"
        emptyTitle="No education recorded"
        emptyDescription="Add your degree, diploma or current programme so the analyser can score education requirements."
        items={profile.education}
        createEmpty={() => ({ id: newId('education'), institution: '', degree: '', fieldOfStudy: '', details: '', origin: 'user' })}
        validate={(draft) => (draft.institution.trim() && draft.degree.trim() ? null : 'Institution and programme are required.')}
        renderSummary={(item) => (
          <div>
            <p className="text-xs font-bold text-brand">{item.degree}</p>
            <p className="mt-0.5 text-[11px] text-brand/70">{item.institution}</p>
            {item.startYear || item.endYear ? (
              <p className="mt-0.5 text-[11px] text-brand/55">
                {[item.startYear, item.endYear].filter(Boolean).join(' – ')}
              </p>
            ) : null}
          </div>
        )}
        renderForm={(draft, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Institution">
              <Input value={draft.institution} onChange={(event) => update({ institution: event.target.value })} />
            </Field>
            <Field label="Degree or programme">
              <Input value={draft.degree} onChange={(event) => update({ degree: event.target.value })} />
            </Field>
            <Field label="Field of study">
              <Input value={draft.fieldOfStudy ?? ''} onChange={(event) => update({ fieldOfStudy: event.target.value })} />
            </Field>
            <Field label="Grade">
              <Input value={draft.grade ?? ''} onChange={(event) => update({ grade: event.target.value })} />
            </Field>
            <Field label="Start year">
              <Input
                type="number"
                value={draft.startYear ?? ''}
                onChange={(event) => update({ startYear: event.target.value ? Number(event.target.value) : undefined })}
              />
            </Field>
            <Field label="End year">
              <Input
                type="number"
                value={draft.endYear ?? ''}
                onChange={(event) => update({ endYear: event.target.value ? Number(event.target.value) : undefined })}
              />
            </Field>
          </div>
        )}
        onSave={(item) => {
          dispatch({ type: 'upsert-collection', collection: 'education', item, activity: { kind: 'profile-updated', message: `Saved education: ${item.degree}.` } });
          toast.success('Education saved');
        }}
        onRemove={(item) => {
          dispatch({ type: 'remove-collection-item', collection: 'education', id: item.id, activity: { kind: 'profile-updated', message: `Removed education: ${item.degree}.` } });
          toast.info('Education removed');
        }}
      />

      <ItemList<ProjectEntry>
        title="Projects"
        icon={<FolderKanban aria-hidden className="h-4 w-4" />}
        description="Projects are the strongest evidence for early-career profiles. They show a skill in action instead of just claiming it."
        addLabel="Add project"
        emptyTitle="No projects recorded"
        emptyDescription="Add a project with the technologies you actually used. Matching weights project-backed evidence more than a bare skill listing."
        items={profile.projects}
        createEmpty={() => ({ id: newId('project'), name: '', description: '', link: '', technologies: [], outcomes: [], origin: 'user' })}
        validate={(draft) => (draft.name.trim() ? null : 'A project name is required.')}
        renderSummary={(item) => (
          <div>
            <p className="text-xs font-bold text-brand">{item.name}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-brand/70">{item.description}</p>
            {item.technologies.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.technologies.map((tech) => (
                  <Badge key={tech} tone="brand">
                    {tech}
                  </Badge>
                ))}
              </div>
            ) : null}
            {item.link ? (
              <a href={item.link} target="_blank" rel="noreferrer noopener" className="link mt-1.5 inline-block text-[11px]">
                {item.link}
              </a>
            ) : null}
          </div>
        )}
        renderForm={(draft, update) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project name">
                <Input value={draft.name} onChange={(event) => update({ name: event.target.value })} />
              </Field>
              <Field label="Repository or demo link">
                <Input value={draft.link ?? ''} onChange={(event) => update({ link: event.target.value })} placeholder="https://github.com/…" />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={2} value={draft.description} onChange={(event) => update({ description: event.target.value })} />
            </Field>
            <ListField
              key={draft.id}
              label="Technologies"
              hint="Comma separated. These are matched literally against advert requirements."
              values={draft.technologies}
              onCommit={(values) => update({ technologies: values })}
              placeholder="React, TypeScript, Tailwind CSS"
            />
          </>
        )}
        onSave={(item) => {
          dispatch({ type: 'upsert-collection', collection: 'projects', item, activity: { kind: 'profile-updated', message: `Saved project: ${item.name}.` } });
          toast.success('Project saved');
        }}
        onRemove={(item) => {
          dispatch({ type: 'remove-collection-item', collection: 'projects', id: item.id, activity: { kind: 'profile-updated', message: `Removed project: ${item.name}.` } });
          toast.info('Project removed');
        }}
      />

      <ItemList<CertificationEntry>
        title="Certifications"
        icon={<Award aria-hidden className="h-4 w-4" />}
        addLabel="Add certification"
        emptyTitle="No certifications recorded"
        emptyDescription="Courses and certificates count as evidence, but they are only marked verified when a source is recorded."
        items={profile.certifications}
        createEmpty={() => ({ id: newId('certification'), name: '', issuer: '', origin: 'user' })}
        validate={(draft) => (draft.name.trim() && draft.issuer.trim() ? null : 'A name and issuer are required.')}
        renderSummary={(item) => (
          <div>
            <p className="text-xs font-bold text-brand">{item.name}</p>
            <p className="mt-0.5 text-[11px] text-brand/70">
              {item.issuer}
              {item.year ? ` · ${item.year}` : ''}
            </p>
          </div>
        )}
        renderForm={(draft, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Certification name">
              <Input value={draft.name} onChange={(event) => update({ name: event.target.value })} />
            </Field>
            <Field label="Issuer">
              <Input value={draft.issuer} onChange={(event) => update({ issuer: event.target.value })} />
            </Field>
            <Field label="Year">
              <Input
                type="number"
                value={draft.year ?? ''}
                onChange={(event) => update({ year: event.target.value ? Number(event.target.value) : undefined })}
              />
            </Field>
            <Field label="Credential ID">
              <Input value={draft.credentialId ?? ''} onChange={(event) => update({ credentialId: event.target.value })} />
            </Field>
          </div>
        )}
        onSave={(item) => {
          dispatch({ type: 'upsert-collection', collection: 'certifications', item, activity: { kind: 'profile-updated', message: `Saved certification: ${item.name}.` } });
          toast.success('Certification saved');
        }}
        onRemove={(item) => {
          dispatch({ type: 'remove-collection-item', collection: 'certifications', id: item.id, activity: { kind: 'profile-updated', message: `Removed certification: ${item.name}.` } });
          toast.info('Certification removed');
        }}
      />

      <Card>
        <CardHeader
          title="How this profile is used"
          icon={<Info aria-hidden className="h-4 w-4" />}
          description="Where your data goes."
        />
        <div className="mt-4 space-y-2">
          <Disclosure label="Where is this data stored?" defaultOpen>
            It is saved in this browser with IndexedDB. The API server never receives or stores your profile: it only sees the payload a feature needs,
            like a job advert or a short skill list from the extension preview. Browser storage is for demonstration, not secure production storage. See
            docs/DATABASE.md for the PostgreSQL design that would replace it.
          </Disclosure>
          <Disclosure label="How does matching use these skills?">
            <p>
              Each advert requirement is scored from 0 to 1 against the evidence recorded here. A skill at the expected level counts fully, a related
              skill earns partial credit, and a project or work example supports it. A missing keyword is never treated as proof you lack the skill, so a
              gap always shows as “no evidence found”.
            </p>
          </Disclosure>
          <Disclosure label="What is a sample profile?">
            <p>
              The demo workspace has a fictional candidate, labelled as such throughout. Loading it never mixes with your own data, and choosing
              “Start empty” removes it completely.
            </p>
          </Disclosure>
        </div>
      </Card>
    </div>
  );
}
