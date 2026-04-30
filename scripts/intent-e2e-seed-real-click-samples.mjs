import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3666';
const DEFAULT_PROJECT_UID = 'proj_default';
const DEFAULT_MODULE_UID = 'mod_1773303139537_c84d8476';
const DEFAULT_ACTOR_USER_UID = 'usr_default_owner';
const DEFAULT_WAIT_TIMEOUT_MS = 12 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_SAMPLES = 4;
const DEFAULT_PROFILE = 'mixed';
const DEFAULT_REPEAT = 1;
export const CURRENT_SYSTEM_SCOPE = 'yikaiye_uat';
export const CURRENT_SYSTEM_ALLOWED_HOSTS = ['uat-service.yikaiye.com'];
const ACTIVE_DRAFT_LOOKUP_LIMIT = 200;
const SUPPORTED_PROFILES = new Set(['mixed', 'stable', 'with_image']);

function parseArgs(argv) {
  const result = {
    baseUrl: DEFAULT_BASE_URL,
    projectUid: DEFAULT_PROJECT_UID,
    moduleUid: DEFAULT_MODULE_UID,
    actorUserUid: DEFAULT_ACTOR_USER_UID,
    waitTimeoutMs: DEFAULT_WAIT_TIMEOUT_MS,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    maxSamples: DEFAULT_MAX_SAMPLES,
    profile: DEFAULT_PROFILE,
    repeat: DEFAULT_REPEAT,
    maxSamplesExplicit: false,
    reuseExistingDrafts: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--base-url' && next) {
      result.baseUrl = next.trim();
      index += 1;
    } else if (arg === '--project-uid' && next) {
      result.projectUid = next.trim();
      index += 1;
    } else if (arg === '--module-uid' && next) {
      result.moduleUid = next.trim();
      index += 1;
    } else if (arg === '--actor-user-uid' && next) {
      result.actorUserUid = next.trim();
      index += 1;
    } else if (arg === '--wait-timeout-ms' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.waitTimeoutMs = Math.floor(parsed);
      }
      index += 1;
    } else if (arg === '--poll-interval-ms' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.pollIntervalMs = Math.floor(parsed);
      }
      index += 1;
    } else if (arg === '--max-samples' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.maxSamples = Math.floor(parsed);
        result.maxSamplesExplicit = true;
      }
      index += 1;
    } else if (arg === '--profile' && next) {
      const normalized = next.trim().toLowerCase();
      const canonicalProfile =
        normalized === 'with-image' || normalized === 'image' ? 'with_image' : normalized;
      if (SUPPORTED_PROFILES.has(canonicalProfile)) {
        result.profile = canonicalProfile;
      }
      index += 1;
    } else if (arg === '--repeat' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.repeat = Math.floor(parsed);
      }
      index += 1;
    } else if (arg === '--reuse-existing-drafts') {
      result.reuseExistingDrafts = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }

  return result;
}

function printHelp() {
  console.log(`intent-e2e real_click seeding

Usage:
  node --env-file-if-exists=.env scripts/intent-e2e-seed-real-click-samples.mjs [options]

Options:
  --base-url <url>           Default: ${DEFAULT_BASE_URL}
  --project-uid <uid>        Default: ${DEFAULT_PROJECT_UID}
  --module-uid <uid>         Default: ${DEFAULT_MODULE_UID}
  --actor-user-uid <uid>     Default: ${DEFAULT_ACTOR_USER_UID}
  --wait-timeout-ms <ms>     Default: ${DEFAULT_WAIT_TIMEOUT_MS}
  --poll-interval-ms <ms>    Default: ${DEFAULT_POLL_INTERVAL_MS}
  --max-samples <n>          Default: ${DEFAULT_MAX_SAMPLES}
  --profile <mixed|stable|with_image>
                             Default: ${DEFAULT_PROFILE}
  --repeat <n>               Default: ${DEFAULT_REPEAT}
  --reuse-existing-drafts    Reuse semantic-duplicate active drafts and still launch runs
  --help                     Show help

Built-in sample profiles are restricted to the current system scope:
  ${CURRENT_SYSTEM_ALLOWED_HOSTS.join(', ')}
`);
}

