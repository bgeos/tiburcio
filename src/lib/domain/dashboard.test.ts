import { describe, expect, it } from "vitest";
import { summarizeDashboard, type DashboardProject, type DashboardTask } from "./dashboard";

const task = (id: string, durationDays: number, status: DashboardTask["status"] = "todo", progress: number | null = null): DashboardTask => ({
  id,
  name: id,
  durationDays,
  delayDays: 0,
  status,
  progress,
});

// Structure 4–13 Jan, Shade Sail starts 13 Jan after Structure: 1 day overlap.
const stage: DashboardProject = {
  id: "p1",
  name: "Main Stage",
  status: "active",
  subprojects: [
    { id: "s1", name: "Structure", startDate: "2027-01-04", tasks: [task("t1", 3, "done"), task("t2", 4, "in_progress", 50), task("t3", 3)] },
    { id: "s2", name: "Shade Sail", startDate: "2027-01-13", tasks: [task("t4", 2, "blocked")] },
  ],
  dependencies: [{ predecessorId: "s1", successorId: "s2" }],
  materialStatuses: ["to_request", "requested", "on_site"],
};

describe("summarizeDashboard", () => {
  it("is empty — not zero — without projects, tasks or materials", () => {
    const summary = summarizeDashboard([], "2027-01-01");
    expect(summary).toMatchObject({ activeProjects: 0, openTasks: null, overdueTasks: null, materialsNotOnSite: null, projects: [] });
  });

  it("counts tasks, materials and overlaps of current projects", () => {
    const summary = summarizeDashboard([stage], "2027-01-01");
    expect(summary.activeProjects).toBe(1);
    expect(summary.openTasks).toBe(3);
    expect(summary.overdueTasks).toBe(0);
    expect(summary.tasksByStatus).toEqual({ todo: 1, in_progress: 1, blocked: 1, done: 1 });
    expect(summary.materialsNotOnSite).toBe(2);
    expect(summary.materialsToRequest).toBe(1);
    expect(summary.projects).toEqual([
      { id: "p1", name: "Main Stage", status: "active", progress: 37.5, taskCount: 4, overlapCount: 1, overdueCount: 0, blockedCount: 1 },
    ]);
  });

  it("adds overlapping task links to the project's overlaps", () => {
    // t3 (Structure) ends 13 Jan; t4 (Shade Sail) starts 13 Jan and waits for it.
    const summary = summarizeDashboard([stage], "2027-01-01", [{ predecessorId: "t3", successorId: "t4" }]);
    expect(summary.projects[0].overlapCount).toBe(2);
    // A link to a task outside the current projects (unknown dates) isn't counted.
    expect(summarizeDashboard([stage], "2027-01-01", [{ predecessorId: "elsewhere", successorId: "t4" }]).projects[0].overlapCount).toBe(1);
  });

  it("counts blocked tasks: marked Blocked, or due to start while what they wait for isn't done", () => {
    // t4 (Shade Sail, 13–14 Jan) is marked Blocked. t3 (Structure, 11–13 Jan) waits for t4 (not done).
    expect(summarizeDashboard([stage], "2027-01-01").blockedTasks).toBe(1);
    const linked = (today: string) => summarizeDashboard([stage], today, [{ predecessorId: "t4", successorId: "t3" }]).blockedTasks;
    expect(linked("2027-01-10")).toBe(1); // t3 starts tomorrow: that's just the plan
    expect(linked("2027-01-11")).toBe(2); // t3 is due to start and still waits
  });

  it("marks unfinished tasks whose planned last day has passed as overdue", () => {
    // t1 (4–6 Jan) is done; t2 ends 10 Jan; today 11 Jan → only t2 is overdue.
    const summary = summarizeDashboard([stage], "2027-01-11");
    expect(summary.overdueTasks).toBe(1);
    expect(summary.projects[0].overdueCount).toBe(1);
    // A task ending today is not overdue yet.
    expect(summarizeDashboard([stage], "2027-01-10").overdueTasks).toBe(0);
  });

  it("leaves finished projects out and counts planning ones separately", () => {
    const summary = summarizeDashboard(
      [
        { ...stage, id: "p2", status: "finished" },
        { ...stage, id: "p3", status: "planning", subprojects: [], dependencies: [], materialStatuses: [] },
      ],
      "2027-02-01",
    );
    expect(summary).toMatchObject({ activeProjects: 0, planningProjects: 1, openTasks: null, overdueTasks: null });
    expect(summary.projects.map((p) => p.id)).toEqual(["p3"]);
    expect(summary.projects[0].progress).toBeNull();
  });
});
