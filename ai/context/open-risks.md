# algolia-search — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/algolia-search/risks-and-open-questions.md`; this page
lists only what is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| AL-J | No live bootstrap yet: the repository created and linked, the five keys minted, real Terraform applies of the Supabase projects and Hyperdrive configs, a `db-migrate` apply against a real Supabase project, a real `wrangler deploy` and secret push, Hyperdrive's read cache, a real Algolia application and its Supabase connector, and the probes are all unproven | OPEN | One bootstrap from a tag against a workspace with Cloudflare and Supabase connections, then Algolia connected to it |

Accepted, and worth knowing before you change them: AL-A (one `pg` client
per request), AL-B (the Algolia keys are Worker secrets, read per request),
AL-C (the connector is the owner's step in Algolia's dashboard), AL-D (two
Supabase projects per product — an owner prerequisite on the free plan), AL-F
(Algolia's `ALGOLIA_SEARCH_API_KEY` allowed by the rebrand's sweep), AL-G
(Hyperdrive's read cache can show a product written behind the app's back up
to a minute late), AL-H (the migrations package is named `@saas/db`), AL-K
(`pg-cloudflare` shipped by a trace include that names pnpm's store layout).
