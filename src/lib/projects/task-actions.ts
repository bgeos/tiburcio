"use server";

import { refresh } from "next/cache";
import { todayIn } from "@/lib/dates";
import type { Membership } from "@/lib/dal/organizations";
import { getProjectDetail, type ProjectDetail, type TaskView } from "@/lib/dal/project-detail";
import { describePlanChange, type PlanSubproject } from "@/lib/domain/project-plan";
import { STATUS_CATEGORY_LABELS } from "@/lib/domain/status";
import { TASK_STATUSES, withProgress, withStatus, type TaskStatus } from "@/lib/domain/tasks";
import { formatDate, pluralDays } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { progressSchema, taskSchema } from "@/lib/validation/projects";
import { NOT_ALLOWED, editableOrganization, logActivity } from "./guards";

export type TaskFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "saved"; savedAt: number };

type Result = { ok: true } | { ok: false; message: string };

type Context = { org: Membership; project: ProjectDetail; plan: PlanSubproject[] };

/** Authorize, then load the project as the database sees it now. */
async function load(orgSlug: string, projectId: string, subprojectId: string): Promise<Context | string> {
  const org = await editableOrganization(orgSlug);
  if (!org) return NOT_ALLOWED;
  const project = await getProjectDetail(org, projectId);
  if (!project || !project.subprojects.some((s) => s.id === subprojectId)) return "This subproject no longer exists.";
  return { org, project, plan: project.subprojects };
}

/** History lines for a schedule change: which dates moved and which overlaps appeared. */
function scheduleDetails(ctx: Context, after: PlanSubproject[]): string[] {
  const change = describePlanChange(ctx.plan, after, ctx.project.dependencies, ctx.project.taskLinks, ctx.project.id);
  return [...change.lines, ...change.newOverlaps.map((o) => `Overlap: ${o}`)];
}

function replaceTasks(plan: PlanSubproject[], subprojectId: string, tasks: PlanSubproject["tasks"]): PlanSubproject[] {
  return plan.map((s) => (s.id === subprojectId ? { ...s, tasks } : s));
}

export async function addTask(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  _previous: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const parsed = parseForm(taskSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  const ctx = await load(orgSlug, projectId, subprojectId);
  if (typeof ctx === "string") return { status: "error", message: ctx, values };
  const sub = ctx.plan.find((s) => s.id === subprojectId)!;

  const supabase = await createClient();
  // New tasks go at the end of the cronograma (after archived ones too, so order never collides).
  const { data: last } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("subproject_id", subprojectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  const { name, durationDays, delayDays, reason } = parsed.data;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: ctx.org.id,
      subproject_id: subprojectId,
      name,
      duration_days: durationDays,
      delay_days: delayDays,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "Couldn't add the task. Try again.", values };

  const after = replaceTasks(ctx.plan, subprojectId, [...sub.tasks, { id: data.id, name, durationDays, delayDays }]);
  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `Task added: ${name} (${pluralDays(durationDays)})`,
    details: scheduleDetails(ctx, after),
    reason,
  });
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function updateTask(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  taskId: string,
  _previous: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const parsed = parseForm(taskSchema, formData);
  const progress = progressSchema.safeParse(formData.get("progress") ?? "0");
  if (!parsed.success || !progress.success) {
    const fieldErrors: FieldErrors = parsed.success ? {} : parsed.fieldErrors;
    if (!progress.success) fieldErrors.progress = [progress.error.issues[0].message];
    return { status: "invalid", fieldErrors, values: formDataToObject(formData) };
  }
  const values = formDataToObject(formData);

  const ctx = await load(orgSlug, projectId, subprojectId);
  if (typeof ctx === "string") return { status: "error", message: ctx, values };
  const sub = ctx.project.subprojects.find((s) => s.id === subprojectId)!;
  const task = sub.tasks.find((t) => t.id === taskId);
  if (!task) return { status: "error", message: "This task no longer exists.", values };

  const { name, durationDays, delayDays, reason } = parsed.data;
  const oldProgress = task.status === "done" ? 100 : (task.progress ?? 0);
  const changes = [
    name !== task.name && `renamed to “${name}”`,
    durationDays !== task.durationDays && `duration ${task.durationDays} → ${pluralDays(durationDays)}`,
    delayDays !== task.delayDays && `wait ${task.delayDays} → ${pluralDays(delayDays)}`,
    progress.data !== oldProgress && `progress ${oldProgress}% → ${progress.data}%`,
  ].filter((c): c is string => Boolean(c));
  if (changes.length === 0) return { status: "saved", savedAt: Date.now() };

  const state = progress.data === oldProgress ? task : withProgress(task, progress.data, todayIn(ctx.org.timezone));
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      name,
      duration_days: durationDays,
      delay_days: delayDays,
      status: state.status,
      progress: state.progress,
      actual_start: state.actualStart,
      actual_end: state.actualEnd,
    })
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id);
  if (error) return { status: "error", message: "Couldn't save the task. Try again.", values };

  const after = replaceTasks(
    ctx.plan,
    subprojectId,
    sub.tasks.map((t) => (t.id === taskId ? { ...t, name, durationDays, delayDays } : t)),
  );
  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `${task.name}: ${changes.join(", ")}`,
    details: [...actualDetails(task, state), ...scheduleDetails(ctx, after)],
    reason,
  });
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

function actualDetails(before: TaskView, after: Pick<TaskView, "actualStart" | "actualEnd">): string[] {
  return [
    before.actualStart !== after.actualStart && `Actual start: ${formatDate(after.actualStart)}`,
    before.actualEnd !== after.actualEnd && `Actual end: ${formatDate(after.actualEnd)}`,
  ].filter((d): d is string => Boolean(d));
}

/** Change a task's status; actual dates and progress follow (withStatus). */
export async function setTaskStatus(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  taskId: string,
  status: TaskStatus,
): Promise<Result> {
  if (!TASK_STATUSES.includes(status)) return { ok: false, message: "Unknown status." };
  const ctx = await load(orgSlug, projectId, subprojectId);
  if (typeof ctx === "string") return { ok: false, message: ctx };
  const task = ctx.project.subprojects.find((s) => s.id === subprojectId)!.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, message: "This task no longer exists." };
  if (task.status === status) return { ok: true };

  const next = withStatus(task, status, todayIn(ctx.org.timezone));
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: next.status, progress: next.progress, actual_start: next.actualStart, actual_end: next.actualEnd })
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id);
  if (error) return { ok: false, message: "Couldn't change the status. Try again." };

  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `${task.name}: ${STATUS_CATEGORY_LABELS[task.status]} → ${STATUS_CATEGORY_LABELS[status]}`,
    details: actualDetails(task, next),
  });
  refresh();
  return { ok: true };
}

/** Remove a task from the cronograma (archived, not deleted). Later tasks move earlier. */
export async function archiveTask(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  taskId: string,
  reason: string,
): Promise<Result> {
  const ctx = await load(orgSlug, projectId, subprojectId);
  if (typeof ctx === "string") return { ok: false, message: ctx };
  const sub = ctx.plan.find((s) => s.id === subprojectId)!;
  const task = sub.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, message: "This task no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id);
  if (error) return { ok: false, message: "Couldn't remove the task. Try again." };

  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `Task removed: ${task.name}`,
    details: scheduleDetails(ctx, replaceTasks(ctx.plan, subprojectId, sub.tasks.filter((t) => t.id !== taskId))),
    reason: reason.slice(0, 1000),
  });
  refresh();
  return { ok: true };
}
