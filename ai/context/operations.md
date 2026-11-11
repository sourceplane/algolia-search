# algolia-search — operating contract (for humans and agents)

This is the standing guide to how this product is deployed and operated.
Instance facts (live URLs, workspace, what the database check reports, the
secrets it uses) live in [deployment.md](deployment.md), rendered from
probed reality by the bootstrap's `02-docs` phase; this file is the contract
that stays true between deployments. It is written to give an agent with
repository read access enough context to reason about and operate the product
without any other source.

## What this system is

Vercel's Algolia Integration Example — instant search over a Postgres
`products` table with Algolia's InstantSearch, and a product page that reads
the fields only the database holds — on Cloudflare Workers, with its Postgres
a Supabase project reached through Cloudflare Hyperdrive and its search index
an Algolia application the owner connects, expressed as an Orun
component-native desired-state repo. Seven components:

- **`infra/terraform/supabase`** (`supabase`) — one Supabase project per
  environment. Its apply publishes `SUPABASE_PROJECT_REF`,
  `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_URL` onto the environment's secret
  rung.
- **`infra/terraform/cloudflare-hyperdrive`** (`cloudflare-hyperdrive`) — one
  Hyperdrive config per environment over that database. Its apply publishes
  `WIRING_CLOUDFLARE_HYPERDRIVE` (the config's id and name).
- **`infra/db-migrate`** (`db-migrate`) — applies `packages/db`'s migrations
  to the environment's database through Supabase's Management API: the
  `products` table, row-level security, the twenty demo products. Each
  migration is recorded with its checksum in `_migrations.applied`; only the
  missing ones apply.
- **`packages/db`** (`db`, the package `@saas/db` — the name the db-migrate
  composition builds) — the migrations and their runner.
- **`apps/web`** (`web`) — the app: Next.js built by `@opennextjs/cloudflare`
  into one Worker plus Static Assets. It reaches Postgres through its
  `HYPERDRIVE` binding, one `pg` client per request behind upstream's
  `query()` (`lib/db.ts`), and hands the browser's InstantSearch the Algolia
  application id and search-only key it holds as secrets (`lib/algolia.ts`).
- **`tests/web`**, **`tests/db`** — vitest suites, verified on the `dev` rung.

Algolia is not a component: its application, its index and the Supabase
connector that fills it are the owner's, configured in Algolia's dashboard
(README, "Connect Algolia"). The product reads from Algolia only in the
visitor's browser.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and test, nothing deploys.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. Per environment, in this order — each edge `mode: enforced` on a push to
   main, advisory on a pull request (which deploys nothing):
   **`supabase` → `cloudflare-hyperdrive` → `db-migrate` → `web`.** A job
   resolves its secrets when it starts, so each one reads what the apply
   before it published. The app's deploy re-renders `apps/web/wrangler.jsonc`
   from `WIRING_CLOUDFLARE_HYPERDRIVE` before it builds, builds with the
   Algolia secrets UNSET (no bundle can carry them), pushes the ones that are
   stored to the Worker as secrets (`tooling/wire/worker-secrets.mjs`),
   deploys `algolia-search-web-<env>`, and smoke-tests it: the home page (its
   search section, `data-search=`) and `/api/health`, which answers 200 only
   when the database is reachable through Hyperdrive and migrated.
4. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
5. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "product
  converged"; probe the URLs instead.
- `apps/web/wrangler.jsonc` is committed as the render of
  `wrangler.template.jsonc` from `wiring.fixture.json` (a placeholder
  Hyperdrive id): edit the template and run `pnpm run wire:fixture`. The
  deploy lanes render the real one in their own job tree; never commit a
  real id, and never put an Algolia value in it.
- **Search is connected by secrets, not by a build.** Until
  `ALGOLIA_APP_ID` and `ALGOLIA_SEARCH_API_KEY` are stored for an
  environment, its home page shows the template's notice and lists the
  catalogue from Postgres, and `/api/health` reports `search: not connected`.
  Storing (or rotating) them takes effect on the next `web` deploy of that
  environment — redeploy by hand (below) rather than waiting for a change.
- **The index is Algolia's connector's.** It reads the Supabase project
  directly and reindexes on its own schedule (or when run in Algolia's
  dashboard); a product written to the database reaches search when the
  connector next syncs, and reaches the product page and the catalogue at
  once. The connector's transformation is `apps/web/demo/transform.js`:
  keep it in step with the columns, and keep the database-only fields
  (`cost_price`, `supplier_id`, `internal_notes`, `stock_location`) out of
  it.
- **Hyperdrive caches reads** for up to a minute (60 s, plus 15 s stale while
  it revalidates) and does not invalidate them on a write, so the catalogue
  and a product page can show a row up to that old. `/api/health` is never
  cached (`to_regclass` is STABLE).
- Every table in `public` has row-level security and no policy. Supabase's
  Data API serves `public` to the anon key, so this is what keeps the table —
  its internal-only fields above all — out of it; the app is unaffected
  because it connects as `postgres`, the table's owner. Give a new table
  `ALTER TABLE … ENABLE ROW LEVEL SECURITY` in its migration; never `FORCE`
  it, and never add a policy for `anon` without meaning to publish that
  table.
- A migration is immutable once applied: its checksum is in
  `packages/db/src/manifest.ts` and in the database's ledger. Change the
  schema or the demo data with a NEW migration in
  `packages/db/src/migrations`; `pnpm --filter @app/web db:migrate` applies
  the same files to a local database.

## Secrets model

- **Brokered provider secrets**, minted per run from the workspace's
  connections — no long-lived values at rest, nothing to rotate by hand:
  `CLOUDFLARE_API_TOKEN` (Workers deploy), `CLOUDFLARE_HYPERDRIVE_TOKEN`
  (Hyperdrive — the deploy token deliberately cannot touch it),
  `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ACCESS_TOKEN` (project create and
  migrations) and `SUPABASE_ORG_ID`.
- **Published by the applies** onto the stage and prod rungs:
  `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`,
  `WIRING_CLOUDFLARE_HYPERDRIVE`.
- **The owner's, optional**, per environment: `ALGOLIA_APP_ID` and
  `ALGOLIA_SEARCH_API_KEY` (the application's **search-only** key). The
  deploy pushes them to the Worker as secrets; the page hands them to the
  browser, which is what a search-only key is for. Never store the
  write/admin key: nothing here reads it, and the connector indexes from
  Algolia's dashboard.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one.

## Verifying the system

```bash
# the app and its database path on each environment (also recorded, probed, in deployment.md)
curl -s -o /dev/null -w '%{http_code}\n' https://algolia-search-web-stage.your-workers-subdomain.workers.dev/
curl -s https://algolia-search-web-prod.your-workers-subdomain.workers.dev/api/health   # … "search":"connected" once the keys are set

# workspace readiness (integrations + repository link)
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| connect or rotate Algolia | `orun secrets set ALGOLIA_APP_ID --env <env>` and `orun secrets set ALGOLIA_SEARCH_API_KEY --env <env>` (each prompts for the value; the search-only key), then deploy `web` there by hand; `/api/health` then says `search: connected` (README, "Connect Algolia") |
| change the schema or the data | write a new `packages/db/src/migrations/<nnn>_<name>/up.sql` (idempotent; a new table enables row-level security), add it to the manifest with its sha256 (`pnpm --filter @saas/db run manifest:check` verifies them), update `ProductRow` in `apps/web/lib/products.ts` and the connector's transformation if a searchable field changed, run `pnpm --filter @app/web db:migrate` locally, merge — db-migrate applies it before the app deploys. `pnpm test` fails on a table in `public` without row-level security, and when the local migrator's list disagrees with the manifest |
| reindex search | run the connector's task in Algolia's dashboard (or let its schedule run) |
| redeploy without a change | edit the last line of the component's `component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| serve a custom domain | attach it to the Worker in Cloudflare (README, "Custom domain"), then set `SITE_URL` under that environment's `env:` in `intent.yaml` (the page's metadata reads it), replace the placeholder `algolia-search.example.com` in `intent.yaml`'s `BASE_DOMAIN` with it (a record; nothing builds a URL from it), and merge |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

Structural changes (a second Worker, a queue, another data store) follow the
same contract that deployed the product: add a component under `apps/`,
`infra/` or `packages/` with a `component.yaml` — declaring `dependsOn` on
any infrastructure whose published secrets it reads, enforced on main — land
it as a pull request, and the convergence run applies it.
