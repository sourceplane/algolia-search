/** The client options for a connection string (TLS for a remote database). */
export function connection(url: string): { connectionString: string; ssl?: { rejectUnauthorized: boolean } };
/** Apply packages/db's app migrations not yet in `local_migrations.applied`; returns how many it applied. */
export function migrate(
  client: { query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> },
  log?: (line: string) => void,
): Promise<number>;
