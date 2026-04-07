import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestModule,
  createTestProject,
  ensureWorkspaceActor,
  listIntentE2ERunSnapshots,
  upsertIntentE2ERunSnapshot,
} from '../../lib/db/repository';
import { cleanupProjectGraph, ensureDotEnvLoaded, ensureIntegrationDbReady, uniqueLabel } from './support/db-test-utils';

type Fixture = {
  projectUid: string;
  moduleUid: string;
};

const cleanupQueue: Fixture[] = [];

async function setupFixture(): Promise<Fixture> {
  ensureDotEnvLoaded();
  const owner = await ensureWorkspaceActor('');
  const label = uniqueLabel('intent-run');
  const project = await createTestProject(
    {
      name: `运行快照项目 ${label}`,
      description: '用于 intent_e2e_runs 仓储集成测试',
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
      name: `运行快照模块 ${label}`,
      description: '用于 intent_e2e_runs 仓储集成测试',
      sortOrder: 10,
    },
    { actorLabel: 'integration-test' }
  );

  const fixture = {
    projectUid: project.projectUid,
    moduleUid: module.moduleUid,
  };
  cleanupQueue.push(fixture);
  return fixture;
}

describe.sequential('intent e2e run snapshot repository integration', () => {
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

  it('filters active run snapshots to created and running rows only', async () => {
    const fixture = await setupFixture();
    const createdAt = '2026-04-07T08:00:00.000Z';
    const baseState = {
      request: {
        input: '创建商机并验证列表',
        intentDraftUid: 'idraft_active',
      },
    };

    const createdRunId = `intent-run-created-${uniqueLabel('case')}`;
    await upsertIntentE2ERunSnapshot({
      runId: createdRunId,
      projectUid: fixture.projectUid,
      moduleUid: fixture.moduleUid,
      status: 'created',
      stage: 'queued',
      requestInput: '创建商机并验证列表',
      targetUrl: 'https://example.com/#/business/list',
      state: baseState,
      createdAt,
      updatedAt: '2026-04-07T08:04:00.000Z',
      startedAt: '',
      endedAt: '',
    });
    const runningRunId = `intent-run-running-${uniqueLabel('case')}`;
    await upsertIntentE2ERunSnapshot({
      runId: runningRunId,
      projectUid: fixture.projectUid,
      moduleUid: fixture.moduleUid,
      status: 'running',
      stage: 'planning',
      requestInput: '创建商机并验证列表',
      targetUrl: 'https://example.com/#/business/list',
      state: baseState,
      createdAt,
      updatedAt: '2026-04-07T08:05:00.000Z',
      startedAt: '2026-04-07T08:01:00.000Z',
      endedAt: '',
    });
    await upsertIntentE2ERunSnapshot({
      runId: `intent-run-failed-${uniqueLabel('case')}`,
      projectUid: fixture.projectUid,
      moduleUid: fixture.moduleUid,
      status: 'failed',
      stage: 'completed',
      requestInput: '创建商机并验证列表',
      targetUrl: 'https://example.com/#/business/list',
      state: baseState,
      error: '执行失败',
      createdAt,
      updatedAt: '2026-04-07T08:06:00.000Z',
      startedAt: '2026-04-07T08:01:30.000Z',
      endedAt: '2026-04-07T08:06:00.000Z',
    });

    const snapshots = await listIntentE2ERunSnapshots({
      projectUid: fixture.projectUid,
      moduleUid: fixture.moduleUid,
      status: 'active',
      limit: 10,
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((item) => item.runId)).toEqual([
      runningRunId,
      createdRunId,
    ]);
    expect(snapshots.map((item) => item.status)).toEqual(['running', 'created']);
  });
});
