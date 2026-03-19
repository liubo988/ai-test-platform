import fs from 'node:fs/promises';
import path from 'node:path';
import { callLLMStream } from './llm-client';
import { renderIntentActionLibrary, selectIntentActionLibrary } from './intent-action-library';
import { renderIntentRepairMemoryHints, type IntentRepairMemoryHint } from './ai/intent-repair-memory';
import { buildIntentActionDSL, renderIntentActionDSL, type IntentActionDSL, type IntentActionStepInput } from './intent-action-dsl';
import {
  applyIntentProjectKnowledgeToDsl,
  renderIntentProjectKnowledge,
  resolveIntentProjectKnowledge,
  type IntentProjectKnowledgeResolution,
  type IntentProjectKnowledgeRulePerformance,
} from './intent-project-knowledge';
import type { LLMRuntimeOverrides } from './llm/provider-config';
import type { PageSnapshot, AuthConfig } from './page-analyzer';

export interface GenerateEvent {
  type: 'thinking' | 'code' | 'complete' | 'error';
  content: string;
}

export interface GenerateTestContext {
  taskMode?: 'page' | 'scenario';
  scenarioEntryUrl?: string;
  scenarioSummary?: string;
  expectedOutcome?: string;
  sharedVariables?: string[];
  cleanupNotes?: string;
  relatedSnapshots?: PageSnapshot[];
  scenarioSteps?: IntentActionStepInput[];
  actionDsl?: IntentActionDSL;
}

export interface RepairTestContext {
  previousCode: string;
  executionError: string;
  recentEvents?: string[];
  repairMemoryHints?: IntentRepairMemoryHint[];
}

const ROOT = process.cwd();

async function loadEdgeCases(_url: string): Promise<any[]> {
  try {
    const casesPath = path.join(ROOT, 'edge-cases', 'cases.json');
    const cases = JSON.parse(await fs.readFile(casesPath, 'utf8'));
    return cases.filter((c: any) => c.status === 'new' || c.status === 'active').slice(0, 10);
  } catch {
    return [];
  }
}

function buildTaskHaystack(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): string {
  return [
    snapshot.url,
    snapshot.title,
    snapshot.bodyTextExcerpt || '',
    description,
    context?.scenarioEntryUrl || '',
    context?.scenarioSummary || '',
    context?.expectedOutcome || '',
  ]
    .join('\n')
    .toLowerCase();
}

function buildIntentHaystack(description: string, context?: GenerateTestContext): string {
  return [
    description,
    context?.scenarioEntryUrl || '',
    context?.scenarioSummary || '',
    context?.expectedOutcome || '',
    context?.cleanupNotes || '',
    ...(context?.sharedVariables || []),
  ]
    .join('\n')
    .toLowerCase();
}

export interface ResolvedPromptPlanningContext {
  dsl: IntentActionDSL;
  knowledge: IntentProjectKnowledgeResolution;
}

export interface ResolveIntentPromptPlanningOptions {
  rulePerformanceById?: Record<string, IntentProjectKnowledgeRulePerformance>;
}

export function resolveIntentPromptPlanningContext(
  snapshot: PageSnapshot,
  description: string,
  context?: GenerateTestContext,
  options: ResolveIntentPromptPlanningOptions = {}
): ResolvedPromptPlanningContext {
  const baseDsl =
    context?.actionDsl ||
    buildIntentActionDSL({
      taskMode: context?.taskMode,
      targetUrl: context?.scenarioEntryUrl || snapshot.url,
      featureDescription: description,
      expectedOutcome: context?.expectedOutcome,
      sharedVariables: context?.sharedVariables,
      cleanupNotes: context?.cleanupNotes,
      steps: context?.scenarioSteps,
    });

  const knowledge = resolveIntentProjectKnowledge({
    snapshot,
    description,
    dsl: baseDsl,
  }, {
    rulePerformanceById: options.rulePerformanceById,
  });

  return {
    dsl: applyIntentProjectKnowledgeToDsl(baseDsl, knowledge),
    knowledge,
  };
}

function buildActionDslSection(planning: ResolvedPromptPlanningContext): string {
  return `
${renderIntentActionDSL(planning.dsl)}`;
}

function buildProjectKnowledgeSection(planning: ResolvedPromptPlanningContext): string {
  const rendered = renderIntentProjectKnowledge(planning.knowledge);
  return rendered ? `
${rendered}` : '';
}

function formatPlanningKnowledgeHitMessage(prefix: string, planning: ResolvedPromptPlanningContext): string {
  if (planning.knowledge.matches.length === 0) {
    return planning.knowledge.deprioritizedMatches.length > 0
      ? `${prefix}未启用项目知识规则；另有 ${planning.knowledge.deprioritizedMatches.length} 条规则因历史表现、观察期或回滚风险被降权跳过。`
      : `${prefix}未命中项目知识规则，继续使用通用 DSL。`;
  }

  const hitText = `${prefix}命中 ${planning.knowledge.matches.length} 条项目知识规则：${planning.knowledge.matches
    .slice(0, 3)
    .map((item) => item.title)
    .join(' / ')}`;
  return planning.knowledge.deprioritizedMatches.length > 0
    ? `${hitText}；另有 ${planning.knowledge.deprioritizedMatches.length} 条规则因历史表现、观察期或回滚风险被降权跳过。`
    : hitText;
}

function buildActionLibrarySection(
  snapshot: PageSnapshot,
  auth: AuthConfig | undefined,
  planning: ResolvedPromptPlanningContext
): string {
  const library = selectIntentActionLibrary({
    dsl: planning.dsl,
    auth,
    snapshot,
    preferredCapabilitySlugs: planning.knowledge.capabilitySlugs,
  });

  const rendered = renderIntentActionLibrary(library);
  return rendered ? `
${rendered}` : '';
}

function looksLikeBusinessCreateOrderTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const intentHaystack = buildIntentHaystack(description, context);

  return (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    (intentHaystack.includes('生成订单') ||
      intentHaystack.includes('createorder') ||
      intentHaystack.includes('订单信息') ||
      intentHaystack.includes('签约成功') ||
      intentHaystack.includes('商机转订单') ||
      intentHaystack.includes('转订单'))
  );
}

function looksLikeBusinessCreateTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const intentHaystack = buildIntentHaystack(description, context);
  const urlHaystack = [snapshot.url, context?.scenarioEntryUrl || ''].join('\n').toLowerCase();

  return (
    intentHaystack.includes('创建商机') ||
    intentHaystack.includes('新增商机') ||
    intentHaystack.includes('createbusiness') ||
    intentHaystack.includes('主链路提交') ||
    urlHaystack.includes('/business/createbusiness')
  );
}

function looksLikeBusinessBatchAddContactsTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const intentHaystack = buildIntentHaystack(description, context);
  const taskHaystack = buildTaskHaystack(snapshot, description, context);

  return (
    (intentHaystack.includes('批量加入通讯录') || (intentHaystack.includes('加入通讯录') && intentHaystack.includes('通讯录'))) &&
    (intentHaystack.includes('商机列表') || taskHaystack.includes('/business/businesslist') || taskHaystack.includes('首页商机列表'))
  );
}

function looksLikeCompanySearchTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const haystack = [
    buildTaskHaystack(snapshot, description, context),
    ...(snapshot.frames || []).flatMap((item) => [item.url, item.name, item.bodyTextExcerpt || '']),
  ]
    .join('\n')
    .toLowerCase();

  return (
    haystack.includes('搜企业') ||
    haystack.includes('/company/easyindex') ||
    haystack.includes('easysearchlist') ||
    haystack.includes('统一信用代码') ||
      haystack.includes('股东信息搜索企业')
  );
}

function looksLikeServiceCommissionConfigTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const haystack = buildTaskHaystack(snapshot, description, context);
  const intentHaystack = buildIntentHaystack(description, context);

  return (
    (haystack.includes('/commission/subcommissionconfig') || haystack.includes('服务分佣配置')) &&
    intentHaystack.includes('分佣配置') &&
    (intentHaystack.includes('佣金比例') || intentHaystack.includes('分佣比例')) &&
    (intentHaystack.includes('商机创建人') || intentHaystack.includes('订单签单人') || intentHaystack.includes('企业引入人'))
  );
}

