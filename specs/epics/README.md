# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`algolia-search/`](./algolia-search/) | **AL** | In progress (AL1: the site on Workers) | Vercel's Algolia Integration Example, its `query()` on a pg client per request over Hyperdrive to Supabase Postgres, its Algolia keys the Worker's secrets and its table and demo products applied by db-migrate — and an Orun baseline that instantiates it in one landing (AL2) |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
