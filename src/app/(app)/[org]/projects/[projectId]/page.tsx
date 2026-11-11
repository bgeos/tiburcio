import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Archive, CalendarClock, CalendarRange, ChartGantt, ClipboardCheck, Flag, Hourglass, OctagonAlert, Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { HistoryList } from "@/components/history-list";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { ProgressDonut } from "@/components/progress-donut";
import { StatusBadge } from "@/components/status-badge";
import { SubprojectDot } from "@/components/subproject-color";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listActivity } from "@/lib/dal/activity";
import { listMilestones } from "@/lib/dal/milestones";
import { requireMembership } from "@/lib/dal/organizations";
import { getProjectDetail, type ProjectDetail, type SubprojectView } from "@/lib/dal/project-detail";
import {
  milestoneMissMessage,
  milestoneMissWindows,
  milestoneMisses,
  milestonesOnTimeline,
  type MilestoneMiss,
} from "@/lib/domain/milestones";
import { rollupProgress } from "@/lib/domain/progress";
import { overlapMessage, overlapWindows, overlapsFor, schedulesFor } from "@/lib/domain/project-plan";
import { PROJECT_STATUS_CATEGORY, PROJECT_STATUS_LABELS, canEditProjects } from "@/lib/domain/projects";
import { taskOverlapMessage, taskOverlapWindows, taskOverlaps, taskPlace, type TaskOverlap } from "@/lib/domain/task-links";
import { daysBetween, type Overlap } from "@/lib/domain/schedule";
import { countFlags } from "@/lib/domain/task-flags";
import { todayIn } from "@/lib/dates";
import { formatDate, formatRange, pluralDays } from "@/lib/format";
import { ProjectFormDialog } from "../project-form-dialog";
import { ArchiveSubprojectButton } from "./archive-subproject-button";
import { DependenciesSection } from "./dependencies-section";
import { LockPlanButton } from "./lock-plan-button";
import { SubprojectFormDialog } from "./subproject-form-dialog";

export const metadata: Metadata = { title: "Project" };

type Params = PageProps<"/[org]/projects/[projectId]">["params"];

export default function ProjectPage({ params }: PageProps<"/[org]/projects/[projectId]">) {
  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <OrgLink href="/projects">
          <ArrowLeft aria-hidden="true" /> Projects
        </OrgLink>
      </Button>
      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectContent params={params} />
      </Suspense>
    </>
  );
}

