/**
 * Raw SQL executed through Drizzle does not apply schema decoders. PostgreSQL
 * timestamps can therefore arrive as strings even when regular Drizzle
 * selects return Date instances.
 */
export function databaseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function databaseTimestampIso(value: unknown): string | null {
  return databaseDate(value)?.toISOString() ?? null;
}
