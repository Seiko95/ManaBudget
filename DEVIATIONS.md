# Deviations & rulings

Decisions made while building ManaBudget unattended, where the spec was silent
or could not be followed literally. Each entry: what was decided, why, and what
it costs if it's wrong.

## Step 1 — Scaffold

- **SvelteKit 2 pinned over the scaffolder's default (SvelteKit 3).** `sv create` now
  generates Kit 3; the spec says Kit 2, so `@sveltejs/kit@^2.70` + `adapter-node@5` are pinned
  and the config uses the classic `svelte.config.js`. _If wrong:_ upgrading to Kit 3 later is a
  migration (env handling, config file).
- **`node:crypto` instead of `@oslojs/crypto` / `@oslojs/encoding`.** npm marks every
  `@oslojs/*` package "no longer supported – contact Support", the notice npm uses for
  packages it has taken down. Sessions follow the same Lucia scheme (random token,
  `id = sha256(token)` hex), using Node's built-in `crypto`. _If wrong:_ none functionally; swap
  back in two functions.
- **Full schema in the first migration.** The data model is fully specified, so every table
  is created in `0000_init` instead of growing table by table. A `users.disabled` column was
  added because `/admin` must be able to disable accounts. `user_id` is on every user-owned
  table, child tables included (splits, limits, tags, photos), so scoping never needs a join.
- **Dark mode via `prefers-color-scheme`** (CSS only) rather than mode-watcher's class toggle,
  because the spec says "follows the system setting" and there is no manual toggle.
- **Lint rule `svelte/no-navigation-without-resolve` turned off**: the app is always served at
  the root path, so wrapping every `href` in `resolve()` adds noise without benefit.

## Step 2 — Auth

- **Login rate limit numbers** (not in spec): 10 failed attempts per IP and 5 per username
  per 15 minutes, kept in memory (single process). Unknown usernames still run an argon2
  verify so response time doesn't reveal which accounts exist.
- **Sessions renew when less than 15 days remain** (Lucia's default), which gives "renews while
  in use for 30 days".
- **Budgets without sub-categories** in the starter set (Santé, Cadeaux, Shopping, Divers) get
  one category with the same name, because every expense split needs a category.
- **Budget colours** come from a colour-blind-validated 8-hue palette (+ grey); the 8 starter
  budgets each get one. The DB stores the light value, and charts switch to the matching
  dark-mode step.
- **Forms open in a bits-ui Dialog styled as a full-screen sheet on phones and a right-hand
  side panel on desktop**, rather than vaul's draggable Drawer: drag-to-dismiss fights with
  scrolling forms and nested pickers on phones.
- **Admins can't disable or delete their own account**, so there is always one admin.
- **Deleting a user** removes all their rows (FK cascade) and their `/data/uploads/<id>` folder.

## Step 3 — Budgets & periods

- **Period label rule, made deterministic:** start days 2–15 take the start month's name and
  16–28 take the following month's. This is the "month with most days" rule from the spec,
  except for one edge case: start day 16 in a 31-day month (16 vs 15 days). Following the
  majority literally would give two consecutive periods the same name in some years (e.g. start
  day 16 around February), so a fixed threshold keeps every label unique. Unit tests check that
  periods tile the calendar with no gaps or duplicates.
- **Editing a limit applies from the period shown on the Budgets page** (which defaults to the
  current one), via an upsert of `budget_limits(budget_id, effective_from)`. Going back to an
  earlier period and editing it changes only that period, up to the next recorded change.
- **Changing the password signs out your other devices.**
- **Selects** use a styled native `<select>` (the phone's native picker) for simple choices like
  the start day or a category's budget; comboboxes are kept for search-heavy pickers (places,
  categories in the expense form).

## Step 4 — Places

- **Location is only read silently when permission is already granted** (Permissions API).
  Otherwise the browser is asked only when you tap "Utiliser ma position", so a page load never
  triggers a permission prompt. Browsers without the Permissions API (older Safari) never sort
  by distance until you tap that button once.
- **Geocoder cache:** in memory, 500 entries, 7-day TTL; reverse lookups are rounded to ~10 m
  so nearby positions share an entry. Searching only happens on the search button or Enter,
  never per keystroke.
- **Tapping the mini-map moves the pin** too (as well as dragging it), which is easier on phones.
- **Dark mode dims the OSM tiles** with a CSS filter so the map isn't a bright block.
- `GEOCODING_ENABLED` and `GEOCODER_USER_AGENT` env vars were added alongside `NOMINATIM_URL`
  (the spec asks for geocoding to be switchable and for a User-Agent).

## Step 5 — Expenses

- **The expense form is one global sheet** opened by the "+" button (or "Nouvelle dépense" on
  desktop) from any page, and by "Modifier" on the detail page. It saves through JSON/multipart
  API routes (`/api/expenses`) rather than page form actions, so it works the same from every
  route.
- **Default list period:** `/depenses` shows the current period unless the URL says otherwise
  (`periode=YYYY-MM`, `periode=tout`, or `du`/`au`). The French query parameter names are
  `periode, du, au, budget, categorie, lieu, etiquette, min, max, q`.
- **Text search** covers description, place name, tag names and category names.
- **The "nearest place" chip** appears when the closest place is within 500 m.
- **Tags get a colour automatically** (cycling through the palette); there's no tag management
  screen, since the spec doesn't list one.
- **Photos:** up to 10 per upload, 20 MB each before browser-side shrinking. They're processed
  before the expense is written, so an unreadable image rejects the save instead of leaving a
  half-saved expense. Rotation from EXIF orientation is applied, then all metadata is dropped.
- **Pickers open on tap, not on focus**, so the list doesn't pop back open when focus returns to
  the field after the "Nouveau lieu" sheet closes.
- Budget alerts after saving are wired through but return nothing until step 8.

## Step 6 — Income

- **Source autocomplete** uses a native `<datalist>` filled with your past sources (most used
  first), which gives the phone's native suggestion UI.
- `/revenus` shows one period at a time (same period switcher as elsewhere) with its total.
  Tapping a row edits it.

## Step 7 — Recurring

- **Schedules:** monthly rules fire on `day_of_month` (29–31 clamped to the month's last day);
  weekly rules repeat every 7 days from the start date; yearly rules use the start date's month
  plus `day_of_month` (29 Feb → 28 Feb in non-leap years).
- **"Rendre récurrente"** links the original expense as the rule's occurrence for its own date
  (it sets `recurring_rule_id` / `occurrence_date` on it). The first automatic entry is therefore
  the next one, and nothing is duplicated. The rule takes the expense's first category when the
  expense was split.
- **Editing a rule** continues the schedule after the last entry it already created; past
  entries are never rewritten. **Deleting a rule** keeps its past entries (the link is cleared).
- **Saving a rule** materializes anything already due right away (e.g. a rule that started last
  month), on top of startup, the hourly timer and dashboard loads.
- Expense rules have no tags or splits (a single category), since the rule schema has a single
  `category_id`.
