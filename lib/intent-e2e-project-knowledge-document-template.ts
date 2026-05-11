export function buildProjectKnowledgeDocumentImportPreviewPlanCode(targetUrl: string): string {
  return `import { test, expect } from '@playwright/test';

test('项目知识文档：导入后预览正文锚点', async ({ page }) => {
  const TARGET_URL = ${JSON.stringify(targetUrl)};
  const stamp = Date.now().toString().slice(-8);
  const DOC_NAME = '真实文档采集手册 ' + stamp;
  const DOC_ANCHOR = '真实 document-like real_click 采集锚点';
  const DOC_CONTENT = [
    DOC_ANCHOR,
    '本样本通过当前平台项目知识文档 UI 导入，并在文档块预览区校验正文可见。',
    'document family: doc_create_reopen_verify',
  ].join('\\n');

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  const openWorkbenchButton = page.getByRole('button', { name: '需求编排', exact: true }).first();
  await expect(openWorkbenchButton).toBeVisible({ timeout: 30000 });

  const workbench = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: '需求编排工作台', exact: true }),
  }).last();
  const workbenchHeading = workbench.getByRole('heading', { name: '需求编排工作台', exact: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await workbenchHeading.isVisible().catch(() => false)) break;
    await openWorkbenchButton.scrollIntoViewIfNeeded();
    await openWorkbenchButton.click();
    await workbenchHeading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  }
  await expect(workbenchHeading).toBeVisible({ timeout: 30000 });

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();
  await expect(workbench.getByRole('heading', { name: '导入知识文档', exact: true })).toBeVisible({ timeout: 30000 });

  await workbench.getByLabel('知识文档名称').fill(DOC_NAME);
  await workbench.getByLabel('知识来源路径').fill('reports/intent-e2e/document-real-click-seed.md');
  await workbench.getByLabel('知识文档内容').fill(DOC_CONTENT);
  await workbench.getByRole('button', { name: '导入知识' }).click();

  await expect(workbench.getByText('知识文档「' + DOC_NAME + '」已导入')).toBeVisible({ timeout: 30000 });
  await expect(workbench.getByText('当前预览：' + DOC_NAME)).toBeVisible({ timeout: 30000 });

  const previewSearch = workbench.getByLabel('搜索文档块');
  await expect(previewSearch).toBeVisible({ timeout: 30000 });
  await previewSearch.fill(DOC_ANCHOR);
  const previewPanel = previewSearch.locator('xpath=ancestor::div[contains(@class, "border") and contains(@class, "bg-white")][1]');
  await expect(previewPanel).toContainText(DOC_ANCHOR, { timeout: 30000 });
});`;
}

export function buildProjectKnowledgeDocumentSearchOpenPreviewPlanCode(targetUrl: string): string {
  return `import { test, expect } from '@playwright/test';

test('项目知识文档：搜索打开后预览正文锚点', async ({ page }) => {
  const TARGET_URL = ${JSON.stringify(targetUrl)};
  const target = new URL(TARGET_URL);
  const pathParts = target.pathname.split('/').filter(Boolean);
  const projectUid = decodeURIComponent(pathParts[1] || 'proj_default');
  const stamp = Date.now().toString().slice(-8);
  const DOC_NAME = '搜索打开验证手册 ' + stamp;
  const DOC_ANCHOR = '真实 document-like search open 采集锚点';
  const DOC_CONTENT = [
    DOC_ANCHOR,
    '本样本通过当前平台项目知识文档 UI 打开已有文档，并在文档块预览区搜索正文锚点。',
    'document family: doc_search_open_verify',
  ].join('\\n');

  const seedResponse = await page.request.post(target.origin + '/api/projects/' + encodeURIComponent(projectUid) + '/knowledge', {
    headers: {
      'content-type': 'application/json',
      'x-e2e-actor-uid': 'usr_default_owner',
    },
    data: {
      name: DOC_NAME,
      sourceType: 'manual',
      sourcePath: 'reports/intent-e2e/document-search-open-seed.md',
      content: DOC_CONTENT,
    },
  });
  expect(seedResponse.ok()).toBeTruthy();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  const openWorkbenchButton = page.getByRole('button', { name: '需求编排', exact: true }).first();
  await expect(openWorkbenchButton).toBeVisible({ timeout: 30000 });

  const workbench = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: '需求编排工作台', exact: true }),
  }).last();
  const workbenchHeading = workbench.getByRole('heading', { name: '需求编排工作台', exact: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await workbenchHeading.isVisible().catch(() => false)) break;
    await openWorkbenchButton.scrollIntoViewIfNeeded();
    await openWorkbenchButton.click();
    await workbenchHeading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  }
  await expect(workbenchHeading).toBeVisible({ timeout: 30000 });

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();
  await expect(workbench.getByRole('heading', { name: '导入知识文档', exact: true })).toBeVisible({ timeout: 30000 });

  const documentName = workbench.getByText(DOC_NAME, { exact: true }).first();
  await expect(documentName).toBeVisible({ timeout: 30000 });
  const documentCard = documentName.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  await documentCard.getByRole('button', { name: '预览', exact: true }).click();

  await expect(workbench.getByText('当前预览：' + DOC_NAME)).toBeVisible({ timeout: 30000 });
  const previewSearch = workbench.getByLabel('搜索文档块');
  await expect(previewSearch).toBeVisible({ timeout: 30000 });
  await previewSearch.fill(DOC_ANCHOR);
  const previewPanel = previewSearch.locator('xpath=ancestor::div[contains(@class, "border") and contains(@class, "bg-white")][1]');
  await expect(previewPanel).toContainText(DOC_ANCHOR, { timeout: 30000 });
});`;
}

