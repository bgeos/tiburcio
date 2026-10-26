import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, ListChecks, OctagonAlert, Pencil, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { HistoryList } from "@/components/history-list";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { ProgressDonut } from "@/components/progress-donut";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayIn } from "@/lib/dates";
import { listActivity } from "@/lib/dal/activity";
import { requireMembership } from "@/lib/dal/organizations";
import { getProjectDetail, type ProjectDetail, type SubprojectView } from "@/lib/dal/project-detail";
import { itemProgress, rollupProgress } from "@/lib/domain/progress";
import { overlapMessage, overlapsFor, schedulesFor } from "@/lib/domain/project-plan";
import { canEditProjects } from "@/lib/domain/projects";
import { daysBetween } from "@/lib/domain/schedule";
import { formatDate, formatRange, pluralDays } from "@/lib/format";
import { SubprojectFormDialog } from "../subproject-form-dialog";
import { CrewTab } from "./crew-tab";
import { MaterialsTab } from "./materials-tab";
import { AddTaskButton, RemoveTaskButton, TaskStatusSelect, UpdateTaskButton, type TaskScope } from "./task-dialogs";

const TABS = ["cronograma", "materials", "crew", "history"] as const;

export const metadata: Metadata = { title: "Subproject" };

type Props = PageProps<"/[org]/projects/[projectId]/[subprojectId]">;

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
  const after = project.dependencies.filter((d) => d.successorId === sub.id).map((d) => name(d.predecessorId));
  const before = project.dependencies.filter((d) => d.predecessorId === sub.id).map((d) => name(d.successorId));
  const scope: TaskScope = { orgSlug: org.slug, projectId: project.id, subprojectId: sub.id, plan, dependencies: project.dependencies };

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
                subproject={{ id: sub.id, name: sub.name, startDate: sub.startDate }}
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

      {overlaps.length ? (
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
          <Cronograma project={project} sub={sub} scope={scope} canEdit={canEdit} today={todayIn(org.timezone)} />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialsTab
            scope={{ orgSlug: org.slug, projectId: project.id, subprojectId: sub.id, subprojectName: sub.name }}
            materials={sub.materials}
            canEdit={canEdit}
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
}: {
  project: ProjectDetail;
  sub: SubprojectView;
  scope: TaskScope;
  canEdit: boolean;
  today: string;
}) {
  const schedule = schedulesFor([sub])[sub.id];
  const baseline = project.baseline?.ranges ?? {};

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
            rows={sub.tasks.map((task, i) => ({
              id: task.id,
              label: task.name,
              sublabel: pluralDays(task.durationDays),
              range: schedule.tasks[i],
              baseline: baseline[task.id] ?? null,
              done: task.status === "done",
            }))}
          />
        </>
      )}
    </div>
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
