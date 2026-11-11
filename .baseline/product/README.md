# algolia-search

Vercel's [Algolia Integration Example](https://github.com/algolia/algolia-supabase-vercel-starter)
— instant, typo-tolerant search over a Postgres `products` table with
Algolia's InstantSearch, its facets (category, price, rating, in stock) and a
product page that shows what only the database holds — on **Cloudflare
Workers + Static Assets** through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
with its Postgres a **Supabase** project's database reached through
**Cloudflare Hyperdrive**. Terraform provisions both per environment and
Orun's `db-migrate` applies the schema and the twenty demo products, all on
every merge to `main`. Algolia indexes the table through its own Supabase
connector; until you connect it, the home page says so and lists the
catalogue straight from Postgres.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace, what the database check reports and the secrets the product
uses into
[ai/context/deployment.md](ai/context/deployment.md); how the product deploys
and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## What is here

| Surface | Where |
|---|---|
| The product's name (the page's title) | `apps/web/lib/site.ts` |
| The home page: the hero, InstantSearch, the catalogue while search is not connected | `apps/web/app/page.tsx`, `apps/web/components/search/`, `apps/web/components/catalogue.tsx` |
| The product page, with the database-only fields | `apps/web/app/products/[id]/page.tsx`, `apps/web/lib/products.ts` |
| The per-request pg client (Hyperdrive first, `POSTGRES_URL` fallback) | `apps/web/lib/db.ts` |
| The Algolia config the page hands the browser, read from the Worker | `apps/web/lib/algolia.ts` |
| The connector's transformation, for Algolia's dashboard | `apps/web/demo/transform.js` |
| The database check the deploy smoke-tests | `apps/web/app/api/health/route.ts` |
| Workers build and deploy contract | `apps/web/next.config.ts`, `open-next.config.ts`, `wrangler.template.jsonc` → `wrangler.jsonc`, `component.yaml`, `tooling/wire/worker-secrets.mjs` |
| The schema and the demo products as migrations, and their runner | `packages/db` (`@saas/db`); `apps/web/scripts/migrate.mjs` applies the same files locally |
| The Supabase project, the Hyperdrive config, the migration step | `infra/terraform/supabase`, `infra/terraform/cloudflare-hyperdrive`, `infra/db-migrate` |
| Tests | `tests/web`, `tests/db` (vitest) |

## Getting started

```bash
git clone https://github.com/sourceplane/algolia-search && cd algolia-search
pnpm install
pnpm run wire:fixture   # re-render apps/web/wrangler.jsonc from its template (it is committed)
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # next build + opennextjs-cloudflare build → apps/web/.open-next
```

The build needs no database and no Algolia account: the pages render per
request.

## Running it locally

You need a Postgres on `localhost:54322` — the Supabase CLI's default
(`supabase start`) — or any Postgres whose URL you put in `POSTGRES_URL`.

1. **Schema and demo data.** Apply the migrations to `POSTGRES_URL` (default
   `postgres://postgres:postgres@localhost:54322/postgres`):

   ```bash
   pnpm --filter @app/web db:migrate
   ```

   It applies `packages/db/src/migrations` — the very files CI applies to the
   real databases: the `products` table, row-level security, the twenty demo
   products — and records them in its own `local_migrations` schema. Run it
   again and it says `up to date`.

2. **Algolia (optional).** Put your application id and search-only key in
   `apps/web/.dev.vars` (never committed):

   ```
   ALGOLIA_APP_ID=…
   ALGOLIA_SEARCH_API_KEY=…
   ```

   Without them the home page says search is not connected and lists the
   catalogue from Postgres.

3. **Run.** Either Next's dev server, which gets the Worker's bindings and
   `.dev.vars` through `getCloudflareContext()` (the `HYPERDRIVE` binding
   points at `localhost:54322` through `wrangler.jsonc`'s
   `localConnectionString`):

   ```bash
   pnpm --filter @app/web dev          # http://localhost:3000
   ```

   or the built Worker under `wrangler dev`:

   ```bash
   pnpm build
   pnpm --filter @app/web preview      # http://localhost:8787
   ```

   `/api/health` says whether the database is reachable and migrated, and
   whether search is connected.

