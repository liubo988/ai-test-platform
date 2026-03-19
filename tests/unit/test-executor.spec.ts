import { describe, expect, it } from 'vitest';
import { executeTest, renderWorkerCodeForExecution } from '@/lib/test-executor';

describe('test-executor worker template rendering', () => {
  it('injects the shared auth module file url into the generated worker code', () => {
    const workerCode = renderWorkerCodeForExecution(
      "import { isSmsPasswordLoginDescription } from '__INTENT_E2E_AUTH_SHARED_MODULE__';\n// __GENERATED_CODE_PLACEHOLDER__\n",
      "test('smoke', async () => {});"
    );

    expect(workerCode).toContain("from 'file:///");
    expect(workerCode).toContain('intent-e2e-auth-shared.mjs');
    expect(workerCode).toContain("test('smoke', async () => {});");
    expect(workerCode).not.toContain('__INTENT_E2E_AUTH_SHARED_MODULE__');
  });

  it(
    'executes generated worker code after injecting the shared auth helper import',
    async () => {
      const result = await executeTest(
        "test('worker import smoke', async () => { expect(globalThis.__e2e).toBeTruthy(); expect(typeof globalThis.__e2e.ensureLoggedIn).toBe('function'); });",
        'worker-import-smoke'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );
});
