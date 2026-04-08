export function stripOuterMarkdownCodeFence(code: string): string {
  const normalized = String(code || '').trim();
  const fenced = normalized.match(/^```(?:[a-zA-Z0-9_.+-]+)?\s*\n([\s\S]*?)\n```$/);
  if (!fenced) return normalized;
  return String(fenced[1] || '').trim();
}

export function normalizeExecutableTestCode(code: string): string {
  return stripOuterMarkdownCodeFence(code);
}