export function buildProjectKnowledgeDocumentEditSavePreviewPlanCode(targetUrl: string): string {
  return `import { test, expect } from '@playwright/test';

test('项目知识文档：编辑保存后预览正文锚点', async ({ page }) => {
  const TARGET_URL = ${JSON.stringify(targetUrl)};
  const target = new URL(TARGET_URL);
  const pathParts = target.pathname.split('/').filter(Boolean);
  const projectUid = decodeURIComponent(pathParts[1] || 'proj_default');
  const stamp = Date.now().toString().slice(-8);
  const DOC_NAME = '编辑保存验证手册 ' + stamp;
  const ORIGINAL_ANCHOR = '真实 document-like edit save 原始锚点';
  const UPDATED_ANCHOR = '真实 document-like edit save 更新锚点';
  const ORIGINAL_CONTENT = [
    ORIGINAL_ANCHOR,
    '本样本先通过 fixture setup 准备一篇已有知识文档。',
    'document family setup: doc_edit_save_verify',
  ].join('\\n');
  const UPDATED_CONTENT = [
    UPDATED_ANCHOR,
    '本样本通过当前平台项目知识文档 UI 覆写同名文档，并在文档块预览区校验更新内容。',
    'document family: doc_edit_save_verify',
  ].join('\\n');

  const seedResponse = await page.request.post(target.origin + '/api/projects/' + encodeURIComponent(projectUid) + '/knowledge', {
    headers: {
      'content-type': 'application/json',
      'x-e2e-actor-uid': 'usr_default_owner',
    },
    data: {
      name: DOC_NAME,
      sourceType: 'manual',
      sourcePath: 'reports/intent-e2e/document-edit-save-seed.md',
      content: ORIGINAL_CONTENT,
    },
  });
  expect(seedResponse.ok()).toBeTruthy();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  const openWorkbenchButton = page.getByRole('button', { name: '需求编排', exact: true }).first();
  await expect(openWorkbenchButton).toBeVisible({ timeout: 30000 });

  const workbench = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: '需求编排工作台', exact: true }),
  }).last();
  const workbenchHeading = workbench.getByRole('heading', { name: '需求编排工作台', exact: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await workbenchHeading.isVisible().catch(() => false)) break;
    await openWorkbenchButton.scrollIntoViewIfNeeded();
    await openWorkbenchButton.click();
    await workbenchHeading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  }
  await expect(workbenchHeading).toBeVisible({ timeout: 30000 });

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();
  await expect(workbench.getByRole('heading', { name: '导入知识文档', exact: true })).toBeVisible({ timeout: 30000 });

  const documentName = workbench.getByText(DOC_NAME, { exact: true }).first();
  await expect(documentName).toBeVisible({ timeout: 30000 });
  const documentCard = documentName.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  await documentCard.getByRole('button', { name: '预览', exact: true }).click();
  await expect(workbench.getByText('当前预览：' + DOC_NAME)).toBeVisible({ timeout: 30000 });

  const previewSearch = workbench.getByLabel('搜索文档块');
  await expect(previewSearch).toBeVisible({ timeout: 30000 });
  await previewSearch.fill(ORIGINAL_ANCHOR);
  const previewPanel = previewSearch.locator('xpath=ancestor::div[contains(@class, "border") and contains(@class, "bg-white")][1]');
  await expect(previewPanel).toContainText(ORIGINAL_ANCHOR, { timeout: 30000 });

  await workbench.getByLabel('知识文档名称').fill(DOC_NAME);
  await workbench.getByLabel('知识来源路径').fill('reports/intent-e2e/document-edit-save-updated.md');
  await workbench.getByLabel('知识文档内容').fill(UPDATED_CONTENT);
  await workbench.getByRole('button', { name: '导入知识' }).click();

  await expect(workbench.getByText('知识文档「' + DOC_NAME + '」已导入')).toBeVisible({ timeout: 30000 });
  await expect(workbench.getByText('当前预览：' + DOC_NAME)).toBeVisible({ timeout: 30000 });

  await previewSearch.fill(ORIGINAL_ANCHOR);
  await expect(previewPanel).toContainText('没有匹配的文档块', { timeout: 30000 });
  await previewSearch.fill(UPDATED_ANCHOR);
  await expect(previewPanel).toContainText(UPDATED_ANCHOR, { timeout: 30000 });
});`;
}

