import rawManifest from '@/intent-e2e.system-onboarding-manifests.json' with { type: 'json' };
import {
  mergeIntentE2ERuntimeGovernance,
  normalizeIntentE2ERuntimeGovernance,
  type IntentE2ECredentialReference,
  type IntentE2EEnvironmentProfile,
  type IntentE2EFixtureGovernance,
  type IntentE2ERuntimeGovernance,
} from '@/lib/intent-e2e-runtime-governance';
import {
  normalizeIntentE2ECiCdProfile,
  resolveIntentE2ECiCdProfile,
  type IntentE2ECiCdProfile,
} from '@/lib/intent-e2e-system-onboarding-shared';
import {
  DEFAULT_INTENT_E2E_RUNNER_TYPE,
  DEFAULT_INTENT_E2E_TEST_TYPE,
  normalizePlatformRunnerType,
  normalizePlatformTestType,
  type PlatformRunnerType,
  type PlatformTestType,
} from '@/lib/test-platform-asset-model';
export {
  normalizeIntentE2ECiCdProfile,
  resolveIntentE2ECiCdProfile,
};
export type { IntentE2ECiCdProfile };
export type IntentE2ESystemOnboardingBenchmarkBindingMode = 'project_default' | 'none';

export interface IntentE2ESystemOnboardingSystemProfile {
  systemKey: string;
  displayName: string;
  baseUrl: string;
  entryUrl: string;
  targetUrlFamilies: string[];
  notes: string[];
}

export interface IntentE2ESystemOnboardingBenchmarkBinding {
  mode: IntentE2ESystemOnboardingBenchmarkBindingMode;
  expectedBenchmarkUid?: string;
  comparedLabel?: string;
  releaseCandidate?: string;
}

export interface IntentE2ESystemOnboardingManifest {
  version: 1;
  manifestId: string;
  displayName: string;
  systemProfile: IntentE2ESystemOnboardingSystemProfile;
  testType: PlatformTestType;
  runnerType: PlatformRunnerType;
  envProfile: IntentE2EEnvironmentProfile;
  credentialReference?: IntentE2ECredentialReference;
  fixtureStrategy?: IntentE2EFixtureGovernance;
  benchmarkBinding: IntentE2ESystemOnboardingBenchmarkBinding;
}

export interface IntentE2ESystemOnboardingManifestSummary {
  manifestId: string;
  displayName: string;
  systemKey: string;
  systemDisplayName: string;
  testType: PlatformTestType;
  runnerType: PlatformRunnerType;
  envProfile: IntentE2EEnvironmentProfile;
  entryUrl: string;
  targetUrlFamilies: string[];
  benchmarkBinding: IntentE2ESystemOnboardingBenchmarkBinding;
}

export interface IntentE2ESystemOnboardingManifestRegistry {
  version: 1;
  manifests: IntentE2ESystemOnboardingManifest[];
}

export interface ResolveIntentE2ESystemOnboardingDefaultsInput {
  onboardingManifestId?: string;
  targetUrl?: string;
  runtimeGovernance?: IntentE2ERuntimeGovernance;
}

export interface ResolveIntentE2ESystemOnboardingDefaultsResult {
  targetUrl: string;
  runtimeGovernance?: IntentE2ERuntimeGovernance;
  systemOnboarding?: IntentE2ESystemOnboardingManifestSummary;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const normalized = normalizeString(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
}

function cloneBenchmarkBinding(
  value?: IntentE2ESystemOnboardingBenchmarkBinding | null
): IntentE2ESystemOnboardingBenchmarkBinding {
  return {
    mode: value?.mode || 'none',
    ...(value?.expectedBenchmarkUid ? { expectedBenchmarkUid: value.expectedBenchmarkUid } : {}),
    ...(value?.comparedLabel ? { comparedLabel: value.comparedLabel } : {}),
    ...(value?.releaseCandidate ? { releaseCandidate: value.releaseCandidate } : {}),
  };
}

function normalizeBenchmarkBinding(raw: unknown): IntentE2ESystemOnboardingBenchmarkBinding {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    mode: record.mode === 'project_default' ? 'project_default' : 'none',
    ...(normalizeString(record.expectedBenchmarkUid)
      ? { expectedBenchmarkUid: normalizeString(record.expectedBenchmarkUid) }
      : {}),
    ...(normalizeString(record.comparedLabel) ? { comparedLabel: normalizeString(record.comparedLabel) } : {}),
    ...(normalizeString(record.releaseCandidate)
      ? { releaseCandidate: normalizeString(record.releaseCandidate) }
      : {}),
  };
}

function normalizeEnvironmentProfile(raw: unknown): IntentE2EEnvironmentProfile | undefined {
  return normalizeIntentE2ERuntimeGovernance({ environmentProfile: raw })?.environmentProfile;
}

function normalizeCredentialReference(raw: unknown): IntentE2ECredentialReference | undefined {
  const normalized = normalizeIntentE2ERuntimeGovernance({ credential: raw });
  return normalized?.credential
    ? {
        ...normalized.credential,
      }
    : undefined;
}

