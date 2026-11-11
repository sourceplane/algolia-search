# cloudflare-hyperdrive

Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-hyperdrive`                                                              |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- **supabase** — Provisions Supabase projects for stage and prod and wires credentials into orun secrets

## Depended on by

- **db-migrate** — Applies database migrations to stage and prod Supabase instances
- **web** — The product search site, Algolia's InstantSearch over a Supabase products table (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment)
