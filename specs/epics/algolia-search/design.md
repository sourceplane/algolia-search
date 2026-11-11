# algolia-search — design

## 1. What the template is

[algolia/algolia-supabase-vercel-starter](https://github.com/algolia/algolia-supabase-vercel-starter)
at `da3f27b` (2026-09-04) — the Vercel template "Algolia Integration Example":
Next.js 16.3.0 (App Router), `pg` 8.22, `algoliasearch` 5 (the lite client)
and `react-instantsearch` 7, Tailwind 4, Geist. Three moving parts:

- **The home page** renders the template's hero and `SearchExperience`, a
  client component: InstantSearch with a search box, category, price and
  rating facets, a "hide out of stock" toggle, stats and highlighted hit
  cards. It reads `NEXT_PUBLIC_ALGOLIA_APP_ID` and
  `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`, which `next.config`'s `env` inlines
  into the browser bundle at build (mapping the bare `ALGOLIA_*` names the
  Vercel integration may inject); without them it shows a notice.
- **The product page** (`/products/[id]`) reads one row from Postgres with
  `select * from products where id = $1` through a lazy module-level
  `pg.Pool` (`lib/db.ts`, with an `ssl` override for Supabase's pooler) and
  shows the fields only the database holds: cost price, supplier, stock
  location, internal notes.
- **The data**: `demo/seed.sql` (a 12-column table and twenty upserted
  products) pasted into the Supabase SQL Editor, and Algolia's Supabase
  connector — configured in Algolia's dashboard with `demo/transform.js` —
  which maps `id` to `objectID`, keeps the searchable fields, derives
  `in_stock` and drops the internal ones.

## 2. The data plane

| Upstream | Here |
|---|---|
| Vercel's Supabase integration provisions a project and injects `POSTGRES_URL` | `infra/terraform/supabase` creates one project per environment; `infra/terraform/cloudflare-hyperdrive` one Hyperdrive config over it; their applies publish the credentials and the config id as orun secrets |
| A lazy module-level `pg.Pool` over `POSTGRES_URL`, `sslmode` stripped and `rejectUnauthorized: false` | `lib/db.ts`: `query(text, params)` unchanged, run on one `pg.Client` per request over `env.HYPERDRIVE.connectionString`, kept in a WeakMap keyed by the request's ExecutionContext and connected once (the Workers runtime refuses to reuse a socket across requests). No `ssl` override: the Worker talks to Hyperdrive, Hyperdrive talks TLS to Supabase. Without a Cloudflare context, upstream's own pool over `POSTGRES_URL` |
| `demo/seed.sql` pasted by hand | `packages/db/src/migrations/010_products` (its CREATE TABLE), `020_row_level_security` (RLS with no policy, behind a guard), `030_demo_products` (its twenty upserts, byte for byte), applied by `infra/db-migrate` per environment before the Worker deploys; `pnpm db:migrate` applies the same files to a local database (`apps/web/scripts/migrate.mjs`, ledger in schema `local_migrations`) |
| `pg` on Node | `pg` on workerd under `nodejs_compat`, its socket `pg-cloudflare`'s `workerd` export. `pg` is a Next server-external package, so the build traces it for Node and copies only pg-cloudflare's empty default export; `next.config.ts` ships the package whole (`outputFileTracingIncludes`) |

## 3. The keys

Orun never puts a SaaS key in a build. The application id and the
search-only key are browser-safe by Algolia's design — the template hands them
to every visitor — but inlining them at build would mean a bundle per key, a
rebuild per rotation, and a build that has to hold the product's secrets. So:

- They are the product's optional Orun secrets `ALGOLIA_APP_ID` and
  `ALGOLIA_SEARCH_API_KEY` (Algolia's own bare names, which upstream's
  next.config already read), resolved by the `web` component's
  `optionalSecretEnv`.
- The build runs with them unset (`env -u`); after it,
  `tooling/wire/worker-secrets.mjs` pushes the ones that are set to the
  Worker with `wrangler secret bulk` (a verify lane, with no Cloudflare
  credential, pushes nothing).
- The page (`force-dynamic`) reads them from `getCloudflareContext().env`
  per request (`lib/algolia.ts`) and hands them to `SearchExperience` as
  props; the component builds its lite client from them. An optional
  `ALGOLIA_HOST` replaces Algolia's own hosts (the e2e's stand-in).
- Unset, the page renders the template's notice — naming the secrets — and
  `components/catalogue.tsx` under it: the products read from Postgres in the
  hits' own cards, only the fields the connector would index. The page wraps
  both states in `data-search="connected" | "not-connected"`, which the
  deploy's smoke reads.
- The write/admin key is never read: the connector indexes from Algolia's
  dashboard, as upstream.

## 4. The deploy contract

postgres-kysely's, unchanged in shape: `web` (cloudflare-workers-assets-turbo)
depends on `cloudflare-hyperdrive` and `db-migrate`, which depend on
`supabase`; every edge `mode: enforced` on a push to main and advisory on a
pull request; `wrangler.jsonc` committed as the fixture render of
`wrangler.template.jsonc`, re-rendered by the stage and prod lanes from their
wiring document. The smoke reads the home page's `data-search=` and
`/api/health`'s `"ok":true`.

## 5. Out of scope

- Algolia's connector and index settings: the owner's, in Algolia's
  dashboard (the product's README, "Connect Algolia"). There is no Orun
  composition for Algolia, and the connector needs the Supabase project's
  credentials, which it asks Supabase for itself.
- Server-side InstantSearch (`react-instantsearch-nextjs`): the template is
  client-only, and so is this.
- Write paths: the template is read-only.
