import { describe, expect, it } from 'vitest';
import { isSmsPasswordLoginDescription } from '../../lib/page-analyzer';

describe('page-analyzer login helpers', () => {
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
});
