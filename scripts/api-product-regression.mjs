#!/usr/bin/env node

/**
 * 产品新增接口回归脚本（可在本地/CI 直接执行）
 *
 * 用法示例：
 * API_BASE_URL="http://192.168.39.45:5173" \
 * API_LOGIN_ENDPOINT="/api/auth/login" \
 * API_PRODUCTS_ENDPOINT="/api/ai-sales-assist/products" \
 * API_USERNAME="18717740267" \
 * API_PASSWORD="12345678" \
 * node scripts/api-product-regression.mjs
 */

const now = Date.now();

const config = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://192.168.39.45:5173',
  loginEndpoint: process.env.API_LOGIN_ENDPOINT || '/api/auth/login',
  productsEndpoint: process.env.API_PRODUCTS_ENDPOINT || '/api/ai-sales-assist/products',
  username: process.env.API_USERNAME || '',
  password: process.env.API_PASSWORD || '',
  authToken: process.env.API_AUTH_TOKEN || '',
  loginPayloadJson: process.env.API_LOGIN_PAYLOAD_JSON || '',
  productPayloadJson: process.env.API_PRODUCT_PAYLOAD_JSON || '',
  tokenJsonPaths: (process.env.API_TOKEN_JSON_PATHS || 'token,data.token,accessToken,data.accessToken')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  requestTimeoutMs: Number(process.env.API_TIMEOUT_MS || 20_000)
};

function joinUrl(base, path) {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

async function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = 20_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function defaultLoginPayload() {
  return {
    username: config.username,
    phone: config.username,
    account: config.username,
    password: config.password,
    loginType: 'password'
  };
}

function defaultProductPayload(productName) {
  return {
    name: productName,
    productName,
    tags: ['自动化', '回归']
  };
}

function extractToken(loginData) {
  for (const path of config.tokenJsonPaths) {
    const value = getByPath(loginData, path);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return '';
}

(async () => {
  try {
    const productName = `接口回归产品-${now}`;

    let token = config.authToken;

    if (!token) {
      if (!config.username || !config.password) {
        console.error('❌ 缺少认证信息：请设置 API_AUTH_TOKEN 或 API_USERNAME/API_PASSWORD');
        process.exit(2);
      }

      const loginUrl = joinUrl(config.apiBaseUrl, config.loginEndpoint);
      const loginPayload = config.loginPayloadJson
        ? JSON.parse(config.loginPayloadJson)
        : defaultLoginPayload();

      console.log(`🔐 登录接口: ${loginUrl}`);
      const loginRes = await requestJson(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: loginPayload,
        timeoutMs: config.requestTimeoutMs
      });

      if (!loginRes.ok) {
        console.error(`❌ 登录失败: HTTP ${loginRes.status}`);
        console.error(JSON.stringify(loginRes.data, null, 2));
        process.exit(3);
      }

      token = extractToken(loginRes.data);
      if (!token) {
        console.error('❌ 登录成功但未提取到 token，请检查 API_TOKEN_JSON_PATHS 或登录返回结构');
        console.error(JSON.stringify(loginRes.data, null, 2));
        process.exit(4);
      }
    }

    const productsUrl = joinUrl(config.apiBaseUrl, config.productsEndpoint);
    const productPayload = config.productPayloadJson
      ? JSON.parse(config.productPayloadJson)
      : defaultProductPayload(productName);

    // 自动补充 productName/name，方便不同后端字段兼容
    if (!productPayload.name) productPayload.name = productName;
    if (!productPayload.productName) productPayload.productName = productName;

    console.log(`🧪 新增产品接口: ${productsUrl}`);
    const createRes = await requestJson(productsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: productPayload,
      timeoutMs: config.requestTimeoutMs
    });

    if (!createRes.ok) {
      console.error(`❌ 新增产品失败: HTTP ${createRes.status}`);
      console.error(JSON.stringify(createRes.data, null, 2));
      process.exit(5);
    }

    console.log('✅ 新增产品接口回归通过');
    console.log(`产品名: ${productName}`);
    console.log(JSON.stringify(createRes.data, null, 2));
  } catch (err) {
    console.error('❌ 接口回归执行异常');
    console.error(err);
    process.exit(1);
  }
})();
