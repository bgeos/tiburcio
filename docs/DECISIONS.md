# Decisions

Format: ID · date · decision · rationale. Status is *Accepted* unless noted.
Revisiting a decision means adding a new entry that supersedes the old one.

## D-001 · 2026-10-26 · Keep the existing create-next-app scaffold
Next.js 16.4 / React 19.3 / Tailwind 4 / TypeScript strict / `src/` layout /
`@/*` alias, with `cacheComponents` and `partialPrefetching` already enabled. It matches the
blueprint stack, so nothing is rewritten.

## D-002 · 2026-10-26 · npm is the package manager
A `package-lock.json` already exists. Don't mix in pnpm or yarn.

## D-003 · 2026-10-26 · Supabase as backend; RLS is the primary authorization boundary
The app queries Supabase as the signed-in user (`@supabase/ssr`). The secret key is used
only in `server-only` modules for invitations and admin tasks. See ARCHITECTURE.md.

## D-004 · 2026-10-26 · `organization_id` on every org-owned table + composite FKs
Simple, fast RLS policies. Composite `(organization_id, parent_id)` foreign keys
make cross-org references impossible at the database level.

## D-005 · 2026-10-26 · No server-side `"use cache"` on user/org data for now
Avoids cross-user cache leaks. Data is rendered at request time behind `<Suspense>`.
Revisit with `"use cache: private"` or user-keyed tags if profiling shows a need.

## D-006 · 2026-10-26 · Stock is an append-only ledger + locked balance rows
`material_movements` is never updated or deleted. Posting/reserving goes through SQL
functions using `SELECT … FOR UPDATE`, which prevents negative stock under concurrency.

## D-007 · 2026-10-26 · Default progress rule: equal weight per eligible leaf task across the subtree
See DATA_MODEL.md § Progress calculation. Configurable weighting comes in Phase 7.

## D-008 · 2026-10-26 · Recharts for charts (first release)
React-native API, small learning curve, enough for donut, bar and line charts. Revisit
(ECharts) if large datasets or Gantt-like rendering need it.

## D-009 · 2026-10-26 · Forms: React Hook Form + Zod; UI: shadcn/ui (Phase 1)
*Superseded in part by D-013 (forms).* Zod schemas are shared between client forms and
Server Actions (server always re-validates).

## D-010 · 2026-10-26 · Testing: Vitest (unit), SQL tests on local Supabase (RLS), Playwright (E2E)
Vitest is already installed. The others are added when the first code needing them lands.

## D-011 · 2026-10-26 · Statuses are rows with a fixed `category`
Users rename and recolour statuses, and calculations use the category
(`todo|in_progress|blocked|done|cancelled`).

## D-012 · 2026-10-26 · No currency conversion in the MVP
Amounts carry a currency. Totals are grouped per currency.

## D-013 · 2026-10-26 · Forms: native React 19 forms (`useActionState`) + Zod, no React Hook Form
Supersedes the form-library part of D-009. `@hookform/resolvers` v5 and v6 both fail npm
peer resolution in this tree (optional `@typeschema/*` peers conflict with the zod/effect
versions pulled in by the shadcn CLI). Forcing the install was rejected. Instead:
`parseForm(schema, formData)` (`src/lib/validation/form.ts`) validates on the client and
will be reused unchanged inside Server Actions (Phase 2). This is Next.js's recommended pattern,
needs one dependency fewer, and works without JavaScript once actions are server-side.
Revisit if a form needs complex client state (field arrays, dependent fields).

## D-014 · 2026-10-26 · shadcn/ui on Radix, `radix-nova` style; theming via next-themes
shadcn CLI 4.22.1 with the Radix base (mature, accessible primitives). Its new `cn`
package (from shadcn-ui, replacing clsx + tailwind-merge) and `next-themes` (light/dark/
system with a `.dark` class, no flash) come with it. Generated components live in
`src/components/ui/` and may be edited. The generated `use-mobile` hook was rewritten
with `useSyncExternalStore` to satisfy the React hooks lint rules.

## D-015 · 2026-10-26 · Experimental `authInterrupts` enabled
Needed for `unauthorized()` / `forbidden()` and their 401/403 pages, which the Data
Access Layer will call in Phase 2. It is an experimental Next.js flag, so re-check on upgrades.