function toIsoFileStamp(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const BUSINESS_LIST_BATCH_ADD_CONTACTS_VISUAL_BASE64 = [
  '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',
].join('');

function buildBusinessListBatchAddContactsVisualAttachment() {
  return {
    name: 'business-list-batch-add-contacts-reference.png',
    purpose:
      'AI生成 with_image seed：商机列表、批量加入通讯录、手机号搜索、我的通讯录最终校验等 OCR 锚点。',
    dataUrl: `data:image/png;base64,${BUSINESS_LIST_BATCH_ADD_CONTACTS_VISUAL_BASE64}`,
  };
}

function sanitizeCorpusRequest(request) {
  const cloned = cloneJson(request);
  delete cloned.requestId;
  delete cloned.expectedPriorityScenarioFamily;
  delete cloned.intentDraftUid;
  return cloned;
}

async function readJsonFile(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return JSON.parse(await fs.readFile(absolutePath, 'utf8'));
}

function buildManualBatchAddContactsRequest() {
  return {
    input:
      '参考知识目录《管帮手PC端操作手册》，在商机列表随机勾选一条带联系人手机号的商机，执行“批量加入通讯录”，然后进入我的通讯录按手机号搜索并验证该联系人可见。若当前筛选结果为空，先切换到有数量的商机进展阶段。最终通过标准不是 toast，而是通讯录列表里能查到目标手机号。',
    targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
    cicdProfile: 'manual',
    prefilledScenarioCard: {
      version: 1,
      title: '商机列表批量加入通讯录并校验结果',
      taskMode: 'scenario',
      targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
      featureDescription:
        '手册驱动真实 AI 测试：在商机列表随机勾选一条带联系人手机号的商机；若当前筛选结果为空，则先切换到当前有数量的商机进展阶段，再点击“批量加入通讯录”，随后进入我的通讯录列表按手机号检索确认联系人可见。',
      flowDefinition: {
        version: 1,
        entryUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
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
            target: 'https://uat-service.yikaiye.com/#/business/businesslist',
            instruction:
              '登录后先等待首页初始化完成，再打开商机列表页，确认搜索框和“批量加入通讯录”按钮可见。',
            expectedResult: '页面稳定进入商机列表，可执行批量加入通讯录。',
            extractVariable: '',
          },
          {
            stepUid: 'flow-pick-business-row',
            stepType: 'extract',
            title: '随机选择一条带手机号的商机',
            target: 'https://uat-service.yikaiye.com/#/business/businesslist',
            instruction:
              '若当前筛选结果为空，则切换到当前有数量的商机进展阶段；再从当前页前 10 条唯一手机号商机中随机选择一条，勾选对应复选框并记录 businessId、contactPhone。',
            expectedResult: '成功选中一条带联系人手机号的商机，且已拿到 businessId 与 contactPhone。',
            extractVariable: 'businessId,contactPhone',
          },
          {
            stepUid: 'flow-batch-add-contacts',
            stepType: 'ui',
            title: '执行批量加入通讯录',
            target: 'https://uat-service.yikaiye.com/#/business/businesslist',
            instruction: '点击“批量加入通讯录”按钮；若出现“已存在您的通讯录”或类似提示则记录，若没有可见 toast 也不能在此失败，必须继续进入通讯录做最终验收。',
            expectedResult: '批量加入通讯录动作已触发；toast 只是可选反馈，不是阻断条件。',
            extractVariable: 'feedbackText',
          },
          {
            stepUid: 'flow-open-mails-list',
            stepType: 'ui',
            title: '进入我的通讯录列表',
            target: 'https://uat-service.yikaiye.com/#/mails/mailslist',
            instruction: '打开我的通讯录列表，确认检索框可见。',
            expectedResult: '成功进入我的通讯录列表页面。',
            extractVariable: '',
          },
          {
            stepUid: 'flow-search-contact-by-phone',
            stepType: 'assert',
            title: '按手机号检索并校验联系人可见',
            target: 'https://uat-service.yikaiye.com/#/mails/mailslist',
            instruction: '使用 contactPhone 搜索通讯录，并校验结果中可以查到该手机号。',
            expectedResult: '我的通讯录列表中能检索到 contactPhone，对应联系人记录存在。',
            extractVariable: '',
          },
          {
            stepUid: 'flow-record-contact-cleanup-info',
            stepType: 'cleanup',
            title: '记录通讯录清理信息',
            target: 'https://uat-service.yikaiye.com/#/mails/mailslist',
            instruction: '记录 contactPhone、businessId 和执行时间，不在自动化里做删除，由业务侧按 UAT 规则手工清理。',
            expectedResult: '通讯录测试数据具备可追踪的人工清理凭据。',
            extractVariable: '',
          },
        ],
      },
      successCriteria: [
        '必须先定位目标行并勾选 checkbox，再点击顶部“批量加入通讯录”按钮。',
        '页面反馈可能是成功加入、已存在或没有可见 toast，不能等待 toast 作为阻断条件。',
        '最终必须在我的通讯录列表中检索到目标手机号。',
      ],
      visualAnchors: ['批量加入通讯录', '商机进展', '我的通讯录', '手机号', '搜索框'],
      notes: [
        '前置条件：已登录系统。',
        '优先复用手册和项目知识里的稳定步骤，不要臆造行内“加入通讯录”按钮。',
        '若当前筛选结果为空，可先切换到有数量的商机进展阶段。',
        '点击批量加入通讯录后不要强制等待 toast；直接推进到我的通讯录按同一手机号检索。',
      ],
    },
    llmConfig: {
      selfHealRetries: 0,
      maxPlanSteps: 6,
    },
    runControl: {
      priority: 'normal',
      timeoutMs: 720000,
      retryLimit: 0,
    },
  };
}

