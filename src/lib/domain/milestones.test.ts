import { describe, expect, it } from "vitest";
import { milestoneMissMessage, milestoneMissWindows, milestoneMisses, upcomingMilestones, type MilestoneLink } from "./milestones";
import { describePlanChange } from "./project-plan";
import type { LinkedTask } from "./task-links";

const rig: LinkedTask = {
  id: "rig",
  name: "Rig sail",
  status: "todo",
  subprojectId: "shade",
  subprojectName: "Shade Sail",
  projectId: "stage",
  projectName: "Main Stage",
  color: "aqua",
  range: { start: "2027-01-18", end: "2027-01-19" },
};
const opens = { id: "m1", name: "Festival opens", date: "2027-01-20" };
const link: MilestoneLink = { id: "l1", milestone: opens, task: rig };

describe("milestone misses", () => {
  it("is fine when the task ends the day before", () => {
    expect(milestoneMisses([link])).toEqual([]);
  });

  it("is late from the milestone's day to the task's end", () => {
    const late = { ...link, task: { ...rig, range: { start: "2027-01-19", end: "2027-01-21" } } };
    const [miss] = milestoneMisses([late]);
    expect(miss.days).toBe(2);
    expect(milestoneMissMessage(miss, "stage")).toBe(
      "Rig sail (Shade Sail) finishes 21 Jan, but must be done before Festival opens (20 Jan): 2 days late.",
    );
    expect(milestoneMissWindows([miss], "rig")).toEqual([{ start: "2027-01-20", end: "2027-01-21" }]);
  });

  it("previews a change with other dates", () => {
    const ranges = { rig: { start: "2027-01-19", end: "2027-01-20" } };
    expect(milestoneMisses([link], ranges).map((m) => m.days)).toEqual([1]);
  });

  it("ignores tasks without dates", () => {
    expect(milestoneMisses([{ ...link, task: { ...rig, range: null } }])).toEqual([]);
  });
});

describe("upcomingMilestones", () => {
  it("lists today's and later ones, soonest first, with the days left", () => {
    const list = upcomingMilestones(
      [opens, { id: "m0", name: "Deadline", date: "2027-01-15" }, { id: "past", name: "Kick-off", date: "2027-01-01" }],
      "2027-01-15",
    );
    expect(list.map((m) => [m.name, m.daysLeft])).toEqual([
      ["Deadline", 0],
      ["Festival opens", 5],
    ]);
  });
});

describe("plan previews", () => {
  it("warn when a change makes a task run into its milestone, and when it's fixed", () => {
    // Shade Sail starts 18 Jan: Rig sail (2 days) ends 19 Jan. Three days makes it end on the 20th.
    const plan = [{ id: "shade", name: "Shade Sail", startDate: "2027-01-18", tasks: [{ id: "rig", name: "Rig sail", durationDays: 2, delayDays: 0 }] }];
    const longer = [{ ...plan[0], tasks: [{ ...plan[0].tasks[0], durationDays: 3 }] }];
    expect(describePlanChange(plan, longer, [], [], "stage", [link]).newOverlaps).toEqual([
      "Rig sail (Shade Sail) finishes 20 Jan, but must be done before Festival opens (20 Jan): 1 day late.",
    ]);
    expect(describePlanChange(longer, plan, [], [], "stage", [link]).resolvedOverlaps).toEqual([
      "Rig sail (Shade Sail) is done before Festival opens again.",
    ]);
  });
});
