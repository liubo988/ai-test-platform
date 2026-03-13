import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

const PROJECT_UID = 'proj_default';
const PROJECT_NAME = '测试环境';
const MODULE_NAME = '商机管理';
const TASK_NAME = '创建商机并生成订单-createOrder 主断言';
const TARGET_URL = 'https://uat-service.yikaiye.com/#/business/createbusiness';
const BUSINESS_LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
const CAPABILITY_SLUG = 'composite.business-create-to-order';
const CAPABILITY_NAME = '创建商机并生成订单';
const ACTOR_LABEL = 'Codex';
const VERIFIED_PLAN_UID = 'plan_1773229731870_7b57981b';
const VERIFIED_EXECUTION_UID = 'exec_1773229732017_fc0efb4f';
const VERIFIED_PLAN_VERSION = 14;
const VERIFIED_AT = '2026-03-11T11:50:00.000Z';

const FEATURE_DESCRIPTION =
  '登录 UAT 后进入创建商机页面。第一页填写商机来源=抖音、唯一联系人和唯一手机号、性别=男；第二页保留默认业务类型与商机权重，仅补齐企业名称和叶子意向产品；第三页空附件直接提交。提交成功后进入商机列表，用手机号定位新建商机，从目标行三点菜单点击“生成订单”，等待“确定订单信息”Drawer，点击确定并等待 POST /crmapi/business/createOrder 成功响应、Drawer 关闭，再回到列表确认签约成功计数不下降，并记录商机ID、联系人、手机号和创建时间供人工清理。';

const FLOW_DEFINITION = {
  version: 1,
  entryUrl: TARGET_URL,
  sharedVariables: [
    'contactName',
    'contactPhone',
    'companyName',
    'productName',
    'businessId',
    'createdAt',
    'signedCountBefore',
    'signedCountAfter',
  ],
  expectedOutcome:
    '创建商机后可成功生成订单，并以 createOrder 成功响应、Drawer 关闭和签约成功计数不下降作为主判定。',
  cleanupNotes:
    '该业务流会真实写入 UAT 商机与订单数据。记录商机ID、联系人、手机号、创建时间和签约成功计数，由业务侧按 UAT 规则手工清理。',
  steps: [
    {
      stepUid: 'step-open-create-business',
      stepType: 'ui',
      title: '进入创建商机页',
      target: TARGET_URL,
      instruction: '登录完成后直接打开创建商机页，确认当前页存在商机来源字段和保存并继续按钮。',
      expectedResult: '页面成功进入创建商机页，可开始填写第一页。',
      extractVariable: '',
    },
    {
      stepUid: 'step-fill-step1-required',
      stepType: 'ui',
      title: '填写第一页必填字段',
      target: TARGET_URL,
      instruction: '选择商机来源=抖音，填写唯一联系人姓名和唯一手机号，选择性别=男，然后点击保存并继续。',
      expectedResult: '第一页通过校验并进入第二页关联产品意向信息。',
      extractVariable: 'contactName,contactPhone',
    },
    {
      stepUid: 'step-fill-step2-minimal',
      stepType: 'ui',
      title: '按第二页最小必填填写企业和产品',
      target: TARGET_URL,
      instruction:
        '保留默认业务类型=企业业务(已设立)和商机权重=1；企业名称搜索并选择“中铁上海工程局集团有限公司(91310000566528939E)”；意向产品选择叶子节点“疑难工商注销”；然后点击保存并继续。',
      expectedResult: '第二页通过校验并进入第三页附件信息。',
      extractVariable: 'companyName,productName',
    },
    {
      stepUid: 'step-submit-without-attachments',
      stepType: 'ui',
      title: '第三页空附件提交商机',
      target: TARGET_URL,
      instruction: '第三页不上传录音、不上传图片，直接点击提交。',
      expectedResult: '商机提交成功，第三页不会因空附件阻塞。',
      extractVariable: '',
    },
    {
      stepUid: 'step-locate-created-business',
      stepType: 'extract',
      title: '商机列表按手机号定位新建记录',
      target: BUSINESS_LIST_URL,
      instruction: '打开商机列表，用联系人手机号检索新建商机，读取商机ID、创建时间和签约成功当前计数。',
      expectedResult: '列表可定位到刚创建的商机，并能读到 businessId、createdAt 与 signedCountBefore。',
      extractVariable: 'businessId,createdAt,signedCountBefore',
    },
    {
      stepUid: 'step-open-create-order-drawer',
      stepType: 'ui',
      title: '从目标行菜单打开生成订单 Drawer',
      target: BUSINESS_LIST_URL,
      instruction: '在目标行末列三点菜单中点击“生成订单”，等待“确定订单信息”Drawer 出现。',
      expectedResult: 'Drawer 打开，且确定按钮可见。',
      extractVariable: '',
    },
    {
      stepUid: 'step-confirm-create-order',
      stepType: 'api',
      title: '确认生成订单并等待 createOrder 成功',
      target: BUSINESS_LIST_URL,
      instruction: '点击 Drawer 内确定，等待 POST /crmapi/business/createOrder 成功响应；若响应体包含 code，则校验 code=1。',
      expectedResult: 'createOrder 请求返回成功，Drawer 关闭，列表加载遮罩消失。',
      extractVariable: '',
    },
    {
      stepUid: 'step-assert-signed-count',
      stepType: 'assert',
      title: '校验签约成功计数变化',
      target: BUSINESS_LIST_URL,
      instruction: '回到商机列表读取签约成功计数，并与下单前记录对比。',
      expectedResult: '签约成功计数不下降，正常情况下会增加。',
      extractVariable: 'signedCountAfter',
    },
    {
      stepUid: 'step-record-cleanup-info',
      stepType: 'cleanup',
      title: '记录人工清理信息',
      target: BUSINESS_LIST_URL,
      instruction: '记录商机ID、联系人、手机号、创建时间和签约成功计数，不在自动化里执行删除，由业务侧手工清理。',
      expectedResult: '清理凭据完整，可追踪到本次测试数据。',
      extractVariable: '',
    },
  ],
};

