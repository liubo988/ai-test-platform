import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { POST as restorePlan } from '../../app/api/test-plans/[planUid]/restore/route';
import {
  createPlanCases,
  createTestConfig,
  createTestModule,
  createTestPlan,
  createTestProject,
  ensureWorkspaceActor,
  getLatestPlanByConfigUid,
  getPlanByUid,
  listPlanCases,
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
  sourcePlanUid: string;
  currentPlanUid: string;
  ownerUid: string;
};

const cleanupQueue: Fixture[] = [];

async function setupFixture(): Promise<Fixture> {
  ensureDotEnvLoaded();
  const owner = await ensureWorkspaceActor('');
  const label = uniqueLabel('plan-restore');

  const project = await createTestProject(
    {
      name: `历史脚本恢复项目 ${label}`,
      description: '验证历史测试脚本恢复为当前版本',
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
      name: `测试模块 ${label}`,
      description: '脚本恢复模块',
      sortOrder: 10,
    },
    { actorLabel: 'integration-test' }
  );
  const config = await createTestConfig(
    {
      projectUid: project.projectUid,
      moduleUid: module.moduleUid,
      sortOrder: 20,
      name: `恢复脚本任务 ${label}`,
      targetUrl: 'https://example.com/orders',
      featureDescription: '验证历史成功版本可恢复为当前脚本',
      taskMode: 'page',
    },
    { actorLabel: 'integration-test' }
  );

  const sourcePlan = await createTestPlan({
    projectUid: project.projectUid,
    configUid: config.configUid,
    planTitle: '成功历史脚本',
    planCode: "test('historical success', async () => {});",
    planSummary: '这是历史成功版本',
    generationModel: 'integration-test-model',
    generationPrompt: 'historical prompt',
    generatedFiles: [{ name: 'historical-success.spec.ts', content: "test('historical success', async () => {});", language: 'typescript' }],
    tiers: { simple: 1, medium: 0, complex: 0 },
  });
  await createPlanCases([
    {
      projectUid: project.projectUid,
      planUid: sourcePlan.planUid,
      tier: 'simple',
      caseName: '历史成功用例',
      caseSteps: ['打开订单页', '执行成功脚本'],
      expectedResult: '执行通过',
      sortOrder: 10,
    },
  ]);

  const currentPlan = await createTestPlan({
    projectUid: project.projectUid,
    configUid: config.configUid,
    planTitle: '当前异常脚本',
    planCode: "test('broken latest', async () => { throw new Error('broken'); });",
    planSummary: '这是当前异常版本',
    generationModel: 'integration-test-model',
    generationPrompt: 'latest prompt',
    generatedFiles: [{ name: 'broken-latest.spec.ts', content: "test('broken latest', async () => { throw new Error('broken'); });", language: 'typescript' }],
    tiers: { simple: 1, medium: 0, complex: 0 },
  });

  const fixture = {
    projectUid: project.projectUid,
    configUid: config.configUid,
    sourcePlanUid: sourcePlan.planUid,
    currentPlanUid: currentPlan.planUid,
    ownerUid: owner.userUid,
  };
  cleanupQueue.push(fixture);
  return fixture;
}

describe.sequential('plan restore API integration', () => {
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

  it('restores a historical plan as the new latest script for a task', async () => {
    const fixture = await setupFixture();

    const req = createActorRequest(`http://localhost/api/test-plans/${fixture.sourcePlanUid}/restore`, fixture.ownerUid, {
      method: 'POST',
    });
    const res = await restorePlan(req, { params: Promise.resolve({ planUid: fixture.sourcePlanUid }) });
    expect(res.status).toBe(200);

    const payload = (await res.json()) as {
      planUid: string;
      planVersion: number;
      sourcePlanUid: string;
      sourcePlanVersion: number;
      reusedCurrent: boolean;
    };

    expect(payload.sourcePlanUid).toBe(fixture.sourcePlanUid);
    expect(payload.sourcePlanVersion).toBe(1);
    expect(payload.planVersion).toBe(3);
    expect(payload.reusedCurrent).toBe(false);

    const latestPlan = await getLatestPlanByConfigUid(fixture.configUid);
    expect(latestPlan?.planUid).toBe(payload.planUid);
    expect(latestPlan?.planVersion).toBe(3);

    const restoredPlan = await getPlanByUid(payload.planUid);
    expect(restoredPlan?.planCode).toBe("test('historical success', async () => {});");
    expect(restoredPlan?.planSummary).toContain('已从历史脚本 v1 恢复为当前版本');

    const restoredCases = await listPlanCases(payload.planUid);
    expect(restoredCases).toHaveLength(1);
    expect(restoredCases[0]).toMatchObject({
      caseName: '历史成功用例',
      expectedResult: '执行通过',
    });
  });
});
