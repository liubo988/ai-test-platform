# 新增产品功能 - E2E 执行与排查清单

## 1) 运行命令

在项目根目录执行：

```bash
cd "/Users/xiaolongbao/Documents/xxx项目"
E2E_BASE_URL="http://192.168.39.45:5173" \
E2E_LOGIN_URL="http://192.168.39.45:5173/login" \
E2E_PRODUCTS_URL="http://192.168.39.45:5173/ai-sales-assist/products" \
E2E_USERNAME="你的账号" \
E2E_PASSWORD="你的密码" \
npx playwright test tests/e2e/product-create.spec.ts --headed
```

> 注意：账号密码不要写入仓库文件（如 `.env` / 脚本硬编码）。

---

## 2) 成功标准

- 登录成功，能进入产品页
- 页面不出现 `获取产品列表失败`
- 点击「新建产品」后，填写必填项可点击「确定」
- 提交后出现：`创建产品成功 / 保存成功 / 新增产品成功`（任一）
  - 或列表中出现刚创建的产品名

---

## 3) 当前已定位到的环境问题（会导致用例失败）

如果看到以下现象：
- `获取产品列表失败`
- `创建产品失败`

通常可在浏览器控制台看到：
- 请求发往 `http://localhost:3100/api/ai-sales-assist/products`
- 被 CORS 拦截：`No 'Access-Control-Allow-Origin'`

这说明前端可访问，但后端 API 跨域/网关未正确开放。

---

## 4) 快速排查项（后端/网关）

1. **API 基地址是否正确**
   - 前端是否误写死 `localhost:3100`
   - 在局域网测试时，建议使用统一域名/网关地址

2. **CORS 配置**
   - 后端允许来源应包含：`http://192.168.39.45:5173`
   - 允许方法：`GET,POST,PUT,DELETE,OPTIONS`
   - 允许头：`Content-Type, Authorization, ...`
   - 预检 `OPTIONS` 返回 200/204 且带完整 CORS 头

3. **反向代理（Nginx/Vite proxy）**
   - 若前端走 `/api` 代理，确认目标后端可达
   - 确认代理未丢失 `Origin` / `Access-Control-*` 相关头

4. **登录态与接口鉴权**
   - 登录后 token/cookie 是否成功写入
   - 新增产品接口是否要求特定角色权限

---

## 5) 用例文件位置

- `tests/e2e/product-create.spec.ts`

