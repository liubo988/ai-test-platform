import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import { GET as getConfigByUid, PUT as updateConfigByUid } from '../../app/api/test-configs/[configUid]/route';
import { GET as listConfigs, POST as createConfig } from '../../app/api/test-configs/route';
import {
  addProjectMember,
  createTestConfig,
  createTestPlan,
  createTestModule,
  createTestProject,
  ensureWorkspaceActor,
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
  moduleUid: string;
  ownerUid: string;
  viewerUid: string;
  viewerEmail: string;
};

const cleanupQueue: Fixture[] = [];

async function setupFixture(): Promise<Fixture> {
  ensureDotEnvLoaded();
  const owner = await ensureWorkspaceActor('');
  const label = uniqueLabel('scenario');
  const project = await createTestProject(
    {
      name: `集成测试项目 ${label}`,
      description: '用于 scenario 任务 API 集成测试',
      coverImageUrl: '',
      authRequired: false,
      loginUrl: '',
      loginUsername: '',
      loginPassword: '',
      loginDescription: '',
    },
    {
      actorLabel: 'integration-test',
      actorUserUid: owner.userUid,
    }
  );
  const module = await createTestModule(
    project.projectUid,
    {
      name: `集成模块 ${label}`,
      description: '用于 scenario 任务 API 测试',
      sortOrder: 10,
    },
    { actorLabel: 'integration-test' }
  );
  const viewer = await addProjectMember(
    project.projectUid,
    {
      displayName: `Viewer ${label}`,
      email: `${label}@example.com`,
      role: 'viewer',
    },
    { actorLabel: 'integration-test' }
  );

  const fixture = {
    projectUid: project.projectUid,
    moduleUid: module.moduleUid,
    ownerUid: owner.userUid,
    viewerUid: viewer.userUid,
    viewerEmail: viewer.email,
  };
  cleanupQueue.push(fixture);
  return fixture;
}