## Connect Algolia

The product goes live with its catalogue and product pages; search needs an
Algolia application (the free plan is enough) and three one-time steps.

1. **The connector.** In the Algolia dashboard → **Data sources** →
   **Connectors** → **Supabase**: connect your Supabase account and pick this
   environment's project (stage and prod are two projects; connect each
   you want searchable), paste `apps/web/demo/transform.js` into the
   wizard's transformation editor — it maps `id` to `objectID`, keeps only the
   searchable fields and derives `in_stock` from `quantity`; the preview must
   show no `cost_price`, `supplier_id`, `internal_notes` or
   `stock_location` — set the destination index to `products`, and run a full
   reindex (add a schedule for recurring syncs).
2. **The facets.** Index `products` → **Configuration** → **Facets**: add
   `category`, `price` and `rating` as searchable facets and `in_stock` as
   filter-only (it powers "Hide out of stock").
3. **The keys.** Store the application id and the **search-only** API key
   as the product's secrets, for each environment you connected:

   ```bash
   orun secrets set ALGOLIA_APP_ID          --env stage   # prompts for the value
   orun secrets set ALGOLIA_SEARCH_API_KEY  --env stage
   ```

   then redeploy `web` there (the **Deploy** button, below).
   The deploy pushes them to the Worker as secrets; the page reads them when
   it renders and hands them to InstantSearch in the browser — the search key
   is browser-safe by Algolia's design. Never store the write/admin key: the
   connector indexes from Algolia's dashboard, and the app never needs it.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. Per environment the order is
enforced — **the Supabase project, then the Hyperdrive config over its
database, then the migrations, then the Worker** — because each reads what
the one before it published: the project's ref and password, the Hyperdrive
id the Worker binds, the table the pages query. `stage` deploys first and
`prod` once stage has converged on the same commit; `dev` only verifies.
Every deploy is smoke-tested over HTTP: the home page's search section, and
`/api/health`, which answers only when the Worker reaches a migrated
database.

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare tokens and account id and the Supabase access token and org id
are brokered per run from the workspace's connections; the Supabase
project's credentials and the Hyperdrive id are published by the Terraform
applies as orun secrets, and the Algolia keys are the product's own optional
secrets, pushed to the Worker after each build and never into it. Nothing
provider-shaped is stored in the repository or in GitHub.

Every table in `public` has row-level security and no policy, so Supabase's
Data API (which serves `public` to the project's anon key) returns none of
it — the internal-only cost prices, suppliers and notes included; the app
connects as the table's owner and is not affected.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after storing or
rotating the Algolia keys, say. A component with nothing to run in that
environment (a test suite in `prod`) is left out with a notice.

## Your own data

The twenty demo products are migration `030_demo_products`. To replace them,
add a migration of your own (`040_…`: delete the demo rows, insert yours, or
reshape the table) rather than editing `030` — an applied migration's
checksum is recorded in every database it ran in. Keep the connector's
transformation in step with the columns you index.

## Custom domain

The app answers on workers.dev from its first deploy. To serve it on your
own domain, attach the domain to the Worker in Cloudflare (Workers & Pages →
`algolia-search-web-prod` → Settings → Domains & Routes), then set
`SITE_URL` under that environment's `env:` in `intent.yaml` — the page's
metadata reads it — and merge.

The repository also names the domain in one place, `BASE_DOMAIN` under each
environment's `env:` in `intent.yaml`, which the product was born with as the
reserved placeholder `algolia-search.example.com`. Nothing builds a
URL from it — the origin is `SITE_URL` — so replacing it moves nothing by
itself; it records the domain. Replace it with yours in the same pull request
as `SITE_URL`.

## CI

| Workflow | What it runs |
|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes — the app built and dry-deployed for each environment, both Terraform roots checked and planned, the migrations planned and their checksums verified — with nothing applied or deployed. They do not typecheck, lint or run the tests: run `pnpm typecheck`, `pnpm lint` and `pnpm test` before you push (Getting started, above). A merge applies, migrates and deploys stage → prod |