function extractCommissionSearchKeyword(description: string, context?: GenerateTestContext): string {
  const source = [description, context?.scenarioSummary || '', context?.expectedOutcome || ''].join('\n');
  const patterns = [
    /关键词\s*[:：]?\s*[“"']?([A-Za-z0-9_-]{1,32})[”"']?/i,
    /搜索\s*[“"']?([A-Za-z0-9_-]{1,32})[”"']?/i,
    /服务ID\s*[:：]?\s*([A-Za-z0-9_-]{1,32})/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return '';
}

function extractCommissionTargetRatio(description: string, context?: GenerateTestContext): string {
  const source = [description, context?.scenarioSummary || '', context?.expectedOutcome || ''].join('\n');
  const patterns = [
    /(?:改为|修改为|设置为|填写为|调整为)\s*([0-9]+(?:\.[0-9]+)?)\s*%/i,
    /佣金比例(?:[^0-9]{0,8})([0-9]+(?:\.[0-9]+)?)\s*%/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return '';
}

function extractCommissionRoleLabel(description: string, context?: GenerateTestContext): string {
  const source = [description, context?.scenarioSummary || '', context?.expectedOutcome || ''].join('\n');
  const labels = ['商机创建人', '订单签单人', '企业引入人'];
  return labels.find((label) => source.includes(label)) || '';
}

function extractEmbeddedExample(source: string): string {
  const match = source.match(/const GENERATED_CODE = String\.raw`([\s\S]*?)`;/);
  return match ? match[1].trim() : source;
}

async function loadExistingExample(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): Promise<string> {
  const candidates = looksLikeBusinessCreateOrderTask(snapshot, description, context)
    ? [
        { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-order-case.mjs'), embedded: true },
        { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-case.mjs'), embedded: true },
        { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
      ]
    : looksLikeBusinessCreateTask(snapshot, description, context)
    ? [
        { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-case.mjs'), embedded: true },
        { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
      ]
    : looksLikeBusinessBatchAddContactsTask(snapshot, description, context)
      ? [
          { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-batch-add-contacts-case.mjs'), embedded: true },
          { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
        ]
    : looksLikeCompanySearchTask(snapshot, description, context)
      ? [
          { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-company-search-case.mjs'), embedded: true },
          { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
        ]
      : [{ filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false }];

  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate.filePath, 'utf8');
      return candidate.embedded ? extractEmbeddedExample(content) : content;
    } catch {
      // Try the next example source.
    }
  }

  return '';
}

function buildBusinessBatchAddContactsTemplate(): string {
  return String.raw`test('商机列表-随机勾选一个商机并批量加入通讯录', async ({ page }) => {
  const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
  const BUSINESS_LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
  const MAILS_LIST_URL = 'https://uat-service.yikaiye.com/#/mails/mailslist';
  const USERNAME = process.env.E2E_USERNAME;
  const PASSWORD = process.env.E2E_PASSWORD;

  test.skip(!USERNAME || !PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD，无法执行短信验证码登录');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const smsTab = page.getByText(/短信验证码登录|短信登录/i).first();
  if (await smsTab.isVisible({ timeout: 10000 }).catch(() => false)) {
    await smsTab.click();
  }

  await page.getByPlaceholder(/请输入手机号|手机号|手机号码/i).first().fill(String(USERNAME).replace(/\s+/g, ''));
  await page.getByPlaceholder(/请输入验证码|验证码|获取验证码/i).first().fill(String(PASSWORD));
  await page.getByRole('button', { name: /登\s*录|登录|Login/i }).first().click();

  // 登录后先等待首页稳定，再切到商机列表，避免 hash 路由被首页初始化过程覆盖。
  await expect(page.getByRole('button', { name: '全部清除' })).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.goto(BUSINESS_LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.hash.includes('/business/businesslist'), { timeout: 30000 });
  await page.locator('#businessList_keywords').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('button', { name: '批量加入通讯录' }).waitFor({ state: 'visible', timeout: 30000 });
  const stageLabels = ['新入库', '需跟踪', '确认意向', '邀约成功', '面谈成功', '签约成功'];
  const normalizeRowText = (value) => value.replace(/\s+/g, ' ').trim();
  const escapeRegExp = (value) => value.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&');
  const collectPhones = (...sources) =>
    Array.from(
      new Set(
        sources
          .flatMap((source) => normalizeRowText(source).replace(/[^\d]/g, ' ').match(/1\d{10}/g) || [])
          .filter(Boolean)
      )
    );
  const extractBusinessId = (...sources) => {
    for (const source of sources) {
      const matches = normalizeRowText(source).replace(/[^\d]/g, ' ').match(/\b\d{6,12}\b/g) || [];
      const candidate = matches.find((item) => !/^1\d{10}$/.test(item));
      if (candidate) return candidate;
    }
    return '';
  };

  async function waitForRowsOrPlaceholder() {
    await page.waitForFunction(() => {
      const rowCount = document.querySelectorAll('.ant-table .ant-table-tbody > tr').length;
      return rowCount > 0 || Boolean(document.querySelector('.ant-table-placeholder'));
    }, { timeout: 30000 });
  }

  async function collectBusinessRows() {
    const rows = page.locator('.ant-table .ant-table-tbody > tr');
    const businessRows = [];
    const rowDebug = [];
    const seenPhones = new Set();
    const rowCount = await rows.count();
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      if ((await row.locator('.ant-checkbox').count()) === 0) continue;
      const rowKey = ((await row.getAttribute('data-row-key')) || '').trim();
      const linkTexts = (await row.locator('a').allInnerTexts())
        .map((item) => normalizeRowText(item))
        .filter(Boolean);
      const cellTexts = (await row.locator('td').allInnerTexts())
        .map((item) => normalizeRowText(item))
        .filter(Boolean);
      const rowText = normalizeRowText(await row.innerText());
      rowDebug.push({
        index: index + 1,
        rowKey,
        rowText: rowText.slice(0, 160),
      });
      const phone = collectPhones(rowKey, rowText, ...linkTexts, ...cellTexts).find((item) => !seenPhones.has(item)) || '';
      const businessId = extractBusinessId(rowKey, rowText, ...linkTexts, ...cellTexts);
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      businessRows.push({ row, phone, businessId });
      if (businessRows.length >= 10) break;
    }
    return { businessRows, rowDebug };
  }

  async function findPositiveStageCandidates() {
    return page.evaluate((labels) => {
      const bodyText = (document.body.innerText || '').replace(/\s+/g, ' ');
      return labels
        .map((label) => {
          const match = bodyText.match(new RegExp(label + '\\((\\d+)\\)'));
          return { label, count: match ? Number(match[1]) : 0 };
        })
        .filter((item) => item.count > 0)
        .sort((left, right) => right.count - left.count);
    }, stageLabels);
  }

  await waitForRowsOrPlaceholder();
  await page.waitForTimeout(1500);

  let { businessRows, rowDebug } = await collectBusinessRows();
  let selectedStage = '';
  let positiveStages = [];
  if (businessRows.length === 0) {
    positiveStages = await findPositiveStageCandidates();
    for (const stage of positiveStages) {
      const stageChip = page.getByText(new RegExp(escapeRegExp(stage.label) + '\\(' + stage.count + '\\)')).first();
      if (!(await stageChip.isVisible({ timeout: 3000 }).catch(() => false))) continue;
      await stageChip.click({ timeout: 10000 });
      selectedStage = stage.label;
      await page.waitForFunction(() => document.querySelectorAll('.ant-table .ant-table-tbody > tr').length > 0, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
      ({ businessRows, rowDebug } = await collectBusinessRows());
      if (businessRows.length > 0) break;
    }
  }

  if (businessRows.length === 0) {
    console.log('[BATCH-CONTACTS-STAGE-DEBUG]', JSON.stringify(positiveStages));
    const sampledRows = rowDebug.slice(0, 8);
    console.log('[BATCH-CONTACTS-ROW-DEBUG]', JSON.stringify({ selectedStage, sampledRows }));
  }
  expect(businessRows.length).toBeGreaterThan(0);

  const selected = businessRows[Math.floor(Math.random() * businessRows.length)];
  const targetRow = selected.row;
  const targetPhone = selected.phone;

  await targetRow.locator('.ant-checkbox').first().click({ force: true, timeout: 10000 });
  await expect(targetRow.locator('.ant-checkbox-checked')).toHaveCount(1, { timeout: 10000 });

  await page.getByRole('button', { name: '批量加入通讯录' }).click();

  const feedback = page
    .locator('.ant-message-notice, .ant-notification-notice')
    .filter({ hasText: /加入通讯录|通讯录/ })
    .first();
  await expect(feedback).toBeVisible({ timeout: 15000 });
  const feedbackText = (await feedback.innerText()).replace(/\s+/g, ' ').trim();
  expect(/加入通讯录|已存在您的通讯录|未成功加入通讯录/.test(feedbackText)).toBeTruthy();

  // 某些联系人本来就已存在通讯录，因此最终以“通讯录里能检索到该手机号”为主断言。
  await page.goto(MAILS_LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.hash.includes('/mails/mailslist'), { timeout: 30000 });
  await expect(page.locator('body')).toContainText('我的联系人', { timeout: 30000 });
  await page.locator('#mail-list_keywords').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#mail-list_keywords').fill(targetPhone);
  await page.getByRole('button', { name: /搜\s*索/ }).first().click();
  await page.waitForTimeout(3000);

  await expect(page.locator('body')).toContainText(targetPhone, { timeout: 30000 });
});`;
}

function buildServiceCommissionConfigTemplate(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): string {
  const targetUrl = context?.scenarioEntryUrl || snapshot.url;
  const keyword = extractCommissionSearchKeyword(description, context);
  const targetRatioValue = extractCommissionTargetRatio(description, context);
  const targetRole = extractCommissionRoleLabel(description, context) || '商机创建人';

  if (!targetUrl.trim() || !keyword || !targetRatioValue) return '';

  return `test('服务分佣配置：按关键词修改佣金比例并校验结果', async ({ page }) => {
  const TARGET_URL = ${JSON.stringify(targetUrl)};
  const SEARCH_KEYWORD = ${JSON.stringify(keyword)};
  const TARGET_ROLE = ${JSON.stringify(targetRole)};
  const TARGET_RATIO_VALUE = ${JSON.stringify(targetRatioValue)};

  test.skip(
    !process.env.E2E_USERNAME || !process.env.E2E_PASSWORD,
    '缺少 E2E_USERNAME / E2E_PASSWORD'
  );

  const normalizeRatio = (value) => String(value || '').replace(/\\s+/g, '').replace(/%$/, '');

  await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });
  await page.waitForURL(/#\\/commission\\/subCommissionConfig/, { timeout: 60000 });
  await expect(page.locator('#service-data-item_keyWord')).toBeVisible({ timeout: 30000 });
  const searchButton = page.getByRole('button', { name: /搜\\s*索/ }).first();
  await expect(searchButton).toBeVisible({ timeout: 15000 });

  const keywordInput = page.locator('#service-data-item_keyWord');
  const targetRow = page.locator('.ant-table .ant-table-tbody > tr').filter({ hasText: SEARCH_KEYWORD }).first();
  const searchErrorToast = page
    .locator('.ant-message-notice, .ant-notification-notice')
    .filter({ hasText: /服务开小差|稍后重试|服务异常/i })
    .last();

  async function waitForSearchOutcome() {
    await page.waitForTimeout(1200);
    if (await targetRow.isVisible().catch(() => false)) return 'row';
    if (await searchErrorToast.isVisible().catch(() => false)) return 'error';
    if (await page.locator('.ant-table-placeholder').first().isVisible().catch(() => false)) return 'empty';

    return await page
      .waitForFunction(
        (keyword) => {
          const rows = Array.from(document.querySelectorAll('.ant-table .ant-table-tbody > tr'));
          if (rows.some((row) => String(row.innerText || '').includes(keyword))) return 'row';

          const toastText = Array.from(document.querySelectorAll('.ant-message-notice, .ant-notification-notice'))
            .map((node) => String(node.textContent || ''))
            .join(' ');
          if (/服务开小差|稍后重试|服务异常/i.test(toastText)) return 'error';
          if (document.querySelector('.ant-table-placeholder')) return 'empty';
          return '';
        },
        SEARCH_KEYWORD,
        { timeout: 12000 }
      )
      .then((handle) => handle.jsonValue())
      .catch(() => '');
  }

  let searchOutcome = '';
  for (let searchAttempt = 1; searchAttempt <= 3; searchAttempt += 1) {
    await keywordInput.fill(SEARCH_KEYWORD);
    await searchButton.click();
    searchOutcome = String((await waitForSearchOutcome()) || '');
    if (searchOutcome === 'row') break;

    if (searchAttempt < 3 && (!searchOutcome || searchOutcome === 'error' || searchOutcome === 'empty')) {
      await page.waitForTimeout(1000 * searchAttempt);
      continue;
    }
  }

  if (!(await targetRow.isVisible().catch(() => false))) {
    if (searchOutcome === 'error') {
      throw new Error('搜索结果接口暂时异常，页面提示“服务开小差了，请稍后重试...”');
    }
    if (searchOutcome === 'empty') {
      throw new Error('关键词 ' + SEARCH_KEYWORD + ' 当前未返回任何服务数据');
    }
  }

  await expect(targetRow).toBeVisible({ timeout: 10000 });

  await __e2e.clickAntdRowAction(page, targetRow, '分佣配置');

  const modal = await __e2e.waitForVisibleAntdModal(page, {
    titleIncludes: '服务分佣配置',
    timeoutMs: 30000,
  });

  const roleRow = modal.locator('tr').filter({ hasText: TARGET_ROLE }).first();
  await expect(roleRow).toBeVisible({ timeout: 15000 });

  const ratioInput = roleRow.locator('input').first();
  await expect(ratioInput).toBeVisible({ timeout: 15000 });

  const beforeRatio = normalizeRatio(await ratioInput.inputValue());
  if (beforeRatio !== TARGET_RATIO_VALUE) {
    await ratioInput.click();
    await ratioInput.fill(TARGET_RATIO_VALUE);
    await ratioInput.press('Tab');

    const afterRatio = normalizeRatio(await ratioInput.inputValue());
    expect(afterRatio).toBe(TARGET_RATIO_VALUE);

    const saveButton = page.getByRole('button', { name: /保\\s*存/ }).last();
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    await saveButton.click();

    const successToast = page
      .locator('.ant-message-notice .ant-message-custom-content')
      .filter({ hasText: /保存成功|修改成功|success/i })
      .last();
    const saveOutcome = await Promise.any([
      successToast.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'toast'),
      expect(modal).toBeHidden({ timeout: 30000 }).then(() => 'closed'),
      page
        .waitForFunction(
          ({ role, targetValue }) => {
            const normalize = (value) => String(value || '').replace(/\\s+/g, '').replace(/%$/, '');
            const containers = Array.from(document.querySelectorAll('.ant-drawer-content, .ant-modal-content'));
            const visibleContainer = containers.find((node) => {
              if (!(node instanceof HTMLElement)) return false;
              const style = window.getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') !== 0 && rect.width > 0 && rect.height > 0;
            });
            if (!(visibleContainer instanceof HTMLElement)) return false;

            const rows = Array.from(visibleContainer.querySelectorAll('tr'));
            const targetRow = rows.find((row) => String(row.innerText || '').includes(role));
            if (!(targetRow instanceof HTMLElement)) return false;

            const input = targetRow.querySelector('input');
            return normalize(input?.value || '') === targetValue;
          },
          { role: TARGET_ROLE, targetValue: TARGET_RATIO_VALUE },
          { timeout: 20000 }
        )
        .then(() => 'retained'),
    ]).catch(() => '');

    if (!saveOutcome) {
      throw new Error('保存后未观察到成功提示、抽屉关闭或佣金值保留为目标值');
    }
  } else {
    expect(beforeRatio).toBe(TARGET_RATIO_VALUE);
  }
});`;
}

export function resolveDeterministicTemplate(
  snapshot: PageSnapshot,
  description: string,
  existingExample: string,
  context?: GenerateTestContext
): string {
  if (looksLikeBusinessBatchAddContactsTask(snapshot, description, context)) {
    return buildBusinessBatchAddContactsTemplate();
  }

  if (looksLikeServiceCommissionConfigTask(snapshot, description, context)) {
    return buildServiceCommissionConfigTemplate(snapshot, description, context);
  }

  if (!existingExample.trim()) return '';

  if (looksLikeBusinessCreateOrderTask(snapshot, description, context)) {
    return existingExample.trim();
  }

  return '';
}

function clampText(value: string, maxLength = 420): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function buildFieldDigestFromForms(
  forms: Array<{ fields: Array<{ label: string; placeholder: string; id: string; name: string; required: boolean }> }>
): string {
  const lines = forms
    .flatMap((form) => form.fields)
    .map((field) => {
      const parts = [
        field.label ? `label=${field.label}` : '',
        field.placeholder ? `placeholder=${field.placeholder}` : '',
        field.id ? `id=${field.id}` : '',
        field.name ? `name=${field.name}` : '',
        `required=${field.required ? 'yes' : 'no'}`,
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .filter(Boolean)
    .slice(0, 25);

  return lines.length > 0 ? lines.map((line) => `  - ${line}`).join('\n') : '  - 无';
}

function buildFieldDigest(snapshot: PageSnapshot): string {
  return buildFieldDigestFromForms(snapshot.forms);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeSingleQuotedJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildFrameLocatorHints(frame: NonNullable<PageSnapshot['frames']>[number]): { selectorCode: string; urlCode: string } {
  const selectorCode = frame.selectorHint?.trim()
    ? `page.frameLocator('${escapeSingleQuotedJs(frame.selectorHint.trim())}')`
    : '';

  let urlCode = '';
  try {
    const parsed = new URL(frame.url);
    const token = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
    if (token) {
      urlCode = `page.frames().find((item) => /${escapeRegExp(token)}/i.test(item.url()))`;
    }
  } catch {
    // ignore malformed frame urls
  }

  return { selectorCode, urlCode };
}

function buildFrameSection(snapshot: PageSnapshot): string {
  if (!snapshot.frames?.length) return '';

  return snapshot.frames
    .map((frame, index) => {
      const hints = buildFrameLocatorHints(frame);
      return `\n### Iframe ${index + 1}
- 名称: ${frame.name || '(anonymous)'}
- URL: ${frame.url}
- DOM id: ${frame.elementId || '(none)'}
- DOM name: ${frame.elementName || '(none)'}
- 定位建议: ${hints.selectorCode || '(none)'}
- URL 匹配建议: ${hints.urlCode || '(none)'}
- 字段摘要:
${buildFieldDigestFromForms(frame.forms)}
- 按钮（前20）: ${JSON.stringify((frame.buttons || []).slice(0, 20), null, 2)}
- 带 tooltip/aria-label 的元素（前20）: ${JSON.stringify((frame.tooltipElements || []).slice(0, 20), null, 2)}
- 标题层级: ${JSON.stringify(frame.headings || [], null, 2)}
- 链接(前20): ${JSON.stringify((frame.links || []).slice(0, 20), null, 2)}
- 正文摘录: ${clampText(frame.bodyTextExcerpt || '', 800)}`;
    })
    .join('\n');
}

function buildSnapshotSection(title: string, snapshot: PageSnapshot): string {
  return `\n## ${title}
- URL: ${snapshot.url}
- 标题: ${snapshot.title}
- 字段摘要:
${buildFieldDigest(snapshot)}
- 表单: ${JSON.stringify(snapshot.forms, null, 2)}
- 按钮（含图标按钮）: ${JSON.stringify(snapshot.buttons, null, 2)}
- 带 tooltip/aria-label 的元素（注意：有些按钮是纯图标，文字在 title 或 aria-label 中）: ${JSON.stringify(snapshot.tooltipElements || [], null, 2)}
- 标题层级: ${JSON.stringify(snapshot.headings)}
- 链接(前20): ${JSON.stringify(snapshot.links)}
- 页面正文摘录: ${clampText(snapshot.bodyTextExcerpt || '', 800)}
${buildFrameSection(snapshot)}

注意：
1. 图标按钮（isIconOnly=true）没有可见文字，应使用 title/aria-label 来定位：
   - page.getByTitle('提示文字')
   - page.getByLabel('aria标签')
   - page.locator('[title="提示文字"]')
2. 带 [hover-tooltip] 标记的元素是鼠标悬停才出现 tooltip 的按钮（如 Ant Design Tooltip），
   这类按钮不能用 getByText 找，应通过 CSS 类名或位置定位，然后 hover 触发 tooltip：
   - 先用 page.locator('.类名') 定位按钮
   - 再用 await btn.hover() 触发 tooltip
   - 然后用 page.locator('.ant-tooltip-inner') 或 page.getByRole('tooltip') 验证 tooltip 内容
3. 如果字段摘要 / 表单 JSON 里已经给出了精确的 label、placeholder、id，必须优先使用这些原始文案或属性，不要自行改写成近义词。
4. 如果快照里包含 Iframe 摘要，说明真实控件可能不在顶层页面；必须先切换到对应 frame，再在 frame 内找 placeholder、按钮和结果列表。
5. 如果 Iframe 摘要已经给出了“定位建议”或 DOM id，优先使用这些精确 selector；不要凭空假设 iframe 的 name 属性。`;
}

export function buildPrompt(
  snapshot: PageSnapshot,
  description: string,
  auth: AuthConfig | undefined,
  edgeCases: any[],
  existingExample: string,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext
): string {
  const parts: string[] = [];
  const resolvedPlanning = planning || resolveIntentPromptPlanningContext(snapshot, description, context);

  parts.push('你是一个 Playwright E2E 测试专家。请根据以下信息生成完整可执行的 Playwright 测试代码。');

  parts.push(buildSnapshotSection(context?.taskMode === 'scenario' ? '业务流入口页面信息' : '目标页面信息', snapshot));

  parts.push(`\n## 列表页与批量操作规则
1. 对列表页，非必要不要点击“全部清除”“重置”等会重载筛选状态的按钮；先观察页面是否已经有可用数据。
2. 如果任务描述要求批量操作，优先考虑“勾选行 + 顶部批量按钮”的真实入口，不要臆造不存在的行内按钮。
3. 从列表行提取关键主键时，优先使用明确的链接文本、编号列或字段标签，不要用宽泛正则从整行文本中猜测，以免误取手机号、企业 ID 或金额。
4. 如果目标行没有可见的“查看 / 编辑 / 生成订单”按钮，而是只有末列三点菜单或 \`.ant-dropdown-trigger\` 图标，必须先打开该行操作菜单，再在当前可见 menu 内点击目标动作。
5. 对 Ant Design 表格，禁止先写 \`expect(page.locator('.ant-table-tbody')).toBeVisible()\` 这类表体可见性断言；固定列、粘性列和克隆节点会让 \`.ant-table-tbody\` 同时命中多个元素。应直接等待目标行、表格请求完成，或等待 \`.ant-table-placeholder\` / 行数变化。`);

  parts.push(`\n## 下拉与重复文案规则
1. 遇到 Ant Design Select / Cascader / TreeSelect / 弹层枚举项时，必须先定位到当前可见的弹层容器，再在容器内选择选项，例如：
   - const dropdown = page.locator('.ant-select-dropdown:visible').last();
   - 普通 Select 可写 await dropdown.getByText('抖音', { exact: true }).first().click();
   - TreeSelect / 树节点枚举优先写 await dropdown.locator('.ant-select-tree-node-content-wrapper[title="抖音"]').first().click();
2. 禁止在打开下拉后直接写 page.getByText('抖音', { exact: true }).click()、page.getByText('男', { exact: true }).click() 这类全局文本点击。
3. 如果下拉实际是 TreeSelect / 树形枚举，不要只靠 getByText('枚举值')；优先使用 title 属性、tree node wrapper 或树节点 class 做精确定位。对下拉容器优先使用 \`.ant-select-dropdown:visible\`，不要依赖 \`.ant-select-dropdown-hidden\` 这类 class 判断动画中的可见性。
4. 对长列表/树形下拉，选项可能已经在 DOM 中但初始不在当前滚动可视区，尤其是在 1280x720 视口下。不要一打开下拉就直接 expect(option).toBeVisible()；应优先：
   - 先找 dropdown 内的搜索框：const searchInput = dropdown.locator('input.ant-select-search__field').first();
   - 如果搜索框可见，先 fill('枚举值') 缩小范围；
   - 对目标 option 先执行 await option.scrollIntoViewIfNeeded(); 再 click。
5. 如果第一次点击 select wrapper 后没有出现可见 dropdown，不要重复等待同一个 hidden dropdown；应在当前 form-item 内依次尝试 \`.ant-select-selection\`、\`.ant-select-selector\`、\`.ant-select\`、\`[role="combobox"]\`，每次点击后短暂等待并重新查询 \`.ant-select-dropdown:visible\`。
6. 对“抖音”“男”“确定”“保存并继续”“提交”“疑难工商注销”这类高重复文案，必须先缩小到字段所在 form-item、当前 modal、当前 row 或当前可见 dropdown；如仍重复，明确写 .first() 或 .last() 消歧。
7. 表格断言和操作必须先定位到目标行，再在该行内断言或点击，禁止对整页同名文本做全局断言。`);

  parts.push(`\n## 运行时内置 Helper
执行环境已内置 \`__e2e\`，处理 Ant Design 下拉时优先直接复用，不要手写脆弱的 click + waitForTimeout + dropdown 查询：
1. 查找当前真正可见的下拉：
   - const dropdown = await __e2e.findVisibleAntdDropdown(page);
2. 在字段所在 form-item / row 内稳妥打开下拉：
   - const dropdown = await __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 });
3. 直接选择普通 Select / TreeSelect 选项：
   - await __e2e.selectAntdOption(page, sourceRow, { label: '抖音', tree: true });
   - await __e2e.selectAntdOption(page, companyRow, { label: '中铁上海工程局集团有限公司(91310000566528939E)', searchText: '中铁上海工程局集团有限公司' });
4. 如果是长列表 / 树形枚举，优先通过 \`searchText\` 缩小范围，再由 helper 负责 scrollIntoViewIfNeeded() 和点击。
5. 对“企业名称”这类远程搜索 Select，点击 wrapper 后不一定立刻出现候选；必须传 \`searchText\`，helper 会先聚焦字段并输入关键词，再等待候选返回。
6. 对列表行末尾只有三点菜单 / \`.ant-dropdown-trigger\` 的场景，优先直接写：
   - await __e2e.clickAntdRowAction(page, targetRow, '生成订单');
   - await __e2e.clickAntdRowAction(page, targetRow, '查看');
7. 只要场景是 Ant Design 下拉或 Ant Design 行操作菜单，默认先考虑 \`__e2e.openAntdDropdown\` / \`__e2e.selectAntdOption\` / \`__e2e.clickAntdRowAction\`，除非页面控件明显不是该类组件。`);
  parts.push(`8. 对标题会拼接实体名称的 Ant Design 弹框，优先直接写：
   - const modal = await \`__e2e.waitForVisibleAntdModal(page, { titleIncludes: '服务分佣配置' })\`;
   - 然后在 \`modal\` 内断言标题后缀、表单行和保存按钮；不要对完整标题做精确匹配。`);

  if (looksLikeBusinessCreateOrderTask(snapshot, description, context)) {
    parts.push(`\n## 商机转订单规则
1. 商机列表里的“生成订单”通常收在目标行末列三点菜单里，不要假设行内有固定的“查看 / 详情 / 生成订单”按钮；优先直接用 \`await __e2e.clickAntdRowAction(page, targetRow, '生成订单')\`。
2. 点击“生成订单”后，当前 UAT 会打开“确定订单信息”Drawer，而不是简单 confirm 弹窗。必须先等待 Drawer 可见，再在 Drawer 内点击“确定”。
3. 点击 Drawer 内“确定”后，优先等待 \`POST /crmapi/business/createOrder\` 成功响应，并校验响应成功；不要只靠页面上模糊的“成功”文案。
4. 生成订单成功后，原手机号对应的商机记录可能立即从当前商机列表移除或不再提供“查看”动作。除非需求明确要求继续打开详情，否则不要再强行查找同一行并点击“查看”。
5. 如果需求只是“创建商机并生成订单”，以“createOrder 响应成功 + Drawer 关闭 + 关键清理信息已记录”作为主要成功判定即可；可附加校验“签约成功(n)”计数不下降，但不要把“原商机行仍可见”作为硬前提。`);
  }

  parts.push(`\n## 媒体播放 / 预览 / 下载 / 打开详情成功判定规则
1. 对“播放录音 / 预览图片或视频 / 打开详情 Drawer / 下载文件”等触发型动作，禁止只写宽泛的 \`expect(...).toBeTruthy()\`、\`page.getByText(/成功/i)\`，也禁止写 \`Promise.race([waitFor(...).catch(() => false), ...])\` 这种会被较早 \`false\` 抢跑的成功判定。
2. 如果动作会触发明确请求或返回业务数据，优先等待对应接口成功并校验关键字段，例如响应里的 \`code=1\`、媒体 URL、下载地址、详情数据已返回。
3. 如果页面会出现播放器 / 预览容器 / Drawer / 新窗口，优先断言具体容器、\`audio[src]\` / \`video[src]\` / Drawer 标题 / 同一行按钮状态变化；不要跨整页找模糊 icon 或泛化文本。
4. 当存在多个候选成功信号时，改用“按顺序检查多个信号”或 \`Promise.any(...)\`（失败分支保持 reject）；不要让任一分支的 \`catch(() => false)\` 提前把整体误判为失败。
5. 如果接口已成功返回媒体 URL、详情数据或下载 token，即使页面上的播放 icon 没立即切换，也应把“业务响应成功 + 关键资源已返回”作为主要成功判定，再补一个轻量 UI 佐证。`);

  parts.push(`\n## Iframe / 嵌入页规则
1. 如果页面快照或 Iframe 摘要里出现了真实业务控件，必须优先使用 frameLocator 或 frame 对象进入对应 iframe，例如：
   - const frame = page.frameLocator('#easyindexIframe');
   - const liveFrame = page.frames().find((item) => /easySearchList/i.test(item.url()));
2. 如果 Iframe 摘要里提供了 DOM id / 定位建议，必须优先使用该 selector；只有当 selector 失效时，才回退到按 frame URL 匹配。
3. 当 route 已经进入容器页但 iframe 内控件还没 ready 时，先等待 iframe DOM 出现，再等待 frame URL 或 frame 内 placeholder 可见，不要直接对错误的 name selector 做长时间等待。
4. 禁止在顶层 page 上直接查找 iframe 内的 placeholder、按钮、列表结果；先判断控件属于主页面还是 iframe。
5. 如果主页面 route 只是容器页，且真实输入框只存在于 iframe 中，应在 iframe 内完成输入、点击和断言，不要退回主页面做宽泛 getByText 猜测。`);

  if (context?.taskMode === 'scenario') {
    parts.push(`\n## 业务流上下文
- 任务模式: 业务流任务
- 入口 URL: ${context.scenarioEntryUrl || snapshot.url}
- 共享变量: ${context.sharedVariables?.join(', ') || '无'}
- 期望业务结果: ${context.expectedOutcome || '未提供'}
- 收尾说明: ${context.cleanupNotes || '未提供'}

步骤摘要：
${context.scenarioSummary || '未提供'}

生成要求：
1. 不要只停留在入口页，要覆盖完整业务链路。
2. 需要在步骤之间传递和复用共享变量。
3. 对接口步骤、断言步骤、收尾步骤生成显式代码，不要省略。
4. 步骤说明里的字段名、placeholder、按钮文案、枚举值、企业名称、产品名如果已经给出，必须原样使用，不要擅自改成近义词或测试数据。
5. 如果快照里已经暴露字段 id / label / placeholder，应优先使用这些精确信息；例如存在“请输入商机联系人”时，不要退化成“请输入联系人”。
6. 如果分析到的页面仍然是登录页或与业务步骤不匹配，应显式报错或跳过，禁止基于错误页面猜测业务 locator。`);
    parts.push(`7. 除非 cleanupNotes 明确要求回滚，否则不要在脚本尾部自动把刚修改成功的业务数据改回原值；意图任务默认以完成目标业务动作为主。`);
  }

  parts.push(buildProjectKnowledgeSection(resolvedPlanning));
  parts.push(buildActionDslSection(resolvedPlanning));
  parts.push(buildActionLibrarySection(snapshot, auth, resolvedPlanning));

  if (context?.relatedSnapshots?.length) {
    parts.push(
      `\n## 关联页面快照\n${context.relatedSnapshots
        .map((item, index) => buildSnapshotSection(`关联页面 ${index + 1}`, item))
        .join('\n')}`
    );
  }

  parts.push(`\n## 用户需求\n${description}`);

  if (auth?.loginUrl) {
    const preferredTargetUrl = context?.scenarioEntryUrl || snapshot.url;
    parts.push(`\n## 登录信息
- 登录页: ${auth.loginUrl}
- 用户名通过 process.env.E2E_USERNAME 获取
- 密码通过 process.env.E2E_PASSWORD 获取
- 登录方式说明: ${auth.loginDescription || '未提供，请优先选择可自动化的密码登录方式'}
- 执行环境内置 helper: \`__e2e.ensureLoggedIn(page, { targetUrl })\`、\`__e2e.loginWithEnvAuth(page)\`

推荐骨架：
\`\`\`javascript
const TARGET_URL = '${preferredTargetUrl}';
test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');
await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });
\`\`\`

要求：
1. 优先复用 \`__e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })\` 完成登录，不要手写一大段 \`page.goto(LOGIN_URL)\` + locator 登录流程。
2. 只有当前任务本身就是登录页，或你已经明确判断当前页就是登录页时，才直接调用 \`__e2e.loginWithEnvAuth(page)\`。
3. 如果业务页已经自动重定向到真实登录页，禁止再额外 \`page.goto(LOGIN_URL)\`；很多站点把根地址当首页壳，重复跳转会把你从真实登录页带走。
4. 先根据“登录方式说明”判断应该切换到哪个登录 tab（如扫码登录 / 密码登录 / 短信登录）。
5. 如果说明明确为扫码等无法自动化方式，或者缺少自动化凭证，请使用 \`test.skip\` 明确说明原因，禁止假通过。
6. 登录成功判定不要过拟合固定路由；像 "#/" 这类根主页也算登录成功，成功后可继续跳转到目标业务页。
7. 遇到 Ant Design 表格的选择框时，优先点击可见的 checkbox wrapper / label，不要优先操作隐藏的 input。`);
  }

  if (edgeCases.length > 0) {
    parts.push(
      `\n## 历史失败/边缘案例（请特别关注）\n${edgeCases
        .map((c) => `- [${c.id}] ${c.title}: 输入=${JSON.stringify(c.input)}, 预期=${c.expected}`)
        .join('\n')}`
    );
  }

  if (existingExample) {
    parts.push(`\n## 参考：现有项目中的真实测试代码（请参考其风格和模式）\n\`\`\`typescript\n${existingExample}\n\`\`\``);
  }

  parts.push(`\n## 输出要求（严格遵守）
1. 只输出纯 JavaScript 代码（禁止 TypeScript 语法），用 \`\`\`javascript 包裹
2. 不要写任何 import 语句（test、expect、page、context、browser 已由运行环境提供）
3. 直接调用 test('描述', async ({ page }) => { ... }) 注册测试用例
4. 禁止使用 TypeScript 语法：不要类型注解、不要 as 断言、不要 ! 非空断言、不要 interface/type 声明
5. 不要调用 test.setTimeout()（执行环境已设置充足超时时间）
6. 定位器优先级: getByRole > getByPlaceholder > getByText > getByTestId > CSS
7. 中英文双语兼容定位（用正则如 /登录|Login/i）
8. 包含明确的 expect 断言
9. 包含合理的 timeout 和 waitFor
10. 如需登录，从 process.env 读取凭证，不硬编码
11. 若页面分析结果里存在精确 placeholder / label / id，优先使用精确定位，避免宽泛正则造成误匹配
12. 遇到 Ant Design 下拉、弹层、枚举值选择时，必须先作用域到当前可见容器，禁止直接 page.getByText('枚举值').click()
13. 如果页面控件实际是 TreeSelect / 树形下拉，优先使用 [title="枚举值"] 或 .ant-select-tree-node-content-wrapper[title="枚举值"]，不要只靠 getByText('枚举值')
14. 对长 TreeSelect / 长下拉，不要一打开就对目标 option 做 toBeVisible 断言；如果 dropdown 内存在 input.ant-select-search__field，先输入枚举值，再对目标 option 调用 scrollIntoViewIfNeeded() 后点击
15. 当“抖音”“男”“保存并继续”“确定”等文案可能重复时，必须用 form-item / modal / row / visible dropdown 收窄，并用 .first() / .last() 明确消歧
16. 如果快照暴露了 iframe DOM id / 定位建议 / frame URL，优先使用这些精确线索进入 iframe；不要臆造 iframe[name="..."]。
17. 修复 iframe 场景时，优先写 “等待 iframe selector 出现 -> 按 selector 或 frame URL 进入 frame -> 等待 frame 内 placeholder/按钮可见” 这类顺序，不要直接在顶层 page 上重试同一个 placeholder
18. 只要步骤涉及 Ant Design 下拉，优先复用执行环境内置的 \`__e2e.openAntdDropdown\` / \`__e2e.selectAntdOption\`，不要再自行拼装脆弱 helper
19. 如果列表目标动作收在行尾三点菜单 / \`.ant-dropdown-trigger\` 里，优先复用执行环境内置的 \`__e2e.clickAntdRowAction(page, targetRow, '动作名')\`，不要臆造行内可见按钮
20. 禁止写 \`page.getByText(/成功/i).first()\` 这类宽泛成功断言；应优先等待具体 toast/弹窗标题、目标 Drawer/Modal 消失、接口响应成功或业务状态字段发生变化
21. 对播放录音 / 预览媒体 / 打开详情 / 下载文件这类触发型动作，优先等待业务响应成功、资源 URL 返回或对应容器出现；禁止使用 \`Promise.race([...catch(() => false)])\` 这类会把较早失败误判成整体失败的写法
22. 有统一登录信息时，优先使用执行环境内置的 \`__e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })\` 或 \`__e2e.loginWithEnvAuth(page)\`；不要重复手写 \`page.goto(LOGIN_URL)\` 并猜登录页 DOM
23. 如果当前页已经是登录页，禁止再额外跳一次 \`LOGIN_URL\` 根地址；那可能把页面从真实登录页跳回首页壳，导致后续手机号/验证码输入框全部消失
24. 对 Ant Design 表格，禁止直接断言裸 \`.ant-table-tbody\` 可见；优先等待目标行、行数或 placeholder，并基于目标行继续操作
25. 对标题会附带业务实体名称的 Modal / Drawer，禁止精确断言整个标题字符串；应在当前可见容器内断言公共后缀文案，必要时直接使用 \`__e2e.waitForVisibleAntdModal(page, { titleIncludes: '公共标题片段' })\`
26. 除非任务描述或 cleanupNotes 明确要求恢复现场，否则不要在脚本尾部自动把刚修改的业务数据改回去`);

  return parts.join('\n');
}

function extractDropdownOptionLabelFromError(errorText: string): string {
  const titleMatch = errorText.match(/title=["']([^"']+)["']/);
  if (titleMatch?.[1]) return titleMatch[1].trim();

  const hasTextMatch = errorText.match(/hasText:\s*\/\^([^$\/]+)\$\//);
  if (hasTextMatch?.[1]) return hasTextMatch[1].trim();

  return '';
}

export function buildRepairPrompt(
  snapshot: PageSnapshot,
  description: string,
  auth: AuthConfig | undefined,
  edgeCases: any[],
  existingExample: string,
  repair: RepairTestContext,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext
): string {
  const parts = [buildPrompt(snapshot, description, auth, edgeCases, existingExample, context, planning)];
  const recentEvents = (repair.recentEvents || []).map((item) => `- ${clampText(item, 220)}`).join('\n');
  const recentEventText = (repair.recentEvents || []).join('\n');
  const diagnosisHints: string[] = [];
  const dropdownOptionLabel = extractDropdownOptionLabelFromError(repair.executionError);

  if (/iframe\[name=/i.test(repair.executionError) && snapshot.frames?.some((item) => item.elementId || item.selectorHint)) {
    diagnosisHints.push('当前失败脚本错误地依赖了 iframe[name=...]；如果快照提供了 DOM id 或定位建议，必须改用更稳定的 selector。');
  }
  if (/getByPlaceholder/i.test(repair.executionError) && snapshot.frames?.length) {
    diagnosisHints.push('报错发生在 placeholder 可见性等待阶段，优先修正为“等待 iframe 就绪后，再在 frame 内等待输入框”。');
  }
  if (
    /getByPlaceholder\(/.test(repair.executionError) &&
    /手机号|手机号码|用户名|账号/.test(repair.executionError) &&
    /page\.goto\((?:process\.env\.E2E_LOGIN_URL|LOGIN_URL)/.test(repair.previousCode)
  ) {
    diagnosisHints.push('这次失败很可能不是凭证缺失，而是脚本已经从业务页自动跳到真实登录页后，又额外 `page.goto(LOGIN_URL)` 把自己带回了根首页壳。修复时优先改成 `await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })`；如果当前页已经是登录页，就直接 `await __e2e.loginWithEnvAuth(page)`，不要再手写二次跳转。');
  }
  if (/ant-select-dropdown:not\(\.ant-select-dropdown-hidden\)/.test(repair.executionError) && /Received:\s+hidden|unexpected value "hidden"/i.test(repair.executionError)) {
    diagnosisHints.push('当前页面的下拉弹层在动画阶段可能没有 `.ant-select-dropdown-hidden` class，但实际仍是隐藏态。不要再用 `.ant-select-dropdown:not(.ant-select-dropdown-hidden)` 作为唯一可见性判断；改用 `.ant-select-dropdown:visible`，或在多个 dropdown 中显式挑选 isVisible() === true 的那个。');
  }
  if (/locator\('\.ant-select-dropdown:visible'\)\.last\(\)/.test(repair.executionError) && /element\(s\) not found|Expected:\s+visible/i.test(repair.executionError)) {
    diagnosisHints.push(`这次不是“选项不对”，而是点击 select wrapper 后根本没有成功打开下拉。不要再手写一套脆弱的 helper；直接改用执行环境内置的 \`__e2e.openAntdDropdown(page, sourceRow)\`，它会自动尝试 click、ArrowDown、mousedown 和鼠标坐标点击等多种打开方式，并把调试日志写入执行事件。`);
  }
  if (/locator\('tbody tr'\).*getByRole\('button'/i.test(repair.executionError) && /详情\|查看|生成订单/.test(repair.executionError)) {
    diagnosisHints.push('目标列表行可能没有内联 button/link，而是把“查看 / 生成订单”等操作收在末列三点菜单里。修复时先定位目标行，再优先改用 `await __e2e.clickAntdRowAction(page, targetRow, \'生成订单\')` 或 `await __e2e.clickAntdRowAction(page, targetRow, \'查看\')`，不要继续假设行内存在可见 button。');
  }
  if (
    /未找到行操作：/.test(repair.executionError) ||
    (/getByText\('操作'/.test(repair.executionError) && /ant-table/i.test(repair.executionError)) ||
    (/ant-table-wrapper/.test(repair.executionError) && /unexpected value "hidden"|Received:\s+hidden/i.test(repair.executionError))
  ) {
    diagnosisHints.push('这是 Ant Design 表格固定列/隐藏克隆节点的典型误判。修复时不要再新增 `getByText(\'操作\')`、`.ant-table-thead` 或表头可见性断言；“操作”列在 DOM 里经常同时存在多个隐藏副本。应直接基于目标行调用 `await __e2e.clickAntdRowAction(page, targetRow, \'动作名\')`，或在同 `data-row-key` 的可见克隆行内点击真实可见的动作链接。');
  }
  if (/locator\('\.ant-table-tbody'\)/.test(repair.executionError) && /strict mode violation|resolved to \d+ elements/i.test(repair.executionError)) {
    diagnosisHints.push('当前失败不是“列表没渲染出来”，而是你对裸 `.ant-table-tbody` 做了可见性断言，命中了 Ant Design 固定列生成的多个表体副本。修复时不要再写 `expect(page.locator(\'.ant-table-tbody\')).toBeVisible()`；改成直接等待目标行出现、等待表格请求完成，或等待 `.ant-table-placeholder` / 行数变化。');
  }
  if (
    /ant-modal-content|ant-modal:visible|ant-modal-wrap:visible/.test(repair.executionError) &&
    /服务分佣配置/.test(repair.executionError) &&
    /element\(s\) not found|Expected:\s+visible/i.test(repair.executionError)
  ) {
    diagnosisHints.push('这类弹框标题通常是“业务实体名 + 服务分佣配置”，例如 `“商务礼仪培训”服务分佣配置`；不要再对 `.ant-modal-content` 或完整标题做精确匹配。修复时优先改成 `const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: \'服务分佣配置\' })`，然后只断言公共标题片段、佣金行和保存按钮。');
  }
  if (
    /Cleanup:|restoreValue|originalRatio|改回原值|rowAfterSave|modalAgain/.test(repair.previousCode) &&
    /(修改|改为|设置为|填写为|保存)/.test(description) &&
    !/(恢复|回滚|改回|cleanup|清理)/i.test(`${description}\n${context?.cleanupNotes || ''}`)
  ) {
    diagnosisHints.push('当前需求没有要求回滚数据，脚本尾部自动“改回原值”只会增加额外失败面，还可能把已经完成的业务动作撤销。修复时删除自动恢复原值的 cleanup，只保留完成目标动作后的结果校验。');
  }
  if (/getByRole\('button', \{ name: \/搜\\s\*索\/ \}\)/.test(repair.executionError) && /sureOrderInfoDrawer|暂无信息|ant-spin-spinning/.test(repair.executionError)) {
    diagnosisHints.push('当前不是“搜索按钮定位失败”，而是“确定订单信息”Drawer/加载遮罩仍未关闭，说明前面的成功断言误判了。不要再写 `page.getByText(/成功/i).first()`；点击 Drawer 内“确定”后，优先等待 `crmapi/business/createOrder` 响应成功，并显式等待“确定订单信息”Drawer 消失，再继续回到列表或做后续校验。');
  }
  if (/locator\('tbody tr'\)\.filter\(\{ hasText:/.test(repair.executionError) && /createOrder|data-createOrder|生成订单/.test(`${repair.previousCode}\n${recentEventText}`)) {
    diagnosisHints.push('这次不是“生成订单失败”，而是生成订单成功后，原手机号对应的商机可能立即从当前商机列表移除。不要再强行 `expect(targetRow).toBeVisible()`；优先在下单前后比较“签约成功(n)”计数是否增加，或改到订单管理页检索并校验新订单。');
  }
  if (
    /business\/businesslist/.test(`${snapshot.url}\n${repair.previousCode}`) &&
    /!txt\.includes\(contactPhone\)/.test(repair.previousCode) &&
    /expect\(received\)\.(?:toBeTruthy|not\.toBe\(expected\))/i.test(repair.executionError)
  ) {
    diagnosisHints.push('商机列表的“企业名称 / 联系人名称 / 联系电话”经常共用同一个复合单元格。不要因为该单元格包含手机号就整格排除，否则会把联系人名称一起丢掉；应先定位命中手机号的单元格，再按换行拆分出 companyName、contactName、contactPhone。');
  }
  if (
    /expect\(received\)\.(?:toBeTruthy|not\.toBe\(expected\))/i.test(repair.executionError) &&
    /business\/businesslist|contactPhone|contactName|businessId/.test(`${snapshot.url}\n${repair.previousCode}`)
  ) {
    diagnosisHints.push('这次失败不是“断言写法太严格”，而是联系人 / 手机号 / businessId 这些目标字段没有被稳定取到。不要继续把断言弱化成 `toBeTruthy()`、`not.toBe(\'\')` 或“任意非空单元格”；必须先定位到真实目标商机，再对明确字段做校验。若列表行文案会被省略、脱敏或异步补齐，优先改为用接口返回的 businessId 精确定位目标行，或打开该行“查看 / 详情”抽屉后再断言联系人、手机号和创建时间。');
  }
  if (
    /expect\(received\)\.(?:toBeTruthy|not\.toBe\(expected\))/i.test(repair.executionError) &&
    /录音|播放|audio|audioUrl|\.wav|aplayer|pause/i.test(`${description}\n${repair.previousCode}\n${recentEventText}`)
  ) {
    diagnosisHints.push('这次失败很可能不是“播放没触发”，而是成功判定写错了。最近事件里一旦已经出现 `audioUrl`、`.wav`、`code: 1` / `msg: success` 这类信号，就应优先把“接口成功 + 媒体 URL 返回 + 播放器或同行按钮状态变化”作为成功依据，不要继续写 `expect(triggered).toBeTruthy()` 这类宽泛真值断言。');
  }
  if (
    /Promise\.race\(/.test(repair.previousCode) &&
    /catch\(\(\)\s*=>\s*false\)/.test(repair.previousCode) &&
    /expect\(received\)\.(?:toBeTruthy|not\.toBe\(expected\))/i.test(repair.executionError)
  ) {
    diagnosisHints.push('当前脚本把多个候选成功信号写成了 `Promise.race([...catch(() => false)])`；只要有一个分支更早返回 `false`，整体就会被误判失败。修复时改为按顺序检查各成功信号，或使用保持 reject 的 `Promise.any(...)`，不要让单个失败分支提前产出 `false`。');
  }
  if (/audioUrl|\.wav|录音|播放/.test(recentEventText) && /code:\s*1|msg:\s*success/.test(recentEventText)) {
    diagnosisHints.push('最近执行事件已经出现录音资源 URL 或成功响应，说明点击后的业务链路大概率已经跑通。修复时只收敛修改当前播放成功的断言，不要改登录流、不要跳去无关页面，也不要发明需求里没有的页面锚点或 DOM id。');
  }
  if (
    /Cannot read properties of null \(reading 'id'\)/.test(recentEventText) &&
    /business\/businesslist|sourceSearch|infoForJson-创建人/.test(`${snapshot.url}\n${repair.previousCode}\n${recentEventText}`)
  ) {
    diagnosisHints.push('最近事件显示商机列表检索后页面自身抛出了 `Cannot read properties of null (reading \'id\')`，说明当前不是单纯 locator 问题，而是列表筛选 / 初始化尚未稳定就开始读取结果。修复时不要在搜索框一可见就立刻点“搜索”并读表格；先等待列表页筛选区和默认数据加载完成，再触发检索，并显式等待表格请求完成、loading 消失、目标结果稳定后再断言。必要时先从检索响应里提取目标 businessId，再用 businessId + 详情抽屉完成字段校验。');
  }
  if (/未找到行操作：查看/.test(repair.executionError) && /createOrder|data-createOrder|生成订单/.test(`${repair.previousCode}\n${recentEventText}`)) {
    diagnosisHints.push('“查看”这一步不是当前需求的核心成功条件。既然 `createOrder` 已成功，说明订单已创建；修复时应删除“必须重新找到该商机并点查看”的假设，改成在 `createOrder` 成功、Drawer 关闭后直接完成断言，或最多只校验“签约成功(n)”计数变化。');
  }
  if (/未能打开当前字段的下拉面板/.test(repair.executionError)) {
    diagnosisHints.push('某些 Ant Design 远程搜索 Select（例如企业名称）在点击 wrapper 后不会立刻出现候选。修复时继续使用 `__e2e.selectAntdOption(...)`，并显式传入稳定的 `searchText` 关键词，让 helper 先聚焦并键入，再等待候选返回，不要退回手写 click + waitForTimeout。');
  }
  if (/ant-select-(tree-node-content-wrapper|dropdown-menu-item|item-option-content)/i.test(repair.executionError) && /toBeVisible\(\) failed|waiting for locator|Timeout \d+ms exceeded/i.test(repair.executionError)) {
    diagnosisHints.push(
      `这次失败不是“下拉容器不存在”，而是目标枚举值${dropdownOptionLabel ? `「${dropdownOptionLabel}」` : ''}在 TreeSelect/下拉滚动区里初始不在可见范围。不要一打开下拉就 expect(option).toBeVisible()；优先直接改成 \`await __e2e.selectAntdOption(page, sourceRow, { label: '${dropdownOptionLabel || '目标枚举值'}', tree: true })\`，或至少在 dropdown 内先搜索再 scrollIntoViewIfNeeded()。`
    );
  }

  parts.push(`\n## 当前失败脚本\n\`\`\`javascript\n${repair.previousCode.trim()}\n\`\`\``);
  parts.push(`\n## 本次执行报错\n${repair.executionError.trim() || '未提供错误信息'}`);
  if (recentEvents) {
    parts.push(`\n## 最近执行事件\n${recentEvents}`);
  }
  if (diagnosisHints.length > 0) {
    parts.push(`\n## 修复诊断提示\n${diagnosisHints.map((item, index) => `${index + 1}. ${item}`).join('\n')}`);
  }
  if (repair.repairMemoryHints?.length) {
    parts.push(`\n${renderIntentRepairMemoryHints(repair.repairMemoryHints)}`);
  }
  parts.push(`\n## 修复要求
1. 保持测试目标、步骤覆盖和关键断言不变，不要为了通过而删掉业务步骤。
2. 优先修复 locator、iframe 进入方式、等待顺序、下拉选择和结果断言，不要扩大成无关重写。
3. 如果快照、Iframe 摘要、现有范例已经给出更稳定的 id / class / selector / frame URL，必须直接使用。
4. 输出完整替换后的 JavaScript 测试代码，不要解释原因。
5. 修复后的代码必须继续遵守上面的“执行动作约束 DSL”；若要调整实现路径，只能在同一步骤语义内收敛修改。`);

  return parts.join('\n');
}

function createAbortError(message = '当前自动测试已取消'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal, message?: string): void {
  if (!signal?.aborted) return;
  throw createAbortError(message || '当前自动测试已取消');
}

function extractGeneratedCode(fullCode: string): string {
  const match = fullCode.match(/```(?:javascript|typescript|js|ts)?\n([\s\S]*?)```/);
  const code = match ? match[1].trim() : fullCode.trim();

  if (!code.includes('test(') && !code.includes('test.describe(')) {
    throw new Error('生成的代码缺少 test() 或 test.describe()，请重试');
  }

  return code;
}

async function* streamCodeGeneration(
  prompt: string,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): AsyncGenerator<GenerateEvent> {
  let fullCode = '';
  throwIfAborted(signal);
  try {
    for await (const chunk of callLLMStream(prompt, undefined, runtimeOverrides, signal)) {
      fullCode += chunk.content;
      yield { type: 'code', content: chunk.content };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    yield { type: 'error', content: `LLM 调用失败: ${err.message}` };
    return;
  }

  try {
    yield { type: 'complete', content: extractGeneratedCode(fullCode) };
  } catch (err: any) {
    yield { type: 'error', content: err.message || '生成代码解析失败' };
  }
}

export async function* generateTest(
  snapshot: PageSnapshot,
  description: string,
  auth?: AuthConfig,
  context?: GenerateTestContext,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal,
  planning?: ResolvedPromptPlanningContext
): AsyncGenerator<GenerateEvent> {
  throwIfAborted(signal);
  yield { type: 'thinking', content: '正在加载历史边缘案例...' };
  const edgeCases = await loadEdgeCases(context?.scenarioEntryUrl || snapshot.url);
  yield { type: 'thinking', content: `找到 ${edgeCases.length} 个相关边缘案例` };

  yield { type: 'thinking', content: '正在加载现有测试范例...' };
  const existingExample = await loadExistingExample(snapshot, description, context);
  const deterministicTemplate = resolveDeterministicTemplate(snapshot, description, existingExample, context);
  if (deterministicTemplate) {
    yield { type: 'thinking', content: '命中已验证的专门模板，直接复用稳定脚本...' };
    yield { type: 'complete', content: deterministicTemplate };
    return;
  }

  yield { type: 'thinking', content: '正在匹配项目知识规则...' };
  const resolvedPlanning = planning || resolveIntentPromptPlanningContext(snapshot, description, context);
  yield {
    type: 'thinking',
    content: formatPlanningKnowledgeHitMessage('', resolvedPlanning).trim(),
  };

  yield { type: 'thinking', content: '正在构造 Prompt 并调用 LLM...' };
  const prompt = buildPrompt(snapshot, description, auth, edgeCases, existingExample, context, resolvedPlanning);
  yield* streamCodeGeneration(prompt, runtimeOverrides, signal);
}

export async function* repairTest(
  snapshot: PageSnapshot,
  description: string,
  repair: RepairTestContext,
  auth?: AuthConfig,
  context?: GenerateTestContext,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal,
  planning?: ResolvedPromptPlanningContext
): AsyncGenerator<GenerateEvent> {
  throwIfAborted(signal);
  yield { type: 'thinking', content: '正在回收失败执行上下文...' };
  const edgeCases = await loadEdgeCases(context?.scenarioEntryUrl || snapshot.url);
  yield { type: 'thinking', content: `已加载 ${edgeCases.length} 个相关边缘案例` };

  yield { type: 'thinking', content: '正在加载现有测试范例...' };
  const existingExample = await loadExistingExample(snapshot, description, context);
  const deterministicTemplate = resolveDeterministicTemplate(snapshot, description, existingExample, context);
  if (deterministicTemplate) {
    yield { type: 'thinking', content: '命中已验证的专门模板，直接回退到稳定脚本...' };
    yield { type: 'complete', content: deterministicTemplate };
    return;
  }

  yield { type: 'thinking', content: '正在匹配项目知识规则...' };
  const resolvedPlanning = planning || resolveIntentPromptPlanningContext(snapshot, description, context);
  yield {
    type: 'thinking',
    content: formatPlanningKnowledgeHitMessage('repair ', resolvedPlanning),
  };

  yield { type: 'thinking', content: '正在构造修复 Prompt 并调用 LLM...' };
  const prompt = buildRepairPrompt(snapshot, description, auth, edgeCases, existingExample, repair, context, resolvedPlanning);
  yield* streamCodeGeneration(prompt, runtimeOverrides, signal);
}
