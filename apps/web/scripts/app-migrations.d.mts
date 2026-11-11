/** The app migrations `pnpm db:migrate` applies, in the manifest's order. */
export function appMigrations(manifest?: string): { id: string; path: string }[]