const PLAN_CASES = [
  {
    tier: 'simple',
    caseName: '简单流程：创建商机并打开生成订单 Drawer',
    caseSteps: [
      `打开创建商机页 ${TARGET_URL}`,
      '第一页填写商机来源、联系人、联系方式、性别',
      '第二页仅填写企业名称和叶子意向产品',
      '第三页空附件提交后进入商机列表',
      '在目标行三点菜单里点击生成订单并看到 Drawer',
    ],
    expectedResult: '创建商机后能够稳定打开确定订单信息 Drawer。',
    sortOrder: 10,
  },
  {
    tier: 'medium',
    caseName: '中等流程：以 createOrder 成功和 Drawer 关闭为主断言',
    caseSteps: [
      '提交新商机后在商机列表按手机号定位目标行',
      '记录签约成功计数',
      '点击 Drawer 内确定并等待 POST /crmapi/business/createOrder',
      '校验响应成功且 Drawer 关闭',
    ],
    expectedResult: '生成订单接口成功返回，页面不依赖模糊“成功”提示即可判定通过。',
    sortOrder: 20,
  },
  {
    tier: 'complex',
    caseName: '复杂流程：签约成功计数和人工清理信息兜底',
    caseSteps: [
      '创建商机时使用唯一联系人和唯一手机号，避免和历史数据混淆',
      '生成订单成功后不要强依赖原商机行继续可见',
      '回到列表校验签约成功计数不下降',
      '记录商机ID、联系人、手机号、创建时间和计数，预留人工清理路径',
    ],
    expectedResult: '真实写入商机和订单后仍可稳定收尾，且测试数据具备可追踪的清理凭据。',
    sortOrder: 30,
  },
];

