# Tibúrcio — Build Plan for Claude Code

> **How to use this file**
> 1. Create a new, **private** GitHub repo called `tiburcio`.
> 2. Put this file in it as `docs/PLAN.md` and the homepage design as `docs/design/homepage.dc.html`.
> 3. Clone `jupigenio` **next to it** so Claude Code can read both:
>    ```
>    ~/dev/
>    ├── jupigenio/   (existing app — reference + small integration changes)
>    └── tiburcio/    (this new project)
>    ```
> 4. Open Claude Code in `~/dev/tiburcio` and say:
>    *"Read docs/PLAN.md and start with Phase 0. Stop at the end of each phase for my review."*

---

## 1. What we are building

**Tibúrcio** is Bruno's personal "Jarvis"-style command center: one web app (desktop + Android as a PWA) where he can:

- see everything at a glance on a **Home** dashboard (HUD style, green, with a tuga sense of humour);
- **chat and talk with Claude** ("Fala com o Tibúrcio");
- manage **personal projects** (DIY, life, family, career);
- open **jupigenio** in its own tab — jupigenio stays a **separate app** for focused work on specific projects;
- later: **import photos** from his Android phone to external drives, connect Gmail/Calendar/Drive, voice on Android.

**Personal projects (Tibúrcio) ≠ jupigenio projects.** Tibúrcio's "Personal projects" module is its own data. jupigenio keeps its own projects and is only *embedded and summarised* in Tibúrcio.

Owner / only user for now: **Bruno**. Design for one user, but keep a `users` table so more users are possible later.

---

## 2. Ground rules for Claude Code

1. **Discover before building.** Phase 0 is mandatory: read jupigenio and write `docs/DISCOVERY.md` before writing app code.
2. **Mirror jupigenio's stack.** Same language, framework, ORM/migration tool, DB engine, package manager, lint/format config, server/hosting and deploy method. Don't introduce a new framework or database unless this plan says so, and explain why in `docs/DECISIONS.md`.
3. **Same DB server, separate database.** Reuse jupigenio's DB server/instance and connection style, but use a **separate database (or schema, if that is how jupigenio is set up) named `tiburcio`**, with its **own DB user** that has no rights on jupigenio's data. If jupigenio uses SQLite, use a separate `tiburcio.db` file with the same driver/ORM. Never read or write jupigenio's tables directly. Talk to jupigenio only through its API (section 7).
4. **jupigenio changes are minimal and isolated.** Do them on a branch `feat/tiburcio-integration` in the jupigenio repo, behind a config flag, so jupigenio still works on its own. Open a PR; never push to its main branch.
5. **Secrets** live in `.env` (git-ignored). Commit only `.env.example` with placeholder values. Never log secrets or tokens.
6. **Ask before destructive actions:** dropping or resetting databases, rewriting migrations that already ran, force-pushing, deleting files outside the repo.
7. **Small, reviewable steps.** One phase = one or more PRs with a short summary, a checklist of acceptance criteria and how to test it.
8. **Performance is a feature** (section 10). Check the budget at the end of every phase.

---

## 3. Phase 0 — Discovery (no app code)

Read the jupigenio repo and write `docs/DISCOVERY.md` covering:

| Topic | What to find out |
|---|---|
| Stack | Language, framework and version, frontend/backend split, package manager, monorepo or not |
| Database | Engine and version, where it runs (local, Docker, managed), connection config (env var names), ORM, migration tool, seed scripts |
| Server / hosting | How it runs in dev and prod: ports, Docker/compose, reverse proxy (nginx/Caddy/Traefik?), domain, TLS, process manager, CI/CD |
| Auth | Login method (sessions, JWT, OAuth, library), users table, where sessions are checked, middleware/guards |
| Routing | Root path assumptions, whether it supports a base path (`/jupigenio`) |
| API | Existing endpoints, especially anything listing projects |
| UI | Component library, styling (Tailwind/CSS modules/…), icons |
| Tests and quality | Test runner, lint, typecheck, formatting |