function normalizeFixtureStrategy(raw: unknown): IntentE2EFixtureGovernance | undefined {
  const normalized = normalizeIntentE2ERuntimeGovernance({ fixture: raw });
  return normalized?.fixture
    ? {
        ...normalized.fixture,
      }
    : undefined;
}

function mergeSystemOnboardingRuntimeGovernance(
  base?: IntentE2ERuntimeGovernance,
  override?: IntentE2ERuntimeGovernance
): IntentE2ERuntimeGovernance | undefined {
  const credential =
    base?.credential || override?.credential
      ? {
          source: override?.credential?.source ?? base?.credential?.source,
          secretRef: override?.credential?.secretRef ?? base?.credential?.secretRef,
          accountRef: override?.credential?.accountRef ?? base?.credential?.accountRef,
          sessionMode: override?.credential?.sessionMode ?? base?.credential?.sessionMode,
        }
      : undefined;
  const fixture =
    base?.fixture || override?.fixture
      ? {
          strategy: override?.fixture?.strategy ?? base?.fixture?.strategy,
          setupRef: override?.fixture?.setupRef ?? base?.fixture?.setupRef,
          cleanupRef: override?.fixture?.cleanupRef ?? base?.fixture?.cleanupRef,
          owner: override?.fixture?.owner ?? base?.fixture?.owner,
          idempotencyKey: override?.fixture?.idempotencyKey ?? base?.fixture?.idempotencyKey,
        }
      : undefined;

  return mergeIntentE2ERuntimeGovernance(base, {
    environmentProfile: override?.environmentProfile ?? base?.environmentProfile,
    ...(credential ? { credential } : {}),
    ...(fixture ? { fixture } : {}),
  });
}

function normalizeSystemProfile(raw: unknown): IntentE2ESystemOnboardingSystemProfile {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const systemKey = normalizeString(record.systemKey);
  const displayName = normalizeString(record.displayName);
  const baseUrl = normalizeString(record.baseUrl);
  const entryUrl = normalizeString(record.entryUrl);

  if (!systemKey) {
    throw new Error('system onboarding manifest 缺少 systemProfile.systemKey');
  }

  if (!displayName) {
    throw new Error(`system onboarding manifest ${systemKey} 缺少 systemProfile.displayName`);
  }

  if (!baseUrl) {
    throw new Error(`system onboarding manifest ${systemKey} 缺少 systemProfile.baseUrl`);
  }

  if (!entryUrl) {
    throw new Error(`system onboarding manifest ${systemKey} 缺少 systemProfile.entryUrl`);
  }

  return {
    systemKey,
    displayName,
    baseUrl,
    entryUrl,
    targetUrlFamilies: uniqueStrings(Array.isArray(record.targetUrlFamilies) ? (record.targetUrlFamilies as string[]) : []),
    notes: uniqueStrings(Array.isArray(record.notes) ? (record.notes as string[]) : []),
  };
}

function normalizeManifest(raw: unknown): IntentE2ESystemOnboardingManifest {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) {
    throw new Error('system onboarding manifest 定义必须是对象');
  }

  const manifestId = normalizeString(record.manifestId);
  if (!manifestId) {
    throw new Error('system onboarding manifest 缺少 manifestId');
  }

  const displayName = normalizeString(record.displayName);
  if (!displayName) {
    throw new Error(`system onboarding manifest ${manifestId} 缺少 displayName`);
  }

  const systemProfile = normalizeSystemProfile(record.systemProfile);
  const testType = normalizePlatformTestType(record.testType) || DEFAULT_INTENT_E2E_TEST_TYPE;
  const runnerType = normalizePlatformRunnerType(record.runnerType) || DEFAULT_INTENT_E2E_RUNNER_TYPE;
  const envProfile = normalizeEnvironmentProfile(record.envProfile);
  const credentialReference = normalizeCredentialReference(record.credentialReference);
  const fixtureStrategy = normalizeFixtureStrategy(record.fixtureStrategy);

  if (!envProfile) {
    throw new Error(`system onboarding manifest ${manifestId} 缺少有效 envProfile`);
  }

  return {
    version: 1,
    manifestId,
    displayName,
    systemProfile,
    testType,
    runnerType,
    envProfile,
    ...(credentialReference ? { credentialReference } : {}),
    ...(fixtureStrategy ? { fixtureStrategy } : {}),
    benchmarkBinding: normalizeBenchmarkBinding(record.benchmarkBinding),
  };
}

function normalizeRegistry(raw: unknown): IntentE2ESystemOnboardingManifestRegistry {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) {
    throw new Error('system onboarding manifest registry 必须是对象');
  }

  const version = Number(record.version || 1);
  if (version !== 1) {
    throw new Error(`system onboarding manifest registry version 不受支持：${version}`);
  }

  if (!Array.isArray(record.manifests) || record.manifests.length === 0) {
    throw new Error('system onboarding manifest registry 至少需要一个 manifest');
  }

  const manifests = record.manifests.map(normalizeManifest);
  const seen = new Set<string>();
  for (const manifest of manifests) {
    if (seen.has(manifest.manifestId)) {
      throw new Error(`system onboarding manifest registry 存在重复 manifestId：${manifest.manifestId}`);
    }
    seen.add(manifest.manifestId);
  }

  return {
    version: 1,
    manifests,
  };
}

