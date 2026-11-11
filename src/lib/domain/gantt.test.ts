import { describe, expect, it } from "vitest";
import { arrowPath, ganttMonths, ganttScale, ganttTicks } from "./gantt";

describe("ganttScale", () => {
  it("adds a day of room on each side, 36 px a day at day zoom", () => {
    const scale = ganttScale(["2027-01-04", "2027-01-10"], "2026-12-01", "day");
    expect([scale.first, scale.last, scale.days, scale.width]).toEqual(["2027-01-03", "2027-01-11", 9, 324]);
    expect(scale.x("2027-01-04")).toBe(36);
    expect(scale.w({ start: "2027-01-04", end: "2027-01-06" })).toBe(108);
  });

  it("covers whole weeks, Monday to Sunday, at week zoom", () => {
    // 4 Jan 2027 is a Monday.
    const scale = ganttScale(["2027-01-06", "2027-01-12"], "2026-12-01", "week");
    expect([scale.first, scale.last, scale.dayWidth]).toEqual(["2027-01-04", "2027-01-17", 12]);
  });

  it("shows today alone when there are no dates", () => {
    expect(ganttScale([], "2027-01-05", "day").days).toBe(3);
  });

  it("doesn't add a spare week at week zoom", () => {
    // 3 Mar 2031 is a Monday: the chart starts that day, not the week before.
    expect(ganttScale(["2031-03-03", "2031-03-14"], "2026-12-01", "week").first).toBe("2031-03-03");
  });
});

describe("ganttTicks and ganttMonths", () => {
  it("numbers every day, with month names at the start and on the 1st", () => {
    const scale = ganttScale(["2027-01-20", "2027-02-01"], "2026-12-01", "day");
    expect(ganttTicks(scale, "day").map((t) => t.label)).toEqual(["19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "1", "2"]);
    expect(ganttMonths(scale).map((m) => m.label)).toEqual(["Jan 2027", "Feb 2027"]);
  });

  it("keeps only the later month when two would overlap", () => {
    // The chart starts on 31 Jan: "Jan 2027" would run into "Feb 2027" one day later.
    expect(ganttMonths(ganttScale(["2027-02-01", "2027-02-05"], "2026-12-01", "day")).map((m) => m.label)).toEqual(["Feb 2027"]);
  });

  it("numbers Mondays at week zoom", () => {
    const ticks = ganttTicks(ganttScale(["2027-01-06", "2027-01-12"], "2026-12-01", "week"), "week");
    expect(ticks.map((t) => t.label)).toEqual(["4", "11"]);
  });
});

describe("arrowPath", () => {
  it("goes straight across and down when the successor starts later", () => {
    expect(arrowPath({ x: 0, w: 72, row: 0 }, { x: 108, row: 2 })).toEqual({ path: "M 72 18 H 78 V 90 H 108", late: false });
  });

  it("loops back between the rows, in red, when the successor starts too early", () => {
    expect(arrowPath({ x: 0, w: 72, row: 0 }, { x: 36, row: 2 })).toEqual({
      path: "M 72 18 H 78 V 72 H 30 V 90 H 36",
      late: true,
    });
  });
});
