import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

const PROJECT_UID = 'proj_default';
const PROJECT_NAME = '测试环境';
const MODULE_NAME = '商机管理';
const TASK_NAME = '商机列表批量加入通讯录并校验结果';
const TARGET_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
const MAILS_LIST_URL = 'https://uat-service.yikaiye.com/#/mails/mailslist';
const CAPABILITY_SLUG = 'composite.business-list-batch-add-contacts';
const CAPABILITY_NAME = '商机列表批量加入通讯录并校验结果';
const LEGACY_CAPABILITY_UID = 'cap_1773317058897_8ff59b9d';
const LEGACY_CAPABILITY_SLUG = 'action.business-businesslist.zcuv6y';
const ACTOR_LABEL = 'Codex';
const VERIFIED_PLAN_UID = 'plan_1773315882486_12545c87';
const VERIFIED_EXECUTION_UID = 'exec_1773315898101_50b3bb32';
const VERIFIED_PLAN_VERSION = 16;
const VERIFIED_AT = '2026-03-12T11:44:58.101Z';

const FEATURE_DESCRIPTION =
  '进入商机列表页；若当前筛选结果为空，则切换到当前有数量的商机进展阶段后，再随机勾选一条包含联系人手机号的商机并点击【批量加入通讯录】按钮。操作完成后进入【我的通讯录】列表，使用该商机联系人手机号进行搜索，并校验可以查询到对应联系人记录。若页面提示“已存在您的通讯录”或类似提示，也视为符合预期，但最终仍需以通讯录列表中能检索到该手机号作为成功判定。';

const FLOW_DEFINITION = {
  version: 1,
  entryUrl: TARGET_URL,
  sharedVariables: ['businessId', 'contactPhone', 'feedbackText'],
  expectedOutcome:
    '在商机列表随机勾选一条包含联系人手机号的商机后，可批量加入通讯录；无论页面反馈是成功加入还是已存在，最终都应能在我的通讯录按手机号检索到该联系人。',
  cleanupNotes:
    '该业务流会真实写入 UAT 通讯录数据。记录联系人手机号、来源商机ID和执行时间；若需清理，请由业务侧按 UAT 规则手工删除通讯录联系人。',
  steps: [
    {
      stepUid: 'step-open-business-list',
      stepType: 'ui',
      title: '进入商机列表页并等待页面稳定',
      target: TARGET_URL,
      instruction: '登录后先等待首页初始化完成，再打开商机列表页，确认搜索框和“批量加入通讯录”按钮可见。',
      expectedResult: '页面稳定进入商机列表，可执行批量加入通讯录。',
      extractVariable: '',
    },
    {
      stepUid: 'step-pick-business-row',
      stepType: 'extract',
      title: '随机选择一条带手机号的商机',
      target: TARGET_URL,
      instruction: '若当前筛选结果为空，则切换到当前有数量的商机进展阶段；再从当前页前 10 条唯一手机号商机中随机选择一条，勾选对应复选框并记录 businessId、contactPhone。',
      expectedResult: '成功选中一条带联系人手机号的商机，且已拿到 businessId 与 contactPhone。',
      extractVariable: 'businessId,contactPhone',
    },
    {
      stepUid: 'step-batch-add-contacts',
      stepType: 'ui',
      title: '执行批量加入通讯录',
      target: TARGET_URL,
      instruction: '点击“批量加入通讯录”按钮，读取页面反馈文本，允许出现“已存在您的通讯录”或类似提示。',
      expectedResult: '页面给出通讯录相关反馈，不能仅依赖 toast 成功文案作为唯一通过条件。',
      extractVariable: 'feedbackText',
    },
    {
      stepUid: 'step-open-mails-list',
      stepType: 'ui',
      title: '进入我的通讯录列表',
      target: MAILS_LIST_URL,
      instruction: '打开我的通讯录列表，确认检索框可见。',
      expectedResult: '成功进入我的通讯录列表页面。',
      extractVariable: '',
    },
    {
      stepUid: 'step-search-contact-by-phone',
      stepType: 'assert',
      title: '按手机号检索并校验联系人可见',
      target: MAILS_LIST_URL,
      instruction: '使用 contactPhone 搜索通讯录，并校验结果中可以查到该手机号。',
      expectedResult: '我的通讯录列表中能检索到 contactPhone，对应联系人记录存在。',
      extractVariable: '',
    },
    {
      stepUid: 'step-record-contact-cleanup-info',
      stepType: 'cleanup',
      title: '记录通讯录清理信息',
      target: MAILS_LIST_URL,
      instruction: '记录 contactPhone、businessId 和执行时间，不在自动化里做删除，由业务侧按 UAT 规则手工清理。',
      expectedResult: '通讯录测试数据具备可追踪的人工清理凭据。',
      extractVariable: '',
    },
  ],
};