const GENERATED_CODE = String.raw`import { test, expect } from '@playwright/test';

test('创建商机并生成订单：以 createOrder 成功为主断言', async ({ page }) => {
  const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
  const CREATE_URL = 'https://uat-service.yikaiye.com/#/business/createbusiness';
  const LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
  const USERNAME = process.env.E2E_USERNAME;
  const PASSWORD = process.env.E2E_PASSWORD;
  const COMPANY_KEYWORD = '中铁上海工程局集团有限公司';
  const COMPANY_NAME = '中铁上海工程局集团有限公司(91310000566528939E)';
  const PRODUCT_NAME = '疑难工商注销';

  test.skip(!USERNAME || !PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD，无法执行 UAT 登录');

  const stamp = Date.now().toString().slice(-8);
  const contactName = '自动化商机' + stamp;
  const contactPhone = ('138' + stamp.slice(-8)).slice(0, 11);
  let businessId = '';
  let createdAt = '';
  let signedCountBefore = 0;
  let signedCountAfter = 0;

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const smsTab = page.getByRole('tab', { name: /短信验证码登录|短信登录|验证码登录/i }).first();
  const smsTabByText = page.getByText(/短信验证码登录|短信登录|验证码登录/i).first();
  if (await smsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await smsTab.click({ force: true });
  } else if (await smsTabByText.isVisible({ timeout: 3000 }).catch(() => false)) {
    await smsTabByText.click({ force: true });
  }

  const accountInput = page.getByPlaceholder(/手机号|手机号码|请输入手机号|账号|用户名/i).first();
  await expect(accountInput).toBeVisible({ timeout: 15000 });
  await accountInput.fill(String(USERNAME));

  const codeInput = page.getByPlaceholder(/验证码|请输入验证码|短信验证码/i).first();
  await expect(codeInput).toBeVisible({ timeout: 10000 });
  await codeInput.fill(String(PASSWORD));

  const loginBtn = page.getByRole('button', { name: /登\s*录|登录|Login/i }).first();
  await expect(loginBtn).toBeVisible({ timeout: 10000 });
  await loginBtn.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const hash = window.location.hash || '';
    const bodyText = document.body?.innerText || '';
    return !hash.includes('/user/login') && (bodyText.includes('首页') || bodyText.includes('业务数据') || bodyText.includes('商机管理'));
  }, { timeout: 30000 });
  await page.waitForTimeout(5000);

  await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/#\/business\/createbusiness/i, { timeout: 30000 });
  await expect(page.locator('label[title="商机来源"]').first()).toBeVisible({ timeout: 15000 });

  const sourceRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="商机来源"]') }).first();
  await __e2e.selectAntdOption(page, sourceRow, {
    label: '抖音',
    searchText: '抖音',
    tree: true,
    settleMs: 300,
  });

  await page.locator('#createBusinessBaseInfo_contactInfo\\[0\\]\\.people').fill(contactName);
  await page.locator('#createBusinessBaseInfo_contactInfo\\[0\\]\\.way\\[0\\]\\.itmValue').fill(contactPhone);
  await page.locator('.ant-form-item').filter({ has: page.locator('label[title="性别"]') }).first().getByText('男', { exact: true }).click();
  await page.getByRole('button', { name: '保存并继续' }).first().click();

  const companyRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="企业名称"]') }).first();
  const productRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="意向产品"]') }).first();
  await expect(companyRow).toBeVisible({ timeout: 15000 });
  await expect(productRow).toBeVisible({ timeout: 15000 });

  await __e2e.selectAntdOption(page, companyRow, {
    label: COMPANY_NAME,
    searchText: COMPANY_KEYWORD,
    settleMs: 300,
  });

  await __e2e.selectAntdOption(page, productRow, {
    label: PRODUCT_NAME,
    searchText: PRODUCT_NAME,
    tree: true,
    settleMs: 300,
  });

  await page.mouse.click(1200, 120);
  await page.getByRole('button', { name: '保存并继续' }).first().click();
  await expect(page.getByText(/上传录音文件|上传图片|选择文件/i).first()).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: /^提\s*交$/ }).first().click();
  await expect(page.getByText('提交成功')).toBeVisible({ timeout: 15000 });

  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/#\/business\/businesslist/i, { timeout: 30000 });
  const keywordInput = page.locator('#businessList_keywords');
  await expect(keywordInput).toBeVisible({ timeout: 15000 });
  await keywordInput.fill(contactPhone);
  await page.getByRole('button', { name: /搜\s*索/ }).first().click();

  const targetRow = page.locator('tbody tr').filter({ hasText: contactPhone }).first();
  await expect(targetRow).toBeVisible({ timeout: 20000 });
  await expect(targetRow).toContainText(contactName);
  await expect(targetRow).toContainText('抖音');

  const rowText = await targetRow.innerText();
  const idMatch = rowText.match(/\b\d{6,}\b/);
  businessId = idMatch ? idMatch[0] : '';
  const timeMatch = rowText.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/);
  createdAt = timeMatch ? timeMatch[0] : '';

  const signedTag = page.getByText(/签约成功\(\d+\)/).first();
  if (await signedTag.isVisible({ timeout: 3000 }).catch(() => false)) {
    const beforeText = (await signedTag.innerText()).trim();
    const beforeMatch = beforeText.match(/签约成功\((\d+)\)/);
    signedCountBefore = beforeMatch ? Number(beforeMatch[1]) : 0;
  }

  await __e2e.clickAntdRowAction(page, targetRow, '生成订单');

  const orderDrawer = page.locator('.ant-drawer-content').filter({ hasText: /确定订单信息|订单信息|基础信息|产品信息/ }).last();
  await expect(orderDrawer).toBeVisible({ timeout: 20000 });

  const confirmBtn = orderDrawer.getByRole('button', { name: /^确\s*定$/ }).first();
  await expect(confirmBtn).toBeVisible({ timeout: 20000 });

  const createOrderRespPromise = page.waitForResponse((resp) => {
    return resp.url().includes('/crmapi/business/createOrder') && resp.request().method() === 'POST' && resp.status() === 200;
  }, { timeout: 60000 });

  await confirmBtn.click();
  const createOrderResp = await createOrderRespPromise;
  expect(createOrderResp.ok()).toBeTruthy();

  const createOrderPayload = await createOrderResp.json().catch(() => null);
  if (createOrderPayload && typeof createOrderPayload === 'object' && 'code' in createOrderPayload) {
    expect(createOrderPayload.code).toBe(1);
  }

  await expect(orderDrawer).toBeHidden({ timeout: 30000 });
  await expect(page.locator('.ant-spin-spinning')).toHaveCount(0, { timeout: 30000 });

  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/#\/business\/businesslist/i, { timeout: 30000 });

  const signedTagAfter = page.getByText(/签约成功\(\d+\)/).first();
  await expect(signedTagAfter).toBeVisible({ timeout: 15000 });
  const afterText = (await signedTagAfter.innerText()).trim();
  const afterMatch = afterText.match(/签约成功\((\d+)\)/);
  signedCountAfter = afterMatch ? Number(afterMatch[1]) : 0;
  expect(signedCountAfter).toBeGreaterThanOrEqual(signedCountBefore);

  console.log('[UAT-CLEANUP-INFO]', JSON.stringify({
    businessId,
    contactName,
    contactPhone,
    createdAt,
    signedCountBefore,
    signedCountAfter,
    companyName: COMPANY_NAME,
    productName: PRODUCT_NAME,
    note: '由业务侧按 UAT 规则手工清理'
  }));
});
`;

