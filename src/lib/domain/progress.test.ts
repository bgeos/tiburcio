import { describe, expect, it } from "vitest";
import { itemProgress, rollupProgress } from "./progress";

describe("itemProgress", () => {
  it("done is 100, cancelled is excluded, unset is 0", () => {
    expect(itemProgress({ status: "done", progress: 40 })).toBe(100);
    expect(itemProgress({ status: "cancelled", progress: 50 })).toBeNull();
    expect(itemProgress({ status: "todo", progress: null })).toBe(0);
    expect(itemProgress({ status: "in_progress", progress: 60 })).toBe(60);
  });
});

describe("rollupProgress", () => {
  it("weights every task equally", () => {
    expect(
      rollupProgress([
        { status: "done", progress: null },
        { status: "in_progress", progress: 50 },
        { status: "todo", progress: null },
        { status: "cancelled", progress: null },
      ]),
    ).toBe(50);
  });

  it("is null when there is nothing to count", () => {
    expect(rollupProgress([])).toBeNull();
    expect(rollupProgress([{ status: "cancelled", progress: 10 }])).toBeNull();
  });
});
