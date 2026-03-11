import { chromium, type Locator, type Page, type Browser } from 'playwright';

export interface PageSnapshot {
  url: string;
  title: string;
  forms: FormInfo[];
  buttons: ButtonInfo[];
  tooltipElements: TooltipElement[];
  links: LinkInfo[];
  headings: HeadingInfo[];
  screenshot: string; // base64 JPEG
}

interface TooltipElement {
  tag: string;
  text: string;
  title: string;
  ariaLabel: string;
  role: string;
  className: string;
}

interface FormInfo {
  action: string;
  method: string;
  fields: FieldInfo[];
}
interface FieldInfo {
  type: string;
  name: string;
  id: string;
  placeholder: string;
  required: boolean;
  label: string;
}
interface ButtonInfo {
  text: string;
  id: string;
  type: string;
  ariaLabel: string;
  title: string;
  className: string;
  isIconOnly: boolean;
}
interface LinkInfo {
  text: string;
  href: string;
}
interface HeadingInfo {
  level: string;
  text: string;
}

export interface AuthConfig {
  loginUrl?: string;
  username?: string;
  password?: string;
  loginDescription?: string;
}

function normalizeUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.origin}${parsed.pathname}${parsed.hash}`.replace(/\/+$/, '');
  } catch {
    return u.replace(/\/+$/, '');
  }
}

export function isSmsPasswordLoginDescription(description: string): boolean {
  return /(短信|验证码|获取验证码|sms|otp)/i.test(description);
}

function getUsernameInput(page: Page): Locator {
  return page.getByPlaceholder(/请输入手机号|手机号|手机号码|请输入邮箱|Enter your phone|Enter phone or email|username/i).first();
}

async function switchLoginModeIfNeeded(page: Page, auth: AuthConfig): Promise<void> {
  const description = `${auth.loginDescription || ''}`.trim();
  if (!description) return;

  const modePatterns: RegExp[] = [];

  if (isSmsPasswordLoginDescription(description)) {
    modePatterns.push(/短信登录|验证码登录|SMS|OTP|短信/i);
  }

  if (/密码登录|Password Login|Password/i.test(description) && !isSmsPasswordLoginDescription(description)) {
    modePatterns.push(/密码登录|密码|Password Login|Password/i);
  }

  if (/扫码|二维码|qr/i.test(description)) {
    modePatterns.push(/扫码登录|二维码登录|扫码|二维码|QR/i);
  }

  for (const pattern of modePatterns) {
    const tab = page.getByRole('tab', { name: pattern }).first();
    if (await tab.isVisible({ timeout: 1200 }).catch(() => false)) {
      await tab.click({ force: true });
      await page.waitForTimeout(500);
      return;
    }

    const textTab = page.getByText(pattern).first();
    if (await textTab.isVisible({ timeout: 1200 }).catch(() => false)) {
      await textTab.click({ force: true });
      await page.waitForTimeout(500);
      return;
    }
  }
}

async function resolveSecretInput(page: Page, auth: AuthConfig): Promise<Locator> {
  const description = `${auth.loginDescription || ''}`.trim();
  const prefersSmsCodeInput = isSmsPasswordLoginDescription(description);

  if (prefersSmsCodeInput) {
    const groupedCodeInput = page
      .locator('.ant-input-group')
      .filter({ has: page.getByRole('button', { name: /获取验证码/i }).first() })
      .locator('input')
      .first();

    if (await groupedCodeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      return groupedCodeInput;
    }

    const codeInput = page.getByPlaceholder(/请输入验证码|验证码|短信验证码|code/i).first();
    if (await codeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      return codeInput;
    }
  }

  const passwordInput = page.getByPlaceholder(/请输入密码|Enter password|password/i).first();
  if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    return passwordInput;
  }

  if (!prefersSmsCodeInput) {
    const passwordTab = page.getByText(/密码登录|Password Login/i).first();
    if (await passwordTab.isVisible({ timeout: 1500 }).catch(() => false)) {
      await passwordTab.click({ force: true });
      await page.waitForTimeout(500);
      if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        return passwordInput;
      }
    }
  }

  return prefersSmsCodeInput
    ? page.getByPlaceholder(/请输入验证码|验证码|短信验证码|code/i).first()
    : passwordInput;
}

async function isLikelyLoginPage(page: Page): Promise<boolean> {
  const usernameInput = getUsernameInput(page);
  const loginButton = page.getByRole('button', { name: /登\s*录|登录|Login|Sign in/i }).first();
  const verificationInput = page.getByPlaceholder(/请输入验证码|验证码|短信验证码|请输入密码|Enter password|password/i).first();

  const [usernameVisible, loginVisible, verificationVisible] = await Promise.all([
    usernameInput.isVisible({ timeout: 800 }).catch(() => false),
    loginButton.isVisible({ timeout: 800 }).catch(() => false),
    verificationInput.isVisible({ timeout: 800 }).catch(() => false),
  ]);

  return usernameVisible && loginVisible && verificationVisible;
}

async function performLogin(page: Page, auth: AuthConfig): Promise<void> {
  if (!auth.loginUrl || !auth.username || !auth.password) return;

  await page.goto(auth.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await switchLoginModeIfNeeded(page, auth);
  const usernameInput = getUsernameInput(page);
  await usernameInput.waitFor({ state: 'visible', timeout: 10_000 });
  await usernameInput.fill(auth.username);

  const secretInput = await resolveSecretInput(page, auth);
  await secretInput.waitFor({ state: 'visible', timeout: 10_000 });
  await secretInput.fill(auth.password);

  const loginButton = page.getByRole('button', { name: /登\s*录|登录|Login|Sign in/i }).first();
  await loginButton.waitFor({ state: 'visible', timeout: 10_000 });
  await loginButton.click();

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1500);

  if (await isLikelyLoginPage(page)) {
    throw new Error(`登录后仍停留在登录页，请检查登录说明或凭证: ${auth.loginDescription || '未提供登录说明'}`);
  }
}

export async function analyzePage(url: string, auth?: AuthConfig): Promise<PageSnapshot> {
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' });
  const page = await context.newPage();

  try {
    // 目标 URL 与登录 URL 不同时，先登录再跳转；相同则直接分析（测试登录页本身）
    const isSamePage = auth?.loginUrl && normalizeUrl(auth.loginUrl) === normalizeUrl(url);
    if (auth?.loginUrl && auth?.username && auth?.password && !isSamePage) {
      await performLogin(page, auth);
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2000);

    if (auth?.loginUrl && auth?.username && auth?.password && !isSamePage && (await isLikelyLoginPage(page))) {
      throw new Error('跳转到目标页面后仍处于登录页，无法分析真实业务页面');
    }

    const title = await page.title();

    const forms: FormInfo[] = await page.$$eval('form', (formEls) =>
      formEls.map((f) => ({
        action: f.getAttribute('action') || '',
        method: f.getAttribute('method') || 'GET',
        fields: Array.from(f.querySelectorAll('input, select, textarea')).map((el) => {
          const input = el as HTMLInputElement;
          const labelEl = input.labels?.[0] || input.closest('label');
          return {
            type: input.type || el.tagName.toLowerCase(),
            name: input.name || '',
            id: input.id || '',
            placeholder: input.placeholder || '',
            required: input.required || false,
            label: labelEl?.textContent?.trim() || '',
          };
        }),
      }))
    );

    const buttons: ButtonInfo[] = await page.$$eval(
      'button, [role="button"], input[type="submit"], [class*="btn"], [class*="icon"][onclick], [class*="icon"][class*="click"]',
      (els) =>
        els.slice(0, 50).map((el) => {
          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const title = el.getAttribute('title') || '';
          const hasIcon = !!el.querySelector('svg, i, span[class*="icon"], img');
          const isIconOnly = hasIcon && text.length <= 2;
          return {
            text,
            id: el.id || '',
            type: (el as HTMLButtonElement).type || '',
            ariaLabel,
            title,
            className: el.className?.toString?.()?.slice(0, 100) || '',
            isIconOnly,
          };
        })
    );

    // 抓取带 title/aria-label 的可点击元素（图标按钮、悬浮提示等）
    const tooltipElements: TooltipElement[] = await page.$$eval(
      '[title]:not(head *), [aria-label]:not(head *)',
      (els) =>
        els.slice(0, 30).map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim()?.slice(0, 50) || '',
          title: el.getAttribute('title') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          role: el.getAttribute('role') || '',
          className: el.className?.toString?.()?.slice(0, 80) || '',
        })).filter((e) => e.title || e.ariaLabel)
    );

    // hover 图标按钮，捕获 Ant Design / Element UI 等框架的动态 tooltip
    try {
      const iconBtns = await page.locator(
        'button:has(svg), button:has(i), [role="button"]:has(svg), [role="button"]:has(i), .ant-btn-icon-only, [class*="icon-btn"], [class*="iconBtn"]'
      ).all();
      for (const btn of iconBtns.slice(0, 15)) {
        try {
          await btn.hover({ timeout: 2000 });
          await page.waitForTimeout(500);
          // 检查是否出现了 tooltip
          const tooltip = page.locator('.ant-tooltip-inner, .ant-popover-inner-content, [role="tooltip"], .el-tooltip__popper, .tippy-content').first();
          if (await tooltip.isVisible({ timeout: 1000 }).catch(() => false)) {
            const tipText = (await tooltip.textContent())?.trim() || '';
            if (tipText) {
              const btnClass = await btn.getAttribute('class') || '';
              tooltipElements.push({
                tag: 'icon-button',
                text: tipText,
                title: `[hover-tooltip] ${tipText}`,
                ariaLabel: '',
                role: 'button',
                className: btnClass.slice(0, 80),
              });
            }
          }
        } catch {
          // 单个按钮 hover 失败不影响其他
        }
      }
      // hover 到空白处关闭 tooltip
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
    } catch {
      // hover 扫描整体失败不影响分析
    }

    const links: LinkInfo[] = await page.$$eval('a[href]', (els) =>
      els.slice(0, 20).map((el) => ({
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
      }))
    );

    const headings: HeadingInfo[] = await page.$$eval('h1,h2,h3', (els) =>
      els.map((el) => ({ level: el.tagName, text: el.textContent?.trim() || '' }))
    );

    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });
    const screenshot = screenshotBuffer.toString('base64');

    await browser.close();
    return { url, title, forms, buttons, tooltipElements, links, headings, screenshot };
  } catch (err: any) {
    await browser.close();
    throw new Error(`页面分析失败: ${err.message}`);
  }
}
