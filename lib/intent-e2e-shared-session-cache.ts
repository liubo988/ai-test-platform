import type { BrowserContextOptions } from 'playwright';
import type { IntentE2ERuntimeGovernance } from '@/lib/intent-e2e-runtime-governance';

export type IntentE2ESharedSessionStorageState = Exclude<BrowserContextOptions['storageState'], undefined>;

export interface IntentE2ESharedSessionCacheEntry {
  key: string;
  storageState: IntentE2ESharedSessionStorageState;
  updatedAt: string;
}

const SHARED_SESSION_CACHE = new Map<string, IntentE2ESharedSessionCacheEntry>();

function normalizeCacheKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cloneStorageState(
  storageState: IntentE2ESharedSessionStorageState
): IntentE2ESharedSessionStorageState {
  return JSON.parse(JSON.stringify(storageState)) as IntentE2ESharedSessionStorageState;
}

export function resolveIntentE2ESharedSessionCacheKey(
  runtimeGovernance?: IntentE2ERuntimeGovernance
): string {
  const credential = runtimeGovernance?.credential;
  if (credential?.sessionMode !== 'shared') return '';
  return normalizeCacheKey(credential.accountRef);
}

export function readIntentE2ESharedSessionCache(
  key: string
): IntentE2ESharedSessionCacheEntry | null {
  const normalizedKey = normalizeCacheKey(key);
  if (!normalizedKey) return null;

  const cached = SHARED_SESSION_CACHE.get(normalizedKey);
  if (!cached) return null;

  return {
    key: cached.key,
    updatedAt: cached.updatedAt,
    storageState: cloneStorageState(cached.storageState),
  };
}

export function writeIntentE2ESharedSessionCache(
  key: string,
  storageState: IntentE2ESharedSessionStorageState
): void {
  const normalizedKey = normalizeCacheKey(key);
  if (!normalizedKey) return;

  SHARED_SESSION_CACHE.set(normalizedKey, {
    key: normalizedKey,
    updatedAt: new Date().toISOString(),
    storageState: cloneStorageState(storageState),
  });
}

export function deleteIntentE2ESharedSessionCache(key: string): void {
  const normalizedKey = normalizeCacheKey(key);
  if (!normalizedKey) return;
  SHARED_SESSION_CACHE.delete(normalizedKey);
}

export function resetIntentE2ESharedSessionCache(): void {
  SHARED_SESSION_CACHE.clear();
}
