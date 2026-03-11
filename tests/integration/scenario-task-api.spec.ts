import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import { GET as getConfigByUid, PUT as updateConfigByUid } from '../../app/api/test-configs/[configUid]/route';
import { GET as listConfigs, POST as createConfig } from '../../app/api/test-configs/route';
import {
  addProjectMember,
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
