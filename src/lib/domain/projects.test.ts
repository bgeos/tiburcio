import { describe, expect, it } from "vitest";
import { statusFromTasks } from "./projects";

describe("statusFromTasks", () => {
  it("starts a planning project when work starts on a task", () => {
    expect(statusFromTasks("planning", ["todo", "todo"])).toBe("planning");
    expect(statusFromTasks("planning", ["in_progress", "todo"])).toBe("active");
    expect(statusFromTasks("planning", ["blocked", "todo"])).toBe("active");
    expect(statusFromTasks("planning", ["done", "todo"])).toBe("active");
  });

  it("finishes the project when every task is done", () => {
    expect(statusFromTasks("active", ["done", "done"])).toBe("finished");
    expect(statusFromTasks("planning", ["done"])).toBe("finished");
  });

  it("re-opens a finished project when a task is re-opened or added", () => {
    expect(statusFromTasks("finished", ["done", "todo"])).toBe("active");
  });

  it("never goes back to planning, and leaves a project without tasks alone", () => {
    expect(statusFromTasks("active", ["todo", "todo"])).toBe("active");
    expect(statusFromTasks("finished", [])).toBe("finished");
    expect(statusFromTasks("planning", [])).toBe("planning");
  });
});
