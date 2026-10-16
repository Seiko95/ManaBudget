# ManaBudget: build spec

## Instructions for Claude Code
You are building **ManaBudget** from scratch in this (empty) repository: a self-hosted personal budget app (Docker) that works well on PC and phone. This document is the spec. Every decision in it was made with the owner during an interview, so treat it as settled.

**How to work**
- Work through the **Build order** one step at a time. Finish each step completely before you start the next.
- After each step, run `npm run check`, the linter and the tests that exist so far. Fix failures, then **commit** with a clear message. Don't move on while things are red.
- If something needed is **not covered by this spec**, stop and ask me. Don't guess, and don't add features outside it (see **Non-goals**).
- At the end of each step, give me a short summary: what was built, how to try it, and anything that deviates from this spec and why.

---

## Decisions (settled)
| Topic | Decision |
|---|---|
| Category ↔ budget | **A budget contains categories**: the user picks a category and the budget follows from it |
| Budget periods | **Monthly for all budgets**, month starts on a **custom day per user** (payday, 1–28) |
| Users | **Several separate users**, each with private data. **First user = admin**, and the admin creates the other accounts (no open sign-up) |
| Scope | **Expenses + income** (no bank accounts/transfers) |
| Places | **Name + address + GPS**, optional default category, "nearest place" suggestion, inline create button at the bottom of the place list |
| Expense fields | amount, date, place, category→budget, description, **photos**, **splits across categories**, **tags** |
| Extras v1 | **Recurring** (created automatically), **search & filters**, **budget alerts** (in-app) |
| Charts | budget progress bars, spending by category, monthly trend (income vs expenses), spending by place (incl. map) |
| Locale | **EUR, French UI** |
| Mobile | **Installable PWA, online only** |
| Access | **Tailscale** (HTTPS through Tailscale certificates, which GPS and PWA install require) |
| Starter data | **French starter set** of budgets/categories with no limit set |
| Stack | **SvelteKit + TypeScript + SQLite in one container** |

## Stack
- **SvelteKit 2 / Svelte 5 / TypeScript**, `@sveltejs/adapter-node` (one Node process, so one container)
- **SQLite** (`better-sqlite3`) + **Drizzle ORM** with migrations that run automatically at startup. DB and uploads live in `/data` (one volume, easy backup)
- **Tailwind CSS v4** + **shadcn-svelte** (accessible Combobox/Command, Dialog, Drawer for mobile bottom sheets)
- **Chart.js** for charts; budget progress bars in plain HTML/CSS. Chart rules: each budget keeps **one color** across all charts, amounts are formatted in €, tooltips are on, text is readable at phone width, colors work in **dark mode**, and horizontal bars are preferred over pies once there are more than about 5 slices
- **Leaflet** + OSM tiles; geocoding through a **server-side Nominatim proxy** (throttled to 1 req/s, cached, sends a User-Agent, never called on every keystroke). Tile URL and geocoder URL configurable via env, and geocoding can be disabled
- **sharp**: resize photos, convert to WebP, strip EXIF (EXIF can contain the GPS location), make 400px thumbnails. Photos are also shrunk in the browser before upload (≤2000px) to save mobile data
- **@node-rs/argon2** for passwords; DB-backed sessions (Lucia-style, `@oslojs/crypto`) with an httpOnly SameSite=Lax cookie that renews while in use for 30 days. Login attempts are rate-limited
- **date-fns** (`fr` locale); money stored as **integer cents** and formatted with `Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'})`
- Every UI string lives in `src/lib/i18n/fr.ts`, so English can be added later without hunting through components

