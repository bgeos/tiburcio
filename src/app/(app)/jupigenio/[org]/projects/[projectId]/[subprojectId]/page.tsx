import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, ClipboardCheck, Flag, Hourglass, Link2, ListChecks, OctagonAlert, Pencil, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { HistoryList } from "@/components/history-list";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { ProgressDonut } from "@/components/progress-donut";
import { StatusBadge } from "@/components/status-badge";
import { SubprojectDot } from "@/components/subproject-color";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayIn } from "@/lib/dates";
import { listActivity } from "@/lib/dal/activity";
import { listMilestones } from "@/lib/dal/milestones";
import { requireMembership } from "@/lib/dal/organizations";
import { getProjectDetail, type ProjectDetail, type SubprojectView } from "@/lib/dal/project-detail";
import { listLinkableTasks } from "@/lib/dal/task-links";
import {
  milestoneMissMessage,
  milestoneMissWindows,
  milestoneMisses,
  milestonesOnTimeline,
  type Milestone,
  type MilestoneLink,
  type MilestoneMiss,
} from "@/lib/domain/milestones";
import { itemProgress, rollupProgress } from "@/lib/domain/progress";
import { overlapMessage, overlapsFor, schedulesFor } from "@/lib/domain/project-plan";
import { canEditProjects } from "@/lib/domain/projects";
import { daysBetween } from "@/lib/domain/schedule";
import { flagTask, isBlocked, type TaskFlags } from "@/lib/domain/task-flags";
import {
  linksTouching,
  taskOverlapMessage,
  taskOverlapWindows,
  taskOverlaps,
  taskPlace,
  type LinkedTask,
  type TaskLink,
  type TaskOverlap,
} from "@/lib/domain/task-links";
import { formatDate, formatRange, pluralDays } from "@/lib/format";
import { SubprojectFormDialog } from "../subproject-form-dialog";
import { CrewTab } from "./crew-tab";
import { MaterialsTab } from "./materials-tab";
import { AddTaskButton, RemoveTaskButton, TaskStatusSelect, UpdateTaskButton, type TaskScope } from "./task-dialogs";
import { TaskLinksButton } from "./task-links-dialog";

const TABS = ["cronograma", "materials", "crew", "history"] as const;

export const metadata: Metadata = { title: "Subproject" };

type Props = PageProps<"/jupigenio/[org]/projects/[projectId]/[subprojectId]">;

