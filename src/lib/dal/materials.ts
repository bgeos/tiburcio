import "server-only";
import type { MaterialStatus } from "@/lib/domain/materials";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

/** One material line for the organization-wide Materials page. */
export type MaterialRow = {
  id: string;
  description: string;
  status: MaterialStatus;
  projectId: string;
  project: string;
  subprojectId: string;
  subproject: string;
};

type Row = {
  id: string;
  description: string;
  status: MaterialStatus;
  subprojects: {
    id: string;
    name: string;
    archived_at: string | null;
    projects: { id: string; name: string; archived_at: string | null } | null;
  } | null;
};

/**
 * Every material of every current subproject in the organization (read as the user,
 * so RLS applies). Archived materials, subprojects and projects are left out.
 */
export async function listOrganizationMaterials(org: Membership): Promise<MaterialRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subproject_materials")
    .select(
      // Name the foreign keys: subprojects also relate to projects through the dependency links.
      "id, description, status, subprojects!subproject_materials_organization_id_subproject_id_fkey(id, name, archived_at, projects!subprojects_organization_id_project_id_fkey(id, name, archived_at))",
    )
    .eq("organization_id", org.id)
    .is("archived_at", null)
    .returns<Row[]>();
  if (error) throw new Error(`Could not load materials: ${error.message}`);

  return data
    .flatMap((row) => {
      const sub = row.subprojects;
      const project = sub?.projects;
      if (!sub || !project || sub.archived_at || project.archived_at) return [];
      return [
        {
          id: row.id,
          description: row.description,
          status: row.status,
          projectId: project.id,
          project: project.name,
          subprojectId: sub.id,
          subproject: sub.name,
        },
      ];
    })
    .sort((a, b) => a.project.localeCompare(b.project) || a.subproject.localeCompare(b.subproject));
}
