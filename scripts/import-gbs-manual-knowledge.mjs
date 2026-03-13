import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';

const execFile = promisify(execFileCallback);

const DEFAULT_PROJECT_UID = 'proj_default';
const DEFAULT_PROJECT_NAME = '测试环境';
const DEFAULT_DOCUMENT_NAME = '管帮手PC端操作手册';
const DEFAULT_PDF_PATH = path.join(process.cwd(), '管帮手PC端操作手册.pdf');
const DEFAULT_TEXT_PATH = path.join(process.cwd(), 'tmp', 'pdfs', 'gbs-manual.txt');
const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
const CREATE_URL = 'https://uat-service.yikaiye.com/#/business/createbusiness';
const LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
const MAILS_LIST_URL = 'https://uat-service.yikaiye.com/#/mails/mailslist';
const PLAN_UID = 'plan_1773190791674_7ce1583e';
const EXECUTION_UID = 'exec_1773190827173_f2bd5b83';
const PLAN_VERSION = 10;
const CREATE_ORDER_PLAN_UID = 'plan_1773229731870_7b57981b';
const CREATE_ORDER_EXECUTION_UID = 'exec_1773229732017_fc0efb4f';
const CREATE_ORDER_PLAN_VERSION = 14;
const CREATE_ORDER_VERIFIED_AT = '2026-03-11T11:50:00.000Z';
const BATCH_ADD_CONTACTS_PLAN_UID = 'plan_1773315882486_12545c87';
const BATCH_ADD_CONTACTS_EXECUTION_UID = 'exec_1773315898101_50b3bb32';
const BATCH_ADD_CONTACTS_PLAN_VERSION = 16;
const BATCH_ADD_CONTACTS_VERIFIED_AT = '2026-03-12T11:44:58.101Z';

const BUSINESS_CREATE_ORDER_FLOW_DEFINITION = {
  version: 1,
  entryUrl: CREATE_URL,
  sharedVariables: [
    'contactName',
    'contactPhone',
    'companyName',
    'productName',
    'businessId',
    'createdAt',
    'signedCountBefore',
    'signedCountAfter',
  ],
  expectedOutcome:
    '创建商机后可成功生成订单，并以 createOrder 成功响应、Drawer 关闭和签约成功计数不下降作为主判定。',
  cleanupNotes:
    '该业务流会真实写入 UAT 商机与订单数据。记录商机ID、联系人、手机号、创建时间和签约成功计数，由业务侧按 UAT 规则手工清理。',
  steps: [
    {
      stepUid: 'flow-open-create-business',
      stepType: 'ui',
      title: '进入创建商机页',
      target: CREATE_URL,
      instruction: '登录完成后直接打开创建商机页，确认当前页存在商机来源字段和保存并继续按钮。',
      expectedResult: '页面成功进入创建商机页，可开始填写第一页。',
      extractVariable: '',
    },
    {
      stepUid: 'flow-fill-business-step1',
      stepType: 'ui',
      title: '填写第一页必填字段',
      target: CREATE_URL,
      instruction: '选择商机来源=抖音，填写唯一联系人姓名和唯一手机号，选择性别=男，然后点击保存并继续。',
      expectedResult: '第一页通过校验并进入第二页关联产品意向信息。',
      extractVariable: 'contactName,contactPhone',
    },
    {
      stepUid: 'flow-fill-business-step2',
      stepType: 'ui',
      title: '按第二页最小必填填写企业和产品',
      target: CREATE_URL,
      instruction:
        '保留默认业务类型=企业业务(已设立)和商机权重=1；企业名称搜索并选择“中铁上海工程局集团有限公司(91310000566528939E)”；意向产品选择叶子节点“疑难工商注销”；然后点击保存并继续。',
      expectedResult: '第二页通过校验并进入第三页附件信息。',
      extractVariable: 'companyName,productName',
    },
    {
      stepUid: 'flow-submit-business-without-attachment',
      stepType: 'ui',
      title: '第三页空附件提交商机',
      target: CREATE_URL,
      instruction: '第三页不上传录音、不上传图片，直接点击提交。',
      expectedResult: '商机提交成功，第三页不会因空附件阻塞。',
      extractVariable: '',
    },
    {
      stepUid: 'flow-locate-created-business',
      stepType: 'extract',
      title: '商机列表按手机号定位新建记录',
      target: LIST_URL,
      instruction: '打开商机列表，用联系人手机号检索新建商机，读取商机ID、创建时间和签约成功当前计数。',
      expectedResult: '列表可定位到刚创建的商机，并能读到 businessId、createdAt 与 signedCountBefore。',
      extractVariable: 'businessId,createdAt,signedCountBefore',
    },
    {
      stepUid: 'flow-open-create-order-drawer',
      stepType: 'ui',
      title: '从目标行菜单打开生成订单 Drawer',
      target: LIST_URL,
      instruction: '在目标行末列三点菜单中点击“生成订单”，等待“确定订单信息”Drawer 出现。',
      expectedResult: 'Drawer 打开，且确定按钮可见。',
      extractVariable: '',
    },
    {
      stepUid: 'flow-confirm-create-order',
      stepType: 'api',
      title: '确认生成订单并等待 createOrder 成功',
      target: LIST_URL,
      instruction: '点击 Drawer 内确定，等待 POST /crmapi/business/createOrder 成功响应；若响应体包含 code，则校验 code=1。',
      expectedResult: 'createOrder 请求返回成功，Drawer 关闭，列表加载遮罩消失。',
      extractVariable: '',
    },
    {
      stepUid: 'flow-assert-signed-count',
      stepType: 'assert',
      title: '校验签约成功计数变化',
      target: LIST_URL,
      instruction: '回到商机列表读取签约成功计数，并与下单前记录对比。',
      expectedResult: '签约成功计数不下降，正常情况下会增加。',
      extractVariable: 'signedCountAfter',
    },
    {
      stepUid: 'flow-record-cleanup-info',
      stepType: 'cleanup',
      title: '记录人工清理信息',
      target: LIST_URL,
      instruction: '记录商机ID、联系人、手机号、创建时间和签约成功计数，不在自动化里执行删除，由业务侧手工清理。',
      expectedResult: '清理凭据完整，可追踪到本次测试数据。',
      extractVariable: '',
    },
  ],
};

