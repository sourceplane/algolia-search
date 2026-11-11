# Epic: algolia-search (AL)

**Algolia's starter is search as a client concern: InstantSearch in the browser asks Algolia's index, which Algolia's own Supabase connector fills from a Postgres `products` table, and the one server read is the product page, which shows the fields the index never gets. On Cloudflare the socket goes through Hyperdrive to a Supabase Postgres project — postgres-drizzle-starter's data plane — and the code that changes is where the database client and the Algolia keys come from: upstream's lazy module-level `pg.Pool` becomes one `pg` client per request from the `HYPERDRIVE` binding, and the keys the template inlined into the browser bundle at build become the Worker's secrets, read when the page renders.**

The port keeps the page, the InstantSearch UI and its facets, the hit cards, the product page and its query, and the connector's transformation. Upstream's `demo/seed.sql`, pasted into Supabase's SQL Editor by hand, becomes two `packages/db` migrations — the table, and its twenty demo products byte for byte — applied by `db-migrate` with row-level security before the Worker serves; a local database gets the very same files through `pnpm db:migrate`. Until the owner connects Algolia the page keeps the template's notice and lists the catalogue from Postgres under it. It adds the Workers build, tests (InstantSearch rendered against an Algolia stand-in, in jsdom and in a headless Chrome), the Supabase and Hyperdrive Terraform roots and the deploy contract, and makes the repository an Orun baseline.

## Status

| Field | Value |
|-------|-------|
| Status | ✅ AL0–AL2 shipped (`baseline-v1`). Terraform applies, a live db-migrate apply, a live deploy and a real Algolia application are proven only by a live bootstrap (risk AL-J) |
| Cluster | **AL** (AL0–AL2) |
| Owner(s) | `apps/web` (the pages, the search UI, `lib/db.ts`, `lib/algolia.ts`, `components/catalogue.tsx`, `scripts/migrate.mjs`) · `packages/db` (the migrations and their runner) · `tests/web`, `tests/db` · `infra/terraform/{supabase,cloudflare-hyperdrive}`, `infra/db-migrate` |
| Builds on | `postgres-kysely` (its scaffolding, Supabase and Hyperdrive roots, migrations, health check and baseline machinery), `prisma-nextjs-blog` (the Worker-secrets push), and through them `postgres-drizzle-starter` and `lumen` |
| Upstream | [algolia/algolia-supabase-vercel-starter](https://github.com/algolia/algolia-supabase-vercel-starter) at `da3f27b` (2026-09-04), the Vercel template "Algolia Integration Example" |
| Changes | The client resolution (module-level pool → a pg client per request over Hyperdrive, behind upstream's `query()`), the Algolia keys read per request from Worker secrets, the seed as migrations, the catalogue while not connected, the Workers build, tests, two Terraform roots, the deploy contract; page copy says Cloudflare |
| Decisions locked | (1) `query()` stays upstream's name and API; a WeakMap by the request's ExecutionContext keeps one connected client per request. (2) The Algolia keys are optional Worker secrets, never `NEXT_PUBLIC_`, never in a build. (3) The table, RLS and the demo rows are `db-migrate`'s. (4) The connector is the owner's step in Algolia's dashboard. (5) Infra before app on main: supabase → cloudflare-hyperdrive → db-migrate → web, enforced; advisory on pull requests. |
| Shipped as | `baseline-v1`; proven offline (Baseline CI: migrated into a real Postgres and served through the built Worker under `wrangler dev`, searched in a headless Chrome), deploy gated until a workspace is linked |

## Read order

1. `design.md` — what maps to what, the connection and key flow, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| AL0 — the spec | this doc set and the task contracts | merged on `main` |
| AL1 — the search on Workers and Supabase | `apps/web`, `packages/db`, the two Terraform roots, `infra/db-migrate`, `tests/web`, `tests/db` | green; `wrangler dev` lists the catalogue over a migrated database, and the search runs against a stand-in |
| AL2 — a baseline | card, build document, rename, bootstrap tooling, the product's README and context pack, the baseline's tests | a new product goes from nothing to live on stage and prod in one landing; Baseline CI green |
