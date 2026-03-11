import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GET as getConversations } from '../../app/api/conversations/route';
import { GET as getExecutionDetail } from '../../app/api/execution-details/[executionUid]/route';
import {
  DELETE as deleteExecutionFrames,
  GET as getExecutionFrames,
} from '../../app/api/execution-details/[executionUid]/frames/route';
import { GET as listConfigExecutions } from '../../app/api/test-configs/[configUid]/executions/route';
import { GET as getExecutionEvents } from '../../app/api/test-executions/[executionUid]/events/route';
import { GET as getExecutionStream } from '../../app/api/test-executions/[executionUid]/stream/route';
import { GET as getExecution } from '../../app/api/test-executions/[executionUid]/route';
import { GET as getPlan } from '../../app/api/test-plans/[planUid]/route';
import {
  addProjectMember,
  createExecution,
  createPlanCases,
  createTestConfig,
  createTestModule,
  createTestPlan,
  createTestProject,
  ensureWorkspaceActor,
  insertExecutionArtifact,
  insertExecutionEvent,
  insertLlmConversation,
  removeProjectMember,
  updateExecutionStatus,
} from '../../lib/db/repository';
import {
  cleanupProjectGraph,
  createActorRequest,
  ensureDotEnvLoaded,
  ensureIntegrationDbReady,
  uniqueLabel,
} from './support/db-test-utils';

type Fixture = {
  projectUid: string;
  configUid: string;
  planUid: string;
  executionUid: string;
  workerSessionId: string;
  ownerUid: string;
  viewerUid: string;
  outsiderUid: string;
  viewerEmail: string;
  outsiderEmail: string;
};

const cleanupQueue: Fixture[] = [];

