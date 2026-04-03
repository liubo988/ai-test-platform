import { describe, expect, it } from 'vitest';
import { executeTest, prepareTestCodeForExecution, renderWorkerCodeForExecution } from '@/lib/test-executor';

describe('test-executor worker template rendering', () => {
  it('keeps pure JavaScript unchanged before execution', () => {
    const code = `
      test('js operators stay intact', async () => {
        const ready = 1 != 2 && 2 !== 3;
        if (!ready) throw new Error('expected ready');
      });
    `.trim();

    expect(prepareTestCodeForExecution(code)).toBe(code);
  });

  it('does not misclassify ternary branches as TypeScript return annotations', () => {
    const code = `
      test('ternary stays valid js', async () => {
        const page = {
          getByRole: () => ({ first: () => 'page-button' }),
        };
        const activePane = {
          count: async () => 1,
          getByRole: () => ({ first: () => 'pane-button' }),
        };

        const submitButton = (await activePane.count())
          ? activePane.getByRole('button', { name: /保\\s*存|提\\s*交/i }).first()
          : page.getByRole('button', { name: /保\\s*存|提\\s*交/i }).first();

        expect(submitButton).toBe('pane-button');
      });
    `.trim();

    expect(prepareTestCodeForExecution(code)).toBe(code);
  });

  it('uses TypeScript stripping only as a compatibility fallback', () => {
    const code = `
      import type { Page } from '@playwright/test';
      function helper(page: any): void {
        const ready: boolean = true;
        const subject = page! as any;
        expect(ready).toBe(true);
        expect(subject).toBeTruthy();
      }

      test('ts fallback', async () => {
        helper(globalThis.__e2e);
      });
    `.trim();

    const prepared = prepareTestCodeForExecution(code);
    expect(prepared).not.toContain('import type');
    expect(prepared).not.toContain(': boolean');
    expect(prepared).not.toContain(' as any');
    expect(prepared).not.toContain('): void');
    expect(prepared).toContain("test('ts fallback'");
  });

  it('preserves object literal null fields when applying the TypeScript fallback', async () => {
    const code = `
      function helper(page: any): void {
        const recordCheck = {
          primaryValue: 'BIZ-001',
          mode: 'table_row',
          row: null,
          response: null,
        };

        expect(recordCheck.response).toBe(null);
        expect('response' in recordCheck).toBe(true);
      }

      test('ts fallback keeps response null property', async () => {
        helper(globalThis.__e2e);
      });
    `.trim();

    const prepared = prepareTestCodeForExecution(code);
    expect(prepared).toContain('response: null');
    expect(prepared).not.toContain('page: any');
    expect(prepared).not.toContain('): void');

    const result = await executeTest(code, 'worker-ts-fallback-preserves-object-literal-null');
    expect(result).toMatchObject({
      success: true,
      error: null,
    });
  });

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
        "test('worker import smoke', async () => { expect(globalThis.__e2e).toBeTruthy(); expect(typeof globalThis.__e2e.ensureLoggedIn).toBe('function'); expect(typeof globalThis.__e2e.switchBusinessListOwnershipView).toBe('function'); expect(typeof globalThis.__e2e.observeSubmitState).toBe('function'); expect(typeof globalThis.__e2e.readJsonResponse).toBe('function'); expect(typeof globalThis.__e2e.pickJsonValue).toBe('function'); expect(typeof globalThis.__e2e.pickJsonRecord).toBe('function'); expect(typeof globalThis.__e2e.resolvePrimaryRecord).toBe('function'); expect(typeof globalThis.__e2e.readDetailField).toBe('function'); });",
        'worker-import-smoke'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'loads provided storage state into the worker browser context',
    async () => {
      const result = await executeTest(
        `test('worker storage state smoke', async ({ page }) => {
          const cookies = await page.context().cookies('https://example.com');
          const sessionCookie = cookies.find((item) => item.name === 'intent_sid');
          expect(sessionCookie?.value).toBe('shared-session');
        });`,
        'worker-storage-state-smoke',
        undefined,
        undefined,
        {
          storageState: {
            cookies: [
              {
                name: 'intent_sid',
                value: 'shared-session',
                domain: 'example.com',
                path: '/',
                expires: -1,
                httpOnly: false,
                secure: false,
                sameSite: 'Lax' as const,
              },
            ],
            origins: [],
          },
        }
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'reads response json and extracts primary keys through shared helpers',
    async () => {
      const result = await executeTest(
        `test('json helpers extract primary key', async ({ page }) => {
          await page.route('https://app.example.com/**', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/index.html')) {
              await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><html><body>json helper test</body></html>',
              });
              return;
            }

            if (url.endsWith('/api/business/create')) {
              await route.fulfill({
                status: 200,
                headers: {
                  'access-control-allow-origin': '*',
                },
                contentType: 'application/json',
                body: JSON.stringify({
                  code: 1,
                  data: {
                    id: 'BIZ-001',
                    orderId: 'ORD-009',
                  },
                }),
              });
              return;
            }

            await route.fulfill({ status: 404, body: 'not found' });
          });

          await page.goto('https://app.example.com/index.html');

          const createRespPromise = __e2e.waitForApiResponse(page, {
            urlIncludes: '/api/business/create',
            method: 'POST',
          });

          await page.evaluate(() =>
            fetch('https://app.example.com/api/business/create', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: 'Acme' }),
            })
          );

          const createResp = await createRespPromise;
          const payload = await __e2e.readJsonResponse(createResp);
          const payloadAgain = await __e2e.readJsonResponse(createResp);
          const businessId = __e2e.pickJsonValue(payload, {
            label: 'businessId',
            paths: ['businessId', 'data.businessId', 'id', 'data.id'],
          });
          const orderId = __e2e.pickJsonValue(payloadAgain, {
            label: 'orderId',
            paths: ['orderId', 'data.orderId', 'id', 'data.id'],
          });

          expect(businessId).toBe('BIZ-001');
          expect(orderId).toBe('ORD-009');
        });`,
        'worker-json-helpers-extract-primary-key'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'locates a matched list record from nested list response json',
    async () => {
      const result = await executeTest(
        `test('json helper picks matched record', async () => {
          const payload = {
            code: 1,
            data: {
              records: [
                { customerId: 'CUS-001', statusName: '待审核', customerName: 'Alpha' },
                { customerId: 'CUS-002', statusName: '已通过', customerName: 'Beta' },
              ],
            },
          };

          const matchedRecord = __e2e.pickJsonRecord(payload, {
            label: 'customerId',
            value: 'CUS-002',
            paths: ['customerId', 'id'],
            required: false,
          });

          expect(matchedRecord).toBeTruthy();
          expect(__e2e.pickJsonValue(matchedRecord, { label: '状态', paths: ['status', 'statusName'], required: false })).toBe('已通过');
          expect(__e2e.pickJsonValue(matchedRecord, { label: '客户名称', paths: ['customerName', 'name'], required: false })).toBe('Beta');
        });`,
        'worker-pick-json-record'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'retries env login once before failing when the first submit leaves the login surface visible',
    async () => {
      const loginHtml = encodeURIComponent(`<!doctype html>
        <html lang="zh-CN">
          <body>
            <div id="login-root">
              <input id="normal_login_codePhone" placeholder="请输入手机号" />
              <input id="normal_login_code" placeholder="请输入验证码" />
              <button id="login-btn" type="button">登 录</button>
            </div>
            <script>
              let clickCount = 0;
              const loginRoot = document.getElementById('login-root');
              const loginButton = document.getElementById('login-btn');
              loginButton?.addEventListener('click', () => {
                clickCount += 1;
                document.body.setAttribute('data-login-clicks', String(clickCount));
                if (clickCount < 2) return;

                setTimeout(() => {
                  if (loginRoot) loginRoot.innerHTML = '';
                  document.body.setAttribute('data-auth', 'ok');
                  document.body.insertAdjacentHTML('beforeend', '<h1>登录成功</h1>');
                }, 120);
              });
            </script>
          </body>
        </html>`);

      const targetUrl = `data:text/html;charset=utf-8,${loginHtml}`;
      const result = await executeTest(
        `test('login helper retries once', async ({ page }) => {
          const TARGET_URL = ${JSON.stringify(targetUrl)};
          await page.goto(TARGET_URL);
          await __e2e.loginWithEnvAuth(page, {
            loginUrl: TARGET_URL,
            postLoginSettleMs: 20,
            postLoginTransitionTimeoutMs: 120,
            retryLoginDelayMs: 20,
            loginRetryCount: 2,
          });

          await expect(page.locator('body')).toHaveAttribute('data-auth', 'ok');
          await expect(page.locator('body')).toHaveAttribute('data-login-clicks', '2');
          await expect(page.getByText('登录成功')).toBeVisible();
        });`,
        'worker-login-retry',
        {
          username: '13800138000',
          password: '123456',
          loginDescription: '短信验证码登录',
        }
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'matches nested list records when the fallback identifier is only present in deep array fields',
    async () => {
      const result = await executeTest(
        `test('worker nested json record matching', async () => {
          const payload = {
            code: 1,
            data: {
              records: [
                {
                  businessId: 'BIZ-001',
                  contactInfo: [{ people: 'Alpha', way: [{ itmValue: '19900001234' }] }],
                  progress: { displayStatus: '待跟进' },
                },
                {
                  businessId: 'BIZ-002',
                  contactInfo: [{ people: 'Beta', way: [{ itmValue: '19900005678' }] }],
                  progress: { displayStatus: '新入库' },
                },
              ],
            },
          };

          const matchedRecord = __e2e.pickJsonRecord(payload, {
            label: 'leadMobile',
            value: '19900005678',
            paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'],
            required: false,
          });

          expect(matchedRecord).toBeTruthy();
          expect(__e2e.pickJsonValue(matchedRecord, { label: 'businessId', paths: ['businessId'], required: false })).toBe('BIZ-002');
          expect(__e2e.pickJsonValue(matchedRecord, { label: '状态', paths: ['progress.displayStatus'], required: false })).toBe('新入库');
        });`,
        'worker-pick-json-record-nested'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'observes modal close after submit button loading settles',
    async () => {
      const result = await executeTest(
        `test('observe submit state closes modal', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="ant-modal-wrap" style="display:block">
              <div class="ant-modal">
                <div class="ant-modal-content">
                  <div class="ant-modal-header">
                    <div class="ant-modal-title">新增客户</div>
                  </div>
                  <div class="ant-modal-body">客户表单</div>
                  <div class="ant-modal-footer">
                    <button id="save-btn" type="button" class="ant-btn">保存</button>
                  </div>
                </div>
              </div>
            </div>
          \`);

          await page.evaluate(() => {
            const wrap = document.querySelector('.ant-modal-wrap');
            const button = document.getElementById('save-btn');
            if (!(button instanceof HTMLElement)) return;

            button.addEventListener('click', () => {
              button.classList.add('ant-btn-loading');
              setTimeout(() => {
                button.classList.remove('ant-btn-loading');
                if (wrap instanceof HTMLElement) wrap.style.display = 'none';
              }, 180);
            });
          });

          const saveButton = page.locator('#save-btn');
          await saveButton.click();
          await __e2e.observeSubmitState(page, {
            submitButton: saveButton,
            closeTitleIncludes: '新增客户',
            timeoutMs: 2500,
            settleMs: 80,
          });

          await expect(page.locator('.ant-modal-wrap')).toBeHidden();
        });`,
        'worker-observe-submit-state-modal-close'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'observes list refresh completion after submit success locator appears',
    async () => {
      const result = await executeTest(
        `test('observe submit state waits for list refresh', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="ant-table-wrapper">
              <button id="save-btn" type="button" class="ant-btn">保存</button>
              <div id="table-spin" class="ant-spin ant-spin-spinning" style="display:none">loading</div>
              <table>
                <tbody>
                  <tr id="new-row" style="display:none"><td>张三</td></tr>
                </tbody>
              </table>
            </div>
          \`);

          await page.evaluate(() => {
            const button = document.getElementById('save-btn');
            const spin = document.getElementById('table-spin');
            const row = document.getElementById('new-row');
            if (!(button instanceof HTMLElement)) return;

            button.addEventListener('click', () => {
              button.classList.add('ant-btn-loading');
              setTimeout(() => {
                button.classList.remove('ant-btn-loading');
              }, 100);
              setTimeout(() => {
                if (row instanceof HTMLElement) row.style.display = 'table-row';
              }, 220);
              setTimeout(() => {
                if (spin instanceof HTMLElement) spin.style.display = 'block';
              }, 260);
              setTimeout(() => {
                if (spin instanceof HTMLElement) spin.style.display = 'none';
                document.body.setAttribute('data-refresh', 'done');
              }, 420);
            });
          });

          const saveButton = page.locator('#save-btn');
          await saveButton.click();
          await __e2e.observeSubmitState(page, {
            submitButton: saveButton,
            successLocator: page.locator('#new-row'),
            busyScope: page.locator('.ant-table-wrapper').first(),
            timeoutMs: 2500,
            settleMs: 80,
          });

          await expect(page.locator('#new-row')).toBeVisible();
          await expect(page.locator('body')).toHaveAttribute('data-refresh', 'done');
        });`,
        'worker-observe-submit-state-list-refresh'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'observes hash-route changes without waiting for a full page load event',
    async () => {
      const result = await executeTest(
        `test('observe submit state handles hash route change', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <button id="save-btn" type="button" class="ant-btn">保存</button>
            <div id="screen">create</div>
          \`);

          await page.evaluate(() => {
            window.location.hash = '#/business/createbusiness';
            const button = document.getElementById('save-btn');
            const screen = document.getElementById('screen');
            if (!(button instanceof HTMLElement)) return;

            button.addEventListener('click', () => {
              button.classList.add('ant-btn-loading');
              setTimeout(() => {
                button.classList.remove('ant-btn-loading');
              }, 80);
              setTimeout(() => {
                window.location.hash = '#/business/businesslist';
                if (screen instanceof HTMLElement) screen.textContent = 'list';
                document.body.setAttribute('data-route', 'list');
              }, 160);
            });
          });

          const saveButton = page.locator('#save-btn');
          await saveButton.click();
          await __e2e.observeSubmitState(page, {
            submitButton: saveButton,
            urlIncludes: '#/business/businesslist',
            timeoutMs: 2500,
            settleMs: 80,
          });

          await expect(page.locator('body')).toHaveAttribute('data-route', 'list');
          await expect.poll(() => page.url()).toContain('#/business/businesslist');
        });`,
        'worker-observe-submit-state-hash-route'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'treats urlIncludes as best-effort observation unless strict URL matching is requested',
    async () => {
      const result = await executeTest(
        `test('observe submit state keeps going when optional url match is absent', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <button id="save-btn" type="button" class="ant-btn">保存</button>
            <div id="done" style="display:none">done</div>
          \`);

          await page.evaluate(() => {
            const button = document.getElementById('save-btn');
            const done = document.getElementById('done');
            if (!(button instanceof HTMLElement)) return;

            button.addEventListener('click', () => {
              button.classList.add('ant-btn-loading');
              setTimeout(() => {
                button.classList.remove('ant-btn-loading');
              }, 60);
              setTimeout(() => {
                if (done instanceof HTMLElement) done.style.display = 'block';
                document.body.setAttribute('data-submit', 'done');
              }, 140);
            });
          });

          const saveButton = page.locator('#save-btn');
          await saveButton.click();
          await __e2e.observeSubmitState(page, {
            submitButton: saveButton,
            urlIncludes: '#/business/businesslist',
            successLocator: page.locator('#done'),
            timeoutMs: 1500,
            urlTimeoutMs: 240,
            settleMs: 80,
          });

          await expect(page.locator('body')).toHaveAttribute('data-submit', 'done');
          await expect(page.locator('#done')).toBeVisible();
          await expect.poll(() => page.url().includes('#/business/businesslist')).toBe(false);
        });`,
        'worker-observe-submit-state-optional-url'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'resolves a primary record from table search before falling back to detail',
    async () => {
      const result = await executeTest(
        `test('resolve primary record in table', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="search">
              <input id="businessList_keywords" />
              <button id="search-btn" type="button">搜索</button>
            </div>
            <div class="ant-table-wrapper">
              <div id="table-spin" class="ant-spin ant-spin-spinning" style="display:none">loading</div>
              <table>
                <tbody>
                  <tr id="target-row" data-row-key="biz-1" style="display:none">
                    <td>BIZ-001</td>
                    <td>新入库</td>
                  </tr>
                </tbody>
              </table>
            </div>
          \`);

          await page.evaluate(() => {
            const button = document.getElementById('search-btn');
            const row = document.getElementById('target-row');
            const spin = document.getElementById('table-spin');
            if (!(button instanceof HTMLElement)) return;

            button.addEventListener('click', () => {
              if (spin instanceof HTMLElement) spin.style.display = 'block';
              setTimeout(() => {
                if (row instanceof HTMLElement) row.style.display = 'table-row';
              }, 140);
              setTimeout(() => {
                if (spin instanceof HTMLElement) spin.style.display = 'none';
                document.body.setAttribute('data-search', 'done');
              }, 260);
            });
          });

          const recordCheck = await __e2e.resolvePrimaryRecord(page, {
            primaryValue: 'BIZ-001',
            keywordInput: page.locator('#businessList_keywords'),
            searchButton: page.locator('#search-btn'),
            rowHasTexts: ['BIZ-001', '新入库'],
            busyScope: page.locator('.ant-table-wrapper').first(),
            timeoutMs: 3000,
          });

          expect(recordCheck.mode).toBe('table_row');
          expect(recordCheck.row).toBeTruthy();
          await expect(recordCheck.row).toContainText('新入库');
          await expect(page.locator('body')).toHaveAttribute('data-search', 'done');
        });`,
        'worker-resolve-primary-record-table'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'falls back to detail url when primary-key list search misses the target row',
    async () => {
      const result = await executeTest(
        `test('resolve primary record detail fallback', async ({ page }) => {
          const listHtml = encodeURIComponent(\`<!doctype html>
            <html>
              <body>
                <div class="search">
                  <input id="businessList_keywords" />
                  <button id="search-btn" type="button">搜索</button>
                </div>
                <div class="ant-table-wrapper">
                  <table><tbody></tbody></table>
                </div>
              </body>
            </html>\`);
          const detailHtml = encodeURIComponent(\`<!doctype html>
            <html>
              <body>
                <h1>商机详情</h1>
                <div id="business-id">BIZ-001</div>
              </body>
            </html>\`);
          const LIST_URL = \`data:text/html;charset=utf-8,\${listHtml}\`;
          const DETAIL_URL = \`data:text/html;charset=utf-8,\${detailHtml}\`;

          await page.goto(LIST_URL);
          const recordCheck = await __e2e.resolvePrimaryRecord(page, {
            primaryValue: 'BIZ-001',
            keywordInput: page.locator('#businessList_keywords'),
            searchButton: page.locator('#search-btn'),
            rowHasTexts: ['BIZ-001', '新入库'],
            detailUrl: DETAIL_URL,
            timeoutMs: 3000,
          });

          expect(recordCheck.mode).toBe('detail_url');
          expect(recordCheck.row).toBe(null);
          await expect(page.getByText('商机详情')).toBeVisible();
          await expect(page.locator('#business-id')).toContainText('BIZ-001');
          await expect.poll(() => page.url()).toContain('data:text/html');
        });`,
        'worker-resolve-primary-record-detail'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'retries primary lookup until a delayed table row appears',
    async () => {
      const result = await executeTest(
        `test('resolve primary record retry delayed row', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="search">
              <input id="businessList_keywords" />
              <button id="search-btn" type="button">搜索</button>
            </div>
            <div class="ant-table-wrapper">
              <div id="table-spin" class="ant-spin-spinning" style="display:none">loading</div>
              <table><tbody>
                <tr id="target-row" data-row-key="biz-1" style="display:none">
                  <td>BIZ-001</td>
                  <td>张三</td>
                </tr>
              </tbody></table>
            </div>
          \`);

          await page.evaluate(() => {
            let count = 0;
            const button = document.getElementById('search-btn');
            const row = document.getElementById('target-row');
            const spin = document.getElementById('table-spin');
            if (!(button instanceof HTMLElement)) return;

            button.addEventListener('click', () => {
              count += 1;
              document.body.setAttribute('data-search-count', String(count));
              if (spin instanceof HTMLElement) spin.style.display = 'block';
              setTimeout(() => {
                if (count >= 2 && row instanceof HTMLElement) row.style.display = 'table-row';
              }, 120);
              setTimeout(() => {
                if (spin instanceof HTMLElement) spin.style.display = 'none';
              }, 240);
            });
          });

          const recordCheck = await __e2e.resolvePrimaryRecord(page, {
            primaryValue: 'BIZ-001',
            keywordInput: page.locator('#businessList_keywords'),
            searchButton: page.locator('#search-btn'),
            rowHasTexts: ['BIZ-001'],
            busyScope: page.locator('.ant-table-wrapper').first(),
            maxLookupAttempts: 3,
            retryIntervalMs: 80,
            timeoutMs: 4000,
          });

          expect(recordCheck.mode).toBe('table_row');
          expect(recordCheck.row).toBeTruthy();
          await expect(recordCheck.row).toContainText('BIZ-001');
          await expect(page.locator('body')).toHaveAttribute('data-search-count', '2');
        });`,
        'worker-resolve-primary-record-retry'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'relaxes primary lookup to the primary value when secondary row text is not rendered',
    async () => {
      const result = await executeTest(
        `test('resolve primary record with primary-only fallback', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="search">
              <input id="businessList_keywords" />
              <button id="search-btn" type="button">搜索</button>
            </div>
            <div class="ant-table-wrapper">
              <table>
                <tbody>
                  <tr id="target-row" data-row-key="biz-1">
                    <td>13912345678</td>
                    <td>新入库</td>
                  </tr>
                </tbody>
              </table>
            </div>
          \`);

          const recordCheck = await __e2e.resolvePrimaryRecord(page, {
            primaryValue: '13912345678',
            keywordInput: page.locator('#businessList_keywords'),
            searchButton: page.locator('#search-btn'),
            rowHasTexts: ['13912345678', '张三'],
            timeoutMs: 2500,
          });

          expect(recordCheck.mode).toBe('table_row');
          expect(recordCheck.row).toBeTruthy();
          await expect(recordCheck.row).toHaveAttribute('id', 'target-row');
          await expect(recordCheck.row).toContainText('13912345678');
        });`,
        'worker-resolve-primary-record-primary-only-fallback'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'reads detail fields from visible Ant Design drawer descriptions',
    async () => {
      const result = await executeTest(
        `test('read detail field from drawer descriptions', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="ant-drawer-content-wrapper" style="display:block">
              <div class="ant-drawer-content">
                <div class="ant-drawer-header">
                  <div class="ant-drawer-title">商机详情</div>
                </div>
                <div class="ant-drawer-body">
                  <div class="ant-descriptions">
                    <div class="ant-descriptions-view">
                      <table>
                        <tbody>
                          <tr class="ant-descriptions-row">
                            <td class="ant-descriptions-item">
                              <span class="ant-descriptions-item-label">联系人</span>
                              <span class="ant-descriptions-item-content">张三</span>
                            </td>
                          </tr>
                          <tr class="ant-descriptions-row">
                            <td class="ant-descriptions-item">
                              <span class="ant-descriptions-item-label">手机号</span>
                              <span class="ant-descriptions-item-content">13900001234</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          \`);

          const contactText = await __e2e.readDetailField(page, {
            label: '联系人',
            titleIncludes: '商机详情',
          });
          const phoneText = await __e2e.readDetailField(page, {
            label: '手机号',
            titleIncludes: '商机详情',
          });

          expect(contactText).toBe('张三');
          expect(phoneText).toBe('13900001234');
        });`,
        'worker-read-detail-field-drawer-descriptions'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'relaxes detail titles for visible Ant Design overlays and honors required false',
    async () => {
      const result = await executeTest(
        `test('wait for visible modal with relaxed detail title', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="ant-drawer-content-wrapper" style="display:block">
              <div class="ant-drawer-content">
                <div class="ant-drawer-header">
                  <div class="ant-drawer-title">商机</div>
                </div>
                <div class="ant-drawer-body">
                  <div class="detail-body">详情内容</div>
                </div>
              </div>
            </div>
          \`);

          const visibleDrawer = await __e2e.waitForVisibleAntdModal(page, {
            titleIncludes: '商机详情',
            timeoutMs: 1200,
            required: false,
          });
          const missingDrawer = await __e2e.waitForVisibleAntdModal(page, {
            titleIncludes: '不存在的详情',
            timeoutMs: 300,
            required: false,
          });

          await expect(visibleDrawer).toBeVisible();
          expect(missingDrawer).toBeNull();
        });`,
        'worker-wait-visible-modal-relaxed-detail-title'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'reads inline label value detail fields from generic detail layouts',
    async () => {
      const result = await executeTest(
        `test('read detail field from inline detail rows', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <section class="detail-panel">
              <div class="detail-row">
                <span class="label">状态</span>
                <span class="value">已审核</span>
              </div>
              <div class="detail-row">
                <span class="label">创建时间</span>
                <span class="value">2026-03-23 10:00</span>
              </div>
            </section>
          \`);

          const detailPanel = page.locator('.detail-panel').first();
          const statusText = await __e2e.readDetailField(page, { label: '状态', scope: detailPanel });
          const createdAtText = await __e2e.readDetailField(page, { label: '创建时间', scope: detailPanel });

          expect(statusText).toBe('已审核');
          expect(createdAtText).toContain('2026-03-23 10:00');
        });`,
        'worker-read-detail-field-inline-layout'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'uses titleIncludes to scope detail field reads to the matching detail page section',
    async () => {
      const result = await executeTest(
        `test('read detail field from titled detail page section', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <aside class="side-panel">
              <div class="detail-row">
                <span class="label">状态</span>
                <span class="value">无意向</span>
              </div>
            </aside>
            <section class="business-detail-page">
              <header class="page-header">
                <h2>商机详情</h2>
              </header>
              <div class="detail-panel">
                <div class="detail-row">
                  <span class="label">状态</span>
                  <span class="value">新入库</span>
                </div>
                <div class="detail-row">
                  <span class="label">商机进展</span>
                  <span class="value">新入库</span>
                </div>
              </div>
            </section>
          \`);

          const statusText = await __e2e.readDetailField(page, {
            label: '状态',
            titleIncludes: '商机详情',
          });
          const progressText = await __e2e.readDetailField(page, {
            label: '商机进展',
            titleIncludes: '商机详情',
          });

          expect(statusText).toBe('新入库');
          expect(progressText).toBe('新入库');
        });`,
        'worker-read-detail-field-page-title-scope'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'returns null for invalid detail surface pages and avoids blind detail field reads',
    async () => {
      const result = await executeTest(
        `test('invalid detail surface short-circuits detail reads', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <main class="error-page">
              <h1>抱歉！页面好像不见了</h1>
              <p>请联系管理员!</p>
            </main>
          \`);

          const detailSurface = await __e2e.waitForVisibleDetailSurface(page, {
            titleIncludes: '商机详情',
            timeoutMs: 500,
            required: false,
          });
          const detailStatus = await __e2e.readDetailField(page, {
            label: '状态',
            titleIncludes: '商机详情',
            timeoutMs: 500,
            required: false,
          });

          expect(detailSurface).toBe(null);
          expect(detailStatus).toBe('');
        });`,
        'worker-invalid-detail-surface'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'prefers the static status field over interactive status action areas in detail scopes',
    async () => {
      const result = await executeTest(
        `test('read detail field prefers static status over action area', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="ant-modal-root">
              <div class="ant-modal-wrap" style="display:block">
                <div class="ant-modal" style="display:block">
                  <div class="ant-modal-content">
                    <div class="ant-modal-header">
                      <div class="ant-modal-title">商机详情</div>
                    </div>
                    <div class="ant-modal-body">
                      <div class="detail-row">
                        <span class="label">状态</span>
                        <div class="value">
                          <button type="button">无意向</button>
                          <button type="button">有意向</button>
                          <div>友情提醒:选择无意向标签会将该商机自动丢弃/丢入公海中</div>
                        </div>
                      </div>
                      <div class="detail-row">
                        <span class="label">状态</span>
                        <span class="value">新入库</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          \`);

          const detailScope = page.locator('.ant-modal-content').first();
          const statusText = await __e2e.readDetailField(page, { label: '状态', scope: detailScope });

          expect(statusText).toBe('新入库');
        });`,
        'worker-read-detail-field-prefers-static-status'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'keeps status reads scoped to the matching detail row when another field appears earlier in the same panel',
    async () => {
      const result = await executeTest(
        `test('read detail field avoids earlier sibling field values', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="ant-modal-content">
              <div class="detail-panel">
                <div class="detail-row">
                  <span class="label">商机来源</span>
                  <span class="value">抖音</span>
                </div>
                <div class="detail-row">
                  <span class="label">状态</span>
                  <span class="value">新入库</span>
                </div>
              </div>
            </div>
          \`);

          const detailPanel = page.locator('.detail-panel').first();
          const statusText = await __e2e.readDetailField(page, { label: '状态', scope: detailPanel });

          expect(statusText).toBe('新入库');
        });`,
        'worker-read-detail-field-avoids-earlier-sibling-values'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'dedupes Ant Design fixed-column clones when locating a target row',
    async () => {
      const result = await executeTest(
        `test('find antd table row dedupes clones', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="ant-table-wrapper">
              <div class="ant-table-fixed-left">
                <table>
                  <tbody class="ant-table-tbody">
                    <tr id="fixed-row" data-row-key="biz-1">
                      <td>张三</td>
                      <td>13912345678</td>
                      <td>新入库</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="ant-table-body">
                <table>
                  <tbody>
                    <tr id="main-row" data-row-key="biz-1">
                      <td>张三</td>
                      <td>13912345678</td>
                      <td>新入库</td>
                      <td>抖音</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          \`);

          const targetRow = await __e2e.findAntdTableRow(page, {
            hasTexts: ['张三', '13912345678', '新入库'],
            timeoutMs: 1200,
          });

          await expect(targetRow).toHaveAttribute('id', 'main-row');
        });`,
        'worker-find-antd-table-row-dedupes-clones'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'fails loudly when multiple unique Ant Design table records match the same row query',
    async () => {
      const result = await executeTest(
        `test('find antd table row rejects ambiguous matches', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <div class="ant-table-wrapper">
              <div class="ant-table-body">
                <table>
                  <tbody>
                    <tr id="main-row-1" data-row-key="biz-1">
                      <td>张三</td>
                      <td>13912345678</td>
                      <td>新入库</td>
                    </tr>
                    <tr id="main-row-2" data-row-key="biz-2">
                      <td>张三</td>
                      <td>13912345678</td>
                      <td>新入库</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          \`);

          await __e2e.findAntdTableRow(page, {
            hasTexts: ['张三', '13912345678', '新入库'],
            timeoutMs: 900,
          });
        });`,
        'worker-find-antd-table-row-ambiguous'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('表格目标行匹配到多条真实记录');
    },
    20000
  );

  it(
    'retries business-list ownership switching with fallback strategies when the first click does not activate the target view',
    async () => {
      const result = await executeTest(
        `test('business ownership helper fallback', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <input id="businessList_keywords" />
            <div role="tablist">
              <button id="follow-tab" role="tab" aria-selected="true">我跟进的</button>
              <button id="mine-tab" role="tab" aria-selected="false">我创建的</button>
            </div>
          \`);

          await page.evaluate(() => {
            window.location.hash = '#/business/businesslist';
            const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
            const setActive = (label) => {
              document.body.setAttribute('data-ownership', label);
              tabs.forEach((tab) => {
                const active = tab.textContent.trim() === label;
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
              });
            };

            setActive('我跟进的');
            const mineTab = document.getElementById('mine-tab');
            if (!mineTab) return;
            mineTab.addEventListener('mousedown', () => setActive('我创建的'));
            mineTab.addEventListener('click', () => setActive('我跟进的'));
          });

          await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', postSwitchSettleMs: 50 });
          await expect(page.locator('body')).toHaveAttribute('data-ownership', '我创建的');
          await expect(page.getByRole('tab', { name: '我创建的' })).toHaveAttribute('aria-selected', 'true');
        });`,
        'worker-business-ownership-fallback'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'waits for late-rendered business-list ownership chips before giving up',
    async () => {
      const result = await executeTest(
        `test('business ownership helper waits for delayed chips', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <input id="businessList_keywords" />
            <div id="ownership-root"></div>
          \`);

          await page.evaluate(() => {
            window.location.hash = '#/business/businesslist';
            const root = document.getElementById('ownership-root');
            setTimeout(() => {
              if (!root) return;
              root.innerHTML = \`
                <div role="tablist">
                  <button id="follow-tab" role="tab" aria-selected="true">我跟进的</button>
                  <button id="mine-tab" role="tab" aria-selected="false">我创建的</button>
                </div>
              \`;
              const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
              const setActive = (label) => {
                document.body.setAttribute('data-ownership', label);
                tabs.forEach((tab) => {
                  const active = tab.textContent.trim() === label;
                  tab.setAttribute('aria-selected', active ? 'true' : 'false');
                });
              };
              setActive('我跟进的');
              root.querySelector('#mine-tab')?.addEventListener('click', () => setActive('我创建的'));
            }, 450);
          });

          await __e2e.switchBusinessListOwnershipView(page, {
            label: '我创建的',
            postSwitchSettleMs: 50,
            ownershipControlTimeoutMs: 1500,
          });
          await expect(page.locator('body')).toHaveAttribute('data-ownership', '我创建的');
          await expect(page.getByRole('tab', { name: '我创建的' })).toHaveAttribute('aria-selected', 'true');
        });`,
        'worker-business-ownership-delayed-chips'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'switches business-list ownership through the top dropdown trigger when tabs are not present',
    async () => {
      const result = await executeTest(
        `test('business ownership helper top dropdown', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <input id="businessList_keywords" />
            <div class="business-list-top">
              <span class="head-menu ant-dropdown-trigger" style="display:none">我跟进的</span>
              <span id="ownership-trigger" class="head-menu ant-dropdown-trigger" style="display:none">我跟进的</span>
            </div>
            <div id="ownership-menu" class="ant-dropdown" style="display:none; position:absolute; left:16px; top:48px;">
              <ul class="ant-dropdown-menu" role="menu">
                <li class="ant-dropdown-menu-item" role="menuitem">我跟进的</li>
                <li class="ant-dropdown-menu-item" role="menuitem">我创建的</li>
              </ul>
            </div>
          \`);

          await page.evaluate(() => {
            window.location.hash = '#/business/businesslist';
            const trigger = document.getElementById('ownership-trigger');
            const menu = document.getElementById('ownership-menu');
            const items = Array.from(document.querySelectorAll('.ant-dropdown-menu-item'));
            const setOwnership = (label) => {
              document.body.setAttribute('data-ownership', label);
              if (trigger) trigger.textContent = label;
              if (menu) menu.style.display = 'none';
            };

            setOwnership('我跟进的');
            setTimeout(() => {
              if (trigger) trigger.style.display = 'inline-block';
            }, 180);
            trigger?.addEventListener('click', () => {
              if (menu) menu.style.display = 'block';
            });
            items.forEach((item) => {
              item.addEventListener('click', () => setOwnership(item.textContent.trim()));
            });
          });

          await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', postSwitchSettleMs: 50 });
          await expect(page.locator('body')).toHaveAttribute('data-ownership', '我创建的');
          await expect(page.locator('#ownership-trigger')).toHaveText('我创建的');
        });`,
        'worker-business-ownership-top-dropdown'
      );

      expect(result).toMatchObject({
        success: true,
        error: null,
      });
    },
    20000
  );

  it(
    'returns a specific error when the top dropdown trigger does not contain the target ownership item',
    async () => {
      const result = await executeTest(
        `test('business ownership helper top dropdown missing item', async ({ page }) => {
          await page.goto('about:blank');
          await page.setContent(\`
            <input id="businessList_keywords" />
            <div class="business-list-top">
              <span id="ownership-trigger" class="head-menu ant-dropdown-trigger">我跟进的</span>
            </div>
            <div id="ownership-menu" class="ant-dropdown" style="display:none; position:absolute; left:16px; top:48px;">
              <ul class="ant-dropdown-menu" role="menu">
                <li class="ant-dropdown-menu-item" role="menuitem">我跟进的</li>
                <li class="ant-dropdown-menu-item" role="menuitem">全部商机</li>
              </ul>
            </div>
          \`);

          await page.evaluate(() => {
            window.location.hash = '#/business/businesslist';
            const trigger = document.getElementById('ownership-trigger');
            const menu = document.getElementById('ownership-menu');

            document.body.setAttribute('data-ownership', '我跟进的');
            trigger?.addEventListener('click', () => {
              if (menu) menu.style.display = 'block';
            });
          });

          await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', postSwitchSettleMs: 50 });
        });`,
        'worker-business-ownership-top-dropdown-missing-item'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('顶部归属菜单中不存在目标项');
      expect(result.error).toContain('label=我创建的');
    },
    20000
  );
});