const CAPABILITY_INPUT = {
  slug: CAPABILITY_SLUG,
  name: CAPABILITY_NAME,
  description:
    '创建商机后在商机列表通过目标行三点菜单生成订单，以 createOrder 成功、Drawer 关闭和签约成功计数校验作为主断言。',
  capabilityType: 'composite',
  entryUrl: TARGET_URL,
  triggerPhrases: ['创建商机并生成订单', '商机转订单', '商机生成订单', '创建商机后生成订单', '生成订单'],
  preconditions: ['已登录系统', '联系人姓名和手机号需使用唯一值，避免与历史商机混淆'],
  steps: [
    '进入创建商机页并确认第一页可填写',
    '第一页填写商机来源=抖音、唯一联系人姓名、唯一手机号、性别=男',
    '第二页保留默认业务类型和商机权重，只补齐企业名称与叶子意向产品',
    '第三页不上传附件直接提交商机',
    '在商机列表按手机号定位目标行并读取商机ID、创建时间、签约成功计数',
    '从目标行三点菜单点击生成订单，等待确定订单信息 Drawer',
    '点击 Drawer 内确定并等待 POST /crmapi/business/createOrder 成功',
    '回到商机列表确认签约成功计数不下降并记录清理信息',
  ],
  assertions: [
    FLOW_DEFINITION.expectedOutcome,
    'POST /crmapi/business/createOrder 返回 200；若返回体包含 code，则 code=1',
    '确定订单信息 Drawer 关闭后再结束成功断言',
    '生成订单成功后不再强依赖原商机行继续可见',
  ],
  cleanupNotes: FLOW_DEFINITION.cleanupNotes,
  dependsOn: ['auth.sms-password-login'],
  sortOrder: 35,
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
    supersedes: [
      'navigation.business-create-page',
      'navigation.business-list-page',
      'business.create-no-attachment',
      'business.list-search-by-phone',
    ],
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
    [moduleUid, projectUid, MODULE_NAME, '用于承载商机管理相关的创建商机与生成订单自动化场景', sortOrder]
  );

  return { module_uid: moduleUid, name: MODULE_NAME, sort_order: sortOrder };
}