End `DISCOVERY.md` with:

- **"Tibúrcio will use:"** the concrete stack decision;
- the **list of jupigenio changes needed** (section 7);
- **open questions** for Bruno.

**Stop and wait for Bruno's review.**

---

## 4. Architecture

Adapt names to jupigenio's conventions; this is the target shape.

```
tiburcio/
├── apps/
│   ├── web/            # Tibúrcio UI (PWA): shell, Home, modules
│   └── api/            # Backend: auth, data, integrations, reverse proxy to jupigenio
│                       # (if jupigenio is full-stack in one app, e.g. Next.js, merge web+api the same way)
├── services/
│   └── agent/          # Claude agent worker (separate process), runs jobs from a queue
├── packages/
│   ├── db/             # schema, migrations, seed (same ORM as jupigenio)
│   ├── ui/             # design tokens + shared components (HUD panels, buttons, badges)
│   └── shared/         # types, validation schemas, API client
├── docs/
│   ├── PLAN.md  DISCOVERY.md  DECISIONS.md
│   └── design/homepage.dc.html
├── docker-compose.yml  # only if jupigenio uses Docker; same style
├── .env.example
└── CLAUDE.md           # short: commands, conventions, "read docs/PLAN.md"
```

**Runtime picture**

```
Browser / Android PWA
        │  HTTPS (single login)
        ▼
 Tibúrcio web + api ──── /jupigenio/* ──► jupigenio (private network/localhost only)
        │                                      ▲
        │ enqueue job / SSE stream             │ REST (read summaries)
        ▼                                      │
 Agent worker (Claude Agent SDK) ──────────────┘
        │
        ▼
 DB server (same as jupigenio) → database `tiburcio`
```

- **Queue:** start with a **DB-backed job table** (`jobs`), so no new infrastructure is needed. Workers claim jobs atomically (Postgres: `SELECT … FOR UPDATE SKIP LOCKED`; otherwise an equivalent conditional update). If jupigenio already runs Redis, a Redis queue is fine too.
- **Agent worker language:** the Claude Agent SDK is available for **TypeScript and Python**. If jupigenio's backend is in one of these, use the same one. If not (e.g. Java), write the worker in TypeScript as a small separate service and record that in `DECISIONS.md`.
- **Streaming:** agent replies stream to the browser over **Server-Sent Events**.
- **Deploy:** same server and method as jupigenio. Tibúrcio becomes the public entry point; jupigenio is only reachable through Tibúrcio.

---

## 5. Data model (database `tiburcio`)

| Table | Key fields |
|---|---|
| `users` | id, email (unique), name, password_hash or external auth id, created_at |
| `sessions` | if the auth library needs it |
| `personal_projects` | id, user_id, name, slug, category (`build`, `diy`, `career`, `family`, `garage`, `other`), description, status (`idea`, `active`, `paused`, `done`), icon, cover_image_url, sort_order, created_at, updated_at |
| `project_tasks` | id, project_id, title, done, due_date, sort_order |
| `project_notes` | id, project_id, title, body (markdown), kind (`note`, `decision`), created_at |
| `project_materials` | id, project_id, item, quantity, unit, unit_price, currency (default EUR), store, bought (bool) |
| `project_files` | id, project_id, filename, storage_path, mime, size |
| `chat_threads` | id, user_id, project_id (nullable), title, created_at |
| `chat_messages` | id, thread_id, role (`user`, `assistant`, `tool`), content (json), tokens_in, tokens_out, created_at |
| `jobs` | id, type, payload (json), status (`queued`, `running`, `done`, `failed`), attempts, run_after, result (json), error, timestamps |
| `feed_events` | id, user_id, source (`system`, `jupigenio`, `github`, `agent`, …), level (`info`, `tip`, `warn`), title, subtitle, link, created_at, read_at |
| `integrations` | id, user_id, provider, status (`linked`, `not_linked`, `error`), encrypted_credentials, settings (json), last_sync_at |
| `drives` (later) | id, label, volume_uuid, role (`photo_archive`, …), last_seen_at, free_bytes |
| `photo_imports` (later) | id, drive_id, started_at, finished_at, files_copied, files_skipped, status |
| `agent_actions` | id, user_id, tool, input (json), output summary, requires_confirmation, confirmed_at, created_at (audit log) |
| `settings` | user_id, key, value (json) |