async function setupFixture(): Promise<Fixture> {
  ensureDotEnvLoaded();
  const owner = await ensureWorkspaceActor('');
  const label = uniqueLabel('read-access');
  const project = await createTestProject(
    {
      name: `读取接口项目 ${label}`,
      description: '用于受保护读取接口的真实 DB 集成测试',
      coverImageUrl: '',
      authRequired: true,
      loginUrl: 'https://example.com/login',
      loginUsername: 'qa-owner@example.com',
      loginPassword: 'project-secret',
      loginDescription: '统一登录',
    },
    {
      actorLabel: 'integration-test',
      actorUserUid: owner.userUid,
    }
  );
  const module = await createTestModule(
    project.projectUid,
    {
      name: `读取模块 ${label}`,
      description: '用于受保护读取接口的测试模块',
      sortOrder: 10,
    },
    { actorLabel: 'integration-test' }
  );
  const viewer = await addProjectMember(
    project.projectUid,
    {
      displayName: `Viewer ${label}`,
      email: `viewer-${label}@example.com`,
      role: 'viewer',
    },
    { actorLabel: 'integration-test' }
  );
  const outsiderMember = await addProjectMember(
    project.projectUid,
    {
      displayName: `Outsider ${label}`,
      email: `outsider-${label}@example.com`,
      role: 'viewer',
    },
    { actorLabel: 'integration-test' }
  );
  await removeProjectMember(outsiderMember.memberUid, { actorLabel: 'integration-test' });

  const config = await createTestConfig(
    {
      projectUid: project.projectUid,
      moduleUid: module.moduleUid,
      sortOrder: 20,
      name: '跨页面下单流程',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/products/new',
      featureDescription: '创建商品后创建订单，并验证订单详情中的商品信息。',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://example.com/products/new',
        sharedVariables: ['productId', 'orderId'],
        expectedOutcome: '订单详情中的商品 ID 与新建商品一致',
        cleanupNotes: '删除订单与商品测试数据',
        steps: [
          {
            stepUid: 'step-create-product',
            stepType: 'ui',
            title: '创建商品',
            target: '/products/new',
            instruction: '填写商品信息并保存',
            expectedResult: '商品创建成功',
            extractVariable: 'productId',
          },
          {
            stepUid: 'step-create-order',
            stepType: 'ui',
            title: '创建订单',
            target: '/orders/new',
            instruction: '选择商品并提交订单',
            expectedResult: '订单创建成功',
            extractVariable: 'orderId',
          },
          {
            stepUid: 'step-verify-order-api',
            stepType: 'api',
            title: '校验订单接口',
            target: '/api/orders/{{orderId}}',
            instruction: '读取订单详情接口',
            expectedResult: '商品 ID 与 productId 一致',
            extractVariable: '',
          },
        ],
      },
    },
    { actorLabel: 'integration-test' }
  );

  const plan = await createTestPlan({
    projectUid: project.projectUid,
    configUid: config.configUid,
    planTitle: '跨页面下单流程 - 自动测试计划',
    planCode: "test('checkout flow', async () => {});",
    planSummary: '覆盖主流程与异常路径的业务流计划',
    generationModel: 'integration-test-model',
    generationPrompt: 'integration prompt',
    generatedFiles: [
      {
        name: 'generated-checkout.spec.ts',
        content: "test('checkout flow', async () => {});",
        language: 'typescript',
      },
    ],
    tiers: { simple: 1, medium: 1, complex: 1 },
  });

  await createPlanCases([
    {
      projectUid: project.projectUid,
      planUid: plan.planUid,
      tier: 'simple',
      caseName: '简单下单路径',
      caseSteps: ['打开商品页', '创建商品', '创建订单'],
      expectedResult: '订单创建成功',
      sortOrder: 10,
    },
    {
      projectUid: project.projectUid,
      planUid: plan.planUid,
      tier: 'medium',
      caseName: '订单详情校验',
      caseSteps: ['打开订单详情', '读取订单接口', '比对商品 ID'],
      expectedResult: '订单详情中的商品 ID 与创建商品一致',
      sortOrder: 20,
    },
  ]);

  const workerSessionId = `worker-${label}`;
  const executionUid = await createExecution({
    planUid: plan.planUid,
    configUid: config.configUid,
    projectUid: project.projectUid,
    workerSessionId,
  });

  await insertExecutionEvent(
    executionUid,
    'log',
    {
      level: 'info',
      message: '准备执行浏览器与测试数据',
      at: new Date().toISOString(),
    },
    project.projectUid
  );
  await insertExecutionArtifact({
    executionUid,
    projectUid: project.projectUid,
    artifactType: 'generated_spec',
    storagePath: 'artifacts/generated-checkout.spec.ts',
    meta: { sizeBytes: 128 },
  });
  await insertLlmConversation({
    projectUid: project.projectUid,
    scene: 'plan_generation',
    refUid: config.configUid,
    role: 'assistant',
    messageType: 'status',
    content: '测试计划生成完成',
  });
  await insertLlmConversation({
    projectUid: project.projectUid,
    scene: 'plan_execution',
    refUid: executionUid,
    role: 'assistant',
    messageType: 'status',
    content: '执行准备完成',
  });
  await updateExecutionStatus(
    executionUid,
    'passed',
    {
      endedAt: new Date(),
      durationMs: 123000,
      resultSummary: '执行成功',
    },
    project.projectUid
  );

  const fixture = {
    projectUid: project.projectUid,
    configUid: config.configUid,
    planUid: plan.planUid,
    executionUid,
    workerSessionId,
    ownerUid: owner.userUid,
    viewerUid: viewer.userUid,
    outsiderUid: outsiderMember.userUid,
    viewerEmail: viewer.email,
    outsiderEmail: outsiderMember.email,
  };
  cleanupQueue.push(fixture);
  return fixture;
}