describe.sequential('scenario task config API integration', () => {
  beforeAll(() => {
    ensureIntegrationDbReady();
  });

  afterEach(async () => {
    while (cleanupQueue.length > 0) {
      const fixture = cleanupQueue.pop();
      if (!fixture) continue;
      await cleanupProjectGraph(fixture.projectUid, [fixture.viewerEmail]);
    }
  });

  it('creates, lists, and reads back a scenario task with flow definition', async () => {
    const fixture = await setupFixture();

    const body = {
      projectUid: fixture.projectUid,
      moduleUid: fixture.moduleUid,
      sortOrder: 20,
      name: '创建商品并下单',
      taskMode: 'scenario',
      targetUrl: 'https://example.com/products/new',
      featureDescription: '先创建商品，再创建订单，并核对订单详情中的商品信息。',
      flowDefinition: {
        sharedVariables: ['productId', 'orderId'],
        expectedOutcome: '订单详情中的商品 ID 与新建商品保持一致',
        cleanupNotes: '删除商品和订单测试数据',
        steps: [
          {
            stepType: 'ui',
            title: '创建商品',
            target: '/products/new',
            instruction: '填写商品表单并保存',
            expectedResult: '商品创建成功',
            extractVariable: 'productId',
          },
          {
            stepType: 'ui',
            title: '创建订单',
            target: '/orders/new',
            instruction: '选择商品并提交订单',
            expectedResult: '订单创建成功',
            extractVariable: 'orderId',
          },
          {
            stepType: 'api',
            title: '校验订单接口',
            target: '/api/orders/{{orderId}}',
            instruction: '读取订单详情接口',
            expectedResult: '返回的商品 ID 等于 productId',
            extractVariable: '',
          },
        ],
      },
    };

    const createReq = createActorRequest('http://localhost/api/test-configs', fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const createRes = await createConfig(createReq);
    expect(createRes.status).toBe(201);

    const created = await createRes.json();
    expect(created.item.taskMode).toBe('scenario');
    expect(created.item.flowDefinition.steps).toHaveLength(3);
    expect(created.item.flowDefinition.sharedVariables).toEqual(['productId', 'orderId']);

    const listReq = createActorRequest(
      `http://localhost/api/test-configs?projectUid=${fixture.projectUid}&status=active&page=1&pageSize=20`,
      fixture.viewerUid
    );
    const listRes = await listConfigs(listReq);
    expect(listRes.status).toBe(200);
    const listed = await listRes.json();
    expect(listed.total).toBe(1);
    expect(listed.items[0]).toMatchObject({
      configUid: created.item.configUid,
      taskMode: 'scenario',
    });
    expect(listed.items[0].flowDefinition.steps[1].title).toBe('创建订单');

    const detailReq = createActorRequest(`http://localhost/api/test-configs/${created.item.configUid}`, fixture.viewerUid);
    const detailRes = await getConfigByUid(detailReq, { params: Promise.resolve({ configUid: created.item.configUid }) });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.item.flowDefinition.expectedOutcome).toBe('订单详情中的商品 ID 与新建商品保持一致');
    expect(detail.item.flowDefinition.steps[2].target).toBe('/api/orders/{{orderId}}');
  });

  it('updates an existing scenario task and clears flow definition when switching to page mode', async () => {
    const fixture = await setupFixture();

    const createReq = createActorRequest('http://localhost/api/test-configs', fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectUid: fixture.projectUid,
        moduleUid: fixture.moduleUid,
        sortOrder: 30,
        name: '初始业务流任务',
        taskMode: 'scenario',
        targetUrl: 'https://example.com/workflow',
        featureDescription: '初始业务流描述',
        flowDefinition: {
          steps: [
            {
              stepType: 'ui',
              title: '初始步骤',
              target: '/workflow',
              instruction: '执行初始动作',
              expectedResult: '成功',
              extractVariable: '',
            },
          ],
        },
      }),
    });
    const createRes = await createConfig(createReq);
    const created = await createRes.json();

    const updateReq = createActorRequest(`http://localhost/api/test-configs/${created.item.configUid}`, fixture.ownerUid, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectUid: fixture.projectUid,
        moduleUid: fixture.moduleUid,
        sortOrder: 99,
        name: '切换后的单页面任务',
        taskMode: 'page',
        targetUrl: 'https://example.com/single-page',
        featureDescription: '切换为单页面模式后不应保留业务流步骤',
        flowDefinition: {
          steps: [
            {
              stepType: 'ui',
              title: '应被清空的步骤',
              target: '/ignored',
              instruction: 'ignored',
              expectedResult: 'ignored',
              extractVariable: '',
            },
          ],
        },
      }),
    });
    const updateRes = await updateConfigByUid(updateReq, { params: Promise.resolve({ configUid: created.item.configUid }) });
    expect(updateRes.status).toBe(200);

    const updated = await updateRes.json();
    expect(updated.item.taskMode).toBe('page');
    expect(updated.item.flowDefinition).toBeNull();
    expect(updated.item.targetUrl).toBe('https://example.com/single-page');
    expect(updated.item.sortOrder).toBe(99);

    const detailReq = createActorRequest(`http://localhost/api/test-configs/${created.item.configUid}`, fixture.ownerUid);
    const detailRes = await getConfigByUid(detailReq, { params: Promise.resolve({ configUid: created.item.configUid }) });
    const detail = await detailRes.json();
    expect(detail.item.taskMode).toBe('page');
    expect(detail.item.flowDefinition).toBeNull();
  });

  it('filters listed tasks by platform import query params', async () => {
    const fixture = await setupFixture();

    const createReq = createActorRequest('http://localhost/api/test-configs', fixture.ownerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectUid: fixture.projectUid,
        moduleUid: fixture.moduleUid,
        sortOrder: 60,
        name: '平台导入任务',
        taskMode: 'scenario',
        targetUrl: 'https://example.com/platform-import',
        featureDescription: '验证 workspace query 的平台过滤参数',
        flowDefinition: {
          steps: [
            {
              stepType: 'ui',
              title: '导入场景',
              target: '/platform-import',
              instruction: '执行导入任务',
              expectedResult: '导入成功',
              extractVariable: '',
            },
          ],
        },
      }),
    });
    const createRes = await createConfig(createReq);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    await createTestPlan({
      projectUid: fixture.projectUid,
      configUid: created.item.configUid,
      planTitle: 'Intent 平台导入计划',
      planCode: "test('platform import', async () => {});",
      planSummary: '用于验证 platform filter contract',
      generationModel: 'integration-test-model',
      generationPrompt: [
        '[intent_e2e_import] runId=intent-run-platform-1',
        '平台测试类型：browser_e2e',
        '平台执行器：playwright_runner',
        '平台用例资产：tc_platform_1',
        '平台规格资产：ts_platform_1',
        '平台验收契约：vc_platform_1',
        '平台产物类型：scenario_card / final_result / attempt_trace',
      ].join('\n'),
      generatedFiles: [
        {
          name: 'platform-import.spec.ts',
          content: "test('platform import', async () => {});",
          language: 'typescript',
        },
      ],
      tiers: { simple: 1, medium: 0, complex: 0 },
    });

    const legacyImported = await createTestConfig(
      {
        projectUid: fixture.projectUid,
        moduleUid: fixture.moduleUid,
        sortOrder: 61,
        name: 'Legacy 导入任务',
        taskMode: 'scenario',
        targetUrl: 'https://example.com/platform-legacy-import',
        featureDescription: '验证未带平台标签的旧导入任务会计入 importedCount',
        flowDefinition: {
          version: 1,
          entryUrl: 'https://example.com/platform-legacy-import',
          sharedVariables: [],
          expectedOutcome: '旧导入任务仍会被识别为 imported',
          cleanupNotes: '',
          steps: [
            {
              stepUid: 'step-legacy-platform-import',
              stepType: 'ui',
              title: 'legacy 导入场景',
              target: '/platform-legacy-import',
              instruction: '执行旧导入任务',
              expectedResult: '导入成功',
              extractVariable: '',
            },
          ],
        },
      },
      { actorLabel: 'integration-test' }
    );

    await createTestPlan({
      projectUid: fixture.projectUid,
      configUid: legacyImported.configUid,
      planTitle: 'Legacy Intent 导入计划',
      planCode: "test('legacy import', async () => {});",
      planSummary: '用于验证 platform summary contract',
      generationModel: 'integration-test-model',
      generationPrompt: '[intent_e2e_import] runId=intent-run-platform-legacy-1',
      generatedFiles: [
        {
          name: 'legacy-platform-import.spec.ts',
          content: "test('legacy import', async () => {});",
          language: 'typescript',
        },
      ],
      tiers: { simple: 1, medium: 0, complex: 0 },
    });

    const allReq = createActorRequest(
      `http://localhost/api/test-configs?projectUid=${fixture.projectUid}&status=active&page=1&pageSize=20`,
      fixture.viewerUid
    );
    const allRes = await listConfigs(allReq);
    expect(allRes.status).toBe(200);
    const all = await allRes.json();
    expect(all.total).toBe(2);
    expect(all.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          configUid: created.item.configUid,
          platformQuery: {
            version: 1,
            source: 'latest_plan_prompt',
            importedFromRunId: 'intent-run-platform-1',
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
            testCaseId: 'tc_platform_1',
            testSpecId: 'ts_platform_1',
            verificationContractId: 'vc_platform_1',
            artifactKinds: ['scenario_card', 'final_result', 'attempt_trace'],
            imported: true,
            platformTagged: true,
          },
        }),
        expect.objectContaining({
          configUid: legacyImported.configUid,
          platformQuery: {
            version: 1,
            source: 'latest_plan_prompt',
            importedFromRunId: 'intent-run-platform-legacy-1',
            testType: '',
            runnerType: '',
            testCaseId: '',
            testSpecId: '',
            verificationContractId: '',
            artifactKinds: [],
            imported: true,
            platformTagged: false,
          },
        }),
      ])
    );
    expect(all.platformIndex).toEqual({
      scopeCount: 2,
      importedCount: 2,
      platformTaggedCount: 1,
      bySource: [{ source: 'latest_plan_prompt', count: 2 }],
      byTestCaseId: [{ id: 'tc_platform_1', count: 1 }],
      byTestSpecId: [{ id: 'ts_platform_1', count: 1 }],
      byVerificationContractId: [{ id: 'vc_platform_1', count: 1 }],
    });
    expect(all.platformSummary).toEqual({
      scopeCount: 2,
      importedCount: 2,
      platformTaggedCount: 1,
      byTestType: [{ testType: 'browser_e2e', count: 1 }],
      byRunnerType: [{ runnerType: 'playwright_runner', count: 1 }],
      byArtifactKind: [
        { artifactKind: 'attempt_trace', count: 1 },
        { artifactKind: 'final_result', count: 1 },
        { artifactKind: 'scenario_card', count: 1 },
      ],
    });

    const filteredReq = createActorRequest(
      `http://localhost/api/test-configs?projectUid=${fixture.projectUid}&status=active&page=1&pageSize=20&platformTestType=browser_e2e&platformRunnerType=playwright_runner&platformArtifactKind=attempt_trace`,
      fixture.viewerUid
    );
    const filteredRes = await listConfigs(filteredReq);
    expect(filteredRes.status).toBe(200);
    const filtered = await filteredRes.json();
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]).toMatchObject({
      configUid: created.item.configUid,
      latestPlanImportedTestType: 'browser_e2e',
      latestPlanImportedRunnerType: 'playwright_runner',
      latestPlanImportedTestCaseId: 'tc_platform_1',
      latestPlanImportedTestSpecId: 'ts_platform_1',
      latestPlanImportedVerificationContractId: 'vc_platform_1',
      latestPlanImportedArtifactKinds: ['scenario_card', 'final_result', 'attempt_trace'],
      platformQuery: {
        version: 1,
        source: 'latest_plan_prompt',
        importedFromRunId: 'intent-run-platform-1',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_platform_1',
        testSpecId: 'ts_platform_1',
        verificationContractId: 'vc_platform_1',
        artifactKinds: ['scenario_card', 'final_result', 'attempt_trace'],
        imported: true,
        platformTagged: true,
      },
    });
    expect(filtered.platformSummary).toEqual({
      scopeCount: 1,
      importedCount: 1,
      platformTaggedCount: 1,
      byTestType: [{ testType: 'browser_e2e', count: 1 }],
      byRunnerType: [{ runnerType: 'playwright_runner', count: 1 }],
      byArtifactKind: [
        { artifactKind: 'attempt_trace', count: 1 },
        { artifactKind: 'final_result', count: 1 },
        { artifactKind: 'scenario_card', count: 1 },
      ],
    });
    expect(filtered.platformIndex).toEqual({
      scopeCount: 1,
      importedCount: 1,
      platformTaggedCount: 1,
      bySource: [{ source: 'latest_plan_prompt', count: 1 }],
      byTestCaseId: [{ id: 'tc_platform_1', count: 1 }],
      byTestSpecId: [{ id: 'ts_platform_1', count: 1 }],
      byVerificationContractId: [{ id: 'vc_platform_1', count: 1 }],
    });

    const combinedContractIdReq = createActorRequest(
      `http://localhost/api/test-configs?projectUid=${fixture.projectUid}&status=active&page=1&pageSize=20&platformContractIdType=test_case&platformContractId=tc_platform_1`,
      fixture.viewerUid
    );
    const combinedContractIdRes = await listConfigs(combinedContractIdReq);
    expect(combinedContractIdRes.status).toBe(200);
    const combinedContractIdFiltered = await combinedContractIdRes.json();
    expect(combinedContractIdFiltered.total).toBe(1);
    expect(combinedContractIdFiltered.items[0]).toMatchObject({
      configUid: created.item.configUid,
      latestPlanImportedTestCaseId: 'tc_platform_1',
    });
    expect(combinedContractIdFiltered.platformSummary).toEqual({
      scopeCount: 1,
      importedCount: 1,
      platformTaggedCount: 1,
      byTestType: [{ testType: 'browser_e2e', count: 1 }],
      byRunnerType: [{ runnerType: 'playwright_runner', count: 1 }],
      byArtifactKind: [
        { artifactKind: 'attempt_trace', count: 1 },
        { artifactKind: 'final_result', count: 1 },
        { artifactKind: 'scenario_card', count: 1 },
      ],
    });
    expect(combinedContractIdFiltered.platformIndex).toEqual({
      scopeCount: 1,
      importedCount: 1,
      platformTaggedCount: 1,
      bySource: [{ source: 'latest_plan_prompt', count: 1 }],
      byTestCaseId: [{ id: 'tc_platform_1', count: 1 }],
      byTestSpecId: [{ id: 'ts_platform_1', count: 1 }],
      byVerificationContractId: [{ id: 'vc_platform_1', count: 1 }],
    });

    const legacyContractIdReq = createActorRequest(
      `http://localhost/api/test-configs?projectUid=${fixture.projectUid}&status=active&page=1&pageSize=20&platformTestCaseId=tc_platform_1&platformTestSpecId=ts_platform_1&platformVerificationContractId=vc_platform_1`,
      fixture.viewerUid
    );
    const legacyContractIdRes = await listConfigs(legacyContractIdReq);
    expect(legacyContractIdRes.status).toBe(200);
    const legacyContractIdFiltered = await legacyContractIdRes.json();
    expect(legacyContractIdFiltered.total).toBe(1);
    expect(legacyContractIdFiltered.items[0]).toMatchObject({
      configUid: created.item.configUid,
      latestPlanImportedTestCaseId: 'tc_platform_1',
      latestPlanImportedTestSpecId: 'ts_platform_1',
      latestPlanImportedVerificationContractId: 'vc_platform_1',
    });

    const mismatchReq = createActorRequest(
      `http://localhost/api/test-configs?projectUid=${fixture.projectUid}&status=active&page=1&pageSize=20&platformArtifactKind=verification_plan`,
      fixture.viewerUid
    );
    const mismatchRes = await listConfigs(mismatchReq);
    expect(mismatchRes.status).toBe(200);
    const mismatch = await mismatchRes.json();
    expect(mismatch.total).toBe(0);
    expect(mismatch.items).toEqual([]);
    expect(mismatch.platformSummary).toEqual({
      scopeCount: 0,
      importedCount: 0,
      platformTaggedCount: 0,
      byTestType: [],
      byRunnerType: [],
      byArtifactKind: [],
    });
    expect(mismatch.platformIndex).toEqual({
      scopeCount: 0,
      importedCount: 0,
      platformTaggedCount: 0,
      bySource: [],
      byTestCaseId: [],
      byTestSpecId: [],
      byVerificationContractId: [],
    });
  });

  it('rejects scenario task creation for viewer role', async () => {
    const fixture = await setupFixture();

    const req = createActorRequest('http://localhost/api/test-configs', fixture.viewerUid, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectUid: fixture.projectUid,
        moduleUid: fixture.moduleUid,
        sortOrder: 40,
        name: 'viewer forbidden',
        taskMode: 'scenario',
        targetUrl: 'https://example.com/forbidden',
        featureDescription: 'viewer 无权创建任务',
        flowDefinition: {
          steps: [
            {
              stepType: 'ui',
              title: '尝试创建',
              target: '/forbidden',
              instruction: '不应成功',
              expectedResult: '返回 403',
              extractVariable: '',
            },
          ],
        },
      }),
    });

    const res = await createConfig(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: '当前操作者没有权限创建任务' });
  });
});
