import "server-only";
import type { MaterialStatus } from "@/lib/domain/materials";
import type { IsoDate } from "@/lib/domain/schedule";
import { isSubprojectColor, type SubprojectColor } from "@/lib/domain/subproject-colors";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

/** One material line for the organization-wide Materials page. */
export type MaterialRow = {
  id: string;
  description: string;
  status: MaterialStatus;
  neededBy: IsoDate | null;
  projectId: string;
  project: string;
  subprojectId: string;
  subproject: string;
  subprojectColor: SubprojectColor;
};

type Row = {
  id: string;
  description: string;
  status: MaterialStatus;
  needed_by: IsoDate | null;
  subprojects: {
    id: string;
    name: string;
    color: string;
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
      "id, description, status, needed_by, subprojects!subproject_materials_organization_id_subproject_id_fkey(id, name, color, archived_at, projects!subprojects_organization_id_project_id_fkey(id, name, archived_at))",
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
          neededBy: row.needed_by,
          projectId: project.id,
          project: project.name,
          subprojectId: sub.id,
          subproject: sub.name,
          subprojectColor: isSubprojectColor(sub.color) ? sub.color : "blue",
        },
      ];
    })
    .sort((a, b) => a.project.localeCompare(b.project) || a.subproject.localeCompare(b.subproject));
}

/** A current subproject a material can be added to, from the Materials page. */
export type SubprojectChoice = { projectId: string; project: string; subprojectId: string; subproject: string };

type ChoiceRow = {
  id: string;
  name: string;
  archived_at: string | null;
  projects: { id: string; name: string; archived_at: string | null } | null;
};

/** Every current subproject of every current project, sorted by project then subproject. */
export async function listSubprojectChoices(org: Membership): Promise<SubprojectChoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subprojects")
    .select("id, name, archived_at, projects!subprojects_organization_id_project_id_fkey(id, name, archived_at)")
    .eq("organization_id", org.id)
    .is("archived_at", null)
    .returns<ChoiceRow[]>();
  if (error) throw new Error(`Could not load subprojects: ${error.message}`);
  return data
    .flatMap((row) =>
      row.projects && !row.projects.archived_at
        ? [{ projectId: row.projects.id, project: row.projects.name, subprojectId: row.id, subproject: row.name }]
        : [],
    )
    .sort((a, b) => a.project.localeCompare(b.project) || a.subproject.localeCompare(b.subproject));
}