async function ProjectContent({ params }: { params: Params }) {
  const { org: slug, projectId } = await params;
  const org = await requireMembership(slug);
  const project = await getProjectDetail(org, projectId);
  if (!project) notFound();
  // Only after the project is known to exist: a malformed id must be a 404, not a query error.
  const history = await listActivity(org, project.id, { limit: 10 });

  const canEdit = canEditProjects(org.role);
  const plan = project.subprojects;
  const schedules = schedulesFor(plan);
  const overlaps = overlapsFor(plan, project.dependencies);
  // Task links all touch this project (the other end may be in another project).
  const linkOverlaps = taskOverlaps(project.taskLinks);
  const milestones = await listMilestones(org);
  const misses = milestoneMisses(project.milestoneLinks);
  const allTasks = plan.flatMap((s) => s.tasks);
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const baseline = project.baseline?.ranges ?? {};
  const delayed = plan.filter((s) => {
    const end = schedules[s.id].end;
    return baseline[s.id] && end && daysBetween(baseline[s.id].end, end) > 0;
  }).length;
  const name = (id: string) => plan.find((s) => s.id === id)?.name ?? "—";
  // "Today" in the organization's timezone (request time; the page is dynamic).
  const today = todayIn(org.timezone);
  const flagged = (subs: typeof plan) =>
    countFlags(
      subs.flatMap((s) => s.tasks.map((t, i) => ({ id: t.id, status: t.status, range: schedules[s.id].tasks[i] ?? null }))),
      project.taskLinks,
      today,
    );
  const attention = flagged(plan);
  const ends = plan.flatMap((s) => (schedules[s.id].end ? [{ start: schedules[s.id].start, end: schedules[s.id].end! }] : []));
  const projectRange = ends.length
    ? { start: ends.map((r) => r.start).sort()[0], end: ends.map((r) => r.end).sort().at(-1)! }
    : null;

  return (
    <>
      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge category={PROJECT_STATUS_CATEGORY[project.status]} label={PROJECT_STATUS_LABELS[project.status]} />
            {project.description ? <span>{project.description}</span> : null}
            <span>
              · {project.baseline ? `Plan locked on ${formatDate(project.baseline.lockedAt.slice(0, 10))}` : "Plan not locked yet"}
            </span>
          </span>
        }
        actions={
          <>
            {plan.some((sub) => sub.tasks.length) ? (
              <Button variant="outline" asChild>
                <OrgLink href={`/projects/${project.id}/gantt`}>
                  <ChartGantt aria-hidden="true" /> Gantt
                </OrgLink>
              </Button>
            ) : null}
            {canEdit ? (
              <>
                {plan.length ? (
                  <>
                    <Button variant="outline" asChild>
                      <OrgLink href={`/projects/${project.id}/${plan[0].id}?checkin=1`}>
                        <ClipboardCheck aria-hidden="true" /> Start daily check-in
                      </OrgLink>
                    </Button>
                    <LockPlanButton orgSlug={org.slug} projectId={project.id} relock={Boolean(project.baseline)} />
                  </>
                ) : null}
                <ProjectFormDialog
                  orgSlug={org.slug}
                  project={project}
                  trigger={
                    <Button variant="outline">
                      <Pencil aria-hidden="true" /> Edit project
                    </Button>
                  }
                />
                <SubprojectFormDialog
                  orgSlug={org.slug}
                  projectId={project.id}
                  plan={plan}
                  dependencies={project.dependencies}
                  taskLinks={project.taskLinks}
                  milestoneLinks={project.milestoneLinks}
                  usedColors={plan.map((s) => s.color)}
                  trigger={
                    <Button>
                      <Plus aria-hidden="true" /> Add subproject
                    </Button>
                  }
                />
              </>
            ) : null}
          </>
        }
      />

      {project.archivedAt ? (
        <p role="note" className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
          <Archive aria-hidden="true" className="size-4 shrink-0" /> This project is archived. Restore it from Projects ›
          Archived to show it in the list again.
        </p>
      ) : null}

      {plan.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No subprojects yet"
          description={
            canEdit
              ? "Split the project into areas with their own owner and cronograma, e.g. Structure, Shade Sail and DJ Booth."
              : "Subprojects appear here once an admin or production manager adds them."
          }
        />
      ) : (
        <>
          <section aria-labelledby="progress-heading" className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border bg-card p-4">
            <ProgressDonut value={rollupProgress(allTasks)} label={`${project.name} progress`} size={112} />
            <div className="min-w-48 flex-1 space-y-1">
              <h2 id="progress-heading" className="text-lg font-semibold">
                Project progress
              </h2>
              <p className="text-sm text-muted-foreground">
                {allTasks.length === 0
                  ? "No tasks yet: add them in each subproject's cronograma."
                  : `${doneTasks} of ${allTasks.length} tasks done · every task counts equally`}
              </p>
              {project.baseline ? (
                <p className="text-sm">
                  {delayed === 0
                    ? "All subprojects on the original plan."
                    : `${delayed} of ${plan.length} subprojects end later than the original plan.`}
                </p>
              ) : null}
              <AttentionLine overdue={attention.overdue} blocked={attention.blocked} />
              {overlaps.length ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <OctagonAlert aria-hidden="true" className="size-4 shrink-0" />
                  {overlaps.length} {overlaps.length === 1 ? "overlap" : "overlaps"} between subprojects
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No overlaps between subprojects.</p>
              )}
              {linkOverlaps.length ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <OctagonAlert aria-hidden="true" className="size-4 shrink-0" />
                  {linkOverlaps.length} {linkOverlaps.length === 1 ? "overlap" : "overlaps"} between linked tasks
                </p>
              ) : null}
              {misses.length ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <OctagonAlert aria-hidden="true" className="size-4 shrink-0" />
                  {misses.length} {misses.length === 1 ? "task is" : "tasks are"} late for a milestone
                </p>
              ) : null}
            </div>
          </section>

          <OverlapWarnings plan={plan} overlaps={overlaps} linkOverlaps={linkOverlaps} misses={misses} projectId={project.id} />

          <section aria-labelledby="timeline-heading" className="space-y-3 rounded-xl border bg-card p-4">
            <h2 id="timeline-heading" className="text-lg font-semibold">
              Timeline
            </h2>
            {allTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The timeline appears once subprojects have tasks: each subproject runs from its start date for as long as
                its tasks take.
              </p>
            ) : (
              <Timeline
                label="Subprojects timeline"
                today={today}
                showOverlapKey
                rows={plan.map((sub) => {
                  const s = schedules[sub.id];
                  const mine = overlaps.filter((o) => o.predecessorId === sub.id || o.successorId === sub.id);
                  // Overlapping linked tasks also turn their days red on their subproject's bar.
                  const ownTaskIds = sub.tasks.map((t) => t.id);
                  const mineLinked = linkOverlaps.filter(({ link }) => ownTaskIds.includes(link.predecessor.id) || ownTaskIds.includes(link.successor.id));
                  const mineLate = misses.filter((m) => ownTaskIds.includes(m.link.task.id));
                  const warnings = [
                    ...mine.map((o) => overlapMessage(plan, o)),
                    ...mineLinked.map((o) => taskOverlapMessage(o, project.id)),
                    ...mineLate.map((m) => milestoneMissMessage(m, project.id)),
                  ];
                  return {
                    id: sub.id,
                    label: sub.name,
                    color: sub.color,
                    href: `/${org.slug}/projects/${project.id}/${sub.id}`,
                    sublabel: sub.ownerName ?? undefined,
                    range: s.end ? { start: s.start, end: s.end } : null,
                    baseline: baseline[sub.id] ?? null,
                    warning: warnings.length ? warnings.join(" ") : null,
                    overlaps: [
                      ...overlapWindows(plan, overlaps, sub.id),
                      ...ownTaskIds.flatMap((id) => taskOverlapWindows(mineLinked, id)),
                      ...ownTaskIds.flatMap((id) => milestoneMissWindows(mineLate, id)),
                    ],
                    done: sub.tasks.length > 0 && sub.tasks.every((t) => t.status === "done"),
                  };
                })}
                milestones={milestonesOnTimeline(milestones, projectRange, project.milestoneLinks)}
              />
            )}
            <MilestoneList milestones={milestones} today={today} />
          </section>

          <section aria-labelledby="subprojects-heading" className="space-y-3">
            <h2 id="subprojects-heading" className="text-lg font-semibold">
              Subprojects
            </h2>
            <ul aria-label="Subprojects" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plan.map((sub) => (
                <li key={sub.id}>
                  <SubprojectCard
                    sub={sub}
                    project={project}
                    overlaps={overlaps}
                    linkOverlaps={linkOverlaps}
                    misses={misses}
                    orgSlug={org.slug}
                    canEdit={canEdit}
                    attention={flagged([sub])}
                    startsAfter={project.dependencies.filter((d) => d.successorId === sub.id).map((d) => name(d.predecessorId))}
                  />
                </li>
              ))}
            </ul>
          </section>

          <DependenciesSection
            orgSlug={org.slug}
            projectId={project.id}
            subprojects={plan.map((s) => ({ id: s.id, name: s.name }))}
            dependencies={project.dependencies}
            canEdit={canEdit}
          />
        </>
      )}

      <section aria-labelledby="changes-heading" className="space-y-3">
        <h2 id="changes-heading" className="text-lg font-semibold">
          Recent changes
        </h2>
        <HistoryList
          label="Recent changes"
          entries={history}
          timeZone={org.timezone}
          subprojectName={(id) => plan.find((s) => s.id === id)?.name}
        />
      </section>
    </>
  );
}

