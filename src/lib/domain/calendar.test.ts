import { describe, expect, it } from "vitest";
import { dayOf, isIsoDate, itemsOn, monthWeeks, periodLabel, shiftPeriod, weekDays, weekStart } from "./calendar";

describe("calendar dates", () => {
  it("starts weeks on Monday", () => {
    // 6 Mar 2031 is a Thursday.
    expect(weekStart("2031-03-06")).toBe("2031-03-03");
    expect(weekDays("2031-03-09")).toEqual(["2031-03-03", "2031-03-04", "2031-03-05", "2031-03-06", "2031-03-07", "2031-03-08", "2031-03-09"]);
  });

  it("covers a month with whole weeks", () => {
    // March 2031: Saturday 1st to Monday 31st → 6 weeks, from 24 Feb to 6 Apr.
    const weeks = monthWeeks("2031-03-15");
    expect(weeks).toHaveLength(6);
    expect([weeks[0][0], weeks[5][6]]).toEqual(["2031-02-24", "2031-04-06"]);
  });

  it("moves by months and weeks", () => {
    expect(shiftPeriod("2031-01-31", "month", 1)).toBe("2031-02-01");
    expect(shiftPeriod("2031-01-15", "month", -1)).toBe("2030-12-01");
    expect(shiftPeriod("2031-03-06", "week", 1)).toBe("2031-03-10");
  });

  it("names the period", () => {
    expect(periodLabel("2031-03-06", "month")).toBe("March 2031");
    expect(periodLabel("2031-03-06", "week")).toBe("3 – 9 Mar 2031");
    expect(periodLabel("2031-03-31", "week")).toBe("31 Mar – 6 Apr 2031");
  });

  it("accepts only real dates", () => {
    expect(isIsoDate("2031-02-28")).toBe(true);
    expect(isIsoDate("2031-02-30")).toBe(false);
    expect(isIsoDate("tomorrow")).toBe(false);
  });
});

describe("itemsOn", () => {
  const build = { id: "t1", range: { start: "2031-03-04", end: "2031-03-07" } };
  const opens = { id: "m1", name: "Festival opens", date: "2031-03-08" };

  it("lists the tasks running that day and the milestones on it", () => {
    expect(itemsOn("2031-03-04", [build], [opens]).tasks).toEqual([build]);
    expect(itemsOn("2031-03-07", [build], [opens]).tasks).toEqual([build]);
    expect(itemsOn("2031-03-08", [build], [opens])).toEqual({ tasks: [], milestones: [opens] });
  });

  it("says which day of the task it is", () => {
    expect(dayOf(build.range, "2031-03-05")).toBe("day 2 of 4");
  });
});
