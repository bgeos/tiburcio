"use server";

import { refresh } from "next/cache";
import { getProjectDetail } from "@/lib/dal/project-detail";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { crewSchema } from "@/lib/validation/projects";
import { NOT_ALLOWED, editableOrganization, logActivity } from "./guards";

export type CrewFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "saved"; savedAt: number };

type Result = { ok: true } | { ok: false; message: string };

/** Authorize, then find the subproject (and crew member, if given) as the database sees them. */
async function load(orgSlug: string, projectId: string, subprojectId: string, crewId?: string) {
  const org = await editableOrganization(orgSlug);
  if (!org) return NOT_ALLOWED;
  const project = await getProjectDetail(org, projectId);
  const sub = project?.subprojects.find((s) => s.id === subprojectId);
  if (!sub) return "This subproject no longer exists.";
  const member = crewId ? sub.crew.find((c) => c.id === crewId) : undefined;
  if (crewId && !member) return "This crew member no longer exists.";
  return { org, sub, member };
}

export async function addCrewMember(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  _previous: CrewFormState,
  formData: FormData,
): Promise<CrewFormState> {
  const parsed = parseForm(crewSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  const ctx = await load(orgSlug, projectId, subprojectId);
  if (typeof ctx === "string") return { status: "error", message: ctx, values };

  const supabase = await createClient();
  const { error } = await supabase.from("crew_members").insert({
    organization_id: ctx.org.id,
    subproject_id: subprojectId,
    name: parsed.data.name,
    role: parsed.data.role,
    sort_order: ctx.sub.crew.length,
  });
  if (error) return { status: "error", message: "Couldn't add the crew member. Try again.", values };

  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `Crew added: ${parsed.data.name}${parsed.data.role ? ` (${parsed.data.role})` : ""}`,
  });
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

/** Make a crew member the subproject's owner (the database checks they're its crew). */
export async function setSubprojectOwner(orgSlug: string, projectId: string, subprojectId: string, crewId: string): Promise<Result> {
  const ctx = await load(orgSlug, projectId, subprojectId, crewId);
  if (typeof ctx === "string") return { ok: false, message: ctx };
  if (ctx.sub.ownerCrewId === crewId) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subprojects")
    .update({ owner_crew_id: crewId })
    .eq("id", subprojectId)
    .eq("organization_id", ctx.org.id);
  if (error) return { ok: false, message: "Couldn't change the owner. Try again." };

  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `Owner: ${ctx.sub.ownerName ?? "—"} → ${ctx.member!.name}`,
  });
  refresh();
  return { ok: true };
}

/** Remove someone from the crew (archived). If they were the owner, the subproject has no owner. */
export async function archiveCrewMember(orgSlug: string, projectId: string, subprojectId: string, crewId: string): Promise<Result> {
  const ctx = await load(orgSlug, projectId, subprojectId, crewId);
  if (typeof ctx === "string") return { ok: false, message: ctx };
  const wasOwner = ctx.sub.ownerCrewId === crewId;

  const supabase = await createClient();
  if (wasOwner) {
    const { error } = await supabase
      .from("subprojects")
      .update({ owner_crew_id: null })
      .eq("id", subprojectId)
      .eq("organization_id", ctx.org.id);
    if (error) return { ok: false, message: "Couldn't remove the crew member. Try again." };
  }
  const { error } = await supabase
    .from("crew_members")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", crewId)
    .eq("organization_id", ctx.org.id);
  if (error) return { ok: false, message: "Couldn't remove the crew member. Try again." };

  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `Crew removed: ${ctx.member!.name}`,
    details: wasOwner ? ["They were the owner: the subproject has no owner now."] : [],
  });
  refresh();
  return { ok: true };
}
