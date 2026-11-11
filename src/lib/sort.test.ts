import { describe, expect, it } from "vitest";
import { compareValues, type SortableValue } from "./sort";

function sorted(values: SortableValue[], direction: "asc" | "desc" = "asc") {
  return [...values].sort((a, b) => compareValues(a, b, direction));
}

describe("compareValues", () => {
  it("sorts strings ignoring accents and case", () => {
    expect(sorted(["bambu", "Área de convivência", "arame", "Cola"])).toEqual([
      "arame",
      "Área de convivência",
      "bambu",
      "Cola",
    ]);
  });

  it("sorts strings with embedded numbers naturally", () => {
    expect(sorted(["Área 10", "Área 2", "Área 1"])).toEqual([
      "Área 1",
      "Área 2",
      "Área 10",
    ]);
  });

  it("sorts numbers numerically in both directions", () => {
    expect(sorted([10, 2, 33])).toEqual([2, 10, 33]);
    expect(sorted([10, 2, 33], "desc")).toEqual([33, 10, 2]);
  });

  it("sorts dates chronologically", () => {
    const nov = new Date("2026-11-17");
    const oct = new Date("2026-10-24");
    const dec = new Date("2026-12-26");
    expect(sorted([nov, dec, oct])).toEqual([oct, nov, dec]);
  });

  it("keeps empty values last regardless of direction", () => {
    const asc = sorted([null, 3, undefined, 1, ""]);
    expect(asc.slice(0, 2)).toEqual([1, 3]);
    expect(asc.slice(2)).toEqual(expect.arrayContaining([null, undefined, ""]));
    expect(sorted([null, 3, "", 1], "desc").slice(0, 2)).toEqual([3, 1]);
  });

  it("returns 0 for equal values", () => {
    expect(compareValues("Palco", "palco")).toBe(0);
    expect(compareValues(null, undefined)).toBe(0);
  });
});
