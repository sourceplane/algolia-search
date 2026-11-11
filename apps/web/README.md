# @app/web — Algolia search over Supabase, on Cloudflare Workers

Vercel's [Algolia Integration Example](https://github.com/algolia/algolia-supabase-vercel-starter)
([demo](https://algolia-supabase-vercel-starter.vercel.app)): a search page
built on Algolia's [InstantSearch](https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/react/)
— a search box, category, price and rating facets, a "hide out of stock"
toggle, highlighted hits — over a `products` table Algolia's Supabase
connector indexes, and a product page served from Postgres that shows the
fields the index never gets. Here it is built by
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) into one
Worker plus Static Assets, and its Postgres is reached through the Worker's
`HYPERDRIVE` binding.

| File | What it does |
|---|---|
| `lib/site.ts` | The product's name: the page's `<title>` |
| `app/page.tsx` | The template's home page, rendered per request: InstantSearch when the Algolia secrets are set, else the template's notice and the catalogue |
| `components/search/search-experience.tsx`, `product-hit.tsx` | The template's InstantSearch UI; its lite client is built from the props the page hands it |
| `components/catalogue.tsx` | Not upstream's: the products from Postgres, in the hits' cards, while search is not connected |
| `app/products/[id]/page.tsx`, `lib/products.ts` | The template's product page and its query, and the catalogue's (searchable fields only) |
| `lib/db.ts` | Upstream's `query()`: one `pg` client per request over the `HYPERDRIVE` binding's connection string on the Worker, upstream's own `pg.Pool` over `POSTGRES_URL` without a Cloudflare context |
| `lib/algolia.ts` | The application id and search-only key (and an optional search host), read from the Worker per request — never at build |
| `demo/transform.js` | The connector's transformation, pasted into Algolia's dashboard as upstream's is |
| `app/api/health/route.ts` | 200 only when the database answers through the binding and the table exists with row-level security; says whether search is connected |
| `scripts/migrate.mjs`, `scripts/app-migrations.mjs` | `pnpm db:migrate`: `packages/db`'s migrations applied to a local database (POSTGRES_URL), its ledger in schema `local_migrations`; the deployed databases are migrated by db-migrate from the same files |
| `wrangler.template.jsonc` → `wrangler.jsonc` | The Worker's config; the render is committed (`pnpm run wire:fixture`) |

The Algolia keys are the Worker's secrets (`.dev.vars` locally), not
`NEXT_PUBLIC_` variables: the template inlined them into the browser bundle
at build time, and here no build ever sees one. The search key is Algolia's
search-only key, which the page hands the browser as upstream's bundle did.

`pg` resolves its Cloudflare socket (`pg-cloudflare`'s `workerd` export) on the
Worker; `next.config.ts` ships that package whole, because the build traces it
for Node.

```bash
pnpm db:migrate     # the schema and the demo products, into POSTGRES_URL (default: the Supabase CLI's localhost:54322)
pnpm dev            # next dev, with the Worker's bindings and .dev.vars through wrangler's platform proxy
pnpm build && pnpm preview   # the built Worker under wrangler dev
```
