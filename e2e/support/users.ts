/**
 * Fictional E2E accounts and organizations, created in the LOCAL Supabase only.
 * Never point the E2E tests at a hosted project: this uses the secret key.
 */
const PASSWORD = "E2e-local-only-123";

/** Admin of E2E_ORG; the session every test shares. */
export const E2E_USER = { email: "e2e.admin@example.test", password: PASSWORD, fullName: "Ellis Example" };
/** Signed in, but in no organization. */
export const E2E_NO_ORG_USER = { email: "e2e.noorg@example.test", password: PASSWORD, fullName: "Noa Example" };
/** Member (view-only) of E2E_ORG. */
export const E2E_MEMBER = { email: "e2e.member@example.test", password: PASSWORD, fullName: "Mia Example" };
/** External collaborator of E2E_ORG: sees no projects (D-025). */
export const E2E_EXTERNAL = { email: "e2e.external@example.test", password: PASSWORD, fullName: "Xan Example" };
/** Member of E2E_ORG whose appearance the profile tests change (nobody else's theme moves). */
export const E2E_PROFILE = { email: "e2e.profile@example.test", password: PASSWORD, fullName: "Pat Example" };
/** Has an account, no organization; only the invitation tests use (and change) it. */
export const E2E_INVITEE = { email: "e2e.invitee@example.test", password: PASSWORD, fullName: "Ivy Example" };
/** Admin of another organization, to prove organizations can't see each other. */
export const E2E_OUTSIDER = { email: "e2e.outsider@example.test", password: PASSWORD, fullName: "Otto Example" };

export const E2E_ORG = { slug: "e2e-org", name: "E2E Test Org" };
export const E2E_OTHER_ORG = { slug: "e2e-other-org", name: "E2E Other Org" };

export const STORAGE_STATE = "playwright/.auth/user.json";

/** A path inside the E2E organization: orgPath("/projects") → "/e2e-org/projects". */
export function orgPath(path: `/${string}`): string {
  return `/${E2E_ORG.slug}${path}`;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Run \`npm run db:start\` and fill in .env.local (see README).`);
  }
  return value;
}

function admin() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`E2E tests manage users and must only run against a local Supabase, not ${url}.`);
  }
  const secret = env("SUPABASE_SECRET_KEY");
  const headers = { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" };

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers } });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path} failed (${response.status}): ${text}`);
    return (text ? JSON.parse(text) : null) as T;
  }
  return call;
}

/** Create the user if missing (or reset its password), and return its id. */
async function ensureUser(user: { email: string; password: string; fullName: string }): Promise<string> {
  const call = admin();
  const { users } = await call<{ users: { id: string; email: string }[] }>("/auth/v1/admin/users?per_page=200");
  const existing = users.find((u) => u.email === user.email);
  const body = JSON.stringify({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });
  const saved = existing
    ? await call<{ id: string }>(`/auth/v1/admin/users/${existing.id}`, { method: "PUT", body })
    : await call<{ id: string }>("/auth/v1/admin/users", { method: "POST", body });
  return saved.id;
}

/** Make `userId` a member of the organization with `role` (insert or update). */
async function ensureMember(orgSlug: string, userId: string, role: string): Promise<void> {
  await admin()("/rest/v1/organization_members?on_conflict=organization_id,user_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ organization_id: await orgId(orgSlug), user_id: userId, role }),
  });
}

/** Create a project in the E2E organization directly (for tests about other screens). */
export async function createE2eProject(name: string, status: "planning" | "active" | "finished" = "active"): Promise<string> {
  const [row] = await admin()<{ id: string }[]>("/rest/v1/projects", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ organization_id: await orgId(E2E_ORG.slug), name, status }),
  });
  return row.id;
}

/** Add subprojects to a project directly; returns their ids by name. */
export async function addE2eSubprojects(
  projectId: string,
  subprojects: { name: string; startDate: string }[],
): Promise<Record<string, string>> {
  const orgIdValue = await orgId(E2E_ORG.slug);
  const rows = await admin()<{ id: string; name: string }[]>("/rest/v1/subprojects", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(
      subprojects.map((s, i) => ({
        organization_id: orgIdValue,
        project_id: projectId,
        name: s.name,
        start_date: s.startDate,
        sort_order: i,
      })),
    ),
  });
  return Object.fromEntries(rows.map((r) => [r.name, r.id]));
}

/** "successor starts after predecessor finishes", added directly. */
export async function linkE2eSubprojects(projectId: string, predecessorId: string, successorId: string): Promise<void> {
  await admin()("/rest/v1/subproject_dependencies", {
    method: "POST",
    body: JSON.stringify({
      organization_id: await orgId(E2E_ORG.slug),
      project_id: projectId,
      predecessor_id: predecessorId,
      successor_id: successorId,
    }),
  });
}

/** Add tasks to a subproject (looked up by name), bypassing the UI. */
export async function addE2eTasks(projectId: string, subprojectName: string, durations: number[]): Promise<void> {
  const call = admin();
  const [sub] = await call<{ id: string; organization_id: string }[]>(
    `/rest/v1/subprojects?select=id,organization_id&project_id=eq.${projectId}&name=eq.${encodeURIComponent(subprojectName)}`,
  );
  if (!sub) throw new Error(`No subproject ${subprojectName}`);
  await call("/rest/v1/tasks", {
    method: "POST",
    body: JSON.stringify(
      durations.map((duration_days, i) => ({
        organization_id: sub.organization_id,
        subproject_id: sub.id,
        name: `${subprojectName} task ${i + 1}`,
        duration_days,
        sort_order: i,
      })),
    ),
  });
}

/**
 * Remove the E2E organization's projects with exactly this name. Test files clean up only
 * what they created, because other files run at the same time.
 */
export async function deleteE2eProjects(name: string): Promise<void> {
  await admin()(
    `/rest/v1/projects?organization_id=eq.${await orgId(E2E_ORG.slug)}&name=eq.${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
}