## D-016 · 2026-10-26 · Phase 1 routes have no organization prefix
`/projects` etc. Phase 2 decides between `/[org]/…` URLs and an active-org cookie. URL
prefixes make links shareable and unambiguous across orgs. Leaning towards `/[org]/…`.

**Decided (product owner, 2026-10-26): app pages include the organization slug**, e.g.
`/acme-festivals/projects`. The slug selects the org for the request, and the server still
checks membership on every request (RLS + DAL); the URL is never trusted for authorization.
Routes move under `src/app/(app)/[org]/…` with P2-06/P2-07.

## D-017 · 2026-10-26 · Every data page owns its loading boundary
Client navigation inside the app shell does not re-show `(app)/loading.tsx`, because it sits
at the shared layout (Next 16 instant navigation). Pages that read data must have their
own `loading.tsx` or `<Suspense>` around the data-reading part. This is verified by an E2E test.

## D-018 · 2026-10-26 · The team's reference spreadsheets stay out of Git
`example files/` and `examples web ui/` are git-ignored: they contain real people's names
and budgets. Seeds and demos use fictional data only.

## D-019 · 2026-10-26 · Subproject workspace: cronograma, materials, people
Product owner's answers (refines Phases 3–5; a worked example will follow before building):
- **One level of nesting:** project → subprojects. Each subproject has an owner and three
  tabs: **Cronograma** (tasks), **Materials** and **People**.
- **Tasks** are entered as name + start date + **duration in calendar days**. The end date is derived.
- **Planned vs. actual:** keep the planned dates and record the actual ones.
- **Dependencies are between subprojects** (e.g. one area can't start until another is done),
  not mainly between tasks.
- **Materials** are a list per subproject (not per task), with a request status
  (to request → requested → ready at the warehouse). No warehouse stock tracking for now.
- **People** are crew, not app users (no sign-in for now). Proposed: each person has a
  role and an optional daily cost (`numeric(14,2)` + currency) so crew cost can be totalled.
- **Editing:** only the production manager for now. Subproject owners editing their own
  subproject comes later.
- **Daily updates:** a daily check-in screen that steps through subprojects, a change
  history ("what changed since yesterday"), and a combined timeline at project level.
- **UI language:** English (answers Q1).
- **Progress donuts** for the project and each subproject, using the D-007 rule (every task
  counts equally; Done = 100; tasks carry a manual 0–100 %). **Overlaps are shown in red**
  (`destructive` token, always with an icon and text). On the timeline only the overlapping
  days are red.
- **All materials view:** one table of every material from every subproject (material,
  project, subproject, status), filterable by project, subproject and status. It reads the
  same data the subproject Materials tabs edit; there is no separate materials list to keep in sync.

## D-020 · 2026-10-26 · Local Supabase: pinned CLI, stricter auth defaults
The Supabase CLI is a dev dependency pinned to an exact version (2.120.0, chosen as the
newest release older than two weeks); upgrade on purpose. Local auth mirrors what staging
and production will use: passwords ≥ 8 characters with letters and digits, password
changes need a recent sign-in, and redirects are allowed only to the dev (3000) and E2E
(3100) servers. Email confirmation stays off locally for fast testing; it must be on in
hosted projects. Local keys live in the git-ignored `.env.local`.

## D-021 · 2026-10-26 · Invitation-only accounts
Product owner's decision. Public sign-up is disabled (`[auth] enable_signup = false`, locally and in
every hosted project; `[auth.email] enable_signup` must stay `true`, or email *sign-in* is
disabled too). People join only through an invitation from an org admin or production
manager, sent with the server-only admin client (P2-08). There is no self-service
"create organization" page: the first organization and its first admin are created by an
operator script (locally by `supabase/seed.sql`). A signed-in user without any membership
sees an "ask for an invitation" screen, never an empty app.

## D-022 · 2026-10-26 · How sign-in works (P2-02/P2-06)
- `@supabase/ssr` keeps the session in cookies. `src/proxy.ts` refreshes it on every request
  and does **optimistic** redirects only (signed out → `/login?next=…`; signed in → away
  from `/login`). Authorization stays in RLS, the DAL and each Server Action.
