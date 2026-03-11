import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test, type Page, type Route } from '@playwright/test';

type Actor = {
  userUid: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type Member = {
  memberUid: string;
  projectUid: string;
  userUid: string;
  role: 'owner' | 'editor' | 'viewer';
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  projectUid: string;
  name: string;
  description: string;
  coverImageUrl: string;
  authRequired: boolean;
  loginUrl: string;
  loginUsername: string;
  loginDescription: string;
  status: 'active';
  createdAt: string;
  updatedAt: string;
  moduleCount: number;
  taskCount: number;
  executionCount: number;
  passedExecutionCount: number;
  failedExecutionCount: number;
  activeExecutionCount: number;
  passRate: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  lastExecutionAt: string;
};

type Module = {
  moduleUid: string;
  projectUid: string;
  name: string;
  description: string;
  sortOrder: number;
  status: 'active';
  taskCount: number;
  executionCount: number;
  passedExecutionCount: number;
  failedExecutionCount: number;
  activeExecutionCount: number;
  passRate: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
  lastExecutionAt: string;
  createdAt: string;
  updatedAt: string;
};

type ScenarioStep = {
  stepUid: string;
  stepType: 'ui' | 'api' | 'assert' | 'extract' | 'cleanup';
  title: string;
  target: string;
  instruction: string;
  expectedResult: string;
  extractVariable: string;
};

type FlowDefinition = {
  version: number;
  entryUrl: string;
  sharedVariables: string[];
  expectedOutcome: string;
  cleanupNotes: string;
  steps: ScenarioStep[];
};

type Task = {
  configUid: string;
  projectUid: string;
  projectName: string;
  moduleUid: string;
  moduleName: string;
  sortOrder: number;
  name: string;
  targetUrl: string;
  featureDescription: string;
  taskMode: 'page' | 'scenario';
  flowDefinition: FlowDefinition | null;
  authRequired: boolean;
  authSource: 'project' | 'task' | 'none';
  loginUrl: string;
  loginUsername: string;
  loginPasswordMasked: string;
  loginDescription: string;
  legacyAuthRequired: boolean;
  legacyLoginUrl: string;
  legacyLoginUsername: string;
  coverageMode: 'all_tiers';
  status: 'active';
  createdAt: string;
  updatedAt: string;
  latestPlanUid: string;
  latestPlanVersion: number;
  latestExecutionUid: string;
  latestExecutionStatus: string;
};

type Plan = {
  planUid: string;
  planTitle: string;
  projectUid: string;
  configUid: string;
  planVersion: number;
  planSummary: string;
  planCode: string;
  generatedFiles: Array<{ name: string; content: string; language: string }>;
  createdAt: string;
};

type PlanCase = {
  caseUid: string;
  tier: 'simple' | 'medium' | 'complex';
  caseName: string;
  caseSteps: string[];
  expectedResult: string;
};

type ActivityItem = {
  activityUid: string;
  projectUid: string;
  entityType: 'config' | 'plan';
  entityUid: string;
  actionType: string;
  actorLabel: string;
  title: string;
  detail: string;
  meta: unknown;
  createdAt: string;
};

type MockState = {
  actor: Actor;
  members: Member[];
  project: Project;
  modules: Module[];
  tasks: Task[];
  plan: Plan | null;
  planCases: PlanCase[];
  activity: ActivityItem[];
};

const projectUid = 'proj_smoke';
const moduleUid = 'mod_checkout';
const configUid = 'cfg_checkout';
const planUid = 'plan_checkout_v1';
const now = '2026-03-10T10:30:00.000Z';
const appOrigin = process.env.SCENARIO_SMOKE_APP_URL || 'http://127.0.0.1:4187';
const appPort = new URL(appOrigin).port || '4187';

let smokeServer: ChildProcess | null = null;
let smokeServerOutput = '';

test.describe.configure({ timeout: 300_000 });

function appendServerOutput(chunk: Buffer | string) {
  smokeServerOutput += chunk.toString();
  if (smokeServerOutput.length > 12_000) {
    smokeServerOutput = smokeServerOutput.slice(-12_000);
  }
}

async function waitForServerReady(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    if (smokeServer && smokeServer.exitCode !== null) {
      throw new Error(`Scenario smoke server exited early.\n${smokeServerOutput}`);
    }

    try {
      const res = await fetch(`${appOrigin}/`, { redirect: 'manual' });
      if (res.ok || res.status === 307 || res.status === 308) return;
      lastError = `Unexpected status ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Scenario smoke server did not become ready: ${lastError}\n${smokeServerOutput}`);
}

async function stopSmokeServer() {
  if (!smokeServer || smokeServer.exitCode !== null) return;

  const proc = smokeServer;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve();
    }, 5_000);

    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });

    proc.kill('SIGTERM');
  });
}

function jsonResponse(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body),
  });
}