function OverlapWarnings({
  plan,
  overlaps,
  linkOverlaps,
  misses,
  projectId,
}: {
  plan: SubprojectView[];
  overlaps: Overlap[];
  linkOverlaps: TaskOverlap[];
  misses: MilestoneMiss[];
  projectId: string;
}) {
  if (overlaps.length === 0 && linkOverlaps.length === 0 && misses.length === 0) return null;
  return (
    <section aria-label="Warnings" className="space-y-2">
      {overlaps.map((o) => (
        <p
          key={`${o.predecessorId}-${o.successorId}`}
          className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">Overlap: </span>
            {overlapMessage(plan, o)} Check with both owners, or change a start date.
          </span>
        </p>
      ))}
      {linkOverlaps.map((o) => (
        <p
          key={o.link.id}
          className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">Overlap: </span>
            {taskOverlapMessage(o, projectId)} Check with both owners, or change a duration.
          </span>
        </p>
      ))}
      {misses.map((m) => (
        <p key={m.link.id} className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">Late for a milestone: </span>
            {milestoneMissMessage(m, projectId)} Shorten the work, or move the milestone.
          </span>
        </p>
      ))}
    </section>
  );
}

function SubprojectCard({
  sub,
  project,
  overlaps,
  linkOverlaps,
  misses,
  orgSlug,
  canEdit,
  attention,
  startsAfter,
}: {
  sub: SubprojectView;
  project: ProjectDetail;
  overlaps: Overlap[];
  linkOverlaps: TaskOverlap[];
  misses: MilestoneMiss[];
  orgSlug: string;
  canEdit: boolean;
  attention: { overdue: number; blocked: number };
  startsAfter: string[];
}) {
  const schedule = schedulesFor([sub])[sub.id];
  const range = schedule.end ? { start: schedule.start, end: schedule.end } : null;
  const original = project.baseline?.ranges[sub.id];
  const slip = original && schedule.end ? daysBetween(original.end, schedule.end) : null;
  const name = (id: string) => project.subprojects.find((s) => s.id === id)?.name ?? "—";
  const notes = overlaps.flatMap((o) =>
    o.successorId === sub.id
      ? [`Overlaps ${name(o.predecessorId)} by ${pluralDays(o.days)}`]
      : o.predecessorId === sub.id
        ? [`Runs ${pluralDays(o.days)} into ${name(o.successorId)}`]
        : [],
  );
  for (const { link, days } of misses) {
    if (link.task.subprojectId === sub.id) notes.push(`${link.task.name} is ${pluralDays(days)} late for ${link.milestone.name}`);
  }
  for (const { link, days } of linkOverlaps) {
    if (link.successor.subprojectId === sub.id) {
      notes.push(`${link.successor.name} overlaps ${taskPlace(link.predecessor, project.id)} by ${pluralDays(days)}`);
    } else if (link.predecessor.subprojectId === sub.id) {
      notes.push(`${link.predecessor.name} runs ${pluralDays(days)} into ${taskPlace(link.successor, project.id)}`);
    }
  }

  return (
    <Card className="h-full gap-3">
      <CardHeader className="grid-cols-[1fr_auto] items-center gap-x-4">
        <ProgressDonut value={rollupProgress(sub.tasks)} label={`${sub.name} progress`} className="col-start-2 row-span-3 row-start-1" />
        <CardTitle>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <SubprojectDot color={sub.color} className="size-3" />
            <OrgLink
              href={`/projects/${project.id}/${sub.id}`}
              className="text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {sub.name}
            </OrgLink>
          </h3>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Owner: {sub.ownerName ?? "—"}</p>
        <AttentionLine overdue={attention.overdue} blocked={attention.blocked} />
        {notes.length ? (
          <ul className="space-y-0.5">
            {notes.map((note) => (
              <li key={note} className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <OctagonAlert aria-hidden="true" className="size-3.5 shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Starts</dt>
          <dd className="tabular-nums">{formatDate(sub.startDate)}</dd>
          <dt className="text-muted-foreground">Dates</dt>
          <dd className="tabular-nums">{range ? formatRange(range) : "— (no tasks yet)"}</dd>
          {project.baseline ? (
            <>
              <dt className="text-muted-foreground">vs. original</dt>
              <dd>
                {slip === null
                  ? "—"
                  : slip === 0
                    ? "On plan"
                    : slip > 0
                      ? `Ends ${pluralDays(slip)} later`
                      : `Ends ${pluralDays(-slip)} earlier`}
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Tasks done</dt>
          <dd className="tabular-nums">
            {sub.tasks.filter((t) => t.status === "done").length} of {sub.tasks.length}
          </dd>
          <dt className="text-muted-foreground">Materials on site</dt>
          <dd className="tabular-nums">
            {sub.materials.filter((m) => m.status === "on_site").length} of {sub.materials.length}
          </dd>
          {startsAfter.length ? (
            <>
              <dt className="text-muted-foreground">Starts after</dt>
              <dd>{startsAfter.join(", ")}</dd>
            </>
          ) : null}
        </dl>
      </CardContent>
      {canEdit ? (
        <CardFooter className="gap-1">
          <SubprojectFormDialog
            orgSlug={orgSlug}
            projectId={project.id}
            plan={project.subprojects}
            dependencies={project.dependencies}
            taskLinks={project.taskLinks}
            milestoneLinks={project.milestoneLinks}
            usedColors={project.subprojects.map((s) => s.color)}
            subproject={{ id: sub.id, name: sub.name, startDate: sub.startDate, color: sub.color }}
            trigger={
              <Button size="sm" variant="outline">
                <Pencil aria-hidden="true" /> Edit<span className="sr-only"> {sub.name}</span>
              </Button>
            }
          />
          <ArchiveSubprojectButton orgSlug={orgSlug} projectId={project.id} subprojectId={sub.id} name={sub.name} />
        </CardFooter>
      ) : null}
    </Card>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading project">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/** "2 overdue tasks · 1 blocked" in amber, or nothing (P4-04). Icon + words, never colour alone. */
function AttentionLine({ overdue, blocked }: { overdue: number; blocked: number }) {
  if (!overdue && !blocked) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-medium text-warning">
      {overdue ? (
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
          {overdue} overdue {overdue === 1 ? "task" : "tasks"}
        </span>
      ) : null}
      {blocked ? (
        <span className="inline-flex items-center gap-1.5">
          <Hourglass aria-hidden="true" className="size-4 shrink-0" />
          {blocked} blocked {blocked === 1 ? "task" : "tasks"}
        </span>
      ) : null}
    </p>
  );
}

/** Every milestone of the organization, in words: they apply to all projects (D-030). */
function MilestoneList({ milestones, today }: { milestones: { id: string; name: string; date: string }[]; today: string }) {
  if (milestones.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Flag aria-hidden="true" className="size-3.5" /> Milestones:
      </span>
      <ul aria-label="Milestones" className="contents">
        {milestones.map((m, i) => (
          <li key={m.id} className={m.date < today ? "text-muted-foreground" : undefined}>
            {m.name} ({formatDate(m.date)}){i < milestones.length - 1 ? " ·" : ""}
          </li>
        ))}
      </ul>
      <OrgLink href="/projects" className="text-primary underline underline-offset-4">
        Manage<span className="sr-only"> milestones</span>
      </OrgLink>
    </div>
  );
}
