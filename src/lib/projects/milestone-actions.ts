"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectDetail } from "@/lib/dal/project-detail";
import { milestoneMissMessage, milestoneMisses } from "@/lib/domain/milestones";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { milestoneSchema } from "@/lib/validation/projects";
import { NOT_ALLOWED, editableOrganization, logActivity } from "./guards";

export type MilestoneFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "saved"; savedAt: number };

type Result = { ok: true } | { ok: false; message: string };

/** Add a milestone (no `milestoneId`) or change one. Shown in every project (D-030). */
export async function saveMilestone(
  orgSlug: string,
  milestoneId: string | null,
  _previous: MilestoneFormState,
  formData: FormData,
): Promise<MilestoneFormState> {
  const parsed = parseForm(milestoneSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  const org = await editableOrganization(orgSlug);
  if (!org) return { status: "error", message: NOT_ALLOWED, values };

  const supabase = await createClient();
  const { name, date } = parsed.data;
  const { data, error } = milestoneId
    ? await supabase.from("milestones").update({ name, date }).eq("id", milestoneId).eq("organization_id", org.id).select("id")
    : await supabase.from("milestones").insert({ organization_id: org.id, name, date }).select("id");
  if (error) return { status: "error", message: "Couldn't save the milestone. Try again.", values };
  if (data.length === 0) return { status: "error", message: "This milestone no longer exists.", values };
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

/** Delete a milestone; its "must be done before" links go with it. */
export async function deleteMilestone(orgSlug: string, milestoneId: string): Promise<Result> {
  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").delete().eq("id", milestoneId).eq("organization_id", org.id);
  if (error) return { ok: false, message: "Couldn't delete the milestone. Try again." };
  refresh();
  return { ok: true };
}

const linkIds = z.object({ taskId: z.uuid(), milestoneId: z.uuid() });

/** "This task must be done before that milestone." Nothing moves; a miss is shown in red. */
export async function addMilestoneLink(orgSlug: string, projectId: string, taskId: string, milestoneId: string): Promise<Result> {
  if (!linkIds.safeParse({ taskId, milestoneId }).success) return { ok: false, message: "Choose a milestone." };
  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };
  const project = await getProjectDetail(org, projectId);
  const sub = project?.subprojects.find((s) => s.tasks.some((t) => t.id === taskId));
  if (!project || !sub) return { ok: false, message: "This task no longer exists." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_milestones")
    .insert({ organization_id: org.id, task_id: taskId, milestone_id: milestoneId })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, message: "This task is already linked to that milestone." };
    return { ok: false, message: "Couldn't add the milestone. Try again." };
  }

  const link = (await getProjectDetail(org, projectId))?.milestoneLinks.find((l) => l.id === data.id);
  if (link) {
    await logActivity(supabase, org, {
      projectId,
      subprojectId: sub.id,
      summary: `${link.task.name} must be done before ${link.milestone.name} (${formatDate(link.milestone.date)})`,
      details: milestoneMisses([link]).map((m) => `Late: ${milestoneMissMessage(m, projectId)}`),
    });
  }
  refresh();
  return { ok: true };
}

export async function removeMilestoneLink(orgSlug: string, projectId: string, linkId: string): Promise<Result> {
  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };
  const link = (await getProjectDetail(org, projectId))?.milestoneLinks.find((l) => l.id === linkId);
  if (!link) return { ok: false, message: "This link no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_milestones").delete().eq("id", linkId).eq("organization_id", org.id);
  if (error) return { ok: false, message: "Couldn't remove the milestone. Try again." };

  await logActivity(supabase, org, {
    projectId,
    subprojectId: link.task.subprojectId,
    summary: `${link.task.name} no longer has to be done before ${link.milestone.name}`,
  });
  refresh();
  return { ok: true };
}