export function buildProjectKnowledgeDocumentArchiveRestorePreviewPlanCode(targetUrl: string): string {
  return `import { test, expect } from '@playwright/test';

test('项目知识文档：归档恢复后预览正文锚点', async ({ page }) => {
  const TARGET_URL = ${JSON.stringify(targetUrl)};
  const target = new URL(TARGET_URL);
  const pathParts = target.pathname.split('/').filter(Boolean);
  const projectUid = decodeURIComponent(pathParts[1] || 'proj_default');
  const stamp = Date.now().toString().slice(-8);
  const DOC_NAME = '归档恢复验证手册 ' + stamp;
  const DOC_ANCHOR = '真实 document-like archive restore 采集锚点';
  const DOC_CONTENT = [
    DOC_ANCHOR,
    '本样本通过当前平台项目知识文档 UI 归档并恢复已有文档，再重新预览文档块。',
    'document family: doc_archive_restore_verify',
  ].join('\\n');

  const seedResponse = await page.request.post(target.origin + '/api/projects/' + encodeURIComponent(projectUid) + '/knowledge', {
    headers: {
      'content-type': 'application/json',
      'x-e2e-actor-uid': 'usr_default_owner',
    },
    data: {
      name: DOC_NAME,
      sourceType: 'manual',
      sourcePath: 'reports/intent-e2e/document-archive-restore-seed.md',
      content: DOC_CONTENT,
    },
  });
  expect(seedResponse.ok()).toBeTruthy();

  await page.addInitScript(() => {
    window.confirm = () => true;
  });
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  const openWorkbenchButton = page.getByRole('button', { name: '需求编排', exact: true }).first();
  await expect(openWorkbenchButton).toBeVisible({ timeout: 30000 });

  const workbench = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: '需求编排工作台', exact: true }),
  }).last();
  const workbenchHeading = workbench.getByRole('heading', { name: '需求编排工作台', exact: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await workbenchHeading.isVisible().catch(() => false)) break;
    await openWorkbenchButton.scrollIntoViewIfNeeded();
    await openWorkbenchButton.click();
    await workbenchHeading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  }
  await expect(workbenchHeading).toBeVisible({ timeout: 30000 });

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();
  await expect(workbench.getByRole('heading', { name: '导入知识文档', exact: true })).toBeVisible({ timeout: 30000 });

  const documentName = workbench.getByText(DOC_NAME, { exact: true }).first();
  await expect(documentName).toBeVisible({ timeout: 30000 });
  const documentCard = documentName.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  await documentCard.getByRole('button', { name: '预览', exact: true }).click();

  await expect(workbench.getByText('当前预览：' + DOC_NAME)).toBeVisible({ timeout: 30000 });
  const previewSearch = workbench.getByLabel('搜索文档块');
  await expect(previewSearch).toBeVisible({ timeout: 30000 });
  await previewSearch.fill(DOC_ANCHOR);
  const previewPanel = previewSearch.locator('xpath=ancestor::div[contains(@class, "border") and contains(@class, "bg-white")][1]');
  await expect(previewPanel).toContainText(DOC_ANCHOR, { timeout: 30000 });

  await documentCard.getByRole('button', { name: '归档知识文档 ' + DOC_NAME, exact: true }).click();
  await expect(workbench.getByText('知识文档「' + DOC_NAME + '」已归档')).toBeVisible({ timeout: 30000 });
  await expect(documentCard.getByText('已归档', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(documentCard.getByRole('button', { name: '恢复知识文档 ' + DOC_NAME, exact: true })).toBeVisible({ timeout: 30000 });

  await documentCard.getByRole('button', { name: '恢复知识文档 ' + DOC_NAME, exact: true }).click();
  await expect(workbench.getByText('知识文档「' + DOC_NAME + '」已恢复')).toBeVisible({ timeout: 30000 });
  await expect(documentCard.getByRole('button', { name: '归档知识文档 ' + DOC_NAME, exact: true })).toBeVisible({ timeout: 30000 });

  await documentCard.getByRole('button', { name: '预览', exact: true }).click();
  await expect(workbench.getByText('当前预览：' + DOC_NAME)).toBeVisible({ timeout: 30000 });
  await previewSearch.fill(DOC_ANCHOR);
  await expect(previewPanel).toContainText(DOC_ANCHOR, { timeout: 30000 });
});`;
}

