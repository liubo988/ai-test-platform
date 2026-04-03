export const INTENT_E2E_ENVIRONMENT_PROFILES = ['dev', 'test', 'uat', 'staging'] as const;
export type IntentE2EEnvironmentProfile = (typeof INTENT_E2E_ENVIRONMENT_PROFILES)[number];

export const INTENT_E2E_ACCOUNT_SESSION_MODES = ['shared', 'isolated'] as const;
export type IntentE2EAccountSessionMode = (typeof INTENT_E2E_ACCOUNT_SESSION_MODES)[number];

export const INTENT_E2E_FIXTURE_STRATEGIES = ['none', 'idempotent', 'setup_cleanup'] as const;
export type IntentE2EFixtureStrategy = (typeof INTENT_E2E_FIXTURE_STRATEGIES)[number];

export type IntentE2ECredentialReferenceSource = 'request' | 'project';

export interface IntentE2ECredentialReference {
  source?: IntentE2ECredentialReferenceSource;
  secretRef?: string;
  accountRef?: string;
  sessionMode?: IntentE2EAccountSessionMode;
}

export interface IntentE2EFixtureGovernance {
  strategy?: IntentE2EFixtureStrategy;
  setupRef?: string;
  cleanupRef?: string;
  owner?: string;
  idempotencyKey?: string;
}

export interface IntentE2ERuntimeGovernance {
  environmentProfile?: IntentE2EEnvironmentProfile;
  credential?: IntentE2ECredentialReference;
  fixture?: IntentE2EFixtureGovernance;
}

export interface IntentE2ERuntimeGovernanceIssue {
  code:
    | 'environment_profile_missing'
    | 'credential_ref_missing'
    | 'shared_account_ref_missing'
    | 'fixture_contract_missing'
    | 'fixture_owner_missing'
    | 'fixture_idempotency_key_missing'
    | 'fixture_setup_ref_missing'
    | 'fixture_cleanup_ref_missing'
    | 'fixture_setup_ref_invalid'
    | 'fixture_cleanup_ref_invalid';
  message: string;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRefSegment(value: string, fallback: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized ? encodeURIComponent(normalized) : fallback;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const normalized = normalizeString(value).toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : undefined;
}

function hasCredentialFields(value?: IntentE2ECredentialReference | null): boolean {
  if (!value) return false;
  return Boolean(value.source || value.secretRef || value.accountRef || value.sessionMode);
}

function hasFixtureFields(value?: IntentE2EFixtureGovernance | null): boolean {
  if (!value) return false;
  return Boolean(value.strategy || value.setupRef || value.cleanupRef || value.owner || value.idempotencyKey);
}

export function isIntentE2EFixtureRef(value: unknown): boolean {
  const normalized = normalizeString(value);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'fixture:') return false;
    if (!parsed.hostname.trim()) return false;
    if (parsed.search || parsed.hash) return false;
    const segments = [parsed.hostname, ...parsed.pathname.split('/').filter(Boolean)].map((segment) => decodeURIComponent(segment));
    return segments.every((segment) => /^[A-Za-z0-9._-]+$/.test(segment));
  } catch {
    return false;
  }
}

export function hasIntentE2EFixtureContract(value?: IntentE2EFixtureGovernance | null): boolean {
  return hasFixtureFields(value);
}

export function hasIntentE2ERuntimeGovernance(value?: IntentE2ERuntimeGovernance | null): boolean {
  if (!value) return false;
  return Boolean(value.environmentProfile || hasCredentialFields(value.credential) || hasFixtureFields(value.fixture));
}

export function cloneIntentE2ERuntimeGovernance(
  value?: IntentE2ERuntimeGovernance | null
): IntentE2ERuntimeGovernance | undefined {
  if (!hasIntentE2ERuntimeGovernance(value)) return undefined;

  return {
    environmentProfile: value?.environmentProfile,
    credential: hasCredentialFields(value?.credential)
      ? {
          source: value?.credential?.source,
          secretRef: value?.credential?.secretRef,
          accountRef: value?.credential?.accountRef,
          sessionMode: value?.credential?.sessionMode,
        }
      : undefined,
    fixture: hasFixtureFields(value?.fixture)
      ? {
          strategy: value?.fixture?.strategy,
          setupRef: value?.fixture?.setupRef,
          cleanupRef: value?.fixture?.cleanupRef,
          owner: value?.fixture?.owner,
          idempotencyKey: value?.fixture?.idempotencyKey,
        }
      : undefined,
  };
}

