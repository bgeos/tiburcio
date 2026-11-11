import "server-only";
import { sortMilestones, type Milestone, type MilestoneLink } from "@/lib/domain/milestones";
import type { LinkedTask } from "@/lib/domain/task-links";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

type Client = Awaited<ReturnType<typeof createClient>>;

/** The organization's milestones in date order (RLS: not for external collaborators). */
export async function listMilestones(org: Membership): Promise<Milestone[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("milestones").select("id, name, date").eq("organization_id", org.id);
  if (error) throw new Error(`Could not load milestones: ${error.message}`);
  return sortMilestones(data);
}

/** "Must be done before" links of these tasks (one project's), with their milestones. */
export async function loadMilestoneLinks(supabase: Client, own: Map<string, LinkedTask>): Promise<MilestoneLink[]> {
  const ids = [...own.keys()];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("task_milestones")
    .select("id, task_id, milestones(id, name, date)")
    .in("task_id", ids)
    .returns<{ id: string; task_id: string; milestones: Milestone | null }[]>();
  if (error) throw new Error(`Could not load milestone links: ${error.message}`);
  return data.flatMap((r) => (r.milestones && own.has(r.task_id) ? [{ id: r.id, milestone: r.milestones, task: own.get(r.task_id)! }] : []));
}
