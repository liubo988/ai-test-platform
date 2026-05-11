import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const BUSINESS_TO_ORDER_FIXTURE_VERSION = 1;
export const BUSINESS_TO_ORDER_FIXTURE_FAMILY = 'business_to_order';

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
    `new-intent.${projectUid}.${BUSINESS_TO_ORDER_FIXTURE_FAMILY}.default`;
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
  const safeKey = sanitizeSegment(idempotencyKey, `${BUSINESS_TO_ORDER_FIXTURE_FAMILY}-default`);
  const stateDir = path.join(resolveFixtureStateRoot(), safeProjectUid, BUSINESS_TO_ORDER_FIXTURE_FAMILY);

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

function shortFingerprint(value) {
  return createHash('sha1').update(normalizeString(value)).digest('hex').slice(0, 8);
}

export function buildBusinessToOrderSeed(state, existingSeed = null) {
  if (existingSeed && typeof existingSeed === 'object' && !Array.isArray(existingSeed)) {
    return existingSeed;
  }

  const suffix = shortFingerprint([state.projectUid, state.moduleUid, state.idempotencyKey, state.runId].join('\n'));
  return {
    contactName: normalizeString(process.env.INTENT_E2E_FIXTURE_CONTACT_NAME) || `转订单商机${suffix}`,
    contactPhone: normalizeString(process.env.INTENT_E2E_FIXTURE_CONTACT_PHONE) || `198${suffix.slice(0, 8).replace(/[a-f]/gi, '7')}`,
    sourceChannel: normalizeString(process.env.INTENT_E2E_FIXTURE_SOURCE_CHANNEL) || '抖音',
    gender: normalizeString(process.env.INTENT_E2E_FIXTURE_GENDER) || '男',
    companyKeyword: normalizeString(process.env.INTENT_E2E_FIXTURE_COMPANY_KEYWORD) || '中铁上海工程局集团有限公司',
    companyName:
      normalizeString(process.env.INTENT_E2E_FIXTURE_COMPANY_NAME) || '中铁上海工程局集团有限公司(91310000566528939E)',
    productName: normalizeString(process.env.INTENT_E2E_FIXTURE_PRODUCT_NAME) || '疑难工商注销',
    createOrderApi: normalizeString(process.env.INTENT_E2E_FIXTURE_CREATE_ORDER_API) || '/crmapi/business/createOrder',
    orderDrawerTitle: normalizeString(process.env.INTENT_E2E_FIXTURE_ORDER_DRAWER_TITLE) || '确定订单信息',
  };
}

export function buildBusinessToOrderContract(state, seed) {
  return {
    scenarioId: 'business.create-to-order',
    targetRoutes: {
      list: '/business/businesslist',
      create: '/business/createbusiness',
    },
    setupMode: 'unique_business_and_order_contract_state_only',
    seed,
    requiredStableIdentifiers: ['businessId', 'orderId', 'contactPhone', 'contactName'],
    requiredFields: [
      'targetUrl includes /business/businesslist or /business/createbusiness',
      'created business can be searched by businessId or contactPhone before generating order',
      'row action includes 生成订单 for the target business row',
      'createOrder response is observable',
      'order confirmation drawer closes or reaches a stable result surface',
    ],
    requiredEvidence: [
      'business_create_submission_success_or_existing_target_business_identity',
      'target_business_row_resolved_before_create_order',
      'create_order_response_ok',
      'order_drawer_closed_or_stable_surface',
    ],
    cleanupPolicy:
      'cleanup records fixture state and manual cleanup identifiers only; business/order deletion or abandonment requires a separate project-approved remote cleanup adapter.',
    manualCleanupHint:
      'Use captured businessId, orderId, contactPhone, contactName, and createdAt to locate UAT business/order data if business-side cleanup is required.',
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
