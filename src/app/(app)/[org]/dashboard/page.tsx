import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClock, EyeOff, FolderPlus, ListChecks, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardProjects } from "@/lib/dal/dashboard";
import { requireMembership } from "@/lib/dal/organizations";
import { todayIn } from "@/lib/dates";
import { summarizeDashboard, type DashboardSummary, type ProjectHealth } from "@/lib/domain/dashboard";
import {
  EXTERNAL_NO_PROJECTS,
  PROJECT_STATUS_CATEGORY,
  PROJECT_STATUS_LABELS,
  canEditProjects,
  canViewProjects,
} from "@/lib/domain/projects";
import { TASK_STATUSES, type TaskStatus } from "@/lib/domain/tasks";

export const metadata: Metadata = { title: "Overview" };

/**
 * Figures are computed from the organization's current projects (D-026). Missing
 * data is "—", never a fake 0. Costs arrive in Phase 6, stock in Phase 5.
 */
export default function DashboardPage({ params }: PageProps<"/[org]/dashboard">) {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Your current projects at a glance: progress, overlaps, overdue tasks and materials."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent params={params} />
      </Suspense>
    </>
  );
}

async function DashboardContent({ params }: { params: PageProps<"/[org]/dashboard">["params"] }) {
  const { org: slug } = await params;
  const org = await requireMembership(slug);
  if (!canViewProjects(org.role)) {
    return <EmptyState icon={EyeOff} title="Nothing to show yet" description={EXTERNAL_NO_PROJECTS} />;
  }
  const summary = summarizeDashboard(await getDashboardProjects(org), todayIn(org.timezone));
  const noProjects = summary.projects.length === 0;

  return (
    <>
      <section aria-labelledby="key-figures" className="space-y-3">
        <h2 id="key-figures" className="sr-only">
          Key figures
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Active projects"
            value={noProjects ? null : summary.activeProjects}
            hint={noProjects ? "No projects yet" : `${summary.planningProjects} in planning`}
          />
          <StatTile label="Open tasks" value={summary.openTasks} hint={summary.openTasks === null ? "No tasks yet" : "Not done yet"} />
          <StatTile
            label="Overdue tasks"
            value={summary.overdueTasks}
            hint={summary.overdueTasks === null ? "No tasks yet" : "Planned end has passed, not done"}
          />
          <StatTile
            label="Materials not on site"
            value={summary.materialsNotOnSite}
            hint={summary.materialsNotOnSite === null ? "No materials yet" : `${summary.materialsToRequest} still to request`}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <h2>Tasks by status</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.openTasks === null ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks yet"
                description="Tasks are added in each subproject's Cronograma; their status is counted here."
                className="border-dashed bg-transparent py-8"
              />
            ) : (
              <TasksByStatus counts={summary.tasksByStatus} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <h2>Current projects</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {noProjects ? (
              <EmptyState
                icon={FolderPlus}
                title="No current projects"
                description={
                  canEditProjects(org.role)
                    ? "Create a project, for example a festival or one stage of it, then split it into subprojects with their own owners."
                    : "Projects in planning or active appear here once an admin or production manager creates them."
                }
                action={
                  <Button variant="outline" asChild>
                    <OrgLink href="/projects">Go to projects</OrgLink>
                  </Button>
                }
                className="border-dashed bg-transparent py-8"
              />
            ) : (
              <ul aria-label="Current projects" className="divide-y">
                {summary.projects.map((project) => (
                  <ProjectRow key={project.id} project={project} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function TasksByStatus({ counts }: { counts: DashboardSummary["tasksByStatus"] }) {
  const total = TASK_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const bar: Record<TaskStatus, string> = {
    todo: "bg-status-todo",
    in_progress: "bg-status-in-progress",
    blocked: "bg-status-blocked",
    done: "bg-status-done",
  };
  return (
    <ul aria-label="Tasks by status" className="space-y-3">
      {TASK_STATUSES.map((status) => (
        <li key={status} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
          <StatusBadge category={status} />
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
            <span className={`block h-full rounded-full ${bar[status]}`} style={{ width: `${(counts[status] / total) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{counts[status]}</span>
        </li>
      ))}
    </ul>
  );
}

function ProjectRow({ project }: { project: ProjectHealth }) {
  const progress = project.progress === null ? "—" : `${Math.round(project.progress)}%`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0">
      <OrgLink
        href={`/projects/${project.id}`}
        className="min-w-0 font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {project.name}
      </OrgLink>
      <StatusBadge category={PROJECT_STATUS_CATEGORY[project.status]} label={PROJECT_STATUS_LABELS[project.status]} />
      <span className="ml-auto text-sm tabular-nums">
        {progress} <span className="text-muted-foreground">done</span>
      </span>
      <p className="flex w-full flex-wrap gap-x-4 text-sm text-muted-foreground">
        <span>{project.taskCount === 0 ? "No tasks yet" : `${project.taskCount} ${project.taskCount === 1 ? "task" : "tasks"}`}</span>
        {project.overlapCount ? (
          <span className="flex items-center gap-1 text-destructive">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            {project.overlapCount} {project.overlapCount === 1 ? "overlap" : "overlaps"}
          </span>
        ) : null}
        {project.overdueCount ? (
          <span className="flex items-center gap-1 text-warning">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {project.overdueCount} overdue
          </span>
        ) : null}
      </p>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading overview">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