export default function SubprojectPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<SubprojectSkeleton />}>
      <SubprojectContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SubprojectContent({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const [{ org: slug, projectId, subprojectId }, { tab, checkin }] = await Promise.all([params, searchParams]);
  // ?tab=materials opens that tab (links from the All materials page).
  const defaultTab = TABS.find((t) => t === tab) ?? "cronograma";
  const org = await requireMembership(slug);
  const project = await getProjectDetail(org, projectId);
  const sub = project?.subprojects.find((s) => s.id === subprojectId);
  if (!project || !sub) notFound();
  // Only after both are known to exist: a malformed id must be a 404, not a query error.
  const history = await listActivity(org, project.id, { subprojectId: sub.id });
  const canEdit = canEditProjects(org.role);
  // The daily check-in is the editors' routine; for viewers the link just opens the subproject.
  const checkIn = canEdit && checkin === "1" ? project.subprojects.findIndex((s) => s.id === sub.id) : -1;
  const plan = project.subprojects;
  const schedule = schedulesFor([sub])[sub.id];
  const range = schedule.end ? { start: schedule.start, end: schedule.end } : null;
  const original = project.baseline?.ranges[sub.id];
  const slip = original && schedule.end ? daysBetween(original.end, schedule.end) : null;
  const name = (id: string) => plan.find((s) => s.id === id)?.name ?? "—";
  const overlaps = overlapsFor(plan, project.dependencies).filter((o) => o.predecessorId === sub.id || o.successorId === sub.id);
  const taskLinks = linksTouching(project.taskLinks, sub.tasks.map((t) => t.id));
  const linkOverlaps = taskOverlaps(taskLinks);
  const milestones = await listMilestones(org);
  const milestoneLinks = project.milestoneLinks.filter((l) => l.task.subprojectId === sub.id);
  const misses = milestoneMisses(milestoneLinks);
  // The choices for "waits for…" (editors only): every current task of the organization.
  const candidates = canEdit ? await listLinkableTasks(org) : [];
  const after = project.dependencies.filter((d) => d.successorId === sub.id).map((d) => name(d.predecessorId));
  const before = project.dependencies.filter((d) => d.predecessorId === sub.id).map((d) => name(d.successorId));
  const scope: TaskScope = {
    orgSlug: org.slug,
    projectId: project.id,
    subprojectId: sub.id,
    plan,
    dependencies: project.dependencies,
    taskLinks: project.taskLinks,
    milestoneLinks: project.milestoneLinks,
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <OrgLink href={`/projects/${project.id}`}>
          <ArrowLeft aria-hidden="true" /> {project.name}
        </OrgLink>
      </Button>
      {checkIn >= 0 ? <CheckInBar project={project} index={checkIn} /> : null}
      <PageHeader
        title={sub.name}
        titleAdornment={<SubprojectDot color={sub.color} className="size-3.5" />}
        description={
          <>
            Owner: {sub.ownerName ?? "—"} · Starts {formatDate(sub.startDate)} · {range ? formatRange(range) : "no tasks yet"}
            {slip ? ` · ends ${pluralDays(Math.abs(slip))} ${slip > 0 ? "later" : "earlier"} than the original plan` : slip === 0 ? " · on plan" : ""}
            {after.length ? ` · starts after ${after.join(", ")}` : ""}
            {before.length ? ` · ${before.join(", ")} start after it` : ""}
          </>
        }
        actions={
          <>
            {canEdit ? (
              <SubprojectFormDialog
                orgSlug={org.slug}
                projectId={project.id}
                plan={plan}
                dependencies={project.dependencies}
                taskLinks={project.taskLinks}
                milestoneLinks={project.milestoneLinks}
                usedColors={plan.map((s) => s.color)}
                subproject={{ id: sub.id, name: sub.name, startDate: sub.startDate, color: sub.color }}
                trigger={
                  <Button variant="outline">
                    <Pencil aria-hidden="true" /> Edit subproject
                  </Button>
                }
              />
            ) : null}
            <ProgressDonut value={rollupProgress(sub.tasks)} label={`${sub.name} progress`} size={80} />
          </>
        }
      />

      {overlaps.length || linkOverlaps.length || misses.length ? (
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
                {taskOverlapMessage(o, project.id)} Check with both owners, or change a duration.
              </span>
            </p>
          ))}
          {misses.map((m) => (
            <MissWarning key={m.link.id} miss={m} projectId={project.id} />
          ))}
        </section>
      ) : null}

      <Tabs defaultValue={defaultTab} className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="cronograma">Cronograma ({sub.tasks.length})</TabsTrigger>
          <TabsTrigger value="materials">Materials ({sub.materials.length})</TabsTrigger>
          <TabsTrigger value="crew">Crew ({sub.crew.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="cronograma">
          <Cronograma
            project={project}
            sub={sub}
            scope={scope}
            canEdit={canEdit}
            today={todayIn(org.timezone)}
            links={taskLinks}
            candidates={candidates}
            milestones={milestones}
            milestoneLinks={milestoneLinks}
          />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialsTab
            scope={{ orgSlug: org.slug, projectId: project.id, subprojectId: sub.id, subprojectName: sub.name }}
            materials={sub.materials}
            canEdit={canEdit}
            today={todayIn(org.timezone)}
          />
        </TabsContent>
        <TabsContent value="crew">
          <CrewTab
            scope={{ orgSlug: org.slug, projectId: project.id, subprojectId: sub.id, subprojectName: sub.name }}
            crew={sub.crew}
            ownerCrewId={sub.ownerCrewId}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="history">
          <HistoryList label={`${sub.name} history`} entries={history} timeZone={org.timezone} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Daily check-in (D-019): step through the project's subprojects one by one while
 * talking with each owner. Plain links, so it also works without JavaScript.
 */
function CheckInBar({ project, index }: { project: ProjectDetail; index: number }) {
  const subs = project.subprojects;
  const sub = subs[index];
  const step = (i: number) => `/projects/${project.id}/${subs[i].id}?checkin=1` as const;
  return (
    <section
      aria-label="Daily check-in"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-accent p-3 text-accent-foreground"
    >
      <ClipboardCheck aria-hidden="true" className="size-5 shrink-0" />
      <p className="min-w-48 flex-1 text-sm">
        <span className="font-semibold">
          Daily check-in · {index + 1} of {subs.length}.
        </span>{" "}
        Talk with {sub.ownerName ?? "the owner"}, then update the cronograma, materials and crew.
      </p>
      <div className="flex gap-2">
        {index > 0 ? (
          <Button size="sm" variant="outline" asChild>
            <OrgLink href={step(index - 1)}>
              <ArrowLeft aria-hidden="true" /> Previous
            </OrgLink>
          </Button>
        ) : null}
        {index < subs.length - 1 ? (
          <Button size="sm" asChild>
            <OrgLink href={step(index + 1)}>
              Next subproject <ArrowRight aria-hidden="true" />
            </OrgLink>
          </Button>
        ) : (
          <Button size="sm" asChild>
            <OrgLink href={`/projects/${project.id}`}>Finish check-in</OrgLink>
          </Button>
        )}
      </div>
    </section>
  );
}

function Cronograma({
  project,
  sub,
  scope,
  canEdit,
  today,
  links,
  candidates,
  milestones,
  milestoneLinks,
}: {
  project: ProjectDetail;
  sub: SubprojectView;
  scope: TaskScope;
  canEdit: boolean;
  today: string;
  /** Task links touching this subproject's tasks. */
  links: TaskLink[];
  candidates: LinkedTask[];
  /** The organization's milestones, and this subproject's tasks' links to them (D-030). */
  milestones: Milestone[];
  milestoneLinks: MilestoneLink[];
}) {
  const schedule = schedulesFor([sub])[sub.id];
  const baseline = project.baseline?.ranges ?? {};
  const overlaps = taskOverlaps(links);
  const misses = milestoneMisses(milestoneLinks);
  const flags = sub.tasks.map((task, i) => flagTask({ id: task.id, status: task.status, range: schedule.tasks[i] }, links, today));
  const overdue = flags.filter((f) => f.overdueDays !== null).length;
  const blocked = flags.filter(isBlocked).length;
  const asLinked = (i: number): LinkedTask => ({
    id: sub.tasks[i].id,
    name: sub.tasks[i].name,
    subprojectId: sub.id,
    subprojectName: sub.name,
    projectId: project.id,
    projectName: project.name,
    color: sub.color,
    status: sub.tasks[i].status,
    range: schedule.tasks[i],
  });

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <AddTaskButton scope={scope} />
        </div>
      ) : null}

      {sub.tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description={
            canEdit
              ? `Add the first task with its duration; it starts on ${formatDate(sub.startDate)} and the next ones follow it.`
              : "Tasks appear here once an admin or production manager adds them."
          }
        />
      ) : (
        <>
          {overdue || blocked ? (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
              {overdue ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
                  {overdue} {overdue === 1 ? "task is" : "tasks are"} overdue
                </span>
              ) : null}
              {blocked ? (
                <span className="inline-flex items-center gap-1.5">
                  <Hourglass aria-hidden="true" className="size-4 shrink-0" />
                  {blocked} {blocked === 1 ? "task is" : "tasks are"} blocked
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="rounded-xl border bg-card">
            <Table scrollLabel={`${sub.name} cronograma`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  {project.baseline ? <TableHead>vs. original</TableHead> : null}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead>Actual</TableHead>
                  {canEdit ? (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sub.tasks.map((task, i) => {
                  const planned = schedule.tasks[i];
                  const slip = baseline[task.id] ? daysBetween(baseline[task.id].end, planned.end) : null;
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="whitespace-normal">
                        <p className="font-medium">{task.name}</p>
                        {task.delayDays > 0 ? (
                          <p className="text-xs text-muted-foreground">Waits {pluralDays(task.delayDays)} before starting</p>
                        ) : null}
                        <TaskFlagNotes flags={flags[i]} projectId={project.id} />
                        <TaskLinkNotes taskId={task.id} links={links} overlaps={overlaps} projectId={project.id} />
                        <MilestoneNotes links={milestoneLinks.filter((l) => l.task.id === task.id)} misses={misses} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatRange(planned)}</TableCell>
                      <TableCell className="text-right tabular-nums">{task.durationDays}</TableCell>
                      {project.baseline ? (
                        <TableCell className="whitespace-nowrap text-sm">
                          {slip === null ? (
                            <span className="text-muted-foreground">New task</span>
                          ) : slip === 0 ? (
                            <span className="text-muted-foreground">On plan</span>
                          ) : slip > 0 ? (
                            <span className="inline-flex items-center gap-1 font-medium text-warning">
                              <TriangleAlert aria-hidden="true" className="size-3.5" /> {pluralDays(slip)} later
                            </span>
                          ) : (
                            <span className="font-medium text-status-done">{pluralDays(-slip)} earlier</span>
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        {canEdit ? (
                          <TaskStatusSelect scope={scope} taskId={task.id} taskName={task.name} status={task.status} />
                        ) : (
                          <StatusBadge category={task.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{itemProgress(task)}%</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {task.actualEnd ? (
                          `Done ${formatDate(task.actualEnd)}`
                        ) : task.actualStart ? (
                          `Started ${formatDate(task.actualStart)}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canEdit ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <UpdateTaskButton scope={scope} task={task} />
                            <TaskLinksButton
                              orgSlug={scope.orgSlug}
                              task={asLinked(i)}
                              links={links.filter((l) => l.predecessor.id === task.id || l.successor.id === task.id)}
                              candidates={candidates}
                              milestones={milestones}
                              milestoneLinks={milestoneLinks.filter((l) => l.task.id === task.id)}
                            />
                            <RemoveTaskButton scope={scope} task={task} />
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Timeline
            label={`${sub.name} tasks timeline`}
            today={today}
            color={sub.color}
            rows={sub.tasks.map((task, i) => ({
              id: task.id,
              label: task.name,
              sublabel: pluralDays(task.durationDays),
              range: schedule.tasks[i],
              baseline: baseline[task.id] ?? null,
              done: task.status === "done",
              warning:
                [
                  ...overlaps
                    .filter((o) => o.link.predecessor.id === task.id || o.link.successor.id === task.id)
                    .map((o) => taskOverlapMessage(o, project.id)),
                  ...misses.filter((m) => m.link.task.id === task.id).map((m) => milestoneMissMessage(m, project.id)),
                ].join(" ") || null,
              overlaps: [...taskOverlapWindows(overlaps, task.id), ...milestoneMissWindows(misses, task.id)],
            }))}
            showOverlapKey={overlaps.length > 0 || misses.length > 0}
            milestones={milestonesOnTimeline(milestones, schedule.end ? { start: schedule.start, end: schedule.end } : null, milestoneLinks)}
          />
        </>
      )}
    </div>
  );
}

/** "Waits for …" / "Needed by …" under a task's name; red when the two overlap. */
/** Overdue and waiting, in words (P4-04); "Blocked" shows in the status. Amber: needs attention; red stays for overlaps. */
function TaskFlagNotes({ flags, projectId }: { flags: TaskFlags; projectId: string }) {
  const notes = [
    flags.overdueDays !== null && { icon: CalendarClock, text: `Overdue by ${pluralDays(flags.overdueDays)}` },
    flags.waitingFor.length > 0 && {
      icon: Hourglass,
      text: `Can't start yet: ${flags.waitingFor.map((t) => taskPlace(t, projectId)).join(", ")} ${flags.waitingFor.length === 1 ? "isn't" : "aren't"} done`,
    },
  ].filter((n): n is { icon: typeof CalendarClock; text: string } => Boolean(n));
  if (notes.length === 0) return null;
  return (
    <ul className="mt-0.5 space-y-0.5 text-xs font-medium text-warning">
      {notes.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-1">
          <Icon aria-hidden="true" className="size-3 shrink-0" />
          {text}
        </li>
      ))}
    </ul>
  );
}

/** "Must be done before Festival opens (20 Jan)"; red with the days late when it runs into it (D-030). */
function MilestoneNotes({ links, misses }: { links: MilestoneLink[]; misses: MilestoneMiss[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="mt-0.5 space-y-0.5 text-xs">
      {links.map((link) => {
        const miss = misses.find((m) => m.link.id === link.id);
        return (
          <li
            key={link.id}
            className={miss ? "flex items-center gap-1 font-medium text-destructive" : "flex items-center gap-1 text-muted-foreground"}
          >
            {miss ? <OctagonAlert aria-hidden="true" className="size-3 shrink-0" /> : <Flag aria-hidden="true" className="size-3 shrink-0" />}
            Must be done before {link.milestone.name} ({formatDate(link.milestone.date)})
            {miss ? ` (${pluralDays(miss.days)} late)` : ""}
          </li>
        );
      })}
    </ul>
  );
}

function MissWarning({ miss, projectId }: { miss: MilestoneMiss; projectId: string }) {
  return (
    <p className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-semibold">Late for a milestone: </span>
        {milestoneMissMessage(miss, projectId)} Shorten the work, or move the milestone.
      </span>
    </p>
  );
}

function TaskLinkNotes({
  taskId,
  links,
  overlaps,
  projectId,
}: {
  taskId: string;
  links: TaskLink[];
  overlaps: TaskOverlap[];
  projectId: string;
}) {
  const notes = links.flatMap((link) => {
    const waits = link.successor.id === taskId;
    if (!waits && link.predecessor.id !== taskId) return [];
    const other = waits ? link.predecessor : link.successor;
    const overlap = overlaps.find((o) => o.link.id === link.id);
    return [{ id: link.id, text: `${waits ? "Waits for" : "Needed by"} ${taskPlace(other, projectId)}`, overlap }];
  });
  if (notes.length === 0) return null;
  return (
    <ul className="mt-0.5 space-y-0.5 text-xs">
      {notes.map((n) => (
        <li
          key={n.id}
          className={n.overlap ? "flex items-center gap-1 font-medium text-destructive" : "flex items-center gap-1 text-muted-foreground"}
        >
          {n.overlap ? (
            <OctagonAlert aria-hidden="true" className="size-3 shrink-0" />
          ) : (
            <Link2 aria-hidden="true" className="size-3 shrink-0" />
          )}
          {n.text}
          {n.overlap ? ` (overlaps ${pluralDays(n.overlap.days)})` : ""}
        </li>
      ))}
    </ul>
  );
}

function SubprojectSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading subproject">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
