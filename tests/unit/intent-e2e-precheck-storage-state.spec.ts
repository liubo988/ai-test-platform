import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveIntentE2EPrecheckStorageStateCandidates,
  storageStateMatchesTargetOrigin,
} from '@/lib/intent-e2e-precheck-storage-state';

describe('intent-e2e precheck storage state discovery', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('matches storage state origins and cookie domains to the target url', () => {
    expect(
      storageStateMatchesTargetOrigin(
        {
          cookies: [],
          origins: [{ origin: 'https://uat-service.yikaiye.com', localStorage: [] }],
        },
        'https://uat-service.yikaiye.com/#/order/list'
      )
    ).toBe(true);

    expect(
      storageStateMatchesTargetOrigin(
        {
          cookies: [{ name: 'sid', value: '1', domain: '.yikaiye.com', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }],
          origins: [],
        },
        'https://uat-service.yikaiye.com/#/order/list'
      )
    ).toBe(true);

    expect(
      storageStateMatchesTargetOrigin(
        {
          cookies: [],
          origins: [{ origin: 'https://other.example.com', localStorage: [] }],
        },
        'https://uat-service.yikaiye.com/#/order/list'
      )
    ).toBe(false);
  });

  it('discovers matching env-provided storage state files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-storage-state-'));
    const storageStatePath = path.join(tempDir, 'storage-state.json');
    fs.writeFileSync(
      storageStatePath,
      JSON.stringify({
        cookies: [],
        origins: [{ origin: 'https://storage.example.test', localStorage: [{ name: 'token', value: 'ok' }] }],
      })
    );
    vi.stubEnv('INTENT_E2E_STORAGE_STATE_PATH', storageStatePath);

    const candidates = resolveIntentE2EPrecheckStorageStateCandidates('https://storage.example.test/#/orders');

    expect(candidates).toEqual([
      expect.objectContaining({
        source: 'env',
        path: storageStatePath,
      }),
    ]);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
