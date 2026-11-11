-- Row-level security on every table in `public`, and no policies.
--
-- Supabase's Data API (PostgREST) serves `public` to anyone holding the
-- project's anon key, which is public by Supabase's design. Upstream's
-- demo/seed.sql left `products` without RLS, so the Data API would hand its
-- rows out — the internal-only cost_price, supplier_id and internal_notes
-- among them — and take writes into it. With RLS enabled and no
-- policy, `anon` and `authenticated` read and write NOTHING through it. The
-- app is not affected: it connects through Hyperdrive as `postgres` (the
-- cloudflare-hyperdrive root's database_user), which created and owns the
-- table, and a table's owner is not subject to its RLS unless FORCE is set
-- (it is not). The migration ledgers (`_migrations`, and the
-- `local_migrations` schema a local `pnpm db:migrate` keeps its own in) are
-- schemas the Data API does not expose.
--
-- tests/db fails if any table in `public` is left without RLS after the
-- migrations.
--
-- FIRST, the guard. If `postgres` neither owns every table here nor has
-- SUPERUSER or BYPASSRLS, enabling RLS would lock the app out of its own
-- data: stop. The guard changes nothing and runs before the first ALTER, so
-- a refusal enables nothing. Idempotent: ENABLE on an enabled table is a
-- no-op.
DO $$
DECLARE
  app_bypasses boolean;
  not_owned text;
BEGIN
  SELECT rolsuper OR rolbypassrls INTO app_bypasses FROM pg_roles WHERE rolname = 'postgres';
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO not_owned
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
     AND pg_get_userbyid(c.relowner) <> 'postgres';
  IF NOT coalesce(app_bypasses, false) AND not_owned IS NOT NULL THEN
    RAISE EXCEPTION 'row-level security would lock the app out of %: postgres (the role Hyperdrive connects as) neither owns them nor has SUPERUSER or BYPASSRLS', not_owned;
  END IF;
END
$$;

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
