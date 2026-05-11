import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  executeIntentE2EFixture,
  resolveIntentE2EFixtureRefForPhase,
} from '@/lib/intent-e2e-fixture-executor';

const previousFixtureStateRoot = process.env.INTENT_E2E_FIXTURE_STATE_ROOT;
const previousRemoteRecoveryMode = process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE;
const previousEnableRemoteRestore = process.env.INTENT_E2E_FIXTURE_ENABLE_REMOTE_RESTORE;
const previousStorageState = process.env.INTENT_E2E_FIXTURE_STORAGE_STATE;
const previousRemoteRecoveryPhase = process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_PHASE;

afterEach(() => {
  if (previousFixtureStateRoot === undefined) {
    delete process.env.INTENT_E2E_FIXTURE_STATE_ROOT;
  } else {
    process.env.INTENT_E2E_FIXTURE_STATE_ROOT = previousFixtureStateRoot;
  }

  if (previousRemoteRecoveryMode === undefined) {
    delete process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE;
  } else {
    process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE = previousRemoteRecoveryMode;
  }

  if (previousEnableRemoteRestore === undefined) {
    delete process.env.INTENT_E2E_FIXTURE_ENABLE_REMOTE_RESTORE;
  } else {
    process.env.INTENT_E2E_FIXTURE_ENABLE_REMOTE_RESTORE = previousEnableRemoteRestore;
  }

  if (previousStorageState === undefined) {
    delete process.env.INTENT_E2E_FIXTURE_STORAGE_STATE;
  } else {
    process.env.INTENT_E2E_FIXTURE_STORAGE_STATE = previousStorageState;
  }

  if (previousRemoteRecoveryPhase === undefined) {
    delete process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_PHASE;
  } else {
    process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_PHASE = previousRemoteRecoveryPhase;
  }
});

function parseLastJsonLine(stdout: string): Record<string, unknown> {
  const lastLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  expect(lastLine).toBeTruthy();
  return JSON.parse(lastLine || '{}') as Record<string, unknown>;
}

