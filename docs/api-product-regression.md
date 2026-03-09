# 新增产品接口级回归脚本

脚本文件：`scripts/api-product-regression.mjs`

## 快速运行

```bash
cd "/Users/xiaolongbao/Documents/xxx项目"
API_BASE_URL="http://192.168.39.45:5173" \
API_LOGIN_ENDPOINT="/api/auth/login" \
API_PRODUCTS_ENDPOINT="/api/ai-sales-assist/products" \
API_USERNAME="18717740267" \
API_PASSWORD="12345678" \
npm run test:api:product
```

## 通过 token 直接跑（跳过登录）

```bash
API_BASE_URL="http://192.168.39.45:5173" \
API_PRODUCTS_ENDPOINT="/api/ai-sales-assist/products" \
API_AUTH_TOKEN="<your_token>" \
npm run test:api:product
```

## 可调参数

- `API_BASE_URL`：API 网关地址
- `API_LOGIN_ENDPOINT`：登录接口路径（默认 `/api/auth/login`）
- `API_PRODUCTS_ENDPOINT`：新增产品接口路径（默认 `/api/ai-sales-assist/products`）
- `API_USERNAME` / `API_PASSWORD`：登录账号密码
- `API_AUTH_TOKEN`：已有 token（有则跳过登录）
- `API_TOKEN_JSON_PATHS`：登录返回里 token 提取路径，逗号分隔（默认 `token,data.token,accessToken,data.accessToken`）
- `API_LOGIN_PAYLOAD_JSON`：自定义登录 JSON 载荷
- `API_PRODUCT_PAYLOAD_JSON`：自定义新增产品 JSON 载荷
- `API_TIMEOUT_MS`：请求超时（毫秒）

## 返回码约定

- `0`：通过
- `2`：缺少认证参数
- `3`：登录接口失败
- `4`：登录后未提取到 token
- `5`：新增产品接口失败
- `1`：脚本执行异常
