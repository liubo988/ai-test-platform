import { callLLMStructured } from '@/lib/llm-client';
import { getLLMRuntimeConfig, type LLMRuntimeOverrides } from '@/lib/llm/provider-config';
import { looksLikeIntentStableIdentifierVariable } from '@/lib/intent-shared-variable-utils';
import { buildFlowSummary, normalizeFlowDefinition, normalizeTaskMode, type FlowDefinition, type TaskMode } from '@/lib/task-flow';
import { buildIntentActionDSL } from '@/lib/intent-action-dsl';
import type { GenerateTestContext } from '@/lib/test-generator';

export interface ScenarioAttachment {
  name?: string;
  dataUrl: string;
  purpose?: string;
}

export interface ScenarioCard {
  version: 1;
  title: string;
  taskMode: TaskMode;
  targetUrl: string;
  featureDescription: string;
  flowDefinition: FlowDefinition;
  successCriteria: string[];
  visualAnchors: string[];
  notes: string[];
}

export interface ScenarioCardInput {
  input: string;
  targetUrlHint?: string;
  attachments?: ScenarioAttachment[];
}

export interface ScenarioCardGenerationOutput {
  card: ScenarioCard;
  llmMeta: {
    provider: string;
    model: string;
    visionEnabled: boolean;
    attachmentCount: number;
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    )
  );
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveScenarioUrlCandidate(candidate: string, baseUrl = ''): string {
  const raw = toString(candidate);
  if (!raw) return '';

  try {
    if (baseUrl) return new URL(raw, baseUrl).toString();
    return new URL(raw).toString();
  } catch {
    return raw;
  }
}

function looksLikeWebUrl(value: string): boolean {
  return /^https?:\/\//i.test(toString(value));
}

function resolveScenarioEntryUrl(card: ScenarioCard): string {
  const primaryTargetUrl = toString(card.targetUrl) || toString(card.flowDefinition.entryUrl);
  const flowDefinition = normalizeFlowDefinition(card.flowDefinition, primaryTargetUrl);

  if (card.taskMode !== 'scenario') {
    return primaryTargetUrl;
  }

  const firstNavigableStepTarget =
    flowDefinition.steps
      .filter((step) => step.stepType !== 'api')
      .map((step) => resolveScenarioUrlCandidate(step.target, primaryTargetUrl))
      .find((candidate) => looksLikeWebUrl(candidate)) || '';

  const candidates = [
    resolveScenarioUrlCandidate(flowDefinition.entryUrl, primaryTargetUrl),
    firstNavigableStepTarget,
    resolveScenarioUrlCandidate(primaryTargetUrl, primaryTargetUrl),
  ];

  return candidates.find((candidate) => looksLikeWebUrl(candidate)) || candidates.find(Boolean) || '';
}

function looksLikeBusinessCreateScenarioCard(card: ScenarioCard): boolean {
  const haystack = [
    card.title,
    card.targetUrl,
    card.featureDescription,
    ...card.successCriteria,
    ...card.visualAnchors,
    ...card.notes,
    card.flowDefinition.entryUrl,
    card.flowDefinition.expectedOutcome,
    ...card.flowDefinition.steps.flatMap((step) => [step.title, step.target, step.instruction, step.expectedResult]),
  ]
    .join('\n')
    .toLowerCase();

  return (
    haystack.includes('创建商机') ||
    haystack.includes('新增商机') ||
    haystack.includes('createbusiness') ||
    haystack.includes('/business/createbusiness')
  );
}

function looksLikeSyntheticBusinessNameVariable(value: string): boolean {
  const normalized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '')
    .toLowerCase();

  return (
    normalized === 'createdbusinessname' ||
    normalized === 'businessname' ||
    normalized === 'opportunityname' ||
    (normalized.endsWith('name') && /(business|opportunity|record)/.test(normalized))
  );
}

