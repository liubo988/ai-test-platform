# 一开业 UAT 多节点 Demo 记录

## 当前结论

这条 demo 已按真实 UAT 页面跑通，最终收敛为：

`订单列表 -> 批量申请入账 -> 入账管理核对`

没有继续扩到 `款项审核`，因为当前 UAT 上这条下游链路不稳定，不适合拿来做可复现 demo。

## 已落库对象

- 项目：`测试环境`
- 项目 UID：`proj_default`
- 模块：`订单`
- 模块 UID：`mod_1772873197821_013a6511`
- 任务：`多节点 Demo：订单批量入账到入账管理核对`
- 配置 UID：`cfg_1773119051091_babde38c`
- 最新计划：`plan_1773124359847_70270089`
- 最新计划版本：`v9`
- 通过执行：`exec_1773124371050_8e8ae292`

## 最终执行结果

- 状态：`passed`
- 执行摘要：`执行成功（步骤通过 5，跳过 0）`
- 执行时长：`23746ms`
- 开始时间：`2026-03-10T06:32:51.060Z`
- 结束时间：`2026-03-10T06:33:15.215Z`

## 本次真实写入的 UAT 数据

- 订单号：`202602051326257939`
- 入账金额：`399`
- 服务项：`园区公司注册`
- 提交时间：`2026-03-10T06:33:14.212Z`
- 清理提示：`该记录为自动化在UAT创建，如无法自动作废，请交由业务侧/财务侧人工清理`

## 真实页面关键事实

- UAT 是 hash 路由，必须走 `#/`。
- 直接打开这些地址会返回 404：
  - `/order/list`
  - `/payment/bookedMgmt`
  - `/payment/paymentReview`
- 正确入口示例：
  - `https://uat-service.yikaiye.com/#/order/list`
  - `https://uat-service.yikaiye.com/#/payment/bookedMgmt`
- 订单列表里的真实入口不是“行内申请入账”，而是：
  - 勾选订单
  - 点击顶部 `批量入账`
  - 打开 `批量申请入账` 弹窗
- 订单列表不要点 `全部清除`，否则很容易长时间无数据。
- 订单勾选框是 Ant Design 隐藏 input，实际要点 `label.ant-checkbox-wrapper`。
- 订单号不能从整行宽泛正则猜，真实稳定位置是：
  - `td.test_class a.themeColor.bold`
- 入账管理页同一条记录会被固定列拆成多份 `tr`，断言时不能直接拿第一条匹配行。

## 这次修掉的几个坑

1. 手工计划代码入库时，`\s`、`\d` 之类转义被吃掉，导致执行前直接 `SyntaxError`。
2. 订单列表里取“第一个链接”不稳定，拿到的是空文本或手机号，不是订单号。
3. 入账管理的 `请输入关键词` 存在隐藏输入框，不能直接 `.first()`。
4. 入账管理结果表含固定列副本，同一条记录会出现多条可见或半可见 `tr`，不能直接用“第一条匹配行”做最终断言。

## 最终方案

- 登录成功后不强依赖固定业务路由，只要进入 `#/` 即可。
- 订单列表：
  - 不点 `全部清除`
  - 找 `待申请入账` 行
  - 从 `td.test_class a.themeColor.bold` 提取订单号
  - 点击 `label.ant-checkbox-wrapper`
  - 点击顶部 `批量入账`
- 批量申请入账弹窗：
  - 读取默认金额
  - 提交 `确 定`
- 入账管理：
  - 只操作可见的搜索框和按钮
  - 先按订单号定位一条可见结果
  - 再取它的 `data-row-key`
  - 把同 key 的可见行文本拼起来，再断言订单号和金额

## 当前 demo 的业务流定义

- 共享变量：
  - `orderNo`
  - `applyAmount`
  - `serviceItem`
  - `entryStatus`
- 目标结果：
  - 订单列表中的待申请入账订单提交后，可以在入账管理中通过订单号检索到对应记录，且订单号、服务项、入账金额保持一致。

## 相关文件

- [scripts/seed-yikaiye-multi-node-demo.mjs](/Users/xiaolongbao/Workspace/ai-test/scripts/seed-yikaiye-multi-node-demo.mjs)
- [lib/test-generator.ts](/Users/xiaolongbao/Workspace/ai-test/lib/test-generator.ts)
- [output/playwright/yikaiye-order-list-debug.json](/Users/xiaolongbao/Workspace/ai-test/output/playwright/yikaiye-order-list-debug.json)
- [output/playwright/booked-mgmt-search-debug.png](/Users/xiaolongbao/Workspace/ai-test/output/playwright/booked-mgmt-search-debug.png)

## 后续如果要继续扩

如果后面要把 demo 扩成真正的“多节点长链路”，建议在这条已通过链路上继续加节点，而不是换掉前半段：

1. `订单列表 -> 批量申请入账 -> 入账管理核对` 保持不动。
2. 单独确认 `款项审核` 的真实入链条件和稳定检索方式。
3. 只有当 `款项审核` 能稳定查到同一笔数据后，再补成下一版 demo。
