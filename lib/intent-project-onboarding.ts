import fs from 'node:fs';
import path from 'node:path';
import { normalizeIntentProjectUid, resolveProjectScopedIntentAssetPath } from '@/lib/intent-project-knowledge';

export interface IntentProjectOnboardingManifest {
  version: 1;
  baseUrl: string;
  loginEntry: string;
  targetUrlFamilies: string[];
  stableIdentifierHints: string[];
  keyResponsePatterns: string[];
  defaultListOwnershipHints: string[];
  detailEntryHints: string[];
  goldFlows: string[];
}

export interface IntentProjectOnboardingStatus {
  projectUid: string;
  path: string;
  exists: boolean;
  ready: boolean;
  missingFields: string[];
  manifest: IntentProjectOnboardingManifest | null;
}

const DEFAULT_PROJECT_ONBOARDING_FILE_NAME = 'intent-e2e.project-onboarding.json';

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function normalizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? uniqueStrings(raw.map((item) => (typeof item === 'string' ? item : '')))
    : [];
}

function normalizeIntentProjectOnboardingManifest(raw: unknown): IntentProjectOnboardingManifest | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  return {
    version: 1,
    baseUrl: typeof source.baseUrl === 'string' ? source.baseUrl.trim() : '',
    loginEntry: typeof source.loginEntry === 'string' ? source.loginEntry.trim() : '',
    targetUrlFamilies: normalizeStringArray(source.targetUrlFamilies),
    stableIdentifierHints: normalizeStringArray(source.stableIdentifierHints),
    keyResponsePatterns: normalizeStringArray(source.keyResponsePatterns),
    defaultListOwnershipHints: normalizeStringArray(source.defaultListOwnershipHints),
    detailEntryHints: normalizeStringArray(source.detailEntryHints),
    goldFlows: normalizeStringArray(source.goldFlows),
  };
}

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (!relative || relative.startsWith('..')) return filePath;
  return relative;
}

function collectMissingFields(manifest: IntentProjectOnboardingManifest | null): string[] {
  if (!manifest) {
    return ['invalid_json'];
  }

  return uniqueStrings([
    manifest.baseUrl ? '' : 'baseUrl',
    manifest.loginEntry ? '' : 'loginEntry',
    manifest.targetUrlFamilies.length > 0 ? '' : 'targetUrlFamilies',
    manifest.stableIdentifierHints.length > 0 ? '' : 'stableIdentifierHints',
    manifest.keyResponsePatterns.length > 0 ? '' : 'keyResponsePatterns',
    manifest.defaultListOwnershipHints.length > 0 ? '' : 'defaultListOwnershipHints',
    manifest.detailEntryHints.length > 0 ? '' : 'detailEntryHints',
    manifest.goldFlows.length > 0 ? '' : 'goldFlows',
  ]);
}

export function getIntentProjectOnboardingPath(projectUid = ''): string {
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid);
  if (!normalizedProjectUid) return '';
  return toDisplayPath(resolveProjectScopedIntentAssetPath(normalizedProjectUid, DEFAULT_PROJECT_ONBOARDING_FILE_NAME));
}

export function readIntentProjectOnboardingStatus(projectUid = ''): IntentProjectOnboardingStatus {
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid);
  if (!normalizedProjectUid) {
    return {
      projectUid: '',
      path: '',
      exists: false,
      ready: true,
      missingFields: [],
      manifest: null,
    };
  }

  const absolutePath = resolveProjectScopedIntentAssetPath(normalizedProjectUid, DEFAULT_PROJECT_ONBOARDING_FILE_NAME);
  const displayPath = toDisplayPath(absolutePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      projectUid: normalizedProjectUid,
      path: displayPath,
      exists: false,
      ready: false,
      missingFields: ['manifest'],
      manifest: null,
    };
  }

  try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const manifest = normalizeIntentProjectOnboardingManifest(JSON.parse(raw));
    const missingFields = collectMissingFields(manifest);

    return {
      projectUid: normalizedProjectUid,
      path: displayPath,
      exists: true,
      ready: missingFields.length === 0,
      missingFields,
      manifest,
    };
  } catch {
    return {
      projectUid: normalizedProjectUid,
      path: displayPath,
      exists: true,
      ready: false,
      missingFields: ['invalid_json'],
      manifest: null,
    };
  }
}
