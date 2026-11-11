#!/usr/bin/env node
/**
 * Operator command (D-003): create Tibúrcio's one account and give it Bruno's six
 * personal projects (plan § 5). Sign-up is off, so this is the only way in.
 *
 *   npm run user:create -- --email bruno@example.com --name "Bruno" [--yes]
 *
 * Asks for the password without echoing it. Reads NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY from .env.local (or the environment). Against anything other
 * than a local Supabase it also needs --yes. Safe to re-run: an existing account is
 * kept (its password is not changed) and projects that already exist are skipped.
 */
import { parseArgs } from "node:util";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the environment instead.
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string", default: "" },
    yes: { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!values.email) fail('Usage: npm run user:create -- --email you@example.com [--name "Your name"] [--yes]');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see README).");

const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
if (!isLocal && !values.yes) {
  fail(`This would change ${url}, which is not a local Supabase. Re-run with --yes if that is intended.`);
}

const PROJECTS = [
  { slug: "main-stage", name: "Main Stage", category: "build", icon: "tent", description: "Structure, shade sail and DJ booth" },
  { slug: "banco-em-l", name: "Banco em L", category: "diy", icon: "armchair", description: "Plywood storage modules with pine tops" },
  { slug: "sistino", name: "Sistino", category: "diy", icon: "box", description: "Small stackable piece made from offcuts" },
  { slug: "remote-job-brasil", name: "Remote job · Brasil", category: "career", icon: "plane", description: "Remote TIBCO work as a PJ contractor" },
  { slug: "negocio-do-tio", name: "Negócio do tio", category: "family", icon: "wrench", description: "Digitalising the plumbing business" },
  { slug: "mota", name: "Mota", category: "garage", icon: "bike", description: "The old motorbike, freshly repainted" },
].map((p, i) => ({ ...p, status: "active", sort_order: i }));

/** Reads a line from the terminal without showing what is typed. */
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) fail("Run this in a terminal: it asks for the password.");
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let answer = "";
    const onData = (char) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(answer);
      } else if (char === "\u0003") {
        stdout.write("\n");
        process.exit(130);
      } else if (char === "\u007f" || char === "\b") {
        answer = answer.slice(0, -1);
      } else {
        answer += char;
      }
    };
    stdin.on("data", onData);
  });
}

const headers = { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" };
async function call(path, init = {}) {
  const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) fail(`${init.method ?? "GET"} ${path} failed (${response.status}): ${body?.msg ?? body?.message ?? text}`);
  return body;
}

const email = values.email.trim().toLowerCase();
let user;
for (let page = 1; !user; page++) {
  const { users } = await call(`/auth/v1/admin/users?per_page=200&page=${page}`);
  user = users.find((u) => u.email?.toLowerCase() === email);
  if (users.length < 200) break;
}

if (user) {
  console.log(`• ${email} already exists; keeping its password.`);
} else {
  const password = await askHidden(`Password for ${email} (8+ characters, letters and digits): `);
  if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
    fail("The password needs at least 8 characters, with letters and digits.");
  }
  if ((await askHidden("Type it again: ")) !== password) fail("The passwords don't match.");
  user = await call("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: values.name } }),
  });
  console.log(`✔ Created ${email}`);
}

const added = await call("/rest/v1/personal_projects?on_conflict=user_id,slug", {
  method: "POST",
  headers: { prefer: "resolution=ignore-duplicates,return=representation" },
  body: JSON.stringify(PROJECTS.map((p) => ({ ...p, user_id: user.id }))),
});

console.log(`✔ ${added.length} personal project(s) added (${PROJECTS.length - added.length} already there) on ${url}`);
