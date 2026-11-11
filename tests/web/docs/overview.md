# web-tests

The app's tests (the per-request Postgres client, Hyperdrive first; the Algolia config read from the Worker; InstantSearch against an in-process Algolia stand-in; the catalogue and the page's two states; the /api/health database check; the committed wrangler config)

The test suite for **web**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/web`          |
| Package      | `@app/web-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