/** Remove the E2E organization's personal tasks whose name starts with `prefix` (anyone's). */
export async function deleteE2eMyTasks(prefix: string): Promise<void> {
  await admin()(
    `/rest/v1/personal_tasks?organization_id=eq.${await orgId(E2E_ORG.slug)}&name=like.${encodeURIComponent(`${prefix}*`)}`,
    { method: "DELETE" },
  );
}

/** Remove every project of the E2E organization (subprojects, tasks… cascade). Setup only. */
export async function resetE2eProjects(): Promise<void> {
  await admin()(`/rest/v1/projects?organization_id=eq.${await orgId(E2E_ORG.slug)}`, { method: "DELETE" });
}

/** Create the organization if missing, and make sure `adminId` is its admin. */
async function ensureOrg(org: { slug: string; name: string }, adminId: string): Promise<void> {
  const call = admin();
  const found = await call<{ id: string }[]>(`/rest/v1/organizations?select=id&slug=eq.${org.slug}`);
  if (found.length === 0) {
    await call("/rest/v1/rpc/create_organization", {
      method: "POST",
      body: JSON.stringify({ org_name: org.name, org_slug: org.slug, admin_user_id: adminId }),
    });
    return;
  }
  await call("/rest/v1/organization_members?on_conflict=organization_id,user_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ organization_id: found[0].id, user_id: adminId, role: "admin" }),
  });
}

async function orgId(slug: string): Promise<string> {
  const [org] = await admin()<{ id: string }[]>(`/rest/v1/organizations?select=id&slug=eq.${slug}`);
  if (!org) throw new Error(`No organization ${slug}`);
  return org.id;
}

/** Undo what invitation tests change: their invitations, and stray memberships. */
export async function resetE2eInvitations(): Promise<void> {
  const call = admin();
  const id = await orgId(E2E_ORG.slug);
  await call(`/rest/v1/invitations?organization_id=eq.${id}`, { method: "DELETE" });
  const { users } = await call<{ users: { id: string; email: string }[] }>("/auth/v1/admin/users?per_page=200");
  for (const user of users) {
    if ([E2E_NO_ORG_USER.email, E2E_INVITEE.email, E2E_OUTSIDER.email].includes(user.email)) {
      await call(`/rest/v1/organization_members?organization_id=eq.${id}&user_id=eq.${user.id}`, { method: "DELETE" });
    }
    // People created by "invite a new person" tests.
    if (user.email.startsWith("e2e.new.")) await call(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
  }
}

/** Everything the E2E tests rely on. Idempotent: safe to run before every test run. */
export async function ensureE2eFixtures(): Promise<void> {
  const [adminId, , , outsiderId, memberId, externalId, profileId] = await Promise.all([
    ensureUser(E2E_USER),
    ensureUser(E2E_NO_ORG_USER),
    ensureUser(E2E_INVITEE),
    ensureUser(E2E_OUTSIDER),
    ensureUser(E2E_MEMBER),
    ensureUser(E2E_EXTERNAL),
    ensureUser(E2E_PROFILE),
  ]);
  await ensureOrg(E2E_ORG, adminId);
  await ensureOrg(E2E_OTHER_ORG, outsiderId);
  await ensureMember(E2E_ORG.slug, memberId, "member");
  await ensureMember(E2E_ORG.slug, externalId, "external");
  await ensureMember(E2E_ORG.slug, profileId, "member");
  await resetE2eProfile();
  await resetE2eInvitations();
  await resetE2eProjects();
}

/** Put the profile-test person back to the default look and name. */
export async function resetE2eProfile(): Promise<void> {
  const call = admin();
  const { users } = await call<{ users: { id: string; email: string }[] }>("/auth/v1/admin/users?per_page=200");
  const user = users.find((u) => u.email === E2E_PROFILE.email);
  if (!user) return;
  await call(`/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    body: JSON.stringify({ full_name: E2E_PROFILE.fullName, accent_color: "green", theme_mode: "system" }),
  });
}
