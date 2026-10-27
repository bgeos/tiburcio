"use server";

import { refresh } from "next/cache";
import { getProjectDetail } from "@/lib/dal/project-detail";
import { MATERIAL_STATUSES, MATERIAL_STATUS_LABELS, type MaterialStatus } from "@/lib/domain/materials";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { materialSchema, optionalIsoDate } from "@/lib/validation/projects";
import { NOT_ALLOWED, editableOrganization, logActivity } from "./guards";

export type MaterialFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "saved"; savedAt: number };

type Result = { ok: true } | { ok: false; message: string };

/** Authorize, then find the subproject (and the material, if given) as the database sees them. */
async function load(orgSlug: string, projectId: string, subprojectId: string, materialId?: string) {
  const org = await editableOrganization(orgSlug);
  if (!org) return NOT_ALLOWED;
  const project = await getProjectDetail(org, projectId);
  const sub = project?.subprojects.find((s) => s.id === subprojectId);
  if (!sub) return "This subproject no longer exists.";
  const material = materialId ? sub.materials.find((m) => m.id === materialId) : undefined;
  if (materialId && !material) return "This material no longer exists.";
  return { org, sub, material };
}

export async function addMaterial(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  _previous: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  const parsed = parseForm(materialSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  const ctx = await load(orgSlug, projectId, subprojectId);
  if (typeof ctx === "string") return { status: "error", message: ctx, values };

  const supabase = await createClient();
  const { error } = await supabase.from("subproject_materials").insert({
    organization_id: ctx.org.id,
    subproject_id: subprojectId,
    description: parsed.data.description,
    needed_by: parsed.data.neededBy,
    sort_order: ctx.sub.materials.length,
  });
  if (error) return { status: "error", message: "Couldn't add the material. Try again.", values };

  await logActivity(supabase, ctx.org, { projectId, subprojectId, summary: `Material added: ${parsed.data.description}` });
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function setMaterialStatus(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  materialId: string,
  status: MaterialStatus,
): Promise<Result> {
  if (!MATERIAL_STATUSES.includes(status)) return { ok: false, message: "Unknown status." };
  const ctx = await load(orgSlug, projectId, subprojectId, materialId);
  if (typeof ctx === "string") return { ok: false, message: ctx };
  const material = ctx.material!;
  if (material.status === status) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subproject_materials")
    .update({ status })
    .eq("id", materialId)
    .eq("organization_id", ctx.org.id);
  if (error) return { ok: false, message: "Couldn't change the status. Try again." };

  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `${material.description}: ${MATERIAL_STATUS_LABELS[material.status]} → ${MATERIAL_STATUS_LABELS[status]}`,
  });
  refresh();
  return { ok: true };
}

/** When the material must be on site (D-034); empty clears it. Logged in the history. */
export async function setMaterialNeededBy(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  materialId: string,
  date: string,
): Promise<Result> {
  const parsed = optionalIsoDate.safeParse(date);
  if (!parsed.success) return { ok: false, message: "Choose a valid date." };
  const ctx = await load(orgSlug, projectId, subprojectId, materialId);
  if (typeof ctx === "string") return { ok: false, message: ctx };
  const material = ctx.material!;
  if (material.neededBy === parsed.data) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subproject_materials")
    .update({ needed_by: parsed.data })
    .eq("id", materialId)
    .eq("organization_id", ctx.org.id);
  if (error) return { ok: false, message: "Couldn't change the date. Try again." };

  await logActivity(supabase, ctx.org, {
    projectId,
    subprojectId,
    summary: `${material.description}: needed by ${formatDate(material.neededBy)} → ${formatDate(parsed.data)}`,
  });
  refresh();
  return { ok: true };
}

/** Remove a material from the list (archived, not deleted). */
export async function archiveMaterial(
  orgSlug: string,
  projectId: string,
  subprojectId: string,
  materialId: string,
): Promise<Result> {
  const ctx = await load(orgSlug, projectId, subprojectId, materialId);
  if (typeof ctx === "string") return { ok: false, message: ctx };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subproject_materials")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", materialId)
    .eq("organization_id", ctx.org.id);
  if (error) return { ok: false, message: "Couldn't remove the material. Try again." };

  await logActivity(supabase, ctx.org, { projectId, subprojectId, summary: `Material removed: ${ctx.material!.description}` });
  refresh();
  return { ok: true };
}
