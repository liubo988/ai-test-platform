import fs from 'node:fs';
import path from 'node:path';
import {
  cloneIntentE2ERuntimeGovernance,
  mergeIntentE2ERuntimeGovernance,
  normalizeIntentE2ERuntimeGovernance,
  type IntentE2ERuntimeGovernance,
} from '@/lib/intent-e2e-runtime-governance';
import { normalizeIntentProjectUid, resolveProjectScopedIntentAssetPath } from '@/lib/intent-project-knowledge';

export interface IntentProjectRuntimeGovernanceManifest extends IntentE2ERuntimeGovernance {
  version: 1;
}

export interface IntentProjectRuntimeGovernanceIssue {
  code:
    | 'manifest_missing'
    | 'manifest_invalid'
    | 'environment_profile_missing'
    | 'shared_account_ref_missing'
    | 'fixture_strategy_missing'
    | 'fixture_owner_missing'
    | 'fixture_idempotency_key_missing'
    | 'fixture_setup_ref_missing'
    | 'fixture_cleanup_ref_missing';
  message: string;
}

export interface IntentProjectRuntimeGovernanceStatus {
  projectUid: string;
  path: string;
  exists: boolean;
  valid: boolean;
  ready: boolean;
  hasEnvironmentProfile: boolean;
  hasCredentialDefaults: boolean;
  hasFixtureDefaults: boolean;
  issues: IntentProjectRuntimeGovernanceIssue[];
  manifest: IntentProjectRuntimeGovernanceManifest | null;
}

const DEFAULT_PROJECT_RUNTIME_GOVERNANCE_FILE_NAME = 'intent-e2e.project-runtime-governance.json';

function toDisplayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (!relative || relative.startsWith('..')) return filePath;
  return relative;
}

function normalizeIntentProjectRuntimeGovernanceManifest(raw: unknown): IntentProjectRuntimeGovernanceManifest | null {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!source) return null;

  const governance = normalizeIntentE2ERuntimeGovernance(source);
  if (!governance) return null;

  return {
    version: 1,
    ...governance,
  };
}

function hasCredentialDefaults(manifest: IntentProjectRuntimeGovernanceManifest | null): boolean {
  const credential = manifest?.credential;
  return Boolean(credential?.source || credential?.secretRef || credential?.accountRef || credential?.sessionMode);
}

function hasFixtureDefaults(manifest: IntentProjectRuntimeGovernanceManifest | null): boolean {
  const fixture = manifest?.fixture;
  return Boolean(fixture?.strategy || fixture?.setupRef || fixture?.cleanupRef || fixture?.owner || fixture?.idempotencyKey);
}

function createStatus(input: {
  projectUid: string;
  path: string;
  exists: boolean;
  valid: boolean;
  manifest: IntentProjectRuntimeGovernanceManifest | null;
  issues?: IntentProjectRuntimeGovernanceIssue[];
}): IntentProjectRuntimeGovernanceStatus {
  const manifest = input.manifest;
  const issues = input.issues ? [...input.issues] : [];

  return {
    projectUid: input.projectUid,
    path: input.path,
    exists: input.exists,
    valid: input.valid,
    ready: input.exists && input.valid && issues.length === 0,
    hasEnvironmentProfile: Boolean(manifest?.environmentProfile),
    hasCredentialDefaults: hasCredentialDefaults(manifest),
    hasFixtureDefaults: hasFixtureDefaults(manifest),
    issues,
    manifest,
  };
}

