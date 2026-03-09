export function normalizePhone(input: string): string {
  return input.replace(/\s+/g, '').trim();
}

export function isValidCNPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return /^1\d{10}$/.test(normalized);
}
