import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

function uid(prefix) {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

const PROJECT_UID = 'proj_default';
const PROJECT_NAME = '测试环境';
const MODULE_NAME = '商机管理';
const TASK_NAME = '创建商机-无附件提交并列表校验';
const TARGET_URL = 'https://uat-service.yikaiye.com/#/business/createbusiness';
const BUSINESS_LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
const ACTOR_LABEL = 'Codex';

const FEATURE_DESCRIPTION =
  '登录 UAT 后进入创建商机页面。第一页必须填写商机来源、商机联系人、商机联系方式、性别；第二页保留默认业务类型=企业业务(已设立)、商机权重=1，仅补齐企业名称和叶子意向产品即可继续；第三页不上传录音、不上传图片，直接提交。提交成功后进入商机列表，用联系人手机号检索新建记录，验证商机已落库，且商机ID、企业名称、联系人名称、联系电话、商机来源、意向产品、商机进展等关键信息可见。';

const FLOW_DEFINITION = {
  version: 1,
  entryUrl: TARGET_URL,
  sharedVariables: ['contactName', 'contactPhone', 'companyName', 'productName', 'businessId'],
  expectedOutcome:
    '创建商机在不上传附件的情况下仍可提交成功，并能在商机列表通过手机号检索到新入库记录。',
  cleanupNotes:
    '该业务流会真实写入 UAT 商机数据。每次执行后记录商机ID、联系人、手机号和创建时间，如无需保留，请由业务侧在 UAT 手工清理。',
  steps: [
    {
      stepUid: 'step-open-create-business',
      stepType: 'ui',
      title: '登录后进入创建商机页',
      target: TARGET_URL,
      instruction: '完成短信验证码登录后，直接打开创建商机页，确认当前页展示商机联系人信息、关联产品意向信息、附件信息三段向导。',
      expectedResult: '页面成功进入创建商机页，存在保存并继续按钮。',
      extractVariable: '',
    },
    {
      stepUid: 'step-fill-step1-required',
      stepType: 'ui',
      title: '填写第一页必填字段',
      target: TARGET_URL,
      instruction: '选择商机来源=抖音，填写唯一联系人名称和唯一手机号，选择性别=男，然后点击保存并继续。',
      expectedResult: '第一页通过校验并进入第二页关联产品意向信息。',
      extractVariable: 'contactName,contactPhone',
    },
    {
      stepUid: 'step-fill-step2-minimal',
      stepType: 'ui',
      title: '按第二页最小必填填写企业和产品',
      target: TARGET_URL,
      instruction:
        '保留默认业务类型=企业业务(已设立)和商机权重=1；企业名称搜索并选择“中铁上海工程局集团有限公司(91310000566528939E)”；意向产品选择叶子节点“疑难工商注销”；不填写预计成交额和备注，点击保存并继续。',
      expectedResult: '第二页通过校验并进入第三页附件信息。',
      extractVariable: 'companyName,productName',
    },
    {
      stepUid: 'step-submit-without-attachments',
      stepType: 'ui',
      title: '第三页不上传附件直接提交',
      target: TARGET_URL,
      instruction: '进入第三页后，不上传录音、不上传图片、不填写图片备注，直接点击提交。',
      expectedResult: '当前 UAT 实际表现为提交成功，不会被附件字段阻塞。',
      extractVariable: '',
    },
    {
      stepUid: 'step-search-created-business',
      stepType: 'extract',
      title: '在商机列表按手机号检索新建记录',
      target: BUSINESS_LIST_URL,
      instruction: '打开商机列表，使用联系人手机号检索刚提交的新商机，读取商机ID、企业名称、联系人名称和联系电话。',
      expectedResult: '商机列表可检索到刚创建的记录。',
      extractVariable: 'businessId',
    },
    {
      stepUid: 'step-assert-created-record',
      stepType: 'assert',
      title: '校验列表中的落库结果',
      target: BUSINESS_LIST_URL,
      instruction: '核对意向产品、商机来源、商机进展、企业名称、联系人名称、联系电话和商机ID，确认与创建步骤一致。',
      expectedResult: '新记录状态为新入库，来源为抖音，意向产品为疑难工商注销，联系人与手机号匹配。',
      extractVariable: '',
    },
    {
      stepUid: 'step-record-cleanup-info',
      stepType: 'cleanup',
      title: '记录人工清理信息',
      target: BUSINESS_LIST_URL,
      instruction: '记录商机ID、联系人、手机号和创建时间，不在自动化里执行删除或作废，由业务侧按UAT规则手工清理。',
      expectedResult: '测试数据可追踪，可人工清理。',
      extractVariable: '',
    },
  ],
};

const PLAN_CASES = [
  {
    tier: 'simple',
    caseName: '简单流程：创建商机无附件主链路',
    caseSteps: [
      `打开创建商机页 ${TARGET_URL}`,
      '第一页填写商机来源、联系人、联系方式、性别',
      '第二页仅填写企业名称和叶子意向产品，保留默认业务类型与商机权重',
      '第三页不上传附件直接提交',
    ],
    expectedResult: '创建商机主链路可通过，无附件不会阻塞提交。',
    sortOrder: 10,
  },
  {
    tier: 'medium',
    caseName: '中等流程：提交成功后列表检索校验',
    caseSteps: [
      '提交成功后跳转或进入商机列表',
      '通过联系人手机号检索新建记录',
      '读取商机ID、企业名称、联系人名称、联系电话',
      '核对商机来源=抖音、意向产品=疑难工商注销、商机进展=新入库',
    ],
    expectedResult: '商机数据真实落库，列表字段与创建动作一致。',
    sortOrder: 20,
  },
  {
    tier: 'complex',
    caseName: '复杂流程：真实写入约束与清理兜底',
    caseSteps: [
      '使用唯一联系人名和手机号，避免与历史记录混淆',
      '验证第二页默认业务类型与商机权重不会阻塞继续',
      '验证第三页空附件也能触发 saveBusiness 成功写入',
      '记录商机ID和创建时间，预留人工清理路径',
    ],
    expectedResult: '真实写入链路稳定，关键主键可追踪，测试数据有明确清理凭据。',
    sortOrder: 30,
  },
];

const GENERATED_CODE = String.raw`import { test, expect } from '@playwright/test';

test('创建商机：无附件提交并在商机列表校验落库', async ({ page }) => {
  const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
  const CREATE_URL = 'https://uat-service.yikaiye.com/#/business/createbusiness';
  const LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
  const USERNAME = process.env.E2E_USERNAME;
  const PASSWORD = process.env.E2E_PASSWORD;
  const COMPANY_KEYWORD = '中铁上海工程局集团有限公司';
  const COMPANY_NAME = '中铁上海工程局集团有限公司(91310000566528939E)';
  const PRODUCT_NAME = '疑难工商注销';

  test.skip(!USERNAME || !PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD，无法执行 UAT 登录');

  const stamp = Date.now().toString().slice(-6);
  const contactName = '自动化商机' + stamp;
  const contactPhone = '1990000' + stamp.slice(-4);
  let businessId = '';

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
  // 登录后首页还会继续做一次会话/菜单初始化，过早跳业务页会被判成“登录信息过期”。
  await page.waitForTimeout(5000);

  await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/#\/business\/createbusiness/i, { timeout: 30000 });
  await expect(page.locator('label[title="商机来源"]').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

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
  await page.getByRole('button', { name: '保存并继续' }).click();

  const companyRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="企业名称"]') }).first();
  const productRow = page.locator('.ant-form-item').filter({ has: page.locator('label[title="意向产品"]') }).first();
  await companyRow.waitFor({ timeout: 15000 });

  await __e2e.selectAntdOption(page, companyRow, {
    label: COMPANY_NAME,
    searchText: COMPANY_KEYWORD,
  });
  await page.waitForTimeout(800);

  await __e2e.selectAntdOption(page, productRow, {
    label: PRODUCT_NAME,
    searchText: PRODUCT_NAME,
    tree: true,
  });
  await page.waitForTimeout(600);
  await page.mouse.click(1200, 120);

  await page.getByRole('button', { name: '保存并继续' }).click();
  await page.waitForTimeout(2000);

  await expect(page.getByText(/上传录音文件|上传图片|选择文件/i).first()).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: /提\s*交/ }).first().click();
  await page.waitForTimeout(3000);
  await expect(page.getByText('提交成功')).toBeVisible({ timeout: 10000 });

  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const searchInput = page.locator('input[placeholder="商机ID/联系人名称/电话/企业名称"]').first();
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(contactPhone);
  await page.getByRole('button', { name: /搜\s*索/ }).first().click();
  await page.waitForTimeout(5000);

  const rows = await page.locator('tbody tr').allInnerTexts();
  const joined = rows.join('\n');
  expect(joined).toContain(contactPhone);
  expect(joined).toContain(contactName);
  expect(joined).toContain('中铁上海工程局集团有限公司');
  expect(joined).toContain('疑难工商注销');
  expect(joined).toContain('新入库');
  expect(joined).toContain('抖音');

  const detailRow = rows.find((row) => row.includes(contactPhone)) || '';
  const idMatch = detailRow.match(/\b(\d{6})\b/);
  businessId = idMatch ? idMatch[1] : '';

  console.log('[UAT-CLEANUP-INFO]', JSON.stringify({
    businessId,
    contactName,
    contactPhone,
    companyName: '中铁上海工程局集团有限公司',
    productName: PRODUCT_NAME,
    submittedAt: new Date().toISOString(),
    note: '该记录为自动化在UAT创建，如无需保留，请由业务侧在商机列表中手工清理'
  }));
});
`;

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
    [moduleUid, projectUid, MODULE_NAME, '用于承载商机管理相关的创建商机自动化场景', sortOrder]
  );

  return { module_uid: moduleUid, name: MODULE_NAME, sort_order: sortOrder };
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
      name: 'yikaiye-business-create-no-attachment.spec.ts',
      content: GENERATED_CODE,
      language: 'typescript',
    },
  ]);
  const planTitle = `${TASK_NAME} - 自动测试计划`;
  const planSummary = `覆盖简单/中等/复杂三层，验证创建商机无附件提交与商机列表落库校验，自动生成于 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
  const generationPrompt =
    '基于 2026-03-10 的 live 验证结果生成：第二页最小必填为企业名称+意向产品，第三页附件非必填，可直接提交成功并在商机列表中按手机号检索。';

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
    const config = await upsertConfig(conn, String(project.project_uid), module);
    const plan = await createPlan(conn, String(project.project_uid), config.configUid);
    await insertPlanCases(conn, String(project.project_uid), plan.planUid);

    await insertActivityLog(conn, {
      projectUid: String(project.project_uid),
      entityType: 'config',
      entityUid: config.configUid,
      actionType: config.created ? 'config_created' : 'config_updated',
      title: `${config.created ? '创建' : '更新'}任务「${TASK_NAME}」`,
      detail: `已写入商机管理场景，共 ${FLOW_DEFINITION.steps.length} 步，第三页按无附件提交流程执行。`,
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
      detail: '已写入 simple / medium / complex 三层用例，覆盖无附件提交和列表落库校验。',
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
