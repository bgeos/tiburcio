import { describe, expect, it } from "vitest";
import { countFlags, flagTask, isBlocked, overdueDays } from "./task-flags";
import type { LinkedTask, TaskLink } from "./task-links";

const linked = (id: string, status: LinkedTask["status"]): LinkedTask => ({
  id,
  name: id,
  status,
  subprojectId: "structure",
  subprojectName: "Structure",
  projectId: "stage",
  projectName: "Main Stage",
  color: "blue",
  range: { start: "2027-01-11", end: "2027-01-13" },
});

// Rig sail (14–15 Jan) waits for Set up structure.
const rig = { id: "rig", status: "todo" as const, range: { start: "2027-01-14", end: "2027-01-15" } };
const linkTo = (status: LinkedTask["status"]): TaskLink => ({ id: "l1", predecessor: linked("setup", status), successor: { ...linked("rig", "todo") } });

describe("overdueDays", () => {
  it("counts the days after the planned last day, until the task is done", () => {
    expect(overdueDays("todo", "2027-01-15", "2027-01-15")).toBeNull(); // ends today: not yet
    expect(overdueDays("in_progress", "2027-01-15", "2027-01-17")).toBe(2);
    expect(overdueDays("done", "2027-01-15", "2027-01-17")).toBeNull();
    expect(overdueDays("todo", null, "2027-01-17")).toBeNull();
  });
});

describe("flagTask", () => {
  it("is blocked when marked Blocked", () => {
    expect(isBlocked(flagTask({ ...rig, status: "blocked" }, [], "2027-01-01"))).toBe(true);
  });

  it("is blocked once it's due to start while what it waits for isn't done", () => {
    expect(flagTask(rig, [linkTo("in_progress")], "2027-01-13").waitingFor).toEqual([]); // starts tomorrow: just the plan
    expect(flagTask(rig, [linkTo("in_progress")], "2027-01-14").waitingFor.map((t) => t.id)).toEqual(["setup"]);
    expect(flagTask(rig, [linkTo("done")], "2027-01-14").waitingFor).toEqual([]);
    expect(flagTask({ ...rig, status: "done" }, [linkTo("todo")], "2027-01-14").waitingFor).toEqual([]);
  });

  it("only looks at what the task waits for, not at what waits for it", () => {
    const reversed: TaskLink = { id: "l2", predecessor: { ...linked("rig", "todo") }, successor: linked("dome", "todo") };
    expect(flagTask(rig, [reversed], "2027-01-20").waitingFor).toEqual([]);
  });

  it("counts overdue and blocked tasks", () => {
    expect(countFlags([rig, { id: "x", status: "blocked", range: null }], [linkTo("todo")], "2027-01-20")).toEqual({ overdue: 1, blocked: 2 });
  });
});
