export const LATIN_NUMBERING_SYSTEM = "latn" as const;
export const LATIN_LOCALE = "en-US";

function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(value: Date | string | number, options: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }): string {
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LATIN_LOCALE, { ...options, numberingSystem: LATIN_NUMBERING_SYSTEM }).format(date);
}

export function formatDate(value: Date | string | number, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }): string {
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LATIN_LOCALE, { ...options, numberingSystem: LATIN_NUMBERING_SYSTEM }).format(date);
}

export function formatTime(value: Date | string | number, options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }): string {
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LATIN_LOCALE, { ...options, numberingSystem: LATIN_NUMBERING_SYSTEM }).format(date);
}

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(LATIN_LOCALE, { ...options, numberingSystem: LATIN_NUMBERING_SYSTEM }).format(value);
}