function collectIntentProjectRuntimeGovernanceIssues(
  manifest: IntentProjectRuntimeGovernanceManifest
): IntentProjectRuntimeGovernanceIssue[] {
  const issues: IntentProjectRuntimeGovernanceIssue[] = [];

  if (!manifest.environmentProfile) {
    issues.push({
      code: 'environment_profile_missing',
      message: 'project runtime governance 缺少 environmentProfile；当前项目默认运行环境还没有固定下来。',
    });
  }

  if (manifest.credential?.sessionMode === 'shared' && !manifest.credential.accountRef) {
    issues.push({
      code: 'shared_account_ref_missing',
      message: 'project runtime governance 使用 shared session，但缺少 credential.accountRef；账号归属不可追踪。',
    });
  }

  const fixture = manifest.fixture;
  const fixtureStrategy = fixture?.strategy || '';
  const hasFixtureContractFields = Boolean(fixture?.setupRef || fixture?.cleanupRef || fixture?.owner || fixture?.idempotencyKey);

  if (hasFixtureContractFields && (!fixtureStrategy || fixtureStrategy === 'none')) {
    issues.push({
      code: 'fixture_strategy_missing',
      message: 'project runtime governance 填了 fixture 字段，但缺少有效的 fixture.strategy；默认数据治理策略不完整。',
    });
  }

  if (fixtureStrategy && fixtureStrategy !== 'none' && !fixture?.owner) {
    issues.push({
      code: 'fixture_owner_missing',
      message: 'project runtime governance 缺少 fixture.owner；测试数据归属不可追踪。',
    });
  }

  if (fixtureStrategy && fixtureStrategy !== 'none' && !fixture?.idempotencyKey) {
    issues.push({
      code: 'fixture_idempotency_key_missing',
      message: 'project runtime governance 缺少 fixture.idempotencyKey；默认数据流无法证明幂等隔离。',
    });
  }

  if (fixtureStrategy === 'setup_cleanup' && !fixture?.setupRef) {
    issues.push({
      code: 'fixture_setup_ref_missing',
      message: 'project runtime governance 的 fixture.strategy = setup_cleanup，但缺少 fixture.setupRef。',
    });
  }

  if (fixtureStrategy === 'setup_cleanup' && !fixture?.cleanupRef) {
    issues.push({
      code: 'fixture_cleanup_ref_missing',
      message: 'project runtime governance 的 fixture.strategy = setup_cleanup，但缺少 fixture.cleanupRef。',
    });
  }

  return issues;
}

export function getIntentProjectRuntimeGovernancePath(projectUid = ''): string {
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid);
  if (!normalizedProjectUid) return '';
  return toDisplayPath(
    resolveProjectScopedIntentAssetPath(normalizedProjectUid, DEFAULT_PROJECT_RUNTIME_GOVERNANCE_FILE_NAME)
  );
}

export function readIntentProjectRuntimeGovernanceStatus(projectUid = ''): IntentProjectRuntimeGovernanceStatus {
  const normalizedProjectUid = normalizeIntentProjectUid(projectUid);
  if (!normalizedProjectUid) {
    return createStatus({
      projectUid: '',
      path: '',
      exists: false,
      valid: false,
      manifest: null,
    });
  }

  const absolutePath = resolveProjectScopedIntentAssetPath(normalizedProjectUid, DEFAULT_PROJECT_RUNTIME_GOVERNANCE_FILE_NAME);
  const displayPath = toDisplayPath(absolutePath);
  if (!fs.existsSync(absolutePath)) {
    return createStatus({
      projectUid: normalizedProjectUid,
      path: displayPath,
      exists: false,
      valid: false,
      issues: [
        {
          code: 'manifest_missing',
          message: '缺少 project runtime governance manifest；当前项目还没有默认环境 / 账号 / 数据治理声明。',
        },
      ],
      manifest: null,
    });
  }

  try {
    const manifest = normalizeIntentProjectRuntimeGovernanceManifest(JSON.parse(fs.readFileSync(absolutePath, 'utf8')));
    if (!manifest) {
      return createStatus({
        projectUid: normalizedProjectUid,
        path: displayPath,
        exists: true,
        valid: false,
        issues: [
          {
            code: 'manifest_invalid',
            message: 'project runtime governance manifest 格式无效；无法归一化成受支持的治理字段。',
          },
        ],
        manifest: null,
      });
    }

    return createStatus({
      projectUid: normalizedProjectUid,
      path: displayPath,
      exists: true,
      valid: true,
      issues: collectIntentProjectRuntimeGovernanceIssues(manifest),
      manifest,
    });
  } catch {
    return createStatus({
      projectUid: normalizedProjectUid,
      path: displayPath,
      exists: true,
      valid: false,
      issues: [
        {
          code: 'manifest_invalid',
          message: 'project runtime governance manifest 解析失败；请检查 JSON 格式。',
        },
      ],
      manifest: null,
    });
  }
}

export function readIntentProjectRuntimeGovernance(projectUid = ''): IntentE2ERuntimeGovernance | undefined {
  return cloneIntentE2ERuntimeGovernance(readIntentProjectRuntimeGovernanceStatus(projectUid).manifest);
}

export function resolveIntentProjectRuntimeGovernance(
  projectUid = '',
  override?: IntentE2ERuntimeGovernance
): IntentE2ERuntimeGovernance | undefined {
  return mergeIntentE2ERuntimeGovernance(readIntentProjectRuntimeGovernance(projectUid), override);
}