const PLAN_CASES = [
  {
    tier: 'simple',
    caseName: '简单流程：进入商机列表并触发批量加入通讯录',
    caseSteps: [
      `打开商机列表页 ${TARGET_URL}`,
      '等待搜索框和“批量加入通讯录”按钮稳定可见',
      '随机勾选一条包含联系人手机号的商机',
      '点击批量加入通讯录并观察页面反馈',
    ],
    expectedResult: '业务入口稳定可达，批量加入通讯录动作可以成功触发。',
    sortOrder: 10,
  },
  {
    tier: 'medium',
    caseName: '中等流程：允许已存在提示并进入我的通讯录校验',
    caseSteps: [
      '执行批量加入通讯录后读取页面反馈文本',
      '允许出现成功加入、已存在通讯录或未成功加入通讯录等反馈',
      `进入我的通讯录列表 ${MAILS_LIST_URL}`,
      '使用目标手机号搜索并确认结果存在',
    ],
    expectedResult: '不把 toast 成功文案当成唯一标准，而是以通讯录最终检索结果判定通过。',
    sortOrder: 20,
  },
  {
    tier: 'complex',
    caseName: '复杂流程：随机选取、真实写入与人工清理兜底',
    caseSteps: [
      '从当前页前 10 条唯一手机号商机中随机取一条，降低固化数据依赖',
      '记录来源商机ID和联系人手机号，确保真实写入后可追踪',
      '接受“已存在您的通讯录”这类历史数据分支',
      '记录执行时间，预留业务侧在 UAT 手工清理通讯录联系人',
    ],
    expectedResult: '真实写入通讯录的链路稳定，并具备明确的数据追踪与清理凭据。',
    sortOrder: 30,
  },
];

