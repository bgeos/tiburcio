"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, Lock, OctagonAlert, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { ProgressDonut } from "@/components/progress-donut";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProtoProject, ProtoSubproject } from "@/lib/demo/demo-projects";
import { rollupProgress } from "@/lib/domain/progress";
import { daysBetween, type Overlap } from "@/lib/domain/schedule";
import { CronogramaTab } from "./cronograma-tab";
import { HistoryList } from "./history-list";
import { MaterialsTab } from "./materials-tab";
import { PeopleTab } from "./people-tab";
import {
  formatDate,
  formatRange,
  overlapMessage,
  overlapsOf,
  pluralDays,
  schedulesOf,
  subprojectName,
  type ChangeLog,
  type PrototypeAction,
} from "./prototype-model";
import { usePrototypeStore } from "./prototype-store";
import { Timeline } from "@/components/timeline";

type View = { kind: "overview" } | { kind: "subproject"; id: string; checkIn: boolean };

export function PrototypeApp() {
  const { state, dispatch: dispatchState, activeProjectId, setActiveProjectId } = usePrototypeStore();
  const project = state.projects.find((p) => p.id === activeProjectId) ?? state.projects[0];
  const dispatch = (action: PrototypeAction) => dispatchState({ type: "project", projectId: project.id, action });
  const [view, setView] = useState<View>({ kind: "overview" });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewKey = view.kind === "overview" ? "overview" : view.id;
  const isFirstRender = useRef(true);

  // Move focus to the new heading when the "page" changes, as a real navigation would.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [viewKey]);

  const overlaps = overlapsOf(project);
  const onChange = (subproject: ProtoSubproject, log: ChangeLog) =>
    dispatch({ type: "replaceSubproject", subproject, log });

  if (view.kind === "subproject") {
    const index = project.subprojects.findIndex((s) => s.id === view.id);
    const sub = project.subprojects[index];
    const go = (i: number) => setView({ kind: "subproject", id: project.subprojects[i].id, checkIn: true });
    return (
      <SubprojectView
        key={sub.id}
        project={project}
        sub={sub}
        overlaps={overlaps}
        onChange={onChange}
        onBack={() => setView({ kind: "overview" })}
        headingRef={headingRef}
        checkIn={
          view.checkIn
            ? {
                index,
                total: project.subprojects.length,
                prev: index > 0 ? () => go(index - 1) : null,
                next: index < project.subprojects.length - 1 ? () => go(index + 1) : null,
              }
            : null
        }
      />
    );
  }

  return (
    <ProjectOverview
      project={project}
      overlaps={overlaps}
      headingRef={headingRef}
      open={(id, checkIn = false) => setView({ kind: "subproject", id, checkIn })}
      projects={state.projects}
      selectProject={setActiveProjectId}
      lockPlan={() => dispatch({ type: "lockPlan" })}
      reset={() => dispatchState({ type: "reset" })}
    />
  );
}

function OverlapWarnings({ project, overlaps }: { project: ProtoProject; overlaps: Overlap[] }) {
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
            {overlapMessage(project, o)} Check with both owners, or change a start date.
          </span>
        </p>
      ))}
    </section>
  );
}

/** Red overlap line for one subproject: icon + text, never colour alone. */
function OverlapNote({ project, sub, overlaps }: { project: ProtoProject; sub: ProtoSubproject; overlaps: Overlap[] }) {
  const notes = overlaps.flatMap((o) =>
    o.successorId === sub.id
      ? [`Overlaps ${subprojectName(project, o.predecessorId)} by ${pluralDays(o.days)}`]
      : o.predecessorId === sub.id
        ? [`Runs ${pluralDays(o.days)} into ${subprojectName(project, o.successorId)}`]
        : [],
  );
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {notes.map((note) => (
        <li key={note} className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <OctagonAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {note}
        </li>
      ))}
    </ul>
  );
}