async function upsertCapability(conn, projectUid) {
  const [rows] = await conn.query(
    `SELECT capability_uid, sort_order
     FROM project_capabilities
     WHERE project_uid = ? AND slug = ?
     LIMIT 1`,
    [projectUid, CAPABILITY_SLUG]
  );

  const existing = rows[0];
  const capabilityUid = existing?.capability_uid || uid('cap');

  if (existing) {
    await conn.execute(
      `UPDATE project_capabilities
       SET name = ?,
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

  return {
    capabilityUid,
    created: !existing,
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
      name: 'yikaiye-business-create-order.spec.ts',
      content: GENERATED_CODE,
      language: 'typescript',
    },
  ]);
  const planTitle = `${TASK_NAME} - 自动测试计划`;
  const planSummary = `覆盖 simple / medium / complex 三层，验证创建商机后生成订单的 Drawer、createOrder 响应与签约成功计数，自动生成于 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
  const generationPrompt =
    '基于 2026-03-11 的 live 验证结果生成：企业名称是远程搜索 Select，生成订单入口在商机列表目标行三点菜单，主断言应为 createOrder 成功、Drawer 关闭与签约成功计数不下降。';

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
      detail: `已写入创建商机并生成订单的复合能力，共 ${FLOW_DEFINITION.steps.length} 步，保留 createOrder 主断言。`,
      meta: {
        slug: CAPABILITY_SLUG,
        capabilityType: 'composite',
        flowSteps: FLOW_DEFINITION.steps.length,
        dependsOn: CAPABILITY_INPUT.dependsOn,
      },
    });

    await insertActivityLog(conn, {
      projectUid: String(project.project_uid),
      entityType: 'config',
      entityUid: config.configUid,
      actionType: config.created ? 'config_created' : 'config_updated',
      title: `${config.created ? '创建' : '更新'}任务「${TASK_NAME}」`,
      detail: `已写入商机管理场景，共 ${FLOW_DEFINITION.steps.length} 步，以 createOrder 成功和 Drawer 关闭为主断言。`,
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
      detail: '已写入 simple / medium / complex 三层用例，覆盖生成订单 Drawer、createOrder 响应和签约成功计数校验。',
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
