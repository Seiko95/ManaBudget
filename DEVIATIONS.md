# Deviations & rulings

Decisions made while building ManaBudget unattended, where the spec was silent
or could not be followed literally. Each entry: what was decided, why, and what
it costs if it's wrong.

## Step 1 — Scaffold

- **SvelteKit 2 pinned over the scaffolder's default (SvelteKit 3).** `sv create` now
  generates Kit 3; the spec says Kit 2, so `@sveltejs/kit@^2.70` + `adapter-node@5` are pinned
  and the config uses the classic `svelte.config.js`. *If wrong:* upgrading to Kit 3 later is a
  migration (env handling, config file).
- **`node:crypto` instead of `@oslojs/crypto` / `@oslojs/encoding`.** npm marks every
  `@oslojs/*` package "no longer supported – contact Support", the notice npm uses for
  packages it has taken down. Sessions follow the same Lucia scheme (random token,
  `id = sha256(token)` hex), using Node's built-in `crypto`. *If wrong:* none functionally; swap
  back in two functions.
- **Full schema in the first migration.** The data model is fully specified, so every table
  is created in `0000_init` instead of growing table by table. A `users.disabled` column was
  added because `/admin` must be able to disable accounts. `user_id` is on every user-owned
  table, child tables included (splits, limits, tags, photos), so scoping never needs a join.
- **Dark mode via `prefers-color-scheme`** (CSS only) rather than mode-watcher's class toggle,
  because the spec says "follows the system setting" and there is no manual toggle.
- **Lint rule `svelte/no-navigation-without-resolve` turned off**: the app is always served at
  the root path, so wrapping every `href` in `resolve()` adds noise without benefit.
