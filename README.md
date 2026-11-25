# deboTrack (Next.js)

Deboistech's admissions CRM: a full-stack TypeScript app. It keeps all its tables in its own `app` schema of a PostgreSQL database.

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, **Cache Components + Partial Prefetching**), React 19 |
| Language / UI | TypeScript, Tailwind CSS 4, Manrope, lucide icons, Recharts, Sonner toasts, next-themes (dark mode) |
| Data | PostgreSQL via Drizzle ORM (`postgres.js`), all tables in their own `app` schema |
| Auth | Own session auth: bcrypt, random session token (only its SHA-256 is stored), HTTP-only cookie, sign-in lockout |
| Files | CSV and Excel import / export (`papaparse`, `exceljs`) |
| Quality | strict TypeScript, ESLint (React Compiler rules), Vitest unit tests |

## Run it

```bash
pnpm install
cp .env.example .env.local        # set DATABASE_URL
pnpm db:push                      # creates the "app" schema and tables
pnpm db:seed                      # roles, pipeline stages, sources, first administrator (password printed once)
pnpm dev -H 127.0.0.1             # http://127.0.0.1:3000
```

Production: `pnpm build && pnpm start -H 127.0.0.1 -p 3000` behind HTTPS (Nginx, a tunnel, …).
Leave `COOKIE_SECURE=true` there; set it to `false` only to try the production build over plain `http://localhost`.

Other commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`.

> This is a recent Next.js: `middleware` is now `proxy`, `cookies()` / `params` / `searchParams` are async, and uncached data
> must sit under `<Suspense>` (the `(app)/loading.tsx` file provides it). The version's own docs are in
> `node_modules/next/dist/docs/` and `AGENTS.md` tells coding agents to read them first.

## What is in it

Everything the daily work needs, with the same behaviour and wording as the Laravel version:

- **Enquiries**: list (search, filters, pagination) and **board** view, inline status dropdown (one fixed compact size), create / edit / view / delete.
  Student card + lead details, pipeline bar, notes and planned calls / meetings / tasks with a timeline.
- **Fees**: the course fee comes from the chosen **batch** and cannot be typed; the counsellor adds a **percent or fixed discount** and the **final fee** is worked out
  (on screen and again on the server). The fee, discount and final fee are exported too.
- **Learners** and **Schools & Colleges** as two tabs of one sidebar entry; a learner's profile lists their enquiries and has "Create enquiry".
  Saving an enquiry for a phone or email that already exists **links to that learner** instead of duplicating them (phones match on the last 10 digits).
- **Import / export** of enquiries, learners and connections (CSV or Excel): downloadable templates, columns matched by title in any order,
  **"Same for every row"** College / Branch / Year, "learners only" mode, round-robin assignment, a per-row report of what failed and why.
  Exports defuse spreadsheet formulas (`=`, `@`, `+cmd…`) so a malicious name cannot run in Excel.
- **Programs & batches**, **Connections** (HOD / Principal / TPO contacts grouped by institution), **Activities** (today / overdue / upcoming / done).
- **Dashboard**: key numbers, pipeline funnel, enquiries-per-day chart, follow-ups today, latest enquiries, by source, by program, upcoming batches, counsellors.
- **Users, roles and permissions**: custom roles with per-feature permissions and a "sees only their own" scope; pipeline statuses, sources and lead types editable in Settings.
- **Server shutdown notice**: an administrator announces a shutdown; every open page shows a popup with download buttons for a read-only copy of that person's data.
- Footer greeting and **clock**, dark mode, phone / tablet layout with a menu drawer, keyboard-friendly forms, accessible labels and live regions.

## Security notes

- Passwords are bcrypt (cost 12); sessions are random 256-bit tokens, stored hashed, 12 h, revoked on sign-out, on deactivation and on password change.
- Sign-in lockout: 5 wrong tries per email+IP (and 20 per IP) lock that pair for 15 minutes; a wrong email takes as long as a wrong password.
- Every page and action re-checks the session **and** the permission on the server; `proxy.ts` is only a first redirect.
  "Only their own" roles are filtered inside every query, and records they may not see answer 404.
- Server Actions carry Next.js's built-in origin checks; all SQL is parameterised (Drizzle); security headers are set in `next.config.ts`.
- A Content-Security-Policy blocks external scripts, frames and form targets. It still allows inline scripts, because a nonce-based policy would make every page dynamic.
- Inputs are checked on the server: phone (7 to 15 digits), email format, length limits, dates, seats, discounts. Ids in URLs that don't fit the database answer 404.
- Not done yet: two-factor sign-in, an audit log screen.

## Not ported yet (the Laravel app has them)

Quotes and quote PDFs, custom-field builder (Settings → Attributes), workflows, webhooks, web forms, email templates / mail inbox, tags and groups,
data migration from the old Laravel database (the EAV tables need a mapping script), per-feature on/off switchboard, Magic AI, Google Contacts.
The modules the Laravel build already switched **off** for admissions work (warehouses, campaigns, products, data transfer) are intentionally absent.

## Layout

```
src/db/            schema.ts (all tables), index.ts (connection), seed.ts
src/lib/           auth, permissions, fee maths, phone / year parsing, spreadsheet column map (+ unit tests)
src/server/        queries and services (leads, learners, importer, exporter, dashboard, notice …)
src/app/(app)/     the signed-in pages, each with its server actions
src/app/api/       export, template and notice endpoints
src/components/    UI kit (ui/), forms kit, shell (sidebar, footer, popup), feature components
```
