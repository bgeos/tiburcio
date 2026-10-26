/**
 * Fictional E2E account, created in the LOCAL Supabase only. Never point the
 * E2E tests at a hosted project: this uses the secret key to manage users.
 */
export const E2E_USER = {
  email: "e2e.admin@example.test",
  password: "E2e-local-only-123",
  fullName: "Ellis Example",
};

export const STORAGE_STATE = "playwright/.auth/user.json";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Run \`npm run db:start\` and fill in .env.local (see README).`);
  }
  return value;
}

/** Create the E2E user if missing, and reset its password so sign-in is predictable. */
export async function ensureE2eUser(): Promise<void> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`E2E tests manage users and must only run against a local Supabase, not ${url}.`);
  }
  const secret = env("SUPABASE_SECRET_KEY");
  const headers = { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" };

  const list = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });
  if (!list.ok) throw new Error(`Supabase admin API failed (${list.status}). Is \`npm run db:start\` running?`);
  const { users } = (await list.json()) as { users: { id: string; email: string }[] };
  const existing = users.find((u) => u.email === E2E_USER.email);

  const body = JSON.stringify({
    email: E2E_USER.email,
    password: E2E_USER.password,
    email_confirm: true,
    user_metadata: { full_name: E2E_USER.fullName },
  });
  const response = existing
    ? await fetch(`${url}/auth/v1/admin/users/${existing.id}`, { method: "PUT", headers, body })
    : await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers, body });
  if (!response.ok) throw new Error(`Could not prepare the E2E user (${response.status}): ${await response.text()}`);
}