- Identity comes from `auth.getClaims()` (verified JWT), never from an unverified cookie.
- `getCurrentUser()` in `lib/dal/auth.ts` calls `connection()` first: Supabase compares token
  expiry with `Date.now()`, which Cache Components only allows at request time. Anything that
  reads the session renders behind `<Suspense>`.
- Sign-in shows one generic error for a wrong email or password, so it doesn't reveal who
  has an account. `next=` is accepted only as a same-site path (`safeNextPath`).
- Sign-out ends the session on this device only (`scope: "local"`).
- E2E tests sign in a fictional user (`e2e.admin@example.test`) that the setup creates in the
  **local** Supabase with the secret key; the helper refuses any non-local Supabase URL.

## D-023 · 2026-10-26 · Organization routing (P2-07)
- Sections live at `/<org>/<section>` under `src/app/(app)/[org]/`. `[org]/layout.tsx` checks
  membership before rendering; non-members (and unknown slugs) get the 404 page, so a URL never
  confirms that an organization exists. RLS still protects the data itself.
- `/` is a **page** (not a Route Handler, so client navigations and Server Action redirects can
  follow it) that sends people to the first organization by name, or to `/no-organization`.
  `/?section=x` keeps the section for links rendered outside an organization (e.g. `/design`).
  Remembering the last-used organization can come later.
- Slugs can't use route names: the `organizations_slug_not_reserved` constraint lists them.
- With `/[org]` dynamic, `usePathname`/`useParams` suspend while prerendering, so the sidebar
  link lists and header title render inside `<Suspense>` with plain-link fallbacks.
- `npm run org:create` is the operator command for new organizations (D-021).

## D-024 · 2026-10-26 · How invitations work (P2-08)
- Admins invite any role; production managers invite members and externals (same rule in
  RLS and in the Server Action). One open invitation per email per organization; it lasts 7 days.
- The token (32 random bytes) appears only in the link. The database stores its SHA-256.
- New people: `auth.admin.inviteUserByEmail` (the only use of the secret key) creates the
  account and sends the email (template `supabase/templates/invite.html`). Its link signs them in
  through `/auth/confirm`, then `/accept-invite`, where they choose a password and join.
- People who already have an account can't be emailed by Supabase Auth, so the inviter gets a
  link to share. Proper transactional email (Resend/Postmark, Q4) can replace this later.
- `accept_invitation` only accepts the invited email address, so a forwarded link is useless.
- After sign-in, people go straight to their organization (no extra hop via `/`).

## D-025 · 2026-10-26 · Phase 3 builds the prototype for real
Product owner's answers after reviewing `/[org]/projects/prototype`:
1. **Scope:** the prototype is the spec: projects → subprojects (one level), Cronograma,
   Materials, Crew and History tabs, All materials, daily check-in, lock plan (baseline),
   overlap warnings in red, progress donuts. Kanban and nested subprojects are later.
2. **Permissions:** admins and production managers edit everything; members view only;
   external collaborators see no projects yet (sharing comes later). Subproject owners
   editing their own subproject comes later.
3. **Crew** is typed per subproject (name + role), not an organization-wide directory. The
   subproject tab is called **Crew** (replaces "People"); the owner is picked from that crew.
4. **Fields:** project = name, optional description, status (planning / active / finished);
   subproject = name, owner (from its crew), start date.
5. **The prototype is removed** once the real screens work (it stays in Git history).
6. **Data entry is by hand**; no spreadsheet import.

This supersedes the generic Phase 3 plan (recursive projects, project members, status
definitions, task assignees, Kanban). See DATA_MODEL § Phase 3 and BACKLOG P3-11…P3-20.

## D-026 · 2026-10-26 · What the Overview counts
The Overview (`/<org>/dashboard`) is computed from **current projects**: not archived and
in planning or active; finished projects are left out. Rules in `lib/domain/dashboard.ts`
(unit-tested):
- **Active projects:** status active (planning ones shown as a hint).
- **Open tasks:** every task that isn't done (to do, in progress, blocked).
- **Overdue tasks:** not done, and the planned last day (subproject start + durations +
  waiting days) is before today in the organization's timezone. A task ending today is not overdue.