function buildManualBatchAddContactsWithImageRequest(baseRequest) {
  const request = cloneJson(baseRequest);
  request.input = [
    request.input,
    '同时参考附件截图中的“商机列表”“批量加入通讯录”“手机号”“我的通讯录”等可见文字锚点；图片只用于辅助路由和 OCR 摘要，最终仍以真实页面和通讯录列表断言为准。点击批量加入通讯录后不要等待 toast 作为必经断言；没有可见反馈时也必须继续进入我的通讯录按同一手机号检索验收。',
  ].join(' ');
  request.attachments = [buildBusinessListBatchAddContactsVisualAttachment()];
  request.llmConfig = {
    ...(request.llmConfig || {}),
    visionEnabled: true,
  };

  if (request.prefilledScenarioCard && typeof request.prefilledScenarioCard === 'object') {
    request.prefilledScenarioCard = {
      ...request.prefilledScenarioCard,
      title: '图片辅助商机批量加入通讯录并校验结果',
      featureDescription: [
        request.prefilledScenarioCard.featureDescription || '',
        '附件提供商机列表与通讯录校验相关可见文字锚点，供 AI生成 阶段抽取 OCR 摘要并稳定识别页面。',
      ]
        .filter(Boolean)
        .join(' '),
      visualAnchors: [
        ...(Array.isArray(request.prefilledScenarioCard.visualAnchors)
          ? request.prefilledScenarioCard.visualAnchors
          : []),
        '附件截图：商机列表',
        '附件截图：批量加入通讯录',
        '附件截图：手机号搜索',
        '附件截图：我的通讯录',
      ],
      notes: [
        ...(Array.isArray(request.prefilledScenarioCard.notes) ? request.prefilledScenarioCard.notes : []),
        'with_image seed：附件仅用于 AI生成 的视觉锚点和 OCR 路由验证，执行阶段必须回到真实 UAT 页面校验。',
      ],
    };
  }

  return request;
}

function buildRepeatedSamples(baseSamples, repeat) {
  const expanded = [];
  for (let round = 1; round <= repeat; round += 1) {
    for (const sample of baseSamples) {
      const roundSuffix = repeat > 1 ? ` [Round ${round}]` : '';
      expanded.push({
        ...sample,
        sampleId: repeat > 1 ? `${sample.sampleId}-r${round}` : sample.sampleId,
        draftTaskName: `${sample.draftTaskName}${roundSuffix}`,
      });
    }
  }
  return expanded;
}

function normalizeUrlCandidate(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  try {
    return new URL(trimmed).toString();
  } catch {
    return '';
  }
}

function normalizeSeedText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function collectSeedSampleScopeUrls(sample) {
  const urls = new Set();
  const request = sample?.request || {};
  const scenarioCard = request.prefilledScenarioCard || {};
  const flowDefinition = scenarioCard.flowDefinition || {};

  const maybeAdd = (value) => {
    const normalized = normalizeUrlCandidate(value);
    if (normalized) urls.add(normalized);
  };

  maybeAdd(request.targetUrl);
  maybeAdd(scenarioCard.targetUrl);
  maybeAdd(flowDefinition.entryUrl);

  const steps = Array.isArray(flowDefinition.steps) ? flowDefinition.steps : [];
  for (const step of steps) {
    maybeAdd(step?.target);
  }

  return [...urls];
}

export function buildSeedDraftSemanticSignature(input) {
  const moduleUid = normalizeSeedText(input?.moduleUid);
  const requestInput = normalizeSeedText(input?.input || input?.requestInput);
  const targetUrl = normalizeUrlCandidate(input?.targetUrl || input?.targetUrlHint).toLowerCase();

  return [moduleUid, targetUrl, requestInput].join(' | ');
}

function normalizeSeedSignatureAlias(alias, fallbackTargetUrl) {
  if (typeof alias === 'string') {
    return {
      input: alias,
      targetUrl: fallbackTargetUrl,
    };
  }
  if (!alias || typeof alias !== 'object' || Array.isArray(alias)) {
    return null;
  }
  return {
    input:
      typeof alias.input === 'string'
        ? alias.input
        : typeof alias.requestInput === 'string'
          ? alias.requestInput
          : '',
    targetUrl:
      typeof alias.targetUrl === 'string'
        ? alias.targetUrl
        : typeof alias.targetUrlHint === 'string'
          ? alias.targetUrlHint
          : fallbackTargetUrl,
  };
}