const GENERATED_CODE = String.raw`import { test, expect } from '@playwright/test';

test('商机列表-随机勾选一个商机并批量加入通讯录', async ({ page }) => {
  const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
  const BUSINESS_LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
  const MAILS_LIST_URL = 'https://uat-service.yikaiye.com/#/mails/mailslist';
  const USERNAME = process.env.E2E_USERNAME;
  const PASSWORD = process.env.E2E_PASSWORD;

  test.skip(!USERNAME || !PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD，无法执行短信验证码登录');

  let businessId = '';
  let contactPhone = '';
  let feedbackText = '';

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const smsTab = page.getByText(/短信验证码登录|短信登录/i).first();
  if (await smsTab.isVisible({ timeout: 10000 }).catch(() => false)) {
    await smsTab.click();
  }

  await page.getByPlaceholder(/请输入手机号|手机号|手机号码/i).first().fill(String(USERNAME).replace(/\s+/g, ''));
  await page.getByPlaceholder(/请输入验证码|验证码|获取验证码/i).first().fill(String(PASSWORD));
  await page.getByRole('button', { name: /登\s*录|登录|Login/i }).first().click();

  // 登录后先等待首页稳定，再切到商机列表，避免 hash 路由被首页初始化过程覆盖。
  await expect(page.getByRole('button', { name: '全部清除' })).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.goto(BUSINESS_LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.hash.includes('/business/businesslist'), { timeout: 30000 });
  await page.locator('#businessList_keywords').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('button', { name: '批量加入通讯录' }).waitFor({ state: 'visible', timeout: 30000 });
  const stageLabels = ['新入库', '需跟踪', '确认意向', '邀约成功', '面谈成功', '签约成功'];
  const normalizeRowText = (value) => value.replace(/\s+/g, ' ').trim();
  const escapeRegExp = (value) => value.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&');
  const collectPhones = (...sources) =>
    Array.from(
      new Set(
        sources
          .flatMap((source) => normalizeRowText(source).replace(/[^\d]/g, ' ').match(/1\d{10}/g) || [])
          .filter(Boolean)
      )
    );
  const extractBusinessId = (...sources) => {
    for (const source of sources) {
      const matches = normalizeRowText(source).replace(/[^\d]/g, ' ').match(/\b\d{6,12}\b/g) || [];
      const candidate = matches.find((item) => !/^1\d{10}$/.test(item));
      if (candidate) return candidate;
    }
    return '';
  };

  async function waitForRowsOrPlaceholder() {
    await page.waitForFunction(() => {
      const rowCount = document.querySelectorAll('.ant-table .ant-table-tbody > tr').length;
      return rowCount > 0 || Boolean(document.querySelector('.ant-table-placeholder'));
    }, { timeout: 30000 });
  }

  async function collectBusinessRows() {
    const rows = page.locator('.ant-table .ant-table-tbody > tr');
    const businessRows = [];
    const rowDebug = [];
    const seenPhones = new Set();
    const rowCount = await rows.count();
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      if ((await row.locator('.ant-checkbox').count()) === 0) continue;
      const rowKey = ((await row.getAttribute('data-row-key')) || '').trim();
      const linkTexts = (await row.locator('a').allInnerTexts())
        .map((item) => normalizeRowText(item))
        .filter(Boolean);
      const cellTexts = (await row.locator('td').allInnerTexts())
        .map((item) => normalizeRowText(item))
        .filter(Boolean);
      const rowText = normalizeRowText(await row.innerText());
      rowDebug.push({
        index: index + 1,
        rowKey,
        rowText: rowText.slice(0, 160),
      });
      const phone = collectPhones(rowKey, rowText, ...linkTexts, ...cellTexts).find((item) => !seenPhones.has(item)) || '';
      const rowBusinessId = extractBusinessId(rowKey, rowText, ...linkTexts, ...cellTexts);
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      businessRows.push({ row, phone, businessId: rowBusinessId });
      if (businessRows.length >= 10) break;
    }
    return { businessRows, rowDebug };
  }

  async function findPositiveStageCandidates() {
    return page.evaluate((labels) => {
      const bodyText = (document.body.innerText || '').replace(/\s+/g, ' ');
      return labels
        .map((label) => {
          const match = bodyText.match(new RegExp(label + '\\((\\d+)\\)'));
          return { label, count: match ? Number(match[1]) : 0 };
        })
        .filter((item) => item.count > 0)
        .sort((left, right) => right.count - left.count);
    }, stageLabels);
  }

  await waitForRowsOrPlaceholder();
  await page.waitForTimeout(1500);

  let { businessRows, rowDebug } = await collectBusinessRows();
  let selectedStage = '';
  let positiveStages = [];
  if (businessRows.length === 0) {
    positiveStages = await findPositiveStageCandidates();
    for (const stage of positiveStages) {
      const stageChip = page.getByText(new RegExp(escapeRegExp(stage.label) + '\\(' + stage.count + '\\)')).first();
      if (!(await stageChip.isVisible({ timeout: 3000 }).catch(() => false))) continue;
      await stageChip.click({ timeout: 10000 });
      selectedStage = stage.label;
      await page.waitForFunction(() => document.querySelectorAll('.ant-table .ant-table-tbody > tr').length > 0, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
      ({ businessRows, rowDebug } = await collectBusinessRows());
      if (businessRows.length > 0) break;
    }
  }

  if (businessRows.length === 0) {
    console.log('[BATCH-CONTACTS-STAGE-DEBUG]', JSON.stringify(positiveStages));
    const sampledRows = rowDebug.slice(0, 8);
    console.log('[BATCH-CONTACTS-ROW-DEBUG]', JSON.stringify({ selectedStage, sampledRows }));
  }
  expect(businessRows.length).toBeGreaterThan(0);

  const selected = businessRows[Math.floor(Math.random() * businessRows.length)];
  const targetRow = selected.row;
  contactPhone = selected.phone;
  businessId = selected.businessId;

  await targetRow.locator('.ant-checkbox').first().click({ force: true, timeout: 10000 });
  await expect(targetRow.locator('.ant-checkbox-checked')).toHaveCount(1, { timeout: 10000 });

  await page.getByRole('button', { name: '批量加入通讯录' }).click();

  const feedback = page
    .locator('.ant-message-notice, .ant-notification-notice')
    .filter({ hasText: /加入通讯录|通讯录/ })
    .first();
  await expect(feedback).toBeVisible({ timeout: 15000 });
  feedbackText = (await feedback.innerText()).replace(/\s+/g, ' ').trim();
  expect(/加入通讯录|已存在您的通讯录|未成功加入通讯录/.test(feedbackText)).toBeTruthy();

  // 某些联系人本来就已存在通讯录，因此最终以“通讯录里能检索到该手机号”为主断言。
  await page.goto(MAILS_LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.hash.includes('/mails/mailslist'), { timeout: 30000 });
  await expect(page.locator('body')).toContainText('我的联系人', { timeout: 30000 });
  await page.locator('#mail-list_keywords').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#mail-list_keywords').fill(contactPhone);
  await page.getByRole('button', { name: /搜\s*索/ }).first().click();
  await page.waitForTimeout(3000);

  await expect(page.locator('body')).toContainText(contactPhone, { timeout: 30000 });

  console.log('[UAT-CLEANUP-INFO]', JSON.stringify({
    businessId,
    contactPhone,
    feedbackText,
    verifiedAt: new Date().toISOString(),
    note: '如需清理该联系人，请由业务侧按 UAT 规则在我的通讯录中手工删除'
  }));
});`;

