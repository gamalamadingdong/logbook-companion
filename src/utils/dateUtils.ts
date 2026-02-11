/**
 * Parse a date-only string (e.g. "2026-02-10") as LOCAL midnight.
 *
 * `new Date("2026-02-10")` is parsed as UTC midnight per the ES spec,
 * which shifts to the previous day in US timezones.
 * Appending `T00:00:00` forces local-timezone interpretation.
 */
export function parseLocalDate(dateStr: string): Date {
  // If it's already got a time component, leave it alone
  if (dateStr.includes('T')) return new Date(dateStr);
  return new Date(`${dateStr.slice(0, 10)}T00:00:00`);
}