- **Materials not on site:** any status other than "On site"; hint = how many are still to request.
- Per project: progress by the D-007 rule, task count, overlaps (red), overdue tasks.
- No tasks / no materials / no projects → "—", never 0. External collaborators see nothing.
Costs (Phase 6) and stock shortages (Phase 5) are added when those exist.

## D-027 · 2026-10-26 · Colours: personal theme, subproject colours, red only for overlaps
Product owner's answers:
1. **Theme colour is per person**, chosen on their profile (`/<org>/profile`): Green (default),
   Teal, Blue, Violet, Pink, Slate. **No red**: red means overlap. Every choice was checked for
   text contrast (white on the button colour ≥ 5:1 light, dark text ≥ 7:1 dark) and is
   scanned by axe in light and dark.
2. **Light / Dark / Device** is also on the profile; the top bar switch saves there too.
   Saved on `profiles` (`accent_color`, `theme_mode`), so every device follows. A copy in
   browser storage only avoids a flash of the default colour before the profile loads.
   Implementation: brand-tinted tokens in `globals.css` use `--brand-h`; `data-accent` on
   `<html>` changes it.
3. **Subprojects get a colour** (auto-assigned, changeable, never red); their tasks, cards
   and timeline bars use it. Status keeps its own badge colours. (P3-23)
4. **Task dependencies:** any task can wait for any other task, also in another project,
   next to the existing subproject links. Overlaps show in red and nothing moves by itself,
   with a preview before saving (D-019). This is the first Phase 4 item (P4-01).

## D-028 · 2026-10-27 · "My tasks" replaces the Tasks section; Reports removed
Product owner: the Tasks section is for a person to write their own tasks, like reminders.
- **My tasks** (`/<org>/tasks`, nav "My tasks"): name, description (optional), status
  (To do / In progress / Done) and a tag (**To do** or **Reminder**). Filter by tag; finished
  ones are listed apart. Project tasks stay in each subproject's cronograma.
- **Private:** only the person who wrote a task sees or changes it, not even admins (RLS on
  `personal_tasks`). Every member has their own, external collaborators too.
- Not part of any plan or history, so deleting one removes it (not archived).
- No dates or notifications yet; a due date / reminder time can be added later if asked.
- **Reports removed** from the navigation (it was a placeholder); `/<org>/reports` is a 404.
  Budgets and reports (Phase 6) will decide where they live when built.

## D-029 · 2026-10-27 · The project status follows the work
Product owner: yes, the status should update by itself. After any task change (add, update,
status, remove) or a subproject archived / restored, the project's current tasks decide:
- **Planning → Active** when a task is In progress, Blocked or Done.
- **→ Finished** when every task is Done.
- **Finished → Active** when a task re-opens or a new one is added.
- Never back to Planning; a project without tasks keeps its status; archived projects are left alone.
Each automatic change is in the project's history ("Changed automatically. Every task is done.").
People can still set any status in "Edit project"; the rule runs again on the next task change.
Rule: `statusFromTasks` (`lib/domain/projects.ts`, unit-tested); applied by
`followTaskStatuses` (`lib/projects/guards.ts`).

## D-030 · 2026-10-27 · Milestones belong to the organization
Product owner: milestones are useful "if they show in all projects".
- A milestone is a name and a date of the **organization** (e.g. "Festival opens"). Editors manage
  them on the Projects page; members see them; external collaborators don't (D-025).
- Every project page lists all milestones under its timeline. Timelines draw a flag line for the
  milestones inside their dates or linked to their tasks (others would squeeze the scale).
  The Overview lists the next five.
- A task can be linked to milestones ("must be done before"). The milestone's day itself is
  already late: a task ending on or after it shows the late days in red (like overlaps), with
  the warning, the row note and the plan preview before saving. Nothing moves by itself.