export function normalizeIntentE2ERuntimeGovernance(value: unknown): IntentE2ERuntimeGovernance | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const credentialRecord =
    record.credential && typeof record.credential === 'object' && !Array.isArray(record.credential)
      ? (record.credential as Record<string, unknown>)
      : null;
  const fixtureRecord =
    record.fixture && typeof record.fixture === 'object' && !Array.isArray(record.fixture)
      ? (record.fixture as Record<string, unknown>)
      : null;

  const credential: IntentE2ECredentialReference | undefined = credentialRecord
    ? {
        source: normalizeEnum(credentialRecord.source, ['request', 'project'] as const),
        secretRef: normalizeString(credentialRecord.secretRef) || undefined,
        accountRef: normalizeString(credentialRecord.accountRef) || undefined,
        sessionMode: normalizeEnum(credentialRecord.sessionMode, INTENT_E2E_ACCOUNT_SESSION_MODES),
      }
    : undefined;

  const fixture: IntentE2EFixtureGovernance | undefined = fixtureRecord
    ? {
        strategy: normalizeEnum(fixtureRecord.strategy, INTENT_E2E_FIXTURE_STRATEGIES) || undefined,
        setupRef: normalizeString(fixtureRecord.setupRef) || undefined,
        cleanupRef: normalizeString(fixtureRecord.cleanupRef) || undefined,
        owner: normalizeString(fixtureRecord.owner) || undefined,
        idempotencyKey: normalizeString(fixtureRecord.idempotencyKey) || undefined,
      }
    : undefined;

  const normalized: IntentE2ERuntimeGovernance = {
    environmentProfile: normalizeEnum(record.environmentProfile, INTENT_E2E_ENVIRONMENT_PROFILES),
    credential: hasCredentialFields(credential) ? credential : undefined,
    fixture: hasFixtureFields(fixture) ? fixture : undefined,
  };

  return hasIntentE2ERuntimeGovernance(normalized) ? normalized : undefined;
}

export function mergeIntentE2ERuntimeGovernance(
  base?: IntentE2ERuntimeGovernance,
  override?: IntentE2ERuntimeGovernance
): IntentE2ERuntimeGovernance | undefined {
  const merged: IntentE2ERuntimeGovernance = {
    environmentProfile: override?.environmentProfile || base?.environmentProfile,
    credential:
      hasCredentialFields(base?.credential) || hasCredentialFields(override?.credential)
        ? {
            ...(base?.credential || {}),
            ...(override?.credential || {}),
          }
        : undefined,
    fixture:
      hasFixtureFields(base?.fixture) || hasFixtureFields(override?.fixture)
        ? {
            ...(base?.fixture || {}),
            ...(override?.fixture || {}),
          }
        : undefined,
  };

  return hasIntentE2ERuntimeGovernance(merged) ? merged : undefined;
}

export function shouldEnforceIntentE2ERuntimeGovernance(governance?: IntentE2ERuntimeGovernance): boolean {
  if (!hasIntentE2ERuntimeGovernance(governance)) return false;
  if (governance?.environmentProfile) return true;

  const fixture = governance?.fixture;
  if (fixture && (fixture.strategy && fixture.strategy !== 'none')) {
    return true;
  }
  if (hasIntentE2EFixtureContract(fixture)) {
    return true;
  }

  const credential = governance?.credential;
  if (!credential) return false;
  if (credential.source === 'project' && credential.secretRef && !credential.accountRef && !credential.sessionMode) {
    return false;
  }

  return Boolean(credential.secretRef || credential.accountRef || credential.sessionMode || credential.source === 'request');
}

