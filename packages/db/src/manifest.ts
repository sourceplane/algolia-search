import type { MigrationManifest } from "./types.js";

// Every migration the runner applies, in order, with the sha256 of its file.
// `pnpm --filter @saas/db run manifest:check` verifies the checksums;
// `manifest:fix` rewrites them after a migration file changes (only ever
// before that migration has been applied anywhere — an applied migration's
// checksum is immutable).
export const manifest: MigrationManifest = {
  version: 1,
  migrations: [
    {
      id: "000_control_baseline",
      context: "control",
      path: "000_control/up.sql",
      checksum:
        "2a5d7f30684c99e3ff441ca8a2c38038dedd1bab4db4a40e92cd36bb22be297f",
      description:
        "Baseline control migration — creates the migration tracking schema",
    },
    {
      id: "010_products",
      context: "app",
      path: "010_products/up.sql",
      checksum:
        "a75d9b3cd6bdc7a17fe9c1cfc378affaeee532c18f5d950965ad3781af3cd7d5",
      description:
        "The template's products table, as upstream's demo/seed.sql creates it (IF NOT EXISTS) — applied before the Worker serves; `pnpm --filter @app/web db:migrate` applies the same file locally",
    },
    {
      id: "020_row_level_security",
      context: "app",
      path: "020_row_level_security/up.sql",
      checksum:
        "89080e7dd53a04112da561a099b0abba4122537958c155438ef6177739410a03",
      description:
        "Row-level security, with no policies, on every table in public — closed to Supabase's Data API (anon, authenticated), open to the app, which owns them; refuses to run if the app's role would be locked out",
    },
    {
      id: "030_demo_products",
      context: "app",
      path: "030_demo_products/up.sql",
      checksum:
        "0ad144d2593900ce83b439141f24b222714b1058505915c37b674919967dc1cd",
      description:
        "The template's demo dataset — upstream's demo/seed.sql's twenty products, byte for byte, each an upsert on its id — so the catalogue and the Algolia connector have data from the first deploy",
    },
  ],
};
