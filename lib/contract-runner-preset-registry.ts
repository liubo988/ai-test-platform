import path from 'node:path';

import rawManifest from '@/intent-e2e.contract-runner-presets.json' with { type: 'json' };

export type ContractRunnerPresetId = 'openapi_file';
export type ContractRunnerPresetContractKind = 'openapi_document';
export type ContractRunnerPresetTargetPolicyMode = 'contract_file';

export interface ContractRunnerPresetTargetPolicy {
  mode: ContractRunnerPresetTargetPolicyMode;
  defaultTargets: string[];
  maxTargets: number;
}

export interface ContractRunnerPresetDefinition {
  presetId: ContractRunnerPresetId;
  displayName: string;
  contractKind: ContractRunnerPresetContractKind;
  targetPolicy: ContractRunnerPresetTargetPolicy;
}

export interface ContractRunnerPresetManifest {
  version: 1;
  presets: ContractRunnerPresetDefinition[];
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

function normalizeContractRunnerPresetId(value: unknown): ContractRunnerPresetId | '' {
  switch (normalizeTrimmedString(value)) {
    case 'openapi_file':
      return 'openapi_file';
    default:
      return '';
  }
}

function normalizeContractRunnerPresetContractKind(value: unknown): ContractRunnerPresetContractKind | '' {
  switch (normalizeTrimmedString(value)) {
    case 'openapi_document':
      return 'openapi_document';
    default:
      return '';
  }
}

function normalizeContractRunnerTargetPolicyMode(value: unknown): ContractRunnerPresetTargetPolicyMode | '' {
  switch (normalizeTrimmedString(value)) {
    case 'contract_file':
      return 'contract_file';
    default:
      return '';
  }
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? uniqueStrings(value.map((item) => (typeof item === 'string' ? item : '')))
    : [];
}

function normalizeContractRunnerTargetPathForPolicy(mode: ContractRunnerPresetTargetPolicyMode, value: unknown): string {
  const raw = normalizeTrimmedString(value).replace(/\\/g, '/');
  if (!raw) return '';
  if (mode !== 'contract_file') return '';

  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized === '..') return '';
  if (normalized.startsWith('../') || normalized.startsWith('/')) return '';
  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) return '';
  if (!normalized.startsWith('contracts/')) return '';
  if (!/\.(json|ya?ml)$/i.test(normalized)) return '';

  return normalized;
}

function normalizeContractRunnerPresetDefinition(raw: unknown): ContractRunnerPresetDefinition {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) {
    throw new Error('contract_runner preset 定义必须是对象');
  }

  const presetId = normalizeContractRunnerPresetId(record.presetId);
  if (!presetId) {
    throw new Error(`contract_runner presetId 不受支持：${String(record.presetId || '')}`);
  }

  const displayName = normalizeTrimmedString(record.displayName);
  if (!displayName) {
    throw new Error(`contract_runner preset ${presetId} 缺少 displayName`);
  }

  const contractKind = normalizeContractRunnerPresetContractKind(record.contractKind);
  if (!contractKind) {
    throw new Error(
      `contract_runner preset ${presetId} contractKind 不受支持：${String(record.contractKind || '')}`
    );
  }

  const targetPolicyRecord =
    record.targetPolicy && typeof record.targetPolicy === 'object' && !Array.isArray(record.targetPolicy)
      ? (record.targetPolicy as Record<string, unknown>)
      : null;
  if (!targetPolicyRecord) {
    throw new Error(`contract_runner preset ${presetId} 缺少 targetPolicy`);
  }

  const mode = normalizeContractRunnerTargetPolicyMode(targetPolicyRecord.mode);
  if (!mode) {
    throw new Error(
      `contract_runner preset ${presetId} targetPolicy.mode 不受支持：${String(targetPolicyRecord.mode || '')}`
    );
  }

  const defaultTargets = normalizeStringArray(targetPolicyRecord.defaultTargets).flatMap((item) => {
    const normalized = normalizeContractRunnerTargetPathForPolicy(mode, item);
    return normalized ? [normalized] : [];
  });
  const maxTargetsCandidate = Number(targetPolicyRecord.maxTargets);
  const maxTargets =
    Number.isInteger(maxTargetsCandidate) && maxTargetsCandidate >= 0 ? Math.floor(maxTargetsCandidate) : 0;

  if (maxTargets <= 0) {
    throw new Error(`contract_runner preset ${presetId} 需要正整数 maxTargets`);
  }

  return {
    presetId,
    displayName,
    contractKind,
    targetPolicy: {
      mode,
      defaultTargets,
      maxTargets,
    },
  };
}

function normalizeContractRunnerPresetManifest(raw: unknown): ContractRunnerPresetManifest {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!record) {
    throw new Error('contract_runner preset manifest 必须是对象');
  }

  const version = Number(record.version || 1);
  if (version !== 1) {
    throw new Error(`contract_runner preset manifest version 不受支持：${version}`);
  }

  if (!Array.isArray(record.presets) || record.presets.length === 0) {
    throw new Error('contract_runner preset manifest 至少需要一个 preset');
  }

  const presets = record.presets.map(normalizeContractRunnerPresetDefinition);
  const seen = new Set<string>();
  for (const preset of presets) {
    if (seen.has(preset.presetId)) {
      throw new Error(`contract_runner preset manifest 存在重复 presetId：${preset.presetId}`);
    }
    seen.add(preset.presetId);
  }

  return {
    version: 1,
    presets,
  };
}

const CONTRACT_RUNNER_PRESET_MANIFEST = normalizeContractRunnerPresetManifest(rawManifest);

export function getContractRunnerPresetManifest(): ContractRunnerPresetManifest {
  return {
    version: CONTRACT_RUNNER_PRESET_MANIFEST.version,
    presets: CONTRACT_RUNNER_PRESET_MANIFEST.presets.map((preset) => ({
      ...preset,
      targetPolicy: {
        ...preset.targetPolicy,
        defaultTargets: [...preset.targetPolicy.defaultTargets],
      },
    })),
  };
}

export function listContractRunnerPresetDefinitions(): ContractRunnerPresetDefinition[] {
  return getContractRunnerPresetManifest().presets;
}

export function getContractRunnerPresetDefinition(presetId: unknown): ContractRunnerPresetDefinition | null {
  const normalizedPresetId = normalizeContractRunnerPresetId(presetId);
  if (!normalizedPresetId) return null;

  return listContractRunnerPresetDefinitions().find((preset) => preset.presetId === normalizedPresetId) || null;
}

export function resolveContractRunnerPresetTargets(
  preset: ContractRunnerPresetDefinition,
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
    const normalized = normalizeContractRunnerTargetPathForPolicy(preset.targetPolicy.mode, item);
    if (!normalized) {
      invalidTargets.push(String(item || ''));
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    targets.push(normalized);
  }

  return {
    targets,
    invalidTargets,
  };
}