- Deleting a milestone removes its links (not archived: milestones aren't project history);
  adding or removing a task's link is in the project history.

## D-031 · 2026-10-27 · The Gantt extends our own timeline (no library), read-only
The blueprint asked for "a suitable maintained library". Compared (2026-10-27):
| Option | Licence / upkeep | Why not |
| --- | --- | --- |
| Frappe Gantt 1.2.x | MIT, active | No original-plan bars, no partial red days on a bar, no milestone lines, own CSS, SVG without text for screen readers |
| SVAR React Gantt 2.x | MIT core + paid PRO, React 19, active | Editor-oriented (grid, editor, dragging); read-only and screen-reader support unverified; heavy for a view; own theme |
| DHTMLX Gantt | GPL / commercial | Licence unsuitable for a closed product |
| gantt-task-react | MIT, no commits since ~2023 | Not maintained |
Product owner chose to **extend our own timeline** (and said: **no dragging**). Dates still come
from durations and are changed in the cronograma. The Gantt (`/<org>/projects/<id>/gantt`):
subproject summary rows + task rows in subproject colours, Days / Weeks zoom, finish-to-start
arrows (subproject links and task links inside the project; red when the successor starts too
early), today line, milestone flags, original plan (dashed), red overlap / late days. Every row
states its dates, links and warnings in words; the chart scrolls inside its own region with the
names pinned. Layout maths in `lib/domain/gantt.ts` (unit-tested). No new dependency.
Links to tasks in other projects are listed under the chart.

---

## D-032 · 2026-10-27 · Staging on Vercel + a hosted Supabase project
Product owner: the laptop can't run Docker, the dev server and the browser tests together, so
testing moves to a hosted staging environment (answers Q3).
- App: Vercel (Hobby plan while testing; Pro once the company uses it), project imported from
  GitHub, redeploys on every push to `main`. Address: https://jupigenio.vercel.app.
- Database: Supabase project `vuhifzervwszejqdpbnb` (region eu-north-1; production will be its
  own project, region chosen then). Migrations applied with `supabase db push`; no seed data.
- Auth settings set in the dashboard (they don't travel with migrations): public sign-up off,
  Site URL and redirect URLs = the Vercel address.
- **Invitation emails don't work on staging yet**: hosted Supabase only allows our invite
  template with a custom SMTP sender, and the default template's link doesn't match
  `/auth/confirm`. Until Q4 is answered, staging users are added in the dashboard.
- Staging holds test data only.

## D-033 · 2026-10-27 · Admins and production managers start new organizations
Product owner's request: a production manager working on two festivals keeps each one as a
separate organization (own projects, team, milestones, calendar) and switches between them.
Amends D-021: accounts stay invitation-only, but an operator no longer has to create every
organization.
- Anyone who is an **admin or production manager in at least one organization** can create one
  ("New organization" in the sidebar's organization menu, or on the profile page). They become
  its admin and only member; others join by invitation. Members and external collaborators can't.
- The rule lives in the database: `public.create_my_organization(name, slug)` (SECURITY DEFINER)
  checks the caller's roles; the table's checks still enforce the name, address format,
  reserved words and uniqueness (+13 pgTAP). The operator script `org:create` still works.
- Switching: the sidebar menu (shown whenever someone has several organizations or may create one)
  and a "Your organizations" list on the profile page. After sign-in people still land in their
  first organization by name.
- Not done: deleting or renaming an organization's address from the app; no limit on how many
  organizations one person creates.

---

# Open questions (non-blocking)

Sensible defaults are used until answered.

| # | Question | Default used now |
| --- | --- | --- |
| Q1 | UI language(s): English only, or Brazilian Portuguese? The team's spreadsheets are all in pt-BR. | **Answered: English** (D-019) |
| Q2 | Default currency and timezone? The spreadsheets suggest Brazil. | Per-organization setting. Proposed default changed to `BRL` / `America/Sao_Paulo` (was EUR/Lisbon) |
| Q3 | Hosted Supabase project now, or local Docker only until Phase 9? | **Answered: staging now** (D-032) |
| Q4 | Email provider for invitations (Supabase default SMTP is rate-limited)? | Needed now for invitations on staging (D-032): Gmail app password (staging) or Resend/Postmark with a company domain |
| Q5 | What can `external` collaborators see: costs, materials, other subprojects? | Only explicitly shared projects; no costs or catalogue |
| Q6 | Should a subproject owner see sibling subprojects (e.g. DJ owner sees Stage)? | Read-only visibility of siblings is *off*; access flows down from shared ancestors only |
| Q7 | Product name / branding: "JupiGenio"? | Used as the working name |
| Q8 | Should task progress be derived from status (e.g. In progress = 50%) as an org option? | Manual 0–100; `done` = 100 |