const CAPABILITY_INPUT = {
  slug: CAPABILITY_SLUG,
  name: CAPABILITY_NAME,
  description:
    '在商机列表随机勾选一条带联系人手机号的商机后点击“批量加入通讯录”，再进入我的通讯录列表按手机号检索确认联系人可见。',
  capabilityType: 'composite',
  entryUrl: TARGET_URL,
  triggerPhrases: ['批量加入通讯录', '加入通讯录', '我的通讯录', '通讯录校验', '商机列表加入通讯录'],
  preconditions: ['已登录系统', '当前账号至少有一个商机进展阶段存在一条包含联系人手机号的商机记录'],
  steps: [
    '进入商机列表页并等待搜索框与“批量加入通讯录”按钮可见',
    '若当前筛选结果为空，则切换到当前有数量的商机进展阶段，再从当前页前 10 条唯一手机号商机中随机选择一条并勾选',
    '点击“批量加入通讯录”按钮并读取页面反馈',
    '进入我的通讯录列表，使用目标手机号执行搜索',
    '以通讯录列表中能查到该手机号作为最终成功判定',
  ],
  assertions: [
    FLOW_DEFINITION.expectedOutcome,
    '页面反馈可能是成功加入、已存在通讯录或未成功加入通讯录，不能只依赖 toast 判定通过',
    '最终必须在我的通讯录列表中检索到目标手机号',
  ],
  cleanupNotes: FLOW_DEFINITION.cleanupNotes,
  dependsOn: ['auth.sms-password-login'],
  sortOrder: 45,
  status: 'active',
  sourceDocumentUid: '',
  meta: {
    source: 'validated-plan',
    verificationStatus: 'execution_verified',
    planUid: VERIFIED_PLAN_UID,
    planVersion: VERIFIED_PLAN_VERSION,
    executionUid: VERIFIED_EXECUTION_UID,
    verifiedExecutionUid: VERIFIED_EXECUTION_UID,
    verifiedAt: VERIFIED_AT,
    lastVerificationExecutionUid: VERIFIED_EXECUTION_UID,
    lastVerificationStatus: 'passed',
    lastVerificationAt: VERIFIED_AT,
    sourceTaskMode: 'scenario',
    flowDefinition: FLOW_DEFINITION,
    supersedes: ['navigation.business-list-page', LEGACY_CAPABILITY_SLUG],
  },
};

export { GENERATED_CODE };

function uid(prefix) {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function buildConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });
}

async function requireProject(conn) {
  const [rows] = await conn.query(
    `SELECT project_uid, name, status
     FROM test_projects
     WHERE project_uid = ?
     LIMIT 1`,
    [PROJECT_UID]
  );
  const project = rows[0] || null;
  if (!project) throw new Error(`未找到项目 UID: ${PROJECT_UID}`);
  if (String(project.status) !== 'active') throw new Error(`项目不是 active 状态: ${PROJECT_UID}`);
  return project;
}

