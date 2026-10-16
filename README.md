# ManaBudget

A self-hosted personal budget app for phone and desktop: expenses with places, photos, splits
and tags, income, monthly budgets with alerts, recurring entries and charts. French UI, euros,
one Docker container, SQLite.

- **Budgets contain categories.** You pick a category and the budget follows. Every budget is
  monthly, and the month starts on your payday (1–28, per user).
- **Several users, private data.** The first account created is the admin, and the admin
  creates the others (no open sign-up). Admins can't see other users' data.
- **Installable PWA** (online only), dark mode follows the system.

## Install (Docker)

```sh
mkdir manabudget && cd manabudget
curl -O https://raw.githubusercontent.com/Seiko95/manabudget/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Seiko95/manabudget/main/.env.example
# edit .env: at least ORIGIN (the URL you open the app at)
docker compose pull && docker compose up -d
```

Open the URL in `ORIGIN`. The first visit shows **/setup**, where you create the admin account.
After that, add users from **Administration**.

Updating is the same command: `docker compose pull && docker compose up -d`. Database
migrations run automatically at startup.

The image is `ghcr.io/seiko95/manabudget` (amd64 + arm64, so a Raspberry Pi works). To build
it yourself instead: `docker compose up -d --build`.

## HTTPS with Tailscale

Browsers only allow geolocation ("Utiliser ma position", nearest place) and PWA installation
over HTTPS. Tailscale gives you a real certificate without opening any port.

1. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), enable **MagicDNS**
   and **HTTPS Certificates**.
2. Pick one of these:

   **A. Sidecar container (recommended):** see `docker-compose.tailscale.yml`.

   ```sh
   curl -O https://raw.githubusercontent.com/Seiko95/manabudget/main/docker-compose.tailscale.yml
   mkdir -p tailscale && curl -o tailscale/serve.json https://raw.githubusercontent.com/Seiko95/manabudget/main/tailscale/serve.json
   # in .env:
   #   TS_AUTHKEY=tskey-auth-...      (admin console → Settings → Keys)
   #   ORIGIN=https://manabudget.<your-tailnet>.ts.net
   docker compose -f docker-compose.tailscale.yml up -d
   ```

   The app is then reachable only from your tailnet, at `https://manabudget.<your-tailnet>.ts.net`.

   **B. `tailscale serve` on the host:** keep the plain `docker-compose.yml` and run

   ```sh
   sudo tailscale serve --bg --https=443 http://127.0.0.1:3000
   ```

   then set `ORIGIN=https://<host-name>.<your-tailnet>.ts.net` and restart the container.
   In this mode, consider binding the port to localhost only (`127.0.0.1:3000:3000`).

3. On your phone (with Tailscale connected), open the URL. To install it: **Share → Add to
   Home Screen** on iOS Safari, or **Install app** in the menu on Android Chrome.

## Configuration

| Variable              | Default                                          | Description                                                                                                                                 |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ORIGIN`              | — (**required**)                                 | Public URL of the app, e.g. `https://manabudget.tailnet.ts.net`. SvelteKit rejects form posts whose origin doesn't match (CSRF protection). |
| `TZ`                  | `Europe/Paris`                                   | Time zone for "today" (default dates, recurring entries).                                                                                   |
| `BODY_SIZE_LIMIT`     | `25M`                                            | Max request size. adapter-node defaults to 512K, which would break photo uploads.                                                           |
| `TILE_URL`            | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Leaflet tile URL template.                                                                                                                  |
| `NOMINATIM_URL`       | `https://nominatim.openstreetmap.org`            | Geocoder used for address search (server-side proxy: 1 request/s, cached, never per keystroke).                                             |
| `GEOCODING_ENABLED`   | `true`                                           | `false` hides address search entirely.                                                                                                      |
| `GEOCODER_USER_AGENT` | `ManaBudget/1.0 (self-hosted budget app)`        | User-Agent sent to Nominatim; their policy asks for a contact, e.g. `ManaBudget/1.0 (you@example.com)`.                                     |
| `DATA_DIR`            | `/data` in the image                             | Where the database (`manabudget.db`) and photos (`uploads/`) live.                                                                          |
| `PORT`                | `3000`                                           | HTTP port inside the container.                                                                                                             |
| `TS_AUTHKEY`          | —                                                | Tailscale auth key (only for `docker-compose.tailscale.yml`).                                                                               |

Everything is documented in `.env.example`.

## Backup

All data is in the `./data` folder (one SQLite database plus `uploads/` for photos).

- **Simplest:** stop the container, copy `./data`, start it again.
  ```sh
  docker compose stop && tar czf manabudget-$(date +%F).tgz data && docker compose start
  ```
- **While running:** take a consistent SQLite snapshot, then copy the photos.
  ```sh
  sqlite3 data/manabudget.db ".backup 'backup/manabudget.db'"
  rsync -a data/uploads/ backup/uploads/
  ```
  (The database uses WAL mode, so copying the bare `.db` file while the app writes can miss
  recent changes; `.backup` doesn't.)

To restore, put the files back in `./data` and start the container.

## Development

Requires Node 22+.

```sh
npm install
npm run dev            # http://localhost:5173
npm run check          # svelte-check / TypeScript
npm run lint           # prettier + eslint
npm test               # Vitest unit tests
npx playwright install chromium
npm run test:e2e       # builds, then runs Playwright at Pixel 7 and 1440px sizes
```

- Schema: `src/lib/server/db/schema.ts`. After changing it, run `npm run db:generate` to add a
  migration under `drizzle/`.
- UI strings: `src/lib/i18n/fr.ts`.
- `E2E_BASE_URL=http://localhost:3000 npx playwright test` runs the e2e suite against an
  already-running, freshly set-up instance (e.g. the container).
- `DATA_DIR=test-data/demo npx tsx e2e/tools/seed-demo.ts` creates a `demo` account
  (password `motdepasse-demo`) with a year of sample data.

Stack: SvelteKit 2 · Svelte 5 · TypeScript · Tailwind CSS v4 · shadcn-svelte · Drizzle ORM ·
better-sqlite3 · Chart.js · Leaflet · sharp · argon2.
