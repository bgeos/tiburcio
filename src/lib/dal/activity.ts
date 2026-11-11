import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

export type ActivityEntry = {
  id: string;
  createdAt: string;
  /** Who made the change: their name, or their email if they haven't set one. */
  actor: string;
  subprojectId: string | null;
  summary: string;
  details: string[];
  reason: string | null;
};

type Row = {
  id: string;
  created_at: string;
  subproject_id: string | null;
  summary: string;
  details: unknown;
  reason: string | null;
  profiles: { full_name: string; email: string | null } | null;
};

/**
 * History of a project (or one of its subprojects), newest first. Read as the
 * user (RLS: members and above). The log is append-only (P3-12).
 */
export async function listActivity(
  org: Membership,
  projectId: string,
  options: { subprojectId?: string; limit?: number } = {},
): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("activity_log")
    .select("id, created_at, subproject_id, summary, details, reason, profiles!activity_log_actor_id_fkey(full_name, email)")
    .eq("organization_id", org.id)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (options.subprojectId) query = query.eq("subproject_id", options.subprojectId);

  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error(`Could not load the history: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actor: row.profiles?.full_name || row.profiles?.email || "Someone",
    subprojectId: row.subproject_id,
    summary: row.summary,
    details: Array.isArray(row.details) ? row.details.filter((d): d is string => typeof d === "string") : [],
    reason: row.reason,
  }));
}