## Data model (`src/lib/server/db/schema.ts`)
Every user-owned table has `user_id`, and **every query is scoped by `locals.user.id`** through a helper in `src/lib/server/scope.ts`.
- `users` (username, password_hash, display_name, is_admin, month_start_day 1–28, created_at)
- `sessions` (id = sha256(token), user_id, expires_at)
- `budgets` (name, color, icon, alert_threshold % default 80, sort_order, archived)
- `budget_limits` (budget_id, effective_from period-start date, amount_cents): **limit history**, so a raise in November doesn't rewrite October. The limit used is the latest row with `effective_from ≤ period start`. 0 = no limit set
- `categories` (budget_id NOT NULL, name, icon, sort_order, archived)
- `places` (name, address, lat, lng, default_category_id nullable, archived)
- `expenses` (date `YYYY-MM-DD`, total_cents, place_id nullable, description, recurring_rule_id nullable, occurrence_date nullable, timestamps). UNIQUE(recurring_rule_id, occurrence_date)
- `expense_splits` (expense_id, category_id, amount_cents). **Every expense has ≥1 split**; a non-split expense has exactly one. All per-budget/category totals come from splits. Validation: splits sum to total, all > 0
- `tags` (name, color) and `expense_tags` (expense_id, tag_id)
- `photos` (expense_id, file, thumb_file, mime, width, height, size). Files go in `/data/uploads/<user_id>/<uuid>.webp` and are served only through the authenticated route `/photos/[id]` after an owner check
- `incomes` (date, amount_cents, source text with autocomplete from past values, description, recurring_rule_id, occurrence_date)
- `recurring_rules` (kind expense|income, amount_cents, category_id, place_id, source, description, frequency monthly|weekly|yearly, day_of_month, start_date, end_date nullable, next_due_date, active)

## Core logic (`src/lib/`)
- `periods.ts` (shared client+server): `periodFor(date, startDay)`, `periodRange(label)`, `prev/next`. Each period is **labelled by the month that holds most of its days** (start day 25 → "Octobre" = 25 sept.–24 oct.), and the date range is always shown under the label
- `server/stats.ts`: spent per budget/category for a period (from splits), income vs expense per period over N periods, totals per place
- `server/recurring.ts`: `materializeDue(userId?)` creates every occurrence due up to today (Europe/Paris, via `TZ`) and is idempotent thanks to the unique index. Dates on days 29–31 are moved to the month's last day. It runs at startup, every hour (`setInterval` in `hooks.server.ts`), and on dashboard load
- `server/alerts.ts`: per budget, `ok | warning (≥threshold) | over (≥100%)`. Shown on the dashboard, in a nav badge, and as a toast after saving an expense that crosses a threshold ("Alimentation : 85 % du budget utilisé")
- `server/seed.ts`: French starter set created for every new user (Alimentation → Courses, Restaurants, Snacks & cafés; Logement → Loyer, Énergie, Eau, Internet & téléphone, Assurance habitation; Transport → Carburant, Entretien, Assurance auto, Péage & parking, Transports en commun; Santé; Loisirs → Sorties, Abonnements, Sport, Voyages; Cadeaux; Shopping; Divers)

