import { describe, expect, it, vi } from 'vitest';
import { isSmsPasswordLoginDescription, shouldOpenConfiguredLoginUrl } from '../../lib/intent-e2e-auth-shared.mjs';
import {
  isRetryablePageAccessNavigationError,
  navigateForPageAccess,
  shouldIgnorePageAccessPrecheckFailure,
} from '../../lib/page-analyzer';

describe('intent-e2e auth shared helpers', () => {
  it('detects sms-code tabs that still require filling the password', () => {
    expect(
      isSmsPasswordLoginDescription(
        '选择短信验证码登陆tab页，“获取验证码”输入框 输入登陆密码，然后点击登陆。注意：登录按钮文字是登 录'
      )
    ).toBe(true);
  });

  it('does not misclassify normal password-login instructions as sms-code login', () => {
    expect(isSmsPasswordLoginDescription('切换到密码登录 tab，输入账号密码后点击登录')).toBe(false);
  });

  it('does not jump back to the configured login url when already on a real login page', () => {
    expect(shouldOpenConfiguredLoginUrl(true, 'https://uat-service.yikaiye.com/#/')).toBe(false);
  });

  it('still opens the configured login url when the current page is not a login page', () => {
    expect(shouldOpenConfiguredLoginUrl(false, 'https://uat-service.yikaiye.com/#/')).toBe(true);
  });

  it('treats precheck timeout and ERR_ABORTED as retryable page-access navigation errors', () => {
    expect(isRetryablePageAccessNavigationError(new Error('page.goto: Timeout 30000ms exceeded'))).toBe(true);
    expect(isRetryablePageAccessNavigationError(new Error('page.goto: net::ERR_ABORTED at https://example.com'))).toBe(true);
    expect(isRetryablePageAccessNavigationError(new Error('403 Forbidden'))).toBe(false);
  });

  it('retries page-access navigation with commit fallback after retryable goto failure', async () => {
    const goto = vi
      .fn()
      .mockRejectedValueOnce(new Error('page.goto: Timeout 30000ms exceeded'))
      .mockResolvedValueOnce(null);
    const waitForLoadState = vi.fn().mockResolvedValue(undefined);

    await navigateForPageAccess({ goto, waitForLoadState } as any, 'https://example.com/#/business/createbusiness');

    expect(goto).toHaveBeenNthCalledWith(1, 'https://example.com/#/business/createbusiness', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(goto).toHaveBeenNthCalledWith(2, 'https://example.com/#/business/createbusiness', {
      waitUntil: 'commit',
      timeout: 30000,
    });
    expect(waitForLoadState).toHaveBeenCalledWith('domcontentloaded', { timeout: 10000 });
  });

  it('does not retry page-access navigation on non-retryable goto failure', async () => {
    const goto = vi.fn().mockRejectedValue(new Error('403 Forbidden'));
    const waitForLoadState = vi.fn();

    await expect(navigateForPageAccess({ goto, waitForLoadState } as any, 'https://example.com/#/denied')).rejects.toThrow(
      '403 Forbidden'
    );
    expect(goto).toHaveBeenCalledTimes(1);
    expect(waitForLoadState).not.toHaveBeenCalled();
  });

  it('supports ignoring selected precheck failure classes for create-flow entry pages', () => {
    expect(shouldIgnorePageAccessPrecheckFailure('data_missing', { ignoreFailureClasses: ['data_missing'] })).toBe(true);
    expect(shouldIgnorePageAccessPrecheckFailure('env_transient', { ignoreFailureClasses: ['data_missing'] })).toBe(false);
  });
});
