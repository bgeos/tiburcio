"use server";

import { refresh } from "next/cache";
import { getProjectDetail } from "@/lib/dal/project-detail";
import { planRanges } from "@/lib/domain/project-plan";
import { formatRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { NOT_ALLOWED, editableOrganization, logActivity } from "./guards";

type Result = { ok: true } | { ok: false; message: string };

/**
 * Save today's plan as the "original plan" that delays are measured against.
 * The snapshot is computed here from the database, never sent by the browser;
 * who locked it and when are stamped by the database (P3-12).
 */
export async function lockPlan(orgSlug: string, projectId: string): Promise<Result> {
  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };
  const project = await getProjectDetail(org, projectId);
  if (!project) return { ok: false, message: "This project no longer exists." };

  const snapshot = planRanges(project.subprojects);
  const supabase = await createClient();
  // Insert the first time, replace later (the table's update grant covers only the snapshot).
  const { error } = project.baseline
    ? await supabase.from("plan_baselines").update({ snapshot }).eq("project_id", projectId).eq("organization_id", org.id)
    : await supabase.from("plan_baselines").insert({ organization_id: org.id, project_id: projectId, snapshot });
  if (error) return { ok: false, message: "Couldn't lock the plan. Try again." };

  await logActivity(supabase, org, {
    projectId,
    summary: project.baseline ? "Plan locked again (new original plan)" : "Plan locked",
    details: project.subprojects.map((s) => `${s.name}: ${formatRange(snapshot[s.id] ?? null)}`),
  });
  refresh();
  return { ok: true };
}
