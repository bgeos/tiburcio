/** Organization roles (organization_members.role). See docs/ARCHITECTURE.md § Roles. */
export const ORG_ROLES = ["admin", "production_manager", "member", "external"] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  production_manager: "Production manager",
  member: "Member",
  external: "External collaborator",
};
