import rawManifest from '@/intent-e2e.repo-test-runner-presets.json' with { type: 'json' };
import path from 'node:path';

export type RepoTestRunnerPresetId = 'vitest_unit' | 'tsc_build' | 'doc_links';
export type RepoTestRunnerPresetCommandKind = 'node_script';
export type RepoTestRunnerPresetTargetPolicyMode = 'none' | 'unit_test_spec';

export interface RepoTestRunnerPresetTargetPolicy {
  mode: RepoTestRunnerPresetTargetPolicyMode;
  defaultTargets: string[];
  maxTargets: number;
}

export interface RepoTestRunnerPresetDefinition {
  presetId: RepoTestRunnerPresetId;
  displayName: string;
  commandKind: RepoTestRunnerPresetCommandKind;
  entryPath: string;
  args: string[];
  targetPolicy: RepoTestRunnerPresetTargetPolicy;
}

export interface RepoTestRunnerPresetManifest {
  version: 1;
  presets: RepoTestRunnerPresetDefinition[];
}

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = normalizeTrimmedString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function normalizeRepoTestRunnerPresetId(value: unknown): RepoTestRunnerPresetId | '' {
  switch (normalizeTrimmedString(value)) {
    case 'vitest_unit':
    case 'tsc_build':
    case 'doc_links':
      return normalizeTrimmedString(value) as RepoTestRunnerPresetId;
    default:
      return '';
  }
}

function normalizeRepoTestRunnerCommandKind(value: unknown): RepoTestRunnerPresetCommandKind | '' {
  switch (normalizeTrimmedString(value)) {
    case 'node_script':
      return 'node_script';
    default:
      return '';
  }
}

function normalizeRepoTestRunnerTargetPolicyMode(value: unknown): RepoTestRunnerPresetTargetPolicyMode | '' {
  switch (normalizeTrimmedString(value)) {
    case 'none':
    case 'unit_test_spec':
      return normalizeTrimmedString(value) as RepoTestRunnerPresetTargetPolicyMode;
    default:
      return '';
  }
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? uniqueStrings(value.map((item) => (typeof item === 'string' ? item : '')))
    : [];
}

function normalizeRepoTestRunnerTargetPathForPolicy(mode: RepoTestRunnerPresetTargetPolicyMode, value: unknown): string {
  const raw = normalizeTrimmedString(value).replace(/\\/g, '/');
  if (!raw) return '';
  if (mode === 'none') return '';

  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized === '..') return '';
  if (normalized.startsWith('../') || normalized.startsWith('/')) return '';
  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) return '';

  if (mode === 'unit_test_spec') {
    if (!normalized.startsWith('tests/unit/')) return '';
    if (!normalized.endsWith('.spec.ts')) return '';
  }

  return normalized;
}

function normalizeRepoTestRunnerPresetDefinition(raw: unknown): RepoTestRunnerPresetDefinition {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) {
    throw new Error('repo_test_runner preset 定义必须是对象');
  }

  const presetId = normalizeRepoTestRunnerPresetId(record.presetId);
  if (!presetId) {
    throw new Error(`repo_test_runner presetId 不受支持：${String(record.presetId || '')}`);
  }

  const displayName = normalizeTrimmedString(record.displayName);
  if (!displayName) {
    throw new Error(`repo_test_runner preset ${presetId} 缺少 displayName`);
  }

  const commandKind = normalizeRepoTestRunnerCommandKind(record.commandKind);
  if (!commandKind) {
    throw new Error(`repo_test_runner preset ${presetId} commandKind 不受支持：${String(record.commandKind || '')}`);
  }

  const entryPath = normalizeTrimmedString(record.entryPath).replace(/\\/g, '/');
  if (!entryPath || entryPath.startsWith('/') || entryPath.startsWith('../')) {
    throw new Error(`repo_test_runner preset ${presetId} entryPath 不合法：${String(record.entryPath || '')}`);
  }

  const args = normalizeStringArray(record.args);
  const targetPolicyRecord =
    record.targetPolicy && typeof record.targetPolicy === 'object' && !Array.isArray(record.targetPolicy)
      ? (record.targetPolicy as Record<string, unknown>)
      : null;
  if (!targetPolicyRecord) {
    throw new Error(`repo_test_runner preset ${presetId} 缺少 targetPolicy`);
  }

  const mode = normalizeRepoTestRunnerTargetPolicyMode(targetPolicyRecord.mode);
  if (!mode) {
    throw new Error(
      `repo_test_runner preset ${presetId} targetPolicy.mode 不受支持：${String(targetPolicyRecord.mode || '')}`
    );
  }

  const defaultTargets = normalizeStringArray(targetPolicyRecord.defaultTargets).flatMap((item) => {
    if (mode === 'unit_test_spec' && item === 'tests/unit') {
      return ['tests/unit'];
    }

    const normalized = normalizeRepoTestRunnerTargetPathForPolicy(mode, item);
    return normalized ? [normalized] : [];
  });
  const maxTargetsCandidate = Number(targetPolicyRecord.maxTargets);
  const maxTargets =
    Number.isInteger(maxTargetsCandidate) && maxTargetsCandidate >= 0 ? Math.floor(maxTargetsCandidate) : 0;

  if (mode === 'none' && (defaultTargets.length > 0 || maxTargets !== 0)) {
    throw new Error(`repo_test_runner preset ${presetId} 的 none targetPolicy 不允许 defaultTargets / maxTargets`);
  }
  if (mode === 'unit_test_spec' && maxTargets <= 0) {
    throw new Error(`repo_test_runner preset ${presetId} 的 unit_test_spec targetPolicy 需要正整数 maxTargets`);
  }

  return {
    presetId,
    displayName,
    commandKind,
    entryPath,
    args,
    targetPolicy: {
      mode,
      defaultTargets,
      maxTargets,
    },
  };
}

