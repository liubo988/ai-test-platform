export function isSmsPasswordLoginDescription(description) {
  return /(短信|验证码|获取验证码|sms|otp)/i.test(String(description || ''));
}

export function shouldOpenConfiguredLoginUrl(currentPageLooksLikeLogin, loginUrl) {
  return !currentPageLooksLikeLogin && Boolean(String(loginUrl || '').trim());
}

export function buildLoginModePatterns(description) {
  const normalized = String(description || '').trim();
  if (!normalized) return [];

  const patterns = [];

  if (isSmsPasswordLoginDescription(normalized)) {
    patterns.push(/短信登录|验证码登录|短信验证码登录|SMS|OTP|短信/i);
  }

  if (/密码登录|Password Login|Password/i.test(normalized) && !isSmsPasswordLoginDescription(normalized)) {
    patterns.push(/密码登录|密码|Password Login|Password/i);
  }

  if (/扫码|二维码|qr/i.test(normalized)) {
    patterns.push(/扫码登录|二维码登录|扫码|二维码|QR/i);
  }

  return patterns;
}

export const loginUsernameSelector = [
  '#normal_login_codePhone',
  'input[placeholder*="请输入手机号"]',
  'input[placeholder*="手机号"]',
  'input[placeholder*="手机号码"]',
  'input[placeholder*="请输入邮箱"]',
  'input[placeholder*="账号"]',
  'input[id*="phone"]',
  'input[name*="phone"]',
].join(', ');

export const loginSmsCodeSelector = [
  '#normal_login_code',
  'input[placeholder*="请输入验证码"]',
  'input[placeholder*="验证码"]',
  'input[placeholder*="短信验证码"]',
].join(', ');

export const loginPasswordSelector = [
  'input[placeholder*="请输入密码"]',
  'input[placeholder*="password" i]',
  'input[type="password"]',
].join(', ');

export const loginVerificationSelector = [loginSmsCodeSelector, loginPasswordSelector].join(', ');

export const loginButtonNamePattern = /登\s*录|登录|Login|Sign in/i;

export const loginShellTextPattern =
  /企业微信登录|管帮手登录|短信验证码登录|短信登录|验证码登录|扫码登录|二维码登录|QR/i;

export const loginShellFrameSelector = 'iframe[src*="qrConnect"]';
