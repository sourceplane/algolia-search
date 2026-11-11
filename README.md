# algolia-search

Vercel's [Algolia Integration Example](https://github.com/algolia/algolia-supabase-vercel-starter)
(Algolia's Algolia × Supabase × Vercel starter) — instant, typo-tolerant
search over a Postgres `products` table, with InstantSearch's facets and a
product page that shows what only the database holds — running on
**Cloudflare Workers + Static Assets** through
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), with the
database a **Supabase Postgres** project reached through **Cloudflare
Hyperdrive**, both provisioned by Terraform through
[Orun](https://github.com/sourceplane/orun) and the schema and the template's
demo products applied by Orun's `db-migrate` (the way the
[Lumen baseline](https://github.com/sourceplane/lumen) does it), deployed by
[Orun](https://github.com/sourceplane/orun) to stage and prod on every merge.
Packaging it as an Orun baseline is the next milestone (AL2).

The template's code is the code. What the port changes is what the Workers
runtime, a fresh unattended deployment and Orun's rule that no SaaS key is
ever in a build force: upstream's lazy module-level `pg.Pool` becomes one `pg`
client per request over the Hyperdrive binding (`lib/db.ts`, its `query()`
unchanged at every call site); the Algolia application id and search-only key
are the Worker's secrets, read when the page renders and handed to
InstantSearch as props, instead of `NEXT_PUBLIC_` variables inlined at build;
and `demo/seed.sql`, which upstream had you paste into Supabase's SQL Editor,
is two migrations (the table, then its twenty demo products) applied before
the app serves. Until the owner connects Algolia, the home page keeps the
template's "search activates once…" notice and lists the catalogue straight
from Postgres under it. Every table in `public` has row-level security, so
Supabase's Data API serves none of it — the internal-only cost prices,
suppliers and notes above all. See [`specs/epics/algolia-search`](specs/epics/algolia-search/README.md)
for the design, the milestones and the as-built status, including every
departure.

## What is here (the product)

| Surface | Where |
|---|---|
| The product's name (the page's title) | `apps/web/lib/site.ts` |
| The home page: the hero, InstantSearch, the catalogue while search is not connected | `apps/web/app/page.tsx`, `apps/web/components/search/`, `apps/web/components/catalogue.tsx` |
| The product page, with the database-only fields | `apps/web/app/products/[id]/page.tsx`, `apps/web/lib/products.ts` |
| The per-request pg client (Hyperdrive first, `POSTGRES_URL` fallback) | `apps/web/lib/db.ts` |
| The Algolia config the page hands the browser, read from the Worker | `apps/web/lib/algolia.ts` |
| The connector's transformation (pasted into Algolia's dashboard) | `apps/web/demo/transform.js` |
| The database check the deploy smoke-tests | `apps/web/app/api/health/route.ts` |
| Workers build, bindings and deploy contract | `apps/web/next.config.ts`, `open-next.config.ts`, `wrangler.template.jsonc` → `wrangler.jsonc` (committed), `component.yaml`; the Algolia secrets pushed after the build by `tooling/wire/worker-secrets.mjs` |
| The schema and the demo products as migrations, and Lumen's runner | `packages/db` (`@saas/db` — the name the db-migrate composition builds); `apps/web/scripts/migrate.mjs` applies the same files to a local database |
| The Supabase project, the Hyperdrive config, the migration step | `infra/terraform/supabase`, `infra/terraform/cloudflare-hyperdrive`, `infra/db-migrate` |
| Tests | `tests/web` (vitest; InstantSearch rendered in jsdom against an in-process Algolia stand-in), `tests/db` (vitest; the migrations in PGlite) |

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # re-render apps/web/wrangler.jsonc from its template (committed; this changes nothing)
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # next build + opennextjs-cloudflare build → apps/web/.open-next
```

The build needs no database and no Algolia account. Running it locally — a
Postgres on `localhost:54322` (`supabase start`), `pnpm --filter @app/web
db:migrate`, then `next dev` or `wrangler dev`, with Algolia's keys in
`apps/web/.dev.vars` if you have them — is in the product's README
(`.baseline/product/README.md`), which is what a product built from here
carries.

## How it maps to Vercel

| Vercel | Here |
|---|---|
| Next.js hosting | One Cloudflare Worker (`.open-next/worker.js`) + Static Assets |
| The Supabase integration's `POSTGRES_URL`, a lazy module-level `pg.Pool` (with an `ssl` override for Supabase's pooler) | The Supabase project's Postgres through Hyperdrive: `query()` is still upstream's, run on one `pg` client per request from `env.HYPERDRIVE.connectionString` (no `ssl` override: the Worker talks to Hyperdrive); `POSTGRES_URL` is for local work without wrangler, through upstream's own pool |
| The Algolia integration's `NEXT_PUBLIC_ALGOLIA_APP_ID` / `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`, inlined into the browser bundle at build (`next.config` `env`) | Orun secrets `ALGOLIA_APP_ID` / `ALGOLIA_SEARCH_API_KEY`, pushed to the Worker as secrets after the build (`tooling/wire/worker-secrets.mjs`) and read per request (`lib/algolia.ts`); the page hands them to InstantSearch as props. The write key, never read upstream either, is not used at all |
| Paste `demo/seed.sql` into the Supabase SQL Editor | `infra/db-migrate` applies `packages/db/src/migrations` per environment — the table (010), row-level security (020), the twenty demo products (030, upstream's rows byte for byte) — after the project and the Hyperdrive config exist, before the Worker deploys |
| The Algolia connector, set up in Algolia's dashboard | The same, as the owner's one-time step (the product's README, "Connect Algolia"), with the same `demo/transform.js` |
| Until the integration's env vars are pulled, the page shows a notice | The same notice (naming the Orun secrets), and the catalogue listed from Postgres under it |
| `next/font/google` (Geist) | The `geist` package (next/font/local): Google's font download fails on GitHub's runners |
| The Supabase and Algolia integrations "Deploy with Vercel" installs | `infra/terraform/supabase` (one project per environment) + `infra/terraform/cloudflare-hyperdrive` (one config per environment), ids and credentials as orun secrets; Algolia connected by the owner |
| "Deploy with Vercel" (clone the template) | `orun new --blueprint repo-blueprint.yaml` — a new repository, branded, provisioned, migrated, deployed |

## CI

| Workflow | What it runs | Ships to a product |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a product carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the app built and dry-deployed per environment, both Terraform roots checked and planned, the migrations planned), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone runs and nothing waits for it — the landing was checked in the build box; a merge applies, migrates and deploys stage → prod. The lanes do not typecheck, lint or run the tests: `baseline.yml`'s e2e tier does, on the landing, before each tag. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