**Seed data: Bruno's personal projects**

| name | category | description |
|---|---|---|
| Main Stage | build | Structure, shade sail and DJ booth |
| Banco em L | diy | Plywood storage modules with pine tops |
| Sistino | diy | Small stackable piece made from offcuts |
| Remote job · Brasil | career | Remote TIBCO work as a PJ contractor |
| Negócio do tio | family | Digitalising the plumbing business |
| Mota | garage | The old motorbike, freshly repainted |

Status for all: `active` (Bruno will adjust).

---

## 6. Auth and security

- **Tibúrcio owns the only login.** One secure session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`), CSRF protection on mutating requests, login rate limiting.
- **Use jupigenio's auth approach/library if it's sound**, so the two codebases stay consistent. If jupigenio has no real auth, use a well-maintained library for the stack; never hand-roll password hashing (argon2/bcrypt).
- Bruno's Tibúrcio user is created by a CLI seed command (`create-user`), not public signup. **Signup is disabled.**
- The Claude API key and integration tokens are stored **encrypted at rest**. The key comes from env (`APP_ENCRYPTION_KEY`).
- The agent can only do what its tools allow (section 8). Any **destructive or outward action** (delete, send email, push, copy or delete files) needs explicit user confirmation in the UI and is written to `agent_actions`.
- Security headers: CSP (`frame-ancestors 'self'`), HSTS in prod, no wildcard CORS.

### 6.1 Environment variables (`.env.example`)
```
# Database (same server as jupigenio, separate database + user)
DATABASE_URL=            # e.g. postgres://tiburcio:***@<jupigenio-db-host>:5432/tiburcio
# App
APP_URL=                 # public URL of Tibúrcio
SESSION_SECRET=
APP_ENCRYPTION_KEY=      # 32-byte key for encrypting tokens at rest
# jupigenio
JUPIGENIO_INTERNAL_URL=  # e.g. http://127.0.0.1:3001
TIBURCIO_SHARED_SECRET=  # same value set in jupigenio
# Claude
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```
Match the variable naming style jupigenio already uses if it differs.

---

## 7. jupigenio integration

### 7.1 Goal
jupigenio opens in a **"jupigenio" tab inside Tibúrcio**, at `https://<tiburcio-domain>/jupigenio/…`, with **no second login**. jupigenio stays usable on its own when the flag is off.

### 7.2 How it works
1. Tibúrcio's backend **reverse-proxies** `/jupigenio/*` to jupigenio's internal address (`JUPIGENIO_INTERNAL_URL`, e.g. `http://127.0.0.1:<port>`).
2. Before proxying, Tibúrcio checks the session and adds:
   - `X-Tiburcio-User-Email: <email>`
   - `X-Tiburcio-Signature: <HMAC-SHA256(email + timestamp, TIBURCIO_SHARED_SECRET)>`
   - `X-Tiburcio-Timestamp: <unix seconds>`
   and **strips** any incoming `X-Tiburcio-*` headers from the client.
3. The jupigenio tab in Tibúrcio renders jupigenio in a full-height frame pointing at `/jupigenio/` (same origin, so no cookie or CORS problems). Later, screens can be ported natively if wanted.