const BUSINESS_BATCH_ADD_CONTACTS_FLOW_DEFINITION = {
  version: 1,
  entryUrl: LIST_URL,
  sharedVariables: ['businessId', 'contactPhone', 'feedbackText'],
  expectedOutcome:
    '在商机列表随机勾选一条包含联系人手机号的商机后，可批量加入通讯录；无论页面反馈是成功加入还是已存在，最终都应能在我的通讯录按手机号检索到该联系人。',
  cleanupNotes:
    '该业务流会真实写入 UAT 通讯录数据。记录联系人手机号、来源商机ID和执行时间；若需清理，请由业务侧按 UAT 规则手工删除通讯录联系人。',
  steps: [
    {
      stepUid: 'flow-open-business-list',
      stepType: 'ui',
      title: '进入商机列表页并等待页面稳定',
      target: LIST_URL,
      instruction: '登录后先等待首页初始化完成，再打开商机列表页，确认搜索框和“批量加入通讯录”按钮可见。',
      expectedResult: '页面稳定进入商机列表，可执行批量加入通讯录。',
      extractVariable: '',
    },
    {
      stepUid: 'flow-pick-business-row',
      stepType: 'extract',
      title: '随机选择一条带手机号的商机',
      target: LIST_URL,
      instruction: '若当前筛选结果为空，则切换到当前有数量的商机进展阶段；再从当前页前 10 条唯一手机号商机中随机选择一条，勾选对应复选框并记录 businessId、contactPhone。',
      expectedResult: '成功选中一条带联系人手机号的商机，且已拿到 businessId 与 contactPhone。',
      extractVariable: 'businessId,contactPhone',
    },
    {
      stepUid: 'flow-batch-add-contacts',
      stepType: 'ui',
      title: '执行批量加入通讯录',
      target: LIST_URL,
      instruction: '点击“批量加入通讯录”按钮，读取页面反馈文本，允许出现“已存在您的通讯录”或类似提示。',
      expectedResult: '页面给出通讯录相关反馈，不能仅依赖 toast 成功文案作为唯一通过条件。',
      extractVariable: 'feedbackText',
    },
    {
      stepUid: 'flow-open-mails-list',
      stepType: 'ui',
      title: '进入我的通讯录列表',
      target: MAILS_LIST_URL,
      instruction: '打开我的通讯录列表，确认检索框可见。',
      expectedResult: '成功进入我的通讯录列表页面。',
      extractVariable: '',
    },
    {
      stepUid: 'flow-search-contact-by-phone',
      stepType: 'assert',
      title: '按手机号检索并校验联系人可见',
      target: MAILS_LIST_URL,
      instruction: '使用 contactPhone 搜索通讯录，并校验结果中可以查到该手机号。',
      expectedResult: '我的通讯录列表中能检索到 contactPhone，对应联系人记录存在。',
      extractVariable: '',
    },
    {
      stepUid: 'flow-record-contact-cleanup-info',
      stepType: 'cleanup',
      title: '记录通讯录清理信息',
      target: MAILS_LIST_URL,
      instruction: '记录 contactPhone、businessId 和执行时间，不在自动化里做删除，由业务侧按 UAT 规则手工清理。',
      expectedResult: '通讯录测试数据具备可追踪的人工清理凭据。',
      extractVariable: '',
    },
  ],
};

