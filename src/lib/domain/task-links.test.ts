import { describe, expect, it } from "vitest";
import { describePlanChange, type PlanSubproject } from "./project-plan";
import { taskOverlapMessage, taskOverlapWindows, taskOverlaps, taskPlace, type LinkedTask, type TaskLink } from "./task-links";

const end = (over: Partial<LinkedTask> & Pick<LinkedTask, "id" | "name" | "subprojectName">): LinkedTask => ({
  subprojectId: over.subprojectName,
  projectId: "stage",
  projectName: "Main Stage",
  color: "blue",
  range: null,
  ...over,
});

// Structure: Assemble poles 4–10 Jan, Set up structure 11–13 Jan.
// Shade Sail (starts 7 Jan): Sew sail 7–10 Jan, Rig sail 11–12 Jan, waiting for Set up structure.
const plan: PlanSubproject[] = [
  {
    id: "structure",
    name: "Structure",
    startDate: "2027-01-04",
    tasks: [
      { id: "poles", name: "Assemble poles", durationDays: 7, delayDays: 0 },
      { id: "setup", name: "Set up structure", durationDays: 3, delayDays: 0 },
    ],
  },
  {
    id: "shade",
    name: "Shade Sail",
    startDate: "2027-01-07",
    tasks: [
      { id: "sew", name: "Sew sail", durationDays: 4, delayDays: 0 },
      { id: "rig", name: "Rig sail", durationDays: 2, delayDays: 3 },
    ],
  },
];
const setup = end({ id: "setup", name: "Set up structure", subprojectName: "Structure", range: { start: "2027-01-11", end: "2027-01-13" } });
const rig = end({ id: "rig", name: "Rig sail", subprojectName: "Shade Sail", range: { start: "2027-01-14", end: "2027-01-15" } });
const link: TaskLink = { id: "l1", predecessor: setup, successor: rig };

describe("task links", () => {
  it("report no overlap when the successor starts after the predecessor finishes", () => {
    expect(taskOverlaps([link])).toEqual([]);
  });

  it("report the overlapping days and say where each task is", () => {
    const late = { ...link, successor: { ...rig, range: { start: "2027-01-12", end: "2027-01-13" } } };
    const [overlap] = taskOverlaps([late]);
    expect(overlap.days).toBe(2);
    expect(taskOverlapMessage(overlap, "stage")).toBe(
      "Rig sail (Shade Sail) starts 12 Jan, but Set up structure (Structure) finishes 13 Jan (2 days overlap).",
    );
    expect(taskOverlapWindows([overlap], "rig")).toEqual([{ start: "2027-01-12", end: "2027-01-13" }]);
    expect(taskOverlapWindows([overlap], "setup")).toEqual([{ start: "2027-01-12", end: "2027-01-13" }]);
  });

  it("name the project when the other task is in another project", () => {
    const dome = end({ id: "dome", name: "Build dome", subprojectName: "Dome", projectId: "garden", projectName: "Chill-out Garden" });
    expect(taskPlace(dome, "stage")).toBe("Build dome (Chill-out Garden › Dome)");
    expect(taskPlace(rig, "stage")).toBe("Rig sail (Shade Sail)");
  });

  it("appear in the preview when a longer task pushes into a linked task, and nothing else moves", () => {
    const after = plan.map((s) =>
      s.id === "structure" ? { ...s, tasks: s.tasks.map((t) => (t.id === "poles" ? { ...t, durationDays: 9 } : t)) } : s,
    );
    const change = describePlanChange(plan, after, [], [link], "stage");
    expect(change.lines).toContain("Set up structure: 11 Jan – 13 Jan → 13 Jan – 15 Jan");
    expect(change.lines.some((l) => l.startsWith("Rig sail"))).toBe(false);
    expect(change.newOverlaps).toEqual([
      "Rig sail (Shade Sail) starts 14 Jan, but Set up structure (Structure) finishes 15 Jan (2 days overlap).",
    ]);

    const back = describePlanChange(after, plan, [], [link], "stage");
    expect(back.resolvedOverlaps).toEqual(["Rig sail (Shade Sail) no longer overlaps Set up structure (Structure)."]);
  });

  it("drop out when one of the tasks is removed from the plan", () => {
    const late = plan.map((s) =>
      s.id === "structure" ? { ...s, tasks: s.tasks.map((t) => (t.id === "poles" ? { ...t, durationDays: 9 } : t)) } : s,
    );
    const withoutRig = late.map((s) => (s.id === "shade" ? { ...s, tasks: s.tasks.filter((t) => t.id !== "rig") } : s));
    expect(describePlanChange(late, withoutRig, [], [link], "stage").resolvedOverlaps).toEqual([
      "Rig sail (Shade Sail) no longer overlaps Set up structure (Structure).",
    ]);
  });
});
