# Task Brief

## 标题
- Phase 5 / 第二刀：secondary compare regressions env watch recheck

## 背景
- 当前仍是 `Phase 5 / 第二刀`，不是 freeze，也不是第三刀。
- 上一轮已经固定：
  - `ui_extract` 连续两次 `failureClass=env_transient`
  - `curl` / Playwright 已确认 `uat-service.yikaiye.com` 存在连接异常
  - 在环境恢复前，不应继续 `ui_extract replay / assert_extract_ui / compare`
- 用户要求继续推进，因此需要确认这不是短暂抖动，而是仍在持续的环境阻塞。

## 本轮目标
- 对 UAT 站点执行一个有界的环境 watch recheck。
- 确认 HTTPS / browser navigation 是否已恢复。
- 若仍未恢复，补充更细的 DNS / TCP / TLS 分层证据，明确“不是本地代码问题，也不是单次抖动”。

## 验收标准
- [ ] 至少完成一轮有界 watch，记录多次连续失败结果
- [ ] 明确 DNS 解析结果
- [ ] 明确 TCP / HTTP / TLS 分层结论
- [ ] 明确是否存在可用备用 host
- [ ] 回写 roadmap，并通过文档校验

## 范围
- 会改：
  - `docs/intent-e2e-phase5-second-cut-ui-extract-assert-secondary-compare-regressions-env-watch-recheck-task-brief-2026-04-23.md`
  - `docs/intent-e2e-high-success-roadmap-2026-03-20.md`
- 不会改：
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - benchmark harness
  - benchmark pointer
  - corpus 资产
  - 任何生产代码

## 固定结论
- bounded watch `3` 轮结果全部一致：
  - `curl https://uat-service.yikaiye.com/` 持续返回 `SSL_ERROR_SYSCALL`
  - Playwright `goto https://uat-service.yikaiye.com/#/order/list` 持续返回 `net::ERR_CONNECTION_CLOSED`
- 分层结论已固定：
  - DNS 可解析：
    - `uat-service.yikaiye.com -> 198.18.0.152`
    - `uat-qiye-service.yikaiye.com -> 198.18.0.141`
  - TCP `443` 可连通，但 TLS 握手失败：
    - Python `ssl` 返回 `UNEXPECTED_EOF_WHILE_READING`
    - `openssl s_client` 返回 `unexpected eof while reading`
  - HTTP 明文也不可用：
    - `curl http://uat-service.yikaiye.com/` 返回 `Empty reply from server`
    - Playwright `goto http://uat-service.yikaiye.com/#/order/list` 返回 `net::ERR_EMPTY_RESPONSE`
  - 备用 host `uat-qiye-service.yikaiye.com` 与主 host 呈现同类 `ERR_CONNECTION_CLOSED / SSL_ERROR_SYSCALL`
- 因此当前不是单次抖动，而是持续的环境/网关阻塞；没有可用备用入口。

## 验证
- bounded watch（`curl` + Playwright）
- `python3 socket.gethostbyname_ex(...)`
- `curl -v / -vk / -4 / http`
- `python3 ssl` handshake probe
- `openssl s_client`
- `node scripts/check-doc-links.mjs`
- `node scripts/check-roadmap-progress.mjs`
