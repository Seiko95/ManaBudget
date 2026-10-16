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