function makeState(): MockState {
  const actor: Actor = {
    userUid: 'usr_owner_1',
    displayName: 'Smoke Owner',
    email: 'owner@example.com',
    createdAt: now,
    updatedAt: now,
  };

  return {
    actor,
    members: [
      {
        memberUid: 'mem_owner_1',
        projectUid,
        userUid: actor.userUid,
        role: 'owner',
        displayName: actor.displayName,
        email: actor.email,
        createdAt: now,
        updatedAt: now,
      },
    ],
    project: {
      projectUid,
      name: 'Scenario Smoke Project',
      description: '用于业务流任务 smoke 回归',
      coverImageUrl: '',
      authRequired: false,
      loginUrl: '',
      loginUsername: '',
      loginDescription: '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      moduleCount: 1,
      taskCount: 0,
      executionCount: 0,
      passedExecutionCount: 0,
      failedExecutionCount: 0,
      activeExecutionCount: 0,
      passRate: 0,
      latestExecutionUid: '',
      latestExecutionStatus: '',
      lastExecutionAt: '',
    },
    modules: [
      {
        moduleUid,
        projectUid,
        name: '订单主流程',
        description: '聚焦创建商品与订单链路',
        sortOrder: 10,
        status: 'active',
        taskCount: 0,
        executionCount: 0,
        passedExecutionCount: 0,
        failedExecutionCount: 0,
        activeExecutionCount: 0,
        passRate: 0,
        latestExecutionUid: '',
        latestExecutionStatus: '',
        lastExecutionAt: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
    tasks: [],
    plan: null,
    planCases: [],
    activity: [],
  };
}

function syncCounts(state: MockState) {
  state.project.taskCount = state.tasks.length;
  state.project.updatedAt = now;
  state.modules = state.modules.map((module) => ({
    ...module,
    taskCount: state.tasks.filter((task) => task.moduleUid === module.moduleUid).length,
    updatedAt: now,
  }));
}

function pushActivity(state: MockState, item: Omit<ActivityItem, 'activityUid' | 'createdAt'>) {
  state.activity.unshift({
    activityUid: `act_${state.activity.length + 1}`,
    createdAt: now,
    ...item,
  });
}

function buildPlanArtifacts(task: Task) {
  const steps = task.flowDefinition?.steps || [];
  const expectedOutcome = task.flowDefinition?.expectedOutcome || '业务流执行成功';
  const cleanupNotes = task.flowDefinition?.cleanupNotes || '无';
  const sharedVariables = task.flowDefinition?.sharedVariables || [];

  const caseSteps = steps.map((step) => `${step.title}: ${step.instruction}`);
  const code = [
    `test('${task.name}', async ({ page }) => {`,
    `  await page.goto('${task.targetUrl}');`,
    ...steps.map((step) => `  // ${step.title}: ${step.expectedResult}`),
    `});`,
  ].join('\n');

  const plan: Plan = {
    planUid,
    planTitle: `${task.name} - 自动测试计划`,
    projectUid: task.projectUid,
    configUid: task.configUid,
    planVersion: 1,
    planSummary: `业务流 ${steps.length} 步，覆盖关键变量 ${sharedVariables.join(', ') || '无'}。`,
    planCode: code,
    generatedFiles: [
      {
        name: `${task.name.replace(/\s+/g, '-')}.spec.ts`,
        content: code,
        language: 'typescript',
      },
    ],
    createdAt: now,
  };

  const planCases: PlanCase[] = [
    {
      caseUid: 'case_simple',
      tier: 'simple',
      caseName: '主链路覆盖',
      caseSteps,
      expectedResult: expectedOutcome,
    },
    {
      caseUid: 'case_medium',
      tier: 'medium',
      caseName: '变量串联与结果校验',
      caseSteps: [
        `复用共享变量: ${sharedVariables.join(', ') || '无'}`,
        ...steps.map((step) => `校验 ${step.title} 的结果: ${step.expectedResult}`),
        `收尾: ${cleanupNotes}`,
      ],
      expectedResult: expectedOutcome,
    },
    {
      caseUid: 'case_complex',
      tier: 'complex',
      caseName: '异常与恢复路径',
      caseSteps: [
        '覆盖关键跳转失败时的恢复动作',
        ...steps.map((step) => `观察 ${step.title} 的错误提示和回滚行为`),
      ],
      expectedResult: '出现异常时能够定位失败步骤并保持数据可清理',
    },
  ];

  return { plan, planCases };
}

async function installApiMocks(page: Page) {
  const state = makeState();

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (method === 'GET' && pathname === `/api/projects/${projectUid}`) {
      syncCounts(state);
      return jsonResponse(route, {
        item: state.project,
        currentActor: state.actor,
        currentRole: 'owner',
      });
    }

    if (method === 'GET' && pathname === `/api/projects/${projectUid}/members`) {
      return jsonResponse(route, {
        items: state.members,
        currentActor: state.actor,
        currentRole: 'owner',
      });
    }

    if (method === 'GET' && pathname === `/api/projects/${projectUid}/modules`) {
      syncCounts(state);
      return jsonResponse(route, { items: state.modules });
    }

    if (method === 'GET' && pathname === `/api/projects/${projectUid}/activity`) {
      return jsonResponse(route, { items: state.activity.slice(0, Number(url.searchParams.get('limit') || 12)) });
    }

    if (method === 'GET' && pathname === '/api/test-configs') {
      const filtered = state.tasks.filter((task) => {
        const matchesProject = !url.searchParams.get('projectUid') || task.projectUid === url.searchParams.get('projectUid');
        const matchesModule = !url.searchParams.get('moduleUid') || task.moduleUid === url.searchParams.get('moduleUid');
        return matchesProject && matchesModule;
      });

      return jsonResponse(route, {
        page: 1,
        pageSize: 100,
        total: filtered.length,
        items: filtered,
      });
    }

    if (method === 'POST' && pathname === '/api/test-configs') {
      const body = request.postDataJSON() as {
        moduleUid: string;
        sortOrder: number;
        name: string;
        taskMode: 'page' | 'scenario';
        targetUrl: string;
        featureDescription: string;
        flowDefinition: FlowDefinition;
      };

      const task: Task = {
        configUid,
        projectUid,
        projectName: state.project.name,
        moduleUid: body.moduleUid,
        moduleName: state.modules.find((item) => item.moduleUid === body.moduleUid)?.name || '默认模块',
        sortOrder: body.sortOrder,
        name: body.name,
        taskMode: body.taskMode,
        targetUrl: body.targetUrl,
        featureDescription: body.featureDescription,
        flowDefinition: body.flowDefinition,
        authRequired: false,
        authSource: 'none',
        loginUrl: '',
        loginUsername: '',
        loginPasswordMasked: '',
        loginDescription: '',
        legacyAuthRequired: false,
        legacyLoginUrl: '',
        legacyLoginUsername: '',
        coverageMode: 'all_tiers',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        latestPlanUid: '',
        latestPlanVersion: 0,
        latestExecutionUid: '',
        latestExecutionStatus: '',
      };

      state.tasks = [task];
      syncCounts(state);
      pushActivity(state, {
        projectUid,
        entityType: 'config',
        entityUid: task.configUid,
        actionType: 'config_created',
        actorLabel: state.actor.displayName,
        title: `创建任务「${task.name}」`,
        detail: `${task.taskMode === 'scenario' ? '业务流' : '单页面'}任务已创建。`,
        meta: {
          taskMode: task.taskMode,
          stepCount: task.flowDefinition?.steps.length || 0,
        },
      });

      return jsonResponse(route, { item: task }, 201);
    }

    if (method === 'POST' && pathname === `/api/test-configs/${configUid}/generate-plan`) {
      const task = state.tasks.find((item) => item.configUid === configUid);
      if (!task) return jsonResponse(route, { error: '任务不存在' }, 404);

      task.latestPlanUid = planUid;
      task.latestPlanVersion = 1;
      task.updatedAt = now;
      const artifacts = buildPlanArtifacts(task);
      state.plan = artifacts.plan;
      state.planCases = artifacts.planCases;
      pushActivity(state, {
        projectUid,
        entityType: 'plan',
        entityUid: planUid,
        actionType: 'plan_generated',
        actorLabel: state.actor.displayName,
        title: `为任务「${task.name}」生成计划`,
        detail: `已生成 ${state.planCases.length} 个分层用例。`,
        meta: {
          configUid: task.configUid,
          planUid,
        },
      });

      return jsonResponse(route, { planUid, planVersion: 1 });
    }

    if (method === 'GET' && pathname === `/api/test-plans/${planUid}`) {
      if (!state.plan) return jsonResponse(route, { error: '测试计划不存在' }, 404);
      return jsonResponse(route, {
        plan: state.plan,
        cases: state.planCases,
      });
    }

    return jsonResponse(route, { error: `Unhandled API route: ${method} ${pathname}` }, 404);
  });
}

