// The app migrations `pnpm db:migrate` applies, in order: packages/db's
// manifest entries whose context is `app` (the control migration, 000, belongs
// to packages/db's own runner and ledger). Read from manifest.ts as text, so
// this module has no dependencies and tests/db can import it.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), '../../../packages/db/src/manifest.ts')

/** `[{ id, path }]`, path relative to packages/db/src/migrations. */
export function appMigrations(manifest = readFileSync(MANIFEST, 'utf8')) {
  const entries = [...manifest.matchAll(/id: "([^"]+)",\s*context: "([^"]+)",\s*path: "([^"]+)"/g)]
  return entries.filter(([, , context]) => context === 'app').map(([, id, , path]) => ({ id, path }))
}
