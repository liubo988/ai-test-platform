import fs from 'node:fs/promises';
import path from 'node:path';
import { Script } from 'node:vm';
import { callLLMStructured, callLLMStream } from './llm-client';
import { renderIntentActionLibrary, selectIntentActionLibrary } from './intent-action-library';
import {
  renderIntentRecipeRegistry,
  selectIntentRecipeRegistry,
  type IntentRecipePerformanceFeedback,
  type IntentMatchedRecipe,
} from './intent-recipe-registry';
import {
  renderIntentExecutionPlan,
  renderIntentVerificationPlan,
  buildIntentExecutionPlan,
  buildIntentVerificationPlan,
  type IntentExecutionPlan,
  type IntentVerificationPlan,
} from './intent-execution-plan';
import {
  compileIntentExecutionTemplate,
  renderCompiledIntentExecutionTemplate,
  type IntentCompiledExecutionTemplate,
} from './intent-execution-compiler';
import {
  applyIntentExecutionSlotPatch,
  buildIntentExecutionRepairPatchSchema,
  buildIntentExecutionSlotPatchSchema,
  extractIntentExecutionSlotCode,
  hasIntentExecutionSlotMarkers,
  normalizeIntentExecutionRepairPatch,
  normalizeIntentExecutionSlotPatch,
  resolveIntentExecutionPatchTargetSlotUids,
  type IntentExecutionRepairPatch,
  type IntentExecutionSlotPatch,
} from './intent-execution-slot-patch';
import {
  resolveIntentE2EPriorityScenarioFamilyRoute,
  type IntentE2EPriorityScenarioFamilyRoute,
  type IntentE2EPriorityScenarioFamily,
} from './intent-e2e-priority-scenario-family';
import type {
  IntentExecutionBaseCodeSource,
  IntentExecutionStructuredPatch,
  IntentExecutionStructuredRepairOutput,
} from './intent-execution-artifacts';
import { renderIntentRepairMemoryHints, type IntentRepairMemoryHint } from './ai/intent-repair-memory';
import { buildIntentActionDSL, renderIntentActionDSL, type IntentActionDSL, type IntentActionStepInput } from './intent-action-dsl';
import {
  applyIntentProjectKnowledgeToDsl,
  renderIntentProjectKnowledge,
  resolveIntentProjectKnowledge,
  type IntentProjectKnowledgeResolution,
  type IntentProjectKnowledgeRulePerformance,
} from './intent-project-knowledge';
import {
  applyIntentStarterAssetsToDsl,
  collectIntentStarterAssetCapabilitySlugs,
  resolveIntentStarterAssets,
  type IntentResolvedStarterAsset,
} from './intent-starter-assets';
import type { IntentExperienceHint } from './intent-e2e-experience-search';
import type { IntentE2EInsightStarterHelper } from './ai/intent-e2e-insights';
import { buildIntentSharedVariableJsonPaths } from './intent-shared-variable-utils';
import type { LLMRuntimeOverrides } from './llm/provider-config';
import type { PageSnapshot, AuthConfig } from './page-analyzer';

export type GenerateEvent =
  | {
      type: 'thinking' | 'code' | 'complete' | 'error';
      content: string;
    }
  | {
      type: 'structured_patch';
      content: string;
      structuredPatch: IntentExecutionStructuredPatch;
      repairOutput?: IntentExecutionStructuredRepairOutput;
    };

export interface GenerateTestContext {
  taskMode?: 'page' | 'scenario';
  projectUid?: string;
  scenarioEntryUrl?: string;
  scenarioSummary?: string;
  expectedOutcome?: string;
  successCriteria?: string[];
  visualAnchors?: string[];
  sharedVariables?: string[];
  cleanupNotes?: string;
  repairObservationSnapshot?: PageSnapshot;
  repairObservationReport?: RepairObservationReport;
  relatedSnapshots?: PageSnapshot[];
  scenarioSteps?: IntentActionStepInput[];
  actionDsl?: IntentActionDSL;
  executionPlan?: IntentExecutionPlan;
  verificationPlan?: IntentVerificationPlan;
}

export interface RepairTestContext {
  previousCode: string;
  executionError: string;
  recentEvents?: string[];
  latestTrace?: string[];
  repairMemoryHints?: IntentRepairMemoryHint[];
  failedStepTitle?: string;
  failedSlotUids?: string[];
  failureSummary?: string;
  failedPlanNodes?: RepairFailedPlanNode[];
  verifierResult?: RepairVerifierResult | null;
  graderDiagnosis?: RepairGraderDiagnosis | null;
}

export interface RepairFailedPlanNode {
  nodeUid: string;
  kind: IntentCompiledExecutionTemplate['slots'][number]['kind'];
  title: string;
  preferredHelpers: string[];
  relatedCheckUids: string[];
  instructions: string[];
}

export interface RepairVerifierResultCheck {
  checkUid: string;
  title: string;
  instruction: string;
  preferredHelpers: string[];
  relatedPlanStepUids: string[];
  required: boolean;
}

export interface RepairVerifierResult {
  expectedOutcome: string;
  failingChecks: RepairVerifierResultCheck[];
}

export interface RepairGraderDiagnosis {
  failureClass: string;
  summary: string;
  failureSignature?: string;
  failedStepTitle?: string;
  failedLocator?: string;
  targetAnchor?: string;
  repeatedCount?: number;
  nextActions?: string[];
}

export type RepairObservationProbeKind =
  | 'page_surface'
  | 'surface_delta'
  | 'list_json_evidence'
  | 'detail_field_evidence'
  | 'anchor_presence'
  | 'candidate_anchor_presence'
  | 'frame_probe';

export type RepairObservationProbeStatus = 'observed' | 'not_found' | 'not_applicable';

export interface RepairObservationProbe {
  probeUid: string;
  kind: RepairObservationProbeKind;
  status: RepairObservationProbeStatus;
  summary: string;
  evidence: string[];
}

export interface RepairObservationReport {
  observedAt: string;
  pageUrl: string;
  pageTitle: string;
  probes: RepairObservationProbe[];
}

const ROOT = process.cwd();
const BUSINESS_ID_JSON_PATHS = buildIntentSharedVariableJsonPaths('businessId');
const BUSINESS_STATUS_JSON_PATHS = ['status', 'statusName', 'statusText', 'state', 'stateName', 'stateText', 'displayStatus', 'progress.displayStatus'];
const ORDER_ID_JSON_PATHS = buildIntentSharedVariableJsonPaths('orderId');

function renderJsStringArray(items: string[]): string {
  return `[${items.map((item) => JSON.stringify(item)).join(', ')}]`;
}

async function loadEdgeCases(_url: string): Promise<any[]> {
  try {
    const casesPath = path.join(ROOT, 'edge-cases', 'cases.json');
    const cases = JSON.parse(await fs.readFile(casesPath, 'utf8'));
    return cases.filter((c: any) => c.status === 'new' || c.status === 'active').slice(0, 10);
  } catch {
    return [];
  }
}

function buildTaskHaystack(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): string {
  return [
    snapshot.url,
    snapshot.title,
    snapshot.bodyTextExcerpt || '',
    description,
    context?.scenarioEntryUrl || '',
    context?.scenarioSummary || '',
    context?.expectedOutcome || '',
  ]
    .join('\n')
    .toLowerCase();
}

function buildIntentHaystack(description: string, context?: GenerateTestContext): string {
  return [
    description,
    context?.scenarioEntryUrl || '',
    context?.scenarioSummary || '',
    context?.expectedOutcome || '',
    context?.cleanupNotes || '',
    ...(context?.sharedVariables || []),
  ]
    .join('\n')
    .toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    items.push(value);
  }

  return items;
}

function collectSnapshotFieldHints(snapshot: Pick<PageSnapshot, 'forms'>): string[] {
  return uniqueStrings(
    snapshot.forms.flatMap((form) => form.fields.flatMap((field) => [field.label, field.placeholder, field.id]))
  );
}

function collectFrameHintPhrases(frame: NonNullable<PageSnapshot['frames']>[number]): string[] {
  const pathToken = (() => {
    try {
      const pathname = new URL(frame.url).pathname;
      return pathname.split('/').filter(Boolean).pop() || '';
    } catch {
      return '';
    }
  })();

  return uniqueStrings([
    frame.name,
    frame.elementId,
    frame.elementName,
    frame.elementClassName,
    frame.selectorHint,
    pathToken,
    ...frame.headings.map((item) => item.text),
    ...frame.forms.flatMap((form) => form.fields.flatMap((field) => [field.label, field.placeholder, field.id])),
  ]).filter((item) => item.length >= 2 && item.length <= 80);
}

function buildFrameHaystack(frame: NonNullable<PageSnapshot['frames']>[number]): string {
  return [
    frame.name,
    frame.url,
    frame.elementId || '',
    frame.elementName || '',
    frame.elementClassName || '',
    frame.selectorHint || '',
    frame.bodyTextExcerpt || '',
    ...frame.headings.map((item) => item.text),
    ...frame.forms.flatMap((form) => form.fields.flatMap((field) => [field.label, field.placeholder, field.id])),
  ]
    .join('\n')
    .toLowerCase();
}

function isLikelyBusinessFrame(frame: NonNullable<PageSnapshot['frames']>[number]): boolean {
  const haystack = buildFrameHaystack(frame);
  if (!haystack.trim()) return false;
  if (/(recaptcha|captcha|challenge|beacon|tracker|analytics|intercom|chat|客服|support)/i.test(haystack)) {
    return false;
  }

  let surfaceSignals = 0;
  if (frame.forms.some((form) => form.fields.length > 0)) surfaceSignals += 1;
  if (frame.buttons.length > 0) surfaceSignals += 1;
  if (frame.headings.length > 0) surfaceSignals += 1;
  if ((frame.bodyTextExcerpt || '').trim().length >= 30) surfaceSignals += 1;
  return surfaceSignals >= 2;
}

function shouldPreferFrameContext(
  snapshot: PageSnapshot,
  description: string,
  context?: GenerateTestContext
): boolean {
  const businessFrames = (snapshot.frames || []).filter(isLikelyBusinessFrame);
  if (businessFrames.length === 0) return false;

  const intentHaystack = buildIntentHaystack(description, context);
  if (/(iframe|frame|内嵌|嵌入)/i.test(intentHaystack)) return true;

  if (
    businessFrames.some((frame) =>
      collectFrameHintPhrases(frame).some((phrase) => intentHaystack.includes(phrase.toLowerCase()))
    )
  ) {
    return true;
  }

  const mainSurfaceSignalCount =
    Number(snapshot.forms.some((form) => form.fields.length > 0)) +
    Number(snapshot.buttons.length > 2) +
    Number(snapshot.headings.length > 1) +
    Number((snapshot.bodyTextExcerpt || '').trim().length >= 60) +
    Number(collectSnapshotFieldHints(snapshot).length > 0);

  return businessFrames.length === 1 && mainSurfaceSignalCount <= 1;
}

function applySnapshotPlanningHintsToDsl(
  dsl: IntentActionDSL,
  snapshot: PageSnapshot,
  description: string,
  context?: GenerateTestContext
): IntentActionDSL {
  if (!shouldPreferFrameContext(snapshot, description, context)) {
    return dsl;
  }

  const frameAwareStepTypes = new Set(['ui', 'assert', 'extract']);

  return {
    ...dsl,
    globalRules: uniqueStrings([
      ...dsl.globalRules,
      '当前页面存在业务 iframe 线索时，优先使用 __e2e.getFrame 进入真实业务上下文，再在 frame 内定位 placeholder / 按钮 / 列表。',
    ]),
    preferredPrimitives: uniqueStrings([
      ...dsl.preferredPrimitives,
      'enter_frame_context(selector?, urlIncludes?, nameIncludes?): 通过 helper 进入真实业务 iframe',
    ]),
    steps: dsl.steps.map((step) =>
      frameAwareStepTypes.has(step.stepType)
        ? {
            ...step,
            preferredHelpers: uniqueStrings(['__e2e.getFrame', ...step.preferredHelpers]),
          }
        : step
    ),
  };
}

function looksLikePrimaryLoginTask(
  dsl: IntentActionDSL,
  auth?: AuthConfig
): boolean {
  const loginUrl = String(auth?.loginUrl || '').trim().toLowerCase();
  if (!loginUrl) return false;

  const firstExecutableStep = dsl.steps.find((step) => step.stepType !== 'cleanup');
  const target = String(firstExecutableStep?.target || dsl.targetUrl || '').trim().toLowerCase();
  const haystack = [
    dsl.summary,
    firstExecutableStep?.title || '',
    firstExecutableStep?.goal || '',
    ...firstExecutableStep?.requiredAssertions || [],
    target,
  ]
    .join('\n')
    .toLowerCase();

  if (!haystack.includes('登录') && !haystack.includes('登陆') && !/\/login\b|sign in|signin/.test(haystack)) {
    return false;
  }

  return (
    target === loginUrl ||
    target.includes('/login') ||
    /登录页|登陆页|登录流程|登陆流程|登录表单|登陆表单|验证登录|测试登录|账号登录|密码登录|验证码登录/.test(haystack)
  );
}

function applyAuthPlanningHintsToDsl(
  dsl: IntentActionDSL,
  auth?: AuthConfig
): IntentActionDSL {
  const loginUrl = String(auth?.loginUrl || '').trim();
  if (!loginUrl) return dsl;
  if (looksLikePrimaryLoginTask(dsl, auth)) return dsl;

  const firstExecutableStep = dsl.steps.find((step) => step.stepType !== 'cleanup');
  if (!firstExecutableStep) return dsl;

  return {
    ...dsl,
    globalRules: uniqueStrings([
      ...dsl.globalRules,
      '如果请求提供统一登录信息，优先使用 __e2e.ensureLoggedIn(page, { targetUrl }) 完成登录和复访，不要手写 page.goto(LOGIN_URL) + locator 登录流程。',
    ]),
    preferredPrimitives: uniqueStrings([
      ...dsl.preferredPrimitives,
      'ensure_auth(targetUrl?): 通过 helper 统一处理登录态检测、登录和目标页复访',
    ]),
    steps: dsl.steps.map((step) =>
      step.stepUid === firstExecutableStep.stepUid
        ? {
            ...step,
            preferredHelpers: uniqueStrings(['__e2e.ensureLoggedIn', ...step.preferredHelpers]),
          }
        : step
    ),
  };
}

export interface ResolvedPromptPlanningContext {
  priorityScenarioFamily?: IntentE2EPriorityScenarioFamily;
  priorityScenarioFamilyRoute?: IntentE2EPriorityScenarioFamilyRoute;
  dsl: IntentActionDSL;
  knowledge: IntentProjectKnowledgeResolution;
  experienceHints?: IntentExperienceHint[];
  starterHelpers?: IntentResolvedStarterAsset[];
  recipes?: IntentMatchedRecipe[];
  executionPlan?: IntentExecutionPlan;
  verificationPlan?: IntentVerificationPlan;
}

export interface ResolveIntentPromptPlanningOptions {
  rulePerformanceById?: Record<string, IntentProjectKnowledgeRulePerformance>;
  starterHelpers?: IntentE2EInsightStarterHelper[];
  auth?: AuthConfig;
  recipePerformanceBySlug?: Record<string, IntentRecipePerformanceFeedback>;
  projectUid?: string;
  experienceHints?: IntentExperienceHint[];
}

type ResolvedStarterHelper = NonNullable<ResolvedPromptPlanningContext['starterHelpers']>[number];

export function resolveIntentPromptPlanningContext(
  snapshot: PageSnapshot,
  description: string,
  context?: GenerateTestContext,
  options: ResolveIntentPromptPlanningOptions = {}
): ResolvedPromptPlanningContext {
  const baseDsl =
    context?.actionDsl ||
    buildIntentActionDSL({
      taskMode: context?.taskMode,
      targetUrl: context?.scenarioEntryUrl || snapshot.url,
      featureDescription: description,
      expectedOutcome: context?.expectedOutcome,
      sharedVariables: context?.sharedVariables,
      cleanupNotes: context?.cleanupNotes,
      steps: context?.scenarioSteps,
    });
  const authHintedDsl = applyAuthPlanningHintsToDsl(baseDsl, options.auth);
  const snapshotHintedDsl = applySnapshotPlanningHintsToDsl(authHintedDsl, snapshot, description, context);

  const knowledge = resolveIntentProjectKnowledge({
    snapshot,
    description,
    dsl: snapshotHintedDsl,
  }, {
    projectUid: options.projectUid || context?.projectUid,
    rulePerformanceById: options.rulePerformanceById,
  });
  const knowledgeAppliedDsl = applyIntentProjectKnowledgeToDsl(snapshotHintedDsl, knowledge);
  const starterHelpers = resolveIntentStarterAssets({
    dsl: knowledgeAppliedDsl,
    snapshot,
    auth: options.auth,
    starterHelpers: options.starterHelpers,
  });
  const finalDsl = applyIntentStarterAssetsToDsl(knowledgeAppliedDsl, starterHelpers);
  const priorityScenarioFamilyRoute = resolveIntentE2EPriorityScenarioFamilyRoute({
    requestInput: description,
    targetUrl: context?.scenarioEntryUrl || snapshot.url,
    scenarioCard: {
      title: context?.scenarioSummary || finalDsl.summary,
      featureDescription: finalDsl.summary || description,
      visualAnchors: context?.visualAnchors || [],
      flowDefinition: {
        steps: finalDsl.steps.map((step) => ({
          title: step.title,
          target: step.target,
          instruction: step.goal,
          expectedResult: step.requiredAssertions.join('；'),
        })),
      },
    },
    description: uniqueStrings([context?.scenarioSummary, context?.expectedOutcome, context?.cleanupNotes]).join('\n'),
    visualAnchors: context?.visualAnchors,
  });
  const priorityScenarioFamily = priorityScenarioFamilyRoute.family;
  const recipes = selectIntentRecipeRegistry({
    dsl: finalDsl,
    projectUid: options.projectUid,
    auth: options.auth,
    snapshot,
    priorityScenarioFamily,
    preferredCapabilitySlugs: [
      ...knowledge.capabilitySlugs,
      ...collectIntentStarterAssetCapabilitySlugs(starterHelpers),
    ],
    performanceBySlug: options.recipePerformanceBySlug,
  }).items;
  const executionPlan = buildIntentExecutionPlan({
    taskMode: context?.taskMode,
    targetUrl: context?.scenarioEntryUrl || snapshot.url,
    featureDescription: description,
    expectedOutcome: context?.expectedOutcome,
    successCriteria: context?.successCriteria,
    sharedVariables: context?.sharedVariables,
    cleanupNotes: context?.cleanupNotes,
    scenarioSteps: context?.scenarioSteps,
    dsl: finalDsl,
    recipes,
  });
  const verificationPlan = buildIntentVerificationPlan(
    {
      taskMode: context?.taskMode,
      targetUrl: context?.scenarioEntryUrl || snapshot.url,
      featureDescription: description,
      expectedOutcome: context?.expectedOutcome,
      successCriteria: context?.successCriteria?.length
        ? context.successCriteria
        : executionPlan.steps.flatMap((step) => step.requiredAssertions).slice(0, 12),
      sharedVariables: context?.sharedVariables,
      cleanupNotes: context?.cleanupNotes,
      scenarioSteps: context?.scenarioSteps,
      knowledge,
      dsl: finalDsl,
      recipes,
    },
    executionPlan
  );

  return {
    priorityScenarioFamily,
    priorityScenarioFamilyRoute,
    dsl: finalDsl,
    knowledge,
    experienceHints: options.experienceHints,
    starterHelpers,
    recipes,
    executionPlan,
    verificationPlan,
  };
}

function buildActionDslSection(planning: ResolvedPromptPlanningContext): string {
  return `
${renderIntentActionDSL(planning.dsl)}`;
}

function buildProjectKnowledgeSection(planning: ResolvedPromptPlanningContext): string {
  const rendered = planning.knowledge
    ? renderIntentProjectKnowledge(planning.knowledge)
    : '';
  return rendered ? `
${rendered}` : '';
}

function buildExperienceHintLine(item: IntentExperienceHint): string {
  const matchedSignals = item.matchedSignals.length > 0 ? `；命中=${item.matchedSignals.join(' / ')}` : '';
  const recipes = item.matchedRecipeSlugs.length > 0 ? `；recipes=${item.matchedRecipeSlugs.slice(0, 2).join(' / ')}` : '';
  const helpers = item.chosenHelpers.length > 0 ? `；helpers=${item.chosenHelpers.slice(0, 3).join(' / ')}` : '';
  const stable = item.stableEntityHints.length > 0 ? `；stable=${item.stableEntityHints.slice(0, 3).join(' / ')}` : '';
  const playbook = item.playbookSlugs.length > 0 ? `；playbook=${item.playbookSlugs.slice(0, 2).join(' / ')}` : '';
  const pitfalls = item.pitfalls.length > 0 ? `；pitfalls=${item.pitfalls.slice(0, 2).join(' / ')}` : '';

  return `- [${item.kind === 'successful_run' ? 'success' : 'failure'} | score=${item.matchScore}] ${item.requestSummary || item.scenarioTitle}${matchedSignals}${recipes}${helpers}${stable}${playbook}${pitfalls}${
    item.verifierStrategySummary ? `\n  verifier=${item.verifierStrategySummary}` : ''
  }`;
}

function buildExperienceSection(planning: ResolvedPromptPlanningContext): string {
  if (!planning.experienceHints?.length) return '';

  const successHints = planning.experienceHints.filter((item) => item.kind === 'successful_run');
  const failureHints = planning.experienceHints.filter((item) => item.kind === 'failed_run');

  return `
## 最近相似运行经验（结构化摘要）
${successHints.length > 0 ? `成功经验：\n${successHints.slice(0, 3).map(buildExperienceHintLine).join('\n')}` : '成功经验：- 无'}
${failureHints.length > 0 ? `\n相似失败提示：\n${failureHints.slice(0, 2).map(buildExperienceHintLine).join('\n')}` : ''}

使用边界：
1. 这些内容只用于提示稳定路径与已知坑点，不要把它们当成可直接整段复制的历史脚本。
2. 如果命中了 success hint，优先复用其中已经验证过的 recipe / helper / verifier 思路，而不是另起一套自由实现。
3. failure hint 只负责避坑，不能覆盖已命中的成功路径。
4. 若当前 DeterministicExecutionTemplate、ExecutionPlan 或项目知识已经给出更具体的结构化约束，以这些结构化约束为准。`;
}

function buildStarterHelperPreferredPromotionFragment(
  item: ResolvedStarterHelper
): string {
  switch (item.preferredPromotionStatus) {
    case 'await_more_positive_rules':
      return `；提级状态=待补正向规则(长期正向 ${item.preferredPromotionPositiveRuleCount || 0}/${item.preferredPromotionRequiredPositiveRuleCount || 0} 条)`;
    case 'blocked_by_mixed_evidence':
      return `；提级状态=混合证据未清零(正向 ${item.preferredPromotionPositiveRuleCount || 0} / 负向或混合 ${item.preferredPromotionNegativeRuleCount || 0})`;
    case 'await_long_term_recovery':
      return '；提级状态=等待长期转正';
    default:
      return '';
  }
}

function buildStarterHelperGovernanceEvidenceFragment(
  item: ResolvedStarterHelper
): string {
  if (item.governanceReleaseStatus !== 'released_from_suppressed') return '';

  return `；治理恢复证据=直接验证通过 ${item.governanceReleaseDirectVerifyPassedCapabilityCount || 0} 条${
    (item.governanceReleaseManualRepairPassedCapabilityCount || 0) > 0
      ? `，人工repair通过 ${item.governanceReleaseManualRepairPassedCapabilityCount || 0} 条`
      : ''
  }${
    (item.governanceReleaseAutoRepairPassedCapabilityCount || 0) > 0
      ? `，自动repair通过 ${item.governanceReleaseAutoRepairPassedCapabilityCount || 0} 条(弱恢复)`
      : ''
  }`;
}

