import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

function uid(prefix) {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

const PROJECT_NAME = '测试环境';
const MODULE_NAME = '订单';
const TASK_NAME = '多节点 Demo：订单批量入账到入账管理核对';
const LEGACY_TASK_NAMES = ['多节点 Demo：订单申请入账到款项审核'];
const TARGET_URL = 'https://uat-service.yikaiye.com/#/order/list';
const ACTOR_LABEL = 'Codex';

const FEATURE_DESCRIPTION =
  '从订单列表中选择一条状态为“待申请入账”的订单。进入页面后不要点击“全部清除”或“重置”，应先等待表格数据加载完成。提取订单号时优先使用订单号链接文本，不要用整行正则猜测，以免误取手机号或企业 ID。勾选该订单后，使用顶部“批量入账”按钮进入“批量申请入账”弹窗，不要假设存在行内申请入账按钮。弹窗中通常已默认带出服务项和入账金额，确认按钮文案为“确 定”。提交后进入“入账管理”页面，用 placeholder 为“请输入关键词”的筛选框搜索订单号，验证入账记录存在，且订单号、服务项、入账金额与订单页一致。';

const FLOW_DEFINITION = {
  version: 1,
  entryUrl: TARGET_URL,
  sharedVariables: ['orderNo', 'applyAmount', 'serviceItem', 'entryStatus'],
  expectedOutcome:
    '订单列表中的待申请入账订单提交后，可以在入账管理中通过订单号检索到对应记录，且订单号、服务项、入账金额保持一致。',
  cleanupNotes:
    '该业务流会真实写入 UAT 数据。优先选择测试订单；如无法自动作废，请记录订单号和提交时间，交由业务侧或财务侧人工清理。',
  steps: [
    {
      stepUid: 'step-order-row-ready',
      stepType: 'ui',
      title: '在订单列表等待真实数据并锁定待申请入账订单',
      target: '#/order/list',
      instruction: '打开订单列表后不要点击全部清除或重置，先等待表格数据加载。选择一条状态为待申请入账的订单，确认顶部存在批量入账按钮可用。',
      expectedResult: '订单列表出现可操作数据，至少有一条待申请入账订单可被选中。',
      extractVariable: 'orderNo',
    },
    {
      stepUid: 'step-select-row-and-open-batch-entry',
      stepType: 'ui',
      title: '勾选订单并打开批量入账弹窗',
      target: '#/order/list',
      instruction: '勾选刚才锁定的待申请入账订单，使用顶部批量入账按钮进入批量申请入账弹窗，不要寻找行内申请入账按钮。',
      expectedResult: '页面打开标题为批量申请入账的弹窗，弹窗中展示当前订单号。',
      extractVariable: '',
    },
    {
      stepUid: 'step-read-default-entry-values',
      stepType: 'extract',
      title: '记录弹窗中的服务项与入账金额',
      target: '批量申请入账弹窗',
      instruction: '从批量申请入账弹窗中提取默认服务项与入账金额，确认确认按钮文案为确 定。',
      expectedResult: '能够拿到后续核对所需的 serviceItem 和 applyAmount。',
      extractVariable: 'applyAmount',
    },
    {
      stepUid: 'step-submit-batch-entry',
      stepType: 'ui',
      title: '提交批量入账申请',
      target: '批量申请入账弹窗',
      instruction: '保持默认服务项与金额，点击确 定 提交批量入账申请。',
      expectedResult: '弹窗关闭，申请提交完成，不再停留在编辑态。',
      extractVariable: 'serviceItem',
    },
    {
      stepUid: 'step-open-booked-management',
      stepType: 'ui',
      title: '进入入账管理并按订单号搜索',
      target: '#/payment/bookedMgmt',
      instruction: '打开入账管理页面，使用 placeholder 为 请输入关键词 的筛选框输入 orderNo，再点击搜 索。',
      expectedResult: '入账管理页面展示与当前订单号相关的入账记录。',
      extractVariable: 'entryStatus',
    },
    {
      stepUid: 'step-assert-booked-management-record',
      stepType: 'assert',
      title: '校验入账管理记录字段一致性',
      target: '入账管理列表记录',
      instruction: '核对入账管理中检索出的记录，确认订单号、服务项、入账金额与前面步骤提取的数据一致。',
      expectedResult: '入账管理页能查到对应记录，且 orderNo、applyAmount、serviceItem 三项保持一致。',
      extractVariable: '',
    },
    {
      stepType: 'cleanup',
      stepUid: 'step-record-manual-cleanup-info',
      title: '记录人工清理信息',
      target: '入账管理记录',
      instruction: '如果系统没有自动回滚能力，则记录订单号与提交时间，交给人工处理，不要在自动化里继续猜测作废入口。',
      expectedResult: '测试数据可追踪，后续可以人工清理。',
      extractVariable: '',
    },
  ],
};

const PLAN_CASES = [
  {
    tier: 'simple',
    caseName: '简单流程：批量入账主链路',
    caseSteps: [
      `打开业务流入口 ${TARGET_URL}`,
      '等待订单列表数据加载，不点击全部清除',
      '勾选待申请入账订单并打开批量申请入账弹窗',
      '确认默认金额后点击确 定',
    ],
    expectedResult: '订单可以通过顶部批量入账入口成功提交入账申请。',
    sortOrder: 10,
  },
  {
    tier: 'medium',
    caseName: '中等流程：入账管理跨页面核对',
    caseSteps: [
      '从订单列表提取真实订单号链接文本',
      '在入账管理页面使用 请输入关键词 搜索订单号',
      '核对订单号、服务项和入账金额',
      '验证入账记录可被稳定检索',
    ],
    expectedResult: '入账管理中能查到对应订单记录，且关键信息一致。',
    sortOrder: 20,
  },
  {
    tier: 'complex',
    caseName: '复杂流程：真实数据写入约束与人工清理兜底',
    caseSteps: [
      '避免点击全部清除和重置等干扰列表加载的按钮',
      '避免使用整行正则误取手机号或企业 ID 作为订单号',
      '确认批量入账弹窗真实关闭，不停留在编辑态',
      '记录订单号与提交时间，预留人工清理路径',
    ],
    expectedResult: '真实写入路径稳定，关键主键提取准确，测试数据可追踪。',
    sortOrder: 30,
  },
];

const GENERATED_CODE = String.raw`import { test, expect } from '@playwright/test';

test('订单待申请入账 -> 批量入账 -> 入账管理校验一致性', async ({ page }) => {
  const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
  const ORDER_LIST_URL = 'https://uat-service.yikaiye.com/#/order/list';
  const BOOKED_MGMT_URL = 'https://uat-service.yikaiye.com/#/payment/bookedMgmt';

  const USERNAME = process.env.E2E_USERNAME;
  const PASSWORD = process.env.E2E_PASSWORD;

  test.skip(!USERNAME || !PASSWORD, '缺少自动化登录凭证：请设置 E2E_USERNAME / E2E_PASSWORD');

  let orderNo = '';
  let applyAmount = '';
  let serviceItem = '';

  await test.step('登录 UAT', async () => {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

    const smsTab = page.getByText(/短信验证码登录|短信登录|验证码登录/i).first();
    if (await smsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await smsTab.click({ force: true });
    }

    const accountInput = page.getByPlaceholder(/请输入手机号|手机号|phone/i).first();
    await expect(accountInput).toBeVisible({ timeout: 15000 });
    await accountInput.fill(String(USERNAME).trim());

    const codeInput = page.getByPlaceholder(/请输入验证码|验证码|code/i).first();
    if (await codeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await codeInput.fill(String(PASSWORD).trim());
    } else {
      await page.locator('input').nth(1).fill(String(PASSWORD).trim());
    }

    const loginBtn = page.getByRole('button', { name: /登\s*录|登录|Login/i }).first();
    await expect(loginBtn).toBeVisible({ timeout: 10000 });
    await loginBtn.click();
    await page.waitForTimeout(12000);
    expect(page.url()).toContain('#/');
  });

  await test.step('在订单列表选择待申请入账订单', async () => {
    await page.goto(ORDER_LIST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(page.url()).toContain('#/order/list');

    const rows = page.locator('.ant-table-tbody > tr');
    await expect(rows.first()).toBeVisible({ timeout: 20000 });

    const targetRow = rows.filter({ hasText: '待申请入账' }).first();
    await expect(targetRow).toBeVisible({ timeout: 20000 });

    const orderLink = targetRow.locator('td.test_class a.themeColor.bold').first();
    orderNo = ((await orderLink.textContent()) || '').trim();
    expect(orderNo.length).toBeGreaterThanOrEqual(12);
    expect(Array.from(orderNo).every((ch) => ch >= '0' && ch <= '9')).toBe(true);

    await targetRow.locator('label.ant-checkbox-wrapper').first().click({ force: true });

    const batchBtn = page.getByRole('button', { name: /批量入账|批量申请入账/i }).first();
    await expect(batchBtn).toBeVisible({ timeout: 10000 });
    await batchBtn.click();
  });

  await test.step('提交批量入账申请', async () => {
    const modal = page.locator('.ant-modal-content').last();
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal).toContainText('批量申请入账');
    await expect(modal).toContainText(orderNo);

    const modalText = (await modal.innerText()).trim();
    const serviceMatch = modalText.match(/添加服务\s+([^\n]+)/);
    serviceItem = serviceMatch ? serviceMatch[1].trim() : '';

    const amountInput = modal.getByPlaceholder(/请输入入账金额/).first();
    await expect(amountInput).toBeVisible({ timeout: 5000 });
    applyAmount = (await amountInput.inputValue()).trim();
    expect(Array.from(applyAmount).some((ch) => ch >= '0' && ch <= '9')).toBe(true);

    const confirmBtn = modal.getByRole('button', { name: /确\s*定|确定|Confirm/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    await modal.waitFor({ state: 'hidden', timeout: 20000 }).catch(async () => {
      await page.waitForTimeout(8000);
    });
  });

  await test.step('在入账管理按订单号核对记录', async () => {
    await page.goto(BOOKED_MGMT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(page.url()).toContain('#/payment/bookedMgmt');

    const keywordInput = page.locator('input[placeholder="请输入关键词"]:visible').first();
    await expect(keywordInput).toBeVisible({ timeout: 15000 });
    await keywordInput.fill(orderNo);

    const searchBtn = page.locator('button:visible').filter({ hasText: /搜\s*索|搜索/i }).first();
    await expect(searchBtn).toBeVisible({ timeout: 5000 });
    await searchBtn.click();
    await page.waitForTimeout(5000);

    const resultRow = page
      .locator('.ant-table-tbody > tr:visible')
      .filter({ hasText: orderNo })
      .first();
    await expect(resultRow).toBeVisible({ timeout: 20000 });

    const rowKey = await resultRow.getAttribute('data-row-key');
    expect(rowKey).toBeTruthy();

    const resultText = (
      await page
        .locator('.ant-table-tbody > tr:visible[data-row-key="' + rowKey + '"]')
        .evaluateAll((rows) => rows.map((row) => row.textContent || '').join(' '))
    ).trim();
    expect(resultText).toContain(orderNo);
    expect(resultText).toContain(applyAmount);
  });

  console.log('[UAT-CLEANUP-INFO]', JSON.stringify({
    orderNo,
    applyAmount,
    serviceItem,
    submittedAt: new Date().toISOString(),
    note: '该记录为自动化在UAT创建，如无法自动作废，请交由业务侧/财务侧人工清理'
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

async function findProject(conn) {
  const [rows] = await conn.query(
    `SELECT project_uid
     FROM test_projects
     WHERE name = ? AND status = 'active'
     LIMIT 1`,
    [PROJECT_NAME]
  );
  return rows[0] || null;
}

async function ensureModule(conn, projectUid) {
  const [rows] = await conn.query(
    `SELECT module_uid, name, sort_order
     FROM test_modules
     WHERE project_uid = ? AND name = ? AND status = 'active'
     LIMIT 1`,
    [projectUid, MODULE_NAME]
  );

  if (rows[0]) {
    return rows[0];
  }

  const [[sortRow]] = await conn.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
     FROM test_modules
     WHERE project_uid = ?`,
    [projectUid]
  );
  const moduleUid = uid('mod');
  await conn.execute(
    `INSERT INTO test_modules
      (module_uid, project_uid, name, description, sort_order, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [moduleUid, projectUid, MODULE_NAME, '用于承载订单相关的业务流任务 demo', Number(sortRow.max_sort || 0) + 1]
  );

  return {
    module_uid: moduleUid,
    name: MODULE_NAME,
    sort_order: Number(sortRow.max_sort || 0) + 1,
  };
}

async function upsertConfig(conn, projectUid, module) {
  const [rows] = await conn.query(
    `SELECT config_uid, status, sort_order
     FROM test_configurations
     WHERE project_uid = ? AND module_uid = ? AND name IN (?, ?)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [projectUid, module.module_uid, TASK_NAME, LEGACY_TASK_NAMES[0]]
  );

  const existing = rows[0];
  if (existing) {
    await conn.execute(
      `UPDATE test_configurations
       SET name = ?,
           sort_order = ?,
           module_name = ?,
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
      [
        TASK_NAME,
        Number(existing.sort_order || 10),
        module.name,
        TARGET_URL,
        FEATURE_DESCRIPTION,
        JSON.stringify(FLOW_DEFINITION),
        existing.config_uid,
      ]
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

async function upsertPlan(conn, projectUid, configUid) {
  const generatedFiles = JSON.stringify([
    {
      name: 'yikaiye-multi-node-demo.spec.ts',
      content: GENERATED_CODE,
      language: 'typescript',
    },
  ]);
  const planTitle = `${TASK_NAME} - 演示计划`;
  const planSummary = '真实写入 UAT 的多节点 demo，覆盖订单列表、批量入账弹窗、入账管理核对和人工清理提示。';

  const [[versionRow]] = await conn.query(
    `SELECT COALESCE(MAX(plan_version), 0) AS max_version
     FROM test_plans
     WHERE config_uid = ?`,
    [configUid]
  );

  const planUid = uid('plan');
  const planVersion = Number(versionRow.max_version || 0) + 1;
  await conn.execute(
    `INSERT INTO test_plans
      (plan_uid, project_uid, config_uid, plan_title, plan_version, plan_code, plan_summary, tier_simple_count, tier_medium_count, tier_complex_count, generation_model, generation_prompt, generated_files_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 'manual-demo', ?, ?)`,
    [planUid, projectUid, configUid, planTitle, planVersion, GENERATED_CODE, planSummary, FEATURE_DESCRIPTION, generatedFiles]
  );

  return { planUid, planVersion, created: true };
}

async function replacePlanCases(conn, projectUid, planUid) {
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

    const project = await findProject(conn);
    if (!project) {
      throw new Error(`未找到项目: ${PROJECT_NAME}`);
    }

    const module = await ensureModule(conn, String(project.project_uid));
    const config = await upsertConfig(conn, String(project.project_uid), module);
    const plan = await upsertPlan(conn, String(project.project_uid), config.configUid);
    await replacePlanCases(conn, String(project.project_uid), plan.planUid);

    await insertActivityLog(conn, {
      projectUid: String(project.project_uid),
      entityType: 'config',
      entityUid: config.configUid,
      actionType: config.created ? 'config_created' : 'config_updated',
      title: `${config.created ? '创建' : '更新'}任务「${TASK_NAME}」`,
      detail: `已写入订单模块的多节点业务流 demo，共 ${FLOW_DEFINITION.steps.length} 步。`,
      meta: {
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
      title: `${plan.created ? '创建' : '更新'}计划「${TASK_NAME} - 演示计划」`,
      detail: '已写入 simple / medium / complex 三层示例用例。',
      meta: {
        configUid: config.configUid,
        planVersion: plan.planVersion,
        generationModel: 'manual-demo',
        tiers: { simple: 1, medium: 1, complex: 1 },
      },
    });

    await conn.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          projectUid: String(project.project_uid),
          projectName: PROJECT_NAME,
          moduleUid: String(module.module_uid),
          moduleName: module.name,
          configUid: config.configUid,
          taskName: TASK_NAME,
          planUid: plan.planUid,
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
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
