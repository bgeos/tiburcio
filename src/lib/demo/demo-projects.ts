import type { StatusCategory } from "@/lib/domain/status";
import { scheduleSubproject, type Dependency, type DateRange, type IsoDate } from "@/lib/domain/schedule";

/**
 * DEMO DATA — fictional, for the /projects/prototype mock-up only (D-019).
 * Main Stage follows the team's own example; every name is made up.
 * Never import this into real pages, metrics or reports.
 */

export const MATERIAL_STATUSES = ["to_request", "requested", "ready_at_warehouse", "on_site"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  to_request: "To request",
  requested: "Requested",
  ready_at_warehouse: "Ready at warehouse",
  on_site: "On site",
};

export type ProtoTask = {
  id: string;
  name: string;
  durationDays: number;
  /** Days to wait after the previous task before this one starts. */
  delayDays: number;
  status: Exclude<StatusCategory, "cancelled">;
  /** Manual 0–100; done counts as 100 (D-007). */
  progress: number | null;
  actualStart: IsoDate | null;
  actualEnd: IsoDate | null;
};

export type ProtoMaterial = { id: string; description: string; status: MaterialStatus };

export type ProtoPerson = { id: string; name: string; role: string };

export type ProtoSubproject = {
  id: string;
  name: string;
  ownerId: string;
  start: IsoDate;
  tasks: ProtoTask[];
  materials: ProtoMaterial[];
  people: ProtoPerson[];
};

export type HistoryEntry = {
  id: string;
  on: IsoDate;
  /** null = a project-level change. */
  subprojectId: string | null;
  summary: string;
  details: string[];
  reason: string | null;
};

export type Baseline = { lockedOn: IsoDate; ranges: Record<string, DateRange> };

export type ProtoProject = {
  id: string;
  name: string;
  /** The mock-up's "today", fixed so the demo always looks the same. */
  today: IsoDate;
  subprojects: ProtoSubproject[];
  dependencies: Dependency[];
  baseline: Baseline | null;
  history: HistoryEntry[];
};

function task(id: string, name: string, durationDays: number, extra: Partial<ProtoTask> = {}): ProtoTask {
  return { id, name, durationDays, delayDays: 0, status: "todo", progress: null, actualStart: null, actualEnd: null, ...extra };
}

const MAIN_STAGE: ProtoSubproject[] = [
  {
    id: "structure",
    name: "Structure",
    ownerId: "p-tomas",
    start: "2027-01-04",
    tasks: [
      task("t-bamboo", "Prepare bamboo", 3, { status: "in_progress", progress: 60, actualStart: "2027-01-04" }),
      task("t-poles", "Assemble poles", 4),
      task("t-setup", "Set up structure", 3),
    ],
    materials: [
      { id: "m-bamboo", description: "Bamboo poles, 6 m", status: "ready_at_warehouse" },
      { id: "m-screws", description: "Screws, 3 boxes", status: "requested" },
      { id: "m-rigging", description: "Rigging material (shackles, slings)", status: "to_request" },
      { id: "m-cable", description: "Steel cable, 8 mm", status: "requested" },
      { id: "m-logs", description: "Logs for the base", status: "to_request" },
    ],
    people: [
      { id: "p-tomas", name: "Tomás Ferraz", role: "Lead" },
      { id: "p-bia", name: "Bia Santos", role: "Carpenter" },
      { id: "p-davi", name: "Davi Rocha", role: "Rigger" },
      { id: "p-nina", name: "Nina Costa", role: "Assistant" },
    ],
  },
  {
    id: "shade-sail",
    name: "Shade Sail",
    ownerId: "p-lucia",
    start: "2027-01-14",
    tasks: [task("t-anchors", "Install anchors", 2), task("t-tension", "Rig and tension sail", 2)],
    materials: [
      { id: "m-fabric", description: "Shade sail fabric, 12 × 12 m", status: "requested" },
      { id: "m-shackles", description: "Shackles and turnbuckles", status: "to_request" },
      { id: "m-straps", description: "Ratchet straps", status: "on_site" },
    ],
    people: [
      { id: "p-lucia", name: "Lúcia Andrade", role: "Lead" },
      { id: "p-pedro", name: "Pedro Lins", role: "Rigger" },
    ],
  },
  {
    id: "dj-booth",
    name: "DJ Booth",
    ownerId: "p-rafael",
    start: "2027-01-14",
    tasks: [
      task("t-platform", "Build platform", 3),
      task("t-clad", "Clad the front", 2),
      task("t-lights", "Install lighting", 2),
    ],
    materials: [
      { id: "m-plywood", description: "Plywood sheets, 18 mm", status: "ready_at_warehouse" },
      { id: "m-battens", description: "Timber battens", status: "requested" },
      { id: "m-led", description: "LED strips", status: "to_request" },
      { id: "m-paint", description: "Paint, black matt", status: "to_request" },
    ],
    people: [
      { id: "p-rafael", name: "Rafael Duarte", role: "Lead" },
      { id: "p-clara", name: "Clara Mota", role: "Carpenter" },
      { id: "p-jonas", name: "Jonas Reis", role: "Lighting" },
    ],
  },
];

