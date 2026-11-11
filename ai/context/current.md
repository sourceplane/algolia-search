# algolia-search — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a product built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

Vercel's Algolia Integration Example (Algolia's Algolia × Supabase × Vercel
starter) — InstantSearch over a Postgres `products` table, and a product page
that reads the database-only fields — on Cloudflare Workers + Static Assets,
with the database a Supabase Postgres project reached through Hyperdrive and
the Algolia keys the Worker's own secrets, packaged as an Orun baseline:
`orun new --blueprint repo-blueprint.yaml` builds a new product in its own
repository and takes it to live on stage and prod in one landing
(`01-product`: supabase → cloudflare-hyperdrive → db-migrate → web per
environment), then records what went live (`02-docs`). Algolia is connected
by the product's owner afterwards (its README, "Connect Algolia").

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (AL2 — a baseline: the console asks for no domain and no Algolia key; a product is born with the placeholder `<reponame>.example.com` in `BASE_DOMAIN` and search not connected) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI — a migrated local Postgres served through the built Worker, with and without the Algolia secrets, and its search run in a headless Chrome against an Algolia stand-in; a live bootstrap from a tag and a real Algolia application are still to come (risk AL-J) |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/algolia-search/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/algolia-search/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/algolia-search/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `<component>/docs/` beside each `component.yaml` — `apps/web`, `packages/db`, `infra/db-migrate`, `infra/terraform/{supabase,cloudflare-hyperdrive}`, `tests/{web,db}` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one product from `baseline-v1` against a workspace with
   Cloudflare and Supabase connections and room for two Supabase projects
   (AL-D), connect an Algolia application to it, and record its timings
   (closes AL-J).
