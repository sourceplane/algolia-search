import { Client, Pool } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// One client per request. On the Worker the connection string is the
// HYPERDRIVE binding's (Cloudflare pools and caches the Supabase connection,
// and talks TLS to it), and the Workers runtime refuses to reuse a socket
// across requests, so upstream's lazy module-level `pg.Pool` would fail every
// request after the first. Each request's client is kept against that
// request's ExecutionContext and connected once, so every query of one request
// shares it and nothing outlives it. Upstream's `ssl: { rejectUnauthorized:
// false }` override (and its stripping of `sslmode`) is gone: the Worker talks
// to Hyperdrive, not to the Supabase pooler. Without a Cloudflare context
// (scripts, `next dev` without the platform proxy) it is POSTGRES_URL, through
// upstream's own pool.
const perRequest = new WeakMap<object, Promise<Client>>();

// Upstream's pool, for a process with no Cloudflare context.
let pool: Pool | undefined;
function getPool(): Pool {
  if (!pool) {
    // Supabase URLs carry sslmode=require, which pg escalates to verify-full
    // and lets override this ssl object — strip it so rejectUnauthorized
    // applies (the pooler presents a self-signed chain).
    const url = new URL(process.env.POSTGRES_URL!);
    url.searchParams.delete("sslmode");
    pool = new Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

function requestClient(): Promise<Client> | null {
  let cf: ReturnType<typeof getCloudflareContext> | undefined;
  try {
    cf = getCloudflareContext();
  } catch {
    return null; // no Cloudflare context
  }
  const connectionString = cf.env.HYPERDRIVE?.connectionString;
  if (!connectionString) return null;
  const request = cf.ctx as object; // the request's ExecutionContext
  let client = perRequest.get(request);
  if (!client) {
    const c = new Client({ connectionString });
    client = c.connect().then(() => c);
    // A failed connect is not kept: the request's next query tries again.
    client.catch(() => perRequest.delete(request));
    perRequest.set(request, client);
  }
  return client;
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = requestClient();
  const { rows } = await (client ? (await client).query(text, params) : getPool().query(text, params));
  return rows as T[];
}