### 7.3 Changes in jupigenio (branch `feat/tiburcio-integration`)
- `AUTH_MODE=standalone | tiburcio` env flag (default `standalone`, so nothing changes until enabled).
- In `tiburcio` mode:
  - skip jupigenio's login and signup screens;
  - an auth middleware verifies the HMAC signature (reject if invalid or older than 60 s), then finds the jupigenio user by email or creates it;
  - only accept connections from Tibúrcio: bind to localhost or a private network, and/or allow-list the proxy's IP. **This network restriction is the main protection.** The HMAC check is a second layer and doesn't replace it.
  - In `standalone` mode, `X-Tiburcio-*` headers are **ignored completely**.
- **Base path support:** `BASE_PATH=/jupigenio`, covering routes, static assets and API calls. If the framework makes a base path impractical, fall back to a subdomain (`jupigenio.<domain>`) behind the same proxy, and record that in `DECISIONS.md`.
- **Integration endpoint** for the Home panel: `GET /api/integration/summary` returning
  `{ projects: [{ id, name, status, updatedAt, url }], counts: {...} }`, authenticated with the same HMAC headers.
- Allow framing only by same origin (`frame-ancestors 'self'`).
- Tests for the middleware: valid signature, bad signature, expired timestamp, missing headers, standalone mode unaffected.

### 7.4 In Tibúrcio
- The `JUPIGENIO` panel on Home calls `/api/jupigenio/summary`, which the Tibúrcio backend fetches from jupigenio and **caches for 60 s**. While jupigenio is unreachable, the panel shows "jupigenio offline" without breaking Home.
- `feed_events` gets entries such as "jupigenio: project X updated" (polled every 5 min by a job, or pushed by a webhook later).

---

## 8. Claude agent ("Tibúrcio")

- **Engine:** Claude **Agent SDK** in `services/agent`, a separate process. The model is configurable (`ANTHROPIC_MODEL`), with a cost-sensible default for everyday chat and an option to switch to a stronger model per thread.
- **Flow:** the UI posts a message → the API stores it and enqueues an `agent.reply` job → the worker runs the agent → tokens stream back to the browser via SSE → the final message is stored.
- **Context:** the system prompt holds the persona and the user profile. When a thread belongs to a personal project, the project's data (tasks, notes, materials) is added as context.
- **Tools (v1):**
  - `projects.list / get / create / update`, `tasks.add / complete`, `notes.add`, `materials.add / update`
  - `jupigenio.summary` (read-only)
  - `feed.post`
  - Later: `calendar.*`, `gmail.*` (draft only, no sending without confirmation), `github.*`, `photos.*`
- **Persona:**
  - Name: **Tibúrcio**.
  - Helpful and competent first, with a light **Portuguese (PT-PT) humour**: occasional sayings ("Calma, isto resolve-se", "Bora lá"), never forced, never in the way of the answer.
  - Answers in the language Bruno writes in.
- **Limits:**
  - At most N tool calls per reply.
  - Timeout per job.
  - Destructive tools require confirmation (section 6).
  - Token usage is stored per message so Settings can show monthly usage.

---

## 9. UI and design

The source of truth is **`docs/design/homepage.dc.html`**. It's an HTML design file; open it in a browser or read the markup. Rebuild it with jupigenio's UI stack. Don't embed the file itself.

### 9.1 Design tokens
| Token | Value |
|---|---|
| bg | `#030d08` (+ subtle radial glow `rgba(34,197,94,0.10)` near top) |
| panel | `rgba(8,28,19,0.72)`, border `rgba(74,222,128,0.22)`, radius 12px |
| inner card | `rgba(3,13,8,0.5)`, border `rgba(74,222,128,0.14)`, radius 8–10px |
| accent (neon green) | `#39FF8C` (user-adjustable in Settings: `#22C55E`, `#A3E635`, `#2DD4BF`) |
| text / strong / muted | `#d7f5e3` / `#eafff2` / `#86b39b` (secondary `#a9d6bd`) |
| section label | `#7ff0b0`, Rajdhani 700, 13px, letter-spacing .16em, uppercase |
| ok / warn / off | `#4ade80` / `#fbbf24` / `#8aa597` |
| jupigenio (teal) | `#5eead4`, panel bg `rgba(6,24,24,0.72)`, border `rgba(45,212,191,0.35)` |
| fonts | **Orbitron** (brand, big numbers), **Rajdhani** (labels, buttons), **Inter** (body), via Google Fonts or self-hosted |

