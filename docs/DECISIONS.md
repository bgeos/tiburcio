# Decisions

Deviations from `docs/PLAN.md` and other architectural choices. Newest last.

## D-001 · 2026-11-11 · Own Supabase project instead of a database on jupigenio's server
Plan rule 2.3 asks for the same DB server as jupigenio, with a separate database and DB user.
jupigenio runs on Supabase, where one project is one Postgres database with its own Auth and
Storage, so the Supabase equivalent is a separate project.
- Project `tiburcio`, ref `quincosoqtgzgjucsidg`, region eu-north-1 (same as jupigenio
  staging), same Supabase org, free plan.
- `supabase/config.toml` is copied from jupigenio (same auth defaults, public sign-up off),
  with local ports moved to 544xx so both stacks can run side by side, and without
  jupigenio's invitation email template.
- Tibúrcio never touches jupigenio's database; it reads jupigenio data only through
  jupigenio's own endpoint (DISCOVERY §4).
- Hosted auth settings don't travel with migrations: sign-up must be turned off in the
  dashboard by hand, as jupigenio does (its D-032).