function normalizeRepoTestRunnerPresetManifest(raw: unknown): RepoTestRunnerPresetManifest {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) {
    throw new Error('repo_test_runner preset manifest 必须是对象');
  }

  const version = Number(record.version || 1);
  if (version !== 1) {
    throw new Error(`repo_test_runner preset manifest version 不受支持：${version}`);
  }

  if (!Array.isArray(record.presets) || record.presets.length === 0) {
    throw new Error('repo_test_runner preset manifest 至少需要一个 preset');
  }

  const presets = record.presets.map(normalizeRepoTestRunnerPresetDefinition);
  const seen = new Set<string>();
  for (const preset of presets) {
    if (seen.has(preset.presetId)) {
      throw new Error(`repo_test_runner preset manifest 存在重复 presetId：${preset.presetId}`);
    }
    seen.add(preset.presetId);
  }

  return {
    version: 1,
    presets,
  };
}

const REPO_TEST_RUNNER_PRESET_MANIFEST = normalizeRepoTestRunnerPresetManifest(rawManifest);

export function getRepoTestRunnerPresetManifest(): RepoTestRunnerPresetManifest {
  return {
    version: REPO_TEST_RUNNER_PRESET_MANIFEST.version,
    presets: REPO_TEST_RUNNER_PRESET_MANIFEST.presets.map((preset) => ({
      ...preset,
      args: [...preset.args],
      targetPolicy: {
        ...preset.targetPolicy,
        defaultTargets: [...preset.targetPolicy.defaultTargets],
      },
    })),
  };
}

export function listRepoTestRunnerPresetDefinitions(): RepoTestRunnerPresetDefinition[] {
  return getRepoTestRunnerPresetManifest().presets;
}

export function getRepoTestRunnerPresetDefinition(presetId: unknown): RepoTestRunnerPresetDefinition | null {
  const normalizedPresetId = normalizeRepoTestRunnerPresetId(presetId);
  if (!normalizedPresetId) return null;

  return listRepoTestRunnerPresetDefinitions().find((preset) => preset.presetId === normalizedPresetId) || null;
}

export function resolveRepoTestRunnerPresetTargets(
  preset: RepoTestRunnerPresetDefinition,
  value: unknown
): { targets: string[]; invalidTargets: string[] } {
  if (value === undefined) {
    return {
      targets: [...preset.targetPolicy.defaultTargets],
      invalidTargets: [],
    };
  }

  if (!Array.isArray(value)) {
    return {
      targets: [],
      invalidTargets: ['<non-array>'],
    };
  }

  const targets: string[] = [];
  const invalidTargets: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const normalized = normalizeRepoTestRunnerTargetPathForPolicy(preset.targetPolicy.mode, item);
    if (!normalized) {
      invalidTargets.push(String(item || ''));
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    targets.push(normalized);
  }

  return {
    targets: targets.length > 0 ? targets : [...preset.targetPolicy.defaultTargets],
    invalidTargets,
  };
}
