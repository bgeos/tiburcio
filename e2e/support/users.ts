/**
 * Fictional E2E accounts and organizations, created in the LOCAL Supabase only.
 * Never point the E2E tests at a hosted project: this uses the secret key.
 */
const PASSWORD = "E2e-local-only-123";

/** Admin of E2E_ORG; the session every test shares. */
export const E2E_USER = { email: "e2e.admin@example.test", password: PASSWORD, fullName: "Ellis Example" };
/** Signed in, but in no organization. */
export const E2E_NO_ORG_USER = { email: "e2e.noorg@example.test", password: PASSWORD, fullName: "Noa Example" };
/** Admin of another organization, to prove organizations can't see each other. */
const E2E_OUTSIDER = { email: "e2e.outsider@example.test", password: PASSWORD, fullName: "Otto Example" };

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

/** Everything the E2E tests rely on. Idempotent: safe to run before every test run. */
export async function ensureE2eFixtures(): Promise<void> {
  const [adminId, , outsiderId] = await Promise.all([
    ensureUser(E2E_USER),
    ensureUser(E2E_NO_ORG_USER),
    ensureUser(E2E_OUTSIDER),
  ]);
  await ensureOrg(E2E_ORG, adminId);
  await ensureOrg(E2E_OTHER_ORG, outsiderId);
}
