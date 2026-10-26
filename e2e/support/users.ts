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

/** Remove every project of the E2E organization (subprojects, tasks… cascade). */
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
  const [adminId, , , outsiderId, memberId] = await Promise.all([
    ensureUser(E2E_USER),
    ensureUser(E2E_NO_ORG_USER),
    ensureUser(E2E_INVITEE),
    ensureUser(E2E_OUTSIDER),
    ensureUser(E2E_MEMBER),
  ]);
  await ensureOrg(E2E_ORG, adminId);
  await ensureOrg(E2E_OTHER_ORG, outsiderId);
  await ensureMember(E2E_ORG.slug, memberId, "member");
  await resetE2eInvitations();
  await resetE2eProjects();
}