async function ensureModule(conn, projectUid) {
  const [rows] = await conn.query(
    `SELECT module_uid, name, sort_order
     FROM test_modules
     WHERE project_uid = ? AND name = ? AND status = 'active'
     LIMIT 1`,
    [projectUid, MODULE_NAME]
  );

  if (rows[0]) return rows[0];

  const [[sortRow]] = await conn.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
     FROM test_modules
     WHERE project_uid = ?`,
    [projectUid]
  );

  const moduleUid = uid('mod');
  const sortOrder = Number(sortRow.max_sort || 0) + 1;
  await conn.execute(
    `INSERT INTO test_modules
      (module_uid, project_uid, name, description, sort_order, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [moduleUid, projectUid, MODULE_NAME, '用于承载商机管理相关的通讯录验证自动化场景', sortOrder]
  );

  return { module_uid: moduleUid, name: MODULE_NAME, sort_order: sortOrder };
}

async function upsertCapability(conn, projectUid) {
  const [rows] = await conn.query(
    `SELECT capability_uid, sort_order, slug
     FROM project_capabilities
     WHERE project_uid = ?
       AND (slug = ? OR slug = ? OR capability_uid = ?)
     ORDER BY slug = ? DESC, capability_uid = ? DESC, updated_at DESC`,
    [projectUid, CAPABILITY_SLUG, LEGACY_CAPABILITY_SLUG, LEGACY_CAPABILITY_UID, CAPABILITY_SLUG, LEGACY_CAPABILITY_UID]
  );

  const existing = rows[0] || null;
  const duplicates = rows.slice(1);
  const capabilityUid = existing?.capability_uid || uid('cap');

  if (existing) {
    await conn.execute(
      `UPDATE project_capabilities
       SET slug = ?,
           name = ?,
           description = ?,
           capability_type = ?,
           entry_url = ?,
           trigger_phrases_json = ?,
           preconditions_json = ?,
           steps_json = ?,
           assertions_json = ?,
           cleanup_notes = ?,
           depends_on_json = ?,
           sort_order = ?,
           status = 'active',
           source_document_uid = NULL,
           meta = ?
      WHERE capability_uid = ?`,
      [
        CAPABILITY_INPUT.slug,
        CAPABILITY_INPUT.name,
        CAPABILITY_INPUT.description,
        CAPABILITY_INPUT.capabilityType,
        CAPABILITY_INPUT.entryUrl,
        JSON.stringify(CAPABILITY_INPUT.triggerPhrases),
        JSON.stringify(CAPABILITY_INPUT.preconditions),
        JSON.stringify(CAPABILITY_INPUT.steps),
        JSON.stringify(CAPABILITY_INPUT.assertions),
        CAPABILITY_INPUT.cleanupNotes,
        JSON.stringify(CAPABILITY_INPUT.dependsOn),
        CAPABILITY_INPUT.sortOrder,
        JSON.stringify(CAPABILITY_INPUT.meta),
        capabilityUid,
      ]
    );
  } else {
    await conn.execute(
      `INSERT INTO project_capabilities
        (capability_uid, project_uid, slug, name, description, capability_type, entry_url, trigger_phrases_json, preconditions_json, steps_json, assertions_json, cleanup_notes, depends_on_json, sort_order, status, source_document_uid, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?)`,
      [
        capabilityUid,
        projectUid,
        CAPABILITY_INPUT.slug,
        CAPABILITY_INPUT.name,
        CAPABILITY_INPUT.description,
        CAPABILITY_INPUT.capabilityType,
        CAPABILITY_INPUT.entryUrl,
        JSON.stringify(CAPABILITY_INPUT.triggerPhrases),
        JSON.stringify(CAPABILITY_INPUT.preconditions),
        JSON.stringify(CAPABILITY_INPUT.steps),
        JSON.stringify(CAPABILITY_INPUT.assertions),
        CAPABILITY_INPUT.cleanupNotes,
        JSON.stringify(CAPABILITY_INPUT.dependsOn),
        CAPABILITY_INPUT.sortOrder,
        JSON.stringify(CAPABILITY_INPUT.meta),
      ]
    );
  }

  for (const duplicate of duplicates) {
    await conn.execute(`UPDATE project_capabilities SET status = 'archived' WHERE capability_uid = ?`, [duplicate.capability_uid]);
  }

  return {
    capabilityUid,
    created: !existing,
    migratedFromLegacy: Boolean(existing?.slug === LEGACY_CAPABILITY_SLUG),
    archivedDuplicates: duplicates.length,
    sortOrder: Number(existing?.sort_order || CAPABILITY_INPUT.sortOrder),
  };
}

