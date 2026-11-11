# db-tests

The migrations' tests (the manifest and its checksums, the local migrator and its list, the products table and its demo rows held to upstream's seed, the connector's transformation, and row-level security on every table in public after every migration, on an in-process Postgres)

The test suite for **db**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/db`           |
| Package      | `@app/db-tests`      |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