describe('intent e2e fixture executor', () => {
  it('executes repo-owned modal_or_drawer_save setup and cleanup fixtures', async () => {
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-fixture-executor-'));
    process.env.INTENT_E2E_FIXTURE_STATE_ROOT = stateRoot;
    const fixture = {
      strategy: 'setup_cleanup' as const,
      setupRef: 'fixture://project/proj_default/modal_or_drawer_save/setup',
      cleanupRef: 'fixture://project/proj_default/modal_or_drawer_save/cleanup',
      owner: 'owner://project/proj_default/members/workspace-user',
      idempotencyKey: 'new-intent.proj_default.modal_or_drawer_save.unit-test',
    };
    const context = {
      projectUid: 'proj_default',
      moduleUid: 'mod_commission',
      targetUrl: 'https://uat-service.yikaiye.com/#/commission/subCommissionConfig',
      runId: 'intent-run-fixture-unit',
      owner: fixture.owner,
      idempotencyKey: fixture.idempotencyKey,
      strategy: fixture.strategy,
    };

    expect(resolveIntentE2EFixtureRefForPhase(fixture, 'setup')).toBe(fixture.setupRef);
    expect(resolveIntentE2EFixtureRefForPhase(fixture, 'cleanup')).toBe(fixture.cleanupRef);

    const setupResult = await executeIntentE2EFixture({
      phase: 'setup',
      fixtureRef: fixture.setupRef,
      context,
    });
    const setupPayload = parseLastJsonLine(setupResult.stdout);
    const statePath = String(setupPayload.statePath || '');

    expect(setupResult.summary).toContain('modal_or_drawer_save fixture setup ready');
    expect(setupResult.scriptPath).toContain(
      path.join('scripts', 'intent-e2e-fixtures', 'project', 'proj_default', 'modal_or_drawer_save', 'setup.mjs')
    );
    expect(statePath).toContain(stateRoot);
    expect(fs.existsSync(statePath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
      family: 'modal_or_drawer_save',
      phase: 'setup',
      status: 'ready',
      projectUid: 'proj_default',
      idempotencyKey: fixture.idempotencyKey,
      contract: {
        scenarioId: 'commission.service-ratio-config',
        searchKeyword: '379',
        targetRole: '商机创建人',
      },
      remoteRecovery: {
        adapterRef: 'fixture://project/proj_default/modal_or_drawer_save/remote-restore',
        status: 'not_enabled',
        canMutateRemote: false,
      },
    });

    const cleanupResult = await executeIntentE2EFixture({
      phase: 'cleanup',
      fixtureRef: fixture.cleanupRef,
      context,
    });
    const cleanupPayload = parseLastJsonLine(cleanupResult.stdout);
    const cleanupPath = String(cleanupPayload.cleanupPath || '');

    expect(cleanupResult.summary).toContain('modal_or_drawer_save fixture cleanup completed');
    expect(cleanupPayload.stateFound).toBe(true);
    expect(fs.existsSync(cleanupPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
      family: 'modal_or_drawer_save',
      phase: 'cleanup',
      status: 'cleaned',
      remoteRecovery: {
        adapterRef: 'fixture://project/proj_default/modal_or_drawer_save/remote-restore',
        status: 'not_enabled',
      },
      cleanup: {
        stateFound: true,
        remoteRecoveryStatus: 'not_enabled',
      },
    });
  });

  it('exposes a repo-owned remote recovery adapter in contract-only mode', async () => {
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-fixture-remote-recovery-'));
    process.env.INTENT_E2E_FIXTURE_STATE_ROOT = stateRoot;
    process.env.INTENT_E2E_FIXTURE_REMOTE_RECOVERY_MODE = 'contract_only';
    const context = {
      projectUid: 'proj_default',
      moduleUid: 'mod_commission',
      targetUrl: 'https://uat-service.yikaiye.com/#/commission/subCommissionConfig',
      runId: 'intent-run-fixture-remote-recovery-unit',
      owner: 'owner://project/proj_default/members/workspace-user',
      idempotencyKey: 'new-intent.proj_default.modal_or_drawer_save.remote-recovery-unit',
      strategy: 'setup_cleanup' as const,
    };

    const remoteResult = await executeIntentE2EFixture({
      phase: 'cleanup',
      fixtureRef: 'fixture://project/proj_default/modal_or_drawer_save/remote-restore',
      context,
    });
    const payload = parseLastJsonLine(remoteResult.stdout);

    expect(remoteResult.summary).toContain('modal_or_drawer_save remote recovery not_enabled');
    expect(remoteResult.scriptPath).toContain(
      path.join('scripts', 'intent-e2e-fixtures', 'project', 'proj_default', 'modal_or_drawer_save', 'remote-restore.mjs')
    );
    expect(payload).toMatchObject({
      family: 'modal_or_drawer_save',
      scenarioId: 'commission.service-ratio-config',
      phase: 'restore',
      status: 'not_enabled',
      adapterRef: 'fixture://project/proj_default/modal_or_drawer_save/remote-restore',
    });
  });

  it('executes repo-owned business_create_list_verify setup and cleanup fixtures', async () => {
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-fixture-business-create-'));
    process.env.INTENT_E2E_FIXTURE_STATE_ROOT = stateRoot;
    const fixture = {
      strategy: 'setup_cleanup' as const,
      setupRef: 'fixture://project/proj_default/business_create_list_verify/setup',
      cleanupRef: 'fixture://project/proj_default/business_create_list_verify/cleanup',
      owner: 'owner://project/proj_default/members/workspace-user',
      idempotencyKey: 'new-intent.proj_default.business_create_list_verify.unit-test',
    };
    const context = {
      projectUid: 'proj_default',
      moduleUid: 'mod_business',
      targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
      runId: 'intent-run-business-fixture-unit',
      owner: fixture.owner,
      idempotencyKey: fixture.idempotencyKey,
      strategy: fixture.strategy,
    };

    const setupResult = await executeIntentE2EFixture({
      phase: 'setup',
      fixtureRef: fixture.setupRef,
      context,
    });
    const setupPayload = parseLastJsonLine(setupResult.stdout);
    const statePath = String(setupPayload.statePath || '');

    expect(setupResult.summary).toContain('business_create_list_verify fixture setup ready');
    expect(setupResult.scriptPath).toContain(
      path.join('scripts', 'intent-e2e-fixtures', 'project', 'proj_default', 'business_create_list_verify', 'setup.mjs')
    );
    expect(statePath).toContain(stateRoot);
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
      family: 'business_create_list_verify',
      phase: 'setup',
      status: 'ready',
      projectUid: 'proj_default',
      idempotencyKey: fixture.idempotencyKey,
      contract: {
        scenarioId: 'business.create-list-verify',
        seed: {
          sourceChannel: '抖音',
          productName: '疑难工商注销',
          expectedStage: '新入库',
          ownershipView: '我创建的',
        },
      },
    });

    const cleanupResult = await executeIntentE2EFixture({
      phase: 'cleanup',
      fixtureRef: fixture.cleanupRef,
      context,
    });
    const cleanupPayload = parseLastJsonLine(cleanupResult.stdout);
    const cleanupPath = String(cleanupPayload.cleanupPath || '');

    expect(cleanupResult.summary).toContain('business_create_list_verify fixture cleanup completed');
    expect(cleanupPayload.stateFound).toBe(true);
    expect(fs.existsSync(cleanupPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
      family: 'business_create_list_verify',
      phase: 'cleanup',
      status: 'cleaned',
      cleanup: {
        stateFound: true,
        capturedIdentifiers: {
          productName: '疑难工商注销',
        },
      },
    });
  });

  it('executes repo-owned business_to_order setup and cleanup fixtures', async () => {
    const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-fixture-business-order-'));
    process.env.INTENT_E2E_FIXTURE_STATE_ROOT = stateRoot;
    const fixture = {
      strategy: 'setup_cleanup' as const,
      setupRef: 'fixture://project/proj_default/business_to_order/setup',
      cleanupRef: 'fixture://project/proj_default/business_to_order/cleanup',
      owner: 'owner://project/proj_default/members/workspace-user',
      idempotencyKey: 'new-intent.proj_default.business_to_order.unit-test',
    };
    const context = {
      projectUid: 'proj_default',
      moduleUid: 'mod_business',
      targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
      runId: 'intent-run-business-order-fixture-unit',
      owner: fixture.owner,
      idempotencyKey: fixture.idempotencyKey,
      strategy: fixture.strategy,
    };

    const setupResult = await executeIntentE2EFixture({
      phase: 'setup',
      fixtureRef: fixture.setupRef,
      context,
    });
    const setupPayload = parseLastJsonLine(setupResult.stdout);
    const statePath = String(setupPayload.statePath || '');

    expect(setupResult.summary).toContain('business_to_order fixture setup ready');
    expect(setupResult.scriptPath).toContain(
      path.join('scripts', 'intent-e2e-fixtures', 'project', 'proj_default', 'business_to_order', 'setup.mjs')
    );
    expect(statePath).toContain(stateRoot);
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
      family: 'business_to_order',
      phase: 'setup',
      status: 'ready',
      projectUid: 'proj_default',
      idempotencyKey: fixture.idempotencyKey,
      contract: {
        scenarioId: 'business.create-to-order',
        seed: {
          sourceChannel: '抖音',
          productName: '疑难工商注销',
          orderDrawerTitle: '确定订单信息',
        },
      },
    });

    const cleanupResult = await executeIntentE2EFixture({
      phase: 'cleanup',
      fixtureRef: fixture.cleanupRef,
      context,
    });
    const cleanupPayload = parseLastJsonLine(cleanupResult.stdout);
    const cleanupPath = String(cleanupPayload.cleanupPath || '');

    expect(cleanupResult.summary).toContain('business_to_order fixture cleanup completed');
    expect(cleanupPayload.stateFound).toBe(true);
    expect(fs.existsSync(cleanupPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
      family: 'business_to_order',
      phase: 'cleanup',
      status: 'cleaned',
      cleanup: {
        stateFound: true,
        capturedIdentifiers: {
          productName: '疑难工商注销',
        },
      },
    });
  });
});
