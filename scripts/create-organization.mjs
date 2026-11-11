#!/usr/bin/env node
/**
 * Operator command (D-021): create an organization and make an existing user its
 * first admin. JupiGenio has no self-service organizations; everyone else joins
 * by invitation.
 *
 *   npm run org:create -- --name "Jupi Produções" --slug jupi-producoes --admin someone@example.com
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local (or the
 * environment). The user must already exist (Supabase Studio → Authentication →
 * Add user). Against anything other than a local Supabase it also needs --yes.
 */
import { parseArgs } from "node:util";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the environment instead.
}

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    slug: { type: "string" },
    admin: { type: "string" },
    yes: { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!values.name || !values.slug || !values.admin) {
  fail('Usage: npm run org:create -- --name "Org name" --slug org-slug --admin admin@example.com [--yes]');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see README).");

const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
if (!isLocal && !values.yes) {
  fail(`This would change ${url}, which is not a local Supabase. Re-run with --yes if that is intended.`);
}

const headers = { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" };
async function call(path, init = {}) {
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) fail(`${init.method ?? "GET"} ${path} failed (${response.status}): ${body?.message ?? text}`);
  return body;
}

const email = values.admin.trim().toLowerCase();
let user;
for (let page = 1; !user; page++) {
  const { users } = await call(`/auth/v1/admin/users?per_page=200&page=${page}`);
  user = users.find((u) => u.email?.toLowerCase() === email);
  if (users.length < 200) break;
}
if (!user) fail(`No user with email ${email}. Create the account first (Studio → Authentication → Add user).`);

const id = await call("/rest/v1/rpc/create_organization", {
  method: "POST",
  body: JSON.stringify({ org_name: values.name, org_slug: values.slug, admin_user_id: user.id }),
});

console.log(`✔ Created "${values.name}" (/${values.slug}), id ${id}, with ${email} as admin on ${url}`);
