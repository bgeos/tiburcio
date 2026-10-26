import {
  createDemoProjects,
  planRanges,
  type ProtoProject,
  type ProtoSubproject,
} from "@/lib/demo/demo-projects";
import {
  diffRanges,
  findOverlaps,
  scheduleSubproject,
  type Overlap,
  type SubprojectSchedule,
} from "@/lib/domain/schedule";

import { formatDate, formatRange, pluralDays } from "@/lib/format";

export { formatDate, formatRange, pluralDays };

export function schedulesOf(subprojects: ProtoSubproject[]): Record<string, SubprojectSchedule> {
  return Object.fromEntries(subprojects.map((s) => [s.id, scheduleSubproject(s.start, s.tasks)]));
}

export function overlapsOf(project: ProtoProject): Overlap[] {
  return findOverlaps(schedulesOf(project.subprojects), project.dependencies);
}

export function subprojectName(project: ProtoProject, id: string): string {
  return project.subprojects.find((s) => s.id === id)?.name ?? "—";
}

export function overlapMessage(project: ProtoProject, overlap: Overlap): string {
  const schedules = schedulesOf(project.subprojects);
  const pred = subprojectName(project, overlap.predecessorId);
  const succ = subprojectName(project, overlap.successorId);
  return `${succ} starts ${formatDate(schedules[overlap.successorId].start)}, but ${pred} finishes ${formatDate(
    schedules[overlap.predecessorId].end,
  )} (${pluralDays(overlap.days)} overlap).`;
}

export type ChangePreview = {
  next: ProtoProject;
  /** Human-readable date changes, e.g. "Assemble poles: 7 – 10 Jan → 8 – 11 Jan". */
  lines: string[];
  newOverlaps: string[];
  resolvedOverlaps: string[];
};

function overlapKey(o: Overlap) {
  return `${o.predecessorId}>${o.successorId}`;
}

/** What replacing one subproject would change: the preview shown before applying. */
export function previewChange(project: ProtoProject, nextSub: ProtoSubproject): ChangePreview {
  const next = {
    ...project,
    subprojects: project.subprojects.map((s) => (s.id === nextSub.id ? nextSub : s)),
  };
  const before = planRanges(project.subprojects);
  const after = planRanges(next.subprojects);
  const names = new Map<string, string>();
  for (const sub of [...project.subprojects, nextSub]) {
    names.set(sub.id, sub.name);
    for (const t of sub.tasks) names.set(t.id, t.name);
  }

  const lines = diffRanges(before, after).map(
    (c) => `${names.get(c.id)}: ${formatRange(c.before)} → ${formatRange(c.after)}`,
  );
  for (const id of Object.keys(after)) {
    if (!before[id]) lines.push(`${names.get(id)}: new, ${formatRange(after[id])}`);
  }
  for (const id of Object.keys(before)) {
    if (!after[id]) lines.push(`${names.get(id)}: removed`);
  }

  const oldOverlaps = new Map(overlapsOf(project).map((o) => [overlapKey(o), o]));
  const newOverlaps = new Map(overlapsOf(next).map((o) => [overlapKey(o), o]));
  return {
    next,
    lines,
    newOverlaps: [...newOverlaps.entries()]
      .filter(([key, o]) => oldOverlaps.get(key)?.days !== o.days)
      .map(([, o]) => overlapMessage(next, o)),
    resolvedOverlaps: [...oldOverlaps.keys()]
      .filter((key) => !newOverlaps.has(key))
      .map((key) => {
        const o = oldOverlaps.get(key)!;
        return `${subprojectName(next, o.successorId)} no longer overlaps ${subprojectName(next, o.predecessorId)}.`;
      }),
  };
}

export type ChangeLog = { summary: string; details?: string[]; reason?: string | null };

export type PrototypeAction =
  | { type: "replaceSubproject"; subproject: ProtoSubproject; log: ChangeLog }
  | { type: "lockPlan" };

function withEntry(project: ProtoProject, subprojectId: string | null, log: ChangeLog): ProtoProject {
  return {
    ...project,
    history: [
      {
        id: crypto.randomUUID(),
        on: project.today,
        subprojectId,
        summary: log.summary,
        details: log.details ?? [],
        reason: log.reason?.trim() || null,
      },
      ...project.history,
    ],
  };
}

export function prototypeReducer(project: ProtoProject, action: PrototypeAction): ProtoProject {
  switch (action.type) {
    case "replaceSubproject":
      return withEntry(
        {
          ...project,
          subprojects: project.subprojects.map((s) => (s.id === action.subproject.id ? action.subproject : s)),
        },
        action.subproject.id,
        action.log,
      );
    case "lockPlan":
      return withEntry(
        { ...project, baseline: { lockedOn: project.today, ranges: planRanges(project.subprojects) } },
        null,
        { summary: "Plan locked", details: ["Current dates saved as the original plan."] },
      );
  }
}

/** All demo projects; changes go to one project at a time. */
export type PrototypeState = { projects: ProtoProject[] };

export type PrototypeStateAction =
  | { type: "project"; projectId: string; action: PrototypeAction }
  | { type: "reset" };

export function createPrototypeState(): PrototypeState {
  return { projects: createDemoProjects() };
}

export function prototypeStateReducer(state: PrototypeState, action: PrototypeStateAction): PrototypeState {
  if (action.type === "reset") return createPrototypeState();
  return {
    projects: state.projects.map((p) => (p.id === action.projectId ? prototypeReducer(p, action.action) : p)),
  };
}
