import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  diffRanges,
  findOverlaps,
  scheduleSubproject,
  slipDays,
} from "./schedule";

describe("date helpers", () => {
  it("adds calendar days across month and year ends", () => {
    expect(addDays("2027-01-30", 3)).toBe("2027-02-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2027-01-04", "2027-01-06")).toBe(2);
    expect(daysBetween("2027-01-06", "2027-01-04")).toBe(-2);
  });
});

describe("scheduleSubproject", () => {
  const tasks = [
    { id: "a", durationDays: 3, delayDays: 0 },
    { id: "b", durationDays: 4, delayDays: 0 },
    { id: "c", durationDays: 1, delayDays: 0 },
  ];

  it("runs tasks one after another, counting the start day as day 1", () => {
    const s = scheduleSubproject("2027-03-01", tasks);
    expect(s.tasks).toEqual([
      { id: "a", start: "2027-03-01", end: "2027-03-03" },
      { id: "b", start: "2027-03-04", end: "2027-03-07" },
      { id: "c", start: "2027-03-08", end: "2027-03-08" },
    ]);
    expect(s.end).toBe("2027-03-08");
  });

  it("a longer task pushes every later task in the subproject", () => {
    const s = scheduleSubproject("2027-03-01", [{ ...tasks[0], durationDays: 4 }, ...tasks.slice(1)]);
    expect(s.tasks[1].start).toBe("2027-03-05");
    expect(s.end).toBe("2027-03-09");
  });

  it("a delay waits before the task starts", () => {
    const s = scheduleSubproject("2027-03-01", [tasks[0], { ...tasks[1], delayDays: 2 }]);
    expect(s.tasks[1]).toEqual({ id: "b", start: "2027-03-06", end: "2027-03-09" });
  });

  it("has no end date without tasks", () => {
    expect(scheduleSubproject("2027-03-01", []).end).toBeNull();
  });
});

describe("findOverlaps", () => {
  const structure = scheduleSubproject("2027-01-04", [{ id: "t", durationDays: 10, delayDays: 0 }]);
  const dep = { predecessorId: "structure", successorId: "dj" };

  it("reports nothing when the successor starts the day after", () => {
    const dj = scheduleSubproject("2027-01-14", []);
    expect(findOverlaps({ structure, dj }, [dep])).toEqual([]);
  });

  it("reports the overlap in days, without moving anything", () => {
    const dj = scheduleSubproject("2027-01-12", []);
    expect(findOverlaps({ structure, dj }, [dep])).toEqual([{ ...dep, days: 2 }]);
  });
});

describe("diffRanges", () => {
  it("lists only changed items", () => {
    const before = { a: { start: "2027-01-01", end: "2027-01-02" }, b: { start: "2027-01-03", end: "2027-01-03" } };
    const after = { a: before.a, b: { start: "2027-01-04", end: "2027-01-04" } };
    expect(diffRanges(before, after)).toEqual([{ id: "b", before: before.b, after: after.b }]);
  });
});

describe("slipDays", () => {
  it("is null when a date is missing", () => {
    expect(slipDays(null, "2027-01-01")).toBeNull();
    expect(slipDays("2027-01-01", "2027-01-03")).toBe(2);
  });
});