## Screens (French routes, mobile-first)
Layout: **bottom nav + central "+" button on phones**, **sidebar on desktop** (≥1024px). Forms open as a full-screen drawer on phones and a dialog/side panel on desktop. Dark mode follows the system setting.
- `/setup`: shown only while no user exists; creates the first admin
- `/login`, `/logout`
- `/` **Tableau de bord**: period switcher, income/expenses/balance tiles, budget progress bars (green/amber/red), alert banner, latest expenses
- `/depenses`: list grouped by day with daily totals; **filters in URL query params** (date range/period, budget, category, place, tag, min/max amount, text search); `/depenses/[id]` shows detail, photo lightbox, edit, delete
- **Expense form** (the key UX):
  1. Amount (numeric keypad on phones), date (defaults to today)
  2. **Place combobox**: searchable; if location permission is granted, places are sorted by distance with a "📍 Carrefour · 120 m" suggestion chip; **last item: "+ Créer « <query> »"** opens a sheet (name prefilled, address search button, "Utiliser ma position", draggable pin on a mini-map, default category) and the new place is selected right away
  3. Category combobox grouped by budget (filled in automatically from the place's default category); the budget is shown read-only. A **"Répartir"** toggle shows split rows (category + amount) with a live "reste à répartir" amount
  4. Tags chip input (autocomplete, and create one by typing a new name)
  5. Description; **photos** (camera or gallery, several per expense, thumbnails, remove)
- `/revenus`: income list and form
- `/budgets`: create/edit budgets (monthly limit, color, alert %) and their categories, reorder, archive
- `/lieux`: list and map of places, create/edit, archive (archiving never deletes past expenses)
- `/recurrents`: recurring rules for expenses and income; "Rendre récurrente" button on an expense
- `/statistiques`: range selector; spending by budget (drill down into categories), 12-period income vs expense trend with a net line, top places as a bar chart plus a map with circles sized by amount
- `/reglages`: display name, password, month start day
- `/admin` (admin only): list/create users, reset password, disable/delete. **No access to other users' data**

## Docker & hosting
- Multi-stage `Dockerfile` on `node:22-bookworm-slim` (avoids musl issues with the native modules better-sqlite3 and sharp), non-root user, `VOLUME /data`, `HEALTHCHECK` on `/api/health`
- `docker-compose.yml`: one service on port 3000 plus env: `ORIGIN` (**required** by SvelteKit's CSRF check), `TZ=Europe/Paris`, **`BODY_SIZE_LIMIT=25M`** (adapter-node defaults to 512K, which would break photo upload), `TILE_URL`, `NOMINATIM_URL`
- `.env.example` documenting every variable
- `docker-compose.tailscale.yml`: Tailscale sidecar example (`TS_SERVE_CONFIG` → HTTPS on `https://manabudget.<tailnet>.ts.net`), plus README steps (enable MagicDNS + HTTPS certificates in the Tailscale admin console; alternative: `tailscale serve` on the host)
- GitHub Actions workflow: build a **multi-arch image (amd64 + arm64)** and push it to `ghcr.io/seiko95/manabudget`, so self-hosting is just `docker compose pull && up -d`
- README: install, Tailscale HTTPS, env reference, **backup** (copy `./data`, or `sqlite3 .backup` while the app is running)

## Build order (commit after each step)
1. Scaffold: SvelteKit, Tailwind, shadcn-svelte, Drizzle + migrations, `fr.ts`, format helpers, Dockerfile/compose, health route
2. Auth: setup/login/logout, sessions, admin user management, starter seed on user creation
3. Budgets/categories + limit history; `periods.ts` + month start setting
4. Places: CRUD, map, geocode proxy, geolocation and nearest place
5. Expenses: full form (place picker with inline create, splits, tags, photos), list + filters, detail/edit/delete
6. Income
7. Recurring rules + materializer
8. Dashboard + alerts
9. Statistics charts
10. PWA (manifest, icons, `src/service-worker.ts` caching the app shell, iOS meta), responsive/dark-mode polish, README, GHCR workflow

## Verification
- **Vitest unit tests**: period computation (start days 1/15/25/28, year boundary, label rule), split validation, recurring materialization (idempotent, day-31 clamping, weekly/yearly), budget-limit history lookup, stats aggregation, **user isolation** (user B can't read or modify A's expenses/photos/places through any route)
- **Playwright e2e** (install the browser with `npx playwright install chromium`; run at both **Pixel 7** and **1440px desktop** sizes): first-run setup → admin creates a second user → log in → add an expense, **creating a place from the bottom of the place list**, splitting it across 2 categories, adding a tag and a photo → dashboard progress bar and alert update → filters return the expense → second user sees none of it
- `npm run check` (svelte-check/TS) + lint pass
- `docker build` + `docker compose up`, then curl `/api/health`, run the e2e suite against the container, restart the container and confirm the data and photos are still there (volume works)

## Non-goals for v1 (do not build)
- Per-budget periods (yearly/one-off): monthly only, so yearly or one-off costs land in a single month
- Offline expense entry: online only. Maps and geocoding need internet access to OSM
- CSV import/export: the README documents backups instead
- Bank accounts, transfers, multi-currency, English UI
