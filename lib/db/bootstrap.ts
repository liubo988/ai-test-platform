import { ensureDbReady } from '@/lib/db/client';

let readyPromise: Promise<void> | null = null;

export async function ensureDbBootstrap(): Promise<void> {
  if (!readyPromise) {
    readyPromise = ensureDbReady();
  }
  return readyPromise;
}
