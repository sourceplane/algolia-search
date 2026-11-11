# algolia-search — risks and open questions

| ID | Risk | State | Notes |
|---|---|---|---|
| AL-A | One `pg` client per request, never ended explicitly | ACCEPTED | The Workers runtime closes a request's sockets when the request's I/O context ends, and Hyperdrive pools on Cloudflare's side; a client whose connect fails is dropped so the request's next query reconnects (tests/web) |
| AL-B | The Algolia keys are Worker secrets, read per request, not `NEXT_PUBLIC_` variables | ACCEPTED (decision) | No key is in a build (the e2e builds with a key in the lane's environment and greps the output for it); a rotation reaches the Worker on the next deploy. The search key still reaches the browser, as upstream's did — that is what a search-only key is for |
| AL-C | The index is filled by Algolia's connector, configured by the owner in Algolia's dashboard | ACCEPTED | As upstream. There is no Orun composition for Algolia; until it is connected the product is live and whole, its catalogue listed from Postgres |
| AL-D | Two Supabase projects per product (stage and prod) | ACCEPTED | The free plan's limit per org; a BOOTSTRAP prerequisite |
| AL-E | Supabase's Data API serves `public` to the anon key — the internal-only cost prices, suppliers and notes included | RESOLVED | Migration 020 enables row-level security with no policy on every table in `public`, behind a guard that refuses to lock the app out; tests/db and the e2e show anon and authenticated read and write nothing |
| AL-F | This baseline's env-var prefix (`ALGOLIA_SEARCH_`) is Algolia's own spelling for its search key, and the rebrand's leftover sweep treats the prefix as residue | ACCEPTED | `tooling/rebrand/rebrand.mjs` allows exactly `ALGOLIA_SEARCH_API_KEY` and `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`; any other `ALGOLIA_SEARCH_…` still fails (testing/rebrand.test.sh) |
| AL-G | Hyperdrive's read cache can serve a product page or the catalogue up to about a minute stale after a write behind the app's back | ACCEPTED | The template is read-only; the index lags the database by the connector's sync anyway |
| AL-H | The migrations package is named `@saas/db` | ACCEPTED | stack-tectonic's db-migrate composition builds `--filter=@saas/db` |
| AL-I | The e2e needs Google Chrome or Chromium | ACCEPTED | InstantSearch is client-only, so only a browser proves the search; GitHub's ubuntu runners carry google-chrome |
| AL-J | No live bootstrap yet: real Terraform applies, a real db-migrate apply, a real deploy and secret push, Hyperdrive's cache, a real Algolia application and connector | OPEN | One bootstrap from a tag against a workspace, then Algolia connected to it |
| AL-K | `pg-cloudflare` is shipped by a trace include that names pnpm's store layout (`../../node_modules/.pnpm/pg-cloudflare@*/…`) | ACCEPTED (watch) | Without it OpenNext's bundle fails "Could not resolve pg-cloudflare"; the e2e builds in a staged job tree, so a layout change fails there |
| AL-L | Product images are hot-linked from Unsplash, as upstream's seed has them | ACCEPTED | The demo data is the template's; an owner replaces it with a migration of their own |