const COMMON_STOP_WORDS = new Set([
  '点击',
  '按钮',
  '页面',
  '列表',
  '进入',
  '功能',
  '支持',
  '默认',
  '当前',
  '进行',
  '填写',
  '查看',
  '成功',
  '系统',
  '成员',
  '信息',
  '商机',
]);

function uid(prefix) {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function stableHash(value) {
  return createHash('sha1').update(value).digest('hex');
}

function must(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function parseArgs(argv) {
  const result = {
    projectUid: DEFAULT_PROJECT_UID,
    projectName: DEFAULT_PROJECT_NAME,
    documentName: DEFAULT_DOCUMENT_NAME,
    pdfPath: DEFAULT_PDF_PATH,
    textPath: DEFAULT_TEXT_PATH,
    skipCapabilities: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--project-uid' && next) {
      result.projectUid = next;
      index += 1;
    } else if (arg === '--project-name' && next) {
      result.projectName = next;
      index += 1;
    } else if (arg === '--document-name' && next) {
      result.documentName = next;
      index += 1;
    } else if (arg === '--pdf' && next) {
      result.pdfPath = path.resolve(next);
      index += 1;
    } else if (arg === '--text' && next) {
      result.textPath = path.resolve(next);
      index += 1;
    } else if (arg === '--skip-capabilities') {
      result.skipCapabilities = true;
    }
  }

  return result;
}

function normalizeKnowledgeText(raw) {
  return raw
    .replace(/\f/g, '\n')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function looksLikeManualHeading(line) {
  const value = line.trim();
  if (!value) return false;
  if (value.length > 34) return false;
  if (/^[0-9]+[、.)]/.test(value)) return false;
  if (/^[一二三四五六七八九十]+[、.)]/.test(value)) return false;
  if (/[：:，,。；;！？!?]/.test(value)) return false;
  if (/^(点击|输入|填写|选择|支持|默认|若|可|有|在|功能同)/.test(value)) return false;
  if (/^[A-Za-z0-9 ._-]+$/.test(value)) return false;

  return (
    /(登录|首页|管理|列表|公海|废弃池|新增商机|商机列表|客户列表|订单列表|服务列表|跟单台|操作台|续费台|通讯录|线索挖掘|地图检索|专管员列表|系统设置)$/.test(
      value
    ) || /^[\u4e00-\u9fa5A-Za-z0-9\s_-]{2,20}$/.test(value)
  );
}

function toNonEmptyLines(raw) {
  return normalizeKnowledgeText(raw)
    .split('\n')
    .map((line, index) => ({ line: line.trim(), lineNo: index + 1 }))
    .filter((item) => item.line);
}

function collectKeywords(heading, content) {
  const tokens = `${heading}\n${content}`.match(/[\u4e00-\u9fa5A-Za-z0-9_-]{2,16}/g) || [];
  const results = [];

  for (const token of tokens) {
    const value = token.trim();
    if (!value || COMMON_STOP_WORDS.has(value) || results.includes(value)) continue;
    results.push(value);
    if (results.length >= 12) break;
  }

  return results;
}