### 9.2 Layout (desktop ≥ 1280px)
- **Top bar:**
  - TIBÚRCIO logo with "Command Center" under it
  - System status pill
  - Live date and clock (`en-GB`, or `pt-PT` per setting)
  - Search, notifications, settings
  - User chip ("Bruno · Commander")
- **Left sidebar:**
  - Navigation: Command Center, Chat, Personal projects (count badge), jupigenio, Photos & Storage, Calendar, Integrations, Settings
  - **Voice** panel: waveform, round mic button, "Tap to speak", Focus mode
- **Row 1:**
  - **Core overview:** module statuses
  - **Core panel:** glowing green **wine bottle** labelled "TIBÚRCIO · Reserva do Chefe · Colheita 2026" (the words "Vinho Verde" must **not** appear on the bottle) with a glass of red, the title "TIBÚRCIO / AI CORE · EDIÇÃO VINHO VERDE", and a **speech bubble** rotating taglines every 7 s
  - **Live feed:** from `feed_events`
- **Row 2:**
  - **Personal projects:** 3-column grid of cards (icon, name, category tag, description) → opens the project
  - **jupigenio:** teal panel with a "Separate app" tag, its project summary, and an "Open jupigenio ›" button
  - **Quick commands:** Talk to Tibúrcio, New personal project, Open jupigenio, Import photos, Daily briefing
- **Row 3:**
  - **Today:** calendar, with a "Connect calendar" empty state
  - **Photos & Storage:** Inbox on this computer, photo drive, Android phone, and an "Import photos" button
  - **Integrations:** grid with linked/not linked status
- **Bottom bar:**
  - Device chips: This computer, Android phone, jupigenio
  - Big glowing **"FALA COM O TIBÚRCIO"** button
  - Daily briefing button

**Mobile (PWA):**
- The sidebar becomes a bottom tab bar (Home, Chat, Projects, jupigenio, More).
- Panels stack in one column.
- "Fala com o Tibúrcio" becomes a floating button.

### 9.3 Copy (keep it tuga)
- **Taglines:**
  - "Olá chefe! Então, bora trabalhar?"
  - "Calma, isto resolve-se. Primeiro um café."
  - "Tudo em ordem. Só falta o bacalhau."
  - "Está-se bem. Que é que se faz hoje?"
  - "Projeto difícil? Abre-se uma garrafa e pensa-se."
  - "Não é desenrascanço, é engenharia à portuguesa."
- **Voice states:** "À escuta, chefe…" / "Em pausa · a beber um café"
- **Footer:** "v0.1 · feito à tuga · powered by Claude"

### 9.4 Rules
- **No fake data.** Panels show real data or an honest empty state ("Not linked", "Connect calendar").
- **Accessibility:**
  - real `<button>` and `<a>` elements
  - `aria-label` on icon-only buttons
  - text contrast at least 4.5:1
  - touch targets at least 44px
  - colours that must be told apart also differ in lightness
- Respect `prefers-reduced-motion`: no glow pulses or waveform animation when it's set.

---

## 10. Performance budget (Bruno's main concern)

- Home **first contentful paint < 1.5 s** and **interactive < 2.5 s** on a mid-range Android over 4G (Lighthouse mobile).
- Initial JS **< 200 KB gzipped**. Each module (Chat, Projects, jupigenio frame, Photos) is **lazy-loaded** with code splitting.
- One **`GET /api/home`** call returns all Home panel data. The server assembles it and caches external parts: jupigenio 60 s, integrations 5 min. A slow or failing source never blocks the others: per-source timeout of 1.5 s, and that panel shows an offline state.
- The agent never runs inside the request cycle. It always goes through the worker and SSE.
- DB: indexes on all foreign keys and on `feed_events(user_id, created_at)` and `jobs(status, run_after)`. Lists are paginated.
- The clock and animations run on the client only. No polling faster than 30 s, except the clock.
- Add a simple `/healthz` and a request timing log. Report the Lighthouse score in each phase PR.