async function callProtectedRoutes(actorUid: string, fixture: Fixture) {
  const planRes = await getPlan(
    createActorRequest(`http://localhost/api/test-plans/${fixture.planUid}`, actorUid),
    { params: Promise.resolve({ planUid: fixture.planUid }) }
  );
  const configExecutionsRes = await listConfigExecutions(
    createActorRequest(`http://localhost/api/test-configs/${fixture.configUid}/executions?limit=5`, actorUid),
    { params: Promise.resolve({ configUid: fixture.configUid }) }
  );
  const planGenerationConversationsRes = await getConversations(
    createActorRequest(
      `http://localhost/api/conversations?scene=plan_generation&refUid=${fixture.configUid}`,
      actorUid
    )
  );
  const planExecutionConversationsRes = await getConversations(
    createActorRequest(
      `http://localhost/api/conversations?scene=plan_execution&refUid=${fixture.executionUid}`,
      actorUid
    )
  );
  const executionRes = await getExecution(
    createActorRequest(`http://localhost/api/test-executions/${fixture.executionUid}`, actorUid),
    { params: Promise.resolve({ executionUid: fixture.executionUid }) }
  );
  const executionDetailRes = await getExecutionDetail(
    createActorRequest(`http://localhost/api/execution-details/${fixture.executionUid}`, actorUid),
    { params: Promise.resolve({ executionUid: fixture.executionUid }) }
  );
  const executionEventsRes = await getExecutionEvents(
    createActorRequest(`http://localhost/api/test-executions/${fixture.executionUid}/events`, actorUid),
    { params: Promise.resolve({ executionUid: fixture.executionUid }) }
  );
  const executionStreamRes = await getExecutionStream(
    createActorRequest(`http://localhost/api/test-executions/${fixture.executionUid}/stream`, actorUid),
    { params: Promise.resolve({ executionUid: fixture.executionUid }) }
  );
  const executionFramesRes = await getExecutionFrames(
    createActorRequest(`http://localhost/api/execution-details/${fixture.executionUid}/frames`, actorUid),
    { params: Promise.resolve({ executionUid: fixture.executionUid }) }
  );

  return {
    planRes,
    configExecutionsRes,
    planGenerationConversationsRes,
    planExecutionConversationsRes,
    executionRes,
    executionDetailRes,
    executionEventsRes,
    executionStreamRes,
    executionFramesRes,
  };
}