export function buildProjectKnowledgeDocumentDeriveCapabilityPreviewPlanCode(targetUrl: string): string {
  return `import { test, expect } from '@playwright/test';

test('项目知识文档：自动沉淀能力后目录验收', async ({ page }) => {
  const TARGET_URL = ${JSON.stringify(targetUrl)};
  const target = new URL(TARGET_URL);
  const pathParts = target.pathname.split('/').filter(Boolean);
  const projectUid = decodeURIComponent(pathParts[1] || 'proj_default');
  const stamp = Date.now().toString().slice(-8);
  const DOC_NAME = '沉淀能力验证手册 ' + stamp;
  const SEARCH_FIELD = '采集手机号' + stamp;
  const DERIVED_QUERY_NAME = '商机列表按' + SEARCH_FIELD + '检索';
  const DOC_ANCHOR = '真实 document-like derive capability 采集锚点';
  const DOC_CONTENT = [
    '商机列表',
    '支持按' + SEARCH_FIELD + '检索商机。',
    '搜索结果会展示商机ID、' + SEARCH_FIELD + '和商机进展。',
    DOC_ANCHOR,
    'document family: doc_derive_capability_verify',
  ].join('\\n');

  const seedResponse = await page.request.post(target.origin + '/api/projects/' + encodeURIComponent(projectUid) + '/knowledge', {
    headers: {
      'content-type': 'application/json',
      'x-e2e-actor-uid': 'usr_default_owner',
    },
    data: {
      name: DOC_NAME,
      sourceType: 'manual',
      sourcePath: 'reports/intent-e2e/document-derive-capability-seed.md',
      content: DOC_CONTENT,
    },
  });
  expect(seedResponse.ok()).toBeTruthy();

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  const openWorkbenchButton = page.getByRole('button', { name: '需求编排', exact: true }).first();
  await expect(openWorkbenchButton).toBeVisible({ timeout: 30000 });

  const workbench = page.locator('div.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: '需求编排工作台', exact: true }),
  }).last();
  const workbenchHeading = workbench.getByRole('heading', { name: '需求编排工作台', exact: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await workbenchHeading.isVisible().catch(() => false)) break;
    await openWorkbenchButton.scrollIntoViewIfNeeded();
    await openWorkbenchButton.click();
    await workbenchHeading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  }
  await expect(workbenchHeading).toBeVisible({ timeout: 30000 });

  await workbench.getByRole('button', { name: '知识文档', exact: true }).click();
  await expect(workbench.getByRole('heading', { name: '导入知识文档', exact: true })).toBeVisible({ timeout: 30000 });

  const documentName = workbench.getByText(DOC_NAME, { exact: true }).first();
  await expect(documentName).toBeVisible({ timeout: 30000 });
  const documentCard = documentName.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  await documentCard.getByRole('button', { name: '预览', exact: true }).click();

  await expect(workbench.getByText('当前预览：' + DOC_NAME)).toBeVisible({ timeout: 30000 });
  const previewSearch = workbench.getByLabel('搜索文档块');
  await expect(previewSearch).toBeVisible({ timeout: 30000 });
  await previewSearch.fill(DOC_ANCHOR);
  const previewPanel = previewSearch.locator('xpath=ancestor::div[contains(@class, "border") and contains(@class, "bg-white")][1]');
  await expect(previewPanel).toContainText(DOC_ANCHOR, { timeout: 30000 });

  await workbench.getByRole('button', { name: '自动沉淀能力', exact: true }).click();
  await expect(workbench.getByText(/已沉淀 [1-9]\\d* 条能力/)).toBeVisible({ timeout: 30000 });
  await expect(workbench.getByRole('heading', { name: '能力目录', exact: true })).toBeVisible({ timeout: 30000 });

  const capabilitySearch = workbench.getByLabel('搜索稳定能力');
  await expect(capabilitySearch).toBeVisible({ timeout: 30000 });
  await capabilitySearch.fill(DERIVED_QUERY_NAME);
  await expect(workbench).toContainText(DERIVED_QUERY_NAME, { timeout: 30000 });
  await expect(workbench).toContainText('知识提炼', { timeout: 30000 });
});`;
}
