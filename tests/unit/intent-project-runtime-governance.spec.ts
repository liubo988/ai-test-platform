import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getIntentProjectRuntimeGovernancePath,
  readIntentProjectRuntimeGovernanceStatus,
  resolveIntentProjectRuntimeGovernance,
} from '@/lib/intent-project-runtime-governance';

describe('intent-project-runtime-governance', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-project-runtime-governance-'));
    process.env.INTENT_E2E_PROJECT_ASSET_ROOT = tempDir;
  });

  afterEach(() => {
    delete process.env.INTENT_E2E_PROJECT_ASSET_ROOT;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = '';
  });

  it('reads a project-scoped runtime governance manifest and normalizes defaults', () => {
    const projectDir = path.join(tempDir, 'proj_1');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'intent-e2e.project-runtime-governance.json'),
      JSON.stringify({
        version: 1,
        environmentProfile: ' STAGING ',
        credential: {
          accountRef: ' account://crm/shared-owner ',
          sessionMode: ' SHARED ',
        },
        fixture: {
          strategy: ' SETUP_CLEANUP ',
          setupRef: ' fixture://crm/setup ',
          cleanupRef: ' fixture://crm/cleanup ',
          owner: ' qa-crm ',
          idempotencyKey: ' crm-opportunity-shared ',
        },
      })
    );

    expect(getIntentProjectRuntimeGovernancePath('proj_1')).toBe(
      path.join(tempDir, 'proj_1', 'intent-e2e.project-runtime-governance.json')
    );
    expect(readIntentProjectRuntimeGovernanceStatus('proj_1')).toEqual({
      projectUid: 'proj_1',
      path: path.join(tempDir, 'proj_1', 'intent-e2e.project-runtime-governance.json'),
      exists: true,
      valid: true,
      ready: true,
      hasEnvironmentProfile: true,
      hasCredentialDefaults: true,
      hasFixtureDefaults: true,
      issues: [],
      manifest: {
        version: 1,
        environmentProfile: 'staging',
        credential: {
          accountRef: 'account://crm/shared-owner',
          sessionMode: 'shared',
        },
        fixture: {
          strategy: 'setup_cleanup',
          setupRef: 'fixture://crm/setup',
          cleanupRef: 'fixture://crm/cleanup',
          owner: 'qa-crm',
          idempotencyKey: 'crm-opportunity-shared',
        },
      },
    });
  });

  it('reports manifest_missing when the project governance file does not exist', () => {
    const status = readIntentProjectRuntimeGovernanceStatus('proj_missing');

    expect(status).toMatchObject({
      projectUid: 'proj_missing',
      path: path.join(tempDir, 'proj_missing', 'intent-e2e.project-runtime-governance.json'),
      exists: false,
      valid: false,
      ready: false,
      hasEnvironmentProfile: false,
      hasCredentialDefaults: false,
      hasFixtureDefaults: false,
      manifest: null,
    });
    expect(status.issues.map((issue) => issue.code)).toEqual(['manifest_missing']);
  });

  it('marks a valid manifest as incomplete when shared account or fixture defaults are missing required fields', () => {
    const projectDir = path.join(tempDir, 'proj_incomplete');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'intent-e2e.project-runtime-governance.json'),
      JSON.stringify({
        version: 1,
        credential: {
          sessionMode: 'shared',
        },
        fixture: {
          strategy: 'setup_cleanup',
          setupRef: 'fixture://crm/setup',
        },
      })
    );

    const status = readIntentProjectRuntimeGovernanceStatus('proj_incomplete');

    expect(status).toMatchObject({
      projectUid: 'proj_incomplete',
      path: path.join(tempDir, 'proj_incomplete', 'intent-e2e.project-runtime-governance.json'),
      exists: true,
      valid: true,
      ready: false,
      hasEnvironmentProfile: false,
      hasCredentialDefaults: true,
      hasFixtureDefaults: true,
    });
    expect(status.issues.map((issue) => issue.code)).toEqual([
      'environment_profile_missing',
      'shared_account_ref_missing',
      'fixture_owner_missing',
      'fixture_idempotency_key_missing',
      'fixture_cleanup_ref_missing',
    ]);
  });

  it('marks project fixture refs invalid when they are not repo-owned fixture:// references', () => {
    const projectDir = path.join(tempDir, 'proj_invalid_fixture');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'intent-e2e.project-runtime-governance.json'),
      JSON.stringify({
        version: 1,
        environmentProfile: 'test',
        fixture: {
          strategy: 'setup_cleanup',
          setupRef: 'https://example.com/setup.mjs',
          cleanupRef: 'fixture://crm/cleanup?force=true',
          owner: 'qa-crm',
          idempotencyKey: 'crm-opportunity-shared',
        },
      })
    );

    const status = readIntentProjectRuntimeGovernanceStatus('proj_invalid_fixture');

    expect(status.ready).toBe(false);
    expect(status.issues.map((issue) => issue.code)).toEqual([
      'fixture_setup_ref_invalid',
      'fixture_cleanup_ref_invalid',
    ]);
  });

  it('merges project defaults with request overrides', () => {
    const projectDir = path.join(tempDir, 'proj_1');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'intent-e2e.project-runtime-governance.json'),
      JSON.stringify({
        version: 1,
        environmentProfile: 'test',
        credential: {
          accountRef: 'account://crm/shared-owner',
          sessionMode: 'shared',
        },
        fixture: {
          strategy: 'idempotent',
          owner: 'qa-crm',
          idempotencyKey: 'crm-dashboard-read',
        },
      })
    );

    expect(
      resolveIntentProjectRuntimeGovernance('proj_1', {
        environmentProfile: 'uat',
        fixture: {
          owner: 'qa-crm-uplift',
          idempotencyKey: 'crm-dashboard-override',
        },
      })
    ).toEqual({
      environmentProfile: 'uat',
      credential: {
        accountRef: 'account://crm/shared-owner',
        sessionMode: 'shared',
      },
      fixture: {
        strategy: 'idempotent',
        owner: 'qa-crm-uplift',
        idempotencyKey: 'crm-dashboard-override',
      },
    });
  });
});
