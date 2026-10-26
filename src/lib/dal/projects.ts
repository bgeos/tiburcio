import "server-only";
import type { ProjectStatus } from "@/lib/domain/projects";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  /** Subprojects that are not archived. */
  subprojectCount: number;
  archivedAt: string | null;
  createdAt: string;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  archived_at: string | null;
  created_at: string;
  subprojects: { archived_at: string | null }[];
};

/** The organization's projects, read as the user (RLS: members and above). */
export async function listProjects(org: Membership): Promise<ProjectSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, status, archived_at, created_at, subprojects(archived_at)")
    .eq("organization_id", org.id)
    .order("sort_order")
    .order("name")
    .returns<ProjectRow[]>();
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    subprojectCount: row.subprojects.filter((s) => !s.archived_at).length,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }));
}
