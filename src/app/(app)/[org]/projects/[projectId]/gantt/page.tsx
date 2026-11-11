import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Flag, ListChecks } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Gantt, type GanttLink, type GanttRow } from "@/components/gantt";
import { OrgLink } from "@/components/org-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIn } from "@/lib/dates";
import { listMilestones } from "@/lib/dal/milestones";
import { requireMembership } from "@/lib/dal/organizations";
import { getProjectDetail } from "@/lib/dal/project-detail";
import { GANTT_ZOOMS, type GanttZoom } from "@/lib/domain/gantt";
import { milestoneMissMessage, milestoneMissWindows, milestoneMisses, milestonesOnTimeline } from "@/lib/domain/milestones";
import { overlapMessage, overlapWindows, overlapsFor, schedulesFor } from "@/lib/domain/project-plan";
import { taskOverlapMessage, taskOverlapWindows, taskOverlaps, taskPlace } from "@/lib/domain/task-links";
import { formatDate, formatRange } from "@/lib/format";

export const metadata: Metadata = { title: "Gantt" };

type Props = PageProps<"/[org]/projects/[projectId]/gantt">;

const ZOOM_LABELS: Record<GanttZoom, string> = { day: "Days", week: "Weeks" };

export default function GanttPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<GanttSkeleton />}>
      <GanttContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function GanttContent({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const [{ org: slug, projectId }, { zoom: zoomParam }] = await Promise.all([params, searchParams]);
  const zoom: GanttZoom = GANTT_ZOOMS.find((z) => z === zoomParam) ?? "day";
  const org = await requireMembership(slug);
  const project = await getProjectDetail(org, projectId);
  if (!project) notFound();
  const milestones = await listMilestones(org);
  const today = todayIn(org.timezone);

  const plan = project.subprojects;
  const schedules = schedulesFor(plan);
  const overlaps = overlapsFor(plan, project.dependencies);
  const linkOverlaps = taskOverlaps(project.taskLinks);
  const misses = milestoneMisses(project.milestoneLinks);
  const baseline = project.baseline?.ranges ?? {};
  const inProject = new Set(plan.flatMap((s) => s.tasks.map((t) => t.id)));

  const rows: GanttRow[] = plan.flatMap((sub) => {
    const s = schedules[sub.id];
    const range = s.end ? { start: s.start, end: s.end } : null;
    const subWarnings = overlaps
      .filter((o) => o.predecessorId === sub.id || o.successorId === sub.id)
      .map((o) => `Overlap: ${overlapMessage(plan, o)}`);
    const subRow: GanttRow = {
      id: sub.id,
      kind: "subproject",
      label: sub.name,
      href: `/${org.slug}/projects/${project.id}/${sub.id}`,
      range,
      baseline: baseline[sub.id] ?? null,
      color: sub.color,
      done: sub.tasks.length > 0 && sub.tasks.every((t) => t.status === "done"),
      red: overlapWindows(plan, overlaps, sub.id),
      description: [
        `Subproject, planned ${formatRange(range)}.`,
        baseline[sub.id] ? `Original plan ${formatRange(baseline[sub.id])}.` : "",
        ...subWarnings,
      ]
        .filter(Boolean)
        .join(" "),
    };
    const taskRows = sub.tasks.map((task, i): GanttRow => {
      const planned = s.tasks[i] ?? null;
      const waits = project.taskLinks.filter((l) => l.successor.id === task.id).map((l) => `Waits for ${taskPlace(l.predecessor, project.id)}.`);
      const before = project.milestoneLinks
        .filter((l) => l.task.id === task.id)
        .map((l) => `Must be done before ${l.milestone.name} (${formatDate(l.milestone.date)}).`);
      const warnings = [
        ...linkOverlaps
          .filter((o) => o.link.predecessor.id === task.id || o.link.successor.id === task.id)
          .map((o) => `Overlap: ${taskOverlapMessage(o, project.id)}`),
        ...misses.filter((m) => m.link.task.id === task.id).map((m) => `Late: ${milestoneMissMessage(m, project.id)}`),
      ];
      return {
        id: task.id,
        kind: "task",
        label: task.name,
        range: planned,
        baseline: baseline[task.id] ?? null,
        color: sub.color,
        done: task.status === "done",
        red: [...taskOverlapWindows(linkOverlaps, task.id), ...milestoneMissWindows(misses, task.id)],
        description: [`Task, planned ${formatRange(planned)}.`, baseline[task.id] ? `Original plan ${formatRange(baseline[task.id])}.` : "", ...waits, ...before, ...warnings]
          .filter(Boolean)
          .join(" "),
      };
    });
    return [subRow, ...taskRows];
  });

  // Arrows: subproject links, and task links whose both ends are in this project.
  const links: GanttLink[] = [
    ...project.dependencies.map((d) => ({ from: d.predecessorId, to: d.successorId })),
    ...project.taskLinks
      .filter((l) => inProject.has(l.predecessor.id) && inProject.has(l.successor.id))
      .map((l) => ({ from: l.predecessor.id, to: l.successor.id })),
  ];
  const elsewhere = project.taskLinks.filter((l) => !inProject.has(l.predecessor.id) || !inProject.has(l.successor.id));
  const ends = plan.flatMap((sub) => (schedules[sub.id].end ? [{ start: schedules[sub.id].start, end: schedules[sub.id].end! }] : []));
  const projectRange = ends.length ? { start: ends.map((r) => r.start).sort()[0], end: ends.map((r) => r.end).sort().at(-1)! } : null;
  const shown = milestonesOnTimeline(milestones, projectRange, project.milestoneLinks);

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <OrgLink href={`/projects/${project.id}`}>
          <ArrowLeft aria-hidden="true" /> {project.name}
        </OrgLink>
      </Button>
      <PageHeader
        title={`${project.name}: Gantt`}
        description="Every subproject and task on one chart. Arrows show what starts after what; red shows overlaps and work late for a milestone. Change dates in each subproject's cronograma."
      />

      {rows.every((r) => r.kind === "subproject") ? (
        <EmptyState icon={ListChecks} title="No tasks yet" description="The Gantt appears once subprojects have tasks." />
      ) : (
        <>
          <nav aria-label="Zoom" className="flex gap-2">
            {GANTT_ZOOMS.map((z) => (
              <Button key={z} size="sm" variant={z === zoom ? "secondary" : "ghost"} asChild>
                <OrgLink href={`/projects/${project.id}/gantt?zoom=${z}`} aria-current={z === zoom ? "page" : undefined}>
                  {ZOOM_LABELS[z]}
                </OrgLink>
              </Button>
            ))}
          </nav>

          <Gantt rows={rows} links={links} milestones={shown} today={today} zoom={zoom} label={`${project.name} Gantt`} />

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-sm bg-sub-blue" /> Subproject (summary)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-sub-blue" /> Task, in its subproject&apos;s colour
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-5 rounded-sm border border-dashed border-muted-foreground" /> Original plan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-sm bg-destructive" /> Overlap or late
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Flag className="size-3" /> Milestone
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-px bg-destructive/60" /> Today ({formatDate(today)})
            </span>
          </div>

          {elsewhere.length ? (
            <section aria-labelledby="elsewhere-heading" className="space-y-1 text-sm">
              <h2 id="elsewhere-heading" className="font-medium">
                Links to other projects
              </h2>
              <ul className="list-disc pl-5 text-muted-foreground">
                {elsewhere.map((l) => (
                  <li key={l.id}>
                    {taskPlace(l.successor, project.id)} waits for {taskPlace(l.predecessor, project.id)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function GanttSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading Gantt">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