async function upsertConfig(conn, projectUid, module) {
  const [rows] = await conn.query(
    `SELECT config_uid, sort_order
     FROM test_configurations
     WHERE project_uid = ? AND module_uid = ? AND name = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [projectUid, module.module_uid, TASK_NAME]
  );

  const existing = rows[0];
  if (existing) {
    await conn.execute(
      `UPDATE test_configurations
       SET module_name = ?,
           target_url = ?,
           feature_description = ?,
           task_mode = 'scenario',
           flow_definition = ?,
           auth_required = 0,
           login_url = NULL,
           login_username = NULL,
           login_password_enc = NULL,
           coverage_mode = 'all_tiers',
           status = 'active'
       WHERE config_uid = ?`,
      [module.name, TARGET_URL, FEATURE_DESCRIPTION, JSON.stringify(FLOW_DEFINITION), existing.config_uid]
    );
    return { configUid: String(existing.config_uid), created: false, sortOrder: Number(existing.sort_order || 10) };
  }

  const [[sortRow]] = await conn.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
     FROM test_configurations
     WHERE project_uid = ? AND module_uid = ?`,
    [projectUid, module.module_uid]
  );

  const configUid = uid('cfg');
  const sortOrder = Number(sortRow.max_sort || 0) + 10;
  await conn.execute(
    `INSERT INTO test_configurations
      (config_uid, project_uid, module_uid, sort_order, module_name, name, target_url, feature_description, task_mode, flow_definition, auth_required, login_url, login_username, login_password_enc, coverage_mode, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scenario', ?, 0, NULL, NULL, NULL, 'all_tiers', 'active')`,
    [configUid, projectUid, module.module_uid, sortOrder, module.name, TASK_NAME, TARGET_URL, FEATURE_DESCRIPTION, JSON.stringify(FLOW_DEFINITION)]
  );
  return { configUid, created: true, sortOrder };
}

async function createPlan(conn, projectUid, configUid) {
  const [[versionRow]] = await conn.query(
    `SELECT COALESCE(MAX(plan_version), 0) AS max_version
     FROM test_plans
     WHERE config_uid = ?`,
    [configUid]
  );

  const planUid = uid('plan');
  const planVersion = Number(versionRow.max_version || 0) + 1;
  const generatedFiles = JSON.stringify([
    {
      name: 'yikaiye-business-batch-add-contacts.spec.ts',
      content: GENERATED_CODE,
      language: 'typescript',
    },
  ]);
  const planTitle = `${TASK_NAME} - 自动测试计划`;
  const planSummary = `覆盖 simple / medium / complex 三层，验证商机列表批量加入通讯录后在我的通讯录按手机号检索结果，自动生成于 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
  const generationPrompt =
    '基于 2026-03-12 的 live 验证结果生成：登录后需等待首页稳定再进入商机列表，允许“已存在您的通讯录”反馈，最终必须以我的通讯录按手机号检索到记录作为成功判定。';

  await conn.execute(
    `INSERT INTO test_plans
      (plan_uid, project_uid, config_uid, plan_title, plan_version, plan_code, plan_summary, tier_simple_count, tier_medium_count, tier_complex_count, generation_model, generation_prompt, generated_files_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 'gpt-5.3-codex', ?, ?)`,
    [planUid, projectUid, configUid, planTitle, planVersion, GENERATED_CODE, planSummary, generationPrompt, generatedFiles]
  );

  return { planUid, planVersion, planTitle };
}

async function insertPlanCases(conn, projectUid, planUid) {
  for (const item of PLAN_CASES) {
    await conn.execute(
      `INSERT INTO test_plan_cases
        (case_uid, project_uid, plan_uid, tier, case_name, case_steps, expected_result, sort_order, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [uid('case'), projectUid, planUid, item.tier, item.caseName, JSON.stringify(item.caseSteps), item.expectedResult, item.sortOrder]
    );
  }
}