function buildKnowledgeChunksFromManual(raw) {
  const DEFAULT_HEADING = '概述';
  const MAX_CHUNK_LENGTH = 680;
  const lines = toNonEmptyLines(raw);
  if (lines.length === 0) return [];

  const chunks = [];
  let currentHeading = DEFAULT_HEADING;
  let currentParagraphLines = [];
  let currentParagraphs = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length === 0) return;
    const text = currentParagraphLines.map((item) => item.text).join('\n').trim();
    if (text) {
      currentParagraphs.push({
        text,
        start: currentParagraphLines[0]?.lineNo || 0,
        end: currentParagraphLines[currentParagraphLines.length - 1]?.lineNo || 0,
      });
    }
    currentParagraphLines = [];
  };

  const flushSection = () => {
    flushParagraph();
    if (currentParagraphs.length === 0) return;

    let currentText = '';
    let chunkStart = 0;
    let chunkEnd = 0;

    const flushChunk = () => {
      const content = currentText.trim();
      if (!content) return;
      chunks.push({
        heading: currentHeading,
        content,
        keywords: collectKeywords(currentHeading, content),
        sourceLineStart: chunkStart,
        sourceLineEnd: chunkEnd,
        tokenEstimate: Math.ceil((currentHeading.length + content.length) / 2),
      });
      currentText = '';
      chunkStart = 0;
      chunkEnd = 0;
    };

    for (const paragraph of currentParagraphs) {
      if (!currentText) {
        currentText = paragraph.text;
        chunkStart = paragraph.start;
        chunkEnd = paragraph.end;
        continue;
      }

      const next = `${currentText}\n${paragraph.text}`;
      if (next.length > MAX_CHUNK_LENGTH) {
        flushChunk();
        currentText = paragraph.text;
        chunkStart = paragraph.start;
        chunkEnd = paragraph.end;
        continue;
      }

      currentText = next;
      chunkEnd = paragraph.end;
    }

    flushChunk();
    currentParagraphs = [];
  };

  for (const item of lines) {
    if (looksLikeManualHeading(item.line)) {
      flushSection();
      currentHeading = item.line;
      continue;
    }

    currentParagraphLines.push({ text: item.line, lineNo: item.lineNo });

    if (item.line.endsWith('：') || item.line.endsWith(':')) {
      flushParagraph();
    }
  }

  flushSection();
  return chunks;
}