---

## 11. Phases and acceptance criteria

**Phase 0 · Discovery.** `docs/DISCOVERY.md` is approved by Bruno.

**Phase 1 · Skeleton and auth**
- New repo scaffolded on the same stack, with lint, typecheck, tests and CI like jupigenio.
- The `tiburcio` database is created on the same DB server, migrations run, and the seed creates Bruno's user and the 6 personal projects.
- Login and logout work, signup is disabled, sessions are secure.
- `CLAUDE.md` lists the commands (dev, test, migrate, seed, create-user).

**Phase 2 · Home dashboard**
- Home matches `homepage.dc.html` on desktop and mobile, using the tokens in 9.1.
- Live clock, rotating taglines, core overview and Personal projects show real data. Other panels show their honest empty states.
- The `/api/home` endpoint is done, and the performance budget is met.

**Phase 3 · Personal projects module**
- List, create, edit and archive projects.
- Project page tabs: Overview, Tasks, Notes and decisions, Materials (with totals in EUR), Files.

**Phase 4 · jupigenio integration**
- The jupigenio PR (7.3) is merged behind `AUTH_MODE=tiburcio`.
- The jupigenio tab works under `/jupigenio` with no second login. Direct access to jupigenio from outside is refused.
- The Home jupigenio panel shows real projects, with the offline state handled.
- Standalone jupigenio still works with the flag off (tested).

**Phase 5 · Chat with Tibúrcio**
- Threads, both general and per project.
- Streaming replies, the v1 tools from section 8, the confirmation flow, the `agent_actions` log, and token usage shown in Settings.
- Quick commands "Talk to Tibúrcio" and "New personal project" work through the agent.

**Phase 6 · Integrations**
- GitHub first: repo activity goes to the feed.
- Then Google Calendar ("Today" panel) and Gmail (summary plus drafts).
- OAuth tokens are stored encrypted.

**Phase 7 · Android and voice**
- PWA: installable, with manifest, icons and offline shell.
- Push notifications for feed events.
- Speech-to-text in the browser for "Fala com o Tibúrcio", with text-to-speech replies.
- Later, as a separate spec: a native Android wrapper set as the default assistant.

**Phase 8 · Photos import** (separate spec, to be written with Bruno)
- A manual flow: **Import photos → connect phone → choose drive → preview new photos → copy and verify → summary**.
- It needs a small local helper on Bruno's computer for drive and USB access. There's no home server and no automatic sync.

---

## 12. Testing and review checklist (every PR)

- [ ] Lint, typecheck and tests pass in CI.
- [ ] New endpoints have auth checks and input validation.
- [ ] No secrets in code, logs or the client bundle.
- [ ] Migrations are reversible and run on a fresh DB.
- [ ] UI checked at 390px and 1440px widths; keyboard navigation works; contrast passes.
- [ ] Performance budget checked (Lighthouse mobile score in the PR).
- [ ] jupigenio standalone mode still works (Phase 4 onward).
- [ ] `docs/DECISIONS.md` updated for any deviation from this plan.

---

## 13. Open questions for Bruno (answer during Phase 0)

1. Domain or URL for Tibúrcio in production, and where jupigenio is hosted today?
2. Should the dashboard date and clock be in English or Portuguese (pt-PT)?
3. Default Claude model: cheaper by default, or always the strongest?
4. Are there jupigenio users besides Bruno that the new auth mode must keep working for?
5. Which integration comes after GitHub: Calendar or Gmail?
