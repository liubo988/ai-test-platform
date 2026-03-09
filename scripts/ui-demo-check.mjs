import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:3010';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

let result = {
  loaded: false,
  submitted: false,
  codeGenerated: false,
  executeVisible: false,
  errorPanel: false,
  details: '',
};

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);

  await page.waitForSelector('text=AI E2E 测试平台', { timeout: 10000 });
  result.loaded = true;

  await page.fill('input[type="url"]', 'https://www.baidu.com');
  await page.fill('textarea', '测试搜索功能');

  const submitBtn = page.getByRole('button', { name: '开始生成测试' });
  await submitBtn.click();
  result.submitted = true;

  const codePanel = page.locator('pre').first();
  await page.waitForTimeout(9000);
  const codeText = await codePanel.innerText();

  result.codeGenerated = !!codeText && !codeText.includes('等待生成') && codeText.length > 30;

  const executeBtn = page.getByRole('button', { name: '执行测试' });
  result.executeVisible = await executeBtn.isVisible().catch(() => false);

  const err = page.locator('text=错误:').first();
  result.errorPanel = await err.isVisible().catch(() => false);

  result.details = `codeLen=${codeText?.length || 0}`;

  await page.screenshot({ path: 'output/playwright/ui-demo-after-generate.png', fullPage: true });

  console.log(JSON.stringify(result));
} catch (e) {
  result.details = String(e?.message || e);
  console.log(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  await browser.close();
}
