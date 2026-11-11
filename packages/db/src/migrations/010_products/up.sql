-- The template's one table, exactly as upstream's demo/seed.sql creates it:
-- twelve columns mixing what search shows (name, description, category,
-- price, image_url, rating, quantity) with what stays in the database
-- (cost_price, supplier_id, internal_notes, stock_location), and updated_at,
-- which the Algolia connector's incremental sync can key on.
--
-- Upstream had you paste demo/seed.sql into the Supabase SQL Editor once. Its
-- CREATE TABLE is this migration and its rows are 030_demo_products, applied
-- by db-migrate before the Worker serves, on stage and prod, and by `pnpm
-- --filter @app/web db:migrate` locally.
--
-- Idempotent, as every migration here must be (the Supabase Management API
-- adapter sends each one in autocommit mode): IF NOT EXISTS, as upstream wrote
-- it, so a database someone already seeded by hand keeps its table.
create table if not exists products (
  id integer primary key,
  name text not null,
  description text not null,
  category text not null,
  price numeric(10,2) not null,
  image_url text,
  rating numeric(2,1),
  cost_price numeric(10,2),
  supplier_id text,
  internal_notes text,
  stock_location text,
  quantity integer not null default 0,
  updated_at timestamptz not null default now()
);