function isSuspectBusinessNameExtractionStep(step: FlowDefinition['steps'][number]): boolean {
  if (step.stepType !== 'extract') return false;

  const haystack = [step.title, step.target, step.instruction, step.expectedResult, step.extractVariable].join('\n');
  return (
    looksLikeSyntheticBusinessNameVariable(step.extractVariable) ||
    /商机名称输入框|createdBusinessName|opportunityName|businessName|商机名称已填写|后续检索关键字|唯一商机名称|运行时生成唯一值/i.test(
      haystack
    )
  );
}

function cardExplicitlyRequiresBusinessName(card: ScenarioCard): boolean {
  const haystack = [card.title, card.featureDescription].join('\n');
  return /(商机名称|business\s*name|businessname)/i.test(haystack);
}

function cardExplicitlyRequiresBusinessStatus(card: ScenarioCard): boolean {
  const signals = [
    card.title,
    card.featureDescription,
    ...card.successCriteria,
    card.flowDefinition.expectedOutcome,
    ...card.notes,
  ]
    .map((item) => toString(item))
    .filter(Boolean);

  return signals.some((signal) => {
    if (
      /(页面|界面|当前页|url|路由|hash)/i.test(signal) &&
      /(进入|返回|回到|跳转|落在|停留|保存后|提交后|成功后|可识别)/i.test(signal) &&
      /(详情|列表|弹层|抽屉|modal|drawer|页面)/i.test(signal) &&
      /(状态|status)/i.test(signal)
    ) {
      return false;
    }

    if (/(新入库|商机进展|进展状态|状态列|列表状态|详情状态|displayStatus)/i.test(signal)) {
      return true;
    }

    return /(状态|status)/i.test(signal) && /(校验|验证|确认|断言|检查|核对)/i.test(signal);
  });
}

function appendUniqueClause(value: string, clause: string): string {
  const base = toString(value);
  const addition = toString(clause);
  if (!addition) return base;
  if (!base) return addition;
  if (base.includes(addition)) return base;
  return /[。；;]$/.test(base) ? `${base}${addition}` : `${base}；${addition}`;
}