function buildDefaultCapabilities(documentUid) {
  return [
    {
      slug: 'auth.sms-password-login',
      name: '短信密码登录',
      description: '切换到短信验证码登录页签，在验证码输入框里填登录密码，点击“登 录”并等待首页初始化完成。',
      capabilityType: 'auth',
      entryUrl: LOGIN_URL,
      triggerPhrases: ['登录', '短信验证码登录', '短信密码登录', '进入系统', '进入首页'],
      preconditions: ['项目已配置登录账号和密码', '登录按钮文案可能为“登 录”且中间带空格'],
      steps: [
        '打开登录页并切换到短信验证码登录 tab',
        '在手机号输入框填写登录账号',
        '在验证码或“获取验证码”输入框填写登录密码',
        '点击“登 录”按钮',
        '等待首页或业务菜单可见，并额外等待 5 秒完成会话初始化',
      ],
      assertions: ['页面不再停留在 /user/login', '首页或业务菜单可见'],
      cleanupNotes: '',
      dependsOn: [],
      sortOrder: 10,
      sourceDocumentUid: documentUid,
      meta: {
        source: 'manual+validated-run',
        manualEvidence: ['登录章节', '短信验证码登录'],
      },
    },
    {
      slug: 'navigation.business-create-page',
      name: '进入创建商机页',
      description: '在已登录状态下直接打开创建商机页面，并确认第一页可填写。',
      capabilityType: 'navigation',
      entryUrl: CREATE_URL,
      triggerPhrases: ['创建商机', '新增商机', '商机录入', '打开创建商机页'],
      preconditions: ['已登录系统'],
      steps: [
        '直接打开创建商机页 URL',
        '等待商机来源字段和“保存并继续”按钮可见',
      ],
      assertions: ['页面显示商机来源字段', '页面显示保存并继续按钮'],
      cleanupNotes: '',
      dependsOn: ['auth.sms-password-login'],
      sortOrder: 20,
      sourceDocumentUid: documentUid,
      meta: {
        source: 'manual+validated-run',
        manualEvidence: ['商机管理', '新增商机'],
      },
    },
    {
      slug: 'navigation.business-list-page',
      name: '进入商机列表页',
      description: '在已登录状态下打开商机列表页，并确认可以按手机号或联系人检索。',
      capabilityType: 'navigation',
      entryUrl: LIST_URL,
      triggerPhrases: ['商机列表', '列表校验', '打开商机列表', '检索商机'],
      preconditions: ['已登录系统'],
      steps: [
        '直接打开商机列表页 URL',
        '等待搜索框“商机ID/联系人名称/电话/企业名称”可见',
      ],
      assertions: ['商机列表搜索框可见'],
      cleanupNotes: '',
      dependsOn: ['auth.sms-password-login'],
      sortOrder: 25,
      sourceDocumentUid: documentUid,
      meta: {
        source: 'manual+validated-run',
        manualEvidence: ['商机列表'],
      },
    },
    {
      slug: 'business.create-no-attachment',
      name: '创建商机并空附件提交',
      description: '使用第一页最小必填和第二页最小必填完成商机创建，第三页不上传附件直接提交。',
      capabilityType: 'action',
      entryUrl: CREATE_URL,
      triggerPhrases: ['创建商机', '新增商机', '无附件提交', '商机创建主链路', '创建商机最小必填'],
      preconditions: ['已进入创建商机页', '联系人姓名和手机号需使用唯一值，避免检索混淆'],
      steps: [
        '第一页填写商机来源=抖音、唯一联系人姓名、唯一手机号，并选择性别=男',
        '点击保存并继续进入第二页',
        '第二页保留默认业务类型=企业业务(已设立)和商机权重=1',
        '企业名称搜索并选择“中铁上海工程局集团有限公司(91310000566528939E)”',
        '意向产品选择叶子节点“疑难工商注销”',
        '点击保存并继续进入第三页附件信息',
        '第三页不上传录音、不上传图片，直接点击提交',
      ],
      assertions: [
        '第一页真实必填为商机来源、商机联系人、商机联系方式、性别',
        '第二页真实阻塞项为企业名称和意向产品',
        '第三页空附件可直接提交成功',
      ],
      cleanupNotes: '记录商机ID、联系人、手机号和创建时间，由业务侧按 UAT 规则手工清理。',
      dependsOn: ['navigation.business-create-page'],
      sortOrder: 30,
      sourceDocumentUid: documentUid,
      meta: {
        source: 'validated-plan',
        planUid: PLAN_UID,
        planVersion: PLAN_VERSION,
        executionUid: EXECUTION_UID,
        evidenceDoc: 'docs/business-create-e2e-cases-2026-03-10.md',
        verifiedBusinessId: '520082',
      },
    },
    {
      slug: 'business.list-search-by-phone',
      name: '商机列表按手机号检索并校验',
      description: '在商机列表中按联系人手机号检索新建商机，并校验关键字段已真实落库。',
      capabilityType: 'query',
      entryUrl: LIST_URL,
      triggerPhrases: ['列表校验', '按手机号检索', '商机列表', '落库校验', '查询新建商机'],
      preconditions: ['已完成创建商机提交', '已持有联系人手机号'],
      steps: [
        '打开商机列表页',
        '在搜索框输入联系人手机号并执行搜索',
        '读取商机ID、企业名称、联系人名称、联系电话、商机来源、意向产品、商机进展',
      ],
      assertions: [
        '列表包含联系人手机号和联系人名称',
        '商机来源为抖音',
        '意向产品为疑难工商注销',
        '商机进展为新入库',
      ],
      cleanupNotes: '保留商机ID和创建时间，便于后续人工清理。',
      dependsOn: ['navigation.business-list-page'],
      sortOrder: 40,
      sourceDocumentUid: documentUid,
      meta: {
        source: 'validated-plan',
        planUid: PLAN_UID,
        planVersion: PLAN_VERSION,
        executionUid: EXECUTION_UID,
      },
    },
    {
      slug: 'composite.business-list-batch-add-contacts',
      name: '商机列表批量加入通讯录并校验结果',
      description:
        '在商机列表随机勾选一条带联系人手机号的商机；若当前筛选结果为空，则先切换到有数量的商机进展阶段，再点击“批量加入通讯录”，随后进入我的通讯录列表按手机号检索确认联系人可见。',
      capabilityType: 'composite',
      entryUrl: LIST_URL,
      triggerPhrases: ['批量加入通讯录', '加入通讯录', '我的通讯录', '通讯录校验', '商机列表加入通讯录'],
      preconditions: ['已登录系统', '当前账号至少有一个商机进展阶段存在一条包含联系人手机号的商机记录'],
      steps: [
        '进入商机列表页并等待搜索框与“批量加入通讯录”按钮可见',
        '若当前筛选结果为空，则切换到当前有数量的商机进展阶段，再从当前页前 10 条唯一手机号商机中随机选择一条并勾选',
        '点击“批量加入通讯录”按钮并读取页面反馈',
        '进入我的通讯录列表，使用目标手机号执行搜索',
        '以通讯录列表中能查到该手机号作为最终成功判定',
      ],
      assertions: [
        BUSINESS_BATCH_ADD_CONTACTS_FLOW_DEFINITION.expectedOutcome,
        '页面反馈可能是成功加入、已存在通讯录或未成功加入通讯录，不能只依赖 toast 判定通过',
        '最终必须在我的通讯录列表中检索到目标手机号',
      ],
      cleanupNotes: BUSINESS_BATCH_ADD_CONTACTS_FLOW_DEFINITION.cleanupNotes,
      dependsOn: ['auth.sms-password-login'],
      sortOrder: 45,
      sourceDocumentUid: documentUid,
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        planUid: BATCH_ADD_CONTACTS_PLAN_UID,
        planVersion: BATCH_ADD_CONTACTS_PLAN_VERSION,
        executionUid: BATCH_ADD_CONTACTS_EXECUTION_UID,
        verifiedExecutionUid: BATCH_ADD_CONTACTS_EXECUTION_UID,
        verifiedAt: BATCH_ADD_CONTACTS_VERIFIED_AT,
        lastVerificationExecutionUid: BATCH_ADD_CONTACTS_EXECUTION_UID,
        lastVerificationStatus: 'passed',
        lastVerificationAt: BATCH_ADD_CONTACTS_VERIFIED_AT,
        sourceTaskMode: 'scenario',
        flowDefinition: BUSINESS_BATCH_ADD_CONTACTS_FLOW_DEFINITION,
        supersedes: ['navigation.business-list-page', 'action.business-businesslist.zcuv6y'],
      },
    },
    {
      slug: 'composite.business-create-to-order',
      name: '创建商机并生成订单',
      description:
        '创建商机后在商机列表通过目标行三点菜单生成订单，以 createOrder 成功、Drawer 关闭和签约成功计数校验作为主断言。',
      capabilityType: 'composite',
      entryUrl: CREATE_URL,
      triggerPhrases: ['创建商机并生成订单', '商机转订单', '商机生成订单', '创建商机后生成订单', '生成订单'],
      preconditions: ['已登录系统', '联系人姓名和手机号需使用唯一值，避免与历史商机混淆'],
      steps: [
        '进入创建商机页并确认第一页可填写',
        '第一页填写商机来源=抖音、唯一联系人姓名、唯一手机号、性别=男',
        '第二页保留默认业务类型和商机权重，只补齐企业名称与叶子意向产品',
        '第三页不上传附件直接提交商机',
        '在商机列表按手机号定位目标行并读取商机ID、创建时间、签约成功计数',
        '从目标行三点菜单点击生成订单，等待确定订单信息 Drawer',
        '点击 Drawer 内确定并等待 POST /crmapi/business/createOrder 成功',
        '回到商机列表确认签约成功计数不下降并记录清理信息',
      ],
      assertions: [
        BUSINESS_CREATE_ORDER_FLOW_DEFINITION.expectedOutcome,
        'POST /crmapi/business/createOrder 返回 200；若返回体包含 code，则 code=1',
        '确定订单信息 Drawer 关闭后再结束成功断言',
        '生成订单成功后不再强依赖原商机行继续可见',
      ],
      cleanupNotes: BUSINESS_CREATE_ORDER_FLOW_DEFINITION.cleanupNotes,
      dependsOn: ['auth.sms-password-login'],
      sortOrder: 35,
      sourceDocumentUid: documentUid,
      meta: {
        source: 'validated-plan',
        verificationStatus: 'execution_verified',
        planUid: CREATE_ORDER_PLAN_UID,
        planVersion: CREATE_ORDER_PLAN_VERSION,
        executionUid: CREATE_ORDER_EXECUTION_UID,
        verifiedExecutionUid: CREATE_ORDER_EXECUTION_UID,
        verifiedAt: CREATE_ORDER_VERIFIED_AT,
        lastVerificationExecutionUid: CREATE_ORDER_EXECUTION_UID,
        lastVerificationStatus: 'passed',
        lastVerificationAt: CREATE_ORDER_VERIFIED_AT,
        sourceTaskMode: 'scenario',
        flowDefinition: BUSINESS_CREATE_ORDER_FLOW_DEFINITION,
        supersedes: [
          'navigation.business-create-page',
          'navigation.business-list-page',
          'business.create-no-attachment',
          'business.list-search-by-phone',
        ],
      },
    },
  ];
}