test.beforeAll(async () => {
  smokeServerOutput = '';
  smokeServer = spawn(
    process.execPath,
    ['scripts/playwright-scenario-smoke-server.mjs'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: appPort,
        NEXT_DIST_DIR: '.next-e2e',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  smokeServer.stdout?.on('data', appendServerOutput);
  smokeServer.stderr?.on('data', appendServerOutput);

  await waitForServerReady();
});

test.afterAll(async () => {
  await stopSmokeServer();
});

test('smoke: scenario task flow renders structured plan preview @smoke', async ({ page }) => {
  test.setTimeout(120_000);
  await installApiMocks(page);

  await page.goto(`${appOrigin}/projects/${projectUid}`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Scenario Smoke Project' })).toBeVisible();
  await expect(page.getByText('1 模块')).toBeVisible();

  await page.getByRole('button', { name: '新建任务' }).click();
  await expect(page.getByRole('heading', { name: '新建任务' })).toBeVisible();

  await page.getByPlaceholder('例如：新增商品主流程').fill('跨页面下单流程');
  await page.getByRole('button', { name: '业务流任务' }).click();
  await expect(page.getByText('业务流定义')).toBeVisible();

  await page.getByPlaceholder('https://example.com/path').fill('https://example.com/products/new');
  await page
    .getByPlaceholder('描述这条业务流的业务背景、关键断点、需要覆盖的风险和最终目标。')
    .fill('创建商品后提交订单，并验证订单详情中的商品信息。');
  await page
    .getByPlaceholder('例如：创建商品后生成订单，订单详情中商品信息一致。')
    .fill('订单详情中的商品 ID 与新建商品一致。');
  await page.getByPlaceholder('例如：productId\norderId').fill('productId\norderId');
  await page.getByPlaceholder('例如：删除测试数据、回滚状态、释放锁定资源。').fill('删除创建的商品和订单测试数据。');

  const stepTitleInputs = page.locator('input[placeholder="例如：提交商品创建表单"]');
  const stepTargetInputs = page.locator('input[placeholder="/products/new"]');
  const stepOutputInputs = page.locator('input[placeholder="例如：productId"]');
  const stepInstructionInputs = page.locator('textarea[placeholder="说明这个步骤要执行什么动作、如何与上一步衔接。"]');
  const stepExpectedInputs = page.locator('textarea[placeholder="例如：接口返回 200，页面提示保存成功，变量被正确提取。"]');

  await stepTitleInputs.nth(0).fill('创建商品');
  await stepTargetInputs.nth(0).fill('/products/new');
  await stepOutputInputs.nth(0).fill('productId');
  await stepInstructionInputs.nth(0).fill('填写商品表单并保存。');
  await stepExpectedInputs.nth(0).fill('商品创建成功并返回 productId。');

  const addStepButton = page.getByRole('button', { name: '新增步骤' });

  await addStepButton.click({ force: true });
  await expect(page.getByText('2 个步骤')).toBeVisible();
  await stepTitleInputs.nth(1).fill('提交订单');
  await stepTargetInputs.nth(1).fill('/orders/new');
  await stepOutputInputs.nth(1).fill('orderId');
  await stepInstructionInputs.nth(1).fill('选择商品并提交订单。');
  await stepExpectedInputs.nth(1).fill('订单创建成功并返回 orderId。');

  await addStepButton.click({ force: true });
  await expect(page.getByText('3 个步骤')).toBeVisible();
  await stepTitleInputs.nth(2).fill('校验订单详情');
  await stepTargetInputs.nth(2).fill('/orders/{{orderId}}');
  await stepInstructionInputs.nth(2).fill('打开订单详情并校验商品信息。');
  await stepExpectedInputs.nth(2).fill('商品 ID 与 productId 一致。');

  await page.getByRole('button', { name: '创建', exact: true }).click();

  await expect(page.getByRole('heading', { name: '新建任务' })).toHaveCount(0);

  const taskRow = page.locator('tr').filter({ hasText: '跨页面下单流程' });
  await expect(taskRow).toContainText('业务流');
  await expect(taskRow).toContainText('3 步');
  await expect(taskRow).toContainText('创建商品 / 提交订单 / 校验订单详情');

  await taskRow.getByTitle('生成测试计划').click();

  await expect(page.getByRole('heading', { name: '测试计划预览' })).toBeVisible();
  await expect(page.getByText('跨页面下单流程 - 自动测试计划')).toBeVisible();
  await expect(page.getByText('业务流 3 步，覆盖关键变量 productId, orderId。')).toBeVisible();

  const simpleCase = page.locator('div').filter({ hasText: '主链路覆盖' }).first();
  await expect(simpleCase).toContainText('订单详情中的商品 ID 与新建商品一致。');
  await expect(simpleCase).toContainText('创建商品: 填写商品表单并保存。');
  await expect(simpleCase).toContainText('提交订单: 选择商品并提交订单。');
  await expect(simpleCase).toContainText('校验订单详情: 打开订单详情并校验商品信息。');

  const mediumCase = page.locator('div').filter({ hasText: '变量串联与结果校验' }).first();
  await expect(mediumCase).toContainText('复用共享变量: productId, orderId');
  await expect(mediumCase).toContainText('收尾: 删除创建的商品和订单测试数据。');

  await expect(page.locator('pre')).toContainText("test('跨页面下单流程'");
  await expect(page.locator('pre')).toContainText('// 创建商品: 商品创建成功并返回 productId。');
});