describe.sequential('project read access API integration', () => {
  beforeAll(() => {
    ensureIntegrationDbReady();
  });

  afterEach(async () => {
    while (cleanupQueue.length > 0) {
      const fixture = cleanupQueue.pop();
      if (!fixture) continue;
      await cleanupProjectGraph(fixture.projectUid, [fixture.viewerEmail, fixture.outsiderEmail]);
    }
  });

  it('allows viewers to read protected project resources and strips plaintext credentials from execution detail payloads', async () => {
    const fixture = await setupFixture();
    const responses = await callProtectedRoutes(fixture.viewerUid, fixture);

    expect(responses.planRes.status).toBe(200);
    expect(await responses.planRes.json()).toMatchObject({
      plan: {
        planUid: fixture.planUid,
        projectUid: fixture.projectUid,
      },
      cases: [
        { caseName: '简单下单路径' },
        { caseName: '订单详情校验' },
      ],
    });

    expect(responses.configExecutionsRes.status).toBe(200);
    const executionsPayload = await responses.configExecutionsRes.json();
    expect(executionsPayload.items).toHaveLength(1);
    expect(executionsPayload.items[0]).toMatchObject({
      executionUid: fixture.executionUid,
      status: 'passed',
    });

    expect(responses.planGenerationConversationsRes.status).toBe(200);
    expect(await responses.planGenerationConversationsRes.json()).toMatchObject({
      items: [{ content: '测试计划生成完成' }],
    });

    expect(responses.planExecutionConversationsRes.status).toBe(200);
    expect(await responses.planExecutionConversationsRes.json()).toMatchObject({
      items: [{ content: '执行准备完成' }],
    });

    expect(responses.executionRes.status).toBe(200);
    const executionPayload = await responses.executionRes.json();
    expect(executionPayload.execution).toMatchObject({
      executionUid: fixture.executionUid,
      projectUid: fixture.projectUid,
      status: 'passed',
    });
    expect(executionPayload.config).not.toHaveProperty('loginPasswordPlain');
    expect(executionPayload.project).not.toHaveProperty('loginPasswordPlain');

    expect(responses.executionDetailRes.status).toBe(200);
    const detailPayload = await responses.executionDetailRes.json();
    expect(detailPayload.execution).toMatchObject({
      executionUid: fixture.executionUid,
      workerSessionId: fixture.workerSessionId,
      status: 'passed',
    });
    expect(detailPayload.events.some((event: { eventType: string }) => event.eventType === 'log')).toBe(true);
    expect(detailPayload.artifacts[0]).toMatchObject({
      artifactType: 'generated_spec',
      storagePath: 'artifacts/generated-checkout.spec.ts',
    });
    expect(detailPayload.config).toMatchObject({
      configUid: fixture.configUid,
      authSource: 'project',
      authRequired: true,
    });
    expect(detailPayload.project).toMatchObject({
      projectUid: fixture.projectUid,
      authRequired: true,
    });
    expect(detailPayload.config).not.toHaveProperty('loginPasswordPlain');
    expect(detailPayload.project).not.toHaveProperty('loginPasswordPlain');

    expect(responses.executionEventsRes.status).toBe(200);
    const eventsPayload = await responses.executionEventsRes.json();
    expect(eventsPayload.events.length).toBeGreaterThan(0);

    expect(responses.executionStreamRes.status).toBe(200);
    expect(responses.executionStreamRes.headers.get('content-type')).toContain('text/event-stream');
    await responses.executionStreamRes.body?.cancel();

    expect(responses.executionFramesRes.status).toBe(200);
    expect(await responses.executionFramesRes.json()).toEqual({
      sessionId: fixture.workerSessionId,
      frames: [],
      total: 0,
    });
  });

  it('rejects outsiders on protected project read endpoints', async () => {
    const fixture = await setupFixture();
    const responses = await callProtectedRoutes(fixture.outsiderUid, fixture);

    expect(responses.planRes.status).toBe(403);
    expect(await responses.planRes.json()).toEqual({ error: '当前操作者没有权限查看测试计划' });

    expect(responses.configExecutionsRes.status).toBe(403);
    expect(await responses.configExecutionsRes.json()).toEqual({ error: '当前操作者没有权限查看执行历史' });

    expect(responses.planGenerationConversationsRes.status).toBe(403);
    expect(await responses.planGenerationConversationsRes.json()).toEqual({ error: '当前操作者没有权限查看对话记录' });

    expect(responses.planExecutionConversationsRes.status).toBe(403);
    expect(await responses.planExecutionConversationsRes.json()).toEqual({ error: '当前操作者没有权限查看对话记录' });

    expect(responses.executionRes.status).toBe(403);
    expect(await responses.executionRes.json()).toEqual({ error: '当前操作者没有权限查看执行详情' });

    expect(responses.executionDetailRes.status).toBe(403);
    expect(await responses.executionDetailRes.json()).toEqual({ error: '当前操作者没有权限查看执行详情' });

    expect(responses.executionEventsRes.status).toBe(403);
    expect(await responses.executionEventsRes.json()).toEqual({ error: '当前操作者没有权限查看执行事件' });

    expect(responses.executionStreamRes.status).toBe(403);
    expect(await responses.executionStreamRes.json()).toEqual({ error: '当前操作者没有权限订阅执行事件' });

    expect(responses.executionFramesRes.status).toBe(403);
    expect(await responses.executionFramesRes.json()).toEqual({ error: '当前操作者没有权限查看执行回放' });
  });

  it('restricts execution frame deletion to owners and editors', async () => {
    const fixture = await setupFixture();

    const viewerDeleteRes = await deleteExecutionFrames(
      createActorRequest(`http://localhost/api/execution-details/${fixture.executionUid}/frames`, fixture.viewerUid, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ executionUid: fixture.executionUid }) }
    );
    expect(viewerDeleteRes.status).toBe(403);
    expect(await viewerDeleteRes.json()).toEqual({ error: '当前操作者没有权限删除执行回放' });

    const ownerDeleteRes = await deleteExecutionFrames(
      createActorRequest(`http://localhost/api/execution-details/${fixture.executionUid}/frames`, fixture.ownerUid, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ executionUid: fixture.executionUid }) }
    );
    expect(ownerDeleteRes.status).toBe(200);
    expect(await ownerDeleteRes.json()).toEqual({ ok: true });
  });
});