export function buildSeedDraftSemanticSignatures(input) {
  const signatures = new Set();
  const moduleUid = input?.moduleUid;
  const primaryTargetUrl = input?.targetUrl || input?.targetUrlHint || '';
  const addSignature = (candidate) => {
    const requestInput = typeof candidate?.input === 'string' ? candidate.input.trim() : '';
    const targetUrl = normalizeUrlCandidate(candidate?.targetUrl || candidate?.targetUrlHint || '');
    if (!requestInput || !targetUrl) return;
    signatures.add(
      buildSeedDraftSemanticSignature({
        moduleUid,
        input: requestInput,
        targetUrl,
      })
    );
  };

  addSignature({
    input: input?.input || input?.requestInput || '',
    targetUrl: primaryTargetUrl,
  });

  const aliases = Array.isArray(input?.signatureAliases) ? input.signatureAliases : [];
  for (const alias of aliases) {
    const normalized = normalizeSeedSignatureAlias(alias, primaryTargetUrl);
    if (!normalized) continue;
    addSignature(normalized);
  }

  return [...signatures];
}

export function validateCurrentSystemSeedSamples(samples, options = {}) {
  const allowedHosts = Array.isArray(options.allowedHosts) && options.allowedHosts.length > 0
    ? options.allowedHosts.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : CURRENT_SYSTEM_ALLOWED_HOSTS;

  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('seed sample plan is empty');
  }

  for (const sample of samples) {
    const sampleId = typeof sample?.sampleId === 'string' && sample.sampleId.trim() ? sample.sampleId.trim() : 'unknown_sample';
    const urls = collectSeedSampleScopeUrls(sample);
    if (urls.length === 0) {
      throw new Error(`seed sample ${sampleId} is missing an in-scope targetUrl`);
    }
    for (const url of urls) {
      const hostname = new URL(url).hostname.toLowerCase();
      if (!allowedHosts.includes(hostname)) {
        throw new Error(
          `seed sample ${sampleId} points to out-of-scope host ${hostname}; allowed hosts: ${allowedHosts.join(', ')}`
        );
      }
    }
  }

  return {
    scope: CURRENT_SYSTEM_SCOPE,
    allowedHosts,
    sampleCount: samples.length,
  };
}