const SYSTEM_ONBOARDING_REGISTRY = normalizeRegistry(rawManifest);

export function cloneIntentE2ESystemOnboardingSummary(
  value?: IntentE2ESystemOnboardingManifestSummary | null
): IntentE2ESystemOnboardingManifestSummary | undefined {
  if (!value) return undefined;

  return {
    manifestId: value.manifestId,
    displayName: value.displayName,
    systemKey: value.systemKey,
    systemDisplayName: value.systemDisplayName,
    testType: value.testType,
    runnerType: value.runnerType,
    envProfile: value.envProfile,
    entryUrl: value.entryUrl,
    targetUrlFamilies: [...value.targetUrlFamilies],
    benchmarkBinding: cloneBenchmarkBinding(value.benchmarkBinding),
  };
}

export function buildIntentE2ESystemOnboardingSummary(
  manifest: IntentE2ESystemOnboardingManifest
): IntentE2ESystemOnboardingManifestSummary {
  return {
    manifestId: manifest.manifestId,
    displayName: manifest.displayName,
    systemKey: manifest.systemProfile.systemKey,
    systemDisplayName: manifest.systemProfile.displayName,
    testType: manifest.testType,
    runnerType: manifest.runnerType,
    envProfile: manifest.envProfile,
    entryUrl: manifest.systemProfile.entryUrl,
    targetUrlFamilies: [...manifest.systemProfile.targetUrlFamilies],
    benchmarkBinding: cloneBenchmarkBinding(manifest.benchmarkBinding),
  };
}

export function getIntentE2ESystemOnboardingManifestRegistry(): IntentE2ESystemOnboardingManifestRegistry {
  return {
    version: SYSTEM_ONBOARDING_REGISTRY.version,
    manifests: SYSTEM_ONBOARDING_REGISTRY.manifests.map((manifest) => ({
      version: 1,
      manifestId: manifest.manifestId,
      displayName: manifest.displayName,
      systemProfile: {
        systemKey: manifest.systemProfile.systemKey,
        displayName: manifest.systemProfile.displayName,
        baseUrl: manifest.systemProfile.baseUrl,
        entryUrl: manifest.systemProfile.entryUrl,
        targetUrlFamilies: [...manifest.systemProfile.targetUrlFamilies],
        notes: [...manifest.systemProfile.notes],
      },
      testType: manifest.testType,
      runnerType: manifest.runnerType,
      envProfile: manifest.envProfile,
      ...(manifest.credentialReference
        ? {
            credentialReference: {
              ...manifest.credentialReference,
            },
          }
        : {}),
      ...(manifest.fixtureStrategy
        ? {
            fixtureStrategy: {
              ...manifest.fixtureStrategy,
            },
          }
        : {}),
      benchmarkBinding: cloneBenchmarkBinding(manifest.benchmarkBinding),
    })),
  };
}

export function listIntentE2ESystemOnboardingManifests(): IntentE2ESystemOnboardingManifest[] {
  return getIntentE2ESystemOnboardingManifestRegistry().manifests;
}

export function getIntentE2ESystemOnboardingManifest(manifestId: unknown): IntentE2ESystemOnboardingManifest | null {
  const normalizedManifestId = normalizeString(manifestId);
  if (!normalizedManifestId) return null;

  return listIntentE2ESystemOnboardingManifests().find((manifest) => manifest.manifestId === normalizedManifestId) || null;
}

export function resolveIntentE2ESystemOnboardingDefaults(
  input: ResolveIntentE2ESystemOnboardingDefaultsInput
): ResolveIntentE2ESystemOnboardingDefaultsResult {
  const targetUrl = normalizeString(input.targetUrl);
  const runtimeGovernance = normalizeIntentE2ERuntimeGovernance(input.runtimeGovernance);
  const onboardingManifestId = normalizeString(input.onboardingManifestId);

  if (!onboardingManifestId) {
    return {
      targetUrl,
      runtimeGovernance,
    };
  }

  const manifest = getIntentE2ESystemOnboardingManifest(onboardingManifestId);
  if (!manifest) {
    throw new Error(`onboarding manifest 不存在：${onboardingManifestId}`);
  }

  const manifestGovernance: IntentE2ERuntimeGovernance = {
    environmentProfile: manifest.envProfile,
    ...(manifest.credentialReference ? { credential: { ...manifest.credentialReference } } : {}),
    ...(manifest.fixtureStrategy ? { fixture: { ...manifest.fixtureStrategy } } : {}),
  };

  return {
    targetUrl: targetUrl || manifest.systemProfile.entryUrl,
    runtimeGovernance: mergeSystemOnboardingRuntimeGovernance(manifestGovernance, runtimeGovernance),
    systemOnboarding: buildIntentE2ESystemOnboardingSummary(manifest),
  };
}
