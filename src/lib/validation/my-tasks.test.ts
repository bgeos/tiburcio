import { describe, expect, it } from "vitest";
import { sortMyTasks, type MyTask } from "@/lib/domain/my-tasks";
import { myTaskSchema } from "./my-tasks";

describe("myTaskSchema", () => {
  it("trims and accepts a reminder without a description", () => {
    expect(myTaskSchema.parse({ name: "  Call the supplier ", status: "todo", tag: "reminder" })).toEqual({
      name: "Call the supplier",
      description: "",
      status: "todo",
      tag: "reminder",
    });
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
  const task = (id: string, status: MyTask["status"], createdAt: string): MyTask => ({
    id,
    name: id,
    description: "",
    status,
    tag: "todo",
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
});
