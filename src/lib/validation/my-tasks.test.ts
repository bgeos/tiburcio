import { describe, expect, it } from "vitest";
import { isMyTaskOverdue, sortMyTasks, type MyTask } from "@/lib/domain/my-tasks";
import { myTaskSchema } from "./my-tasks";

describe("myTaskSchema", () => {
  it("trims and accepts a reminder without a description", () => {
    expect(myTaskSchema.parse({ name: "  Call the supplier ", status: "todo", tag: "reminder" })).toEqual({
      name: "Call the supplier",
      description: "",
      status: "todo",
      tag: "reminder",
      dueDate: null,
    });
  });

  it("takes an optional date", () => {
    expect(myTaskSchema.parse({ name: "Call", status: "todo", tag: "todo", dueDate: "2027-03-05" }).dueDate).toBe("2027-03-05");
    expect(myTaskSchema.parse({ name: "Call", status: "todo", tag: "todo", dueDate: "" }).dueDate).toBeNull();
    expect(myTaskSchema.safeParse({ name: "Call", status: "todo", tag: "todo", dueDate: "2027-02-30" }).success).toBe(false);
  });

  it.each([
    [{ name: "   ", status: "todo", tag: "todo" }, "Enter a name."],
    [{ name: "x".repeat(201), status: "todo", tag: "todo" }, "Use at most 200 characters."],
    [{ name: "Call", status: "blocked", tag: "todo" }, "Choose a status."],
    [{ name: "Call", status: "todo", tag: "urgent" }, "Choose a tag."],
  ])("rejects %j", (input, message) => {
    const result = myTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe("sortMyTasks", () => {
  const task = (id: string, status: MyTask["status"], createdAt: string, dueDate: string | null = null): MyTask => ({
    id,
    name: id,
    description: "",
    status,
    tag: "todo",
    dueDate,
    createdAt,
  });

  it("puts work in progress first, then to do (newest first), then done", () => {
    const sorted = sortMyTasks([
      task("old todo", "todo", "2026-10-01"),
      task("done", "done", "2026-10-03"),
      task("new todo", "todo", "2026-10-02"),
      task("doing", "in_progress", "2026-09-01"),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["doing", "new todo", "old todo", "done"]);
  });

  it("puts the soonest date first among open tasks; undated ones after", () => {
    const sorted = sortMyTasks([
      task("undated", "todo", "2026-10-09"),
      task("later", "todo", "2026-10-01", "2026-11-20"),
      task("sooner", "todo", "2026-10-02", "2026-11-01"),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["sooner", "later", "undated"]);
  });
});

describe("isMyTaskOverdue", () => {
  it("is overdue when the day has passed and it isn't done", () => {
    expect(isMyTaskOverdue({ status: "todo", dueDate: "2026-10-26" }, "2026-10-27")).toBe(true);
    expect(isMyTaskOverdue({ status: "todo", dueDate: "2026-10-27" }, "2026-10-27")).toBe(false);
    expect(isMyTaskOverdue({ status: "done", dueDate: "2026-10-01" }, "2026-10-27")).toBe(false);
    expect(isMyTaskOverdue({ status: "todo", dueDate: null }, "2026-10-27")).toBe(false);
  });
});