export function buildIntentE2EProjectCredentialRef(projectUid: string): string {
  return `project://${projectUid.trim()}/auth/default`;
}

export function buildIntentE2EProjectAccountRef(projectUid: string, loginUsername = ''): string {
  return `account://project/${normalizeRefSegment(projectUid, 'project')}/${normalizeRefSegment(loginUsername, 'default-auth')}`;
}

export function buildIntentE2EProjectFixtureOwnerRef(projectUid: string, actorUserUid = ''): string {
  return `owner://project/${normalizeRefSegment(projectUid, 'project')}/members/${normalizeRefSegment(actorUserUid, 'workspace-user')}`;
}

export function validateIntentE2ERuntimeGovernance(input: {
  governance?: IntentE2ERuntimeGovernance;
  hasAuth: boolean;
  requiresFixture: boolean;
}): IntentE2ERuntimeGovernanceIssue[] {
  if (!shouldEnforceIntentE2ERuntimeGovernance(input.governance)) {
    return [];
  }

  const governance = input.governance;
  const issues: IntentE2ERuntimeGovernanceIssue[] = [];

  if (!governance?.environmentProfile) {
    issues.push({
      code: 'environment_profile_missing',
      message: '缺少 environmentProfile；请显式标明当前运行环境（dev / test / uat / staging）。',
    });
  }

  if (input.hasAuth) {
    if (!governance?.credential?.secretRef) {
      issues.push({
        code: 'credential_ref_missing',
        message: '当前运行包含登录凭证，但未提供 credential.secretRef；请改为凭证引用而不是继续依赖隐式明文配置。',
      });
    }

    const sessionMode = governance?.credential?.sessionMode || 'shared';
    if (sessionMode === 'shared' && !governance?.credential?.accountRef && governance?.credential?.source !== 'project') {
      issues.push({
        code: 'shared_account_ref_missing',
        message: '当前凭证使用 shared session，但未提供 credential.accountRef；账号池 / 会话归属不可追踪。',
      });
    }
  }

  const fixture = governance?.fixture;
  const fixtureStrategy = fixture?.strategy || 'none';

  if (input.requiresFixture && (!fixture || fixtureStrategy === 'none')) {
    issues.push({
      code: 'fixture_contract_missing',
      message: '当前流程看起来会写入或污染业务数据，但未提供 fixture contract；请至少声明 fixture.strategy、owner 与 idempotencyKey。',
    });
  }

  if (fixture && fixtureStrategy !== 'none') {
    if (!fixture.owner) {
      issues.push({
        code: 'fixture_owner_missing',
        message: '缺少 fixture.owner；测试数据归属不可追踪。',
      });
    }

    if (!fixture.idempotencyKey) {
      issues.push({
        code: 'fixture_idempotency_key_missing',
        message: '缺少 fixture.idempotencyKey；当前 run 无法证明幂等与回收隔离。',
      });
    }
  }

  if (fixtureStrategy === 'setup_cleanup') {
    if (!fixture?.setupRef) {
      issues.push({
        code: 'fixture_setup_ref_missing',
        message: 'fixture.strategy = setup_cleanup 时必须提供 fixture.setupRef。',
      });
    }

    if (!fixture?.cleanupRef) {
      issues.push({
        code: 'fixture_cleanup_ref_missing',
        message: 'fixture.strategy = setup_cleanup 时必须提供 fixture.cleanupRef。',
      });
    }
  }

  if (fixture?.setupRef && !isIntentE2EFixtureRef(fixture.setupRef)) {
    issues.push({
      code: 'fixture_setup_ref_invalid',
      message: 'fixture.setupRef 只支持 repo-owned 的 fixture:// 引用，不允许任意自由脚本或其它协议。',
    });
  }

  if (fixture?.cleanupRef && !isIntentE2EFixtureRef(fixture.cleanupRef)) {
    issues.push({
      code: 'fixture_cleanup_ref_invalid',
      message: 'fixture.cleanupRef 只支持 repo-owned 的 fixture:// 引用，不允许任意自由脚本或其它协议。',
    });
  }

  return issues;
}
