export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoString(date: Date): string {
  return date.toISOString();
}