export async function buildSamplePlan(input) {
  const businessCreateListCorpus = await readJsonFile(
    'artifacts/intent-e2e-family-evidence/proj_default.business-create-list-verify.request-corpus.json'
  );
  const listSearchCorpus = await readJsonFile(
    'artifacts/intent-e2e-family-evidence/proj_default.list-search-detail.request-corpus.json'
  );
  const businessToOrderCorpus = await readJsonFile(
    'artifacts/intent-e2e-family-evidence/proj_default.business-to-order.request-corpus.json'
  );

  const businessCreateListRequest = sanitizeCorpusRequest(businessCreateListCorpus.requests[0]);
  const listSearchRequest = sanitizeCorpusRequest(listSearchCorpus.requests[0]);
  const businessToOrderRequest = sanitizeCorpusRequest(businessToOrderCorpus.requests[0]);
  const manualBatchAddContactsRequest = buildManualBatchAddContactsRequest();
  const manualBatchAddContactsWithImageRequest =
    buildManualBatchAddContactsWithImageRequest(manualBatchAddContactsRequest);

  const businessCreateListSample = {
    sampleId: 'business-create-list-verify',
    label: '新建商机后列表验收',
    draftTaskName: '[AI测试样本] 新建商机后列表验收',
    request: cloneJson(businessCreateListRequest),
    signatureAliases: [
      '登录后台后在商机列表页新建一条真实商机并保存，再切到“我创建的”Tab，等待列表刷新，严格校验该记录真实出现在列表里且“商机进展”为“新入库”。',
    ],
  };
  const businessToOrderSample = {
    sampleId: 'business-to-order',
    label: '商机转订单主链路',
    draftTaskName: '[AI测试样本] 商机转订单主链路',
    request: cloneJson(businessToOrderRequest),
    signatureAliases: [
      '登录后台后在商机列表创建商机并生成订单：先填写最小必填商机信息并保存，再用唯一手机号定位目标商机，从目标行点“生成订单”，在“确定订单信息”Drawer 确认，并以 createOrder 成功响应和 Drawer 关闭作为主断言。',
      '登录后台后在商机列表创建真实商机并生成订单：先填写最小必填商机信息保存，再用唯一手机号定位目标商机，从目标行菜单点击“生成订单”，在“确定订单信息”Drawer 确认，并以 createOrder 成功响应和 Drawer 关闭作为主断言。',
    ],
  };
  const manualBatchAddContactsSample = {
    sampleId: 'manual-batch-add-contacts',
    label: '手册批量加入通讯录验收',
    draftTaskName: '[AI测试样本] 手册批量加入通讯录验收',
    request: manualBatchAddContactsRequest,
    signatureAliases: [
      '参考《管帮手PC端操作手册》，进入商机列表随机勾选一条带手机号的商机，点击“批量加入通讯录”，再到我的通讯录按该手机号搜索确认联系人可见；如果当前结果为空，先切到有数量的商机进展阶段。',
      '在商机列表选择一条有手机号的商机执行“批量加入通讯录”，允许页面反馈“已存在您的通讯录”，但最终必须进入我的通讯录按手机号检索并验证联系人可见；若当前结果为空，可先切换到有数量的商机进展阶段。',
      '用知识目录《管帮手PC端操作手册》的稳定步骤，在商机列表选择一条有手机号的商机批量加入通讯录，允许页面反馈“已存在您的通讯录”，但最终必须在我的通讯录按手机号检索到联系人。',
    ],
  };
  const manualBatchAddContactsWithImageSample = {
    sampleId: 'manual-batch-add-contacts-with-image',
    label: '图片辅助手册批量加入通讯录验收',
    draftTaskName: '[AI测试样本] 图片辅助手册批量加入通讯录验收',
    request: manualBatchAddContactsWithImageRequest,
    signatureAliases: [
      '参考附件截图和《管帮手PC端操作手册》，在商机列表选择一条有手机号的商机，点击“批量加入通讯录”，再进入我的通讯录用手机号搜索并验证联系人可见。',
      '用带图片的 AI 生成入口识别“商机列表”“批量加入通讯录”“手机号”“我的通讯录”等 OCR 锚点，完成商机批量加入通讯录并按手机号检索验证。',
    ],
  };
  const listSearchDetailSample = {
    sampleId: 'order-list-search-detail',
    label: '订单列表详情校验',
    draftTaskName: '[AI测试样本] 订单列表详情校验',
    request: cloneJson(listSearchRequest),
    signatureAliases: [
      '在订单列表里先把入账状态切到“待申请”，从真实结果行提取唯一订单号，再只用这个订单号重新搜索并进入详情，最终校验联系人、手机号和入账状态。',
    ],
  };

  const stableSamples = [
    manualBatchAddContactsSample,
    businessToOrderSample,
    businessCreateListSample,
  ];

  const mixedSamples = [...stableSamples, listSearchDetailSample];
  const withImageSamples = [manualBatchAddContactsWithImageSample];

  const selectedBaseSamples =
    input.profile === 'stable'
      ? stableSamples
      : input.profile === 'with_image'
        ? withImageSamples
        : mixedSamples;
  const expandedSamples = buildRepeatedSamples(selectedBaseSamples, input.repeat);
  const limit = input.maxSamplesExplicit ? Math.max(1, input.maxSamples) : expandedSamples.length;

  return expandedSamples.slice(0, limit);
}

function createHeaders(actorUserUid) {
  return {
    'content-type': 'application/json',
    'x-e2e-actor-uid': actorUserUid,
  };
}

async function requestJson(url, options, label) {
  const response = await fetch(url, options);
  const rawText = await response.text();
  let body = null;

  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = { rawText };
    }
  }

  if (!response.ok) {
    const errorText =
      typeof body?.error === 'string'
        ? body.error
        : typeof body?.rawText === 'string'
          ? body.rawText
          : `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${errorText}`);
  }

  return body;
}

async function listActiveIntentDrafts(input) {
  const query = new URLSearchParams({
    limit: String(ACTIVE_DRAFT_LOOKUP_LIMIT),
    status: 'active',
  });
  const payload = await requestJson(
    `${input.baseUrl}/api/projects/${encodeURIComponent(input.projectUid)}/intent-drafts?${query.toString()}`,
    {
      headers: createHeaders(input.actorUserUid),
    },
    `list active intent drafts for ${input.projectUid}`
  );
  return Array.isArray(payload?.items) ? payload.items : [];
}