function ProjectOverview({
  project,
  overlaps,
  headingRef,
  open,
  projects,
  selectProject,
  lockPlan,
  reset,
}: {
  project: ProtoProject;
  overlaps: Overlap[];
  headingRef: React.Ref<HTMLHeadingElement>;
  open: (id: string, checkIn?: boolean) => void;
  projects: ProtoProject[];
  selectProject: (id: string) => void;
  lockPlan: () => void;
  reset: () => void;
}) {
  const schedules = schedulesOf(project.subprojects);
  const baseline = project.baseline?.ranges ?? {};
  const allTasks = project.subprojects.flatMap((s) => s.tasks);
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const delayedCount = project.subprojects.filter((sub) => {
    const s = schedules[sub.id];
    return baseline[sub.id] && s.end && daysBetween(baseline[sub.id].end, s.end) > 0;
  }).length;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="project-picker">Project</Label>
          <Select value={project.id} onValueChange={selectProject}>
            <SelectTrigger id="project-picker" size="sm" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PageHeader
          title={project.name}
          headingRef={headingRef}
          description={`Project · ${project.subprojects.length} subprojects · ${
            project.baseline ? `plan locked on ${formatDate(project.baseline.lockedOn)}` : "plan not locked yet"
          } · today is ${formatDate(project.today)} in this demo`}
          actions={
            <>
              <Button onClick={() => open(project.subprojects[0].id, true)}>
                <ClipboardCheck aria-hidden="true" /> Start daily check-in
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <Lock aria-hidden="true" /> Lock plan
                  </Button>
                }
                title="Lock the current plan?"
                description="Today's dates become the new “original plan” that delays are measured against. The previous original plan is replaced."
                confirmLabel="Lock plan"
                onConfirm={lockPlan}
              />
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Reset demo
              </Button>
            </>
          }
        />
      </div>

      <section
        aria-labelledby="progress-heading"
        className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border bg-card p-4"
      >
        <ProgressDonut value={rollupProgress(allTasks)} label={`${project.name} progress`} size={112} />
        <div className="min-w-48 flex-1 space-y-1">
          <h2 id="progress-heading" className="text-lg font-semibold">
            Project progress
          </h2>
          <p className="text-sm text-muted-foreground">
            {doneTasks} of {allTasks.length} tasks done · every task counts equally
          </p>
          <p className="text-sm">
            {delayedCount === 0
              ? "All subprojects on the original plan."
              : `${delayedCount} of ${project.subprojects.length} subprojects end later than the original plan.`}
          </p>
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

      <OverlapWarnings project={project} overlaps={overlaps} />

      <section aria-labelledby="timeline-heading" className="space-y-3 rounded-xl border bg-card p-4">
        <h2 id="timeline-heading" className="text-lg font-semibold">
          Timeline
        </h2>
        <Timeline
          label="Subprojects timeline"
          today={project.today}
          showOverlapKey
          rows={project.subprojects.map((sub) => {
            const s = schedules[sub.id];
            const range = s.end ? { start: s.start, end: s.end } : null;
            const mine = overlaps.filter((o) => o.predecessorId === sub.id || o.successorId === sub.id);
            return {
              id: sub.id,
              label: sub.name,
              sublabel: sub.people.find((p) => p.id === sub.ownerId)?.name,
              range,
              baseline: baseline[sub.id] ?? null,
              warning: mine.length ? mine.map((o) => overlapMessage(project, o)).join(" ") : null,
              // The overlapping days: from the successor's start to the predecessor's end, clipped to this bar.
              overlaps: range
                ? mine.map((o) => {
                    const start = schedules[o.successorId].start;
                    const end = schedules[o.predecessorId].end ?? start;
                    return {
                      start: start > range.start ? start : range.start,
                      end: end < range.end ? end : range.end,
                    };
                  })
                : [],
              done: sub.tasks.length > 0 && sub.tasks.every((t) => t.status === "done"),
              onSelect: () => open(sub.id),
            };
          })}
        />
      </section>

      <section aria-labelledby="subprojects-heading" className="space-y-3">
        <h2 id="subprojects-heading" className="text-lg font-semibold">
          Subprojects
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {project.subprojects.map((sub) => {
            const s = schedules[sub.id];
            const original = baseline[sub.id];
            const slip = original && s.end ? daysBetween(original.end, s.end) : null;
            const after = project.dependencies.filter((d) => d.successorId === sub.id);
            return (
              <Card key={sub.id} className="gap-3">
                <CardHeader className="grid-cols-[1fr_auto] items-center gap-x-4">
                  <ProgressDonut
                    value={rollupProgress(sub.tasks)}
                    label={`${sub.name} progress`}
                    className="col-start-2 row-span-3 row-start-1"
                  />
                  <CardTitle>
                    <button
                      type="button"
                      onClick={() => open(sub.id)}
                      className="text-left text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {sub.name}
                    </button>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Owner: {sub.people.find((p) => p.id === sub.ownerId)?.name ?? "—"}
                  </p>
                  <OverlapNote project={project} sub={sub} overlaps={overlaps} />
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Dates</dt>
                    <dd className="tabular-nums">{formatRange(s.end ? { start: s.start, end: s.end } : null)}</dd>
                    <dt className="text-muted-foreground">vs. original</dt>
                    <dd>
                      {slip === null ? "—" : slip === 0 ? "On plan" : slip > 0 ? `Ends ${pluralDays(slip)} later` : `Ends ${pluralDays(-slip)} earlier`}
                    </dd>
                    <dt className="text-muted-foreground">Tasks done</dt>
                    <dd className="tabular-nums">
                      {sub.tasks.filter((t) => t.status === "done").length} of {sub.tasks.length}
                    </dd>
                    <dt className="text-muted-foreground">Materials on site</dt>
                    <dd className="tabular-nums">
                      {sub.materials.filter((m) => m.status === "on_site").length} of {sub.materials.length}
                    </dd>
                    {after.length ? (
                      <>
                        <dt className="text-muted-foreground">Starts after</dt>
                        <dd>{after.map((d) => subprojectName(project, d.predecessorId)).join(", ")}</dd>
                      </>
                    ) : null}
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="changes-heading" className="space-y-3">
        <h2 id="changes-heading" className="text-lg font-semibold">
          Recent changes
        </h2>
        <HistoryList
          label="Recent changes"
          entries={project.history.slice(0, 8)}
          subprojectName={(id) => subprojectName(project, id)}
        />
      </section>
    </>
  );
}

type CheckIn = { index: number; total: number; prev: (() => void) | null; next: (() => void) | null };

function SubprojectView({
  project,
  sub,
  overlaps,
  onChange,
  onBack,
  headingRef,
  checkIn,
}: {
  project: ProtoProject;
  sub: ProtoSubproject;
  overlaps: Overlap[];
  onChange: (subproject: ProtoSubproject, log: ChangeLog) => void;
  onBack: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
  checkIn: CheckIn | null;
}) {
  const schedule = schedulesOf([sub])[sub.id];
  const owner = sub.people.find((p) => p.id === sub.ownerId)?.name ?? "the owner";
  const original = project.baseline?.ranges[sub.id];
  const slip = original && schedule.end ? daysBetween(original.end, schedule.end) : null;
  const related = overlaps.filter((o) => o.predecessorId === sub.id || o.successorId === sub.id);
  const after = project.dependencies.filter((d) => d.successorId === sub.id);
  const before = project.dependencies.filter((d) => d.predecessorId === sub.id);
  const history = project.history.filter((h) => h.subprojectId === sub.id);

  return (
    <>
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft aria-hidden="true" /> {project.name}
        </Button>
        {checkIn ? (
          <section
            aria-label="Daily check-in"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-accent p-3 text-accent-foreground"
          >
            <ClipboardCheck aria-hidden="true" className="size-5 shrink-0" />
            <p className="min-w-48 flex-1 text-sm">
              <span className="font-semibold">
                Daily check-in · {checkIn.index + 1} of {checkIn.total}.
              </span>{" "}
              Talk with {owner}, then update the cronograma and materials.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={checkIn.prev ?? undefined} disabled={!checkIn.prev}>
                <ArrowLeft aria-hidden="true" /> Previous
              </Button>
              {checkIn.next ? (
                <Button size="sm" onClick={checkIn.next}>
                  Next subproject <ArrowRight aria-hidden="true" />
                </Button>
              ) : (
                <Button size="sm" onClick={onBack}>
                  Finish check-in
                </Button>
              )}
            </div>
          </section>
        ) : null}
        <PageHeader
          title={sub.name}
          headingRef={headingRef}
          actions={<ProgressDonut value={rollupProgress(sub.tasks)} label={`${sub.name} progress`} size={80} />}
          description={
            <>
              Subproject of {project.name} · Owner: {owner} · {formatRange(schedule.end ? { start: schedule.start, end: schedule.end } : null)}
              {slip ? ` · ends ${pluralDays(Math.abs(slip))} ${slip > 0 ? "later" : "earlier"} than the original plan` : slip === 0 ? " · on plan" : ""}
              {after.length ? ` · starts after ${after.map((d) => subprojectName(project, d.predecessorId)).join(", ")}` : ""}
              {before.length ? ` · ${before.map((d) => subprojectName(project, d.successorId)).join(", ")} start after it` : ""}
            </>
          }
        />
      </div>

      <OverlapWarnings project={project} overlaps={related} />

      <Tabs defaultValue="cronograma" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="cronograma">Cronograma ({sub.tasks.length})</TabsTrigger>
          <TabsTrigger value="materials">Materials ({sub.materials.length})</TabsTrigger>
          <TabsTrigger value="people">People ({sub.people.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="cronograma">
          <CronogramaTab project={project} sub={sub} onChange={onChange} />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialsTab sub={sub} onChange={onChange} />
        </TabsContent>
        <TabsContent value="people">
          <PeopleTab sub={sub} onChange={onChange} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryList label={`${sub.name} history`} entries={history} />
        </TabsContent>
      </Tabs>
    </>
  );
}
