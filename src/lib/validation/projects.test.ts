import { describe, expect, it } from "vitest";
import { isMaterialLate } from "@/lib/domain/materials";
import { canEditProjects, canViewProjects } from "@/lib/domain/projects";
import { dependencySchema, materialSchema, progressSchema, projectSchema, subprojectSchema, taskSchema } from "./projects";

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

describe("canViewProjects", () => {
  it("mirrors the database rule: externals see no projects", () => {
    expect(canViewProjects("admin")).toBe(true);
    expect(canViewProjects("production_manager")).toBe(true);
    expect(canViewProjects("member")).toBe(true);
    expect(canViewProjects("external")).toBe(false);
  });
});

describe("subprojectSchema", () => {
  it("accepts a name, a real date and a colour", () => {
    expect(subprojectSchema.parse({ name: " Structure ", startDate: "2027-01-04", color: "aqua" })).toEqual({
      name: "Structure",
      startDate: "2027-01-04",
      color: "aqua",
      reason: "",
    });
  });

  it.each([
    [{ name: "", startDate: "2027-01-04", color: "blue" }, "Enter a subproject name."],
    [{ name: "Structure", startDate: "", color: "blue" }, "Choose a date."],
    [{ name: "Structure", startDate: "2027-02-30", color: "blue" }, "Choose a valid date."],
    [{ name: "Structure", startDate: "2027-01-04", color: "red" }, "Choose a colour."],
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

describe("taskSchema", () => {
  it("reads numbers from the form", () => {
    expect(taskSchema.parse({ name: "Prepare bamboo", durationDays: "3", delayDays: "1" })).toEqual({
      name: "Prepare bamboo",
      durationDays: 3,
      delayDays: 1,
      reason: "",
    });
  });

  it.each([
    [{ name: "X", durationDays: "0" }, "Enter a whole number of days, 1 or more."],
    [{ name: "X", durationDays: "2.5" }, "Enter a whole number of days, 1 or more."],
    [{ name: "X", durationDays: "2", delayDays: "-1" }, "Enter a whole number of days, 0 or more."],
    [{ name: "", durationDays: "2" }, "Enter a task name."],
  ])("rejects %j", (input, message) => {
    expect(taskSchema.safeParse(input).error?.issues[0].message).toBe(message);
  });
});

describe("progressSchema", () => {
  it("accepts 0–100", () => {
    expect(progressSchema.parse("60")).toBe(60);
    expect(progressSchema.safeParse("101").success).toBe(false);
  });
});

describe("materialSchema", () => {
  it("takes an optional needed-by date", () => {
    expect(materialSchema.parse({ description: " Plywood ", neededBy: "2027-01-05" })).toEqual({ description: "Plywood", neededBy: "2027-01-05" });
    expect(materialSchema.parse({ description: "Plywood", neededBy: "" }).neededBy).toBeNull();
    expect(materialSchema.parse({ description: "Plywood" }).neededBy).toBeNull();
    expect(materialSchema.safeParse({ description: "Plywood", neededBy: "5 Jan" }).success).toBe(false);
  });
});

describe("isMaterialLate", () => {
  it("is late when the day has passed and it isn't on site", () => {
    expect(isMaterialLate({ status: "requested", neededBy: "2026-10-26" }, "2026-10-27")).toBe(true);
    expect(isMaterialLate({ status: "requested", neededBy: "2026-10-27" }, "2026-10-27")).toBe(false);
    expect(isMaterialLate({ status: "on_site", neededBy: "2026-10-01" }, "2026-10-27")).toBe(false);
    expect(isMaterialLate({ status: "to_request", neededBy: null }, "2026-10-27")).toBe(false);
  });
});