function deriveBusinessListUrlFromCreateBusinessUrl(value: string): string {
  const normalized = resolveScenarioUrlCandidate(value);
  if (!normalized || !/\/business\/createbusiness(?=[#/?]|$)|#\/business\/createbusiness(?=$|[/?&])/i.test(normalized)) {
    return '';
  }

  return normalized.replace(/\/business\/createbusiness(?=[#/?]|$)|#\/business\/createbusiness(?=$|[/?&])/i, (match) =>
    match.startsWith('#') ? '#/business/businesslist' : '/business/businesslist'
  );
}

function buildScenarioStepHaystack(step: FlowDefinition['steps'][number]): string {
  return [step.title, step.target, step.instruction, step.expectedResult, step.extractVariable].join('\n');
}

function isBusinessListEntryStep(step: FlowDefinition['steps'][number]): boolean {
  const haystack = buildScenarioStepHaystack(step);
  return /(商机列表|businesslist)/i.test(haystack) && /(新建商机|创建商机|createbusiness)/i.test(haystack);
}

function cardExplicitlyStartsFromBusinessList(card: ScenarioCard): boolean {
  const haystack = [
    card.title,
    card.featureDescription,
    ...card.successCriteria,
    ...card.visualAnchors,
    ...card.notes,
    ...card.flowDefinition.steps.flatMap((step) => [step.title, step.target, step.instruction, step.expectedResult]),
  ].join('\n');

  return (
    /(商机列表|businesslist)/i.test(haystack) &&
    /(新建商机按钮|点击[“"'「『]?\s*新建商机|从商机列表点击|从商机列表进入|点击.*新建商机按钮|发起[“"'「『]?\s*新建商机)/i.test(
      haystack
    )
  );
}

function needsBusinessListUrlTarget(step: FlowDefinition['steps'][number]): boolean {
  if (step.stepType === 'api') return false;
  const haystack = buildScenarioStepHaystack(step);
  if (!/(商机列表|businesslist|我创建的|我跟进的|归属|范围)/i.test(haystack)) {
    return false;
  }

  return !looksLikeWebUrl(step.target) || /createbusiness/i.test(step.target);
}

function isBusinessCreateEntryStep(step: FlowDefinition['steps'][number]): boolean {
  if (step.stepType !== 'ui') return false;
  const haystack = buildScenarioStepHaystack(step);
  return /(进入|打开|前往|跳转|进入到)/i.test(haystack) && /(新建商机|创建商机|createbusiness)/i.test(haystack);
}

function stepDirectlyOpensBusinessCreatePage(step: FlowDefinition['steps'][number]): boolean {
  if (step.stepType !== 'ui') return false;
  if (isBusinessListEntryStep(step)) return false;

  const haystack = buildScenarioStepHaystack(step);
  return (
    /(createbusiness|#\/business\/createbusiness|新建商机页|新建商机页面|创建商机页|创建商机页面)/i.test(haystack) &&
    /(打开\s*url|直接打开|进入|打开|跳转|前往)/i.test(haystack)
  );
}

function rewriteDirectBusinessCreateEntryStep(
  step: FlowDefinition['steps'][number],
  businessListUrl: string
): FlowDefinition['steps'][number] {
  return {
    ...step,
    title: '进入商机列表并打开新建页',
    target: businessListUrl,
    instruction: '打开商机列表页面，等待列表加载完成后点击“新建商机”按钮。',
    expectedResult: '跳转到新建商机页面，URL 包含 /business/createbusiness，页面出现创建表单主标题或首个表单锚点。',
    extractVariable: '',
  };
}

function stepExpectedResultMistakenlyUsesSubmitReadiness(step: FlowDefinition['steps'][number]): boolean {
  if (!isBusinessCreateEntryStep(step)) return false;
  const expected = toString(step.expectedResult);
  return /保\s*存|提\s*交|确\s*定/i.test(expected) && /(可见|可点击|可操作|可用|visible|clickable|enabled|存在)/i.test(expected);
}

function sanitizeBusinessCreateEntryExpectedResult(step: FlowDefinition['steps'][number]): string {
  if (!stepExpectedResultMistakenlyUsesSubmitReadiness(step)) {
    return step.expectedResult;
  }

  return '成功打开新建商机页面，出现商机联系人信息或其他创建表单区块锚点。';
}

function sanitizeBusinessCreateSuccessCriterion(criterion: string, explicitBusinessNameRequired: boolean): string {
  let value = toString(criterion);
  if (!value) return value;
  if (!/(进入|打开|前往|跳转|进入到)/i.test(value) || !/(新建商机|创建商机|createbusiness)/i.test(value)) {
    if (
      !explicitBusinessNameRequired &&
      /(创建时提取的商机名称|商机名称为匹配|按商机名称|名称与创建时一致|唯一标识字段|唯一字段|唯一标识|按.*匹配|以.*匹配)/i.test(value) &&
      /(列表|记录|检索|匹配|我创建的)/i.test(value)
    ) {
      return '“我创建的”列表中出现本次新建商机记录';
    }
    return value;
  }
  const mentionsSubmitReadiness =
    /保\s*存|提\s*交|确\s*定/i.test(value) &&
    /(可见|可点击|可操作|可用|visible|clickable|enabled|存在)/i.test(value);
  if (!mentionsSubmitReadiness) {
    return value;
  }

  return '成功进入新建商机页面，页面出现商机联系人信息或其他创建表单锚点';
}

function sanitizeBusinessCreateNotes(notes: string[], explicitBusinessNameRequired: boolean): string[] {
  return normalizeStringArray([
    ...notes.filter((note) => {
      if (explicitBusinessNameRequired) return true;
      const businessNameNoteLike = /(商机名称|商机名|机会名|business\s*name|businessname|opportunityname)/i.test(note);
      return !(
        /(创建时提取商机名称作为后续列表检索关键字|商机名.*运行时生成唯一值|固定企业名\/商机名|使用运行时生成唯一值并在后续列表检索)/i.test(
          note
        ) ||
        /(商机名称建议在填写后提取为变量|商机名称建议.*(?:运行时)?动态生成并提取为变量|按商机名称(?:精确)?校验|名称与创建时一致|创建时提取的商机名称|唯一字段|唯一标识字段|唯一标识|新建记录匹配建议优先使用创建时可提取的唯一字段|可唯一识别的字段.*后续列表断言|不预设固定商机名称|不编造固定商机名称|运行时生成并提取.*(?:列表|记录).*(?:校验|断言|检索)|使用运行时生成并提取\/?复用)/i.test(
          note
        ) ||
        businessNameNoteLike
      );
    }),
    '不要预设页面一定存在“商机名称输入框”；若页面未明确暴露该字段，优先围绕真实可见的联系人/手机号填写，并在最终提交后优先从响应提取 businessId。',
  ]);
}

function isBusinessCreateListVerificationStep(step: FlowDefinition['steps'][number]): boolean {
  const haystack = buildScenarioStepHaystack(step);
  const verificationText = [step.title, step.instruction, step.expectedResult].join('\n');
  const listSurfaceLike = /(列表|表格|我创建的|businesslist)/i.test(haystack);
  const recordLookupLike = /(检索|搜索|查找|定位|匹配|记录|businessId|手机号|电话|联系人|新入库)/i.test(haystack);
  const formFillLike =
    /(填写|输入|选择|上传)/i.test([step.title, step.instruction].join('\n')) &&
    /(表单|字段|必填|区块|附件|输入框|下拉|单选|多选)/i.test(haystack);
  const submitLike = /(保\s*存|提\s*交|确\s*定)/i.test([step.title, step.instruction].join('\n'));
  const formValidationLike =
    /(校验通过|无必填报错|必填报错)/i.test(verificationText) && /(必填|字段|表单|区块)/i.test(verificationText);
  const verificationLike =
    step.stepType === 'assert' ||
    (/(校验|验证|验收|确认|断言|检查)/i.test(verificationText) && !formValidationLike);

  if (!listSurfaceLike) return false;
  if (step.stepType !== 'assert' && (formFillLike || submitLike)) return false;
  return verificationLike && recordLookupLike;
}

function rewriteBusinessCreateListVerificationStep(
  step: FlowDefinition['steps'][number],
  explicitBusinessStatusRequired: boolean
): FlowDefinition['steps'][number] {
  if (!isBusinessCreateListVerificationStep(step)) {
    return step;
  }

  return {
    ...step,
    instruction: explicitBusinessStatusRequired
      ? '优先使用 businessId 在列表中检索并定位对应记录；若未提取到 businessId，则使用真实填写的联系人/手机号定位对应记录，再单独校验状态为“新入库”。'
      : '优先使用 businessId 在列表中检索并定位对应记录；若未提取到 businessId，则使用真实填写的联系人/手机号定位对应记录。',
    expectedResult: explicitBusinessStatusRequired
      ? '“我创建的”列表中存在本次新建商机记录，且状态为“新入库”。'
      : '“我创建的”列表中存在本次新建商机记录。',
  };
}

function stabilizeBusinessCreateCard(card: ScenarioCard): ScenarioCard {
  if (!looksLikeBusinessCreateScenarioCard(card)) return card;

  const flowDefinition = normalizeFlowDefinition(card.flowDefinition, card.targetUrl || card.flowDefinition.entryUrl);
  const businessListUrl = deriveBusinessListUrlFromCreateBusinessUrl(card.targetUrl || flowDefinition.entryUrl);
  const firstUiStepIndex = flowDefinition.steps.findIndex((step) => step.stepType === 'ui');
  const firstUiStep = firstUiStepIndex >= 0 ? flowDefinition.steps[firstUiStepIndex] : null;
  const shouldForceBusinessListEntry = Boolean(
    businessListUrl &&
      ((firstUiStep && isBusinessListEntryStep(firstUiStep)) || cardExplicitlyStartsFromBusinessList(card))
  );
  const explicitBusinessNameRequired = cardExplicitlyRequiresBusinessName(card);
  const explicitBusinessStatusRequired = cardExplicitlyRequiresBusinessStatus(card);
  const entryNormalizedSteps = flowDefinition.steps.map((step, index) => {
    if (
      shouldForceBusinessListEntry &&
      businessListUrl &&
      index === firstUiStepIndex &&
      stepDirectlyOpensBusinessCreatePage(step)
    ) {
      return rewriteDirectBusinessCreateEntryStep(step, businessListUrl);
    }

    return shouldForceBusinessListEntry && businessListUrl && needsBusinessListUrlTarget(step)
      ? {
          ...step,
          target: businessListUrl,
        }
      : step;
  });

  const suspectVariables = normalizeStringArray([
    ...flowDefinition.sharedVariables.filter((variable) => looksLikeSyntheticBusinessNameVariable(variable)),
    ...entryNormalizedSteps.filter((step) => isSuspectBusinessNameExtractionStep(step)).map((step) => step.extractVariable),
  ]);
  const suspectVariablePattern =
    suspectVariables.length > 0 ? new RegExp(`\\b(?:${suspectVariables.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`) : null;
  const hasSuspectNameExtraction = suspectVariables.length > 0;
  const sanitizedSuccessCriteria = normalizeStringArray(
    card.successCriteria.map((criterion) => sanitizeBusinessCreateSuccessCriterion(criterion, explicitBusinessNameRequired))
  );
  const sanitizedEntrySteps = entryNormalizedSteps.map((step) =>
    stepExpectedResultMistakenlyUsesSubmitReadiness(step)
      ? {
          ...step,
          expectedResult: sanitizeBusinessCreateEntryExpectedResult(step),
        }
      : step
  );
  const sanitizedVerificationSteps = explicitBusinessNameRequired
    ? sanitizedEntrySteps
    : sanitizedEntrySteps.map((step) => rewriteBusinessCreateListVerificationStep(step, explicitBusinessStatusRequired));

  if (explicitBusinessNameRequired || !hasSuspectNameExtraction) {
    return {
      ...card,
      successCriteria: sanitizedSuccessCriteria,
      notes: sanitizeBusinessCreateNotes(card.notes, explicitBusinessNameRequired),
      flowDefinition: {
        ...flowDefinition,
        entryUrl: shouldForceBusinessListEntry && businessListUrl ? businessListUrl : flowDefinition.entryUrl,
        steps: sanitizedVerificationSteps,
      },
    };
  }

  let steps = sanitizedVerificationSteps
    .filter((step) => !isSuspectBusinessNameExtractionStep(step))
    .map((step) => {
      const haystack = [step.title, step.target, step.instruction, step.expectedResult, step.extractVariable].join('\n');
      const referencesSuspectVariable = suspectVariablePattern ? suspectVariablePattern.test(haystack) : false;
      if (!referencesSuspectVariable && !/(商机名称|商机名|机会名)/i.test(haystack)) {
        return step;
      }

      if (/(填写|使用|唯一值|生成)/i.test(haystack)) {
        return {
          ...step,
          instruction: '在前3个表单区块内填写页面真实可见的必填字段；不要臆造额外名称字段；附件区块不进行上传或填写。',
          expectedResult: step.expectedResult || '前3个区块必填项校验通过，页面无必填报错。',
        };
      }

      return step;
    });

  let sharedVariables = normalizeStringArray(
    flowDefinition.sharedVariables.filter((variable) => !looksLikeSyntheticBusinessNameVariable(variable))
  );

  const hasStableIdentifier =
    sharedVariables.some((variable) => looksLikeIntentStableIdentifierVariable(variable)) ||
    steps.some((step) => looksLikeIntentStableIdentifierVariable(step.extractVariable));

  if (!hasStableIdentifier) {
    sharedVariables = normalizeStringArray([...sharedVariables, 'businessId']);

    const submitStepIndex = steps.findIndex((step) =>
      /(保存|提交)/i.test([step.title, step.target, step.instruction, step.expectedResult].join('\n'))
    );
    if (submitStepIndex >= 0) {
      const submitStep = steps[submitStepIndex];
      steps = steps.map((step, index) =>
        index !== submitStepIndex
          ? step
          : {
              ...submitStep,
              instruction: appendUniqueClause(
                submitStep.instruction,
                '提交成功后优先从响应提取 businessId；若接口未返回，再继续用真实填写的联系人/手机号回查列表。'
              ),
              expectedResult: appendUniqueClause(
                submitStep.expectedResult,
                '优先从提交响应提取 businessId 供后续列表回查。'
              ),
              extractVariable: looksLikeIntentStableIdentifierVariable(submitStep.extractVariable)
                ? submitStep.extractVariable
                : 'businessId',
            }
      );
    }
  }

  return {
    ...card,
    successCriteria: sanitizedSuccessCriteria,
    notes: sanitizeBusinessCreateNotes(card.notes, explicitBusinessNameRequired),
    flowDefinition: {
      ...flowDefinition,
      entryUrl: shouldForceBusinessListEntry && businessListUrl ? businessListUrl : flowDefinition.entryUrl,
      sharedVariables,
      cleanupNotes:
        /(商机名称|商机名|opportunityName|businessName)/i.test(flowDefinition.cleanupNotes) && !cardExplicitlyRequiresBusinessName(card)
          ? '如环境要求数据清理，可在测试后按 businessId 或本次真实创建记录删除；若无删除入口可不清理。'
          : flowDefinition.cleanupNotes,
      steps,
    },
  };
}

function stabilizeScenarioCard(card: ScenarioCard): ScenarioCard {
  if (!looksLikeBusinessCreateScenarioCard(card)) return card;

  return stabilizeBusinessCreateCard({
    ...card,
    notes: normalizeStringArray([
      ...card.notes,
      '进入创建商机页后，优先使用“商机联系人信息 / 关联产品意向信息 / 附件信息”等当前步骤标题或字段标签作为锚点，不要对裸“创建商机”文本使用 getByText(...).first()；页面里可能同时存在隐藏统计文案如“本月创建商机”。',
    ]),
  });
}

function buildScenarioCardSchema(maxPlanSteps: number): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'title', 'taskMode', 'targetUrl', 'featureDescription', 'flowDefinition', 'successCriteria', 'visualAnchors', 'notes'],
    properties: {
      version: { type: 'integer', enum: [1] },
      title: { type: 'string' },
      taskMode: { type: 'string', enum: ['page', 'scenario'] },
      targetUrl: { type: 'string' },
      featureDescription: { type: 'string' },
      successCriteria: {
        type: 'array',
        items: { type: 'string' },
        maxItems: Math.max(3, maxPlanSteps),
      },
      visualAnchors: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 6,
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 8,
      },
      flowDefinition: {
        type: 'object',
        additionalProperties: false,
        required: ['version', 'entryUrl', 'sharedVariables', 'expectedOutcome', 'cleanupNotes', 'steps'],
        properties: {
          version: { type: 'integer', enum: [1] },
          entryUrl: { type: 'string' },
          sharedVariables: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 8,
          },
          expectedOutcome: { type: 'string' },
          cleanupNotes: { type: 'string' },
          steps: {
            type: 'array',
            maxItems: maxPlanSteps,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['stepUid', 'stepType', 'title', 'target', 'instruction', 'expectedResult', 'extractVariable'],
              properties: {
                stepUid: { type: 'string' },
                stepType: { type: 'string', enum: ['ui', 'api', 'assert', 'extract', 'cleanup'] },
                title: { type: 'string' },
                target: { type: 'string' },
                instruction: { type: 'string' },
                expectedResult: { type: 'string' },
                extractVariable: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

function buildScenarioCardPrompt(input: ScenarioCardInput, maxPlanSteps: number): string {
  const attachmentNotes = (input.attachments || [])
    .map((item, index) => `- 图片 ${index + 1}: 名称=${item.name || `attachment-${index + 1}`}；用途=${item.purpose || '未标注'}`)
    .join('\n');

  return [
    '你是一个“AI E2E 场景规划器”，目标不是写脚本，而是把用户的一句话需求/截图整理成高成功率执行的 ScenarioCard。',
    '',
    '规则：',
    '1. 优先选择最短、最稳定、最容易自动化的闭环，不要无谓扩展步骤。',
    '2. taskMode 只能是 page 或 scenario。单页面验证选 page；跨页面/跨阶段流程选 scenario。',
    '3. successCriteria 必须是可验证的结果，如 URL、文案、Drawer/Modal 状态、API 成功、表格状态变化。',
    '4. 不要编造账号、优惠码、企业名等具体测试数据；若必须依赖页面生成/提取，请放到 flowDefinition.sharedVariables 或 extract 步骤里。',
    `5. flowDefinition.steps 最多不要超过 ${maxPlanSteps} 步。`,
    '6. featureDescription 用中文简洁描述目标、关键动作、关键断言。',
    '7. 如果用户给了截图，把截图中的关键页面状态、按钮、表单、成功页面特征总结到 successCriteria / visualAnchors / notes。',
    '8. targetUrl 优先使用明确的 URL hint；如果没有且无法可靠推断，可以返回空字符串。',
    '9. stepType 只能使用 ui / api / assert / extract / cleanup。',
    '10. 输出必须严格遵守 JSON Schema，不要添加解释。',
    '11. step.instruction / expectedResult 尽量写成可执行、可校验的原子动作，便于后续映射到 action DSL（如 打开/填写/选择/点击/等待/校验/提取）。',
    '12. 像“进入页面 / 打开新建页”这类前置步骤，expectedResult 优先写 URL、标题、表单锚点或页面 ready；不要把后续提交按钮“可见 / 可点击”塞进首个进入步骤或对应 successCriteria。',
    '',
    `目标 URL Hint: ${input.targetUrlHint || '未提供'}`,
    '',
    '用户输入：',
    input.input.trim(),
    '',
    '图片附件：',
    attachmentNotes || '- 无',
  ].join('\n');
}

export function normalizeScenarioCard(raw: unknown, fallbackTargetUrl = ''): ScenarioCard {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const taskMode = normalizeTaskMode(source.taskMode);
  const targetUrl = toString(source.targetUrl) || fallbackTargetUrl.trim();
  const flowDefinition = normalizeFlowDefinition(source.flowDefinition, targetUrl);
  const successCriteria = normalizeStringArray(source.successCriteria);
  const featureDescription = toString(source.featureDescription) || [toString(source.title), ...successCriteria].filter(Boolean).join('；');

  return stabilizeScenarioCard({
    version: 1,
    title: toString(source.title) || 'AI 规划的端到端场景',
    taskMode,
    targetUrl,
    featureDescription,
    flowDefinition: {
      ...flowDefinition,
      entryUrl: flowDefinition.entryUrl || targetUrl,
      expectedOutcome: flowDefinition.expectedOutcome || successCriteria.join('；'),
    },
    successCriteria,
    visualAnchors: normalizeStringArray(source.visualAnchors),
    notes: normalizeStringArray(source.notes),
  });
}

export async function generateScenarioCard(
  input: ScenarioCardInput,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): Promise<ScenarioCardGenerationOutput> {
  const config = getLLMRuntimeConfig(runtimeOverrides);
  const attachments = (input.attachments || []).filter((item) => Boolean(item?.dataUrl)).slice(0, 4);
  const card = normalizeScenarioCard(
    await callLLMStructured<ScenarioCard>(
      {
        prompt: buildScenarioCardPrompt(input, config.maxPlanSteps),
        systemPrompt: 'You convert loose user intent into a strict ScenarioCard JSON for an AI-driven Playwright E2E system.',
        schemaName: 'scenario_card',
        schema: buildScenarioCardSchema(config.maxPlanSteps),
        imageDataUrls: attachments.map((item) => item.dataUrl),
        temperature: 0.1,
        maxOutputTokens: 1800,
      },
      runtimeOverrides,
      signal
    ),
    input.targetUrlHint || ''
  );

  return {
    card,
    llmMeta: {
      provider: config.provider,
      model: config.model,
      visionEnabled: config.visionEnabled,
      attachmentCount: attachments.length,
    },
  };
}

export function buildGenerateInputFromScenarioCard(card: ScenarioCard): {
  targetUrl: string;
  description: string;
  context: GenerateTestContext;
} {
  const scenarioEntryUrl = resolveScenarioEntryUrl(card);
  const targetUrl = card.targetUrl || card.flowDefinition.entryUrl || scenarioEntryUrl;
  const flowDefinition = normalizeFlowDefinition(card.flowDefinition, targetUrl);
  const descriptionParts = [card.featureDescription];

  if (card.successCriteria.length > 0) {
    descriptionParts.push(`成功标准：\n- ${card.successCriteria.join('\n- ')}`);
  }

  if (card.visualAnchors.length > 0) {
    descriptionParts.push(`视觉锚点：\n- ${card.visualAnchors.join('\n- ')}`);
  }

  if (card.notes.length > 0) {
    descriptionParts.push(`补充说明：\n- ${card.notes.join('\n- ')}`);
  }

  const scenarioSteps = flowDefinition.steps.map((step) => ({
    stepUid: step.stepUid,
    stepType: step.stepType,
    title: step.title,
    target: step.target,
    instruction: step.instruction,
    expectedResult: step.expectedResult,
    extractVariable: step.extractVariable,
  }));

  const expectedOutcome = flowDefinition.expectedOutcome || card.successCriteria.join('；');
  const actionDsl = buildIntentActionDSL({
    taskMode: card.taskMode,
    targetUrl,
    featureDescription: card.featureDescription,
    expectedOutcome,
    successCriteria: card.successCriteria,
    sharedVariables: flowDefinition.sharedVariables,
    cleanupNotes: flowDefinition.cleanupNotes,
    steps: scenarioSteps,
  });

  const context: GenerateTestContext =
    card.taskMode === 'scenario'
      ? {
          taskMode: 'scenario',
          scenarioEntryUrl: scenarioEntryUrl || targetUrl,
          scenarioSummary: buildFlowSummary(flowDefinition, {
            includeInstruction: true,
            includeExpectedResult: true,
            includeExtractVariable: true,
          }),
          expectedOutcome,
          successCriteria: [...card.successCriteria],
          sharedVariables: flowDefinition.sharedVariables,
          cleanupNotes: flowDefinition.cleanupNotes,
          scenarioSteps,
          actionDsl,
        }
      : {
          taskMode: 'page',
          scenarioEntryUrl: targetUrl,
          expectedOutcome,
          successCriteria: [...card.successCriteria],
          scenarioSteps,
          actionDsl,
        };

  return {
    targetUrl,
    description: descriptionParts.filter(Boolean).join('\n\n'),
    context,
  };
}
