# UI 优化记录 — 2026-03-09

## 1. 项目任务列表页 (ProjectWorkspace)

### 1.1 表格优化
- 第一列只显示任务标题，不再显示描述内容
- 新增序号列 `#`
- 操作按钮改为：文字按钮（生成/执行）+ 图标按钮（历史/编辑/归档），避免拥挤
- 列宽使用 `table-fixed` + 百分比分配，解决列宽不合理问题
- 新增分页功能，每页 10 条

### 1.2 生成计划交互
- 点击"生成"按钮后，显示全屏遮罩 + 旋转加载动画（替代仅按钮文字变化）
- 使用独立的 `generatingUid` 状态，解决点击"执行"时"生成"按钮误显示"生成中"的问题
- 生成完成后，左侧模块选项卡保持不变（保存并恢复 `activeModuleUid`）

### 1.3 执行历史弹窗
- 新增"查看详情"按钮，点击跳转到 `/runs/{executionUid}` 执行详情页

### 1.4 模块选项卡记忆
- 从执行详情页点击"返回项目"时，URL 携带 `?module={moduleUid}` 参数
- `ProjectWorkspace` 通过 `useSearchParams` 读取该参数，初始化选中的模块

### 1.5 "返回项目首页"按钮内联
- 将"返回项目首页"按钮从页面顶部独立区域移至项目统计栏（模块/任务/通过率/执行中）行内
- 按钮样式改为紧凑型（`h-7`），与统计信息视觉对齐
- 原 `app/projects/[projectUid]/page.tsx` 中的独立按钮区块已移除

### 1.6 左侧模块新增"默认"选项
- 模块侧边栏顶部新增"默认"虚拟模块，点击后显示项目下全部任务（不按模块过滤）
- 使用 `ALL_MODULES_UID = '__all__'` 标记，`loadTasks` 在此模式下不传 `moduleUid` 参数
- 新建项目时默认选中"默认"模块
- "默认"模块无编辑/归档按钮（不可删除）
- 折叠模式下显示"全"字图标，展开模式下显示完整"默认"标签和任务总数

**涉及文件：**
- `components/ProjectWorkspace.tsx`
- `app/projects/[projectUid]/page.tsx`

---

## 2. 执行详情页 (ExecutionConsole)

### 2.1 布局重构
- 左右比例从 ~1:1 改为 **3:7**，浏览器画面占 70% 宽度
- 浏览器画面区域使用 `sticky` 定位，滚动左侧时保持可见
- 删除"执行产物"卡片（Artifacts section）
- 删除页面顶部"返回项目首页"按钮（执行工作台头部已有"返回项目"）

### 2.2 执行工作台头部压缩
- 从大卡片改为单行紧凑布局
- 状态标签、标题、任务名称、统计数据（版本/帧数/耗时）全部在一行显示

### 2.3 执行事件改为可折叠
- 在"任务上下文"标题栏新增"执行事件"按钮
- 默认收起，点击展开/收起事件面板
- 按钮带事件数量提示，展开时蓝色高亮

### 2.4 LLM 对话卡片增强
- 琥珀色边框和背景色，使其更醒目
- 标题前增加对话气泡图标
- 消息数量用圆角标签高亮显示

### 2.5 "返回项目"携带模块信息
- 链接改为 `/projects/{projectUid}?module={moduleUid}`
- 确保返回后模块选项卡不变

**涉及文件：**
- `components/ExecutionConsole.tsx`
- `app/runs/[executionUid]/page.tsx`

---

## 3. 浏览器画面回放功能

### 3.1 帧数据持久化
- 执行测试时，将 CDP screencast 帧图片（JPEG）保存到 `data/frames/{sessionId}/` 目录
- 抽帧采样：每 10 帧存 1 帧，最多保存 **30 帧**/次执行（约 2MB）
- 自动清理：每次新执行时，删除超过 7 天的旧帧目录

### 3.2 回放 API
- `GET /api/execution-details/{uid}/frames` — 列出所有可用帧
- `GET /api/execution-details/{uid}/frames?frame={n}` — 获取单帧 JPEG 图片
- `DELETE /api/execution-details/{uid}/frames` — 删除当前执行的帧数据

### 3.3 回放播放器
- 浏览器画面区域新增"回放"按钮（蓝色，带播放图标）
- 点击后自动加载帧数据并开始播放
- 播放控制：上一帧 / 播放暂停 / 下一帧
- 进度条可拖拽跳转到任意帧
- 速度切换：0.5x / 1x / 2x / 4x
- "返回实时"按钮退出回放模式
- "清除数据"按钮（红色）可手动删除当前执行的帧数据

**涉及文件：**
- `lib/test-executor.ts` — 帧采样存储 + 自动清理
- `app/api/execution-details/[executionUid]/frames/route.ts` — 新增 API（GET + DELETE）
- `components/ExecutionConsole.tsx` — 回放播放器 UI
- `components/BrowserView.tsx` — 原有实时画面组件（未修改）
- `.gitignore` — 新增 `data/frames/` 忽略规则

---

## 4. Bug 修复

### 4.1 修改模块名称报唯一约束冲突
- **现象**：修改模块名称为已归档模块的同名时，报 `Duplicate entry ... for key 'uk_test_modules_project_name'`
- **原因**：`ensureModuleNameAvailable()` 只检查 `status = 'active'` 的记录，但数据库唯一约束 `uk_test_modules_project_name(project_uid, name)` 不区分状态
- **修复**：移除 `ensureModuleNameAvailable` 中的 `AND status = 'active'` 条件，使应用层校验与数据库约束一致
- **同步**：`e2e-platform-schema.sql` 补充 `uk_test_modules_project_name` 唯一约束定义

### 4.2 新建项目报 Unknown column 'cover_image_url'
- **现象**：新建项目时报 `Unknown column 'cover_image_url' in 'field list'`
- **原因**：数据库表 `test_projects` 缺少 `cover_image_url` 列（schema 文件有定义但未同步到数据库）
- **修复**：新增迁移脚本 `scripts/migration-2026-03-09.sql`，执行 `ALTER TABLE test_projects ADD COLUMN cover_image_url TEXT NULL AFTER description`

**涉及文件：**
- `lib/db/repository.ts` — 修复 `ensureModuleNameAvailable` 查询条件
- `scripts/e2e-platform-schema.sql` — 补充唯一约束定义
- `scripts/migration-2026-03-09.sql` — 新增迁移脚本
