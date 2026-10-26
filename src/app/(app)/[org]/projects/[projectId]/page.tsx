import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Archive, CalendarRange, OctagonAlert, Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { ProgressDonut } from "@/components/progress-donut";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMembership } from "@/lib/dal/organizations";
import { getProjectDetail, type ProjectDetail, type SubprojectView } from "@/lib/dal/project-detail";
import { rollupProgress } from "@/lib/domain/progress";
import { overlapMessage, overlapWindows, overlapsFor, schedulesFor } from "@/lib/domain/project-plan";
import { PROJECT_STATUS_CATEGORY, PROJECT_STATUS_LABELS, canEditProjects } from "@/lib/domain/projects";
import { daysBetween, type Overlap } from "@/lib/domain/schedule";
import { formatDate, formatRange, pluralDays } from "@/lib/format";
import { ProjectFormDialog } from "../project-form-dialog";
import { ArchiveSubprojectButton } from "./archive-subproject-button";
import { DependenciesSection } from "./dependencies-section";
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

  const canEdit = canEditProjects(org.role);
  const plan = project.subprojects;
  const schedules = schedulesFor(plan);
  const overlaps = overlapsFor(plan, project.dependencies);
  const allTasks = plan.flatMap((s) => s.tasks);
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const baseline = project.baseline?.ranges ?? {};
  const delayed = plan.filter((s) => {
    const end = schedules[s.id].end;
    return baseline[s.id] && end && daysBetween(baseline[s.id].end, end) > 0;
  }).length;
  const name = (id: string) => plan.find((s) => s.id === id)?.name ?? "—";
  // Calendar "today" for the timeline marker (request time; the page is dynamic).
  const today = new Date().toISOString().slice(0, 10);

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
          canEdit ? (
            <>
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
                trigger={
                  <Button>
                    <Plus aria-hidden="true" /> Add subproject
                  </Button>
                }
              />
            </>
          ) : null
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
              {overlaps.length ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <OctagonAlert aria-hidden="true" className="size-4 shrink-0" />
                  {overlaps.length} {overlaps.length === 1 ? "overlap" : "overlaps"} between subprojects
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No overlaps between subprojects.</p>
              )}
            </div>
          </section>

          <OverlapWarnings plan={plan} overlaps={overlaps} />

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
                  return {
                    id: sub.id,
                    label: sub.name,
                    sublabel: sub.ownerName ?? undefined,
                    range: s.end ? { start: s.start, end: s.end } : null,
                    baseline: baseline[sub.id] ?? null,
                    warning: mine.length ? mine.map((o) => overlapMessage(plan, o)).join(" ") : null,
                    overlaps: overlapWindows(plan, overlaps, sub.id),
                    done: sub.tasks.length > 0 && sub.tasks.every((t) => t.status === "done"),
                  };
                })}
              />
            )}
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
                    orgSlug={org.slug}
                    canEdit={canEdit}
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
    </>
  );
}

function OverlapWarnings({ plan, overlaps }: { plan: SubprojectView[]; overlaps: Overlap[] }) {
  if (overlaps.length === 0) return null;
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
    </section>
  );
}

function SubprojectCard({
  sub,
  project,
  overlaps,
  orgSlug,
  canEdit,
  startsAfter,
}: {
  sub: SubprojectView;
  project: ProjectDetail;
  overlaps: Overlap[];
  orgSlug: string;
  canEdit: boolean;
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

  return (
    <Card className="h-full gap-3">
      <CardHeader className="grid-cols-[1fr_auto] items-center gap-x-4">
        <ProgressDonut value={rollupProgress(sub.tasks)} label={`${sub.name} progress`} className="col-start-2 row-span-3 row-start-1" />
        <CardTitle>
          <h3 className="text-base font-semibold">{sub.name}</h3>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Owner: {sub.ownerName ?? "—"}</p>
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
            {sub.materialStatuses.filter((m) => m === "on_site").length} of {sub.materialStatuses.length}
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
            subproject={{ id: sub.id, name: sub.name, startDate: sub.startDate }}
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
