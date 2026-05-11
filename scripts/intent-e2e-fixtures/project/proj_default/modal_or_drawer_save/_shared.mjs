import fs from 'node:fs/promises';
import path from 'node:path';

export const MODAL_OR_DRAWER_SAVE_FIXTURE_VERSION = 1;
export const MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY = 'modal_or_drawer_save';
export const MODAL_OR_DRAWER_SAVE_REMOTE_RECOVERY_ADAPTER_REF =
  'fixture://project/proj_default/modal_or_drawer_save/remote-restore';

export function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function sanitizeSegment(value, fallback) {
  const normalized = normalizeString(value)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function readFixtureContext() {
  const raw = normalizeString(process.env.INTENT_E2E_FIXTURE_CONTEXT);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function resolveFixtureStateRoot() {
  return normalizeString(process.env.INTENT_E2E_FIXTURE_STATE_ROOT) || path.join(process.cwd(), 'reports', 'intent-e2e', 'fixtures');
}

export function resolveFixtureState(input = {}) {
  const context = readFixtureContext();
  const projectUid =
    normalizeString(input.projectUid) ||
    normalizeString(process.env.INTENT_E2E_FIXTURE_PROJECT_UID) ||
    normalizeString(context.projectUid) ||
    'proj_default';
  const moduleUid =
    normalizeString(input.moduleUid) ||
    normalizeString(process.env.INTENT_E2E_FIXTURE_MODULE_UID) ||
    normalizeString(context.moduleUid);
  const targetUrl =
    normalizeString(input.targetUrl) ||
    normalizeString(process.env.INTENT_E2E_FIXTURE_TARGET_URL) ||
    normalizeString(context.targetUrl);
  const runId =
    normalizeString(input.runId) ||
    normalizeString(process.env.INTENT_E2E_FIXTURE_RUN_ID) ||
    normalizeString(context.runId);
  const owner =
    normalizeString(input.owner) ||
    normalizeString(process.env.INTENT_E2E_FIXTURE_OWNER) ||
    normalizeString(context.owner) ||
    `owner://project/${projectUid}/members/workspace-user`;
  const idempotencyKey =
    normalizeString(input.idempotencyKey) ||
    normalizeString(process.env.INTENT_E2E_FIXTURE_IDEMPOTENCY_KEY) ||
    normalizeString(context.idempotencyKey) ||
    `new-intent.${projectUid}.${MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY}.default`;
  const strategy =
    normalizeString(input.strategy) ||
    normalizeString(process.env.INTENT_E2E_FIXTURE_STRATEGY) ||
    normalizeString(context.strategy) ||
    'setup_cleanup';
  const fixtureRef =
    normalizeString(input.fixtureRef) ||
    normalizeString(process.env.INTENT_E2E_FIXTURE_REF) ||
    normalizeString(context.fixtureRef);
  const safeProjectUid = sanitizeSegment(projectUid, 'proj_default');
  const safeKey = sanitizeSegment(idempotencyKey, `${MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY}-default`);
  const stateDir = path.join(resolveFixtureStateRoot(), safeProjectUid, MODAL_OR_DRAWER_SAVE_FIXTURE_FAMILY);

  return {
    context,
    projectUid,
    moduleUid,
    targetUrl,
    runId,
    owner,
    idempotencyKey,
    strategy,
    fixtureRef,
    stateDir,
    statePath: path.join(stateDir, `${safeKey}.json`),
    latestPath: path.join(stateDir, 'latest.json'),
    cleanupPath: path.join(stateDir, `${safeKey}.cleanup.json`),
  };
}

export function resolveRemoteRecoveryMode() {
  const explicitMode = normalizeString(process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE).toLowerCase();
  if (explicitMode === 'snapshot_restore' || explicitMode === 'contract_only' || explicitMode === 'off') {
    return explicitMode;
  }

  if (/^(1|true|yes|on)$/i.test(normalizeString(process.env.INTENT_E2E_FIXTURE_ENABLE_REMOTE_RESTORE))) {
    return 'snapshot_restore';
  }

  return 'contract_only';
}

export function isRemoteRecoveryEnabled() {
  return resolveRemoteRecoveryMode() === 'snapshot_restore';
}

export function buildRemoteRecoveryContract(contract) {
  const mode = resolveRemoteRecoveryMode();
  const isServiceCommission = contract?.scenarioId === 'commission.service-ratio-config';

  return {
    adapterRef: MODAL_OR_DRAWER_SAVE_REMOTE_RECOVERY_ADAPTER_REF,
    mode,
    status: mode === 'snapshot_restore' ? 'enabled' : mode === 'off' ? 'disabled' : 'contract_ready',
    scenarioId: contract?.scenarioId || '',
    canMutateRemote: mode === 'snapshot_restore' && isServiceCommission,
    snapshotPhase: 'setup',
    restorePhase: 'cleanup',
    requiredEnv:
      mode === 'snapshot_restore'
        ? [
            'INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE=snapshot_restore',
            'INTENT_E2E_FIXTURE_STORAGE_STATE=<authenticated Playwright storage state>',
          ]
        : ['INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE=snapshot_restore'],
    requiredStableIdentifiers: ['searchKeyword', 'targetServiceName', 'targetRole'],
    restoreValueSource: 'setup.remoteRecovery.snapshot.ratioValue',
    unsupportedReason: isServiceCommission
      ? ''
      : 'remote restore adapter currently supports only commission.service-ratio-config.',
  };
}

function includesTargetUrl(targetUrl, pattern) {
  return normalizeString(targetUrl).toLowerCase().includes(pattern.toLowerCase());
}

export function buildModalOrDrawerSaveContract(targetUrl) {
  if (includesTargetUrl(targetUrl, '/commission/subcommissionconfig')) {
    return {
      scenarioId: 'commission.service-ratio-config',
      targetRoute: '/commission/subCommissionConfig',
      setupMode: 'reference_existing_service_row',
      searchKeyword: normalizeString(process.env.INTENT_E2E_FIXTURE_SEARCH_KEYWORD) || '379',
      targetServiceName: normalizeString(process.env.INTENT_E2E_FIXTURE_TARGET_SERVICE_NAME) || '商务礼仪培训',
      targetRole: normalizeString(process.env.INTENT_E2E_FIXTURE_TARGET_ROLE) || '商机创建人',
      targetRatio: normalizeString(process.env.INTENT_E2E_FIXTURE_TARGET_RATIO),
      requiredStableIdentifiers: ['searchKeyword', 'targetServiceName', 'targetRole', 'targetRatio'],
      requiredFields: [
        'targetUrl includes /commission/subCommissionConfig',
        'keyword input #service-data-item_keyWord is visible',
        'searchKeyword returns a service row',
        'row action label includes 分佣配置',
        'visible modal title includes 服务分佣配置',
        'targetRole row has an editable ratio input',
      ],
      requiredEvidence: [
        'service_row_matched_by_search_keyword',
        'visible_modal_title_includes_service_commission_config',
        'setup_snapshot_previous_role_ratio_when_remote_recovery_enabled',
        'role_ratio_input_updated_or_retained',
        'success_toast_or_modal_closed_or_target_value_retained',
        'cleanup_restores_previous_role_ratio_when_remote_recovery_enabled',
      ],
      cleanupPolicy:
        'cleanup records fixture state by default; when remote recovery mode is snapshot_restore and an authenticated storage state is provided, setup snapshots the previous role ratio and cleanup restores it through the UI.',
    };
  }

  return {
    scenarioId: 'generic.modal-or-drawer-save',
    targetRoute: '',
    setupMode: 'contract_state_only',
    searchKeyword: '',
    targetServiceName: '',
    targetRole: '',
    targetRatio: '',
    requiredStableIdentifiers: ['recordId', 'customerCode', 'businessId', 'contactPhone', 'contactName', 'name'],
    requiredFields: [
      'stable path to open a visible modal or drawer',
      'scoped editable fields inside the visible modal or drawer',
      'observable submit response or submit-state convergence',
      'container closed or page returned to a stable surface',
    ],
    requiredEvidence: ['submit_response', 'container_closed_or_stable_surface'],
    cleanupPolicy:
      'cleanup records fixture state only; scenario-specific setup should add a remote cleanup adapter before mutating shared business data.',
  };
}

export async function readJsonFileIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
