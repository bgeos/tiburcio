"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/dal/auth";
import { getMembership, type Membership } from "@/lib/dal/organizations";
import { PROJECT_STATUS_LABELS, canEditProjects, type ProjectStatus } from "@/lib/domain/projects";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { projectSchema } from "@/lib/validation/projects";

export type ProjectFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  /** `savedAt` lets the form tell two saves apart (to close its dialog). */
  | { status: "saved"; savedAt: number };

const NOT_ALLOWED = "Only admins and production managers can change projects.";

/** The organization, if the signed-in person may edit its projects. Checked in every action. */
async function editableOrganization(orgSlug: string): Promise<Membership | null> {
  await requireUser();
  const membership = await getMembership(orgSlug);
  return membership && canEditProjects(membership.role) ? membership : null;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** History entry for a project-level change. A failed log doesn't undo the change. */
async function logActivity(supabase: Supabase, org: Membership, projectId: string, summary: string, details: string[] = []) {
  const { error } = await supabase
    .from("activity_log")
    .insert({ organization_id: org.id, project_id: projectId, summary, details });
  if (error) console.error(`activity_log insert failed for project ${projectId}: ${error.message}`);
}

export async function createProject(
  orgSlug: string,
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parseForm(projectSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  // Echoed back on errors so the form keeps what was typed.
  const values = formDataToObject(formData);

  const org = await editableOrganization(orgSlug);
  if (!org) return { status: "error", message: NOT_ALLOWED, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ organization_id: org.id, ...parsed.data })
    .select("id")
    .single();
  if (error || !data) {
    return { status: "error", message: "Couldn't create the project. Try again.", values };
  }

  await logActivity(supabase, org, data.id, `Project created: ${parsed.data.name}`, [
    `Status: ${PROJECT_STATUS_LABELS[parsed.data.status]}`,
  ]);
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function updateProject(
  orgSlug: string,
  projectId: string,
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parseForm(projectSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  // Echoed back on errors so the form keeps what was typed.
  const values = formDataToObject(formData);

  const org = await editableOrganization(orgSlug);
  if (!org) return { status: "error", message: NOT_ALLOWED, values };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("projects")
    .select("name, description, status")
    .eq("id", projectId)
    .eq("organization_id", org.id)
    .maybeSingle<{ name: string; description: string; status: ProjectStatus }>();
  if (!before) return { status: "error", message: "This project no longer exists.", values };

  const next = parsed.data;
  const changes = [
    before.name !== next.name && `Name: ${before.name} → ${next.name}`,
    before.status !== next.status &&
      `Status: ${PROJECT_STATUS_LABELS[before.status]} → ${PROJECT_STATUS_LABELS[next.status]}`,
    before.description !== next.description && "Description changed",
  ].filter((c): c is string => Boolean(c));
  if (changes.length === 0) return { status: "saved", savedAt: Date.now() };

  const { error } = await supabase.from("projects").update(next).eq("id", projectId).eq("organization_id", org.id);
  if (error) return { status: "error", message: "Couldn't save the project. Try again.", values };

  await logActivity(supabase, org, projectId, `Project updated: ${next.name}`, changes);
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

/** Archive (hide) or restore a project. Projects are never deleted (history stays). */
export async function setProjectArchived(orgSlug: string, projectId: string, archived: boolean): Promise<{ ok: boolean; message?: string }> {
  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", projectId)
    .eq("organization_id", org.id)
    .select("name")
    .maybeSingle<{ name: string }>();
  if (error || !data) return { ok: false, message: "Couldn't update the project. Try again." };

  await logActivity(supabase, org, projectId, `${archived ? "Project archived" : "Project restored"}: ${data.name}`);
  refresh();
  return { ok: true };
}