function buildStarterHelperSection(planning: ResolvedPromptPlanningContext): string {
  if (!planning.starterHelpers?.length) return '';

  return `
## Starter Helper 建议（按适用范围分层）
${planning.starterHelpers
  .slice(0, 4)
  .map(
    (item) =>
      `- ${item.helper}: 范围=${item.scope === 'project_capability' ? '项目级 capability' : '全局 runtime heuristic'}；来源=${item.source === 'promoted' ? '已转正规则' : '稳定规则'}；资产=${item.assetTitle}；复用 ${item.runCount} 次；通过率 ${item.passRate}%；支持规则=${item.supportingRuleTitles.slice(0, 2).join(' / ') || item.supportingRuleIds.slice(0, 2).join(' / ') || '未记录'}${
        item.knowledgeChangeSignal === 'positive'
          ? `；长期证据=正向${item.knowledgeChangeDecisionableRuleCount ? `(${item.knowledgeChangeDecisionableRuleCount} 条已判定规则)` : ''}`
          : item.knowledgeChangeTier === 'watching'
            ? `；长期证据=${
                item.knowledgeChangeWatchingKind === 'mixed'
                  ? '混合观察'
                  : item.knowledgeChangeWatchingKind === 'recovering'
                    ? '恢复观察'
                    : '观察中'
              }${item.knowledgeChangeDecisionableRuleCount ? `(${item.knowledgeChangeDecisionableRuleCount} 条已判定规则)` : ''}`
            : ''
            }${
        item.governanceReleaseStatus === 'released_from_suppressed'
          ? `；治理状态=已从 suppressed 保守释放${
              item.governanceReleaseCapabilityCount
                ? `(${item.governanceReleaseCapabilityCount} 条治理目标能力`
                : '('
            }${
              item.governanceReleaseDirectVerifyPassedCapabilityCount
                ? `，直接验证通过 ${item.governanceReleaseDirectVerifyPassedCapabilityCount} 条`
                : ''
            }${
              item.governanceReleaseLatestVerifyExecutionAt
                ? `，最近验证=${item.governanceReleaseLatestVerifyExecutionAt}`
                : ''
            })`
          : ''
      }${
        buildStarterHelperGovernanceEvidenceFragment(item)
      }${
        (item.governanceReleaseAutoRepairPassedCapabilityCount || 0) > 0
          ? '；注意=自动repair只算弱恢复，不等于长期正向证据'
          : ''
      }${
        buildStarterHelperPreferredPromotionFragment(item)
      }${
        item.preferredPromotionStatus && item.preferredAutoPromotionCondition
          ? `；自动提级条件=${item.preferredAutoPromotionCondition}`
          : ''
      }${
        item.recentFailedVerifyExecutionCount
          ? `；近${item.recentFailureWindowDays || 14}天标准验证失败=${item.recentFailedVerifyExecutionCount}`
          : item.recentFailedReviewExecutionCount
            ? `；近${item.recentFailureWindowDays || 14}天保守复核失败=${item.recentFailedReviewExecutionCount}`
            : ''
      }${
        item.recentFailedVerifyCapabilityCount
          ? `；最近标准验证失败=${item.recentFailedVerifyCapabilityCount}`
          : item.recentFailedReviewCapabilityCount
            ? `；最近保守复核失败=${item.recentFailedReviewCapabilityCount}`
            : ''
      }`
  )
  .join('\n')}

使用要求：
1. 当前步骤语义如果已经被这些 helper 覆盖，优先直接复用，不要再手写等价的 click + waitForTimeout + locator 拼装逻辑。
2. 标记为“全局 runtime heuristic”的 helper 可以跨系统复用，但仍要先确认动作语义一致。
3. 标记为“项目级 capability”的 helper 只在当前项目业务语义匹配时使用，避免为了复用而硬套到别的系统。
4. 标记为“已从 suppressed 保守释放”的 helper 只能按恢复观察层使用；语义明确匹配时才复用，不能替代长期正向 helper 的优先级。`;
}

function buildRecipeRegistrySection(planning: ResolvedPromptPlanningContext): string {
  if (!planning.recipes?.length) return '';

  return `\n${renderIntentRecipeRegistry({
    version: 1,
    items: planning.recipes,
  })}`;
}

function buildExecutionPlanSection(planning: ResolvedPromptPlanningContext): string {
  return planning.executionPlan ? `\n${renderIntentExecutionPlan(planning.executionPlan)}` : '';
}

function buildVerificationPlanSection(planning: ResolvedPromptPlanningContext): string {
  return planning.verificationPlan ? `\n${renderIntentVerificationPlan(planning.verificationPlan)}` : '';
}

function buildVerificationIntentSection(planning: ResolvedPromptPlanningContext): string {
  if (planning.verificationPlan?.intent !== 'review') return '';

  const notes = uniqueStrings(planning.verificationPlan.policyNotes || []);
  return `
## 当前能力验证意图
- 模式: 保守复核（review）
- 目标: 优先确认既有 helper、selector、断言与业务入口是否仍稳定可复用，而不是主动扩写新的业务链路。
${notes.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;
}

function compilePlanningExecutionTemplate(
  planning: ResolvedPromptPlanningContext,
  auth: AuthConfig | undefined,
  description: string
): IntentCompiledExecutionTemplate | null {
  if (!planning.executionPlan) return null;

  return compileIntentExecutionTemplate({
    priorityScenarioFamily: planning.priorityScenarioFamily,
    executionPlan: planning.executionPlan,
    verificationPlan: planning.verificationPlan,
    auth,
    description,
  });
}

type LegacyCodeFallbackMode = 'generate' | 'repair';

function buildLegacyCodeFallbackReason(
  mode: LegacyCodeFallbackMode,
  planning: ResolvedPromptPlanningContext
): string {
  const cause = planning.executionPlan
    ? '当前 ExecutionPlan 未能编译成受控脚手架'
    : '当前 planning 未提供 ExecutionPlan';

  if (mode === 'repair') {
    return `${cause}，当前 repair 显式回退到自由代码修复（legacy fallback，非主链）...`;
  }

  return `${cause}，当前显式回退到自由代码生成（legacy fallback，非主链）...`;
}

function buildStructuredSlotPatchFallbackReason(errorMessage: string): string {
  const normalizedError = String(errorMessage || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 160);
  return normalizedError
    ? `结构化 slot patch 失败（${normalizedError}），当前显式回退到自由代码生成（legacy fallback，非主链）...`
    : '结构化 slot patch 失败，当前显式回退到自由代码生成（legacy fallback，非主链）...';
}

function buildStructuredRepairPatchFallbackReason(errorMessage: string): string {
  const normalizedError = String(errorMessage || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 160);
  return normalizedError
    ? `结构化 repair patch 失败（${normalizedError}），当前 repair 显式回退到自由代码修复（legacy fallback，非主链）...`
    : '结构化 repair patch 失败，当前 repair 显式回退到自由代码修复（legacy fallback，非主链）...';
}

function buildCompiledExecutionTemplateSection(
  planning: ResolvedPromptPlanningContext,
  auth: AuthConfig | undefined,
  description: string
): string {
  const template = compilePlanningExecutionTemplate(planning, auth, description);
  if (!template) return '';

  return `\n${renderCompiledIntentExecutionTemplate(template)}`;
}

function buildRepairFailedPlanNodes(
  template: IntentCompiledExecutionTemplate,
  targetSlotUids: string[]
): RepairFailedPlanNode[] {
  return targetSlotUids
    .map((slotUid) => template.slots.find((item) => item.slotUid === slotUid))
    .filter((slot): slot is IntentCompiledExecutionTemplate['slots'][number] => Boolean(slot))
    .map((slot) => ({
      nodeUid: slot.slotUid,
      kind: slot.kind,
      title: slot.title,
      preferredHelpers: [...slot.preferredHelpers],
      relatedCheckUids: [...slot.relatedCheckUids],
      instructions: [...slot.instructions],
    }));
}

function buildRepairVerifierResult(
  template: IntentCompiledExecutionTemplate,
  targetSlotUids: string[],
  verificationPlan?: IntentVerificationPlan
): RepairVerifierResult | null {
  if (!verificationPlan) return null;

  const targetSlots = targetSlotUids
    .map((slotUid) => template.slots.find((item) => item.slotUid === slotUid))
    .filter((slot): slot is IntentCompiledExecutionTemplate['slots'][number] => Boolean(slot));
  const explicitCheckUids = uniqueStrings(targetSlots.flatMap((slot) => slot.relatedCheckUids || []));
  const inferredCheckUids = uniqueStrings(
    targetSlots.flatMap((slot) =>
      slot.planStepUid
        ? verificationPlan.checks
            .filter((check) => check.relatedPlanStepUids.includes(slot.planStepUid || ''))
            .map((check) => check.checkUid)
        : []
    )
  );
  const targetCheckUids = uniqueStrings([...explicitCheckUids, ...inferredCheckUids]);
  const failingChecks = targetCheckUids
    .map((checkUid) => verificationPlan.checks.find((check) => check.checkUid === checkUid))
    .filter((check): check is IntentVerificationPlan['checks'][number] => Boolean(check))
    .map((check) => ({
      checkUid: check.checkUid,
      title: check.title,
      instruction: check.instruction,
      preferredHelpers: [...check.preferredHelpers],
      relatedPlanStepUids: [...check.relatedPlanStepUids],
      required: check.required,
    }));

  if (!verificationPlan.expectedOutcome && failingChecks.length === 0) {
    return null;
  }

  return {
    expectedOutcome: verificationPlan.expectedOutcome || '',
    failingChecks,
  };
}

function enrichRepairContextWithStructuredInputs(
  repair: RepairTestContext,
  template: IntentCompiledExecutionTemplate,
  targetSlotUids: string[],
  planning: ResolvedPromptPlanningContext
): RepairTestContext {
  return {
    ...repair,
    latestTrace: repair.latestTrace?.length ? repair.latestTrace : repair.recentEvents,
    failedPlanNodes: repair.failedPlanNodes?.length ? repair.failedPlanNodes : buildRepairFailedPlanNodes(template, targetSlotUids),
    verifierResult:
      repair.verifierResult === undefined
        ? buildRepairVerifierResult(template, targetSlotUids, planning.verificationPlan)
        : repair.verifierResult,
  };
}

function renderTargetSlotPatchSection(
  template: IntentCompiledExecutionTemplate,
  targetSlotUids: string[],
  currentCode: string,
  mode: 'generate' | 'repair',
  repair?: RepairTestContext | null
): string {
  const slotLines = targetSlotUids
    .map((slotUid) => {
      const slot = template.slots.find((item) => item.slotUid === slotUid);
      if (!slot) return '';

      const currentSlotCode = extractIntentExecutionSlotCode(currentCode, slotUid);
      return `### Slot ${slotUid}
- kind: ${slot.kind}
- title: ${slot.title}
- preferredHelpers: ${slot.preferredHelpers.join(' / ') || '无'}
- relatedChecks: ${slot.relatedCheckUids.join(' / ') || '无'}
- instructions:
${slot.instructions.map((item, index) => `  ${index + 1}. ${item}`).join('\n') || '  1. 保持当前 slot 语义完整'}
- 当前实现：
\`\`\`javascript
${currentSlotCode || '// 当前仍是占位实现，请在这个 slot 内补全真实逻辑'}
\`\`\``;
    })
    .filter(Boolean)
    .join('\n\n');

  return `\n## Structured Slot Patch Mode（本节优先级最高）
- mode: ${mode === 'repair' ? 'repair_targeted_slot_patch' : 'initial_slot_fill'}
- targetSlots: ${targetSlotUids.join(' / ') || '无'}
- baseCodeHasMarkers: ${targetSlotUids.every((slotUid) => hasIntentExecutionSlotMarkers(currentCode, slotUid)) ? 'yes' : 'no'}
${repair?.failedStepTitle ? `- failedStepTitle: ${repair.failedStepTitle}` : ''}
${repair?.failureSummary ? `- failureSummary: ${repair.failureSummary}` : ''}

要求：
1. 只修改 targetSlots 列出的 slot；不要返回完整 \`test(...)\` 脚本。
2. 每个 slot 的 \`code\` 只填写 \`SLOT_START / SLOT_END\` 之间的代码体，不要包含这两个标记，不要包含外层 \`test.step(...)\` 包裹。
3. 不要删除或重命名 \`shared\`、\`artifacts\`、现有 slotUid，也不要把多个步骤合并到一个 slot 里。
4. 如果是 repair，只修失败 slot 所需的 locator / wait / helper / assertion；不要顺手重写其他已成功 slot。
5. 返回的每个 slot code 都必须是可直接插入现有模板的 JavaScript 语句块，不要加代码围栏。

${slotLines}`;
}

function collectRepairLatestTraceLines(repair: RepairTestContext): string[] {
  return (repair.latestTrace?.length ? repair.latestTrace : repair.recentEvents || []).map((item) => clampText(item, 220));
}

function renderRepairStructuredInputSection(repair: RepairTestContext): string {
  const parts: string[] = [];

  if (repair.failedPlanNodes?.length) {
    parts.push(`### Failed Plan Nodes
${repair.failedPlanNodes
  .map(
    (node, index) => `${index + 1}. [${node.nodeUid}] ${node.kind} · ${node.title || '未命名节点'}
   - helpers: ${node.preferredHelpers.join(' / ') || '无'}
   - relatedChecks: ${node.relatedCheckUids.join(' / ') || '无'}
   - instructions: ${node.instructions.slice(0, 2).join(' / ') || '无'}`
  )
  .join('\n')}`);
  }

  if (repair.verifierResult) {
    parts.push(`### Verifier Result
- expectedOutcome: ${repair.verifierResult.expectedOutcome || '未提供'}
- failingChecks: ${repair.verifierResult.failingChecks.length}
${repair.verifierResult.failingChecks
  .map(
    (check, index) => `${index + 1}. [${check.checkUid}] ${check.title || '未命名检查'}
   - instruction: ${check.instruction || '无'}
   - relatedPlanSteps: ${check.relatedPlanStepUids.join(' / ') || '无'}
   - helpers: ${check.preferredHelpers.join(' / ') || '无'}
   - required: ${check.required ? 'yes' : 'no'}`
  )
  .join('\n')}`);
  }

  return parts.length > 0 ? `\n## Repair Context（结构化输入）\n${parts.join('\n\n')}` : '';
}

function renderRepairGraderDiagnosisSection(repair: RepairTestContext): string {
  const diagnosis = repair.graderDiagnosis;
  if (!diagnosis) return '';

  const lines = [
    `- failureClass: ${diagnosis.failureClass || 'unknown'}`,
    `- summary: ${diagnosis.summary || '未提供'}`,
    diagnosis.failureSignature ? `- failureSignature: ${diagnosis.failureSignature}` : '',
    diagnosis.failedStepTitle ? `- failedStepTitle: ${diagnosis.failedStepTitle}` : '',
    diagnosis.failedLocator ? `- failedLocator: ${diagnosis.failedLocator}` : '',
    diagnosis.targetAnchor ? `- targetAnchor: ${diagnosis.targetAnchor}` : '',
    diagnosis.repeatedCount ? `- repeatedCount: ${diagnosis.repeatedCount}` : '',
  ].filter(Boolean);

  if (diagnosis.nextActions?.length) {
    lines.push(`- nextActions:\n${diagnosis.nextActions.map((item, index) => `  ${index + 1}. ${item}`).join('\n')}`);
  }

  return `\n## Grader Diagnosis\n${lines.join('\n')}`;
}

interface StructuredRepairOutputContext {
  planStepUids: string[];
  checkUids: string[];
  recipeSlugs: string[];
}

function renderStructuredRepairOutputIds(values: string[]): string {
  return values.length > 0 ? values.join(' / ') : '空数组 []';
}

function buildStructuredRepairOutputContext(
  template: IntentCompiledExecutionTemplate,
  targetSlotUids: string[],
  planning: ResolvedPromptPlanningContext,
  repair?: RepairTestContext | null
): StructuredRepairOutputContext {
  const targetSlots = targetSlotUids
    .map((slotUid) => template.slots.find((item) => item.slotUid === slotUid))
    .filter((slot): slot is IntentCompiledExecutionTemplate['slots'][number] => Boolean(slot));
  const verificationPlan = planning.verificationPlan;
  const explicitCheckUids = uniqueStrings(targetSlots.flatMap((slot) => slot.relatedCheckUids || []));
  const inferredCheckUids = uniqueStrings(
    targetSlots.flatMap((slot) =>
      slot.planStepUid && verificationPlan
        ? verificationPlan.checks
            .filter((check) => check.relatedPlanStepUids.includes(slot.planStepUid || ''))
            .map((check) => check.checkUid)
        : []
    )
  );
  let checkUids = uniqueStrings([
    ...(repair?.verifierResult?.failingChecks || []).map((check) => check.checkUid),
    ...explicitCheckUids,
    ...inferredCheckUids,
  ]);

  if (checkUids.length === 0 && targetSlots.some((slot) => slot.kind === 'verification') && verificationPlan) {
    checkUids = uniqueStrings(verificationPlan.checks.map((check) => check.checkUid));
  }

  const relatedCheckUidSet = new Set(checkUids);
  const planStepUids = uniqueStrings([
    ...targetSlots.map((slot) => slot.planStepUid || ''),
    ...(verificationPlan?.checks || [])
      .filter((check) => relatedCheckUidSet.has(check.checkUid))
      .flatMap((check) => check.relatedPlanStepUids || []),
    ...(repair?.verifierResult?.failingChecks || []).flatMap((check) => check.relatedPlanStepUids || []),
  ]);
  const recipeSlugs = uniqueStrings([
    ...(planning.recipes || []).map((item) => item.recipe.slug),
    ...(planning.executionPlan?.matchedRecipeSlugs || []),
    ...(planning.verificationPlan?.matchedRecipeSlugs || []),
  ]);

  return {
    planStepUids,
    checkUids,
    recipeSlugs,
  };
}

function buildStructuredRepairOutputFormatSection(
  targetSlotUids: string[],
  context: StructuredRepairOutputContext
): string {
  return `
## Repair Output Contract（覆盖上文所有“输出纯 JS”要求）
1. 只返回一个严格 JSON 对象，结构必须为：
   - \`version: 1\`
   - \`patchedPlan: { planStepUids: [] }\`
   - \`patchedVerifier: { checkUids: [] }\`
   - \`patchedRecipeSelection: { recipeSlugs: [] }\`
   - \`slots: [{ slotUid, code }]\`
2. \`patchedPlan.planStepUids\` 只能从以下集合选择：${renderStructuredRepairOutputIds(context.planStepUids)}；如果本次没有改计划层，返回 \`[]\`。
3. \`patchedVerifier.checkUids\` 只能从以下集合选择：${renderStructuredRepairOutputIds(context.checkUids)}；如果本次没有改验收链，返回 \`[]\`。
4. \`patchedRecipeSelection.recipeSlugs\` 只能从以下集合选择：${renderStructuredRepairOutputIds(context.recipeSlugs)}；如果本次没有改 recipe 选择，返回 \`[]\`。
5. \`slots\` 必须且只能覆盖这些 targetSlots：${targetSlotUids.join(' / ') || '无'}。
6. \`code\` 不要包含 \`SLOT_START\` / \`SLOT_END\` / \`test(\` / \`test.step(\` / 代码围栏。
7. 不要输出解释、不要输出 markdown、不要输出额外字段。`;
}

function buildStructuredRepairOutput(
  patch: IntentExecutionRepairPatch,
  template: IntentCompiledExecutionTemplate,
  planning: ResolvedPromptPlanningContext,
  targetSlotUids: string[],
  options: {
    reusePreviousCode: boolean;
    baseCodeSource: IntentExecutionBaseCodeSource;
  }
): IntentExecutionStructuredRepairOutput {
  const slotDerivedPlanStepUids = uniqueStrings(
    patch.slots.flatMap((slot) => {
      const templateSlot = template.slots.find((item) => item.slotUid === slot.slotUid);
      return templateSlot?.planStepUid ? [templateSlot.planStepUid] : [];
    })
  );
  const planStepUids = uniqueStrings([...patch.patchedPlan.planStepUids, ...slotDerivedPlanStepUids]);
  const checkUids = uniqueStrings(patch.patchedVerifier.checkUids);
  const recipeSlugs = uniqueStrings(patch.patchedRecipeSelection.recipeSlugs);

  return {
    version: 1,
    strategy: 'deterministic_repair_patch_v1',
    targetSlotUids: [...targetSlotUids],
    returnedSlotUids: patch.slots.map((slot) => slot.slotUid),
    reusedPreviousCode: options.reusePreviousCode,
    baseCodeSource: options.baseCodeSource,
    patch: {
      version: 1,
      slots: patch.slots.map((slot) => ({
        slotUid: slot.slotUid,
        code: slot.code,
      })),
    },
    patchedPlan: {
      planStepUids,
      steps: (planning.executionPlan?.steps || [])
        .filter((step) => planStepUids.includes(step.planStepUid))
        .map((step) => ({
          planStepUid: step.planStepUid,
          title: step.title,
          preferredHelpers: [...step.preferredHelpers],
        })),
    },
    patchedVerifier: {
      checkUids,
      checks: (planning.verificationPlan?.checks || [])
        .filter((check) => checkUids.includes(check.checkUid))
        .map((check) => ({
          checkUid: check.checkUid,
          title: check.title,
          preferredHelpers: [...check.preferredHelpers],
          relatedPlanStepUids: [...check.relatedPlanStepUids],
          required: check.required,
        })),
    },
    patchedRecipeSelection: {
      recipeSlugs,
      recipes: (planning.recipes || [])
        .filter((item) => recipeSlugs.includes(item.recipe.slug))
        .map((item) => ({
          slug: item.recipe.slug,
          title: item.recipe.title,
          matchedSignals: [...item.matchedSignals],
        })),
    },
  };
}

function buildStructuredPatchFromRepairOutput(
  repairOutput: IntentExecutionStructuredRepairOutput
): IntentExecutionStructuredPatch {
  return {
    version: 1,
    strategy: 'deterministic_slot_patch_v1',
    targetSlotUids: [...repairOutput.targetSlotUids],
    returnedSlotUids: [...repairOutput.returnedSlotUids],
    reusedPreviousCode: repairOutput.reusedPreviousCode,
    baseCodeSource: repairOutput.baseCodeSource,
    patch: {
      version: 1,
      slots: repairOutput.patch.slots.map((slot) => ({
        slotUid: slot.slotUid,
        code: slot.code,
      })),
    },
  };
}

export function buildSlotPatchPrompt(
  snapshot: PageSnapshot,
  description: string,
  auth: AuthConfig | undefined,
  edgeCases: any[],
  existingExample: string,
  template: IntentCompiledExecutionTemplate,
  targetSlotUids: string[],
  currentCode: string,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext,
  repair?: RepairTestContext | null
): string {
  const resolvedPlanning =
    planning || resolveIntentPromptPlanningContext(snapshot, description, context, { auth, projectUid: context?.projectUid });
  const basePrompt = repair
    ? buildRepairPrompt(snapshot, description, auth, edgeCases, existingExample, repair, context, resolvedPlanning)
    : buildPrompt(snapshot, description, auth, edgeCases, existingExample, context, resolvedPlanning);
  const repairOutputContext = repair
    ? buildStructuredRepairOutputContext(template, targetSlotUids, resolvedPlanning, repair)
    : null;

  return `${basePrompt}
${renderTargetSlotPatchSection(template, targetSlotUids, currentCode, repair ? 'repair' : 'generate', repair)}
${repair && repairOutputContext
  ? buildStructuredRepairOutputFormatSection(targetSlotUids, repairOutputContext)
  : `
## 输出格式（覆盖上文所有“输出纯 JS”要求）
1. 只返回一个严格 JSON 对象，结构必须为：
   - \`version: 1\`
   - \`slots: [{ slotUid, code }]\`
2. \`slots\` 必须且只能覆盖这些 targetSlots：${targetSlotUids.join(' / ') || '无'}。
3. \`code\` 不要包含 \`SLOT_START\` / \`SLOT_END\` / \`test(\` / \`test.step(\` / 代码围栏。
4. 不要输出解释、不要输出 markdown、不要输出额外字段。`}`;
}

function formatPlanningKnowledgeHitMessage(prefix: string, planning: ResolvedPromptPlanningContext): string {
  const knowledge = planning.knowledge || { matches: [], deprioritizedMatches: [], capabilitySlugs: [] };
  if (knowledge.matches.length === 0) {
    return knowledge.deprioritizedMatches.length > 0
      ? `${prefix}未启用项目知识规则；另有 ${knowledge.deprioritizedMatches.length} 条规则因历史表现、观察期或回滚风险被降权跳过。`
      : `${prefix}未命中项目知识规则，继续使用通用 DSL。`;
  }

  const hitText = `${prefix}命中 ${knowledge.matches.length} 条项目知识规则：${knowledge.matches
    .slice(0, 3)
    .map((item) => item.title)
    .join(' / ')}`;
  return knowledge.deprioritizedMatches.length > 0
    ? `${hitText}；另有 ${knowledge.deprioritizedMatches.length} 条规则因历史表现、观察期或回滚风险被降权跳过。`
    : hitText;
}

function formatPlanningStarterHelperMessage(planning: ResolvedPromptPlanningContext): string {
  if (!planning.starterHelpers?.length) return '';
  const releasedCount = planning.starterHelpers.filter((item) => item.governanceReleaseStatus === 'released_from_suppressed').length;
  const pendingPromotionCount = planning.starterHelpers.filter((item) => Boolean(item.preferredPromotionStatus)).length;
  const weakRecoveryCount = planning.starterHelpers.filter(
    (item) => (item.governanceReleaseAutoRepairPassedCapabilityCount || 0) > 0
  ).length;
  return `项目 starter helper 建议：${planning.starterHelpers
    .slice(0, 3)
    .map((item) => item.helper)
    .join(' / ')}。${releasedCount > 0 ? `其中 ${releasedCount} 个来自 suppressed 治理恢复，只能按恢复观察层保守使用。` : ''}${
    pendingPromotionCount > 0 ? `另有 ${pendingPromotionCount} 个尚未满足 preferred 自动提级条件。` : ''
  }${weakRecoveryCount > 0 ? `其中 ${weakRecoveryCount} 个仍含自动 repair 弱恢复信号，不等于长期正向证据。` : ''}`;
}

function formatPlanningExperienceMessage(planning: ResolvedPromptPlanningContext): string {
  if (!planning.experienceHints?.length) return '';

  const successCount = planning.experienceHints.filter((item) => item.kind === 'successful_run').length;
  const failureCount = planning.experienceHints.filter((item) => item.kind === 'failed_run').length;
  const topSummary = planning.experienceHints[0]?.requestSummary || planning.experienceHints[0]?.scenarioTitle || '';

  return `最近相似经验：命中 ${planning.experienceHints.length} 条（success ${successCount}${failureCount > 0 ? ` / failure ${failureCount}` : ''}）${
    topSummary ? `；优先参考「${topSummary}」` : ''
  }。`;
}

function buildActionLibrarySection(
  snapshot: PageSnapshot,
  auth: AuthConfig | undefined,
  planning: ResolvedPromptPlanningContext
): string {
  const knowledge = planning.knowledge || { matches: [], deprioritizedMatches: [], capabilitySlugs: [] };
  const library = selectIntentActionLibrary({
    dsl: planning.dsl,
    auth,
    snapshot,
    priorityScenarioFamily: planning.priorityScenarioFamily,
    preferredCapabilitySlugs: [
      ...knowledge.capabilitySlugs,
      ...collectIntentStarterAssetCapabilitySlugs(planning.starterHelpers || []),
    ],
    starterHelpers: planning.starterHelpers,
  });

  const rendered = renderIntentActionLibrary(library);
  return rendered ? `
${rendered}` : '';
}

function looksLikeBusinessCreateOrderTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const intentHaystack = buildIntentHaystack(description, context);

  return (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    (intentHaystack.includes('生成订单') ||
      intentHaystack.includes('createorder') ||
      intentHaystack.includes('订单信息') ||
      intentHaystack.includes('签约成功') ||
      intentHaystack.includes('商机转订单') ||
      intentHaystack.includes('转订单') ||
      intentHaystack.includes('商机转化主链路') ||
      intentHaystack.includes('转化主链路') ||
      (intentHaystack.includes('商机转化') && intentHaystack.includes('主链路')))
  );
}

function looksLikeBusinessCreateTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const intentHaystack = buildIntentHaystack(description, context);
  const urlHaystack = [snapshot.url, context?.scenarioEntryUrl || ''].join('\n').toLowerCase();

  return (
    intentHaystack.includes('创建商机') ||
    intentHaystack.includes('新增商机') ||
    intentHaystack.includes('createbusiness') ||
    intentHaystack.includes('主链路提交') ||
    urlHaystack.includes('/business/createbusiness')
  );
}

function looksLikeBusinessBatchAddContactsTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const intentHaystack = buildIntentHaystack(description, context);
  const taskHaystack = buildTaskHaystack(snapshot, description, context);

  return (
    (intentHaystack.includes('批量加入通讯录') || (intentHaystack.includes('加入通讯录') && intentHaystack.includes('通讯录'))) &&
    (intentHaystack.includes('商机列表') || taskHaystack.includes('/business/businesslist') || taskHaystack.includes('首页商机列表'))
  );
}

function looksLikeCompanySearchTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const haystack = [
    buildTaskHaystack(snapshot, description, context),
    ...(snapshot.frames || []).flatMap((item) => [item.url, item.name, item.bodyTextExcerpt || '']),
  ]
    .join('\n')
    .toLowerCase();

  return (
    haystack.includes('搜企业') ||
    haystack.includes('/company/easyindex') ||
    haystack.includes('easysearchlist') ||
    haystack.includes('统一信用代码') ||
      haystack.includes('股东信息搜索企业')
  );
}

function looksLikeServiceCommissionConfigTask(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): boolean {
  const haystack = buildTaskHaystack(snapshot, description, context);
  const intentHaystack = buildIntentHaystack(description, context);

  return (
    (haystack.includes('/commission/subcommissionconfig') || haystack.includes('服务分佣配置')) &&
    intentHaystack.includes('分佣配置') &&
    (intentHaystack.includes('佣金比例') || intentHaystack.includes('分佣比例')) &&
    (intentHaystack.includes('商机创建人') || intentHaystack.includes('订单签单人') || intentHaystack.includes('企业引入人'))
  );
}

function extractCommissionSearchKeyword(description: string, context?: GenerateTestContext): string {
  const source = [description, context?.scenarioSummary || '', context?.expectedOutcome || ''].join('\n');
  const patterns = [
    /关键词\s*[:：]?\s*[“"']?([A-Za-z0-9_-]{1,32})[”"']?/i,
    /搜索\s*[“"']?([A-Za-z0-9_-]{1,32})[”"']?/i,
    /服务ID\s*[:：]?\s*([A-Za-z0-9_-]{1,32})/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return '';
}

function extractCommissionTargetRatio(description: string, context?: GenerateTestContext): string {
  const source = [description, context?.scenarioSummary || '', context?.expectedOutcome || ''].join('\n');
  const patterns = [
    /(?:改为|修改为|设置为|填写为|调整为)\s*([0-9]+(?:\.[0-9]+)?)\s*%/i,
    /佣金比例(?:[^0-9]{0,8})([0-9]+(?:\.[0-9]+)?)\s*%/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return '';
}

function extractCommissionRoleLabel(description: string, context?: GenerateTestContext): string {
  const source = [description, context?.scenarioSummary || '', context?.expectedOutcome || ''].join('\n');
  const labels = ['商机创建人', '订单签单人', '企业引入人'];
  return labels.find((label) => source.includes(label)) || '';
}

function extractEmbeddedExample(source: string): string {
  const match = source.match(/const GENERATED_CODE = String\.raw`([\s\S]*?)`;/);
  return match ? match[1].trim() : source;
}

type ExistingExampleCandidate = {
  filePath: string;
  embedded: boolean;
};

const RECIPE_FIRST_EXISTING_EXAMPLE_CANDIDATES: Record<string, ExistingExampleCandidate[]> = {
  'business.create-to-order': [
    { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-order-case.mjs'), embedded: true },
    { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-case.mjs'), embedded: true },
    { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
  ],
  'business.create': [
    { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-case.mjs'), embedded: true },
    { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
  ],
  'business.batch-add-contacts': [
    { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-batch-add-contacts-case.mjs'), embedded: true },
    { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
  ],
};

function pushUniqueExampleCandidates(
  target: ExistingExampleCandidate[],
  candidates: ExistingExampleCandidate[]
): void {
  const seen = new Set(target.map((item) => `${item.filePath}::${item.embedded ? 'embedded' : 'plain'}`));
  for (const candidate of candidates) {
    const key = `${candidate.filePath}::${candidate.embedded ? 'embedded' : 'plain'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(candidate);
  }
}

