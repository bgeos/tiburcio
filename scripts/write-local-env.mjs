#!/usr/bin/env node
/**
 * Write .env.local from the running LOCAL Supabase stack (`npm run db:start` first).
 * Used by CI and by new developers. Never overwrites an existing .env.local
 * unless --force is given.
 *
 *   npm run db:env            # create .env.local if it doesn't exist
 *   npm run db:env -- --force # replace it
 */
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

const target = ".env.local";
const force = process.argv.includes("--force");

if (existsSync(target) && !force) {
  console.log(`${target} already exists; leaving it alone (use --force to replace it).`);
  process.exit(0);
}

let raw;
try {
  // A fixed command string (no user input), so running it through the shell is safe.
  raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch {
  console.error("✖ Could not read the local Supabase status. Run `npm run db:start` first.");
  process.exit(1);
}

const status = JSON.parse(raw.slice(raw.indexOf("{")));
for (const key of ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY"]) {
  if (!status[key]) {
    console.error(`✖ Local Supabase status has no ${key}.`);
    process.exit(1);
  }
}

writeFileSync(
  target,
  [
    "# Local development only. Written by `npm run db:env` from the local Supabase stack.",
    "# Never commit this file.",
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
    "",
    "# SERVER ONLY. Never prefix with NEXT_PUBLIC_.",
    `SUPABASE_SECRET_KEY=${status.SECRET_KEY}`,
    "",
    "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
    "",
  ].join("\n"),
);
console.log(`✔ Wrote ${target} for ${status.API_URL}`);
