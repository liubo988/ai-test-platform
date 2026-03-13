import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test, type Page, type Route } from '@playwright/test';
import { deriveCapabilitiesFromKnowledgeDocument } from '../../lib/knowledge-capability-deriver';
import { buildKnowledgeChunksFromManual, draftRecipeFromRequirement } from '../../lib/project-knowledge';

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

type KnowledgeDocument = {
  documentUid: string;
  projectUid: string;
  name: string;
  sourceType: 'manual' | 'notes' | 'execution' | 'system';
  sourcePath: string;
  sourceHash: string;
  status: 'active' | 'archived';
  chunkCount: number;
  meta: unknown;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeChunk = {
  chunkUid: string;
  documentUid: string;
  projectUid: string;
  heading: string;
  content: string;
  keywords: string[];
  sourceLineStart: number;
  sourceLineEnd: number;
  tokenEstimate: number;
  sortOrder: number;
  meta: unknown;
  createdAt: string;
  updatedAt: string;
};

type Capability = {
  capabilityUid: string;
  projectUid: string;
  slug: string;
  name: string;
  description: string;
  capabilityType: 'auth' | 'navigation' | 'action' | 'assertion' | 'query' | 'composite';
  entryUrl: string;
  triggerPhrases: string[];
  preconditions: string[];
  steps: string[];
  assertions: string[];
  cleanupNotes: string;
  dependsOn: string[];
  sortOrder: number;
  status: 'active' | 'archived';
  sourceDocumentUid: string;
  meta: unknown;
  createdAt: string;
  updatedAt: string;
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
  entityType: 'config' | 'plan' | 'knowledge' | 'capability';
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
  knowledgeDocuments: KnowledgeDocument[];
  knowledgeChunks: KnowledgeChunk[];
  capabilities: Capability[];
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
    knowledgeDocuments: [],
    knowledgeChunks: [],
    capabilities: [],
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

    if (method === 'GET' && pathname === `/api/projects/${projectUid}/knowledge`) {
      const status = url.searchParams.get('status') || 'active';
      const documentUid = url.searchParams.get('documentUid') || '';
      const includeChunks = url.searchParams.get('includeChunks') === 'true' || Boolean(documentUid);
      const limit = Number(url.searchParams.get('limit') || 200);
      const documents = state.knowledgeDocuments.filter((item) => status === 'all' || item.status === status);
      const chunks = includeChunks
        ? state.knowledgeChunks
            .filter((item) => {
              if (documentUid && item.documentUid !== documentUid) return false;
              const document = state.knowledgeDocuments.find((doc) => doc.documentUid === item.documentUid);
              return status === 'all' || document?.status === status;
            })
            .slice(0, limit)
        : [];

      return jsonResponse(route, { documents, chunks });
    }

    if (method === 'POST' && pathname === `/api/projects/${projectUid}/knowledge`) {
      const body = request.postDataJSON() as {
        name?: string;
        sourceType?: KnowledgeDocument['sourceType'];
        sourcePath?: string;
        content?: string;
      };

      const name = String(body.name || '').trim();
      const content = String(body.content || '');
      if (!name) return jsonResponse(route, { error: '缺少必要字段: name' }, 400);
      if (!content.trim()) return jsonResponse(route, { error: '缺少知识内容: content/chunks' }, 400);

      const existing = state.knowledgeDocuments.find((item) => item.name === name) || null;
      const documentUid = existing?.documentUid || `kdoc_${state.knowledgeDocuments.length + 1}`;
      const preparedChunks = buildKnowledgeChunksFromManual(content).map((item, index) => ({
        chunkUid: `kch_${documentUid}_${index + 1}`,
        documentUid,
        projectUid,
        heading: item.heading,
        content: item.content,
        keywords: item.keywords,
        sourceLineStart: item.sourceLineStart,
        sourceLineEnd: item.sourceLineEnd,
        tokenEstimate: item.tokenEstimate,
        sortOrder: index + 1,
        meta: null,
        createdAt: now,
        updatedAt: now,
      }));

      const document: KnowledgeDocument = {
        documentUid,
        projectUid,
        name,
        sourceType: body.sourceType || 'manual',
        sourcePath: String(body.sourcePath || ''),
        sourceHash: `hash_${documentUid}`,
        status: 'active',
        chunkCount: preparedChunks.length,
        meta: null,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      state.knowledgeDocuments = [document, ...state.knowledgeDocuments.filter((item) => item.documentUid !== documentUid)];
      state.knowledgeChunks = [
        ...preparedChunks,
        ...state.knowledgeChunks.filter((item) => item.documentUid !== documentUid),
      ];
      pushActivity(state, {
        projectUid,
        entityType: 'knowledge',
        entityUid: documentUid,
        actionType: existing ? 'knowledge_updated' : 'knowledge_imported',
        actorLabel: state.actor.displayName,
        title: `${existing ? '更新' : '导入'}知识文档「${name}」`,
        detail: `已写入 ${preparedChunks.length} 个知识块。`,
        meta: {
          chunkCount: preparedChunks.length,
        },
      });

      return jsonResponse(route, { document, chunks: preparedChunks }, 201);
    }

    const deriveCapabilityMatch = pathname.match(new RegExp(`^/api/projects/${projectUid}/knowledge/([^/]+)/derive-capabilities$`));
    if (method === 'POST' && deriveCapabilityMatch) {
      const documentUid = deriveCapabilityMatch[1];
      const existingDocument = state.knowledgeDocuments.find((item) => item.documentUid === documentUid) || null;
      if (!existingDocument) return jsonResponse(route, { error: '知识文档不存在' }, 404);
      const body = request.postDataJSON() as { chunkUid?: string } | null;
      const selectedChunks = state.knowledgeChunks.filter((item) => {
        if (item.documentUid !== documentUid) return false;
        if (body?.chunkUid && item.chunkUid !== body.chunkUid) return false;
        return true;
      });
      if (selectedChunks.length === 0) return jsonResponse(route, { error: '未找到可沉淀的知识块' }, 404);

      const derived = deriveCapabilitiesFromKnowledgeDocument({
        document: existingDocument,
        chunks: selectedChunks,
        projectLoginUrl: state.project.loginUrl,
        existingCapabilities: state.capabilities,
      });

      const items: Capability[] = [];
      for (const input of derived.items) {
        const existing = state.capabilities.find((item) => item.slug === input.slug) || null;
        const capabilityUid = existing?.capabilityUid || `cap_${state.capabilities.length + items.length + 1}`;
        const capability: Capability = {
          capabilityUid,
          projectUid,
          slug: input.slug,
          name: input.name,
          description: input.description,
          capabilityType: input.capabilityType,
          entryUrl: input.entryUrl,
          triggerPhrases: input.triggerPhrases,
          preconditions: input.preconditions,
          steps: input.steps,
          assertions: input.assertions,
          cleanupNotes: input.cleanupNotes,
          dependsOn: input.dependsOn,
          sortOrder: input.sortOrder,
          status: 'active',
          sourceDocumentUid: input.sourceDocumentUid,
          meta: input.meta,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        state.capabilities = [capability, ...state.capabilities.filter((item) => item.slug !== capability.slug)];
        items.push(capability);
      }

      return jsonResponse(route, { items, skipped: derived.skipped, summary: derived.summary }, 201);
    }

    const knowledgeMatch = pathname.match(new RegExp(`^/api/projects/${projectUid}/knowledge/([^/]+)$`));
    if (method === 'DELETE' && knowledgeMatch) {
      const documentUid = knowledgeMatch[1];
      const existing = state.knowledgeDocuments.find((item) => item.documentUid === documentUid) || null;
      if (!existing) return jsonResponse(route, { error: '知识文档不存在' }, 404);

      existing.status = 'archived';
      existing.updatedAt = now;
      pushActivity(state, {
        projectUid,
        entityType: 'knowledge',
        entityUid: documentUid,
        actionType: 'knowledge_archived',
        actorLabel: state.actor.displayName,
        title: `归档知识文档「${existing.name}」`,
        detail: `知识文档已归档，不再参与 recipe 证据检索。`,
        meta: {
          sourceType: existing.sourceType,
          sourcePath: existing.sourcePath,
          chunkCount: existing.chunkCount,
        },
      });
      return jsonResponse(route, { ok: true });
    }

    const knowledgeRestoreMatch = pathname.match(new RegExp(`^/api/projects/${projectUid}/knowledge/([^/]+)/restore$`));
    if (method === 'POST' && knowledgeRestoreMatch) {
      const documentUid = knowledgeRestoreMatch[1];
      const existing = state.knowledgeDocuments.find((item) => item.documentUid === documentUid) || null;
      if (!existing) return jsonResponse(route, { error: '知识文档不存在' }, 404);

      existing.status = 'active';
      existing.updatedAt = now;
      pushActivity(state, {
        projectUid,
        entityType: 'knowledge',
        entityUid: documentUid,
        actionType: 'knowledge_restored',
        actorLabel: state.actor.displayName,
        title: `恢复知识文档「${existing.name}」`,
        detail: `知识文档已恢复，可重新参与 recipe 证据检索。`,
        meta: {
          sourceType: existing.sourceType,
          sourcePath: existing.sourcePath,
          chunkCount: existing.chunkCount,
        },
      });
      return jsonResponse(route, { ok: true });
    }

    if (method === 'GET' && pathname === `/api/projects/${projectUid}/capabilities`) {
      const status = url.searchParams.get('status') || 'active';
      const items = state.capabilities
        .filter((item) => status === 'all' || item.status === status)
        .sort((left, right) => left.sortOrder - right.sortOrder);
      return jsonResponse(route, { items });
    }

    if (method === 'POST' && pathname === `/api/projects/${projectUid}/capabilities`) {
      const payload = request.postDataJSON() as { items?: Array<Partial<Capability>> } | Partial<Capability>;
      const inputs = Array.isArray((payload as { items?: unknown[] }).items)
        ? ((payload as { items: Array<Partial<Capability>> }).items || [])
        : [payload as Partial<Capability>];

      const items: Capability[] = [];
      for (const input of inputs) {
        const slug = String(input.slug || '').trim().toLowerCase();
        const name = String(input.name || '').trim();
        const description = String(input.description || '').trim();
        if (!slug || !name || !description) {
          return jsonResponse(route, { error: '能力缺少必要字段: slug/name/description' }, 400);
        }

        const existing = state.capabilities.find((item) => item.slug === slug) || null;
        const capabilityUid = existing?.capabilityUid || `cap_${state.capabilities.length + items.length + 1}`;
        const capability: Capability = {
          capabilityUid,
          projectUid,
          slug,
          name,
          description,
          capabilityType: (input.capabilityType as Capability['capabilityType']) || 'action',
          entryUrl: String(input.entryUrl || ''),
          triggerPhrases: Array.isArray(input.triggerPhrases) ? input.triggerPhrases.map(String) : [],
          preconditions: Array.isArray(input.preconditions) ? input.preconditions.map(String) : [],
          steps: Array.isArray(input.steps) ? input.steps.map(String) : [],
          assertions: Array.isArray(input.assertions) ? input.assertions.map(String) : [],
          cleanupNotes: String(input.cleanupNotes || ''),
          dependsOn: Array.isArray(input.dependsOn) ? input.dependsOn.map(String) : [],
          sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : existing?.sortOrder || 100,
          status: 'active',
          sourceDocumentUid: String(input.sourceDocumentUid || ''),
          meta: null,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        state.capabilities = [
          capability,
          ...state.capabilities.filter((item) => item.slug !== slug),
        ];
        items.push(capability);
        pushActivity(state, {
          projectUid,
          entityType: 'capability',
          entityUid: capabilityUid,
          actionType: existing ? 'capability_updated' : 'capability_created',
          actorLabel: state.actor.displayName,
          title: `${existing ? '更新' : '创建'}能力「${name}」`,
          detail: `能力标识 ${slug}，类型 ${capability.capabilityType}。`,
          meta: {
            slug,
            capabilityType: capability.capabilityType,
          },
        });
      }

      return jsonResponse(route, { items }, 201);
    }

    const capabilityMatch = pathname.match(new RegExp(`^/api/projects/${projectUid}/capabilities/([^/]+)$`));
    if (method === 'DELETE' && capabilityMatch) {
      const capabilityUid = capabilityMatch[1];
      const existing = state.capabilities.find((item) => item.capabilityUid === capabilityUid) || null;
      if (!existing) return jsonResponse(route, { error: '能力不存在' }, 404);

      existing.status = 'archived';
      existing.updatedAt = now;
      pushActivity(state, {
        projectUid,
        entityType: 'capability',
        entityUid: capabilityUid,
        actionType: 'capability_archived',
        actorLabel: state.actor.displayName,
        title: `归档能力「${existing.name}」`,
        detail: `能力 ${existing.slug} 已归档，不再参与 recipe 编排。`,
        meta: {
          slug: existing.slug,
          capabilityType: existing.capabilityType,
        },
      });
      return jsonResponse(route, { ok: true });
    }

    const capabilityRestoreMatch = pathname.match(new RegExp(`^/api/projects/${projectUid}/capabilities/([^/]+)/restore$`));
    if (method === 'POST' && capabilityRestoreMatch) {
      const capabilityUid = capabilityRestoreMatch[1];
      const existing = state.capabilities.find((item) => item.capabilityUid === capabilityUid) || null;
      if (!existing) return jsonResponse(route, { error: '能力不存在' }, 404);

      existing.status = 'active';
      existing.updatedAt = now;
      pushActivity(state, {
        projectUid,
        entityType: 'capability',
        entityUid: capabilityUid,
        actionType: 'capability_restored',
        actorLabel: state.actor.displayName,
        title: `恢复能力「${existing.name}」`,
        detail: `能力 ${existing.slug} 已恢复，可重新参与 recipe 编排。`,
        meta: {
          slug: existing.slug,
          capabilityType: existing.capabilityType,
        },
      });
      return jsonResponse(route, { ok: true });
    }

    if (method === 'POST' && pathname === `/api/projects/${projectUid}/draft-recipe`) {
      const body = request.postDataJSON() as { requirement?: string; includeAuthCapability?: boolean; knowledgeLimit?: number };
      const requirement = String(body.requirement || '').trim();
      if (!requirement) return jsonResponse(route, { error: '缺少必要字段: requirement' }, 400);
      const activeCapabilities = state.capabilities.filter((item) => item.status === 'active');
      const activeDocumentUids = new Set(
        state.knowledgeDocuments.filter((item) => item.status === 'active').map((item) => item.documentUid)
      );
      const activeKnowledgeChunks = state.knowledgeChunks.filter((item) => activeDocumentUids.has(item.documentUid));
      if (activeCapabilities.length === 0 && activeKnowledgeChunks.length === 0) {
        return jsonResponse(route, { error: '项目还没有知识或能力数据，请先导入手册和能力库' }, 409);
      }

      const recipe = draftRecipeFromRequirement({
        requirement,
        includeAuthCapability: body.includeAuthCapability ?? state.project.authRequired,
        capabilities: activeCapabilities.map((item) => ({
          slug: item.slug,
          name: item.name,
          description: item.description,
          capabilityType: item.capabilityType,
          entryUrl: item.entryUrl,
          triggerPhrases: item.triggerPhrases,
          preconditions: item.preconditions,
          steps: item.steps,
          assertions: item.assertions,
          cleanupNotes: item.cleanupNotes,
          dependsOn: item.dependsOn,
          sortOrder: item.sortOrder,
          meta: item.meta,
        })),
        knowledgeChunks: activeKnowledgeChunks
          .slice(0, Number(body.knowledgeLimit || 800))
          .map((item) => ({
            heading: item.heading,
            content: item.content,
            keywords: item.keywords,
            sourceLineStart: item.sourceLineStart,
            sourceLineEnd: item.sourceLineEnd,
            tokenEstimate: item.tokenEstimate,
          })),
      });

      return jsonResponse(route, {
        recipe,
        project: {
          projectUid: state.project.projectUid,
          name: state.project.name,
          authRequired: state.project.authRequired,
        },
        capabilityCount: activeCapabilities.length,
        knowledgeChunkCount: activeKnowledgeChunks.length,
      });
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

test('smoke: intent workbench imports context and creates a scenario task draft @smoke', async ({ page }) => {
  test.setTimeout(120_000);
  await installApiMocks(page);

  await page.goto(`${appOrigin}/projects/${projectUid}`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Scenario Smoke Project' })).toBeVisible();

  await page.getByRole('button', { name: '需求编排', exact: true }).click();
  const workbench = page.locator('div.fixed.inset-0.z-50').last();
  await expect(workbench.getByRole('heading', { name: '需求编排工作台' })).toBeVisible();

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();
  await expect(workbench.getByRole('heading', { name: '知识文档', exact: true })).toBeVisible();

  await workbench.getByLabel('知识文档名称').fill('GBS 商机列表手册');
  await workbench.getByLabel('知识来源路径').fill('tmp/manuals/gbs-business-list.txt');
  await workbench.getByLabel('知识文档内容').fill(
    [
      '商机列表',
      '支持按手机号、联系人姓名检索商机。',
      '搜索结果会展示商机ID、手机号和商机进展。',
      '',
      '新增商机',
      '提交后可在商机列表中查询落库结果。',
    ].join('\n')
  );
  await workbench.getByRole('button', { name: '导入知识' }).click();

  await expect(workbench.getByText('知识文档「GBS 商机列表手册」已导入')).toBeVisible();
  await expect(workbench.getByText('当前预览：GBS 商机列表手册')).toBeVisible();
  await expect(workbench.getByText('支持按手机号、联系人姓名检索商机。')).toBeVisible();

  await workbench.getByRole('button', { name: '稳定能力', exact: true }).click();
  await expect(workbench.getByRole('heading', { name: '稳定能力', exact: true })).toBeVisible();
  await workbench.getByRole('button', { name: '新增稳定能力' }).click();
  await workbench.getByRole('button', { name: '命中与前置', exact: true }).click();
  await workbench.getByRole('button', { name: '动作与断言', exact: true }).click();

  await workbench.getByLabel('能力标识').fill('navigation.business-list-page');
  await workbench.getByLabel('能力类型').selectOption('navigation');
  await workbench.getByLabel('能力名称').fill('打开商机列表页');
  await workbench.getByLabel('能力入口地址').fill('https://uat.example.com/#/business/list');
  await workbench.getByLabel('能力描述').fill('进入商机列表页并准备执行检索。');
  await workbench.getByLabel('能力触发短语').fill('商机列表\n打开商机列表');
  await workbench.getByLabel('能力前置条件').fill('已登录系统');
  await workbench.getByLabel('能力动作步骤').fill('进入商机列表页');
  await workbench.getByLabel('能力断言结果').fill('商机列表页加载完成');
  await workbench.getByRole('button', { name: '保存能力' }).click();

  await expect(workbench.getByText('能力「打开商机列表页」已保存')).toBeVisible();

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();
  await workbench.getByRole('button', { name: '设为能力来源', exact: true }).click();
  await workbench.getByRole('button', { name: '命中与前置', exact: true }).click();
  await workbench.getByRole('button', { name: '动作与断言', exact: true }).click();
  await workbench.getByRole('button', { name: '清理与依赖', exact: true }).click();
  await workbench.getByLabel('能力标识').fill('business.list-search-by-phone');
  await workbench.getByLabel('能力类型').selectOption('query');
  await workbench.getByLabel('能力名称').fill('商机列表按手机号检索');
  await workbench.getByLabel('能力入口地址').fill('https://uat.example.com/#/business/list');
  await workbench.getByLabel('能力描述').fill('按手机号查询商机并读取落库结果。');
  await workbench.getByLabel('能力触发短语').fill('按手机号\n手机号校验落库\n校验落库');
  await workbench.getByLabel('能力前置条件').fill('已打开商机列表页');
  await workbench.getByLabel('能力动作步骤').fill('输入手机号并搜索\n读取商机ID、手机号和商机进展');
  await workbench.getByLabel('能力断言结果').fill('列表展示商机ID和手机号\n商机进展符合预期');
  await workbench.getByLabel('能力清理说明').fill('记录商机ID供人工清理');
  await workbench.getByLabel('能力依赖标识').fill('navigation.business-list-page');
  await workbench.getByRole('button', { name: '保存能力' }).click();

  await expect(workbench.getByText('能力「商机列表按手机号检索」已保存')).toBeVisible();

  await workbench.getByRole('button', { name: '需求编排', exact: true }).click();
  await workbench.getByLabel('需求描述').fill('在商机列表按手机号校验落库结果');
  await workbench.getByRole('button', { name: '生成 recipe' }).click();

  await expect(workbench.getByText('编排结果')).toBeVisible();
  await expect(workbench).toContainText('打开商机列表页');
  await expect(workbench).toContainText('商机列表按手机号检索');
  await expect(workbench.getByText('手册证据')).toBeVisible();

  await workbench.getByRole('button', { name: '写入任务草稿' }).click();

  await expect(page.getByRole('heading', { name: '新建任务' })).toBeVisible();
  await expect(page.getByPlaceholder('例如：新增商品主流程')).toHaveValue('在商机列表按手机号校验落库结果');
  await expect(page.getByText('业务流定义')).toBeVisible();
  await expect(page.getByText('2 个步骤')).toBeVisible();
  await expect(page.getByPlaceholder('https://example.com/path')).toHaveValue('https://uat.example.com/#/business/list');

  await page.getByRole('button', { name: '创建', exact: true }).click();

  await expect(page.getByRole('heading', { name: '新建任务' })).toHaveCount(0);

  const taskRow = page.locator('tr').filter({ hasText: '在商机列表按手机号校验落库结果' });
  await expect(taskRow).toContainText('业务流');
  await expect(taskRow).toContainText('2 步');
  await expect(taskRow).toContainText('打开商机列表页 / 商机列表按手机号检索');
});

test('smoke: intent workbench auto-derives stable capabilities from knowledge chunks @smoke', async ({ page }) => {
  test.setTimeout(120_000);
  await installApiMocks(page);

  await page.goto(`${appOrigin}/projects/${projectUid}`, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: '需求编排', exact: true }).click();
  const workbench = page.locator('div.fixed.inset-0.z-50').last();
  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();

  await workbench.getByLabel('知识文档名称').fill('GBS 自动沉淀手册');
  await workbench.getByLabel('知识文档内容').fill(
    [
      '商机列表',
      '支持按手机号、联系人姓名检索商机。',
      '搜索结果会展示商机ID、手机号和商机进展。',
    ].join('\n')
  );
  await workbench.getByRole('button', { name: '导入知识' }).click();
  await expect(workbench.getByText('知识文档「GBS 自动沉淀手册」已导入')).toBeVisible();

  await workbench.getByRole('button', { name: '自动沉淀能力' }).click();

  await expect(workbench.getByText(/已沉淀 \d+ 条能力|没有新增可沉淀能力/)).toBeVisible();
  await expect(workbench).toContainText('进入商机列表页');
  await expect(workbench).toContainText('知识提炼');
});

test('smoke: intent workbench blocks incomplete recipe drafts when requirement coverage has gaps @smoke', async ({ page }) => {
  test.setTimeout(120_000);
  await installApiMocks(page);

  await page.goto(`${appOrigin}/projects/${projectUid}`, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: '需求编排', exact: true }).click();
  const workbench = page.locator('div.fixed.inset-0.z-50').last();
  await expect(workbench.getByRole('heading', { name: '需求编排工作台' })).toBeVisible();

  await workbench.getByRole('button', { name: '稳定能力', exact: true }).click();
  await workbench.getByRole('button', { name: '新增稳定能力' }).click();
  await workbench.getByRole('button', { name: '命中与前置', exact: true }).click();
  await workbench.getByRole('button', { name: '动作与断言', exact: true }).click();
  await workbench.getByLabel('能力标识').fill('business.create-core');
  await workbench.getByLabel('能力类型').selectOption('action');
  await workbench.getByLabel('能力名称').fill('创建商机主链路');
  await workbench.getByLabel('能力入口地址').fill('https://uat.example.com/#/business/create');
  await workbench.getByLabel('能力描述').fill('填写商机最小必填并提交。');
  await workbench.getByLabel('能力触发短语').fill('创建商机\n商机提交');
  await workbench.getByLabel('能力前置条件').fill('已进入创建商机页');
  await workbench.getByLabel('能力动作步骤').fill('填写最小必填并提交');
  await workbench.getByLabel('能力断言结果').fill('提交成功');
  await workbench.getByRole('button', { name: '保存能力' }).click();

  await expect(workbench.getByText('能力「创建商机主链路」已保存')).toBeVisible();

  await workbench.getByRole('button', { name: '需求编排', exact: true }).click();
  await workbench.getByLabel('需求描述').fill('创建商机并生成订单');
  await workbench.getByRole('button', { name: '生成 recipe' }).click();

  await expect(workbench.getByText('编排结果')).toBeVisible();
  await expect(workbench).toContainText('未命中的需求片段：生成订单');
  await expect(workbench).toContainText('已覆盖 · 创建商机');
  await expect(workbench).toContainText('未覆盖 · 生成订单');
  await expect(workbench.getByRole('button', { name: '写入任务草稿' })).toBeDisabled();
});

test('smoke: intent workbench edits an existing capability and reuses it for recipe matching @smoke', async ({ page }) => {
  test.setTimeout(120_000);
  await installApiMocks(page);

  await page.goto(`${appOrigin}/projects/${projectUid}`, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: '需求编排', exact: true }).click();
  const workbench = page.locator('div.fixed.inset-0.z-50').last();
  await expect(workbench.getByRole('heading', { name: '需求编排工作台' })).toBeVisible();

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();

  await workbench.getByLabel('知识文档名称').fill('GBS 商机列表更新手册');
  await workbench.getByLabel('知识文档内容').fill(
    [
      '商机列表',
      '支持按手机号和联系人姓名检索商机。',
      '搜索结果会展示商机ID和联系人姓名。',
    ].join('\n')
  );
  await workbench.getByRole('button', { name: '导入知识' }).click();
  await expect(workbench.getByText('知识文档「GBS 商机列表更新手册」已导入')).toBeVisible();

  await workbench.getByRole('button', { name: '稳定能力', exact: true }).click();
  await workbench.getByRole('button', { name: '新增稳定能力' }).click();
  await workbench.getByRole('button', { name: '命中与前置', exact: true }).click();
  await workbench.getByRole('button', { name: '动作与断言', exact: true }).click();

  await workbench.getByLabel('能力标识').fill('business.list-search');
  await workbench.getByLabel('能力类型').selectOption('query');
  await workbench.getByLabel('能力名称').fill('商机列表检索');
  await workbench.getByLabel('能力入口地址').fill('https://uat.example.com/#/business/list');
  await workbench.getByLabel('能力描述').fill('按手机号检索商机。');
  await workbench.getByLabel('能力触发短语').fill('按手机号检索');
  await workbench.getByLabel('能力前置条件').fill('已打开商机列表页');
  await workbench.getByLabel('能力动作步骤').fill('输入手机号并搜索');
  await workbench.getByLabel('能力断言结果').fill('列表展示匹配商机');
  await workbench.getByRole('button', { name: '保存能力' }).click();
  await expect(workbench.getByText('能力「商机列表检索」已保存')).toBeVisible();

  await workbench.getByRole('button', { name: '编辑能力 商机列表检索' }).click();

  await workbench.getByLabel('能力名称').fill('商机列表联合检索');
  await workbench.getByLabel('能力描述').fill('按手机号和联系人姓名联合检索商机。');
  await workbench.getByLabel('能力触发短语').fill('联系人姓名检索\n联合检索');
  await workbench.getByLabel('能力动作步骤').fill('输入联系人姓名并搜索');
  await workbench.getByLabel('能力断言结果').fill('列表展示匹配商机与联系人姓名');
  await workbench.getByRole('button', { name: '更新能力' }).click();

  await expect(workbench.getByText('能力「商机列表联合检索」已保存')).toBeVisible();
  await expect(workbench).toContainText('商机列表联合检索');
  await expect(workbench).toContainText('按手机号和联系人姓名联合检索商机。');

  await workbench.getByRole('button', { name: '需求编排', exact: true }).click();
  await workbench.getByLabel('需求描述').fill('按联系人姓名检索商机');
  await workbench.getByRole('button', { name: '生成 recipe' }).click();

  await expect(workbench.getByText('编排结果')).toBeVisible();
  await expect(workbench).toContainText('商机列表联合检索');
  await expect(workbench.getByText('列表展示匹配商机与联系人姓名')).toBeVisible();
});

test('smoke: archived capability is excluded from recipe until restored @smoke', async ({ page }) => {
  test.setTimeout(120_000);
  await installApiMocks(page);

  await page.goto(`${appOrigin}/projects/${projectUid}`, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: '需求编排', exact: true }).click();
  const workbench = page.locator('div.fixed.inset-0.z-50').last();
  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();

  await workbench.getByLabel('知识文档名称').fill('GBS 归档能力手册');
  await workbench.getByLabel('知识文档内容').fill(
    [
      '商机列表',
      '支持按手机号检索商机。',
      '结果会展示商机ID。',
    ].join('\n')
  );
  await workbench.getByRole('button', { name: '导入知识' }).click();
  await expect(workbench.getByText('知识文档「GBS 归档能力手册」已导入')).toBeVisible();

  await workbench.getByRole('button', { name: '稳定能力', exact: true }).click();
  await workbench.getByRole('button', { name: '新增稳定能力' }).click();
  await workbench.getByRole('button', { name: '命中与前置', exact: true }).click();
  await workbench.getByRole('button', { name: '动作与断言', exact: true }).click();

  await workbench.getByLabel('能力标识').fill('business.archive-check');
  await workbench.getByLabel('能力类型').selectOption('query');
  await workbench.getByLabel('能力名称').fill('归档前商机检索能力');
  await workbench.getByLabel('能力入口地址').fill('https://uat.example.com/#/business/list');
  await workbench.getByLabel('能力描述').fill('按手机号检索商机。');
  await workbench.getByLabel('能力触发短语').fill('按手机号检索');
  await workbench.getByLabel('能力动作步骤').fill('输入手机号并搜索');
  await workbench.getByLabel('能力断言结果').fill('列表展示商机ID');
  await workbench.getByRole('button', { name: '保存能力' }).click();
  await expect(workbench.getByText('能力「归档前商机检索能力」已保存')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await workbench.getByRole('button', { name: '归档能力 归档前商机检索能力' }).click();

  await expect(workbench.getByText('能力「归档前商机检索能力」已归档')).toBeVisible();
  await expect(workbench).toContainText('0 启用 / 1 总计');
  await expect(workbench).toContainText('默认隐藏 1 个已归档能力');

  await workbench.getByRole('button', { name: '需求编排', exact: true }).click();
  await workbench.getByLabel('需求描述').fill('按手机号检索商机');
  await workbench.getByRole('button', { name: '生成 recipe' }).click();

  await expect(workbench.getByText('编排结果')).toBeVisible();
  await expect(workbench.getByText('当前 recipe 选中 0 个能力。')).toBeVisible();

  await workbench.getByRole('button', { name: '稳定能力', exact: true }).click();
  await workbench.getByRole('button', { name: '查看已归档 1 项' }).click();
  await workbench.getByRole('button', { name: '恢复能力 归档前商机检索能力' }).click();

  await expect(workbench.getByText('能力「归档前商机检索能力」已恢复')).toBeVisible();
  await expect(workbench).toContainText('1 启用 / 1 总计');

  await workbench.getByRole('button', { name: '需求编排', exact: true }).click();
  await workbench.getByRole('button', { name: '生成 recipe' }).click();
  await expect(workbench).toContainText('归档前商机检索能力');
});

test('smoke: archived knowledge is excluded from recipe evidence until restored @smoke', async ({ page }) => {
  test.setTimeout(120_000);
  await installApiMocks(page);

  await page.goto(`${appOrigin}/projects/${projectUid}`, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: '需求编排', exact: true }).click();
  const workbench = page.locator('div.fixed.inset-0.z-50').last();
  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();

  await workbench.getByLabel('知识文档名称').fill('GBS 归档知识手册');
  await workbench.getByLabel('知识文档内容').fill(
    [
      '商机列表',
      '支持按手机号检索商机。',
      '搜索结果展示商机ID与手机号。',
    ].join('\n')
  );
  await workbench.getByRole('button', { name: '导入知识' }).click();
  await expect(workbench.getByText('知识文档「GBS 归档知识手册」已导入')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await workbench.getByRole('button', { name: '归档知识文档 GBS 归档知识手册' }).click();

  await expect(workbench.getByText('知识文档「GBS 归档知识手册」已归档')).toBeVisible();
  await expect(workbench).toContainText('0');

  await workbench.getByRole('button', { name: '需求编排', exact: true }).click();
  await workbench.getByLabel('需求描述').fill('按手机号检索商机');
  await workbench.getByRole('button', { name: '生成 recipe' }).click();
  await expect(workbench.getByText('项目还没有知识或能力数据，请先导入手册和能力库')).toBeVisible();

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();
  await workbench.getByRole('button', { name: '恢复知识文档 GBS 归档知识手册' }).click();

  await expect(workbench.getByText('知识文档「GBS 归档知识手册」已恢复')).toBeVisible();

  await workbench.getByRole('button', { name: '需求编排', exact: true }).click();
  await workbench.getByRole('button', { name: '生成 recipe' }).click();
  await expect(workbench.getByText('编排结果')).toBeVisible();
  await expect(workbench.getByText('当前 recipe 选中 0 个能力。')).toBeVisible();
  await expect(workbench.getByText('手册证据')).toBeVisible();
  await expect(workbench.getByText('支持按手机号检索商机。')).toBeVisible();
});
