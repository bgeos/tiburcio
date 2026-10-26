import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ListChecks, OctagonAlert, Pencil, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
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
import { requireMembership } from "@/lib/dal/organizations";
import { getProjectDetail, type ProjectDetail, type SubprojectView } from "@/lib/dal/project-detail";
import { itemProgress, rollupProgress } from "@/lib/domain/progress";
import { overlapMessage, overlapsFor, schedulesFor } from "@/lib/domain/project-plan";
import { canEditProjects } from "@/lib/domain/projects";
import { daysBetween } from "@/lib/domain/schedule";
import { formatDate, formatRange, pluralDays } from "@/lib/format";
import { SubprojectFormDialog } from "../subproject-form-dialog";
import { AddTaskButton, RemoveTaskButton, TaskStatusSelect, UpdateTaskButton, type TaskScope } from "./task-dialogs";

export const metadata: Metadata = { title: "Subproject" };

type Props = PageProps<"/[org]/projects/[projectId]/[subprojectId]">;

export default function SubprojectPage({ params }: Props) {
  return (
    <Suspense fallback={<SubprojectSkeleton />}>
      <SubprojectContent params={params} />
    </Suspense>
  );
}

async function SubprojectContent({ params }: { params: Props["params"] }) {
  const { org: slug, projectId, subprojectId } = await params;
  const org = await requireMembership(slug);
  const project = await getProjectDetail(org, projectId);
  const sub = project?.subprojects.find((s) => s.id === subprojectId);
  if (!project || !sub) notFound();

  const canEdit = canEditProjects(org.role);
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

      <Tabs defaultValue="cronograma" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="cronograma">Cronograma ({sub.tasks.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="cronograma">
          <Cronograma project={project} sub={sub} scope={scope} canEdit={canEdit} today={todayIn(org.timezone)} />
        </TabsContent>
      </Tabs>
    </>
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