async function createDraft(input) {
  const url = `${input.baseUrl}/api/projects/${encodeURIComponent(input.projectUid)}/intent-drafts`;
  const options = {
    method: 'POST',
    headers: createHeaders(input.actorUserUid),
    body: JSON.stringify({
      moduleUid: input.moduleUid,
      taskName: input.taskName,
      input: input.request.input,
      targetUrl: input.request.targetUrl,
      attachments: input.request.attachments || [],
      llmConfig: input.request.llmConfig || undefined,
    }),
  };

  try {
    return await requestJson(url, options, `create draft ${input.taskName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/LLM 请求超时/.test(message)) {
      throw error;
    }
    console.log(`[real-click-seed] retry draft after timeout task=${input.taskName}`);
    await sleep(1500);
    return requestJson(url, options, `create draft ${input.taskName}`);
  }
}

async function requestLaunchDecision(input) {
  return requestJson(
    `${input.baseUrl}/api/intent-e2e/launch-decision`,
    {
      method: 'POST',
      headers: createHeaders(input.actorUserUid),
      body: JSON.stringify(input.request),
    },
    `launch decision ${input.taskName}`
  );
}

async function startRun(input) {
  return requestJson(
    `${input.baseUrl}/api/intent-e2e/runs`,
    {
      method: 'POST',
      headers: createHeaders(input.actorUserUid),
      body: JSON.stringify(input.request),
    },
    `start run ${input.taskName}`
  );
}

function isTerminalStatus(status) {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

async function pollRunUntilTerminal(input) {
  const startedAt = Date.now();
  const deadline = startedAt + input.waitTimeoutMs;
  let lastRun = null;

  while (Date.now() < deadline) {
    const payload = await requestJson(
      `${input.baseUrl}/api/intent-e2e/runs/${encodeURIComponent(input.runId)}`,
      {
        headers: createHeaders(input.actorUserUid),
      },
      `load run ${input.runId}`
    );
    const run = payload?.run || null;
    if (run) {
      lastRun = run;
      if (isTerminalStatus(run.status)) {
        return {
          timedOut: false,
          run,
        };
      }
    }
    await sleep(input.pollIntervalMs);
  }

  return {
    timedOut: true,
    run: lastRun,
  };
}

async function writeSeedReport(input) {
  const reportDir = path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', input.projectUid);
  const timestamp = toIsoFileStamp(new Date(input.generatedAt));
  const baseName = `intent-e2e.real-click-seed-report.${timestamp}`;
  const jsonPath = path.join(reportDir, `${baseName}.json`);
  const mdPath = path.join(reportDir, `${baseName}.md`);
  const latestJsonPath = path.join(reportDir, 'intent-e2e.real-click-seed-report.latest.json');
  const latestMdPath = path.join(reportDir, 'intent-e2e.real-click-seed-report.latest.md');

  const lines = [
    '# Intent E2E Real Click Seed Report',
    '',
    `- generatedAt: ${input.generatedAt}`,
    `- projectUid: ${input.projectUid}`,
    `- moduleUid: ${input.moduleUid}`,
    `- sampleCount: ${input.summary.sampleCount}`,
    `- draftsCreated: ${input.summary.draftsCreated}`,
    `- autoRunStarted: ${input.summary.autoRunStarted}`,
    `- terminalRuns: ${input.summary.terminalRuns}`,
    `- passedRuns: ${input.summary.passedRuns}`,
    `- failedRuns: ${input.summary.failedRuns}`,
    `- blockedRuns: ${input.summary.blockedRuns}`,
    `- skippedDuplicates: ${input.summary.skippedDuplicates}`,
    `- draftsReused: ${input.summary.draftsReused}`,
    `- timedOutRuns: ${input.summary.timedOutRuns}`,
    `- withImageSamples: ${input.summary.withImageSamples}`,
    '',
    '| sampleId | attachments | reused | draftUid | launchDecision | runId | status | family | error |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...input.results.map((item) =>
      [
        item.sampleId,
        item.attachmentCount || 0,
        item.reusedExistingDraft ? 'yes' : 'no',
        item.intentDraftUid || '-',
        item.launchDecision || '-',
        item.runId || '-',
        item.status || '-',
        item.priorityScenarioFamily || '-',
        (item.errorMessage || '').replace(/\|/g, '\\|') || '-',
      ].join(' | ')
    ),
  ];

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(input, null, 2), 'utf8');
  await fs.writeFile(mdPath, `${lines.join('\n')}\n`, 'utf8');
  await fs.writeFile(latestJsonPath, JSON.stringify(input, null, 2), 'utf8');
  await fs.writeFile(latestMdPath, `${lines.join('\n')}\n`, 'utf8');

  return {
    jsonPath: path.relative(process.cwd(), jsonPath),
    mdPath: path.relative(process.cwd(), mdPath),
    latestJsonPath: path.relative(process.cwd(), latestJsonPath),
    latestMdPath: path.relative(process.cwd(), latestMdPath),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const samplePlan = await buildSamplePlan(options);
  const scopeGuard = validateCurrentSystemSeedSamples(samplePlan);
  const activeDrafts = await listActiveIntentDrafts({
    baseUrl: options.baseUrl,
    projectUid: options.projectUid,
    actorUserUid: options.actorUserUid,
  });
  const existingActiveDraftsBySignature = new Map();
  for (const item of activeDrafts) {
    const signature = buildSeedDraftSemanticSignature({
      moduleUid: item?.moduleUid,
      input: item?.input,
      targetUrl: item?.targetUrl || item?.targetUrlHint,
    });
    if (!signature || existingActiveDraftsBySignature.has(signature)) continue;
    existingActiveDraftsBySignature.set(signature, {
      intentDraftUid: item?.intentDraftUid || '',
      title: item?.title || '',
      updatedAt: item?.updatedAt || '',
    });
  }
  const plannedSignatures = new Set();
  const results = [];

  console.log(
    `[real-click-seed] start project=${options.projectUid} module=${options.moduleUid} samples=${samplePlan.length} profile=${options.profile} repeat=${options.repeat} baseUrl=${options.baseUrl} scope=${scopeGuard.scope} hosts=${scopeGuard.allowedHosts.join(',')}`
  );

  for (const sample of samplePlan) {
    const request = {
      ...cloneJson(sample.request),
      projectUid: options.projectUid,
      moduleUid: options.moduleUid,
    };
    delete request.intentDraftUid;
    const semanticSignatures = buildSeedDraftSemanticSignatures({
      moduleUid: options.moduleUid,
      input: request.input,
      targetUrl: request.targetUrl,
      signatureAliases: sample.signatureAliases,
    });
    const semanticSignature = semanticSignatures[0] || '';

    const result = {
      sampleId: sample.sampleId,
      label: sample.label,
      taskName: sample.draftTaskName,
      input: request.input,
      targetUrl: request.targetUrl || '',
      intentDraftUid: '',
      draftStatus: '',
      reusedExistingDraft: false,
      launchDecision: '',
      launchReason: '',
      runId: '',
      status: '',
      priorityScenarioFamily: '',
      attachmentCount: Array.isArray(request.attachments) ? request.attachments.length : 0,
      timedOut: false,
      errorMessage: '',
      createdAt: '',
      endedAt: '',
      semanticSignature,
    };
    results.push(result);

    const existing =
      semanticSignatures.map((signature) => existingActiveDraftsBySignature.get(signature)).find(Boolean) || null;
    if (existing) {
      result.intentDraftUid = existing.intentDraftUid || '';
      result.draftStatus = 'reused_active';
      result.reusedExistingDraft = true;
      result.createdAt = existing.updatedAt || '';
      if (!options.reuseExistingDrafts) {
        result.status = 'skipped_duplicate';
        result.errorMessage = `已存在相同语义草稿: ${existing.title || existing.intentDraftUid || 'unknown draft'}`;
        console.log(
          `[real-click-seed] sample=${sample.sampleId} skip-duplicate existingDraft=${existing.intentDraftUid || '-'}`
        );
        continue;
      }
      console.log(
        `[real-click-seed] sample=${sample.sampleId} reuse-existing-draft draft=${existing.intentDraftUid || '-'}`
      );
    } else {
      if (semanticSignatures.some((signature) => plannedSignatures.has(signature))) {
        result.status = 'skipped_duplicate';
        result.errorMessage = '当前批次内已存在相同语义样本';
        console.log(`[real-click-seed] sample=${sample.sampleId} skip-duplicate in-batch`);
        continue;
      }
      for (const signature of semanticSignatures) {
        plannedSignatures.add(signature);
      }

      console.log(`[real-click-seed] sample=${sample.sampleId} create-draft`);
      try {
        const draftResponse = await createDraft({
          baseUrl: options.baseUrl,
          projectUid: options.projectUid,
          moduleUid: options.moduleUid,
          actorUserUid: options.actorUserUid,
          taskName: sample.draftTaskName,
          request,
        });
        result.intentDraftUid = draftResponse?.item?.intentDraftUid || '';
        result.draftStatus = draftResponse?.item?.status || '';
        result.createdAt = draftResponse?.item?.createdAt || '';
        for (const signature of semanticSignatures) {
          if (!existingActiveDraftsBySignature.has(signature)) {
            existingActiveDraftsBySignature.set(signature, {
              intentDraftUid: result.intentDraftUid,
              title: sample.draftTaskName,
              updatedAt: result.createdAt,
            });
          }
        }
      } catch (error) {
        result.errorMessage = error instanceof Error ? error.message : String(error || '');
        console.log(`[real-click-seed] sample=${sample.sampleId} draft-error=${result.errorMessage}`);
        continue;
      }
    }

    console.log(`[real-click-seed] sample=${sample.sampleId} launch-decision`);
    try {
      const decisionResponse = await requestLaunchDecision({
        baseUrl: options.baseUrl,
        actorUserUid: options.actorUserUid,
        taskName: sample.draftTaskName,
        request,
      });
      result.launchDecision = decisionResponse?.decision || '';
      result.launchReason = Array.isArray(decisionResponse?.reasons)
        ? decisionResponse.reasons.filter(Boolean).join(',')
        : decisionResponse?.reason || '';
    } catch (error) {
      result.errorMessage = error instanceof Error ? error.message : String(error || '');
      console.log(`[real-click-seed] sample=${sample.sampleId} launch-error=${result.errorMessage}`);
      continue;
    }

    if (result.launchDecision !== 'auto_run') {
      result.status = 'blocked';
      console.log(
        `[real-click-seed] sample=${sample.sampleId} blocked decision=${result.launchDecision || '-'} reason=${result.launchReason || '-'}`
      );
      continue;
    }

    console.log(`[real-click-seed] sample=${sample.sampleId} start-run`);
    try {
      const runResponse = await startRun({
        baseUrl: options.baseUrl,
        actorUserUid: options.actorUserUid,
        taskName: sample.draftTaskName,
        request,
      });
      result.runId = runResponse?.runId || '';
      result.status = runResponse?.run?.status || '';
      result.priorityScenarioFamily = runResponse?.run?.result?.priorityScenarioFamily || '';
    } catch (error) {
      result.errorMessage = error instanceof Error ? error.message : String(error || '');
      console.log(`[real-click-seed] sample=${sample.sampleId} run-start-error=${result.errorMessage}`);
      continue;
    }

    console.log(`[real-click-seed] sample=${sample.sampleId} poll runId=${result.runId}`);
    try {
      const terminal = await pollRunUntilTerminal({
        baseUrl: options.baseUrl,
        actorUserUid: options.actorUserUid,
        runId: result.runId,
        waitTimeoutMs: options.waitTimeoutMs,
        pollIntervalMs: options.pollIntervalMs,
      });
      result.timedOut = terminal.timedOut;
      result.status = terminal.run?.status || (terminal.timedOut ? 'timed_out' : result.status);
      result.priorityScenarioFamily =
        terminal.run?.result?.priorityScenarioFamily ||
        terminal.run?.priorityScenarioFamily ||
        result.priorityScenarioFamily;
      result.endedAt = terminal.run?.endedAt || terminal.run?.updatedAt || '';
      if (terminal.timedOut) {
        result.errorMessage = '等待 run 终态超时';
      } else if (terminal.run?.error) {
        result.errorMessage = String(terminal.run.error);
      }
    } catch (error) {
      result.errorMessage = error instanceof Error ? error.message : String(error || '');
      console.log(`[real-click-seed] sample=${sample.sampleId} poll-error=${result.errorMessage}`);
      continue;
    }

    console.log(
      `[real-click-seed] sample=${sample.sampleId} done draft=${result.intentDraftUid || '-'} run=${result.runId || '-'} status=${result.status || '-'} family=${result.priorityScenarioFamily || '-'}`
    );
  }

  const summary = {
    sampleCount: results.length,
    draftsCreated: results.filter((item) => item.intentDraftUid && !item.reusedExistingDraft).length,
    autoRunStarted: results.filter((item) => item.runId).length,
    terminalRuns: results.filter((item) => isTerminalStatus(item.status)).length,
    passedRuns: results.filter((item) => item.status === 'passed').length,
    failedRuns: results.filter((item) => item.status === 'failed').length,
    blockedRuns: results.filter((item) => item.status === 'blocked').length,
    skippedDuplicates: results.filter((item) => item.status === 'skipped_duplicate').length,
    draftsReused: results.filter((item) => item.reusedExistingDraft).length,
    timedOutRuns: results.filter((item) => item.timedOut).length,
    withImageSamples: results.filter((item) => item.attachmentCount > 0).length,
  };

  const generatedAt = new Date().toISOString();
  const report = {
    version: 1,
    generatedAt,
    projectUid: options.projectUid,
    moduleUid: options.moduleUid,
    actorUserUid: options.actorUserUid,
    baseUrl: options.baseUrl,
    profile: options.profile,
    repeat: options.repeat,
    scopeGuard,
    summary,
    results,
  };
  const reportPaths = await writeSeedReport(report);

  console.log(
    `[real-click-seed] summary drafts=${summary.draftsCreated}/${summary.sampleCount} autoRun=${summary.autoRunStarted} terminal=${summary.terminalRuns} passed=${summary.passedRuns} failed=${summary.failedRuns} blocked=${summary.blockedRuns} skippedDuplicates=${summary.skippedDuplicates} timedOut=${summary.timedOutRuns}`
  );
  console.log(`[real-click-seed] report.json=${reportPaths.jsonPath}`);
  console.log(`[real-click-seed] report.md=${reportPaths.mdPath}`);
  console.log(`[real-click-seed] report.latest.json=${reportPaths.latestJsonPath}`);
  console.log(`[real-click-seed] report.latest.md=${reportPaths.latestMdPath}`);
}

const isDirectRun =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`[real-click-seed] ${error instanceof Error ? error.message : '未知错误'}`);
    process.exitCode = 1;
  });
}