const CHILL_OUT: ProtoSubproject[] = [
  {
    id: "dome",
    name: "Bamboo Dome",
    ownerId: "p-ines",
    start: "2027-01-08",
    tasks: [task("t-cut", "Cut bamboo", 2), task("t-dome", "Build dome", 4)],
    materials: [
      { id: "m-dome-bamboo", description: "Bamboo poles, 4 m", status: "requested" },
      { id: "m-rope", description: "Rope, 10 mm", status: "to_request" },
      { id: "m-net", description: "Shade net", status: "on_site" },
    ],
    people: [
      { id: "p-ines", name: "Inês Carvalho", role: "Lead" },
      { id: "p-leo", name: "Léo Matos", role: "Carpenter" },
    ],
  },
  {
    id: "hammocks",
    name: "Hammock Area",
    ownerId: "p-marcos",
    start: "2027-01-14",
    tasks: [task("t-posts", "Set anchor posts", 2), task("t-hang", "Hang hammocks", 1)],
    materials: [
      { id: "m-hammocks", description: "Hammocks, 12", status: "ready_at_warehouse" },
      { id: "m-posts", description: "Anchor posts", status: "requested" },
    ],
    people: [{ id: "p-marcos", name: "Marcos Teles", role: "Lead" }],
  },
];

/** Planned dates of every subproject and task, keyed by id (used for baselines and diffs). */
export function planRanges(subprojects: ProtoSubproject[]): Record<string, DateRange> {
  const ranges: Record<string, DateRange> = {};
  for (const sub of subprojects) {
    const schedule = scheduleSubproject(sub.start, sub.tasks);
    for (const t of schedule.tasks) ranges[t.id] = { start: t.start, end: t.end };
    if (schedule.end) ranges[sub.id] = { start: schedule.start, end: schedule.end };
  }
  return ranges;
}

function mainStage(): ProtoProject {
  return {
    id: "main-stage",
    name: "Main Stage",
    today: "2027-01-05",
    subprojects: MAIN_STAGE,
    dependencies: [
      { predecessorId: "structure", successorId: "shade-sail" },
      { predecessorId: "structure", successorId: "dj-booth" },
    ],
    baseline: { lockedOn: "2027-01-02", ranges: planRanges(MAIN_STAGE) },
    history: [
      {
        id: "h-3",
        on: "2027-01-04",
        subprojectId: "structure",
        summary: "Bamboo poles, 6 m: Requested → Ready at warehouse",
        details: [],
        reason: null,
      },
      {
        id: "h-2",
        on: "2027-01-04",
        subprojectId: "structure",
        summary: "Prepare bamboo: To do → In progress",
        details: ["Actual start: 4 Jan"],
        reason: null,
      },
      {
        id: "h-1",
        on: "2027-01-02",
        subprojectId: null,
        summary: "Plan locked",
        details: ["Current dates saved as the original plan."],
        reason: null,
      },
    ],
  };
}

function chillOut(): ProtoProject {
  return {
    id: "chill-out",
    name: "Chill-out Garden",
    today: "2027-01-05",
    subprojects: CHILL_OUT,
    dependencies: [],
    baseline: { lockedOn: "2027-01-02", ranges: planRanges(CHILL_OUT) },
    history: [
      {
        id: "h-c1",
        on: "2027-01-02",
        subprojectId: null,
        summary: "Plan locked",
        details: ["Current dates saved as the original plan."],
        reason: null,
      },
    ],
  };
}

export function createDemoProjects(): ProtoProject[] {
  return [mainStage(), chillOut()];
}
