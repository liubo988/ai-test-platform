import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContextOptions } from 'playwright';

export type IntentE2EPrecheckStorageState = Exclude<BrowserContextOptions['storageState'], undefined>;

export interface IntentE2EPrecheckStorageStateCandidate {
  source: 'env' | 'local_generated';
  path: string;
  storageState: IntentE2EPrecheckStorageState;
}

const ENV_STORAGE_STATE_PATH_KEYS = [
  'INTENT_E2E_STORAGE_STATE_PATH',
  'E2E_STORAGE_STATE_PATH',
  'INTENT_E2E_FIXTURE_STORAGE_STATE',
];

const LOCAL_GENERATED_STORAGE_STATE_DIR = path.join(process.cwd(), 'tests', 'e2e', 'generated');

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toTargetOrigin(targetUrl: string): URL | null {
  try {
    return new URL(targetUrl);
  } catch {
    return null;
  }
}

function readStorageState(storageStatePath: string): IntentE2EPrecheckStorageState | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as IntentE2EPrecheckStorageState;
  } catch {
    return null;
  }
}

function cookieDomainMatchesHost(cookieDomain: string, host: string): boolean {
  const normalizedDomain = cookieDomain.replace(/^\./, '').toLowerCase();
  const normalizedHost = host.toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

export function storageStateMatchesTargetOrigin(storageState: IntentE2EPrecheckStorageState, targetUrl: string): boolean {
  const target = toTargetOrigin(targetUrl);
  if (!target) return false;

  const origins = Array.isArray((storageState as { origins?: unknown }).origins)
    ? ((storageState as { origins?: Array<{ origin?: unknown }> }).origins || [])
    : [];
  if (origins.some((origin) => normalizeString(origin.origin) === target.origin)) {
    return true;
  }

  const cookies = Array.isArray((storageState as { cookies?: unknown }).cookies)
    ? ((storageState as { cookies?: Array<{ domain?: unknown }> }).cookies || [])
    : [];
  return cookies.some((cookie) => cookieDomainMatchesHost(normalizeString(cookie.domain), target.hostname));
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawPath of paths) {
    const normalized = normalizeString(rawPath);
    if (!normalized) continue;
    const absolutePath = path.isAbsolute(normalized) ? normalized : path.resolve(process.cwd(), normalized);
    if (seen.has(absolutePath)) continue;
    seen.add(absolutePath);
    result.push(absolutePath);
  }
  return result;
}

function listEnvStorageStatePaths(): string[] {
  return uniquePaths(ENV_STORAGE_STATE_PATH_KEYS.map((key) => process.env[key] || ''));
}

function listLocalGeneratedStorageStatePaths(): string[] {
  try {
    return fs
      .readdirSync(LOCAL_GENERATED_STORAGE_STATE_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^storage-state-.+\.json$/i.test(entry.name))
      .map((entry) => path.join(LOCAL_GENERATED_STORAGE_STATE_DIR, entry.name))
      .sort((left, right) => {
        const leftMtime = fs.statSync(left).mtimeMs;
        const rightMtime = fs.statSync(right).mtimeMs;
        return rightMtime - leftMtime;
      });
  } catch {
    return [];
  }
}

export function resolveIntentE2EPrecheckStorageStateCandidates(targetUrl: string): IntentE2EPrecheckStorageStateCandidate[] {
  const candidates: IntentE2EPrecheckStorageStateCandidate[] = [];
  const envPaths = listEnvStorageStatePaths();
  const localPaths = listLocalGeneratedStorageStatePaths();

  for (const storageStatePath of uniquePaths([...envPaths, ...localPaths])) {
    const storageState = readStorageState(storageStatePath);
    if (!storageState || !storageStateMatchesTargetOrigin(storageState, targetUrl)) continue;
    candidates.push({
      source: envPaths.includes(storageStatePath) ? 'env' : 'local_generated',
      path: storageStatePath,
      storageState,
    });
  }

  return candidates;
}
