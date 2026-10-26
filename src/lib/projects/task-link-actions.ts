"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectDetail } from "@/lib/dal/project-detail";
import { taskOverlapMessage, taskOverlaps, taskPlace, type TaskLink } from "@/lib/domain/task-links";
import { createClient } from "@/lib/supabase/server";
import { NOT_ALLOWED, editableOrganization, logActivity } from "./guards";

type Result = { ok: true } | { ok: false; message: string };

const ids = z.object({ successorTaskId: z.uuid(), predecessorTaskId: z.uuid() });

/** History on both sides: the waiting task's subproject, and the other project if it's another one. */
async function logLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  org: Parameters<typeof logActivity>[1],
  link: TaskLink,
  added: boolean,
) {
  const { predecessor: pred, successor: succ } = link;
  const overlaps = added ? taskOverlaps([link]).map((o) => `Overlap: ${taskOverlapMessage(o, succ.projectId)}`) : [];
  await logActivity(supabase, org, {
    projectId: succ.projectId,
    subprojectId: succ.subprojectId,
    summary: added
      ? `${succ.name} now waits for ${taskPlace(pred, succ.projectId)}`
      : `${succ.name} no longer waits for ${taskPlace(pred, succ.projectId)}`,
    details: overlaps,
  });
  if (pred.subprojectId !== succ.subprojectId) {
    await logActivity(supabase, org, {
      projectId: pred.projectId,
      subprojectId: pred.subprojectId,
      summary: added
        ? `${pred.name} is now needed by ${taskPlace(succ, pred.projectId)}`
        : `${pred.name} is no longer needed by ${taskPlace(succ, pred.projectId)}`,
      details: overlaps,
    });
  }
}

/** "This task starts after that one finishes" (any subproject or project). Nothing moves; overlaps are reported. */
export async function addTaskLink(
  orgSlug: string,
  projectId: string,
  successorTaskId: string,
  predecessorTaskId: string,
): Promise<Result> {
  const parsed = ids.safeParse({ successorTaskId, predecessorTaskId });
  if (!parsed.success) return { ok: false, message: "Choose a task to wait for." };
  if (successorTaskId === predecessorTaskId) return { ok: false, message: "A task can't wait for itself." };

  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };
  const project = await getProjectDetail(org, projectId);
  if (!project?.subprojects.some((s) => s.tasks.some((t) => t.id === successorTaskId))) {
    return { ok: false, message: "This task no longer exists." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({ organization_id: org.id, predecessor_task_id: predecessorTaskId, successor_task_id: successorTaskId })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.message.includes("task_dependency_cycle")) {
      return { ok: false, message: "That would make tasks wait for each other in a circle." };
    }
    if (error?.message.includes("same_subproject")) {
      return { ok: false, message: "Tasks in one subproject already run one after another." };
    }
    if (error?.code === "23505") return { ok: false, message: "This task already waits for that one." };
    return { ok: false, message: "Couldn't add the link. Try again." };
  }

  // Read back as the database sees it now: names, places and planned dates of both ends.
  const link = (await getProjectDetail(org, projectId))?.taskLinks.find((l) => l.id === data.id);
  if (link) await logLink(supabase, org, link, true);
  refresh();
  return { ok: true };
}

export async function removeTaskLink(orgSlug: string, projectId: string, linkId: string): Promise<Result> {
  const org = await editableOrganization(orgSlug);
  if (!org) return { ok: false, message: NOT_ALLOWED };
  const link = (await getProjectDetail(org, projectId))?.taskLinks.find((l) => l.id === linkId);
  if (!link) return { ok: false, message: "This link no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_dependencies").delete().eq("id", linkId).eq("organization_id", org.id);
  if (error) return { ok: false, message: "Couldn't remove the link. Try again." };

  await logLink(supabase, org, link, false);
  refresh();
  return { ok: true };
}