function listExistingExampleCandidates(
  snapshot: PageSnapshot,
  description: string,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext
): ExistingExampleCandidate[] {
  const candidates: ExistingExampleCandidate[] = [];
  const matchedRecipeSlugs = uniqueStrings((planning?.recipes || []).map((item) => item.recipe.slug));

  for (const slug of matchedRecipeSlugs) {
    const recipeCandidates = RECIPE_FIRST_EXISTING_EXAMPLE_CANDIDATES[slug];
    if (recipeCandidates?.length) {
      pushUniqueExampleCandidates(candidates, recipeCandidates);
    }
  }

  const legacyCandidates = looksLikeBusinessCreateOrderTask(snapshot, description, context)
    ? [
        { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-order-case.mjs'), embedded: true },
        { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-case.mjs'), embedded: true },
        { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
      ]
    : looksLikeBusinessCreateTask(snapshot, description, context)
    ? [
        { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-create-case.mjs'), embedded: true },
        { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
      ]
    : looksLikeBusinessBatchAddContactsTask(snapshot, description, context)
      ? [
          { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-business-batch-add-contacts-case.mjs'), embedded: true },
          { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
        ]
    : looksLikeCompanySearchTask(snapshot, description, context)
      ? [
          { filePath: path.join(ROOT, 'scripts', 'seed-yikaiye-company-search-case.mjs'), embedded: true },
          { filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false },
        ]
      : [{ filePath: path.join(ROOT, 'tests', 'e2e', 'product-create.spec.ts'), embedded: false }];

  pushUniqueExampleCandidates(candidates, legacyCandidates);
  return candidates;
}

async function loadExistingExample(
  snapshot: PageSnapshot,
  description: string,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext
): Promise<string> {
  const candidates = listExistingExampleCandidates(snapshot, description, context, planning);

  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate.filePath, 'utf8');
      return candidate.embedded ? extractEmbeddedExample(content) : content;
    } catch {
      // Try the next example source.
    }
  }

  return '';
}

function buildBusinessBatchAddContactsTemplate(): string {
  return String.raw`test('商机列表-随机勾选一个商机并批量加入通讯录', async ({ page }) => {
  const LOGIN_URL = 'https://uat-service.yikaiye.com/#/';
  const BUSINESS_LIST_URL = 'https://uat-service.yikaiye.com/#/business/businesslist';
  const MAILS_LIST_URL = 'https://uat-service.yikaiye.com/#/mails/mailslist';
  const USERNAME = process.env.E2E_USERNAME;
  const PASSWORD = process.env.E2E_PASSWORD;

  test.skip(!USERNAME || !PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD，无法执行短信验证码登录');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const smsTab = page.getByText(/短信验证码登录|短信登录/i).first();
  if (await smsTab.isVisible({ timeout: 10000 }).catch(() => false)) {
    await smsTab.click();
  }

  await page.getByPlaceholder(/请输入手机号|手机号|手机号码/i).first().fill(String(USERNAME).replace(/\s+/g, ''));
  await page.getByPlaceholder(/请输入验证码|验证码|获取验证码/i).first().fill(String(PASSWORD));
  await page.getByRole('button', { name: /登\s*录|登录|Login/i }).first().click();

  // 登录后先等待首页稳定，再切到商机列表，避免 hash 路由被首页初始化过程覆盖。
  await expect(page.getByRole('button', { name: '全部清除' })).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.goto(BUSINESS_LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.hash.includes('/business/businesslist'), { timeout: 30000 });
  await page.locator('#businessList_keywords').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('button', { name: '批量加入通讯录' }).waitFor({ state: 'visible', timeout: 30000 });
  const stageLabels = ['新入库', '需跟踪', '确认意向', '邀约成功', '面谈成功', '签约成功'];
  const normalizeRowText = (value) => value.replace(/\s+/g, ' ').trim();
  const escapeRegExp = (value) => value.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&');
  const collectPhones = (...sources) =>
    Array.from(
      new Set(
        sources
          .flatMap((source) => normalizeRowText(source).replace(/[^\d]/g, ' ').match(/1\d{10}/g) || [])
          .filter(Boolean)
      )
    );
  const extractBusinessId = (...sources) => {
    for (const source of sources) {
      const matches = normalizeRowText(source).replace(/[^\d]/g, ' ').match(/\b\d{6,12}\b/g) || [];
      const candidate = matches.find((item) => !/^1\d{10}$/.test(item));
      if (candidate) return candidate;
    }
    return '';
  };

  async function waitForRowsOrPlaceholder() {
    await page.waitForFunction(() => {
      const rowCount = document.querySelectorAll('.ant-table .ant-table-tbody > tr').length;
      return rowCount > 0 || Boolean(document.querySelector('.ant-table-placeholder'));
    }, { timeout: 30000 });
  }

  async function collectBusinessRows() {
    const rows = page.locator('.ant-table .ant-table-tbody > tr');
    const businessRows = [];
    const rowDebug = [];
    const seenPhones = new Set();
    const rowCount = await rows.count();
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      if ((await row.locator('.ant-checkbox').count()) === 0) continue;
      const rowKey = ((await row.getAttribute('data-row-key')) || '').trim();
      const linkTexts = (await row.locator('a').allInnerTexts())
        .map((item) => normalizeRowText(item))
        .filter(Boolean);
      const cellTexts = (await row.locator('td').allInnerTexts())
        .map((item) => normalizeRowText(item))
        .filter(Boolean);
      const rowText = normalizeRowText(await row.innerText());
      rowDebug.push({
        index: index + 1,
        rowKey,
        rowText: rowText.slice(0, 160),
      });
      const phone = collectPhones(rowKey, rowText, ...linkTexts, ...cellTexts).find((item) => !seenPhones.has(item)) || '';
      const businessId = extractBusinessId(rowKey, rowText, ...linkTexts, ...cellTexts);
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      businessRows.push({ row, phone, businessId });
      if (businessRows.length >= 10) break;
    }
    return { businessRows, rowDebug };
  }

  async function findPositiveStageCandidates() {
    return page.evaluate((labels) => {
      const bodyText = (document.body.innerText || '').replace(/\s+/g, ' ');
      return labels
        .map((label) => {
          const match = bodyText.match(new RegExp(label + '\\((\\d+)\\)'));
          return { label, count: match ? Number(match[1]) : 0 };
        })
        .filter((item) => item.count > 0)
        .sort((left, right) => right.count - left.count);
    }, stageLabels);
  }

  await waitForRowsOrPlaceholder();
  await page.waitForTimeout(1500);

  let { businessRows, rowDebug } = await collectBusinessRows();
  let selectedStage = '';
  let positiveStages = [];
  if (businessRows.length === 0) {
    positiveStages = await findPositiveStageCandidates();
    for (const stage of positiveStages) {
      const stageChip = page.getByText(new RegExp(escapeRegExp(stage.label) + '\\(' + stage.count + '\\)')).first();
      if (!(await stageChip.isVisible({ timeout: 3000 }).catch(() => false))) continue;
      await stageChip.click({ timeout: 10000 });
      selectedStage = stage.label;
      await page.waitForFunction(() => document.querySelectorAll('.ant-table .ant-table-tbody > tr').length > 0, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
      ({ businessRows, rowDebug } = await collectBusinessRows());
      if (businessRows.length > 0) break;
    }
  }

  if (businessRows.length === 0) {
    console.log('[BATCH-CONTACTS-STAGE-DEBUG]', JSON.stringify(positiveStages));
    const sampledRows = rowDebug.slice(0, 8);
    console.log('[BATCH-CONTACTS-ROW-DEBUG]', JSON.stringify({ selectedStage, sampledRows }));
  }
  expect(businessRows.length).toBeGreaterThan(0);

  let selected = null;
  for (const candidate of businessRows) {
    try {
      await __e2e.clickAntdRowCheckbox(page, candidate.row, { timeoutMs: 5000 });
      selected = candidate;
      break;
    } catch (error) {
      console.log(
        '[BATCH-CONTACTS-CHECKBOX-DEBUG]',
        JSON.stringify({
          phone: candidate.phone,
          businessId: candidate.businessId || '',
          error: error instanceof Error ? error.message : String(error || ''),
        })
      );
    }
  }

  expect(Boolean(selected)).toBeTruthy();
  const targetRow = selected.row;
  const targetPhone = selected.phone;

  await page.getByRole('button', { name: '批量加入通讯录' }).click();

  const feedback = page
    .locator('.ant-message-notice, .ant-notification-notice')
    .filter({ hasText: /加入通讯录|通讯录/ })
    .first();
  await expect(feedback).toBeVisible({ timeout: 15000 });
  const feedbackText = (await feedback.innerText()).replace(/\s+/g, ' ').trim();
  expect(/加入通讯录|已存在您的通讯录|未成功加入通讯录/.test(feedbackText)).toBeTruthy();

  // 某些联系人本来就已存在通讯录，因此最终以“通讯录里能检索到该手机号”为主断言。
  await page.goto(MAILS_LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.hash.includes('/mails/mailslist'), { timeout: 30000 });
  await expect(page.locator('body')).toContainText('我的联系人', { timeout: 30000 });
  await page.locator('#mail-list_keywords').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#mail-list_keywords').fill(targetPhone);
  await page.getByRole('button', { name: /搜\s*索/ }).first().click();
  await page.waitForTimeout(3000);

  await expect(page.locator('body')).toContainText(targetPhone, { timeout: 30000 });
});`;
}

function buildServiceCommissionConfigTemplate(snapshot: PageSnapshot, description: string, context?: GenerateTestContext): string {
  const targetUrl = context?.scenarioEntryUrl || snapshot.url;
  const keyword = extractCommissionSearchKeyword(description, context);
  const targetRatioValue = extractCommissionTargetRatio(description, context);
  const targetRole = extractCommissionRoleLabel(description, context) || '商机创建人';

  if (!targetUrl.trim() || !keyword || !targetRatioValue) return '';

  return `test('服务分佣配置：按关键词修改佣金比例并校验结果', async ({ page }) => {
  const TARGET_URL = ${JSON.stringify(targetUrl)};
  const SEARCH_KEYWORD = ${JSON.stringify(keyword)};
  const TARGET_ROLE = ${JSON.stringify(targetRole)};
  const TARGET_RATIO_VALUE = ${JSON.stringify(targetRatioValue)};

  test.skip(
    !process.env.E2E_USERNAME || !process.env.E2E_PASSWORD,
    '缺少 E2E_USERNAME / E2E_PASSWORD'
  );

  const normalizeRatio = (value) => String(value || '').replace(/\\s+/g, '').replace(/%$/, '');

  await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });
  await page.waitForURL(/#\\/commission\\/subCommissionConfig/, { timeout: 60000 });
  await expect(page.locator('#service-data-item_keyWord')).toBeVisible({ timeout: 30000 });
  const searchButton = page.getByRole('button', { name: /搜\\s*索/ }).first();
  await expect(searchButton).toBeVisible({ timeout: 15000 });

  const keywordInput = page.locator('#service-data-item_keyWord');
  const targetRow = page.locator('.ant-table .ant-table-tbody > tr').filter({ hasText: SEARCH_KEYWORD }).first();
  const searchErrorToast = page
    .locator('.ant-message-notice, .ant-notification-notice')
    .filter({ hasText: /服务开小差|稍后重试|服务异常/i })
    .last();

  async function waitForSearchOutcome() {
    await page.waitForTimeout(1200);
    if (await targetRow.isVisible().catch(() => false)) return 'row';
    if (await searchErrorToast.isVisible().catch(() => false)) return 'error';
    if (await page.locator('.ant-table-placeholder').first().isVisible().catch(() => false)) return 'empty';

    return await page
      .waitForFunction(
        (keyword) => {
          const rows = Array.from(document.querySelectorAll('.ant-table .ant-table-tbody > tr'));
          if (rows.some((row) => String(row.innerText || '').includes(keyword))) return 'row';

          const toastText = Array.from(document.querySelectorAll('.ant-message-notice, .ant-notification-notice'))
            .map((node) => String(node.textContent || ''))
            .join(' ');
          if (/服务开小差|稍后重试|服务异常/i.test(toastText)) return 'error';
          if (document.querySelector('.ant-table-placeholder')) return 'empty';
          return '';
        },
        SEARCH_KEYWORD,
        { timeout: 12000 }
      )
      .then((handle) => handle.jsonValue())
      .catch(() => '');
  }

  let searchOutcome = '';
  for (let searchAttempt = 1; searchAttempt <= 3; searchAttempt += 1) {
    await keywordInput.fill(SEARCH_KEYWORD);
    await searchButton.click();
    searchOutcome = String((await waitForSearchOutcome()) || '');
    if (searchOutcome === 'row') break;

    if (searchAttempt < 3 && (!searchOutcome || searchOutcome === 'error' || searchOutcome === 'empty')) {
      await page.waitForTimeout(1000 * searchAttempt);
      continue;
    }
  }

  if (!(await targetRow.isVisible().catch(() => false))) {
    if (searchOutcome === 'error') {
      throw new Error('搜索结果接口暂时异常，页面提示“服务开小差了，请稍后重试...”');
    }
    if (searchOutcome === 'empty') {
      throw new Error('关键词 ' + SEARCH_KEYWORD + ' 当前未返回任何服务数据');
    }
  }

  await expect(targetRow).toBeVisible({ timeout: 10000 });

  await __e2e.clickAntdRowAction(page, targetRow, '分佣配置');

  const modal = await __e2e.waitForVisibleAntdModal(page, {
    titleIncludes: '服务分佣配置',
    timeoutMs: 30000,
  });

  const roleRow = modal.locator('tr').filter({ hasText: TARGET_ROLE }).first();
  await expect(roleRow).toBeVisible({ timeout: 15000 });

  const ratioInput = roleRow.locator('input').first();
  await expect(ratioInput).toBeVisible({ timeout: 15000 });

  const beforeRatio = normalizeRatio(await ratioInput.inputValue());
  if (beforeRatio !== TARGET_RATIO_VALUE) {
    await ratioInput.click();
    await ratioInput.fill(TARGET_RATIO_VALUE);
    await ratioInput.press('Tab');

    const afterRatio = normalizeRatio(await ratioInput.inputValue());
    expect(afterRatio).toBe(TARGET_RATIO_VALUE);

    const saveButton = page.getByRole('button', { name: /保\\s*存/ }).last();
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    await saveButton.click();

    const successToast = page
      .locator('.ant-message-notice .ant-message-custom-content')
      .filter({ hasText: /保存成功|修改成功|success/i })
      .last();
    const saveOutcome = await Promise.any([
      successToast.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'toast'),
      expect(modal).toBeHidden({ timeout: 30000 }).then(() => 'closed'),
      page
        .waitForFunction(
          ({ role, targetValue }) => {
            const normalize = (value) => String(value || '').replace(/\\s+/g, '').replace(/%$/, '');
            const containers = Array.from(document.querySelectorAll('.ant-drawer-content, .ant-modal-content'));
            const visibleContainer = containers.find((node) => {
              if (!(node instanceof HTMLElement)) return false;
              const style = window.getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || '1') !== 0 && rect.width > 0 && rect.height > 0;
            });
            if (!(visibleContainer instanceof HTMLElement)) return false;

            const rows = Array.from(visibleContainer.querySelectorAll('tr'));
            const targetRow = rows.find((row) => String(row.innerText || '').includes(role));
            if (!(targetRow instanceof HTMLElement)) return false;

            const input = targetRow.querySelector('input');
            return normalize(input?.value || '') === targetValue;
          },
          { role: TARGET_ROLE, targetValue: TARGET_RATIO_VALUE },
          { timeout: 20000 }
        )
        .then(() => 'retained'),
    ]).catch(() => '');

    if (!saveOutcome) {
      throw new Error('保存后未观察到成功提示、抽屉关闭或佣金值保留为目标值');
    }
  } else {
    expect(beforeRatio).toBe(TARGET_RATIO_VALUE);
  }
});`;
}

type DeterministicRecipeTemplateInput = {
  snapshot: PageSnapshot;
  description: string;
  existingExample: string;
  context?: GenerateTestContext;
};

const RECIPE_FIRST_TEMPLATE_RESOLVERS: Record<string, (input: DeterministicRecipeTemplateInput) => string> = {
  'business.batch-add-contacts': () => buildBusinessBatchAddContactsTemplate(),
  'commission.service-ratio-config': ({ snapshot, description, context }) =>
    buildServiceCommissionConfigTemplate(snapshot, description, context),
  'business.create-to-order': ({ snapshot, description, existingExample, context }) =>
    looksLikeBusinessCreateOrderTask(snapshot, description, context) ? existingExample.trim() : '',
};

function resolveDeterministicRecipeTemplate(
  snapshot: PageSnapshot,
  description: string,
  existingExample: string,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext
): string {
  const matchedRecipeSlugs = uniqueStrings((planning?.recipes || []).map((item) => item.recipe.slug));

  for (const slug of matchedRecipeSlugs) {
    const resolver = RECIPE_FIRST_TEMPLATE_RESOLVERS[slug];
    if (!resolver) continue;

    const template = resolver({ snapshot, description, existingExample, context }).trim();
    if (template) return template;
  }

  return '';
}

export function resolveDeterministicTemplate(
  snapshot: PageSnapshot,
  description: string,
  existingExample: string,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext
): string {
  const recipeTemplate = resolveDeterministicRecipeTemplate(snapshot, description, existingExample, context, planning);
  if (recipeTemplate) return recipeTemplate;

  if (looksLikeBusinessBatchAddContactsTask(snapshot, description, context)) {
    return buildBusinessBatchAddContactsTemplate();
  }

  if (looksLikeServiceCommissionConfigTask(snapshot, description, context)) {
    return buildServiceCommissionConfigTemplate(snapshot, description, context);
  }

  if (!existingExample.trim()) return '';

  if (looksLikeBusinessCreateOrderTask(snapshot, description, context)) {
    return existingExample.trim();
  }

  return '';
}

function clampText(value: string, maxLength = 420): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function buildFieldDigestFromForms(
  forms: Array<{ fields: Array<{ label: string; placeholder: string; id: string; name: string; required: boolean }> }>
): string {
  const lines = forms
    .flatMap((form) => form.fields)
    .map((field) => {
      const parts = [
        field.label ? `label=${field.label}` : '',
        field.placeholder ? `placeholder=${field.placeholder}` : '',
        field.id ? `id=${field.id}` : '',
        field.name ? `name=${field.name}` : '',
        `required=${field.required ? 'yes' : 'no'}`,
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .filter(Boolean)
    .slice(0, 25);

  return lines.length > 0 ? lines.map((line) => `  - ${line}`).join('\n') : '  - 无';
}

function buildFieldDigest(snapshot: PageSnapshot): string {
  return buildFieldDigestFromForms(snapshot.forms);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeSingleQuotedJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildFrameLocatorHints(frame: NonNullable<PageSnapshot['frames']>[number]): { selectorCode: string; urlCode: string } {
  const selectorCode = frame.selectorHint?.trim()
    ? `page.frameLocator('${escapeSingleQuotedJs(frame.selectorHint.trim())}')`
    : '';

  let urlCode = '';
  try {
    const parsed = new URL(frame.url);
    const token = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
    if (token) {
      urlCode = `page.frames().find((item) => /${escapeRegExp(token)}/i.test(item.url()))`;
    }
  } catch {
    // ignore malformed frame urls
  }

  return { selectorCode, urlCode };
}

function buildFrameSection(snapshot: PageSnapshot): string {
  if (!snapshot.frames?.length) return '';

  return snapshot.frames
    .map((frame, index) => {
      const hints = buildFrameLocatorHints(frame);
      return `\n### Iframe ${index + 1}
- 名称: ${frame.name || '(anonymous)'}
- URL: ${frame.url}
- DOM id: ${frame.elementId || '(none)'}
- DOM name: ${frame.elementName || '(none)'}
- 定位建议: ${hints.selectorCode || '(none)'}
- URL 匹配建议: ${hints.urlCode || '(none)'}
- 字段摘要:
${buildFieldDigestFromForms(frame.forms)}
- 按钮（前20）: ${JSON.stringify((frame.buttons || []).slice(0, 20), null, 2)}
- 带 tooltip/aria-label 的元素（前20）: ${JSON.stringify((frame.tooltipElements || []).slice(0, 20), null, 2)}
- 标题层级: ${JSON.stringify(frame.headings || [], null, 2)}
- 链接(前20): ${JSON.stringify((frame.links || []).slice(0, 20), null, 2)}
- 正文摘录: ${clampText(frame.bodyTextExcerpt || '', 800)}`;
    })
    .join('\n');
}

function buildSnapshotSection(title: string, snapshot: PageSnapshot): string {
  return `\n## ${title}
- URL: ${snapshot.url}
- 标题: ${snapshot.title}
- 字段摘要:
${buildFieldDigest(snapshot)}
- 表单: ${JSON.stringify(snapshot.forms, null, 2)}
- 按钮（含图标按钮）: ${JSON.stringify(snapshot.buttons, null, 2)}
- 带 tooltip/aria-label 的元素（注意：有些按钮是纯图标，文字在 title 或 aria-label 中）: ${JSON.stringify(snapshot.tooltipElements || [], null, 2)}
- 标题层级: ${JSON.stringify(snapshot.headings)}
- 链接(前20): ${JSON.stringify(snapshot.links)}
- 页面正文摘录: ${clampText(snapshot.bodyTextExcerpt || '', 800)}
${buildFrameSection(snapshot)}

注意：
1. 图标按钮（isIconOnly=true）没有可见文字，应使用 title/aria-label 来定位：
   - page.getByTitle('提示文字')
   - page.getByLabel('aria标签')
   - page.locator('[title="提示文字"]')
2. 带 [hover-tooltip] 标记的元素是鼠标悬停才出现 tooltip 的按钮（如 Ant Design Tooltip），
   这类按钮不能用 getByText 找，应通过 CSS 类名或位置定位，然后 hover 触发 tooltip：
   - 先用 page.locator('.类名') 定位按钮
   - 再用 await btn.hover() 触发 tooltip
   - 然后用 page.locator('.ant-tooltip-inner') 或 page.getByRole('tooltip') 验证 tooltip 内容
3. 如果字段摘要 / 表单 JSON 里已经给出了精确的 label、placeholder、id，必须优先使用这些原始文案或属性，不要自行改写成近义词。
4. 如果快照里包含 Iframe 摘要，说明真实控件可能不在顶层页面；必须先切换到对应 frame，再在 frame 内找 placeholder、按钮和结果列表。
5. 如果 Iframe 摘要已经给出了“定位建议”或 DOM id，优先使用这些精确 selector；不要凭空假设 iframe 的 name 属性。`;
}

function renderRepairObservationReportSection(report?: RepairObservationReport): string {
  if (!report?.probes?.length) return '';

  return `
## Repair Observation Protocol（受控观察结果）
- observedAt: ${report.observedAt || '未记录'}
- pageUrl: ${report.pageUrl || '未记录'}
- pageTitle: ${report.pageTitle || '未记录'}
${report.probes
  .map(
    (probe, index) => `${index + 1}. [${probe.probeUid}] ${probe.kind} · ${probe.status}
   - summary: ${probe.summary || '无'}
   - evidence: ${probe.evidence.join(' / ') || '无'}`
  )
  .join('\n')}

使用边界：
1. 只能基于以上受控观察结果修补 locator、frame 进入方式、helper 选择和断言，不要臆造未观察到的新 DOM 契约。
2. 如果 \`surface_delta\` 已明确提示新增 / 消失的 surface，优先沿这些真实变化修补页面切换、入口控件和断言锚点，不要继续死守旧页面的 locator。
3. 如果 \`list_json_evidence\` 已显示上一轮拿到过列表 JSON、record match 或字段值，优先复用这些路径和 label 修补回查链，不要再发明第二套模糊搜索。
4. 如果 \`detail_field_evidence\` 已显示上一轮读到过详情字段，优先沿相同 label / matchedLabel / value preview 修补详情断言，不要把字段名改写成新的近义词。
5. 如果 \`anchor_presence\` / \`candidate_anchor_presence\` 都显示 \`not_found\`，优先暴露真实漂移或回退到候选锚点，而不是虚构成功路径。
6. 如果 \`frame_probe\` 显示存在 frame 线索，优先确认是否缺少 \`__e2e.getFrame(...)\` 或 frame 内定位。`;
}

export function buildPrompt(
  snapshot: PageSnapshot,
  description: string,
  auth: AuthConfig | undefined,
  edgeCases: any[],
  existingExample: string,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext
): string {
  const parts: string[] = [];
  const resolvedPlanning =
    planning || resolveIntentPromptPlanningContext(snapshot, description, context, { auth, projectUid: context?.projectUid });

  parts.push('你是一个 Playwright E2E 测试专家。请根据以下信息生成完整可执行的 Playwright 测试代码。');
  const verificationIntentSection = buildVerificationIntentSection(resolvedPlanning);
  if (verificationIntentSection) {
    parts.push(verificationIntentSection);
  }

  parts.push(buildSnapshotSection(context?.taskMode === 'scenario' ? '业务流入口页面信息' : '目标页面信息', snapshot));
  if (context?.repairObservationSnapshot) {
    parts.push(buildSnapshotSection('Repair 观察快照（最新受控观察）', context.repairObservationSnapshot));
  }
  if (context?.repairObservationReport) {
    parts.push(renderRepairObservationReportSection(context.repairObservationReport));
  }

  parts.push(`\n## 列表页与批量操作规则
1. 对列表页，非必要不要点击“全部清除”“重置”等会重载筛选状态的按钮；先观察页面是否已经有可用数据。
2. 如果任务描述要求批量操作，优先考虑“勾选行 + 顶部批量按钮”的真实入口，不要臆造不存在的行内按钮。
3. 从列表行提取关键主键时，优先使用明确的链接文本、编号列或字段标签，不要用宽泛正则从整行文本中猜测，以免误取手机号、企业 ID 或金额。
4. 如果目标行没有可见的“查看 / 编辑 / 生成订单”按钮，而是只有末列三点菜单或 \`.ant-dropdown-trigger\` 图标，必须先打开该行操作菜单，再在当前可见 menu 内点击目标动作。
5. 对 Ant Design 表格，禁止先写 \`expect(page.locator('.ant-table-tbody')).toBeVisible()\` 这类表体可见性断言；固定列、粘性列和克隆节点会让 \`.ant-table-tbody\` 同时命中多个元素。应直接等待目标行、表格请求完成，或等待 \`.ant-table-placeholder\` / 行数变化。
6. 对 Ant Design 表格目标行，优先使用 \`__e2e.findAntdTableRow(page, { hasTexts: [...] })\`；至少组合手机号、联系人、状态、businessId、企业名中的两个以上稳定字段，让 helper 按 \`data-row-key\` 去重固定列克隆。不要继续对 \`page.locator('tbody tr').filter({ hasText: ... }).first()\` 写 \`toHaveCount(1)\` 或硬编码 \`.first()\`。`);

  parts.push(`\n## 下拉与重复文案规则
1. 遇到 Ant Design Select / Cascader / TreeSelect / 弹层枚举项时，必须先定位到当前可见的弹层容器，再在容器内选择选项，例如：
   - const dropdown = page.locator('.ant-select-dropdown:visible').last();
   - 普通 Select 可写 await dropdown.getByText('抖音', { exact: true }).first().click();
   - TreeSelect / 树节点枚举优先写 await dropdown.locator('.ant-select-tree-node-content-wrapper[title="抖音"]').first().click();
2. 禁止在打开下拉后直接写 page.getByText('抖音', { exact: true }).click()、page.getByText('男', { exact: true }).click() 这类全局文本点击。
3. 如果下拉实际是 TreeSelect / 树形枚举，不要只靠 getByText('枚举值')；优先使用 title 属性、tree node wrapper 或树节点 class 做精确定位。对下拉容器优先使用 \`.ant-select-dropdown:visible\`，不要依赖 \`.ant-select-dropdown-hidden\` 这类 class 判断动画中的可见性。
4. 对长列表/树形下拉，选项可能已经在 DOM 中但初始不在当前滚动可视区，尤其是在 1280x720 视口下。不要一打开下拉就直接 expect(option).toBeVisible()；应优先：
   - 先找 dropdown 内的搜索框：const searchInput = dropdown.locator('input.ant-select-search__field').first();
   - 如果搜索框可见，先 fill('枚举值') 缩小范围；
   - 对目标 option 先执行 await option.scrollIntoViewIfNeeded(); 再 click。
5. 如果第一次点击 select wrapper 后没有出现可见 dropdown，不要重复等待同一个 hidden dropdown；应在当前 form-item 内依次尝试 \`.ant-select-selection\`、\`.ant-select-selector\`、\`.ant-select\`、\`[role="combobox"]\`，每次点击后短暂等待并重新查询 \`.ant-select-dropdown:visible\`。
6. 对“抖音”“男”“确定”“保存并继续”“提交”“疑难工商注销”这类高重复文案，必须先缩小到字段所在 form-item、当前 modal、当前 row 或当前可见 dropdown；如仍重复，明确写 .first() 或 .last() 消歧。
7. 表格断言和操作必须先定位到目标行，再在该行内断言或点击，禁止对整页同名文本做全局断言。`);

  parts.push(`\n## 运行时内置 Helper
执行环境已内置 \`__e2e\`，处理 Ant Design 下拉时优先直接复用，不要手写脆弱的 click + waitForTimeout + dropdown 查询：
1. 查找当前真正可见的下拉：
   - const dropdown = await __e2e.findVisibleAntdDropdown(page);
2. 在字段所在 form-item / row 内稳妥打开下拉：
   - const dropdown = await __e2e.openAntdDropdown(page, sourceRow, { settleMs: 300 });
3. 直接选择普通 Select / TreeSelect 选项：
   - await __e2e.selectAntdOption(page, sourceRow, { label: '抖音', tree: true });
   - await __e2e.selectAntdOption(page, companyRow, { label: '中铁上海工程局集团有限公司(91310000566528939E)', searchText: '中铁上海工程局集团有限公司' });
4. 如果当前字段实际是 row 内 radio / segmented / tab 风格枚举（例如“性别=男/女”），也继续直接用 \`__e2e.selectAntdOption(page, scopedRow, { label: '男' })\`；helper 会先尝试当前 row 内的可见枚举，再处理真实 dropdown，不要手写 \`getByText('男').click()\` 或强行先开 dropdown。
5. 如果是长列表 / 树形枚举，优先通过 \`searchText\` 缩小范围，再由 helper 负责 scrollIntoViewIfNeeded() 和点击。
6. 对“企业名称”这类远程搜索 Select，点击 wrapper 后不一定立刻出现候选；必须传 \`searchText\`，helper 会先聚焦字段并输入关键词，再等待候选返回。
7. 对 Ant Design 表格目标行，优先直接写：
   - const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [targetPhone, targetName, '新入库'] });
   - helper 会优先选主表体可见行，并按 \`data-row-key\` 去重固定列 / 粘性列克隆；不要继续写 \`page.locator('tbody tr').filter({ hasText: ... }).first()\`，也不要再对它做 \`toHaveCount(1)\`。
8. 对列表行末尾只有三点菜单 / \`.ant-dropdown-trigger\` 的场景，优先直接写：
   - await __e2e.clickAntdRowAction(page, targetRow, '生成订单');
   - await __e2e.clickAntdRowAction(page, targetRow, '查看');
9. 只要场景是 Ant Design 下拉、Ant Design 表格目标行定位或 Ant Design 行操作菜单，默认先考虑 \`__e2e.openAntdDropdown\` / \`__e2e.selectAntdOption\` / \`__e2e.findAntdTableRow\` / \`__e2e.clickAntdRowAction\`，除非页面控件明显不是该类组件。`);
  parts.push(`9. 对商机列表“我创建的 / 我跟进的 / 归属 / 范围”视角切换，优先直接写：
   - await __e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL });
   - helper 会先尝试 tab / radio / segmented，再尝试顶部归属 dropdown，最后回退到筛选区 dropdown；不要继续手写 \`getByText('我创建的')\` 或 form-item 正则猜控件形态。
   - helper 自己会处理“当前已经是目标视角”和切换后的 settle；默认直接调用 helper，不要在外层无条件包一层 \`waitForApiResponse\`。
   - 不要写 \`const listResp = __e2e.waitForApiResponse(...); await __e2e.switchBusinessListOwnershipView(...); await listResp;\` 这种固定链；如果当前本来就是目标视角，helper 会直接返回，不会再触发新的 GET，这条等待会超时。
   - helper 返回后，不要再补 \`.ant-tabs-tab-active\` / \`.ant-radio-button-wrapper-checked\` / \`.ant-select-selection-selected-value\` 这类 active-locator 断言，也不要再对整页 \`getByText('我创建的')\` 写 \`toBeVisible()\`；helper 成功本身就说明归属切换已收敛。
   - 如果还需要辅助收敛证据，只允许检查当前 URL 已回列表、可见搜索框 / 列表 ready，或直接进入后续搜索 / 回查；不要把“选中态 class 可见”当成业务成功标准。
   - 只有脚本已经先确认当前不是目标视角、且这次切换请求本身就是必须消费的证据时，才允许在 helper 前注册 wait promise；更稳妥的是把后续搜索/回查接口当成最终列表证据。`);
  parts.push(`9.1 如果当前步骤只是“进入商机列表页并确认页面就绪”，不要直接写 \`await expect(page.getByText('我创建的').first()).toBeVisible(...)\`。优先用 \`page.getByRole('button', { name: '新建商机' }).first()\`、\`page.locator('input#businessList_keywords:visible').first()\` 或列表容器确认 surface ready；真正的“我创建的 / 我跟进的”视角切换留给 \`__e2e.switchBusinessListOwnershipView(...)\` 所在步骤。`);
  parts.push(`10. 对标题会拼接实体名称的 Ant Design 弹框，优先直接写：
   - const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '服务分佣配置' });
   - 然后在 \`modal\` 内断言标题后缀、表单行和保存按钮；不要对完整标题做精确匹配。`);
  parts.push(`11. 对保存 / 提交 / 生成订单后的收敛，优先把接口等待和 submit-state helper 配对使用：
   - const saveResp = __e2e.waitForApiResponse(page, { urlIncludes: '/api/customer/save', method: 'POST' });
   - await saveButton.click();
   - await saveResp;
   - await __e2e.observeSubmitState(page, { submitButton: saveButton, closeLocator: modal, urlIncludes: '#/customer/list' });
   - const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [customerName, customerPhone] });
   - await expect(targetRow).toContainText(customerName);
   - helper 会继续观察按钮 loading、Drawer/Modal 关闭、URL/列表结果稳定；不要只写 \`page.getByText(/成功/i).first()\`。
   - 只对最终“保存 / 提交 / 确定 / 生成订单”主动作套用这条链；对中间步骤的“保存并继续 / 下一步”，如果接口名不明确，优先点击后等待下一块表单标题、字段或步骤锚点出现，不要臆造宽泛 \`/business\` POST 等待。
   - 如果提交响应里已经拿到 \`businessId\` / \`orderId\` / \`id\`，优先用可见搜索框按主键检索，再等待列表查询接口完成；不要一上来继续放宽姓名 / 手机号匹配。
   - 如果 \`businessId\` / \`orderId\` 这类共享稳定标识提取为空，不要立刻写 \`expect(variable).toBeTruthy()\`；保持变量为空，继续用手机号 / 联系人 / 状态等稳定文本完成列表或详情终态验收。
   - 如果成功结果落在 Ant Design 列表里，不要把 \`successLocator\` 写成裸 \`tbody tr\` 过滤；先让 helper 收敛页面，再用 \`__e2e.findAntdTableRow\` 做最终行断言。
   - 如果按主键检索后的 \`findAntdTableRow\` 仍未命中，不要无限重试表格文本匹配；优先读取列表搜索响应里的目标记录，或直接跳详情页 / 详情抽屉做终态断言。
   - 如果提交后“可能自动回列表，也可能仍停留当前页再由脚本手动返回”，\`urlIncludes\` 只能当辅助观察；helper 后仍要显式检查当前 URL，不匹配时再走 breadcrumb / \`page.goto(...)\` 回退，再继续做“我创建的 / 我跟进的”归属切换和列表回查。`);
  parts.push(`11.1 对多步表单 / Ant Tabs 最后一页的“保存 / 提交”，不要直接写 \`page.getByRole('button', { name: /保\\s*存|提\\s*交/i }).first()\`，更不要把最终主动作固化成 \`getByRole('button', { name: /^保\\s*存$/ }).first()\`。必须先收窄到当前可见 \`.ant-tabs-tabpane-active\` / 当前步骤容器 / 当前 Modal / Drawer 内，先尝试定位 \`/保\\s*存|提\\s*交|确\\s*定/i\` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 \`page.getByRole(...).last()\`，而是改成准备少量 \`candidateContainers\`，至少覆盖末页锚点附近容器、\`attachmentAnchor\` 的祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 \`保存并继续\` / \`上一步\`。footer/action-bar 这类 selector 不要统一写成 \`.first()\`；每类 selector 至少枚举前 2-3 个可见命中，依次 push 进 \`candidateContainers\`。如果这些 scoped 容器都 miss，但 \`attachmentAnchor\` 已可见，只允许额外尝试一次更窄的 \`page.getByRole('button', { name: /^提\\s*交$/ }).first()\`；不要把 selector 锁死在 \`.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible\` 这类单一路径。\`attachmentAnchor\` 刚 visible 时底部 action bar 可能还在异步挂载，不要只跑一轮 \`count()\` 就立刻 throw；给 scoped candidate scan + exact submit fallback 一个 3-5 秒的短时轮询窗口（例如每 200ms 重试一次），命中后再 \`scrollIntoViewIfNeeded()\`。如果点击日志已经是 \`subtree intercepts pointer events\`，只允许对这个已收窄的按钮使用 \`click({ force: true })\`，不要对整页模糊按钮直接 force，也不要把 \`保存并继续\` 误当成最终提交。`);
  parts.push(`12. 对接口 JSON 里的共享变量/主键提取，优先直接复用：
   - const createJson = await __e2e.readJsonResponse(await createResp);
   - const businessId = __e2e.pickJsonValue(createJson, { label: 'businessId', paths: ${renderJsStringArray(BUSINESS_ID_JSON_PATHS)} });
   - const orderId = __e2e.pickJsonValue(createJson, { label: 'orderId', paths: ${renderJsStringArray(ORDER_ID_JSON_PATHS)}, required: false });
   - 对 \`businessId / orderId / id\` 这类主键，不要继续手写一长串 \`foo?.bar?.id || foo?.id || ...\` 猜测路径；优先让 helper 统一提取并给出清晰失败日志。`);
  parts.push(`12.1 这套共享变量提取链不只适用于 \`businessId / orderId\`：
   - 对 \`recordUid / customerCode / serialNo / bizNo\` 这类共享稳定标识，也优先继续用 \`__e2e.readJsonResponse(...)\` + \`__e2e.pickJsonValue(...)\` 提取，不要退回多段可选链或整页文本猜测。
   - 目标是统一围绕“共享稳定标识”组织后续列表回查与详情校验，而不是把 helper 限死在 CRM 的 \`businessId / orderId\`。`);
  parts.push(`13. 对“已拿到 businessId / orderId，再回列表检索并在必要时回退详情”的验收链，优先直接复用：
   - 如果你刚切完“我创建的 / 我跟进的”或刚回到列表页，不要看到搜索框就立刻填值搜索；先短超时检查当前可见列表是否已经出现目标行，例如 \`const currentVisibleRow = primaryValue ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 }); } catch { return null; } })() : null;\`。若 \`currentVisibleRow\` 已命中，先把它当作 \`table_row\` 身份证据继续做状态 / 详情校验；只有当前可见列表未命中时，才调用 \`__e2e.resolvePrimaryRecord(...)\` 触发关键词搜索。
   - 一旦准备把 \`keywordInput / searchButton\` 传给 \`__e2e.resolvePrimaryRecord(...)\`，就不要在同一分支先手写 \`await keywordInput.fill(primaryValue)\`、\`await searchButton.click()\` 或任何预搜索，再让 helper 重复搜索；helper 会自己负责这次检索。预搜索 + helper 再搜索很容易触发双重刷新、重复列表接口，甚至把页面自身打进 \`Cannot read properties of null (reading 'forEach')\` 这类前端异常。
   - 如果最终目标只是拿到列表命中行或复用已缓存的 \`artifacts['plan_step_x_row'] / recordCheck\`，不要再手写 \`const searchResp = __e2e.waitForApiResponse(page, { urlIncludes: '/xxx', method: 'GET' }); await keywordInput.fill(primaryValue); await searchButton.click(); await searchResp;\` 这类“额外列表 GET 必须命中”的硬链。当前列表可能已经收敛，额外搜索也未必会再次发请求；应先查 \`currentVisibleRow\`，只有未命中时才让 \`__e2e.resolvePrimaryRecord(...)\` 触发一次保守搜索。
   - 如果 \`currentVisibleRow\` / \`recordCheck.row\` 已经由 helper 命中，不要紧接着再写 \`await expect(recordCheck.row).toContainText(primaryValue)\` 或 \`await expect(currentVisibleRow).toContainText(leadMobile)\` 去证明同一个身份；helper 命中本身已经是身份证据，这类重复断言很容易重新落回 \`locator(...).nth(...)\` 行漂移。若还需要行内可见文本，只做一次 \`const rowText = await recordCheck.row.innerText().catch(() => '')\` 的保守读取；\`rowText\` 为空但列表响应 / 详情证据还在时，继续沿响应 / 详情链闭环，不要因为 stale row 直接失败。
   - const recordCheck = await __e2e.resolvePrimaryRecord(page, {
   -   primaryValue: businessId,
   -   keywordInput: page.locator('input#businessList_keywords:visible').first(),
   -   searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(),
   -   listResponse: { urlIncludes: '/business', method: 'GET' },
   -   rowHasTexts: [businessId, '新入库'],
   -   detailUrl: \`#/business/detail/\${businessId}\`,
   - });
   - if (recordCheck.mode === 'table_row' && recordCheck.row) { ... } else { ... }
   - helper 会先按主键检索列表、等待结果收敛；若列表未命中且提供了 \`detailUrl\`，会直接回退详情页。不要继续无限放宽姓名 / 手机号匹配。
   - 如果 \`businessId\` 暂时为空、但你手里已经有本次唯一手机号/联系人，也优先沿用同一个 helper，而不是手写“一次搜索 + 一次 findAntdTableRow 就失败”：\`const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: leadMobile, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [leadMobile], maxLookupAttempts: 4, retryIntervalMs: 1200 })\`。
   - 这种手机号 fallback 的目标不是把手机号当 CRM 主键，而是复用 helper 的保守列表收敛轮询；只有 helper 明确返回 \`not_found\` 时，才考虑退回可见文本链或详情入口。
   - 如果 \`businessId\` 为空、但 \`currentVisibleRow\` / \`recordCheck.row\` 已经稳定命中，可只在这个已命中的分支里做一次保守回填，例如：先 \`const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()\`，再写 \`const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')\`\n   - 这个 \`derivedBusinessId\` 只能用于“row 已命中后解锁 \`detailUrl\` / 详情页回退”；不要在列表未命中前对整页文本猜 \`businessId\`
   - 如果列表行可能省略状态列或“新入库”没有出现在同一行可见文本里，\`rowHasTexts\` 优先传 \`businessId + 联系人/手机号\` 这类身份字段；不要把状态文案当成唯一匹配前提。
   - 如果目标行已经按主键 + 联系人/手机号命中，但状态没有出现在可见行文本 / 状态单元格里，不要继续写 \`await expect(targetRow).toContainText('新入库')\` 或 \`targetRow.locator('td').filter({ hasText: /新入库/ })\`；把该行当作身份证据，优先继续读取 \`recordCheck.response\` -> \`__e2e.pickJsonRecord(...)\` -> \`__e2e.pickJsonValue(...状态 paths...)\`，仍拿不到时再跳详情页 / 详情抽屉用 \`__e2e.readDetailField(...)\` 验证状态。
   - 如果 \`matchedRecord\` 和 \`__e2e.readDetailField(page, { label: '商机进展', required: false }) || __e2e.readDetailField(page, { label: '状态', required: false })\` 都拿不到状态，不要写 \`expect(statusText || '').toContain('新入库')\` 或任何空串兜底断言；应直接抛出“状态证据缺失”这类明确错误，让 repair 看到真实缺口。 
   - 如果当前页面的搜索框/搜索按钮定位并不稳定，可以先只传 \`primaryValue / listResponse / rowHasTexts / detailUrl\`，省略 \`keywordInput / searchButton\`，让 helper 自动探测可见检索控件。`);
  parts.push(`13.1 如果当前页面已知明确的表格容器或详情页 ready 锚点，也优先显式传给 \`resolvePrimaryRecord(...)\`：
   - 例如 \`table: page.locator('.customer-table-wrapper').first()\`
   - 或 \`detailReadyLocator: page.getByText(/客户详情/i).first()\`
   - 这样 helper 会在更窄的列表作用域里找目标行，并在详情页真正 ready 后再进入字段断言，避免整页误命中或过早读取。`);
  parts.push(`13.2 同理，只要你拿到的是 \`recordUid / customerCode / serialNo / bizNo\` 这类共享稳定标识，也优先沿用同一条 \`resolvePrimaryRecord(...)\` 回查链；不要因为变量名不是 \`*Id\` 就退回模糊列表匹配。`);
  parts.push(`13.3 如果 \`VerificationPlan\` / 固定骨架已经给出 \`recordLookup.detailEntry\`，必须优先沿用这条结构化详情入口，而不是自由手写“点查看再猜容器”：
   - 例如 \`detailEntry{ trigger=row_action; actionLabel=查看; target=drawer_or_modal }\`
   - 先命中目标行，再写 \`await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')\`
   - 若 target 是 \`drawer_or_modal\` 且详情标题已知，先写 \`let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false })\`
   - modal miss 后再写 \`detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false })\`
   - 两者都 miss 时直接 \`throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')\`，再把 \`detailScope\` 继续传给 \`__e2e.readDetailField(...)\`
   - 若 target 是 \`page\`，优先等待 \`detailReadyLocator\` 或 URL ready 后再读字段
   - 不要改写成整页 \`page.getByText('查看').click()\`，也不要点击后再去猜当前可见容器。`);
  parts.push(`14. 对详情页 / 详情抽屉字段验收，优先直接复用：
   - const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last();
   - const contactText = await __e2e.readDetailField(page, { label: '联系人', scope: detailScope, required: false });
   - const phoneText = await __e2e.readDetailField(page, { label: '手机号', scope: detailScope, required: false });
   - const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, required: false });
   - await expect(contactText).toContain(contactName);
   - await expect(phoneText).toContain(contactPhone);
   - 如果 \`resolvePrimaryRecord(...)\` 已回退到详情页 / 详情抽屉，不要再对 \`page.locator('body')\` 或整个 Drawer 文本做大段 \`toContain\`；优先按 label 逐项读取联系人、手机号、状态、创建时间。`);
  parts.push(`15. 如果 \`resolvePrimaryRecord(...)\` 已拿到列表响应 \`recordCheck.response\`，优先继续复用：
   - const listJson = recordCheck.response ? await __e2e.readJsonResponse(recordCheck.response, { required: false }) : null;
   - const matchedRecord = listJson ? __e2e.pickJsonRecord(listJson, { label: 'primaryId', value: primaryId, paths: ['primaryId', 'id'], required: false }) : null;
   - const expectedStatus = matchedRecord ? __e2e.pickJsonValue(matchedRecord, { label: '状态', paths: ${renderJsStringArray(BUSINESS_STATUS_JSON_PATHS)}, required: false }) : '';
   - 如果详情字段的期望值能从列表响应记录里拿到，优先用它去对比 \`__e2e.readDetailField(...)\` 的结果；不要退回整页模糊文本，也不要只留 TODO。
   - 如果列表响应和详情字段都拿不到状态 / 关键字段，不要把断言改成 \`toBeTruthy()\`、\`not.toBe('')\` 或 \`expect(statusText || '')\`；应直接抛出“字段证据缺失”错误。`);
  parts.push(`15.0 如果 \`currentVisibleRow\` 已命中，但你随手把 \`recordCheck.response\` 固定成了 \`null\`，后面又还需要状态 / 详情期望值，不要直接退化成“开详情 + 读裸状态字段”：
   - 如果 \`const rowText = await recordCheck.row.innerText().catch(() => '')\` 已经直接包含预期业务状态（例如“新入库”），也只能把它当辅助线索；不要只凭裸 \`rowText\` 直接收口，仍要继续补 \`statusEvidenceRecordCheck -> readJsonResponse -> pickJsonRecord\` 或详情字段
   - 保留 \`currentVisibleRow\` 作为身份证据，但额外补一跳只为拿结构化列表响应，例如 \`const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck;\`
   - 再从 \`statusEvidenceRecordCheck.response\` 读取 \`listJson -> matchedRecord -> expectedStatus\`
   - 这里也不要再补 \`await expect(recordCheck.row).toContainText(primaryValue)\` / \`await expect(currentVisibleRow).toContainText(leadMobile)\` 这类重复身份断言；helper 命中本身已经是身份证据，优先继续用 \`rowText\` 辅助派生主键，再走列表响应或详情字段闭环
   - 只有结构化列表响应仍然拿不到状态时，才继续开详情 / 抽屉读字段
   - 如果前一个 UI step 已经为了 \`artifacts['plan_step_5']\` 手写过一次 \`fill + 搜索\`，后面的 \`Step 6 / Verification\` 就不要再补第二次检索；优先把前一个步骤收口成“切视角 + 列表 ready”，让 \`resolvePrimaryRecord(...)\` 独占这次搜索。若历史脚本暂时保留了 \`artifacts['plan_step_5']\`，后面也只能复用这次响应，不要再额外写 \`waitForApiResponse + keywordInput.fill(...) + searchButton.click()\`
   - 这样可以避免把来源枚举、渠道值或意向标签误当成业务状态。`);
  parts.push(`15.1 如果 \`businessId\` 为空，但你已经用手机号 + 联系人命中了 fallback 行，也不要在 fallback 分支里直接 \`throw new Error('状态证据缺失...')\` 结束：
   - 更稳的写法是先把手机号继续交给 \`__e2e.resolvePrimaryRecord(...)\` 做列表收敛轮询，例如 \`primaryValue: leadMobile\`、\`rowHasTexts: [leadMobile]\`、\`maxLookupAttempts: 4\`、\`retryIntervalMs: 1200\`；不要只做一次搜索就失败。
   - fallback \`rowHasTexts\` 默认只放 \`leadMobile\`；不要把 \`leadContactName\` 再塞回默认匹配条件，否则联系人列未渲染时会把本可命中的记录误判成 \`not_found\`。
   - 必须优先复用这次 fallback 查询响应（例如 \`artifacts['plan_step_5']\` / 当前列表 GET 响应）
   - const fallbackListJson = artifacts['plan_step_5'] ? await __e2e.readJsonResponse(artifacts['plan_step_5'], { required: false }) : null;
   - const fallbackMatchedRecord = fallbackListJson ? __e2e.pickJsonRecord(fallbackListJson, { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false }) : null;
   - 如果当前 \`fallbackMatchedRecord\` 仍为空，但 row 已命中且 \`derivedBusinessId\` / \`resolvedBusinessId\` 已可得，先在同一份 \`fallbackListJson\` 上补一跳主键回填，而不是立刻开详情：\`const fallbackMatchedByDerivedBusinessId = !fallbackMatchedRecord && fallbackListJson && derivedBusinessId ? __e2e.pickJsonRecord(fallbackListJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;\`
   - const fallbackStatusRecord = fallbackMatchedRecord || fallbackMatchedByDerivedBusinessId;
   - const fallbackExpectedStatus = fallbackStatusRecord ? __e2e.pickJsonValue(fallbackStatusRecord, { label: '状态', paths: ${renderJsStringArray(BUSINESS_STATUS_JSON_PATHS)}, required: false }) : '';
   - if (fallbackExpectedStatus) expect(String(fallbackExpectedStatus)).toContain('新入库');
   - 如果 fallback 行已经命中、但当前结构化来源只是宽泛的 \`listResponse: { urlIncludes: '/business', method: 'GET' }\`，不要把这次响应当成唯一结构化状态来源；先补 \`const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()\`，再从已命中 \`rowText\` 里保守提取 \`const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')\`
   - 如果 recent events 已经出现 \`json record not found -> /business/detail/:id -> Cannot read properties of null (reading 'forEach')\`，说明详情页自身可能不稳；这时要先走上面的 \`derivedBusinessId -> pickJsonRecord(...paths=['businessId','id'])\` 回填，不要立刻再次开详情
   - 如果 \`derivedBusinessId\` 非空，优先继续 \`await page.goto(\`#/business/detail/\${derivedBusinessId}\`, { waitUntil: 'domcontentloaded' })\`；若当前链路已经给出 \`detailSurface.titleIncludes\` / 详情标题（如 \`商机详情\`），不要在 \`goto\` 后直接 \`readDetailField(...)\`，而是先写 \`const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false })\`\n   - 并在 \`!detailSurface\` 时直接 \`throw new Error('详情页无效：detailUrl 未出现商机详情 surface')\`\n   - 只有 \`detailSurface\` 已拿到时，才继续 \`const detailStatus = await __e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false })\`\n   - 若当前链路没有 \`detailSurface.titleIncludes\`、但有稳定 \`detailReadyLocator\`，也应先等待 ready 再读字段；不要在明显错误页上裸读状态。只有 \`derivedBusinessId\` 也为空时，才保留“未提供详情入口”的错误收口
   - 如果 fallback 行已命中、列表响应也还没有状态，不要写 \`else if (shared.businessId) { await page.goto(...) } else { throw ... }\` 这类分支；若 \`recordLookup.detailEntry\` / 已知“查看”动作 / 详情标题可用，优先直接对 \`recordCheck.row\` 执行 \`await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')\`，随后先 \`waitForVisibleAntdModal(... required:false)\`，modal miss 后再 \`waitForVisibleDetailSurface(... required:false)\`，再读 \`状态\`。
   - 可直接收敛成这类骨架：\`await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')\` -> \`let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false })\` -> \`if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); }\` -> \`if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页')\` -> \`const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })\`\n   - 若 \`statusText\` 仍为空，再抛出“状态证据缺失：列表行已命中，但列表响应、详情抽屉与详情页都未返回状态”；不要在 row 已命中时直接 \`throw new Error('状态证据缺失：列表行已命中，但无法从列表响应或详情获取状态')\`。
   - 如果当前链路没有 \`detailEntry / actionLabel / 详情标题 / detailReadyLocator\`，不要擅自写 \`await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')\`；\`businessId\` 非空时可优先走 \`detailUrl\`，为空时则保留 row 作为身份证据，结构化列表响应仍然拿不到状态就直接抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”。
   - 只有当 fallback 列表响应和详情字段都拿不到状态，且 \`rowText\` 也派生不出可用 \`derivedBusinessId / detailUrl\` 线索时，才允许抛出“状态证据缺失”错误。`);
  parts.push(`15.2 如果列表行已经命中、列表响应里也拿不到状态，而当前页面还停留在列表页，不要直接在裸列表页上调用 \`__e2e.readDetailField(page, { label: '状态' })\` 然后判空：
   - 如果当前链路已经有稳定 \`detailUrl\` / \`detailReadyLocator\`，优先直接沿用这条详情页链：\`await page.goto(detailUrl, { waitUntil: 'domcontentloaded' })\` 或等待现成的详情页 ready 锚点。若当前链路已经给出 \`detailSurface.titleIncludes\` / 详情标题（如 \`商机详情\`），不要在 \`goto\` 后直接 \`readDetailField(...)\`，而是先写 \`const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false })\`，并在 \`!detailSurface\` 时直接 \`throw new Error('详情页无效：detailUrl 未出现商机详情 surface')\`\n   - 只有 \`detailSurface\` 已拿到时，才继续 \`__e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false })\`，再回退 \`__e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false })\`；不要退化成裸 page-scope 读取
   - 只有当没有稳定 \`detailUrl\`，且 \`recordLookup.detailEntry\` 明确指向 \`drawer_or_modal\` 或项目里已知详情标题时，才把命中的目标行当作详情入口，写 \`await __e2e.clickAntdRowAction(page, targetRow, '查看')\` + \`waitForVisibleAntdModal(... required:false) -> waitForVisibleDetailSurface(... required:false)\`
   - 即使 \`businessId\` 为空，只要 \`recordCheck.mode === 'table_row'\` 且 \`recordCheck.row\` 已命中，也不要直接 \`else { throw new Error('状态证据缺失...') }\`；优先继续沿用这条 \`row -> detailEntry / detailReadyLocator\` 回退链，不要在已经跳过详情页后又回到列表抛“未提供详情入口”。
   - 如果确实拿到了详情弹层容器，再写 \`const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, required: false })\`
   - 如果详情抽屉/详情页仍然没有状态字段，再抛出“状态证据缺失”；不要在列表页裸读字段后直接失败。`);
  parts.push(`15.3 如果 \`recordCheck.mode === 'not_found'\`，且当前链路没有可用的 \`detailUrl / detailEntry\` 回退路径，不要凭空写：
   - \`const detailScope = page.locator('.ant-drawer-content:visible, .ant-modal-content:visible').last()\`
   - \`const statusText = await __e2e.readDetailField(page, { label: '商机进展', scope: detailScope, required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailScope, required: false })\`
   - 正确做法是先继续复用 \`recordCheck.response\`，例如 \`const listJson = recordCheck.response ? await __e2e.readJsonResponse(recordCheck.response, { required: false }) : null\`
   - 再用 \`__e2e.pickJsonRecord(...)\` / \`__e2e.pickJsonValue(...)\` 尝试读取命中记录和状态
   - 如果列表响应仍然没有命中记录 / 状态，就直接抛出“未命中目标记录：列表未命中，且没有可用的详情回退路径”这类错误，让 repair 去修搜索链或详情入口，而不是伪造详情容器。`);

  if (looksLikeBusinessCreateTask(snapshot, description, context)) {
    parts.push(`\n## 创建商机向导锚点规则
1. 进入 \`#/business/createbusiness\` 后，不要写 \`await expect(page.getByText('创建商机').first()).toBeVisible()\`；页面里可能同时存在隐藏统计文案“本月创建商机”，\`.first()\` 很容易命中隐藏节点。
2. 第一页优先断言 \`page.getByRole('heading', { name: '商机联系人信息' }).first()\`、\`page.getByText('请填写正确的商机联系人信息').first()\` 或 \`label[title="商机来源"]\`，不要把裸“创建商机”文本当成唯一入口锚点。
2.1 如果第一页 ready 阶段需要容纳多个候选锚点，不要写 \`await expect(contactStepHeading.or(sourceLabel)).toBeVisible(...)\`；Playwright strict mode 在两个锚点同时可见时会直接失败。
   - 更稳的写法是先选一个主锚点，例如 \`const contactStepHeading = page.getByRole('heading', { name: '商机联系人信息' }).first()\`；若它不可见，再单独断言 \`const sourceLabel = page.locator('label[title="商机来源"]').first()\` 或第一页联系人/手机号字段。
   - 需要显式回退时，可先 \`const headingVisible = await contactStepHeading.isVisible().catch(() => false)\`，再按顺序分支；不要把多个 locator 合成一个 union locator。
   - 也不要在删掉 \`.or()\` 之后，又立刻把主锚点和备用锚点都写成必须同时成立的 \`toBeVisible()\`。
3. 第二/第三页优先断言当前步骤专属锚点，如“关联产品意向信息”“附件信息”“上传录音文件”“上传图片”，不要反复回到裸“创建商机”文本。
4. \`请填写正确的商机联系人信息\` 这类文案通常是第一页静态步骤说明，只能作为“已经进入当前步骤”的正向锚点；不要在填写后或翻页后写“它应该消失”的负断言，也不要对 \`.ant-form-item-explain-error\` / \`.ant-form-explain\` 直接做 \`toHaveCount(0)\`。
5. 第三页提交后，如果 URL 已回到 \`#/business/businesslist\`、关键提交响应成功，或列表里已能检索到新记录，就不要把 toast 作为唯一成功条件。
6. 返回商机列表后，搜索框经常在 DOM 中同时存在隐藏克隆节点；优先使用 \`page.locator('input#businessList_keywords:visible').first()\` 或其他明确可见的搜索框，不要直接对 \`getByPlaceholder('商机ID/联系人名称/电话/企业名称').first()\` 做可见性断言。
7. 返回列表校验新建商机时，不要继续写 \`page.locator('tbody tr').filter({ hasText: leadMobile }).first()\` 或对匹配结果断言 \`toHaveCount(1)\`。切到“我创建的”后，不要看到搜索框就立刻填手机号；先短超时检查当前可见列表是否已经出现目标行，例如 \`const currentVisibleRow = leadMobile ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile], timeoutMs: 1200 }); } catch { return null; } })() : null;\`。如果 \`currentVisibleRow\` 已命中，先把它当作当前列表已收敛的身份证据，再继续读状态 / 详情；只有当前可见列表未命中时，才优先写 \`const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: leadMobile, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [leadMobile], maxLookupAttempts: 4, retryIntervalMs: 1200 })\`。不要默认再把 \`leadContactName\` 拼回 fallback \`rowHasTexts\`，联系人只在命中行文本里确实出现时再断言。只有 helper 明确 \`not_found\` 时，才退回 \`findAntdTableRow(...)\`。
8. 运行时生成联系人手机号时，必须保证最终字符串严格匹配 \`/^1\\d{10}$/\`。不要写 \`13\${stamp.slice(-9)}\` 这类实际只会得到 10 位号码的表达式；针对当前商机创建 family，优先沿用 live 已验证的安全模板，例如 \`const stamp = Date.now().toString().slice(-6); const leadMobile = '1990000' + stamp.slice(-4);\`\n   - 不要继续默认用普通 \`139\${stamp}\` 这类时间戳号段；UAT 里可能存在去重 / 黑名单 / 历史脏数据，容易把“提交成功但列表搜空”误判成列表链问题。
8.1 第一页点击完第一个 \`保存并继续\` 后，不要只因为第二个 \`保存并继续\` 仍然可见就直接继续：
   - 先确认当前真的进入了第二页，优先用 \`label[title="企业名称"]\`、\`label[title="意向产品"]\`、当前 form-item 或第二页专属说明做正向锚点；不要退回整页 \`getByText(/关联产品意向信息|企业名称|意向产品/i).first()\` 这类可能命中隐藏节点的链
   - 如果当前场景步骤要求填写企业名称 / 意向产品 / 产品类型，就必须先完成这些第二页字段，再点击下一次 \`保存并继续\`；不要写 \`if (await nextBtn2.isVisible()) { await nextBtn2.click(); }\` 这种只凭按钮可见就跳页的分支
   - \`企业名称\` 这类远程搜索 Select 继续优先用 \`__e2e.selectAntdOption(page, companyRow, { label, searchText })\`；产品 / 树选择继续优先用 \`__e2e.selectAntdOption(page, productRow, { label, searchText, tree: true })\`，不要退回手写 dropdown + 文本点击链
8.2 第三页 / 附件信息页的最终主动作，不要固化成 \`getByRole('button', { name: /^保\\s*存$/ }).first()\`：
   - 先用 \`附件信息 / 上传录音文件 / 上传图片\` 这些末页锚点确认当前真的在最后一步
   - 再只在当前可见步骤容器内定位 \`/保\\s*存|提\\s*交|确\\s*定/i\` 的最后一个按钮
   - 不要把 \`保存并继续\` / \`上一步\` 当成最终提交，也不要在未确认已到附件页前就直接找最终按钮
8.3 如果当前 pane 内没有命中最终按钮，不要把 fallback 直接退化成 \`page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()\`：
   - 先继续复用 \`附件信息 / 上传录音文件 / 上传图片\` 这些末页锚点，准备少量 \`candidateContainers\`
   - 不要只试一个最近祖先；\`candidateContainers\` 至少补上 \`attachmentAnchor\` 的前 3-4 层可见祖先链，以及可见 \`footer / action-bar\` 容器
   - 按末页锚点附近容器 / \`attachmentAnchor\` 祖先链 / 当前可见 tabpane / 当前可见 form / 当前 modal|drawer / 可见 footer-action bar 的顺序逐个尝试 scoped locator
   - footer/action-bar 这类 selector 不要统一写成 \`.first()\`；每类 selector 至少枚举前 2-3 个可见命中，依次 push 进 \`candidateContainers\`
   - 如果这些 scoped 容器都 miss，但 \`attachmentAnchor\` 已可见，可额外尝试一次更窄的 page-level exact submit fallback：\`page.getByRole('button', { name: /^提\\s*交$/ }).first()\`；不要重新放宽成整页 \`/保\\s*存|提\\s*交|确\\s*定/\` regex + \`.last()\`
   - \`attachmentAnchor\` 刚 visible 时底部 action bar 可能还没挂稳，不要只跑一轮 \`count()\` 就立刻 throw；给 scoped candidate scan + exact submit fallback 一个 3-5 秒的短时轮询窗口（例如每 200ms 重试一次）
   - 只要某个 scoped locator \`count() > 0\` 就停在该容器，命中后再 \`scrollIntoViewIfNeeded()\` / \`click({ force: true })\`；不要对整页 regex + \`.last()\` 盲等 30 秒
9. 第三页提交响应如果返回 \`businessId\` / \`id\` / \`data.id\`，必须立刻提取并保存。优先写 \`const createJson = await __e2e.readJsonResponse(await createResp)\` 再用 \`__e2e.pickJsonValue(createJson, { label: 'businessId', paths: ${renderJsStringArray(BUSINESS_ID_JSON_PATHS)} })\` 提取。回到列表校验时，优先使用 \`page.locator('input#businessList_keywords:visible').first()\` 按 \`businessId\` 检索，并等待列表查询接口完成，再用 \`await __e2e.findAntdTableRow(page, { hasTexts: [businessId, '新入库'] })\` 定位。
9.1 不论是按 \`businessId\` 还是按 fallback 手机号回查，切到“我创建的”后都不要看到搜索框就立刻填值；先短超时检查当前可见列表是否已经出现目标行，例如：
   - \`const currentVisibleRow = primaryValue ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 }); } catch { return null; } })() : null;\`
   - 若 \`currentVisibleRow\` 已命中，先把它当作当前列表已收敛的身份证据，继续读状态 / 详情字段
   - 但如果后面还需要状态证据，而你此时手里的 \`recordCheck.response\` 会是 \`null\`，不要直接一路掉进详情字段读取；先补一跳只为拿结构化列表响应的 \`__e2e.resolvePrimaryRecord(...)\`（例如 \`maxLookupAttempts: 1\`、\`retryIntervalMs: 200\`），再从 \`statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...)\` 读取状态
   - 只有当前可见列表未命中时，才调用 \`__e2e.resolvePrimaryRecord(...)\` 触发关键词搜索；不要在切换 helper 返回后立刻 \`fill + 搜索\`
10. 如果按 \`businessId\` 回查列表，优先直接写 \`const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: businessId, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [businessId, leadMobile], detailUrl: \`#/business/detail/\${businessId}\` })\`。若 \`recordCheck.mode === 'table_row'\`，先把该行当作目标记录已命中的身份证据；即使“新入库”已经出现在可见行文本里，也不要把裸 \`rowText\` 当最终成功条件。优先继续读取 \`recordCheck.response\` + \`__e2e.pickJsonRecord(...)\` 的状态字段，状态 paths 至少覆盖 ${renderJsStringArray(BUSINESS_STATUS_JSON_PATHS)}；若当前链路能稳定收窄到同一行状态单元格，也可在该状态单元格断言。结构化列表记录仍拿不到状态时，再去详情页 / 详情抽屉用 \`__e2e.readDetailField(...)\` 校验状态。若 helper 已回退到详情页 / 详情抽屉，就直接在详情面校验联系人、手机号和状态，不要退回整页 \`toContain\`；当前商机场景里详情状态优先尝试 \`商机进展\`，其次才是 \`状态\`。如果列表响应和详情字段都没有状态，不要写 \`expect(statusText || '').toContain('新入库')\`；应直接抛出“状态证据缺失”错误。等价地，如果按 \`businessId\` 检索后 \`findAntdTableRow\` 仍然找不到目标行，不要无限继续放宽姓名 / 手机号文本匹配；如果 \`businessId\` 本身为空，也不要立刻写 \`expect(businessId).toBeTruthy()\`，而要先切到“我创建的”，再优先写 \`const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: leadMobile, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [leadMobile], maxLookupAttempts: 4, retryIntervalMs: 1200 })\`\n   - 这条 fallback helper 的目标是保守轮询列表收敛；若 \`recordCheck.mode === 'table_row'\`，先断言手机号，联系人只在行文本里确实出现时再断言，否则继续读列表响应 / 详情字段。\n   - 只有 helper 明确返回 \`not_found\` 且没有详情入口时，才允许退回 \`const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile, leadContactName] })\` 这类可见文本链。fallback 行已经命中后，即使“新入库”已经出现在可见行文本里，也不要把裸 \`rowText\` 当最终成功；优先继续读取这次列表检索响应，用 \`__e2e.pickJsonRecord(..., { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false })\` 找命中的列表记录，再配合 \`__e2e.pickJsonValue(...状态 paths...)\` 或 \`__e2e.readDetailField(page, { label: '商机进展', required: false }) || __e2e.readDetailField(page, { label: '状态', required: false })\` 完成验收。`);
  }

  if (looksLikeBusinessCreateOrderTask(snapshot, description, context)) {
    parts.push(`\n## 商机转订单规则
1. 回到商机列表后，先用 \`await __e2e.findAntdTableRow(page, { hasTexts: [contactPhone, contactName, '新入库'] })\` 稳定定位目标商机，再触发行内“生成订单”；不要继续用 \`tbody tr ... first()\` 或对匹配结果写 \`toHaveCount(1)\`。
2. 商机列表里的“生成订单”通常收在目标行末列三点菜单里，不要假设行内有固定的“查看 / 详情 / 生成订单”按钮；优先直接用 \`await __e2e.clickAntdRowAction(page, targetRow, '生成订单')\`。
3. 点击“生成订单”后，当前 UAT 会打开“确定订单信息”Drawer，而不是简单 confirm 弹窗。必须先等待 Drawer 可见，再在 Drawer 内点击“确定”。
4. 点击 Drawer 内“确定”后，优先等待 \`POST /crmapi/business/createOrder\` 成功响应，并校验响应成功；不要只靠页面上模糊的“成功”文案。
5. 生成订单成功后，原手机号对应的商机记录可能立即从当前商机列表移除或不再提供“查看”动作。除非需求明确要求继续打开详情，否则不要再强行查找同一行并点击“查看”。
6. 如果需求只是“创建商机并生成订单”，以“createOrder 响应成功 + Drawer 关闭 + 关键清理信息已记录”作为主要成功判定即可；可附加校验“签约成功(n)”计数不下降，但不要把“原商机行仍可见”作为硬前提。`);
  }

  parts.push(`\n## 媒体播放 / 预览 / 下载 / 打开详情成功判定规则
1. 对“播放录音 / 预览图片或视频 / 打开详情 Drawer / 下载文件”等触发型动作，禁止只写宽泛的 \`expect(...).toBeTruthy()\`、\`page.getByText(/成功/i)\`，也禁止写 \`Promise.race([waitFor(...).catch(() => false), ...])\` 这种会被较早 \`false\` 抢跑的成功判定。
2. 如果动作会触发明确请求或返回业务数据，优先等待对应接口成功并校验关键字段，例如响应里的 \`code=1\`、媒体 URL、下载地址、详情数据已返回。
3. 如果页面会出现播放器 / 预览容器 / Drawer / 新窗口，优先断言具体容器、\`audio[src]\` / \`video[src]\` / Drawer 标题 / 同一行按钮状态变化；不要跨整页找模糊 icon 或泛化文本。
4. 当存在多个候选成功信号时，改用“按顺序检查多个信号”或 \`Promise.any(...)\`（失败分支保持 reject）；不要让任一分支的 \`catch(() => false)\` 提前把整体误判为失败。
5. 如果接口已成功返回媒体 URL、详情数据或下载 token，即使页面上的播放 icon 没立即切换，也应把“业务响应成功 + 关键资源已返回”作为主要成功判定，再补一个轻量 UI 佐证。`);

  parts.push(`\n## Iframe / 嵌入页规则
1. 如果页面快照或 Iframe 摘要里出现了真实业务控件，必须优先使用 frameLocator 或 frame 对象进入对应 iframe，例如：
   - const frame = page.frameLocator('#easyindexIframe');
   - const liveFrame = page.frames().find((item) => /easySearchList/i.test(item.url()));
2. 如果 Iframe 摘要里提供了 DOM id / 定位建议，必须优先使用该 selector；只有当 selector 失效时，才回退到按 frame URL 匹配。
3. 当 route 已经进入容器页但 iframe 内控件还没 ready 时，先等待 iframe DOM 出现，再等待 frame URL 或 frame 内 placeholder 可见，不要直接对错误的 name selector 做长时间等待。
4. 禁止在顶层 page 上直接查找 iframe 内的 placeholder、按钮、列表结果；先判断控件属于主页面还是 iframe。
5. 如果主页面 route 只是容器页，且真实输入框只存在于 iframe 中，应在 iframe 内完成输入、点击和断言，不要退回主页面做宽泛 getByText 猜测。`);

  if (context?.taskMode === 'scenario') {
    parts.push(`\n## 业务流上下文
- 任务模式: 业务流任务
- 入口 URL: ${context.scenarioEntryUrl || snapshot.url}
- 共享变量: ${context.sharedVariables?.join(', ') || '无'}
- 期望业务结果: ${context.expectedOutcome || '未提供'}
- 收尾说明: ${context.cleanupNotes || '未提供'}

步骤摘要：
${context.scenarioSummary || '未提供'}

生成要求：
1. 不要只停留在入口页，要覆盖完整业务链路。
2. 需要在步骤之间传递和复用共享变量。
3. 对接口步骤、断言步骤、收尾步骤生成显式代码，不要省略。
4. 步骤说明里的字段名、placeholder、按钮文案、枚举值、企业名称、产品名如果已经给出，必须原样使用，不要擅自改成近义词或测试数据。
5. 如果快照里已经暴露字段 id / label / placeholder，应优先使用这些精确信息；例如存在“请输入商机联系人”时，不要退化成“请输入联系人”。
6. 如果分析到的页面仍然是登录页或与业务步骤不匹配，应显式报错或跳过，禁止基于错误页面猜测业务 locator。`);
    parts.push(`7. 除非 cleanupNotes 明确要求回滚，否则不要在脚本尾部自动把刚修改成功的业务数据改回原值；意图任务默认以完成目标业务动作为主。`);
  }

  parts.push(buildExperienceSection(resolvedPlanning));
  parts.push(buildProjectKnowledgeSection(resolvedPlanning));
  parts.push(buildStarterHelperSection(resolvedPlanning));
  parts.push(buildRecipeRegistrySection(resolvedPlanning));
  parts.push(buildExecutionPlanSection(resolvedPlanning));
  parts.push(buildVerificationPlanSection(resolvedPlanning));
  parts.push(buildCompiledExecutionTemplateSection(resolvedPlanning, auth, description));
  parts.push(buildActionDslSection(resolvedPlanning));
  parts.push(buildActionLibrarySection(snapshot, auth, resolvedPlanning));

  if (context?.relatedSnapshots?.length) {
    parts.push(
      `\n## 关联页面快照\n${context.relatedSnapshots
        .map((item, index) => buildSnapshotSection(`关联页面 ${index + 1}`, item))
        .join('\n')}`
    );
  }

  parts.push(`\n## 用户需求\n${description}`);

  if (auth?.loginUrl) {
    const preferredTargetUrl = context?.scenarioEntryUrl || snapshot.url;
    parts.push(`\n## 登录信息
- 登录页: ${auth.loginUrl}
- 用户名通过 process.env.E2E_USERNAME 获取
- 密码通过 process.env.E2E_PASSWORD 获取
- 登录方式说明: ${auth.loginDescription || '未提供，请优先选择可自动化的密码登录方式'}
- 执行环境内置 helper: \`__e2e.ensureLoggedIn(page, { targetUrl })\`、\`__e2e.loginWithEnvAuth(page)\`

推荐骨架：
\`\`\`javascript
const TARGET_URL = '${preferredTargetUrl}';
test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, '缺少 E2E_USERNAME / E2E_PASSWORD');
await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL });
\`\`\`

要求：
1. 优先复用 \`__e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })\` 完成登录，不要手写一大段 \`page.goto(LOGIN_URL)\` + locator 登录流程。
2. 只有当前任务本身就是登录页，或你已经明确判断当前页就是登录页时，才直接调用 \`__e2e.loginWithEnvAuth(page)\`。
3. 如果业务页已经自动重定向到真实登录页，禁止再额外 \`page.goto(LOGIN_URL)\`；很多站点把根地址当首页壳，重复跳转会把你从真实登录页带走。
4. 先根据“登录方式说明”判断应该切换到哪个登录 tab（如扫码登录 / 密码登录 / 短信登录）。
5. 如果说明明确为扫码等无法自动化方式，或者缺少自动化凭证，请使用 \`test.skip\` 明确说明原因，禁止假通过。
6. 登录成功判定不要过拟合固定路由；像 "#/" 这类根主页也算登录成功，成功后可继续跳转到目标业务页。
7. 遇到 Ant Design 表格的选择框时，优先点击可见的 checkbox wrapper / label，不要优先操作隐藏的 input。`);
  }

  if (edgeCases.length > 0) {
    parts.push(
      `\n## 历史失败/边缘案例（请特别关注）\n${edgeCases
        .map((c) => `- [${c.id}] ${c.title}: 输入=${JSON.stringify(c.input)}, 预期=${c.expected}`)
        .join('\n')}`
    );
  }

  if (existingExample) {
    parts.push(`\n## 参考：现有项目中的真实测试代码（请参考其风格和模式）\n\`\`\`typescript\n${existingExample}\n\`\`\``);
  }

  parts.push(`\n## 输出要求（严格遵守）
1. 只输出纯 JavaScript 代码（禁止 TypeScript 语法），用 \`\`\`javascript 包裹
2. 不要写任何 import 语句（test、expect、page、context、browser 已由运行环境提供）
3. 直接调用 test('描述', async ({ page }) => { ... }) 注册测试用例
4. 禁止使用 TypeScript 语法：不要类型注解、不要 as 断言、不要 ! 非空断言、不要 interface/type 声明
5. 不要调用 test.setTimeout()（执行环境已设置充足超时时间）
6. 定位器优先级: getByRole > getByPlaceholder > getByText > getByTestId > CSS
7. 中英文双语兼容定位（用正则如 /登录|Login/i）
8. 包含明确的 expect 断言
9. 包含合理的 timeout 和 waitFor
10. 如需登录，从 process.env 读取凭证，不硬编码
11. 若页面分析结果里存在精确 placeholder / label / id，优先使用精确定位，避免宽泛正则造成误匹配
12. 遇到 Ant Design 下拉、弹层、枚举值选择时，必须先作用域到当前可见容器，禁止直接 page.getByText('枚举值').click()
13. 如果页面控件实际是 TreeSelect / 树形下拉，优先使用 [title="枚举值"] 或 .ant-select-tree-node-content-wrapper[title="枚举值"]，不要只靠 getByText('枚举值')
14. 对长 TreeSelect / 长下拉，不要一打开就对目标 option 做 toBeVisible 断言；如果 dropdown 内存在 input.ant-select-search__field，先输入枚举值，再对目标 option 调用 scrollIntoViewIfNeeded() 后点击
15. 当“抖音”“男”“保存并继续”“确定”等文案可能重复时，必须用 form-item / modal / row / visible dropdown 收窄，并用 .first() / .last() 明确消歧
16. 如果快照暴露了 iframe DOM id / 定位建议 / frame URL，优先使用这些精确线索进入 iframe；不要臆造 iframe[name="..."]。
17. 修复 iframe 场景时，优先写 “等待 iframe selector 出现 -> 按 selector 或 frame URL 进入 frame -> 等待 frame 内 placeholder/按钮可见” 这类顺序，不要直接在顶层 page 上重试同一个 placeholder
18. 只要步骤涉及 Ant Design 下拉，优先复用执行环境内置的 \`__e2e.openAntdDropdown\` / \`__e2e.selectAntdOption\`，不要再自行拼装脆弱 helper
19. 如果任务要求在商机列表切到“我创建的 / 我跟进的 / 归属 / 范围”再搜索或断言，优先复用执行环境内置的 \`__e2e.switchBusinessListOwnershipView(page, { label: '我创建的', listUrl: LIST_URL })\`，不要手写一套 tab/radio/form-item 分支猜测；helper 已处理“当前已是目标视角”和切换后的 settle，默认不要在外层无条件包 \`waitForApiResponse / waitForResponse\`。helper 返回后也不要再补 \`.ant-tabs-tab-active\` / \`.ant-radio-button-wrapper-checked\` / \`.ant-select-selection-selected-value\` 或整页 \`getByText('我创建的')\` 这类 active-locator 断言；helper 成功本身就足够。只有脚本已先确认当前不是目标视角、且必须消费这次切换请求本身时，才允许在 helper 前注册 wait promise；如需辅助收敛，只看已回列表 URL、可见搜索框或列表 ready
20. 如果列表目标动作收在行尾三点菜单 / \`.ant-dropdown-trigger\` 里，优先复用执行环境内置的 \`__e2e.clickAntdRowAction(page, targetRow, '动作名')\`，不要臆造行内可见按钮
21. 禁止写 \`page.getByText(/成功/i).first()\` 这类宽泛成功断言；应优先等待具体 toast/弹窗标题、目标 Drawer/Modal 消失、接口响应成功或业务状态字段发生变化
21.1 中间步骤的“保存并继续 / 下一步”如果只是切到下一块表单且接口并不明确，禁止发明宽泛的 \`waitForApiResponse({ urlIncludes: '/business', method: 'POST' })\`；优先等待下一块表单标题或字段出现
21.2 对多步表单 / Ant Tabs 最后一页的“保存 / 提交”，禁止直接写 \`page.getByRole('button', { name: /保\\s*存|提\\s*交/i }).first()\`，也禁止把最终主动作写死成 \`getByRole('button', { name: /^保\\s*存$/ }).first()\`；必须先 scope 到当前可见 \`.ant-tabs-tabpane-active\` / 当前步骤容器，先尝试定位 \`/保\\s*存|提\\s*交|确\\s*定/i\` 的最后一个主动作；如果当前 pane 内根本找不到这个最终主动作，不要立刻退化成整页 \`page.getByRole(...).last()\`，而是改成准备少量 \`candidateContainers\`，至少覆盖末页锚点附近容器、\`attachmentAnchor\` 祖先链、当前可见 tabpane / form，以及可见 footer/action-bar 容器，并继续排除 \`保存并继续\` / \`上一步\`。footer/action-bar 这类 selector 不要统一写成 \`.first()\`；每类 selector 至少枚举前 2-3 个可见命中，依次 push 进 \`candidateContainers\`。如果这些 scoped 容器都 miss，但 \`attachmentAnchor\` 已可见，只允许额外尝试一次更窄的 \`page.getByRole('button', { name: /^提\\s*交$/ }).first()\`；不要把 selector 锁死在 \`.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible\` 这类单一路径。\`attachmentAnchor\` 刚 visible 时底部 action bar 可能还没挂稳，不要只跑一轮 \`count()\` 就立刻 throw；给 scoped candidate scan + exact submit fallback 一个 3-5 秒的短时轮询窗口（例如每 200ms 重试一次），命中后再 \`scrollIntoViewIfNeeded()\`。如果仍是 \`subtree intercepts pointer events\` 才允许对这个 scoped button 使用 \`click({ force: true })\`，同时不要把 \`保存并继续\` 误当最终提交
22. 对播放录音 / 预览媒体 / 打开详情 / 下载文件这类触发型动作，优先等待业务响应成功、资源 URL 返回或对应容器出现；禁止使用 \`Promise.race([...catch(() => false)])\` 这类会把较早失败误判成整体失败的写法
23. 有统一登录信息时，优先使用执行环境内置的 \`__e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })\` 或 \`__e2e.loginWithEnvAuth(page)\`；不要重复手写 \`page.goto(LOGIN_URL)\` 并猜登录页 DOM
24. 如果当前页已经是登录页，禁止再额外跳一次 \`LOGIN_URL\` 根地址；那可能把页面从真实登录页跳回首页壳，导致后续手机号/验证码输入框全部消失
25. 对 Ant Design 表格，禁止直接断言裸 \`.ant-table-tbody\` 可见；优先等待目标行、行数或 placeholder，并基于目标行继续操作
26. 对标题会附带业务实体名称的 Modal / Drawer，禁止精确断言整个标题字符串；应在当前可见容器内断言公共后缀文案，必要时直接使用 \`__e2e.waitForVisibleAntdModal(page, { titleIncludes: '公共标题片段' })\`
27. 优先基于上面的 \`DeterministicExecutionTemplate\` 生成最终代码：保留外层 \`test(...)\`、\`shared / artifacts\`、\`test.step(...)\` 和 slot 顺序，只在 slot 内补 locator / action / assertion 细节
28. 不要删除 \`SLOT_START / SLOT_END\` 标记，也不要新增第二个 \`test(...)\`；最终脚本只能有一个主测试用例
29. 最终代码不得残留任何 \`__PLAN_SLOT_\` 占位符；如果某个 slot 无法确定实现，应在该 slot 内抛出带原因的业务错误，而不是保留模板占位实现
30. 除非任务描述或 cleanupNotes 明确要求恢复现场，否则不要在脚本尾部自动把刚修改的业务数据改回去
31. 如果 \`VerificationPlan\` 或固定骨架已经给出 \`recordLookup.detailEntry\`，必须保留这条详情入口链：命中目标行 -> \`__e2e.clickAntdRowAction(...)\` -> 若 target=\`drawer_or_modal\` 且标题已知则先 \`__e2e.waitForVisibleAntdModal(... required:false)\`、再 \`__e2e.waitForVisibleDetailSurface(... required:false)\` -> \`__e2e.readDetailField(...)\`。禁止改写成全局点击“查看”或点击后再猜容器。
31.1 如果当前链路已经有稳定 \`detailUrl\`，且同时给出了 \`detailSurface.titleIncludes\` / 详情标题（如 \`商机详情\`），第一次 \`readDetailField(...)\` 前必须先写 \`const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false })\`；若未出现有效 surface，直接 \`throw new Error('详情页无效：detailUrl 未出现商机详情 surface')\`，不要把错误页继续当正常详情页去读字段。`);

  return parts.join('\n');
}

function extractDropdownOptionLabelFromError(errorText: string): string {
  const titleMatch = errorText.match(/title=["']([^"']+)["']/);
  if (titleMatch?.[1]) return titleMatch[1].trim();

  const hasTextMatch = errorText.match(/hasText:\s*\/\^([^$\/]+)\$\//);
  if (hasTextMatch?.[1]) return hasTextMatch[1].trim();

  return '';
}

export function buildRepairPrompt(
  snapshot: PageSnapshot,
  description: string,
  auth: AuthConfig | undefined,
  edgeCases: any[],
  existingExample: string,
  repair: RepairTestContext,
  context?: GenerateTestContext,
  planning?: ResolvedPromptPlanningContext
): string {
  const resolvedPlanning =
    planning || resolveIntentPromptPlanningContext(snapshot, description, context, { auth, projectUid: context?.projectUid });
  const parts = [buildPrompt(snapshot, description, auth, edgeCases, existingExample, context, resolvedPlanning)];
  const latestTraceLines = collectRepairLatestTraceLines(repair);
  const recentEvents = latestTraceLines.map((item) => `- ${item}`).join('\n');
  const recentEventText = (repair.latestTrace?.length ? repair.latestTrace : repair.recentEvents || []).join('\n');
  const diagnosisHints: string[] = [];
  const dropdownOptionLabel = extractDropdownOptionLabelFromError(repair.executionError);

  if (/iframe\[name=/i.test(repair.executionError) && snapshot.frames?.some((item) => item.elementId || item.selectorHint)) {
    diagnosisHints.push('当前失败脚本错误地依赖了 iframe[name=...]；如果快照提供了 DOM id 或定位建议，必须改用更稳定的 selector。');
  }
  if (/getByPlaceholder/i.test(repair.executionError) && snapshot.frames?.length) {
    diagnosisHints.push('报错发生在 placeholder 可见性等待阶段，优先修正为“等待 iframe 就绪后，再在 frame 内等待输入框”。');
  }
  if (
    /getByPlaceholder\(/.test(repair.executionError) &&
    /手机号|手机号码|用户名|账号/.test(repair.executionError) &&
    /page\.goto\((?:process\.env\.E2E_LOGIN_URL|LOGIN_URL)/.test(repair.previousCode)
  ) {
    diagnosisHints.push('这次失败很可能不是凭证缺失，而是脚本已经从业务页自动跳到真实登录页后，又额外 `page.goto(LOGIN_URL)` 把自己带回了根首页壳。修复时优先改成 `await __e2e.ensureLoggedIn(page, { targetUrl: TARGET_URL })`；如果当前页已经是登录页，就直接 `await __e2e.loginWithEnvAuth(page)`，不要再手写二次跳转。');
  }
  if (/ant-select-dropdown:not\(\.ant-select-dropdown-hidden\)/.test(repair.executionError) && /Received:\s+hidden|unexpected value "hidden"/i.test(repair.executionError)) {
    diagnosisHints.push('当前页面的下拉弹层在动画阶段可能没有 `.ant-select-dropdown-hidden` class，但实际仍是隐藏态。不要再用 `.ant-select-dropdown:not(.ant-select-dropdown-hidden)` 作为唯一可见性判断；改用 `.ant-select-dropdown:visible`，或在多个 dropdown 中显式挑选 isVisible() === true 的那个。');
  }
  if (/locator\('\.ant-select-dropdown:visible'\)\.last\(\)/.test(repair.executionError) && /element\(s\) not found|Expected:\s+visible/i.test(repair.executionError)) {
    diagnosisHints.push(`这次不是“选项不对”，而是点击 select wrapper 后根本没有成功打开下拉。不要再手写一套脆弱的 helper；直接改用执行环境内置的 \`__e2e.openAntdDropdown(page, sourceRow)\`，它会自动尝试 click、ArrowDown、mousedown 和鼠标坐标点击等多种打开方式，并把调试日志写入执行事件。`);
  }
  if (/locator\('tbody tr'\).*getByRole\('button'/i.test(repair.executionError) && /详情\|查看|生成订单/.test(repair.executionError)) {
    diagnosisHints.push('目标列表行可能没有内联 button/link，而是把“查看 / 生成订单”等操作收在末列三点菜单里。修复时先定位目标行，再优先改用 `await __e2e.clickAntdRowAction(page, targetRow, \'生成订单\')` 或 `await __e2e.clickAntdRowAction(page, targetRow, \'查看\')`，不要继续假设行内存在可见 button。');
  }
  if (
    /locator\('tbody tr'\)\.filter\(\{ hasText:/.test(`${repair.executionError}\n${repair.previousCode}`) &&
    (/toHaveCount\(expected\)/i.test(repair.executionError) || /Expected:\s*1/i.test(repair.executionError)) &&
    (/Received:\s*2/i.test(repair.executionError) || /toHaveCount\(1\)/.test(repair.previousCode))
  ) {
    diagnosisHints.push('这次不是“列表出现了两条真实业务记录”，而是你把 Ant Design 表格的裸 `tbody tr` 匹配结果直接拿来做 `toHaveCount(1)` 了；固定列 / 粘性列克隆会让同一条记录出现多个副本。修复时删除这类数量断言，改成 `const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [contactPhone, contactName, \'新入库\'] })`；helper 会按 `data-row-key` 去重并优先返回主表体真实行。');
  }
  if (
    /business\/businesslist|商机列表/.test(`${snapshot.url}\n${repair.previousCode}\n${description}`) &&
    /locator\('tbody tr'\)\.filter\(\{ hasText:/.test(`${repair.executionError}\n${repair.previousCode}`) &&
    /\.first\(\)/.test(`${repair.executionError}\n${repair.previousCode}`) &&
    /Expected substring:|toContain\(|toContainText\(|Received string:/i.test(`${repair.executionError}\n${repair.previousCode}`)
  ) {
    diagnosisHints.push('这次不是字段没渲染，而是 `tbody tr ... first()` 命中了错误记录。修复时不要只用单个手机号或联系人做 `.first()`；改成 `await __e2e.findAntdTableRow(page, { hasTexts: [contactPhone, contactName, \'新入库\'] })`，必要时继续补 businessId / 企业名称，让 helper 在多条真实记录之间稳定区分。');
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /未找到表格目标行：hasTexts=/.test(repair.executionError)
  ) {
    diagnosisHints.push(`这次不是还要继续一味放宽 \`findAntdTableRow\`，而是缺少更稳定的业务主键和“列表结果收敛”回查链。修复时在第三页提交后立刻读取 \`createResp\` / 提交响应 JSON，优先写 \`const createJson = await __e2e.readJsonResponse(await createResp)\`，再用 \`__e2e.pickJsonValue(createJson, { label: 'businessId', paths: ${renderJsStringArray(BUSINESS_ID_JSON_PATHS)}, required: false })\` 提取并保存；如果 \`businessId\` 非空，回到列表后优先直接写 \`const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: businessId, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [businessId, leadMobile], detailUrl: \`#/business/detail/\${businessId}\` })\`。若 \`businessId\` 为空，不要立刻写 \`expect(businessId).toBeTruthy()\`，也不要退回“一次 search + 一次 findAntdTableRow 就失败”；先切到“我创建的”，再优先写 \`const recordCheck = await __e2e.resolvePrimaryRecord(page, { primaryValue: leadMobile, keywordInput: page.locator('input#businessList_keywords:visible').first(), searchButton: page.getByRole('button', { name: /搜\\s*索/i }).first(), listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts: [leadMobile], maxLookupAttempts: 4, retryIntervalMs: 1200 })\`\n- 让 helper 保守轮询几次列表收敛；如果 \`recordCheck.mode === 'table_row'\`，先断言手机号，联系人只在行文本确实出现时再断言，否则继续读取 \`recordCheck.response\`。\n- 只有 helper 明确返回 \`not_found\` 且没有详情入口时，才允许再退回 \`const targetRow = await __e2e.findAntdTableRow(page, { hasTexts: [leadMobile, leadContactName] })\` 这类可见文本链。\n- fallback 行命中后，即使“新入库”已经出现在该行可见文本里，也不要把裸 \`rowText\` 当最终成功；优先继续读这次列表检索响应，用 \`__e2e.pickJsonRecord(..., { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false })\` 找到命中的列表记录，再配合 \`__e2e.pickJsonValue(...状态 paths...)\` 或 \`__e2e.readDetailField(page, { label: '商机进展', required: false }) || __e2e.readDetailField(page, { label: '状态', required: false })\` 完成状态校验。若 helper 已回退到详情页 / 详情抽屉，就优先继续读 \`recordCheck.response\`，用 \`__e2e.pickJsonRecord(...)\` 找到命中的列表记录，再配合 \`__e2e.readDetailField(page, { label: '联系人', required: false })\`、\`__e2e.readDetailField(page, { label: '手机号', required: false })\`、\`__e2e.readDetailField(page, { label: '商机进展', required: false }) || __e2e.readDetailField(page, { label: '状态', required: false })\` 做字段对比，不要改成整页模糊文本断言。`);
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /未命中目标记录：列表未命中，且没有可用的详情回退路径/.test(repair.executionError)
  ) {
    diagnosisHints.push(
      "这次先不要继续机械地只加 `maxLookupAttempts`；如果脚本里仍在用普通 `139${stamp}` 这类时间戳手机号生成测试数据，优先改成 live 已验证的安全模板：`const stamp = Date.now().toString().slice(-6); const leadMobile = '1990000' + stamp.slice(-4);`。当前 UAT 里可能存在去重 / 黑名单 / 历史脏数据，常见 13x 号段更容易出现“提交成功但列表搜空”，把问题误导到列表回查链上。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /\^保\\\\s\*存\$/.test(`${repair.executionError}\n${repair.previousCode}`) &&
    /activePane|getByRole\('button'/.test(repair.previousCode) &&
    /scrollIntoViewIfNeeded|locator not found|toBeVisible/i.test(repair.executionError)
  ) {
    diagnosisHints.push(
      "这次不是 `scrollIntoViewIfNeeded()` 本身有问题，而是最后一步主动作被你固化成了精确 `保存`。修复时先用 `附件信息 / 上传录音文件 / 上传图片` 这些末页锚点确认已经进入最后一步，再只在当前可见步骤容器里定位 `/保\\s*存|提\\s*交|确\\s*定/i` 的最后一个按钮；不要继续写 `getByRole('button', { name: /^保\\s*存$/ }).first()`，也不要把 `保存并继续` / `上一步` 当成最终提交。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /scrollIntoViewIfNeeded|locator not found|toBeVisible/i.test(repair.executionError) &&
    /companyRow\.or\(productRow\)\.first\(\)|label\[title="企业名称"\]|label\[title="意向产品"\]/.test(
      repair.previousCode
    ) &&
    /nextBtn2[\s\S]*保存并继续[\s\S]*click\(\)/.test(repair.previousCode) &&
    !/selectAntdOption\(page,\s*companyRow/.test(repair.previousCode) &&
    !/selectAntdOption\(page,\s*productRow/.test(repair.previousCode) &&
    /保\\\\s\*存\|提\\\\s\*交\|确\\\\s\*定/.test(`${repair.executionError}\n${repair.previousCode}`)
  ) {
    diagnosisHints.push(
      "这次不是最终按钮文案还不够宽，而是脚本在第二页刚看到 `企业名称 / 意向产品` 锚点后，就因为第二个 `保存并继续` 仍然可见直接继续了，实际上并没有先把第二页必填项填完。修复时不要继续保留 `await expect(companyRow.or(productRow).first()).toBeVisible(...); if (await nextBtn2.isVisible(...)) { await nextBtn2.click(); }` 这种跳页链；若当前需求包含企业名称 / 意向产品 / 产品类型，必须先用 `__e2e.selectAntdOption(page, companyRow, { label, searchText })` 或 `__e2e.selectAntdOption(page, productRow, { label, searchText, tree: true })` 完成第二页字段，再点击下一次 `保存并继续`。只有 `附件信息 / 上传录音文件 / 上传图片` 已出现后，才开始找最终 `保存 / 提交 / 确定`。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /scrollIntoViewIfNeeded|locator not found|toBeVisible/i.test(repair.executionError) &&
    /\.ant-tabs-tabpane-active:visible, \.step-content:visible, form:visible/.test(
      `${repair.executionError}\n${repair.previousCode}`
    ) &&
    /保\\\\s\*存\|提\\\\s\*交\|确\\\\s\*定/.test(`${repair.executionError}\n${repair.previousCode}`)
  ) {
    diagnosisHints.push(
      "这次不是最终按钮文案还不够宽，而是你把定位链锁死在 `.ant-tabs-tabpane-active:visible, .step-content:visible, form:visible` 这个当前 pane selector 上了。修复时仍先优先看当前可见步骤容器；但如果 scoped locator `count() === 0` 或该 pane 里根本找不到 `/保\\s*存|提\\s*交|确\\s*定/i` 的最终主动作，就立刻切到更稳的 `candidateContainers` 链，至少补上末页锚点附近容器、`attachmentAnchor` 祖先链和可见 footer/action-bar 容器，逐个尝试 scoped locator，并继续排除 `保存并继续` / `上一步`；不要继续只对这个单一 pane 做 `scrollIntoViewIfNeeded()` 直到超时。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /scrollIntoViewIfNeeded|locator not found|toBeVisible/i.test(repair.executionError) &&
    /page\.getByRole\('button', \{ name: \/[\s\S]*保存并继续[\s\S]*上一步[\s\S]*保\\\\s\*存\|提\\\\s\*交\|确\\\\s\*定[\s\S]*\/i \}\)\.last\(\)/.test(
      `${repair.executionError}\n${repair.previousCode}`
    )
  ) {
    diagnosisHints.push(
      "这次不是最终按钮文案还不够宽，而是 fallback 已经退化成整页 page-level regex + `.last()` 盲等了。修复时不要继续写 `page.getByRole('button', { name: /^(?!.*保存并继续)(?!.*上一步).*(保\\s*存|提\\s*交|确\\s*定).*$/i }).last()`；先用 `附件信息 / 上传录音文件 / 上传图片` 确认末页，再准备少量 `candidateContainers`，按末页锚点附近容器 / 当前可见 tabpane / 当前可见 form / 当前 modal|drawer 的顺序逐个尝试 scoped locator。footer/action-bar 这类 selector 不要统一写成 `.first()`；每类 selector 至少枚举前 2-3 个可见命中。`attachmentAnchor` 刚 visible 时底部 action bar 可能还没挂稳，不要只跑一轮 `count()` 就立刻 throw；给 scoped candidate scan + exact submit fallback 一个 3-5 秒的短时轮询窗口（例如每 200ms 重试一次）。只要某个 scoped locator `count() > 0` 就停在该容器，命中后再 `scrollIntoViewIfNeeded()` / `click({ force: true })`；不要继续对整页 regex + `.last()` 盲等 30 秒。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /未在末页容器内找到最终提交按钮/.test(repair.executionError)
  ) {
    diagnosisHints.push(
      "这次不是末页锚点没出现，而是当前 `candidateContainers` 还太浅，或在 `attachmentAnchor` 刚 visible 后就只跑了一轮 `count()`，把稍晚挂出来的底部 action bar 也误判成 miss。修复时不要继续保留单个 `attachmentAnchor.locator('xpath=ancestor::*[...] [1]')` 后直接 throw；先扩出 `attachmentAnchor` 的前 3-4 层可见祖先链，再补 `.ant-modal-footer:visible` / `.ant-drawer-footer:visible` / `[class*=\"footer\"]:visible` / `[class*=\"action\"]:visible` 这类可见容器。footer/action-bar 这类 selector 不要统一写成 `.first()`；每类 selector 至少枚举前 2-3 个可见命中，逐个尝试 scoped final submit button。若这些 scoped 容器都 miss，但 `attachmentAnchor` 已可见，再额外试一次更窄的 `page.getByRole('button', { name: /^提\\s*交$/ }).first()`；不要重新放宽成整页 `/保\\s*存|提\\s*交|确\\s*定/` regex + `.last()`。同时给这轮 scoped candidate scan + exact submit fallback 一个 3-5 秒的短时轮询窗口（例如每 200ms 重试一次）；只有轮询窗口内这些都 miss 后，才允许抛 `未在末页容器内找到最终提交按钮`。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /未命中目标记录：列表未命中，且没有可用的详情回退路径/.test(repair.executionError) &&
    /rowHasTexts[\s\S]*leadContactName/.test(repair.previousCode)
  ) {
    diagnosisHints.push(`这次不是还要继续放宽联系人名匹配，而是 \`businessId\` 为空时 fallback \`rowHasTexts\` 仍然把 \`leadContactName\` 当成硬前提，导致联系人列未渲染就直接 \`not_found\`。修复时把 fallback helper 收窄成 \`rowHasTexts: [leadMobile]\`，联系人只在命中行文本里确实出现时再断言；不要继续生成 \`rowHasTexts: [leadMobile, leadContactName]\` 这类默认值。只有 helper 明确 \`not_found\` 且没有详情入口时，才允许退回 \`findAntdTableRow(page, { hasTexts: [leadMobile, leadContactName] })\` 这类可见文本链。`);
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /(Expected substring:\s*"新入库"|hasText:\s*\/新入库\/)/.test(repair.executionError) &&
    /(resolvePrimaryRecord|findAntdTableRow)/.test(repair.previousCode)
  ) {
    diagnosisHints.push(`这次不是列表没命中，而是脚本已经按主键/联系人命中了目标行，却还把 \`新入库\` 写成同一行可见文本 / 状态单元格的硬断言。修复时保留 \`targetRow\` 作为身份命中证据，不要继续写 \`await expect(targetRow).toContainText('新入库')\` 或 \`targetRow.locator('td').filter({ hasText: /新入库/ })\`。优先继续读取 \`recordCheck.response\` / 列表检索响应，用 \`__e2e.pickJsonRecord(...)\` 找到命中的列表记录，再用 \`__e2e.pickJsonValue(..., { label: '状态', paths: ${renderJsStringArray(BUSINESS_STATUS_JSON_PATHS)}, required: false })\` 校验状态；如果列表 JSON 仍拿不到状态，就直接跳 \`detailUrl\` 或打开“查看 / 详情”抽屉后优先用 \`__e2e.readDetailField(page, { label: '商机进展', required: false })\`，再回退 \`__e2e.readDetailField(page, { label: '状态', required: false })\` 完成验收。如果 \`matchedRecord\` 和详情字段都为空，不要写 \`expect(statusText || '').toContain('新入库')\`；应直接抛出“状态证据缺失”错误。`);
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /状态证据缺失：fallback 行已命中/.test(repair.executionError)
  ) {
    diagnosisHints.push(`这次不是 fallback 行没命中，而是 \`businessId\` 为空时，你已经按手机号/联系人命中了目标行，却在可见行文本没出现“新入库”时直接停止了。修复时保留 fallback 行作为身份证据，但不要直接在这个分支里 \`throw\`；必须继续复用这次 fallback 查询响应（例如 \`artifacts['plan_step_5']\` 或当前列表 GET 响应），优先写 \`const fallbackListJson = artifacts['plan_step_5'] ? await __e2e.readJsonResponse(artifacts['plan_step_5'], { required: false }) : null;\`，再用 \`__e2e.pickJsonRecord(..., { label: 'leadMobile', value: leadMobile, paths: ['mobile', 'phone', 'contactPhone', 'contactMobile'], required: false })\` 找命中的列表记录，并配合 \`__e2e.pickJsonValue(...状态 paths...)\` 读取状态。只有当 fallback 列表响应和详情字段都拿不到状态，且 \`rowText\` 也派生不出可用 \`derivedBusinessId / detailUrl\` 线索时，才允许抛出“状态证据缺失”错误。`);
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /未找到可见弹框: titleIncludes=商机详情/.test(repair.executionError)
  ) {
    diagnosisHints.push(`这次不是“查看”动作没点到，而是详情面 ready 假设过严：脚本把 \`商机详情\` 写成了必须命中的 modal 标题。修复时不要继续保留 \`const detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000 })\` 这种 strict wait；若当前链路已经明确给出 \`detailEntry{ trigger=row_action; actionLabel=查看; target=drawer_or_modal }\` 或详情标题，改成 \`let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页');\`。只有拿到 \`detailScope\` 后，才继续 \`__e2e.readDetailField(...)\` 读取 \`商机进展 / 状态\`。`);
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /状态证据缺失：列表行已命中，但列表响应和详情字段都未返回状态/.test(repair.executionError)
  ) {
    diagnosisHints.push(`这次不是列表行没命中，而是你已经命中了目标行、也读过列表响应，但还没有真正进入有效详情面就直接把 \`readDetailField(page, { label: '状态' })\` 判空了。修复时不要继续在裸列表页上读状态；若当前链路已经有稳定 \`detailUrl\` / \`detailReadyLocator\`，优先直接沿用这条详情页链，先 \`await page.goto(detailUrl, { waitUntil: 'domcontentloaded' })\` 或等待详情页 ready。若当前链路已经给出 \`detailSurface.titleIncludes\` / 详情标题（如 \`商机详情\`），不要在 \`goto\` 后直接 \`readDetailField(...)\`，而是先写 \`const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface');\`，随后再用 \`__e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false })\`，然后回退 \`__e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false })\` 读取状态。只有当没有稳定 \`detailUrl\`、且 \`detailEntry\` 明确指向 \`drawer_or_modal\` 或项目里已知详情标题时，才对命中的 \`targetRow / recordCheck.row\` 执行 \`await __e2e.clickAntdRowAction(page, targetRow, '查看')\`，随后先 \`waitForVisibleAntdModal(... required:false)\`，modal miss 后再 \`waitForVisibleDetailSurface(... required:false)\`，把最终 \`detailScope\` 传给 \`__e2e.readDetailField(...)\`。只有详情抽屉/详情页里仍然没有状态字段时，才允许抛出“状态证据缺失”错误。`);
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /状态证据缺失：列表行已命中，但无法从列表响应或详情(?:读取|获取)状态/.test(repair.executionError)
  ) {
    diagnosisHints.push(`这次不是列表行没命中，而是 \`businessId\` 为空时，脚本在命中 \`recordCheck.row\` 后只写了“有主键就跳详情、没有主键就直接报错”的坏分支。修复时不要继续保留 \`else if (shared.businessId) { await page.goto(...) } else { throw ... }\`；若当前链路已经有 \`detailEntry\`、已知“查看”动作或详情标题（如 \`商机详情\`），优先直接对 \`recordCheck.row\` 执行 \`await __e2e.clickAntdRowAction(page, recordCheck.row, '查看')\`，随后先写 \`let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页');\`，再用 \`__e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false }) || __e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })\` 读取状态。只有列表响应、详情抽屉、详情页三处都拿不到状态时，才允许抛出“状态证据缺失”错误。`);
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /Expected substring:\s*"新入库"/.test(repair.executionError) &&
    /Received string:\s*"无意向 有意向/i.test(repair.executionError)
  ) {
    diagnosisHints.push(`这次不是详情状态真的变成了“无意向 / 有意向”，而是 \`readDetailField(page, { label: '状态' })\` 命中了详情里的意向标签/动作区。修复时不要继续直接对这串文本断言“新入库”；优先沿用结构化 \`detailEntry / detailSurface\` 链：先命中 \`targetRow\`，再写 \`await __e2e.clickAntdRowAction(page, targetRow, '查看')\`，随后先写 \`let detailScope = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: '商机详情', timeoutMs: 5000, required: false }); if (!detailScope) { detailScope = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); } if (!detailScope) throw new Error('状态证据缺失：列表行已命中，但“查看”后未出现可用详情弹层或详情页');\`，并优先用 \`__e2e.readDetailField(page, { label: '商机进展', scope: detailScope, titleIncludes: '商机详情', required: false })\`，再回退 \`__e2e.readDetailField(page, { label: '状态', scope: detailScope, titleIncludes: '商机详情', required: false })\` 读取真实状态。若读到的仍是“无意向 / 有意向”这类意向标签，不要把它当业务状态；应优先回退到 \`matchedRecord\` 的状态字段，或继续在详情面找真实状态字段。`);
  }
  const shortUnexpectedStatusMatch = repair.executionError.match(/Received string:\s*"([^"\n]{1,12})"/);
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /Expected substring:\s*"新入库"/.test(repair.executionError) &&
    /readDetailField\(page,\s*\{\s*label:\s*'状态'/.test(repair.previousCode) &&
    /currentVisibleRow[\s\S]*response:\s*null/.test(repair.previousCode) &&
    shortUnexpectedStatusMatch &&
    !/(新入库|有意向|无意向|待|已|审|跟进|签约|成功|失败|关闭|丢|作废)/.test(shortUnexpectedStatusMatch[1])
  ) {
    diagnosisHints.push(`这次不是详情里的真实业务状态变成了「${shortUnexpectedStatusMatch[1]}」，而是脚本在 \`currentVisibleRow\` 已命中后把 \`recordCheck.response\` 留成了 \`null\`，随后又把 \`readDetailField(page, { label: '状态' })\` 读到的短枚举值误当状态。修复时不要继续直接断言这个短值；保留 \`currentVisibleRow\` 作为身份证据，但先补一跳只为拿结构化列表响应：\`const statusEvidenceRecordCheck = recordCheck.response ? recordCheck : currentVisibleRow ? await __e2e.resolvePrimaryRecord(page, { primaryValue, keywordInput, searchButton, listResponse: { urlIncludes: '/business', method: 'GET' }, rowHasTexts, preferCurrentVisibleRow: false, maxLookupAttempts: 1, retryIntervalMs: 200, detailUrl }) : recordCheck;\`，再从 \`statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...状态 paths...)\` 读取状态。只有结构化列表响应仍拿不到状态时，才继续开详情；开详情时先试 \`商机进展\`，再试 \`状态\`，若详情字段再次返回这类短枚举值，也不要把它当业务状态。`);
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /Locator:\s*locator\('\.ant-table-body tbody > tr/.test(repair.executionError) &&
    /\.nth\(\d+\)/.test(repair.executionError) &&
    /await expect\((?:currentVisibleRow|recordCheck\.row|fallbackRecordCheck\.row)\)\.toContainText\((?:primaryValue|visiblePrimaryValue|leadMobile|businessId)\)/.test(
      repair.previousCode
    )
  ) {
    diagnosisHints.push(`这次不是列表没命中，而是 helper 已经命中了目标行后，你又立刻对同一条 row locator 重复写了 \`await expect(recordCheck.row).toContainText(primaryValue)\` / \`await expect(currentVisibleRow).toContainText(leadMobile)\` 这类主值断言，结果把本来已命中的记录重新打回 \`locator(...).nth(...)\` 行漂移。修复时删除这条重复身份断言，把 helper 命中本身当作身份证据；若还要读行内文本，只做一次 \`const rowText = await recordCheck.row.innerText().catch(() => '')\` 的保守读取。即使 \`rowText\` 为空，只要 \`recordCheck.response\` / \`matchedRecord\` / 详情字段还在，就继续沿这些结构化证据闭环，不要因为 stale row 直接失败。`);
  }
  if (
    /getByText\('我创建的'\)\.first\(\)/.test(repair.executionError) &&
    /business\/businesslist|商机列表/.test(`${snapshot.url}\n${repair.previousCode}\n${description}`) &&
    (/新建商机/.test(repair.previousCode) || /页面就绪|进入商机列表页并确认页面就绪|列表加载/.test(`${repair.failedStepTitle}\n${repair.previousCode}`)) &&
    !/switchBusinessListOwnershipView/.test(repair.previousCode)
  ) {
    diagnosisHints.push("这次不是还没进入商机列表，而是页面 ready 阶段把裸 `getByText('我创建的').first()` 当成稳定锚点了。修复时删除这条断言，把本步收口成“URL 已回列表 + 新建商机按钮可见 + `input#businessList_keywords:visible` 或列表容器 ready”；真正的“我创建的”切换留给后续 `__e2e.switchBusinessListOwnershipView(...)` 所在步骤，不要在页面 ready 阶段先做裸文本可见性判断。");
  }
  if (
    /(我创建的|我跟进的|归属|范围)/.test(repair.executionError) &&
    /business\/businesslist|商机列表/.test(`${snapshot.url}\n${repair.previousCode}\n${description}`)
  ) {
    diagnosisHints.push('当前失败不是简单的 `toBeVisible()` 过严，而是商机列表“我创建的 / 我跟进的 / 归属 / 范围”视角控件定位不稳定。修复时不要再手写 `getByText(\'我创建的\')`、tab/radio 分支或 form-item 正则猜测；直接改用 `await __e2e.switchBusinessListOwnershipView(page, { label: \'我创建的\', listUrl: LIST_URL })`，让 helper 先尝试 tab/radio/segmented，再尝试顶部归属 dropdown，最后回退到筛选区 dropdown。');
  }
  if (
    /waitForResponse: Timeout .*event "response"/i.test(repair.executionError) &&
    /switchBusinessListOwnershipView/.test(repair.previousCode)
  ) {
    diagnosisHints.push('这次不是列表接口单纯变慢，而是脚本把 `waitForApiResponse` 无条件包在 `__e2e.switchBusinessListOwnershipView(...)` 外层了。helper 遇到当前已经是目标视角时会直接返回，不会再触发新的 GET。修复时默认只保留 `await __e2e.switchBusinessListOwnershipView(...)`，让 helper 自己完成 settle；只有脚本已先确认当前不是目标视角、且必须消费这次切换请求本身时，才允许在 helper 前注册 wait promise。更稳妥的是把后续搜索/回查接口响应当成列表刷新证据。');
  }
  if (
    /switchBusinessListOwnershipView/.test(repair.previousCode) &&
    /ant-tabs-tab-active|ant-radio-button-wrapper-checked|ant-select-selection-selected-value|getByText\('我创建的'/.test(
      repair.previousCode
    )
  ) {
    diagnosisHints.push('这次不是 `__e2e.switchBusinessListOwnershipView(...)` 没切成功，而是 helper 后又追加了脆弱的 active-locator 断言。修复时删除 `.ant-tabs-tab-active` / `.ant-radio-button-wrapper-checked` / `.ant-select-selection-selected-value` 或整页 `getByText(\'我创建的\')` 这类选中态断言；helper 成功本身就足够。若还需要辅助收敛，只允许检查当前 URL 已回列表、可见搜索框 / 列表 ready，然后直接进入后续搜索或 `resolvePrimaryRecord(...)` 回查。');
  }
  if (
    /Cannot read properties of null \(reading 'forEach'\)|Cannot read properties of null \(reading "forEach"\)/.test(repair.executionError) &&
    /resolvePrimaryRecord\(/.test(repair.previousCode) &&
    /keywordInput\.fill\(|fill\(primaryValue\)|fill\(shared\.(businessId|contactPhone)\s*\|\|/.test(repair.previousCode) &&
    /searchButton\.click\(\)|getByRole\('button', \{ name: \/搜\\\\s\*索\/i \}\)\.first\(\)\.click\(\)/.test(repair.previousCode)
  ) {
    diagnosisHints.push('这次不是列表数据真的为空，而是你在同一条回查链里先手写了 `keywordInput.fill(...) + searchButton.click()`，随后又把同一组 `keywordInput/searchButton` 传给 `__e2e.resolvePrimaryRecord(...)`，导致 helper 再触发一次搜索/刷新，把页面自己的列表逻辑打进了 `null.forEach`。修复时二选一：要么完全交给 `__e2e.resolvePrimaryRecord(...)` 负责搜索，要么保留手动搜索但不要再把同一组控件传给 helper。对当前商机列表场景，优先删除预搜索，只保留 `currentVisibleRow` 短探测 + `__e2e.resolvePrimaryRecord(...)` 这一条链。');
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /未命中目标记录：列表未命中，且没有可用的详情回退路径/.test(repair.executionError) &&
    /switchBusinessListOwnershipView/.test(repair.previousCode) &&
    /resolvePrimaryRecord/.test(repair.previousCode)
  ) {
    diagnosisHints.push('这次不是再多加几轮 `maxLookupAttempts` 就能解决，而是切到“我创建的”后当前列表本身可能已经刷新出目标记录，你又立刻填搜索框把结果搜空了。修复时不要在 `__e2e.switchBusinessListOwnershipView(...)` 返回后马上 `fill + 搜索`；先短超时写 `const currentVisibleRow = primaryValue ? await (async () => { try { return await __e2e.findAntdTableRow(page, { hasTexts: [primaryValue], timeoutMs: 1200 }); } catch { return null; } })() : null;` 检查当前可见列表。若 `currentVisibleRow` 已命中，就直接把它当作 `recordCheck.row` 的身份证据继续读列表响应 / 详情字段；只有当前可见列表未命中时，才调用 `__e2e.resolvePrimaryRecord(...)` 触发关键词搜索。');
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /artifacts\['plan_step_5'\]\s*=\s*await listResp/.test(repair.previousCode) &&
    /statusEvidenceRecordCheck\s*=|const verifyResp = __e2e.waitForApiResponse/.test(repair.previousCode) &&
    /keywordInput\.fill\(|searchButton\.click\(\)|resolvePrimaryRecord\(/.test(repair.previousCode)
  ) {
    diagnosisHints.push("这次不是单个 step 的等待时间不够，而是脚本把同一条列表回查拆成了两次检索：前一步先为 `artifacts['plan_step_5']` 手动 `fill + 搜索`，后一步又在 `Step 6 / Verification` 里继续 `resolvePrimaryRecord(...)` 或 `waitForApiResponse + fill + click`。修复时优先把前一个步骤收口成 `await __e2e.switchBusinessListOwnershipView(...)` + 列表 ready，把唯一一次检索留给 `resolvePrimaryRecord(...)`；如果历史脚本暂时保留了 `artifacts['plan_step_5']`，后面也只能复用这次 response，不要再对同一主值第二次搜索。");
  }
  if (
    /waitForResponse: Timeout .*event "response"/i.test(repair.executionError) &&
    /waitForApiResponse\(/.test(repair.previousCode) &&
    /keywordInput\.fill\(|searchButton\.click\(\)|getByRole\('button', \{ name: \/搜\\\\s\*索\/i \}\)\.first\(\)\.click\(\)/.test(
      repair.previousCode
    ) &&
    /(findAntdTableRow|resolvePrimaryRecord|artifacts\['plan_step_[^']+_row'\])/.test(repair.previousCode)
  ) {
    diagnosisHints.push("这次不是接口单纯变慢，而是你把最终列表回查写成了“必须等到新的列表 GET 才算成功”。当前页面很可能已经停在正确列表并且数据已收敛，但 `waitForApiResponse / page.waitForResponse` 没再收到新请求。修复时不要继续保留 `const searchResp = __e2e.waitForApiResponse(...); await keywordInput.fill(primaryValue); await searchButton.click(); await searchResp;` 这条硬链；优先先短超时检查 `currentVisibleRow`，若已命中就直接复用该 row 或已缓存的 `artifacts['plan_step_x_row'] / recordCheck` 继续验收。只有当前列表未命中时，才改用 `__e2e.resolvePrimaryRecord(...)` 触发一次保守搜索；额外列表 GET 只能当辅助证据，不要再把它当最终成功前提。");
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /getByText\('创建商机'\)\.first\(\)/.test(repair.executionError) &&
    /本月创建商机|Received:\s*hidden|unexpected value "hidden"/i.test(repair.executionError)
  ) {
    diagnosisHints.push('当前不是没进入创建商机页，而是 `getByText(\'创建商机\').first()` 命中了隐藏统计文案（如“本月创建商机”）。修复时删除这条断言，改用 `await expect(page.getByRole(\'heading\', { name: \'商机联系人信息\' }).first()).toBeVisible(...)`、`await expect(page.getByText(\'请填写正确的商机联系人信息\').first()).toBeVisible(...)` 或 `await expect(page.locator(\'label[title="商机来源"]\').first()).toBeVisible(...)` 这类当前步骤专属且可见的锚点。');
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /strict mode violation/.test(repair.executionError) &&
    /getByRole\('heading', \{ name: '商机联系人信息' \}\)\.first\(\)\.or\(locator\('label\[title="商机来源"\]'\)\.first\(\)\)/.test(
      `${repair.executionError}\n${repair.previousCode}`
    )
  ) {
    diagnosisHints.push("这次不是没进入创建商机页，而是第一页 ready 把两个可见锚点用 `.or()` 合成了一条 expect，触发了 Playwright strict mode。修复时删除 `contactStepHeading.or(sourceLabel)` 这类 union locator；先选 `const contactStepHeading = page.getByRole('heading', { name: '商机联系人信息' }).first()` 作为主锚点，若它可见就直接断言它，否则再单独检查 `const sourceLabel = page.locator('label[title=\"商机来源\"]').first()` 或第一页联系人/手机号字段。需要回退时先 `const headingVisible = await contactStepHeading.isVisible().catch(() => false);` 再按顺序分支；不要在删掉 `.or()` 后又立刻把主锚点和备用锚点都写成必须同时成立的 `toBeVisible()`。");
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /请填写正确的商机联系人信息/.test(`${repair.executionError}\n${repair.previousCode}`) &&
    (/toHaveCount\(expected\).*Expected:\s*0/i.test(repair.executionError) ||
      /toHaveCount\(0\)|ant-form-item-explain-error|ant-form-explain/.test(repair.previousCode))
  ) {
    diagnosisHints.push('`请填写正确的商机联系人信息` 在创建商机第一页通常是静态步骤说明，不是提交后会自动消失的临时报错。修复时删除“该文案应该消失”或对 `.ant-form-item-explain-error` / `.ant-form-explain` 直接做 `toHaveCount(0)` 的负断言，只保留“下一步 heading 已出现 / 当前表单关键 label 可见”这类正向锚点。');
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /ant-message-notice|ant-notification-notice/.test(repair.executionError) &&
    /提交成功|保存成功|创建成功/.test(repair.executionError)
  ) {
    diagnosisHints.push('创建商机第三页提交后，toast 不是主成功判定。若提交接口已经成功、URL 已回到 `#/business/businesslist`，或后续能在列表里检索到新建记录，就不要再把 `.ant-message-notice` / `.ant-notification-notice` 作为唯一断言；应优先等待列表页、检索结果和“新入库”状态。');
  }
  if (
    /businessList_keywords|商机ID\/联系人名称\/电话\/企业名称/.test(`${repair.executionError}\n${repair.previousCode}`) &&
    /unexpected value "hidden"|resolved to hidden|element\(s\) not found/i.test(repair.executionError) &&
    /business\/businesslist|商机列表/.test(`${snapshot.url}\n${repair.previousCode}\n${description}`)
  ) {
    diagnosisHints.push('商机列表搜索框经常同时存在可见节点和隐藏克隆节点。修复时不要再对 `getByPlaceholder(\'商机ID/联系人名称/电话/企业名称\').first()` 做可见性断言；改用 `const keywordInput = page.locator(\'input#businessList_keywords:visible\').first()` 或其他明确可见的搜索框，再填值并继续搜索。');
  }
  if (
    /未找到行操作：/.test(repair.executionError) ||
    (/getByText\('操作'/.test(repair.executionError) && /ant-table/i.test(repair.executionError)) ||
    (/ant-table-wrapper/.test(repair.executionError) && /unexpected value "hidden"|Received:\s+hidden/i.test(repair.executionError))
  ) {
    diagnosisHints.push('这是 Ant Design 表格固定列/隐藏克隆节点的典型误判。修复时不要再新增 `getByText(\'操作\')`、`.ant-table-thead` 或表头可见性断言；“操作”列在 DOM 里经常同时存在多个隐藏副本。应直接基于目标行调用 `await __e2e.clickAntdRowAction(page, targetRow, \'动作名\')`，或在同 `data-row-key` 的可见克隆行内点击真实可见的动作链接。');
  }
  if (/locator\('\.ant-table-tbody'\)/.test(repair.executionError) && /strict mode violation|resolved to \d+ elements/i.test(repair.executionError)) {
    diagnosisHints.push('当前失败不是“列表没渲染出来”，而是你对裸 `.ant-table-tbody` 做了可见性断言，命中了 Ant Design 固定列生成的多个表体副本。修复时不要再写 `expect(page.locator(\'.ant-table-tbody\')).toBeVisible()`；改成直接等待目标行出现、等待表格请求完成，或等待 `.ant-table-placeholder` / 行数变化。');
  }
  if (
    /ant-modal-content|ant-modal:visible|ant-modal-wrap:visible/.test(repair.executionError) &&
    /服务分佣配置/.test(repair.executionError) &&
    /element\(s\) not found|Expected:\s+visible/i.test(repair.executionError)
  ) {
    diagnosisHints.push('这类弹框标题通常是“业务实体名 + 服务分佣配置”，例如 `“商务礼仪培训”服务分佣配置`；不要再对 `.ant-modal-content` 或完整标题做精确匹配。修复时优先改成 `const modal = await __e2e.waitForVisibleAntdModal(page, { titleIncludes: \'服务分佣配置\' })`，然后只断言公共标题片段、佣金行和保存按钮。');
  }
  if (
    /Cleanup:|restoreValue|originalRatio|改回原值|rowAfterSave|modalAgain/.test(repair.previousCode) &&
    /(修改|改为|设置为|填写为|保存)/.test(description) &&
    !/(恢复|回滚|改回|cleanup|清理)/i.test(`${description}\n${context?.cleanupNotes || ''}`)
  ) {
    diagnosisHints.push('当前需求没有要求回滚数据，脚本尾部自动“改回原值”只会增加额外失败面，还可能把已经完成的业务动作撤销。修复时删除自动恢复原值的 cleanup，只保留完成目标动作后的结果校验。');
  }
  if (/getByRole\('button', \{ name: \/搜\\s\*索\/ \}\)/.test(repair.executionError) && /sureOrderInfoDrawer|暂无信息|ant-spin-spinning/.test(repair.executionError)) {
    diagnosisHints.push('当前不是“搜索按钮定位失败”，而是“确定订单信息”Drawer/加载遮罩仍未关闭，说明前面的成功断言误判了。不要再写 `page.getByText(/成功/i).first()`；点击 Drawer 内“确定”后，优先等待 `crmapi/business/createOrder` 响应成功，再接 `await __e2e.observeSubmitState(page, { submitButton: confirmButton, closeTitleIncludes: \'确定订单信息\' })` 这类提交后收敛观察，显式等待“确定订单信息”Drawer 消失后再继续回到列表或做后续校验。');
  }
  if (/locator\('tbody tr'\)\.filter\(\{ hasText:/.test(repair.executionError) && /createOrder|data-createOrder|生成订单/.test(`${repair.previousCode}\n${recentEventText}`)) {
    diagnosisHints.push('这次不是“生成订单失败”，而是生成订单成功后，原手机号对应的商机可能立即从当前商机列表移除。不要再强行 `expect(targetRow).toBeVisible()`；优先在下单前后比较“签约成功(n)”计数是否增加，或改到订单管理页检索并校验新订单。');
  }
  if (
    /business\/businesslist/.test(`${snapshot.url}\n${repair.previousCode}`) &&
    /!txt\.includes\(contactPhone\)/.test(repair.previousCode) &&
    /expect\(received\)\.(?:toBeTruthy|not\.toBe\(expected\))/i.test(repair.executionError)
  ) {
    diagnosisHints.push('商机列表的“企业名称 / 联系人名称 / 联系电话”经常共用同一个复合单元格。不要因为该单元格包含手机号就整格排除，否则会把联系人名称一起丢掉；应先定位命中手机号的单元格，再按换行拆分出 companyName、contactName、contactPhone。');
  }
  if (
    /expect\(received\)\.(?:toBeTruthy|not\.toBe\(expected\))/i.test(repair.executionError) &&
    /business\/businesslist|contactPhone|contactName|businessId/.test(`${snapshot.url}\n${repair.previousCode}`)
  ) {
    diagnosisHints.push('这次失败不是“断言写法太严格”，而是联系人 / 手机号 / businessId 这些目标字段没有被稳定取到。不要继续把断言弱化成 `toBeTruthy()`、`not.toBe(\'\')` 或“任意非空单元格”；必须先定位到真实目标商机，再对明确字段做校验。若列表行文案会被省略、脱敏或异步补齐，优先改为用接口返回的 businessId 精确定位目标行，并把它传给 `__e2e.resolvePrimaryRecord(...)`，让 helper 先按主键检索列表；如果 businessId 为空，不要立刻写 `expect(businessId).toBeTruthy()`，而要先回到正确列表视角，再用手机号 + 联系人 + 状态这类稳定文本做 fallback。若列表未命中，再直接在详情页 / 详情抽屉用 `__e2e.readDetailField(...)` 逐项读取联系人、手机号和创建时间，不要对整个详情页/抽屉文本做大段 `toContain`。如果 \`recordCheck.response\` 仍在，优先再用 \`__e2e.readJsonResponse(recordCheck.response, { required: false })\` + \`__e2e.pickJsonRecord(...)\` 找到命中的列表记录，并用记录里的字段值给详情断言提供 expected value。若没有可直达 detailUrl，也可以打开该行“查看 / 详情”抽屉后再用 `readDetailField` 断言联系人、手机号和创建时间。');
  }
  if (
    /expect\(received\)\.(?:toBeTruthy|not\.toBe\(expected\))/i.test(repair.executionError) &&
    /录音|播放|audio|audioUrl|\.wav|aplayer|pause/i.test(`${description}\n${repair.previousCode}\n${recentEventText}`)
  ) {
    diagnosisHints.push('这次失败很可能不是“播放没触发”，而是成功判定写错了。最近事件里一旦已经出现 `audioUrl`、`.wav`、`code: 1` / `msg: success` 这类信号，就应优先把“接口成功 + 媒体 URL 返回 + 播放器或同行按钮状态变化”作为成功依据，不要继续写 `expect(triggered).toBeTruthy()` 这类宽泛真值断言。');
  }
  if (
    /Promise\.race\(/.test(repair.previousCode) &&
    /catch\(\(\)\s*=>\s*false\)/.test(repair.previousCode) &&
    /expect\(received\)\.(?:toBeTruthy|not\.toBe\(expected\))/i.test(repair.executionError)
  ) {
    diagnosisHints.push('当前脚本把多个候选成功信号写成了 `Promise.race([...catch(() => false)])`；只要有一个分支更早返回 `false`，整体就会被误判失败。修复时改为按顺序检查各成功信号，或使用保持 reject 的 `Promise.any(...)`，不要让单个失败分支提前产出 `false`。');
  }
  if (/audioUrl|\.wav|录音|播放/.test(recentEventText) && /code:\s*1|msg:\s*success/.test(recentEventText)) {
    diagnosisHints.push('最近执行事件已经出现录音资源 URL 或成功响应，说明点击后的业务链路大概率已经跑通。修复时只收敛修改当前播放成功的断言，不要改登录流、不要跳去无关页面，也不要发明需求里没有的页面锚点或 DOM id。');
  }
  if (
    /Cannot read properties of null \(reading 'id'\)/.test(recentEventText) &&
    /business\/businesslist|sourceSearch|infoForJson-创建人/.test(`${snapshot.url}\n${repair.previousCode}\n${recentEventText}`)
  ) {
    diagnosisHints.push('最近事件显示商机列表检索后页面自身抛出了 `Cannot read properties of null (reading \'id\')`，说明当前不是单纯 locator 问题，而是列表筛选 / 初始化尚未稳定就开始读取结果。修复时不要在搜索框一可见就立刻点“搜索”并读表格；先等待列表页筛选区和默认数据加载完成，再触发检索，并显式等待表格请求完成、loading 消失、目标结果稳定后再断言。必要时先从检索响应里提取目标 businessId，再用 businessId + 详情抽屉完成字段校验。');
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /状态证据缺失：列表行已命中，但(?:列表响应未返回状态|未获取到.+状态证据|列表响应未命中状态（含 derivedBusinessId 回填）)/.test(
      repair.executionError
    ) &&
    /statusEvidenceRecordCheck|recordCheck\.row|pickJsonRecord|shared\.businessId|contactMobile|leadMobile|businessId/.test(
      `${repair.previousCode}\n${recentEventText}`
    )
  ) {
    diagnosisHints.push(
      "这次不是列表 GET 根本没回来，而是 row 已命中、`statusEvidenceRecordCheck.response` 也在，但脚本仍只按手机号/联系人去 `pickJsonRecord(...)`，最后直接抛了“列表响应未返回状态”。修复时不要继续保留 `throw new Error('状态证据缺失：列表行已命中，但列表响应未返回状态')` 作为首选分支；先在已命中分支里补 `const rowText = await recordCheck.row.innerText().catch(() => '')`、`const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()`、`const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')`，再补 `const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;`，然后把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源。只有这条结构化回填仍拿不到状态时，才继续 detailUrl / detailEntry fallback；不要在 row 已命中后继续把“列表响应未返回状态”当默认收口。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /未找到行操作：查看/.test(repair.executionError) &&
    /statusEvidenceRecordCheck|pickJsonRecord|readDetailField|recordCheck\.row/.test(repair.previousCode) &&
    !/createOrder|data-createOrder|生成订单/.test(`${repair.previousCode}\n${recentEventText}`)
  ) {
    diagnosisHints.push('这次不是普通的 Ant Table 固定列误判，而是脚本在“列表行已命中但列表响应还没给出状态”后，擅自把“查看”当成默认详情入口。修复时不要继续保留 `await __e2e.clickAntdRowAction(page, recordCheck.row, \'查看\')` 这条默认 fallback；只有当前链路已经明确给出 `detailEntry / actionLabel / 详情标题 / detailReadyLocator` 时，才允许点击“查看 / 详情”。如果 `shared.businessId` 非空，可优先走 `detailUrl`；若 `businessId` 为空且当前页面没有明确详情入口，就保留 `recordCheck.row` 作为身份证据，继续复用 `statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)`。结构化列表响应仍拿不到状态时，直接抛出“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”，不要再臆造行操作。');
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口/.test(repair.executionError) &&
    /currentVisibleRow|recordCheck\.row|rowText|pickJsonRecord|shared\.businessId|artifacts\.leadMobile/.test(
      `${repair.previousCode}\n${recentEventText}`
    )
  ) {
    diagnosisHints.push(
      "这次不是继续给 `pickJsonRecord(...)` 补更多 path 就能顶掉当前头阻塞，而是 `businessId` 仍为空，row 已命中时也没有稳定 detail fallback。修复时只在 `currentVisibleRow` / `recordCheck.row` 已命中的分支里做一次保守回填：先 `const rowText = await recordCheck.row.innerText().catch(() => '')`，再补 `const rowKey = ((await recordCheck.row.getAttribute('data-row-key')) || '').trim()`，随后写 `const derivedBusinessId = shared.businessId || ((/^[A-Za-z0-9_-]{6,64}$/.test(rowKey) && !/^1\\d{10}$/.test(rowKey)) ? rowKey : '') || ((rowText.match(/\\b\\d{6,12}\\b/g) || []).find((item) => !/^1\\d{10}$/.test(item)) || '')`。这个回填只能用于“已命中目标行后解锁详情页回退”；不要在列表未命中前对整页文本猜 `businessId`，也不要继续把 `listResponse: { urlIncludes: '/business', method: 'GET' }` 当成唯一结构化状态来源。若 `expectedStatus` 仍为空但 `derivedBusinessId` 非空，优先 `await page.goto(`#/business/detail/${derivedBusinessId}`, { waitUntil: 'domcontentloaded' })`，再按当前商机 family 先 `await __e2e.readDetailField(page, { label: '商机进展', required: false })`，再回退 `await __e2e.readDetailField(page, { label: '状态', required: false })`；只有 `derivedBusinessId` 也为空时，才保留“状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口”这条错误收口。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /状态证据缺失：列表行已命中，但列表响应未命中记录且未提供详情入口/.test(repair.executionError) &&
    /\/business\/detail\/|detail field not found|Cannot read properties of null \(reading 'forEach'\)/.test(recentEventText)
  ) {
    diagnosisHints.push(
      "这次不是没有详情入口，而是脚本其实已经进入过商机详情路由，但 `detailUrl` 打开的很可能不是有效详情 surface。修复时不要在跳过 detailUrl 后又回到列表抛“未提供详情入口”，也不要继续在 `goto` 后直接 `readDetailField(...)`；保留这条 detail fallback，先写 `const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface');`。只有 `detailSurface` 已拿到时，才继续 `const detailStatus = await __e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false })`。如果这条 `detailSurface` guard 失败，就保留显式 `详情页无效` 收口，不要把已经存在的 detail 路由退化成“未提供详情入口”。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /状态证据缺失：列表行已命中，但列表响应、详情抽屉与详情页都未返回状态/.test(repair.executionError) &&
    /\/business\/detail\/|detail surface invalid page|Cannot read properties of null \(reading 'forEach'\)/.test(recentEventText) &&
    /page\.goto\(|readDetailField\(page,\s*\{\s*label:\s*'(商机进展|状态)'/.test(repair.previousCode)
  ) {
    diagnosisHints.push(
      "这次不是详情页里真的没有状态字段，而是 `detailUrl` 已经落到 invalid detail surface 后，脚本还把它收口成了泛化“状态证据缺失”。修复时不要继续保留 `throw new Error('状态证据缺失：列表行已命中，但列表响应、详情抽屉与详情页都未返回状态')` 作为 detailUrl 分支的第一收口；先保留 detail fallback，紧接着写 `const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface');`。只有在 `detailSurface` 存在后，才允许 `const detailStatus = await __e2e.readDetailField(page, { label: '商机进展', scope: detailSurface, titleIncludes: '商机详情', required: false }) || await __e2e.readDetailField(page, { label: '状态', scope: detailSurface, titleIncludes: '商机详情', required: false })`。如果当前链路没有显式 `detailEntry / actionLabel / detailReadyLocator`，就保留这条 `详情页无效` 错误，不要再把错误页退化成泛化“状态证据缺失”。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /详情页无效：detailUrl 未出现.+surface/.test(repair.executionError) &&
    /\/business\/detail\/|detail surface invalid page|页面好像不见了|请联系管理员/.test(recentEventText)
  ) {
    diagnosisHints.push(
      "这次不是详情字段 label 还不够多，而是 `detailUrl` 打开的根本不是有效详情页 surface。修复时不要继续在同一个 `#/business/detail/...` 页面上重复 `readDetailField(...)`；先保留这条 invalid detail 证据，并保留 `const detailSurface = await __e2e.waitForVisibleDetailSurface(page, { titleIncludes: '商机详情', timeoutMs: 2500, required: false }); if (!detailSurface) throw new Error('详情页无效：detailUrl 未出现商机详情 surface');` 这条 guard。只有当前链路已经明确给出 `detailEntry / actionLabel / detailReadyLocator` 时，才允许改走目标行的显式详情入口；若没有显式详情入口，就回到 `statusEvidenceRecordCheck.response -> __e2e.pickJsonRecord(...) -> __e2e.pickJsonValue(...)` 继续补结构化状态来源，并保留 `throw new Error('详情页无效：detailUrl 未出现商机详情 surface')` 这条收口，不要把它重新退化成“detail field not found”或“未提供详情入口”。"
    );
  }
  if (
    looksLikeBusinessCreateTask(snapshot, description, context) &&
    /状态证据缺失：列表行已命中，但列表响应和详情字段都未返回状态/.test(repair.executionError) &&
    /json record not found|\/business\/detail\/|Cannot read properties of null \(reading 'forEach'\)/.test(recentEventText) &&
    /rowKey|getAttribute\('data-row-key'\)|derivedBusinessId|resolvedBusinessId/.test(repair.previousCode) &&
    /pickJsonRecord\(listJson/.test(repair.previousCode)
  ) {
    diagnosisHints.push(
      "这次不是继续在详情页里补更多 `readDetailField('状态')` 就能过，而是 `statusEvidenceRecordCheck.response` 很可能已经拿到了正确列表响应，只是你仍在用手机号去 `pickJsonRecord(...)`。修复时在 `rowKey / derivedBusinessId / resolvedBusinessId` 已可得的前提下，先补 `const matchedRecordByDerivedBusinessId = !matchedRecord && listJson && derivedBusinessId ? __e2e.pickJsonRecord(listJson, { label: 'derivedBusinessId', value: derivedBusinessId, paths: ['businessId', 'id'], required: false }) : null;`，再把 `matchedRecord || matchedRecordByDerivedBusinessId` 当成状态来源。只有这条结构化回填仍拿不到状态时，才继续 `page.goto(#/business/detail/${derivedBusinessId})`；不要在 `json record not found -> /business/detail/:id -> null.forEach` 这条链上反复重开详情。"
    );
  }
  if (/未找到行操作：查看/.test(repair.executionError) && /createOrder|data-createOrder|生成订单/.test(`${repair.previousCode}\n${recentEventText}`)) {
    diagnosisHints.push('“查看”这一步不是当前需求的核心成功条件。既然 `createOrder` 已成功，说明订单已创建；修复时应删除“必须重新找到该商机并点查看”的假设，改成在 `createOrder` 成功、Drawer 关闭后直接完成断言，或最多只校验“签约成功(n)”计数变化。');
  }
  if (/未能打开当前字段的下拉面板/.test(repair.executionError)) {
    diagnosisHints.push('某些字段虽然看起来像“来源 / 性别 / 枚举值”，真实控件却不是 dropdown，而是当前 row 内的 radio / segmented / tab；另一些则是远程搜索 Select。修复时不要退回手写 `getByText(\'男\').click()`、`openAntdDropdown + waitForTimeout` 或硬猜控件形态；继续把 scope 收窄到当前字段 row / form-item，并优先使用 `__e2e.selectAntdOption(...)`。如果是远程搜索 Select，再显式补 `searchText` 关键词，让 helper 先尝试 row 内 inline enum，再处理真实 dropdown。');
  }
  if (
    /疑难工商注销/.test(`${repair.executionError}\n${repair.previousCode}`) &&
    /scrollIntoViewIfNeeded|locator\('\.ant-select-dropdown/i.test(repair.executionError)
  ) {
    diagnosisHints.push('这次不是“疑难工商注销”这个产品不存在，而是 repair 又退回成了手写 dropdown + `scrollIntoViewIfNeeded()`。修复时不要继续拼 `openAntdDropdown + productDropdown.locator(...)`；直接改回 `await __e2e.selectAntdOption(page, productRow, { label: \'疑难工商注销\', searchText: \'疑难工商注销\', tree: true })`，让 helper 负责可见 dropdown、搜索和滚动。');
  }
  if (/ant-select-(tree-node-content-wrapper|dropdown-menu-item|item-option-content)/i.test(repair.executionError) && /toBeVisible\(\) failed|waiting for locator|Timeout \d+ms exceeded/i.test(repair.executionError)) {
    diagnosisHints.push(
      `这次失败不是“下拉容器不存在”，而是目标枚举值${dropdownOptionLabel ? `「${dropdownOptionLabel}」` : ''}在 TreeSelect/下拉滚动区里初始不在可见范围。不要一打开下拉就 expect(option).toBeVisible()；优先直接改成 \`await __e2e.selectAntdOption(page, sourceRow, { label: '${dropdownOptionLabel || '目标枚举值'}', tree: true })\`，或至少在 dropdown 内先搜索再 scrollIntoViewIfNeeded()。`
    );
  }

  parts.push(`\n## 当前失败脚本\n\`\`\`javascript\n${repair.previousCode.trim()}\n\`\`\``);
  parts.push(`\n## 本次执行报错\n${repair.executionError.trim() || '未提供错误信息'}`);
  parts.push(renderRepairStructuredInputSection(repair));
  parts.push(renderRepairGraderDiagnosisSection(repair));
  if (recentEvents) {
    parts.push(`\n## Latest Trace（最近执行轨迹）\n${recentEvents}`);
  }
  if (diagnosisHints.length > 0) {
    parts.push(`\n## 修复诊断提示\n${diagnosisHints.map((item, index) => `${index + 1}. ${item}`).join('\n')}`);
  }
  if (repair.repairMemoryHints?.length) {
    parts.push(`\n${renderIntentRepairMemoryHints(repair.repairMemoryHints)}`);
  }
  if (resolvedPlanning.verificationPlan?.intent === 'review') {
    parts.push(`\n## 保守复核修复边界
1. 这是保守复核场景下的自动修复，只允许在当前失败点收敛 helper、selector、等待顺序和断言，不要主动扩大业务链路。
2. 不要为了通过删除关键断言，也不要把成功判定降级成 toast、整页模糊文本或宽泛 truthy。
3. 如果现有入口、helper 或结构化回查链已经明显漂移，应明确暴露真实失败，而不是发明新的旁路成功路径。`);
  }
  parts.push(`\n## 修复要求
1. 保持测试目标、步骤覆盖和关键断言不变，不要为了通过而删掉业务步骤。
2. 优先修复 locator、iframe 进入方式、等待顺序、下拉选择和结果断言，不要扩大成无关重写。
3. 如果快照、Iframe 摘要、现有范例已经给出更稳定的 id / class / selector / frame URL，必须直接使用。
4. 输出完整替换后的 JavaScript 测试代码，不要解释原因。
5. 修复后的代码必须继续遵守上面的“执行动作约束 DSL”；若要调整实现路径，只能在同一步骤语义内收敛修改。`);

  return parts.join('\n');
}

function createAbortError(message = '当前自动测试已取消'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal, message?: string): void {
  if (!signal?.aborted) return;
  throw createAbortError(message || '当前自动测试已取消');
}

function extractGeneratedCode(fullCode: string): string {
  const match = fullCode.match(/```(?:javascript|typescript|js|ts)?\n([\s\S]*?)```/);
  const code = match ? match[1].trim() : fullCode.trim();

  if (!code.includes('test(') && !code.includes('test.describe(')) {
    throw new Error('生成的代码缺少 test() 或 test.describe()，请重试');
  }
  if (code.includes('__PLAN_SLOT_')) {
    throw new Error('生成的代码仍包含未实现的结构化 slot，占位符未被替换');
  }

  return code;
}

function validateGeneratedCodeSyntax(code: string, contextLabel: string): void {
  try {
    new Script(code, { filename: `${contextLabel}.generated.js` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '未知错误');
    throw new Error(`${contextLabel} 合并后脚本存在语法错误: ${message}`);
  }
}

function hasAllTargetSlotMarkers(code: string, slotUids: string[]): boolean {
  return slotUids.every((slotUid) => hasIntentExecutionSlotMarkers(code, slotUid));
}

function resolveStructuredRepairBaseCode(
  template: IntentCompiledExecutionTemplate,
  repair: RepairTestContext
): {
  baseCode: string;
  targetSlotUids: string[];
  reusePreviousCode: boolean;
  baseCodeSource: IntentExecutionBaseCodeSource;
} {
  const inferredTargetSlotUids = resolveIntentExecutionPatchTargetSlotUids(template, {
    failedSlotUids: repair.failedSlotUids,
    failedStepTitle: repair.failedStepTitle,
  });
  const previousCode = String(repair.previousCode || '').trim();
  const canReusePreviousCode =
    previousCode.length > 0 &&
    hasIntentExecutionSlotMarkers(previousCode) &&
    hasAllTargetSlotMarkers(previousCode, template.slots.map((slot) => slot.slotUid));

  if (canReusePreviousCode) {
    return {
      baseCode: previousCode,
      targetSlotUids: inferredTargetSlotUids,
      reusePreviousCode: true,
      baseCodeSource: 'previous_code',
    };
  }

  return {
    baseCode: template.code,
    targetSlotUids: template.slots.map((slot) => slot.slotUid),
    reusePreviousCode: false,
    baseCodeSource: 'compiled_template',
  };
}

async function* streamStructuredSlotPatchGeneration(
  prompt: string,
  baseCode: string,
  targetSlotUids: string[],
  options: {
    reusePreviousCode: boolean;
    baseCodeSource: IntentExecutionBaseCodeSource;
  },
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): AsyncGenerator<
  GenerateEvent,
  {
    success: boolean;
    errorMessage?: string;
  }
> {
  throwIfAborted(signal);

  try {
    const patch = await callLLMStructured<IntentExecutionSlotPatch>(
      {
        prompt,
        systemPrompt: 'You are a senior Playwright E2E testing expert. Return strict JSON slot patches only.',
        schemaName: 'intent_execution_slot_patch',
        schema: buildIntentExecutionSlotPatchSchema(targetSlotUids),
        temperature: 0.2,
        maxOutputTokens: 3200,
      },
      runtimeOverrides,
      signal
    );

    throwIfAborted(signal);
    const normalizedPatch = normalizeIntentExecutionSlotPatch(patch, targetSlotUids);
    const structuredPatch: IntentExecutionStructuredPatch = {
      version: 1,
      strategy: 'deterministic_slot_patch_v1',
      targetSlotUids: [...targetSlotUids],
      returnedSlotUids: normalizedPatch.slots.map((slot) => slot.slotUid),
      reusedPreviousCode: options.reusePreviousCode,
      baseCodeSource: options.baseCodeSource,
      patch: normalizedPatch,
    };
    yield {
      type: 'structured_patch',
      content: `slot patch ready: ${structuredPatch.returnedSlotUids.join(' / ')}`,
      structuredPatch,
    };
    const code = extractGeneratedCode(applyIntentExecutionSlotPatch(baseCode, normalizedPatch));
    validateGeneratedCodeSyntax(code, 'slot patch');
    yield { type: 'complete', content: code };
    return { success: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    return {
      success: false,
      errorMessage: String(err?.message || '未知错误'),
    };
  }
}

async function* streamStructuredRepairPatchGeneration(
  prompt: string,
  baseCode: string,
  template: IntentCompiledExecutionTemplate,
  planning: ResolvedPromptPlanningContext,
  targetSlotUids: string[],
  repair: RepairTestContext,
  options: {
    reusePreviousCode: boolean;
    baseCodeSource: IntentExecutionBaseCodeSource;
  },
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): AsyncGenerator<
  GenerateEvent,
  {
    success: boolean;
    errorMessage?: string;
  }
> {
  throwIfAborted(signal);

  try {
    const repairOutputContext = buildStructuredRepairOutputContext(template, targetSlotUids, planning, repair);
    const patch = await callLLMStructured<IntentExecutionRepairPatch>(
      {
        prompt,
        systemPrompt: 'You are a senior Playwright E2E testing expert. Return strict JSON repair patches only.',
        schemaName: 'intent_execution_repair_patch',
        schema: buildIntentExecutionRepairPatchSchema({
          targetSlotUids,
          planStepUids: repairOutputContext.planStepUids,
          checkUids: repairOutputContext.checkUids,
          recipeSlugs: repairOutputContext.recipeSlugs,
        }),
        temperature: 0.2,
        maxOutputTokens: 3600,
      },
      runtimeOverrides,
      signal
    );

    throwIfAborted(signal);
    const normalizedRepairPatch = normalizeIntentExecutionRepairPatch(patch, {
      targetSlotUids,
      planStepUids: repairOutputContext.planStepUids,
      checkUids: repairOutputContext.checkUids,
      recipeSlugs: repairOutputContext.recipeSlugs,
    });
    const repairOutput = buildStructuredRepairOutput(
      normalizedRepairPatch,
      template,
      planning,
      targetSlotUids,
      options
    );
    const structuredPatch = buildStructuredPatchFromRepairOutput(repairOutput);
    yield {
      type: 'structured_patch',
      content: `slot patch ready: ${structuredPatch.returnedSlotUids.join(' / ')}`,
      structuredPatch,
      repairOutput,
    };
    const code = extractGeneratedCode(applyIntentExecutionSlotPatch(baseCode, repairOutput.patch));
    validateGeneratedCodeSyntax(code, 'repair patch');
    yield { type: 'complete', content: code };
    return { success: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    return {
      success: false,
      errorMessage: String(err?.message || '未知错误'),
    };
  }
}

async function* streamCodeGeneration(
  prompt: string,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal
): AsyncGenerator<GenerateEvent> {
  let fullCode = '';
  throwIfAborted(signal);
  try {
    for await (const chunk of callLLMStream(prompt, undefined, runtimeOverrides, signal)) {
      fullCode += chunk.content;
      yield { type: 'code', content: chunk.content };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    yield { type: 'error', content: `LLM 调用失败: ${err.message}` };
    return;
  }

  try {
    yield { type: 'complete', content: extractGeneratedCode(fullCode) };
  } catch (err: any) {
    yield { type: 'error', content: err.message || '生成代码解析失败' };
  }
}

export async function* generateTest(
  snapshot: PageSnapshot,
  description: string,
  auth?: AuthConfig,
  context?: GenerateTestContext,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal,
  planning?: ResolvedPromptPlanningContext
): AsyncGenerator<GenerateEvent> {
  throwIfAborted(signal);
  yield { type: 'thinking', content: '正在加载历史边缘案例...' };
  const edgeCases = await loadEdgeCases(context?.scenarioEntryUrl || snapshot.url);
  yield { type: 'thinking', content: `找到 ${edgeCases.length} 个相关边缘案例` };

  const resolvedPlanning =
    planning || resolveIntentPromptPlanningContext(snapshot, description, context, { auth, projectUid: context?.projectUid });
  yield { type: 'thinking', content: '正在加载现有测试范例...' };
  const existingExample = await loadExistingExample(snapshot, description, context, resolvedPlanning);
  const deterministicTemplate = resolveDeterministicTemplate(snapshot, description, existingExample, context, resolvedPlanning);
  if (deterministicTemplate) {
    yield { type: 'thinking', content: '命中已验证的专门模板，直接复用稳定脚本...' };
    yield { type: 'complete', content: deterministicTemplate };
    return;
  }

  yield { type: 'thinking', content: '正在匹配项目知识规则...' };
  yield {
    type: 'thinking',
    content: formatPlanningKnowledgeHitMessage('', resolvedPlanning).trim(),
  };
  const experienceMessage = formatPlanningExperienceMessage(resolvedPlanning);
  if (experienceMessage) {
    yield {
      type: 'thinking',
      content: experienceMessage,
    };
  }
  const starterHelperMessage = formatPlanningStarterHelperMessage(resolvedPlanning);
  if (starterHelperMessage) {
    yield {
      type: 'thinking',
      content: starterHelperMessage,
    };
  }

  const compiledTemplate = compilePlanningExecutionTemplate(resolvedPlanning, auth, description);
  if (compiledTemplate) {
    yield { type: 'thinking', content: '已将 ExecutionPlan 编译成受控脚手架，正在生成 slot patch...' };
    const targetSlotUids = compiledTemplate.slots.map((slot) => slot.slotUid);
    const prompt = buildSlotPatchPrompt(
      snapshot,
      description,
      auth,
      edgeCases,
      existingExample,
      compiledTemplate,
      targetSlotUids,
      compiledTemplate.code,
      context,
      resolvedPlanning
    );
    const structuredPatchResult = yield* streamStructuredSlotPatchGeneration(
      prompt,
      compiledTemplate.code,
      targetSlotUids,
      {
        reusePreviousCode: false,
        baseCodeSource: 'compiled_template',
      },
      runtimeOverrides,
      signal
    );
    if (structuredPatchResult.success) {
      return;
    }
    yield {
      type: 'thinking',
      content: buildStructuredSlotPatchFallbackReason(structuredPatchResult.errorMessage || ''),
    };
  } else {
    yield { type: 'thinking', content: buildLegacyCodeFallbackReason('generate', resolvedPlanning) };
  }

  yield { type: 'thinking', content: '正在构造自由代码 Prompt 并调用 LLM...' };
  const prompt = buildPrompt(snapshot, description, auth, edgeCases, existingExample, context, resolvedPlanning);
  yield* streamCodeGeneration(prompt, runtimeOverrides, signal);
}

export async function* repairTest(
  snapshot: PageSnapshot,
  description: string,
  repair: RepairTestContext,
  auth?: AuthConfig,
  context?: GenerateTestContext,
  runtimeOverrides?: LLMRuntimeOverrides,
  signal?: AbortSignal,
  planning?: ResolvedPromptPlanningContext
): AsyncGenerator<GenerateEvent> {
  throwIfAborted(signal);
  yield { type: 'thinking', content: '正在回收失败执行上下文...' };
  const edgeCases = await loadEdgeCases(context?.scenarioEntryUrl || snapshot.url);
  yield { type: 'thinking', content: `已加载 ${edgeCases.length} 个相关边缘案例` };

  const resolvedPlanning =
    planning || resolveIntentPromptPlanningContext(snapshot, description, context, { projectUid: context?.projectUid });
  yield { type: 'thinking', content: '正在加载现有测试范例...' };
  const existingExample = await loadExistingExample(snapshot, description, context, resolvedPlanning);
  const deterministicTemplate = resolveDeterministicTemplate(snapshot, description, existingExample, context, resolvedPlanning);
  if (deterministicTemplate) {
    yield { type: 'thinking', content: '命中已验证的专门模板，直接回退到稳定脚本...' };
    yield { type: 'complete', content: deterministicTemplate };
    return;
  }

  yield { type: 'thinking', content: '正在匹配项目知识规则...' };
  yield {
    type: 'thinking',
    content: formatPlanningKnowledgeHitMessage('repair ', resolvedPlanning),
  };
  const experienceMessage = formatPlanningExperienceMessage(resolvedPlanning);
  if (experienceMessage) {
    yield {
      type: 'thinking',
      content: `repair ${experienceMessage}`,
    };
  }
  const starterHelperMessage = formatPlanningStarterHelperMessage(resolvedPlanning);
  if (starterHelperMessage) {
    yield {
      type: 'thinking',
      content: `repair ${starterHelperMessage}`,
    };
  }

  const compiledTemplate = compilePlanningExecutionTemplate(resolvedPlanning, auth, description);
  if (compiledTemplate) {
    const structuredRepair = resolveStructuredRepairBaseCode(compiledTemplate, repair);
    const structuredRepairContext = enrichRepairContextWithStructuredInputs(
      repair,
      compiledTemplate,
      structuredRepair.targetSlotUids,
      resolvedPlanning
    );
    yield {
      type: 'thinking',
      content: structuredRepair.reusePreviousCode
        ? `正在按失败 slot 定向修复：${structuredRepair.targetSlotUids.join(' / ')}`
        : '上一轮脚本缺少 slot 标记，正在回退为全量 slot 重建...',
    };
    const prompt = buildSlotPatchPrompt(
      snapshot,
      description,
      auth,
      edgeCases,
      existingExample,
      compiledTemplate,
      structuredRepair.targetSlotUids,
      structuredRepair.baseCode,
      context,
      resolvedPlanning,
      structuredRepairContext
    );
    const structuredRepairResult = yield* streamStructuredRepairPatchGeneration(
      prompt,
      structuredRepair.baseCode,
      compiledTemplate,
      resolvedPlanning,
      structuredRepair.targetSlotUids,
      structuredRepairContext,
      {
        reusePreviousCode: structuredRepair.reusePreviousCode,
        baseCodeSource: structuredRepair.baseCodeSource,
      },
      runtimeOverrides,
      signal
    );
    if (structuredRepairResult.success) {
      return;
    }
    yield {
      type: 'thinking',
      content: buildStructuredRepairPatchFallbackReason(structuredRepairResult.errorMessage || ''),
    };
  } else {
    yield { type: 'thinking', content: buildLegacyCodeFallbackReason('repair', resolvedPlanning) };
  }

  yield { type: 'thinking', content: '正在构造自由代码修复 Prompt 并调用 LLM...' };
  const prompt = buildRepairPrompt(snapshot, description, auth, edgeCases, existingExample, repair, context, resolvedPlanning);
  yield* streamCodeGeneration(prompt, runtimeOverrides, signal);
}
