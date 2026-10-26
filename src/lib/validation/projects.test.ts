import { describe, expect, it } from "vitest";
import { canEditProjects } from "@/lib/domain/projects";
import { projectSchema } from "./projects";

describe("projectSchema", () => {
  it("trims and accepts a valid project", () => {
    expect(projectSchema.parse({ name: "  Main Stage ", description: " Festival ", status: "active" })).toEqual({
      name: "Main Stage",
      description: "Festival",
      status: "active",
    });
  });

  it("allows an empty description", () => {
    expect(projectSchema.parse({ name: "Main Stage", status: "planning" }).description).toBe("");
  });

  it.each([
    [{ name: "   ", status: "planning" }, "Enter a project name."],
    [{ name: "x".repeat(121), status: "planning" }, "Use at most 120 characters."],
    [{ name: "Main Stage", status: "paused" }, "Choose a status."],
  ])("rejects %j", (input, message) => {
    const result = projectSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe("canEditProjects", () => {
  it("mirrors the database rule", () => {
    expect(canEditProjects("admin")).toBe(true);
    expect(canEditProjects("production_manager")).toBe(true);
    expect(canEditProjects("member")).toBe(false);
    expect(canEditProjects("external")).toBe(false);
  });
});
