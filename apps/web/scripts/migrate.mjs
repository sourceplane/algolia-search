#!/usr/bin/env node
// `pnpm db:migrate` — the schema and the demo products, into a LOCAL database
// (POSTGRES_URL; default the Supabase CLI's localhost:54322). Stage and prod
// are migrated by db-migrate (packages/db's runner, before the Worker deploys);
// this applies the very same files, so there is one copy of the schema and of
// the template's demo dataset (upstream had you paste demo/seed.sql into the
// Supabase SQL Editor; its table and its rows are migrations 010 and 030 now).
//
// Each of packages/db's app migrations, in the manifest's order, runs once, in
// a transaction with its ledger row: the ledger is the schema `local_migrations`
// (never `public`, which Supabase's Data API serves), and it keeps each file's
// sha256, so a file changed after it was applied stops the run instead of being
// skipped silently. The control migration (000) is not applied: it creates the
// ledger packages/db's runner keeps, and a local database is this script's to
// track.
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { appMigrations } from './app-migrations.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS = join(here, '../../../packages/db/src/migrations')

const LEDGER = `
  create schema if not exists local_migrations;
  create table if not exists local_migrations.applied (
    id text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  );`

/** The client options for a connection string: TLS for a remote database, as lib/db.ts's pool does. */
export function connection(url) {
  const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
  if (local) return { connectionString: url }
  const u = new URL(url)
  u.searchParams.delete('sslmode')
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: false } }
}

export async function migrate(client, log = console.log) {
  await client.query(LEDGER)
  const { rows } = await client.query('select id, checksum from local_migrations.applied')
  const done = new Map(rows.map((r) => [r.id, r.checksum]))
  let applied = 0
  for (const { id, path } of appMigrations()) {
    const text = readFileSync(join(MIGRATIONS, path), 'utf8')
    const checksum = createHash('sha256').update(text).digest('hex')
    if (done.has(id)) {
      if (done.get(id) !== checksum) throw new Error(`${id} changed after it was applied (${path})`)
      continue
    }
    await client.query('begin')
    try {
      await client.query(text) // no parameters: the simple protocol, so a file runs whole
      await client.query('insert into local_migrations.applied (id, checksum) values ($1, $2)', [id, checksum])
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }
    log(`applied: ${id}`)
    applied += 1
  }
  if (applied === 0) log('up to date')
  return applied
}

async function main() {
  const url = process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:54322/postgres'
  const client = new pg.Client(connection(url))
  await client.connect()
  try {
    await migrate(client)
  } catch (error) {
    console.error('db:migrate failed:', error)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  await main()
}
