import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import mysql from 'mysql2/promise';
import { GET as listConfigExecutions } from '../../app/api/test-configs/[configUid]/executions/route';
import {
  createExecution,
  createTestConfig,
  createTestModule,
  createTestPlan,
  createTestProject,
  ensureWorkspaceActor,
  findRunningExecution,
  getExecution,
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
  ownerUid: string;
  staleRunningPlanUid: string;
  staleRunningExecutionUid: string;
  staleQueuedExecutionUid: string;
  freshRunningExecutionUid: string;
};

const cleanupQueue: Fixture[] = [];

async function openConnection() {
  ensureDotEnvLoaded();
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });
}

async function markExecutionStale(executionUid: string, status: 'queued' | 'running') {
  const connection = await openConnection();
  try {
    if (status === 'queued') {
      await connection.execute(
        `UPDATE test_executions
         SET status = 'queued',
             started_at = NULL,
             ended_at = NULL,
             duration_ms = NULL,
             result_summary = '',
             error_message = '',
             created_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE)
         WHERE execution_uid = ?`,
        [executionUid]
      );
      return;
    }

    await connection.execute(
      `UPDATE test_executions
       SET status = 'running',
           started_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE),
           ended_at = NULL,
           duration_ms = NULL,
           result_summary = '',
           error_message = '',
           created_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE)
       WHERE execution_uid = ?`,
      [executionUid]
    );
  } finally {
    await connection.end();
  }
}

async function setupFixture(): Promise<Fixture> {
  ensureDotEnvLoaded();
  const owner = await ensureWorkspaceActor('');
  const label = uniqueLabel('stale-execution');
  const project = await createTestProject(
    {
      name: `僵尸执行项目 ${label}`,
      description: '用于 stale execution 自动收敛集成测试',
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
      name: `执行模块 ${label}`,
      description: '用于 stale execution 测试',
      sortOrder: 10,
    },
    { actorLabel: 'integration-test' }
  );
  const config = await createTestConfig(
    {
      projectUid: project.projectUid,
      moduleUid: module.moduleUid,
      sortOrder: 20,
      name: `执行任务 ${label}`,
      targetUrl: 'https://example.com/stale-check',
      featureDescription: '验证 stale execution 会自动收敛',
      taskMode: 'page',
    },
    { actorLabel: 'integration-test' }
  );

  const staleRunningPlan = await createTestPlan({
    projectUid: project.projectUid,
    configUid: config.configUid,
    planTitle: 'stale running plan',
    planCode: "test('stale running', async () => {});",
    planSummary: '用于验证 stale running 收敛',
    generationModel: 'integration-test-model',
    generationPrompt: 'integration prompt',
    generatedFiles: [{ name: 'stale-running.spec.ts', content: "test('stale running', async () => {});", language: 'typescript' }],
    tiers: { simple: 1, medium: 0, complex: 0 },
  });
  const staleQueuedPlan = await createTestPlan({
    projectUid: project.projectUid,
    configUid: config.configUid,
    planTitle: 'stale queued plan',
    planCode: "test('stale queued', async () => {});",
    planSummary: '用于验证 stale queued 收敛',
    generationModel: 'integration-test-model',
    generationPrompt: 'integration prompt',
    generatedFiles: [{ name: 'stale-queued.spec.ts', content: "test('stale queued', async () => {});", language: 'typescript' }],
    tiers: { simple: 1, medium: 0, complex: 0 },
  });
  const freshRunningPlan = await createTestPlan({
    projectUid: project.projectUid,
    configUid: config.configUid,
    planTitle: 'fresh running plan',
    planCode: "test('fresh running', async () => {});",
    planSummary: '用于验证 fresh running 保持 active',
    generationModel: 'integration-test-model',
    generationPrompt: 'integration prompt',
    generatedFiles: [{ name: 'fresh-running.spec.ts', content: "test('fresh running', async () => {});", language: 'typescript' }],
    tiers: { simple: 1, medium: 0, complex: 0 },
  });

  const staleRunningExecutionUid = await createExecution({
    planUid: staleRunningPlan.planUid,
    configUid: config.configUid,
    projectUid: project.projectUid,
    workerSessionId: `ws-running-${label}`,
  });
  const staleQueuedExecutionUid = await createExecution({
    planUid: staleQueuedPlan.planUid,
    configUid: config.configUid,
    projectUid: project.projectUid,
    workerSessionId: `ws-queued-${label}`,
  });
  const freshRunningExecutionUid = await createExecution({
    planUid: freshRunningPlan.planUid,
    configUid: config.configUid,
    projectUid: project.projectUid,
    workerSessionId: `ws-fresh-${label}`,
  });

  await markExecutionStale(staleRunningExecutionUid, 'running');
  await markExecutionStale(staleQueuedExecutionUid, 'queued');

  const fixture = {
    projectUid: project.projectUid,
    configUid: config.configUid,
    ownerUid: owner.userUid,
    staleRunningPlanUid: staleRunningPlan.planUid,
    staleRunningExecutionUid,
    staleQueuedExecutionUid,
    freshRunningExecutionUid,
  };
  cleanupQueue.push(fixture);
  return fixture;
}

describe.sequential('stale execution reconciliation integration', () => {
  beforeAll(() => {
    ensureIntegrationDbReady();
  });

  afterEach(async () => {
    while (cleanupQueue.length > 0) {
      const fixture = cleanupQueue.pop();
      if (!fixture) continue;
      await cleanupProjectGraph(fixture.projectUid);
    }
  });

  it('reconciles stale queued/running executions while listing config execution history', async () => {
    const fixture = await setupFixture();

    const req = createActorRequest(`http://localhost/api/test-configs/${fixture.configUid}/executions?limit=20`, fixture.ownerUid);
    const res = await listConfigExecutions(req, { params: Promise.resolve({ configUid: fixture.configUid }) });
    expect(res.status).toBe(200);

    const payload = (await res.json()) as {
      items: Array<{ executionUid: string; status: string; errorMessage: string }>;
    };

    const staleRunning = payload.items.find((item) => item.executionUid === fixture.staleRunningExecutionUid);
    const staleQueued = payload.items.find((item) => item.executionUid === fixture.staleQueuedExecutionUid);
    const freshRunning = payload.items.find((item) => item.executionUid === fixture.freshRunningExecutionUid);

    expect(staleRunning).toMatchObject({
      executionUid: fixture.staleRunningExecutionUid,
      status: 'failed',
      errorMessage: '执行超时：worker 无响应',
    });
    expect(staleQueued).toMatchObject({
      executionUid: fixture.staleQueuedExecutionUid,
      status: 'failed',
      errorMessage: '执行未启动：排队状态超时',
    });
    expect(freshRunning?.status).toBe('running');

    const staleQueuedDetail = await getExecution(fixture.staleQueuedExecutionUid);
    expect(staleQueuedDetail?.status).toBe('failed');
    expect(staleQueuedDetail?.resultSummary).toBe('执行失败（排队超时）');
  });

  it('does not let stale running executions block plan reruns', async () => {
    const fixture = await setupFixture();

    const activeExecutionUid = await findRunningExecution(fixture.staleRunningPlanUid);
    expect(activeExecutionUid).toBeNull();

    const staleExecution = await getExecution(fixture.staleRunningExecutionUid);
    expect(staleExecution?.status).toBe('failed');
    expect(staleExecution?.errorMessage).toBe('执行超时：worker 无响应');
    expect(staleExecution?.resultSummary).toBe('执行失败（执行超时）');
  });
});
