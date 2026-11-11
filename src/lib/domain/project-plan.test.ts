import { describe, expect, it } from "vitest";
import { describePlanChange, overlapMessage, overlapWindows, overlapsFor, planRanges, type PlanSubproject } from "./project-plan";

const structure: PlanSubproject = {
  id: "structure",
  name: "Structure",
  startDate: "2027-01-04",
  tasks: [
    { id: "bamboo", name: "Prepare bamboo", durationDays: 3, delayDays: 0 },
    { id: "poles", name: "Assemble poles", durationDays: 4, delayDays: 0 },
    { id: "setup", name: "Set up structure", durationDays: 3, delayDays: 0 },
  ],
};
const shade: PlanSubproject = {
  id: "shade",
  name: "Shade Sail",
  startDate: "2027-01-14",
  tasks: [{ id: "anchors", name: "Install anchors", durationDays: 2, delayDays: 0 }],
};
const empty: PlanSubproject = { id: "dj", name: "DJ Booth", startDate: "2027-01-14", tasks: [] };
const deps = [{ predecessorId: "structure", successorId: "shade" }];

describe("planRanges", () => {
  it("has every task, and subprojects with tasks", () => {
    const ranges = planRanges([structure, empty]);
    expect(ranges.structure).toEqual({ start: "2027-01-04", end: "2027-01-13" });
    expect(ranges.setup).toEqual({ start: "2027-01-11", end: "2027-01-13" });
    expect(ranges.dj).toBeUndefined();
  });
});

describe("overlaps", () => {
  const delayed = { ...structure, tasks: [{ ...structure.tasks[0], durationDays: 6 }, ...structure.tasks.slice(1)] };

  it("finds none when the successor starts the day after", () => {
    expect(overlapsFor([structure, shade], deps)).toEqual([]);
  });

  it("reports the overlap in words and as red days on both bars", () => {
    const overlaps = overlapsFor([delayed, shade], deps);
    expect(overlaps).toEqual([{ ...deps[0], days: 3 }]);
    expect(overlapMessage([delayed, shade], overlaps[0])).toBe(
      "Shade Sail starts 14 Jan, but Structure finishes 16 Jan (3 days overlap).",
    );
    expect(overlapWindows([delayed, shade], overlaps, "structure")).toEqual([{ start: "2027-01-14", end: "2027-01-16" }]);
    expect(overlapWindows([delayed, shade], overlaps, "shade")).toEqual([{ start: "2027-01-14", end: "2027-01-15" }]);
  });
});

describe("describePlanChange", () => {
  it("lists moved dates and the new overlap, without moving other subprojects", () => {
    const later = { ...structure, startDate: "2027-01-05" };
    const change = describePlanChange([structure, shade], [later, shade], deps);
    expect(change.lines).toContain("Structure: 4 Jan – 13 Jan → 5 Jan – 14 Jan");
    expect(change.lines).toContain("Set up structure: 11 Jan – 13 Jan → 12 Jan – 14 Jan");
    expect(change.lines.some((l) => l.startsWith("Shade Sail"))).toBe(false);
    expect(change.newOverlaps).toEqual(["Shade Sail starts 14 Jan, but Structure finishes 14 Jan (1 day overlap)."]);
  });

  it("notices when an overlap goes away", () => {
    const early = { ...shade, startDate: "2027-01-12" };
    const change = describePlanChange([structure, early], [structure, shade], deps);
    expect(change.resolvedOverlaps).toEqual(["Shade Sail no longer overlaps Structure."]);
  });

  it("describes a new subproject", () => {
    const change = describePlanChange([structure], [structure, shade], []);
    expect(change.lines).toEqual(["Install anchors: new, 14 Jan – 15 Jan", "Shade Sail: new, 14 Jan – 15 Jan"]);
  });
});