async function ensureTextExtracted(pdfPath, textPath) {
  await fs.mkdir(path.dirname(textPath), { recursive: true });
  await execFile('pdftotext', ['-layout', '-nopgbrk', pdfPath, textPath]);
  return fs.readFile(textPath, 'utf8');
}

async function getConnection() {
  return mysql.createConnection({
    host: must('DB_HOST'),
    user: must('DB_USER'),
    password: must('DB_PASSWORD'),
    database: must('DB_NAME'),
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });
}

async function findProject(connection, projectUid, projectName) {
  const [rows] = await connection.query(
    `SELECT project_uid, name
     FROM test_projects
     WHERE project_uid = ? OR name = ?
     ORDER BY project_uid = ? DESC
     LIMIT 1`,
    [projectUid, projectName, projectUid]
  );

  return rows[0] || null;
}

async function upsertKnowledgeDocument(connection, { projectUid, documentName, pdfPath, textPath, text, chunks }) {
  const sourceHash = stableHash(JSON.stringify({ pdfPath, textPath, text }));
  const [existingRows] = await connection.query(
    `SELECT document_uid
     FROM project_knowledge_documents
     WHERE project_uid = ? AND name = ?
     LIMIT 1`,
    [projectUid, documentName]
  );
  const existing = existingRows[0];
  const documentUid = existing?.document_uid || uid('kdoc');

  await connection.beginTransaction();
  try {
    if (existing) {
      await connection.execute(
        `UPDATE project_knowledge_documents
         SET source_type = 'manual',
             source_path = ?,
             source_hash = ?,
             status = 'active',
             meta = ?
         WHERE document_uid = ?`,
        [
          pdfPath,
          sourceHash,
          JSON.stringify({
            importedFrom: pdfPath,
            extractedTextPath: textPath,
            chunkCount: chunks.length,
            importedAt: new Date().toISOString(),
          }),
          documentUid,
        ]
      );
      await connection.execute(`DELETE FROM project_knowledge_chunks WHERE document_uid = ?`, [documentUid]);
    } else {
      await connection.execute(
        `INSERT INTO project_knowledge_documents
          (document_uid, project_uid, name, source_type, source_path, source_hash, status, meta)
         VALUES (?, ?, ?, 'manual', ?, ?, 'active', ?)`,
        [
          documentUid,
          projectUid,
          documentName,
          pdfPath,
          sourceHash,
          JSON.stringify({
            importedFrom: pdfPath,
            extractedTextPath: textPath,
            chunkCount: chunks.length,
            importedAt: new Date().toISOString(),
          }),
        ]
      );
    }

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      await connection.execute(
        `INSERT INTO project_knowledge_chunks
          (chunk_uid, document_uid, project_uid, heading, content, keywords_json, source_line_start, source_line_end, token_estimate, sort_order, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          uid('kch'),
          documentUid,
          projectUid,
          chunk.heading,
          chunk.content,
          chunk.keywords.length > 0 ? JSON.stringify(chunk.keywords) : null,
          Number(chunk.sourceLineStart || 0),
          Number(chunk.sourceLineEnd || 0),
          Number(chunk.tokenEstimate || Math.ceil(chunk.content.length / 2)),
          index + 1,
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }

  return {
    documentUid,
    chunkCount: chunks.length,
    sourceHash,
  };
}

async function upsertCapability(connection, projectUid, capability) {
  const [existingRows] = await connection.query(
    `SELECT capability_uid
     FROM project_capabilities
     WHERE project_uid = ? AND slug = ?
     LIMIT 1`,
    [projectUid, capability.slug]
  );
  const existing = existingRows[0];
  const capabilityUid = existing?.capability_uid || uid('cap');

  if (existing) {
    await connection.execute(
      `UPDATE project_capabilities
       SET name = ?,
           description = ?,
           capability_type = ?,
           entry_url = ?,
           trigger_phrases_json = ?,
           preconditions_json = ?,
           steps_json = ?,
           assertions_json = ?,
           cleanup_notes = ?,
           depends_on_json = ?,
           sort_order = ?,
           status = 'active',
           source_document_uid = ?,
           meta = ?
       WHERE capability_uid = ?`,
      [
        capability.name,
        capability.description,
        capability.capabilityType,
        capability.entryUrl || null,
        capability.triggerPhrases.length ? JSON.stringify(capability.triggerPhrases) : null,
        capability.preconditions.length ? JSON.stringify(capability.preconditions) : null,
        capability.steps.length ? JSON.stringify(capability.steps) : null,
        capability.assertions.length ? JSON.stringify(capability.assertions) : null,
        capability.cleanupNotes || null,
        capability.dependsOn.length ? JSON.stringify(capability.dependsOn) : null,
        capability.sortOrder,
        capability.sourceDocumentUid || null,
        capability.meta === undefined ? null : JSON.stringify(capability.meta),
        capabilityUid,
      ]
    );
  } else {
    await connection.execute(
      `INSERT INTO project_capabilities
        (capability_uid, project_uid, slug, name, description, capability_type, entry_url, trigger_phrases_json, preconditions_json, steps_json, assertions_json, cleanup_notes, depends_on_json, sort_order, status, source_document_uid, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        capabilityUid,
        projectUid,
        capability.slug,
        capability.name,
        capability.description,
        capability.capabilityType,
        capability.entryUrl || null,
        capability.triggerPhrases.length ? JSON.stringify(capability.triggerPhrases) : null,
        capability.preconditions.length ? JSON.stringify(capability.preconditions) : null,
        capability.steps.length ? JSON.stringify(capability.steps) : null,
        capability.assertions.length ? JSON.stringify(capability.assertions) : null,
        capability.cleanupNotes || null,
        capability.dependsOn.length ? JSON.stringify(capability.dependsOn) : null,
        capability.sortOrder,
        capability.sourceDocumentUid || null,
        capability.meta === undefined ? null : JSON.stringify(capability.meta),
      ]
    );
  }

  return capabilityUid;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pdfPath = path.resolve(options.pdfPath);
  const textPath = path.resolve(options.textPath);
  const text = await ensureTextExtracted(pdfPath, textPath);
  const chunks = buildKnowledgeChunksFromManual(text);

  if (chunks.length === 0) {
    throw new Error('Manual extraction produced zero knowledge chunks');
  }

  const connection = await getConnection();
  try {
    const project = await findProject(connection, options.projectUid, options.projectName);
    if (!project) {
      throw new Error(`Project not found: ${options.projectUid} / ${options.projectName}`);
    }

    const knowledgeResult = await upsertKnowledgeDocument(connection, {
      projectUid: String(project.project_uid),
      documentName: options.documentName,
      pdfPath,
      textPath,
      text,
      chunks,
    });

    const capabilitySlugs = [];
    if (!options.skipCapabilities) {
      const capabilities = buildDefaultCapabilities(knowledgeResult.documentUid);
      for (const capability of capabilities) {
        await upsertCapability(connection, String(project.project_uid), capability);
        capabilitySlugs.push(capability.slug);
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          projectUid: String(project.project_uid),
          projectName: String(project.name),
          documentUid: knowledgeResult.documentUid,
          documentName: options.documentName,
          chunkCount: knowledgeResult.chunkCount,
          sourceHash: knowledgeResult.sourceHash,
          capabilityCount: capabilitySlugs.length,
          capabilitySlugs,
          textPath,
        },
        null,
        2
      )
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
