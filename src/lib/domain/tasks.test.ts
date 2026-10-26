import { describe, expect, it } from "vitest";
import { withProgress, withStatus, type TaskProgressState } from "./tasks";

const TODAY = "2027-01-06";
const fresh: TaskProgressState = { status: "todo", progress: null, actualStart: null, actualEnd: null };
const started: TaskProgressState = { status: "in_progress", progress: 60, actualStart: "2027-01-04", actualEnd: null };
const finished: TaskProgressState = { status: "done", progress: 100, actualStart: "2027-01-04", actualEnd: "2027-01-05" };

describe("withStatus", () => {
  it("starting records the actual start once", () => {
    expect(withStatus(fresh, "in_progress", TODAY)).toEqual({ ...fresh, status: "in_progress", actualStart: TODAY });
    expect(withStatus(started, "blocked", TODAY).actualStart).toBe("2027-01-04");
  });

  it("finishing records the actual end and 100 %", () => {
    expect(withStatus(started, "done", TODAY)).toEqual({
      status: "done",
      progress: 100,
      actualStart: "2027-01-04",
      actualEnd: TODAY,
    });
  });

  it("re-opening a finished task clears its end and its 100 %", () => {
    expect(withStatus(finished, "in_progress", TODAY)).toEqual({
      status: "in_progress",
      progress: null,
      actualStart: "2027-01-04",
      actualEnd: null,
    });
  });

  it("back to 'to do' clears what was recorded", () => {
    expect(withStatus(finished, "todo", TODAY)).toEqual(fresh);
  });
});

describe("withProgress", () => {
  it("100 % means done", () => {
    expect(withProgress(started, 100, TODAY).status).toBe("done");
  });

  it("any progress on a task that hadn't started starts it", () => {
    expect(withProgress(fresh, 20, TODAY)).toEqual({ status: "in_progress", progress: 20, actualStart: TODAY, actualEnd: null });
  });

  it("less than 100 % re-opens a finished task", () => {
    expect(withProgress(finished, 80, TODAY)).toEqual({
      status: "in_progress",
      progress: 80,
      actualStart: "2027-01-04",
      actualEnd: null,
    });
  });

  it("keeps a blocked task blocked", () => {
    expect(withProgress({ ...started, status: "blocked" }, 70, TODAY).status).toBe("blocked");
  });

  it("0 % on a task that hasn't started stays not set", () => {
    expect(withProgress(fresh, 0, TODAY)).toEqual(fresh);
  });
});
