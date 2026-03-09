import { randomBytes } from 'node:crypto';

function randHex(len = 6): string {
  return randomBytes(len).toString('hex');
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${randHex(4)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
