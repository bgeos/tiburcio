import { describe, expect, it } from "vitest";
import { canEditProjects } from "@/lib/domain/projects";
import { dependencySchema, projectSchema, subprojectSchema } from "./projects";

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

describe("subprojectSchema", () => {
  it("accepts a name and a real date", () => {
    expect(subprojectSchema.parse({ name: " Structure ", startDate: "2027-01-04" })).toEqual({
      name: "Structure",
      startDate: "2027-01-04",
      reason: "",
    });
  });

  it.each([
    [{ name: "", startDate: "2027-01-04" }, "Enter a subproject name."],
    [{ name: "Structure", startDate: "" }, "Choose a date."],
    [{ name: "Structure", startDate: "2027-02-30" }, "Choose a valid date."],
  ])("rejects %j", (input, message) => {
    expect(subprojectSchema.safeParse(input).error?.issues[0].message).toBe(message);
  });
});

describe("dependencySchema", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";

  it("accepts two different subprojects", () => {
    expect(dependencySchema.safeParse({ successorId: a, predecessorId: b }).success).toBe(true);
  });

  it("refuses a subproject waiting for itself", () => {
    expect(dependencySchema.safeParse({ successorId: a, predecessorId: a }).error?.issues[0].message).toBe(
      "A subproject can't wait for itself.",
    );
  });
});
