import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const BUSINESS_CREATE_LIST_VERIFY_FIXTURE_VERSION = 1;
export const BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY = 'business_create_list_verify';

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
    `new-intent.${projectUid}.${BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY}.default`;
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
  const safeKey = sanitizeSegment(idempotencyKey, `${BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY}-default`);
  const stateDir = path.join(resolveFixtureStateRoot(), safeProjectUid, BUSINESS_CREATE_LIST_VERIFY_FIXTURE_FAMILY);

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

export function buildBusinessCreateListSeed(state, existingSeed = null) {
  if (existingSeed && typeof existingSeed === 'object' && !Array.isArray(existingSeed)) {
    return existingSeed;
  }

  const suffix = shortFingerprint([state.projectUid, state.moduleUid, state.idempotencyKey, state.runId].join('\n'));
  return {
    contactName: normalizeString(process.env.INTENT_E2E_FIXTURE_CONTACT_NAME) || `自动化商机${suffix}`,
    contactPhone: normalizeString(process.env.INTENT_E2E_FIXTURE_CONTACT_PHONE) || `199${suffix.slice(0, 8).replace(/[a-f]/gi, '8')}`,
    sourceChannel: normalizeString(process.env.INTENT_E2E_FIXTURE_SOURCE_CHANNEL) || '抖音',
    gender: normalizeString(process.env.INTENT_E2E_FIXTURE_GENDER) || '男',
    companyKeyword: normalizeString(process.env.INTENT_E2E_FIXTURE_COMPANY_KEYWORD) || '中铁上海工程局集团有限公司',
    companyName:
      normalizeString(process.env.INTENT_E2E_FIXTURE_COMPANY_NAME) || '中铁上海工程局集团有限公司(91310000566528939E)',
    productName: normalizeString(process.env.INTENT_E2E_FIXTURE_PRODUCT_NAME) || '疑难工商注销',
    expectedStage: normalizeString(process.env.INTENT_E2E_FIXTURE_EXPECTED_STAGE) || '新入库',
    ownershipView: normalizeString(process.env.INTENT_E2E_FIXTURE_OWNERSHIP_VIEW) || '我创建的',
  };
}

export function buildBusinessCreateListVerifyContract(state, seed) {
  return {
    scenarioId: 'business.create-list-verify',
    targetRoutes: {
      list: '/business/businesslist',
      create: '/business/createbusiness',
    },
    setupMode: 'unique_seed_contract_state_only',
    seed,
    requiredStableIdentifiers: ['contactPhone', 'contactName', 'companyName', 'productName', 'businessId'],
    requiredFields: [
      'targetUrl includes /business/businesslist or /business/createbusiness',
      'business list keyword input #businessList_keywords is visible',
      'create entry label includes 新建商机',
      'create form exposes 商机来源 / 商机联系人信息 / 关联产品意向信息',
      'created record can be searched in 我创建的 list by contactPhone or businessId',
    ],
    requiredEvidence: [
      'business_create_submission_success_or_create_response_ok',
      'created_business_key_extracted_from_response_or_unique_contact_phone',
      'business_list_ownership_switched_to_my_created',
      'created_record_found_by_business_id_or_contact_phone',
      'created_record_stage_equals_new_entry',
    ],
    cleanupPolicy:
      'cleanup records fixture state and manual cleanup identifiers only; business record deletion or abandonment requires a separate project-approved remote cleanup adapter.',
    manualCleanupHint:
      'Use the captured businessId, contactPhone, contactName, and createdAt to locate the UAT business record if business-side cleanup is required.',
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
