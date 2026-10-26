"use server";

import { refresh } from "next/cache";
import { getProjectDetail } from "@/lib/dal/project-detail";
import { describePlanChange, type PlanSubproject } from "@/lib/domain/project-plan";
import { SUBPROJECT_COLOR_LABELS } from "@/lib/domain/subproject-colors";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { dependencySchema, subprojectSchema } from "@/lib/validation/projects";
import { NOT_ALLOWED, editableOrganization, logActivity } from "./guards";

export type SubprojectFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "saved"; savedAt: number };

type Result = { ok: true } | { ok: false; message: string };

export async function createSubproject(
  orgSlug: string,
  projectId: string,
  _previous: SubprojectFormState,
  formData: FormData,
): Promise<SubprojectFormState> {
  const parsed = parseForm(subprojectSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  const org = await editableOrganization(orgSlug);
  if (!org) return { status: "error", message: NOT_ALLOWED, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subprojects")
    .insert({
      organization_id: org.id,
      project_id: projectId,
      name: parsed.data.name,
      start_date: parsed.data.startDate,
      color: parsed.data.color,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "Couldn't add the subproject. Try again.", values };

  await logActivity(supabase, org, {
    projectId,
    subprojectId: data.id,
    summary: `Subproject added: ${parsed.data.name}`,
    details: [`Starts ${formatDate(parsed.data.startDate)}`],
    reason: parsed.data.reason,
  });
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function updateSubproject(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  _previous: SubprojectFormState,
  formData: FormData,
): Promise<SubprojectFormState> {
  const parsed = parseForm(subprojectSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  const org = await editableOrganization(orgSlug);
  if (!org) return { status: "error", message: NOT_ALLOWED, values };

  const project = await getProjectDetail(org, projectId);
  const before = project?.subprojects.find((s) => s.id === subprojectId);
  if (!project || !before) return { status: "error", message: "This subproject no longer exists.", values };

  const { name, startDate, color, reason } = parsed.data;
  if (name === before.name && startDate === before.startDate && color === before.color) {
    return { status: "saved", savedAt: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("subprojects")
    .update({ name, start_date: startDate, color })
    .eq("id", subprojectId)
    .eq("organization_id", org.id);
  if (error) return { status: "error", message: "Couldn't save the subproject. Try again.", values };

  // Describe the change from the database's view of the plan, not the browser's.
  const plan: PlanSubproject[] = project.subprojects;
  const after = plan.map((s) => (s.id === subprojectId ? { ...s, name, startDate } : s));
  const change = describePlanChange(plan, after, project.dependencies, project.taskLinks, project.id);
  const details = [
    name !== before.name && `Name: ${before.name} → ${name}`,
    startDate !== before.startDate && `Start: ${formatDate(before.startDate)} → ${formatDate(startDate)}`,
    color !== before.color && `Colour: ${SUBPROJECT_COLOR_LABELS[before.color]} → ${SUBPROJECT_COLOR_LABELS[color]}`,
    ...change.lines,
    ...change.newOverlaps.map((o) => `Overlap: ${o}`),
  ].filter((d): d is string => Boolean(d));

  await logActivity(supabase, org, { projectId, subprojectId, summary: `${name} updated`, details, reason });
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

/** Archive (hide) or restore a subproject. Its tasks, materials and crew are kept. */
export async function setSubprojectArchived(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  archived: boolean,
): Promise<Result> {
  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subprojects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", subprojectId)
    .eq("project_id", projectId)
    .eq("organization_id", org.id)
    .select("name")
    .maybeSingle<{ name: string }>();
  if (error || !data) return { ok: false, message: "Couldn't update the subproject. Try again." };

  await logActivity(supabase, org, {
    projectId,
    subprojectId,
    summary: `${archived ? "Subproject archived" : "Subproject restored"}: ${data.name}`,
  });
  refresh();
  return { ok: true };
}

export type DependencyFormState = { status: "idle" } | { status: "error"; message: string } | { status: "saved"; savedAt: number };

/** "successor starts after predecessor finishes". Nothing moves; overlaps are reported. */
export async function addDependency(
  orgSlug: string,
  projectId: string,
  _previous: DependencyFormState,
  formData: FormData,
): Promise<DependencyFormState> {
  const parsed = dependencySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

  const org = await editableOrganization(orgSlug);
  if (!org) return { status: "error", message: NOT_ALLOWED };

  const project = await getProjectDetail(org, projectId);
  const name = (id: string) => project?.subprojects.find((s) => s.id === id)?.name;
  const successor = name(parsed.data.successorId);
  const predecessor = name(parsed.data.predecessorId);
  if (!project || !successor || !predecessor) return { status: "error", message: "Choose two subprojects of this project." };

  const supabase = await createClient();
  const { error } = await supabase.from("subproject_dependencies").insert({
    organization_id: org.id,
    project_id: projectId,
    predecessor_id: parsed.data.predecessorId,
    successor_id: parsed.data.successorId,
  });
  if (error) {
    if (error.message.includes("dependency_cycle")) {
      return { status: "error", message: "That would make subprojects wait for each other in a circle." };
    }
    if (error.code === "23505") return { status: "error", message: `${successor} already starts after ${predecessor}.` };
    return { status: "error", message: "Couldn't add the link. Try again." };
  }

  // Dates don't change when linking; only overlaps can appear.
  const links = [...project.dependencies, { id: "new", ...parsed.data }];
  const overlaps = describePlanChange(project.subprojects, project.subprojects, links).newOverlaps;
  await logActivity(supabase, org, {
    projectId,
    subprojectId: parsed.data.successorId,
    summary: `${successor} now starts after ${predecessor}`,
    details: overlaps.map((o) => `Overlap: ${o}`),
  });
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function removeDependency(orgSlug: string, projectId: string, dependencyId: string): Promise<Result> {
  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };

  const project = await getProjectDetail(org, projectId);
  const link = project?.dependencies.find((d) => d.id === dependencyId);
  if (!project || !link) return { ok: false, message: "This link no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subproject_dependencies")
    .delete()
    .eq("id", dependencyId)
    .eq("organization_id", org.id);
  if (error) return { ok: false, message: "Couldn't remove the link. Try again." };

  const name = (id: string) => project.subprojects.find((s) => s.id === id)?.name ?? "—";
  await logActivity(supabase, org, {
    projectId,
    subprojectId: link.successorId,
    summary: `${name(link.successorId)} no longer waits for ${name(link.predecessorId)}`,
  });
  refresh();
  return { ok: true };
}