async function insertActivityLog(conn, payload) {
  await conn.execute(
    `INSERT INTO project_activity_logs
      (activity_uid, project_uid, entity_type, entity_uid, action_type, actor_label, title, detail, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid('act'),
      payload.projectUid,
      payload.entityType,
      payload.entityUid,
      payload.actionType,
      ACTOR_LABEL,
      payload.title,
      payload.detail,
      JSON.stringify(payload.meta || {}),
    ]
  );
}

async function main() {
  const conn = await buildConnection();

  try {
    await conn.beginTransaction();

    const project = await requireProject(conn);
    const module = await ensureModule(conn, String(project.project_uid));
    const capability = await upsertCapability(conn, String(project.project_uid));
    const config = await upsertConfig(conn, String(project.project_uid), module);
    const plan = await createPlan(conn, String(project.project_uid), config.configUid);
    await insertPlanCases(conn, String(project.project_uid), plan.planUid);

    await insertActivityLog(conn, {
      projectUid: String(project.project_uid),
      entityType: 'capability',
      entityUid: capability.capabilityUid,
      actionType: capability.created ? 'capability_created' : 'capability_updated',
      title: `${capability.created ? '创建' : '更新'}能力「${CAPABILITY_NAME}」`,
      detail: `已写入商机列表批量加入通讯录的复合能力，共 ${FLOW_DEFINITION.steps.length} 步，保留通讯录检索为最终主断言。${capability.migratedFromLegacy ? ' 已原地迁移旧 action 能力。' : ''}${capability.archivedDuplicates > 0 ? ` 已归档重复能力 ${capability.archivedDuplicates} 条。` : ''}`,
      meta: {
        slug: CAPABILITY_SLUG,
        capabilityType: 'composite',
        flowSteps: FLOW_DEFINITION.steps.length,
        dependsOn: CAPABILITY_INPUT.dependsOn,
        migratedFromLegacy: capability.migratedFromLegacy,
        archivedDuplicates: capability.archivedDuplicates,
      },
    });

    await insertActivityLog(conn, {
      projectUid: String(project.project_uid),
      entityType: 'config',
      entityUid: config.configUid,
      actionType: config.created ? 'config_created' : 'config_updated',
      title: `${config.created ? '创建' : '更新'}任务「${TASK_NAME}」`,
      detail: `已写入商机列表通讯录校验场景，共 ${FLOW_DEFINITION.steps.length} 步，以我的通讯录按手机号检索成功为主断言。`,
      meta: {
        projectName: String(project.name || PROJECT_NAME),
        moduleUid: String(module.module_uid),
        moduleName: module.name,
        targetUrl: TARGET_URL,
        taskMode: 'scenario',
        flowSteps: FLOW_DEFINITION.steps.length,
      },
    });

    await insertActivityLog(conn, {
      projectUid: String(project.project_uid),
      entityType: 'plan',
      entityUid: plan.planUid,
      actionType: 'plan_generated',
      title: `生成计划「${plan.planTitle}」`,
      detail: '已写入 simple / medium / complex 三层用例，覆盖批量加入通讯录反馈与我的通讯录按手机号检索校验。',
      meta: {
        configUid: config.configUid,
        planVersion: plan.planVersion,
        generationModel: 'gpt-5.3-codex',
        tiers: { simple: 1, medium: 1, complex: 1 },
      },
    });

    await conn.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          projectUid: String(project.project_uid),
          projectName: String(project.name || PROJECT_NAME),
          moduleUid: String(module.module_uid),
          moduleName: module.name,
          capabilityUid: capability.capabilityUid,
          capabilitySlug: CAPABILITY_SLUG,
          capabilityName: CAPABILITY_NAME,
          migratedFromLegacy: capability.migratedFromLegacy,
          archivedDuplicates: capability.archivedDuplicates,
          configUid: config.configUid,
          taskName: TASK_NAME,
          planUid: plan.planUid,
          planTitle: plan.planTitle,
          planVersion: plan.planVersion,
        },
        null,
        2
      )
    );
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
