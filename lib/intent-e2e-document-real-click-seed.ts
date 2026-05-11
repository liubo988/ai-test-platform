import {
  classifyTrafficQualityDocumentFamily,
  type IntentE2ETrafficQualityDocumentFamily,
} from '@/lib/intent-e2e-traffic-quality';
import type { IntentE2EPriorityScenarioFamily } from '@/lib/intent-e2e-priority-scenario-family';
import type { ScenarioCard } from '@/lib/ai/scenario-card';
import {
  buildProjectKnowledgeDocumentArchiveRestorePreviewPlanCode,
  buildProjectKnowledgeDocumentDeriveCapabilityPreviewPlanCode,
  buildProjectKnowledgeDocumentEditSavePreviewPlanCode,
  buildProjectKnowledgeDocumentImportPreviewPlanCode,
  buildProjectKnowledgeDocumentSearchOpenPreviewPlanCode,
} from '@/lib/intent-e2e-project-knowledge-document-template';

export const INTENT_E2E_DOCUMENT_REAL_CLICK_SEED_REPORT_JSON_FILE =
  'intent-e2e.document-real-click-seed-report.latest.json';
export const INTENT_E2E_DOCUMENT_REAL_CLICK_SEED_REPORT_MD_FILE =
  'intent-e2e.document-real-click-seed-report.latest.md';

export type IntentE2EDocumentRealClickSeedProvenance =
  | 'document_surface_current_system'
  | 'document_assisted_current_system_business_flow';

export type IntentE2EDocumentRealClickSeedAdmissibility =
  | 'document_family_admissible'
  | 'document_reference_only_business_flow';

export interface IntentE2EDocumentRealClickSeedSample {
  sampleId: string;
  name: string;
  moduleUid: string;
  targetUrl: string;
  input: string;
  provenance: IntentE2EDocumentRealClickSeedProvenance;
  expectedPriorityScenarioFamily: IntentE2EPriorityScenarioFamily;
  documentFamily: IntentE2ETrafficQualityDocumentFamily | '';
  admissibility: IntentE2EDocumentRealClickSeedAdmissibility;
  notes: string[];
}

export interface IntentE2EDocumentRealClickSeedResult extends IntentE2EDocumentRealClickSeedSample {
  launchDecision: string;
  launchReason: string;
  runId: string;
  status: string;
  errorMessage: string;
  timedOut: boolean;
  matchedRuleIds: string[];
  matchedRecipeSlugs: string[];
}

export interface IntentE2EDocumentRealClickSeedReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  sourcePolicy: 'launch_decision_runs_without_intent_draft_uid';
  denominatorPolicy: string;
  dryRun: boolean;
  summary: {
    sampleCount: number;
    admissibleDocumentSamples: number;
    referenceOnlyBusinessFlowSamples: number;
    autoRunStarted: number;
    terminalRuns: number;
    passedRuns: number;
    failedRuns: number;
    blockedRuns: number;
    timedOutRuns: number;
  };
  results: IntentE2EDocumentRealClickSeedResult[];
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:3666';
const DEFAULT_PROJECT_UID = 'proj_default';

type IntentE2EDocumentRealClickSeedBlueprint = Omit<
  IntentE2EDocumentRealClickSeedSample,
  'targetUrl' | 'documentFamily' | 'admissibility'
> & {
  targetUrl: string | ((input: { projectUid: string; baseUrl: string }) => string);
};

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  return normalized || DEFAULT_BASE_URL;
}

function buildProjectKnowledgeWorkbenchUrl(input: { projectUid: string; baseUrl: string }): string {
  const projectUid = input.projectUid.trim() || DEFAULT_PROJECT_UID;
  return `${normalizeBaseUrl(input.baseUrl)}/projects/${encodeURIComponent(projectUid)}?intentView=knowledge`;
}

const DEFAULT_DOCUMENT_REAL_CLICK_SEED_BLUEPRINTS: IntentE2EDocumentRealClickSeedBlueprint[] = [
  {
    sampleId: 'project-knowledge-document-import-preview',
    name: '项目知识文档导入后预览验收',
    moduleUid: 'mod_1773303139537_c84d8476',
    targetUrl: buildProjectKnowledgeWorkbenchUrl,
    input:
      '打开项目知识文档工作台，导入一篇名为“真实文档采集手册”的知识文档，内容包含“真实 document-like real_click 采集锚点”，导入后重新预览该知识文档并校验标题和正文锚点可见。',
    provenance: 'document_surface_current_system',
    expectedPriorityScenarioFamily: 'untracked',
    notes: [
      '该样本操作的是当前平台真实知识文档 UI：打开需求编排工作台、进入知识文档、导入文档并预览切块。',
      '该请求不携带 intentDraftUid，启动成功后进入 traffic-quality source=real_click 分母；documentFamily 非空时可作为 document family 治理候选。',
    ],
  },
  {
    sampleId: 'project-knowledge-document-search-open-preview',
    name: '项目知识文档搜索打开后预览验收',
    moduleUid: 'mod_1773303139537_c84d8476',
    targetUrl: buildProjectKnowledgeWorkbenchUrl,
    input:
      '打开项目知识文档工作台，在知识目录中打开名为“搜索打开验证手册”的知识文档，进入文档块预览后搜索“真实 document-like search open 采集锚点”，校验当前预览标题和正文锚点可见。',
    provenance: 'document_surface_current_system',
    expectedPriorityScenarioFamily: 'untracked',
    notes: [
      '该样本操作的是当前平台真实知识文档 UI：打开需求编排工作台、进入知识文档、打开已有文档预览并搜索文档块。',
      '该请求不携带 intentDraftUid，启动成功后进入 traffic-quality source=real_click 分母；该样本用于采集 doc_search_open_verify 候选。',
    ],
  },
  {
    sampleId: 'project-knowledge-document-edit-save-preview',
    name: '项目知识文档编辑保存后预览验收',
    moduleUid: 'mod_1773303139537_c84d8476',
    targetUrl: buildProjectKnowledgeWorkbenchUrl,
    input:
      '打开项目知识文档工作台，编辑并保存名为“编辑保存验证手册”的已有知识文档内容，保存后校验当前预览标题、旧正文锚点不再匹配，且更新后的正文锚点在文档块预览区可见。',
    provenance: 'document_surface_current_system',
    expectedPriorityScenarioFamily: 'untracked',
    notes: [
      '该样本操作的是当前平台真实知识文档 UI：打开已有文档预览，通过同名文档整篇替换完成编辑保存，并校验更新后的文档块。',
      '该请求不携带 intentDraftUid，启动成功后进入 traffic-quality source=real_click 分母；该样本用于采集 doc_edit_save_verify 候选。',
    ],
  },
  {
    sampleId: 'project-knowledge-document-archive-restore-preview',
    name: '项目知识文档归档恢复后预览验收',
    moduleUid: 'mod_1773303139537_c84d8476',
    targetUrl: buildProjectKnowledgeWorkbenchUrl,
    input:
      '打开项目知识文档工作台，归档并恢复名为“归档恢复验证手册”的已有知识文档，恢复后重新预览该文档并校验文档块正文锚点可见。',
    provenance: 'document_surface_current_system',
    expectedPriorityScenarioFamily: 'untracked',
    notes: [
      '该样本操作的是当前平台真实知识文档 UI：打开已有文档预览，通过知识目录归档并恢复文档，再重新预览文档块。',
      '该请求不携带 intentDraftUid，启动成功后进入 traffic-quality source=real_click 分母；该样本用于采集 doc_archive_restore_verify 候选。',
    ],
  },
  {
    sampleId: 'project-knowledge-document-derive-capability-preview',
    name: '项目知识文档自动沉淀能力后目录验收',
    moduleUid: 'mod_1773303139537_c84d8476',
    targetUrl: buildProjectKnowledgeWorkbenchUrl,
    input:
      '打开项目知识文档工作台，打开名为“沉淀能力验证手册”的已有知识文档，在当前预览中校验正文锚点后点击“自动沉淀能力”，再进入能力目录校验新生成的知识提炼稳定能力可见。',
    provenance: 'document_surface_current_system',
    expectedPriorityScenarioFamily: 'untracked',
    notes: [
      '该样本操作的是当前平台真实知识文档 UI：打开已有文档预览，通过“自动沉淀能力”把文档块提炼为稳定能力并在能力目录验收。',
      '该请求不携带 intentDraftUid，启动成功后进入 traffic-quality source=real_click 分母；该样本用于采集 doc_derive_capability_verify 候选。',
    ],
  },
  {
    sampleId: 'document-assisted-business-create-list-verify',
    name: '知识文档辅助新建商机回列表验收',
    moduleUid: 'mod_1773303139537_c84d8476',
    targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
    input:
      '参考知识文档《管帮手PC端操作手册》中关于新建商机的说明，登录后台后在商机列表页发起新建商机并保存，随后切换到“我创建的”Tab，等待列表加载完成，校验新建商机记录出现在列表中且“商机进展”为“新入库”。',
    provenance: 'document_assisted_current_system_business_flow',
    expectedPriorityScenarioFamily: 'business_create_list_verify',
    notes: [
      '当前项目配置没有真实文档页面目标；该样本复用已跑通的新建商机真实路径，用于采集稳定的 document-assisted real_click 分母。',
      '该请求不携带 intentDraftUid，若成功启动会进入 traffic-quality source=real_click 分母；但它仍不是 document family 治理候选。',
    ],
  },
  {
    sampleId: 'document-assisted-business-batch-add-contacts',
    name: '知识文档辅助商机批量加入通讯录验收',
    moduleUid: 'mod_1773135901041_3d6eee14',
    targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
    input:
      '参考知识文档《管帮手PC端操作手册》中关于商机批量加入通讯录的说明，在商机列表随机勾选一条带联系人手机号的商机，执行“批量加入通讯录”，然后进入我的通讯录按手机号搜索并验证该联系人可见；如果当前结果为空，先切到有数量的商机进展阶段。',
    provenance: 'document_assisted_current_system_business_flow',
    expectedPriorityScenarioFamily: 'business_batch_add_contacts_verify',
    notes: [
      '当前项目配置没有真实文档页面目标；该样本用于验证“引用知识文档的真实点击业务流”不会被误当成 document family 治理准入。',
      '该请求不携带 intentDraftUid，若成功启动会进入 traffic-quality source=real_click 分母。',
    ],
  },
];

function cloneSample(
  sample: IntentE2EDocumentRealClickSeedBlueprint,
  options: {
    projectUid?: string;
    baseUrl?: string;
  }
): IntentE2EDocumentRealClickSeedSample {
  const targetUrl =
    typeof sample.targetUrl === 'function'
      ? sample.targetUrl({
          projectUid: options.projectUid?.trim() || DEFAULT_PROJECT_UID,
          baseUrl: normalizeBaseUrl(options.baseUrl || DEFAULT_BASE_URL),
        })
      : sample.targetUrl;
  const documentFamily = classifyTrafficQualityDocumentFamily({
    input: sample.input,
    targetUrl,
  });
  return {
    ...sample,
    targetUrl,
    documentFamily,
    admissibility: documentFamily ? 'document_family_admissible' : 'document_reference_only_business_flow',
    notes: [...sample.notes],
  };
}

function buildProjectKnowledgeDocumentImportPreviewScenarioCard(
  sample: IntentE2EDocumentRealClickSeedSample
): ScenarioCard {
  return {
    version: 1,
    title: sample.name,
    taskMode: 'scenario',
    targetUrl: sample.targetUrl,
    featureDescription:
      '打开当前平台项目页的需求编排工作台，进入知识文档视图，导入一篇知识文档后在文档块预览区校验标题和正文锚点可见。',
    flowDefinition: {
      version: 1,
      entryUrl: sample.targetUrl,
      sharedVariables: ['knowledgeDocumentName', 'knowledgeDocumentAnchor'],
      expectedOutcome: '知识文档已通过 UI 导入，当前预览切换到该文档，且文档块预览区展示正文锚点。',
      cleanupNotes: '文档名称带时间戳；同名文档可整篇替换，不需要额外清理。',
      steps: [
        {
          stepUid: 'open_project_intent_workbench',
          stepType: 'ui',
          title: '打开需求编排工作台',
          target: sample.targetUrl,
          instruction: '进入项目页后点击“需求编排”，等待“需求编排工作台”弹层出现。',
          expectedResult: '需求编排工作台弹层可见。',
          extractVariable: '',
        },
        {
          stepUid: 'open_knowledge_document_view',
          stepType: 'ui',
          title: '进入知识文档视图',
          target: sample.targetUrl,
          instruction: '在工作台内点击“知识文档”标签，等待“导入知识文档”面板出现。',
          expectedResult: '知识文档导入表单可见。',
          extractVariable: '',
        },
        {
          stepUid: 'import_knowledge_document',
          stepType: 'ui',
          title: '导入知识文档',
          target: sample.targetUrl,
          instruction: '填写知识文档名称、来源路径和知识文档内容，点击“导入知识”。',
          expectedResult: '页面出现“知识文档已导入”提示。',
          extractVariable: 'knowledgeDocumentName',
        },
        {
          stepUid: 'verify_knowledge_document_preview',
          stepType: 'assert',
          title: '校验文档预览',
          target: sample.targetUrl,
          instruction: '校验“当前预览”已切到刚导入的文档，并在文档块预览区搜索正文锚点。',
          expectedResult: '文档块预览区展示“真实 document-like real_click 采集锚点”。',
          extractVariable: '',
        },
      ],
    },
    successCriteria: [
      '“知识文档已导入”提示可见。',
      '“当前预览”指向本次导入的文档名称。',
      '文档块预览区展示“真实 document-like real_click 采集锚点”。',
    ],
    visualAnchors: [
      '需求编排',
      '需求编排工作台',
      '知识文档',
      '导入知识文档',
      '知识文档名称',
      '知识来源路径',
      '知识文档内容',
      '导入知识',
      '当前预览',
      '文档块预览',
    ],
    notes: [
      '该 ScenarioCard 面向当前平台真实项目知识文档 UI，不访问外部 UAT 业务系统。',
      '该样本用于 traffic-quality source=real_click 的 document family 准入采集。',
    ],
  };
}

function buildProjectKnowledgeDocumentSearchOpenPreviewScenarioCard(
  sample: IntentE2EDocumentRealClickSeedSample
): ScenarioCard {
  return {
    version: 1,
    title: sample.name,
    taskMode: 'scenario',
    targetUrl: sample.targetUrl,
    featureDescription:
      '打开当前平台项目页的需求编排工作台，进入知识文档视图，打开已有知识文档预览并在文档块预览区搜索正文锚点。',
    flowDefinition: {
      version: 1,
      entryUrl: sample.targetUrl,
      sharedVariables: ['knowledgeDocumentName', 'knowledgeDocumentAnchor'],
      expectedOutcome: '当前预览切换到目标知识文档，且文档块预览区搜索后展示正文锚点。',
      cleanupNotes: '文档名称带时间戳；fixture setup 会用 API 准备唯一知识文档。',
      steps: [
        {
          stepUid: 'open_project_intent_workbench',
          stepType: 'ui',
          title: '打开需求编排工作台',
          target: sample.targetUrl,
          instruction: '进入项目页后点击“需求编排”，等待“需求编排工作台”弹层出现。',
          expectedResult: '需求编排工作台弹层可见。',
          extractVariable: '',
        },
        {
          stepUid: 'open_knowledge_document_view',
          stepType: 'ui',
          title: '进入知识文档视图',
          target: sample.targetUrl,
          instruction: '在工作台内点击“知识文档”标签，等待知识目录和导入面板出现。',
          expectedResult: '知识目录可见。',
          extractVariable: '',
        },
        {
          stepUid: 'open_existing_knowledge_document',
          stepType: 'ui',
          title: '打开已有知识文档',
          target: sample.targetUrl,
          instruction: '在知识目录中找到目标文档并点击“预览”。',
          expectedResult: '当前预览切换到目标文档名称。',
          extractVariable: 'knowledgeDocumentName',
        },
        {
          stepUid: 'search_knowledge_document_chunk',
          stepType: 'assert',
          title: '搜索并校验文档块',
          target: sample.targetUrl,
          instruction: '在“搜索文档块”输入正文锚点并校验预览区展示该锚点。',
          expectedResult: '文档块预览区展示“真实 document-like search open 采集锚点”。',
          extractVariable: '',
        },
      ],
    },
    successCriteria: [
      '“当前预览”指向目标文档名称。',
      '“搜索文档块”输入后仍可见目标正文锚点。',
      '文档块预览区展示“真实 document-like search open 采集锚点”。',
    ],
    visualAnchors: [
      '需求编排',
      '需求编排工作台',
      '知识文档',
      '知识目录',
      '预览',
      '当前预览',
      '文档块预览',
      '搜索文档块',
    ],
    notes: [
      '该 ScenarioCard 面向当前平台真实项目知识文档 UI，不访问外部 UAT 业务系统。',
      '该样本用于 traffic-quality source=real_click 的 doc_search_open_verify 候选采集。',
    ],
  };
}

function buildProjectKnowledgeDocumentEditSavePreviewScenarioCard(
  sample: IntentE2EDocumentRealClickSeedSample
): ScenarioCard {
  return {
    version: 1,
    title: sample.name,
    taskMode: 'scenario',
    targetUrl: sample.targetUrl,
    featureDescription:
      '打开当前平台项目页的需求编排工作台，进入知识文档视图，编辑并保存已有知识文档内容，在文档块预览区校验更新内容生效。',
    flowDefinition: {
      version: 1,
      entryUrl: sample.targetUrl,
      sharedVariables: ['knowledgeDocumentName', 'originalDocumentAnchor', 'updatedDocumentAnchor'],
      expectedOutcome: '同名知识文档已通过 UI 保存更新，当前预览仍指向目标文档，旧锚点不再匹配，更新锚点可见。',
      cleanupNotes: '文档名称带时间戳；fixture setup 会用 API 准备唯一知识文档。',
      steps: [
        {
          stepUid: 'open_project_intent_workbench',
          stepType: 'ui',
          title: '打开需求编排工作台',
          target: sample.targetUrl,
          instruction: '进入项目页后点击“需求编排”，等待“需求编排工作台”弹层出现。',
          expectedResult: '需求编排工作台弹层可见。',
          extractVariable: '',
        },
        {
          stepUid: 'open_knowledge_document_view',
          stepType: 'ui',
          title: '进入知识文档视图',
          target: sample.targetUrl,
          instruction: '在工作台内点击“知识文档”标签，等待知识目录和导入面板出现。',
          expectedResult: '知识目录可见。',
          extractVariable: '',
        },
        {
          stepUid: 'preview_existing_knowledge_document',
          stepType: 'ui',
          title: '预览已有知识文档',
          target: sample.targetUrl,
          instruction: '在知识目录中打开目标文档预览，并确认原始正文锚点可见。',
          expectedResult: '当前预览切换到目标文档，文档块展示原始正文锚点。',
          extractVariable: 'knowledgeDocumentName',
        },
        {
          stepUid: 'edit_save_knowledge_document',
          stepType: 'ui',
          title: '编辑保存知识文档',
          target: sample.targetUrl,
          instruction: '用同名文档填写更新后的来源路径和知识内容，点击“导入知识”完成保存。',
          expectedResult: '页面出现本次文档名称的保存成功信号。',
          extractVariable: '',
        },
        {
          stepUid: 'verify_updated_knowledge_document_preview',
          stepType: 'assert',
          title: '校验更新后预览',
          target: sample.targetUrl,
          instruction: '搜索旧正文锚点确认不再匹配，再搜索更新后的正文锚点并校验预览区可见。',
          expectedResult: '旧锚点无匹配，文档块预览区展示“真实 document-like edit save 更新锚点”。',
          extractVariable: '',
        },
      ],
    },
    successCriteria: [
      '“当前预览”指向目标文档名称。',
      '旧正文锚点搜索后不再匹配。',
      '文档块预览区展示“真实 document-like edit save 更新锚点”。',
    ],
    visualAnchors: [
      '需求编排',
      '需求编排工作台',
      '知识文档',
      '知识目录',
      '预览',
      '导入知识文档',
      '知识文档名称',
      '知识文档内容',
      '导入知识',
      '当前预览',
      '搜索文档块',
    ],
    notes: [
      '该 ScenarioCard 面向当前平台真实项目知识文档 UI，不访问外部 UAT 业务系统。',
      '该样本用于 traffic-quality source=real_click 的 doc_edit_save_verify 候选采集。',
    ],
  };
}

function buildProjectKnowledgeDocumentArchiveRestorePreviewScenarioCard(
  sample: IntentE2EDocumentRealClickSeedSample
): ScenarioCard {
  return {
    version: 1,
    title: sample.name,
    taskMode: 'scenario',
    targetUrl: sample.targetUrl,
    featureDescription:
      '打开当前平台项目页的需求编排工作台，进入知识文档视图，归档并恢复已有知识文档，再重新预览文档块正文锚点。',
    flowDefinition: {
      version: 1,
      entryUrl: sample.targetUrl,
      sharedVariables: ['knowledgeDocumentName', 'knowledgeDocumentAnchor'],
      expectedOutcome: '目标知识文档已通过 UI 归档并恢复，恢复后当前预览可重新打开并展示正文锚点。',
      cleanupNotes: '文档名称带时间戳；fixture setup 会用 API 准备唯一知识文档，运行结束后保持 active 状态。',
      steps: [
        {
          stepUid: 'open_project_intent_workbench',
          stepType: 'ui',
          title: '打开需求编排工作台',
          target: sample.targetUrl,
          instruction: '进入项目页后点击“需求编排”，等待“需求编排工作台”弹层出现。',
          expectedResult: '需求编排工作台弹层可见。',
          extractVariable: '',
        },
        {
          stepUid: 'open_knowledge_document_view',
          stepType: 'ui',
          title: '进入知识文档视图',
          target: sample.targetUrl,
          instruction: '在工作台内点击“知识文档”标签，等待知识目录和导入面板出现。',
          expectedResult: '知识目录可见。',
          extractVariable: '',
        },
        {
          stepUid: 'preview_existing_knowledge_document',
          stepType: 'ui',
          title: '预览已有知识文档',
          target: sample.targetUrl,
          instruction: '在知识目录中打开目标文档预览，并确认正文锚点可见。',
          expectedResult: '当前预览切换到目标文档，文档块展示正文锚点。',
          extractVariable: 'knowledgeDocumentName',
        },
        {
          stepUid: 'archive_restore_knowledge_document',
          stepType: 'ui',
          title: '归档并恢复知识文档',
          target: sample.targetUrl,
          instruction: '点击目标文档“归档”并确认，等待已归档状态；随后点击“恢复”并等待文档回到可归档状态。',
          expectedResult: '目标文档先出现已归档状态，恢复后重新出现归档按钮。',
          extractVariable: '',
        },
        {
          stepUid: 'verify_restored_knowledge_document_preview',
          stepType: 'assert',
          title: '校验恢复后预览',
          target: sample.targetUrl,
          instruction: '重新点击“预览”，在“搜索文档块”输入正文锚点并校验预览区可见。',
          expectedResult: '恢复后的文档块预览区展示“真实 document-like archive restore 采集锚点”。',
          extractVariable: '',
        },
      ],
    },
    successCriteria: [
      '目标文档归档后显示“已归档”状态。',
      '目标文档恢复后重新显示“归档”按钮。',
      '恢复后重新预览时，文档块预览区展示“真实 document-like archive restore 采集锚点”。',
    ],
    visualAnchors: [
      '需求编排',
      '需求编排工作台',
      '知识文档',
      '知识目录',
      '预览',
      '归档',
      '已归档',
      '恢复',
      '当前预览',
      '搜索文档块',
    ],
    notes: [
      '该 ScenarioCard 面向当前平台真实项目知识文档 UI，不访问外部 UAT 业务系统。',
      '该样本用于 traffic-quality source=real_click 的 doc_archive_restore_verify 候选采集。',
    ],
  };
}

function buildProjectKnowledgeDocumentDeriveCapabilityPreviewScenarioCard(
  sample: IntentE2EDocumentRealClickSeedSample
): ScenarioCard {
  return {
    version: 1,
    title: sample.name,
    taskMode: 'scenario',
    targetUrl: sample.targetUrl,
    featureDescription:
      '打开当前平台项目页的需求编排工作台，进入知识文档视图，打开已有知识文档预览后自动沉淀能力，并在能力目录校验知识提炼能力可见。',
    flowDefinition: {
      version: 1,
      entryUrl: sample.targetUrl,
      sharedVariables: ['knowledgeDocumentName', 'knowledgeDocumentAnchor', 'derivedCapabilityName'],
      expectedOutcome: '目标知识文档已通过 UI 自动沉淀为稳定能力，能力目录中展示本次文档提炼出的知识提炼能力。',
      cleanupNotes: '文档名称和检索字段带时间戳；fixture setup 会用 API 准备唯一知识文档，能力 slug 由唯一文档块生成。',
      steps: [
        {
          stepUid: 'open_project_intent_workbench',
          stepType: 'ui',
          title: '打开需求编排工作台',
          target: sample.targetUrl,
          instruction: '进入项目页后点击“需求编排”，等待“需求编排工作台”弹层出现。',
          expectedResult: '需求编排工作台弹层可见。',
          extractVariable: '',
        },
        {
          stepUid: 'open_knowledge_document_view',
          stepType: 'ui',
          title: '进入知识文档视图',
          target: sample.targetUrl,
          instruction: '在工作台内点击“知识文档”标签，等待知识目录和导入面板出现。',
          expectedResult: '知识目录可见。',
          extractVariable: '',
        },
        {
          stepUid: 'preview_existing_knowledge_document',
          stepType: 'ui',
          title: '预览已有知识文档',
          target: sample.targetUrl,
          instruction: '在知识目录中打开目标文档预览，并确认正文锚点可见。',
          expectedResult: '当前预览切换到目标文档，文档块展示正文锚点。',
          extractVariable: 'knowledgeDocumentName',
        },
        {
          stepUid: 'derive_capability_from_document',
          stepType: 'ui',
          title: '自动沉淀能力',
          target: sample.targetUrl,
          instruction: '点击文档块预览区的“自动沉淀能力”，等待“已沉淀 N 条能力”提示。',
          expectedResult: '页面切换到能力目录，并出现新沉淀的稳定能力。',
          extractVariable: 'derivedCapabilityName',
        },
        {
          stepUid: 'verify_derived_capability_catalog',
          stepType: 'assert',
          title: '校验能力目录',
          target: sample.targetUrl,
          instruction: '在能力目录中搜索本次唯一能力名称，并校验能力为“知识提炼”。',
          expectedResult: '能力目录展示“商机列表按采集手机号<timestamp>检索”和“知识提炼”。',
          extractVariable: '',
        },
      ],
    },
    successCriteria: [
      '“当前预览”指向目标文档名称。',
      '自动沉淀后出现“已沉淀 N 条能力”成功信号。',
      '能力目录展示本次唯一的“商机列表按采集手机号<timestamp>检索”能力。',
      '该能力标记为“知识提炼”。',
    ],
    visualAnchors: [
      '需求编排',
      '需求编排工作台',
      '知识文档',
      '知识目录',
      '预览',
      '当前预览',
      '文档块预览',
      '自动沉淀能力',
      '能力目录',
      '搜索稳定能力',
      '知识提炼',
    ],
    notes: [
      '该 ScenarioCard 面向当前平台真实项目知识文档 UI，不访问外部 UAT 业务系统。',
      '该样本用于 traffic-quality source=real_click 的 doc_derive_capability_verify 候选采集。',
    ],
  };
}

function buildPrefilledDocumentSurfacePayload(sample: IntentE2EDocumentRealClickSeedSample): Record<string, unknown> {
  if (sample.sampleId === 'project-knowledge-document-derive-capability-preview') {
    return {
      prefilledScenarioCard: buildProjectKnowledgeDocumentDeriveCapabilityPreviewScenarioCard(sample),
      prefilledScenarioLlmMeta: {
        provider: 'deterministic',
        model: 'project-knowledge-document-real-click-seed',
        visionEnabled: false,
        attachmentCount: 0,
      },
      prefilledPlanCode: buildProjectKnowledgeDocumentDeriveCapabilityPreviewPlanCode(sample.targetUrl),
    };
  }
  if (sample.sampleId === 'project-knowledge-document-archive-restore-preview') {
    return {
      prefilledScenarioCard: buildProjectKnowledgeDocumentArchiveRestorePreviewScenarioCard(sample),
      prefilledScenarioLlmMeta: {
        provider: 'deterministic',
        model: 'project-knowledge-document-real-click-seed',
        visionEnabled: false,
        attachmentCount: 0,
      },
      prefilledPlanCode: buildProjectKnowledgeDocumentArchiveRestorePreviewPlanCode(sample.targetUrl),
    };
  }
  if (sample.sampleId === 'project-knowledge-document-edit-save-preview') {
    return {
      prefilledScenarioCard: buildProjectKnowledgeDocumentEditSavePreviewScenarioCard(sample),
      prefilledScenarioLlmMeta: {
        provider: 'deterministic',
        model: 'project-knowledge-document-real-click-seed',
        visionEnabled: false,
        attachmentCount: 0,
      },
      prefilledPlanCode: buildProjectKnowledgeDocumentEditSavePreviewPlanCode(sample.targetUrl),
    };
  }
  if (sample.sampleId === 'project-knowledge-document-search-open-preview') {
    return {
      prefilledScenarioCard: buildProjectKnowledgeDocumentSearchOpenPreviewScenarioCard(sample),
      prefilledScenarioLlmMeta: {
        provider: 'deterministic',
        model: 'project-knowledge-document-real-click-seed',
        visionEnabled: false,
        attachmentCount: 0,
      },
      prefilledPlanCode: buildProjectKnowledgeDocumentSearchOpenPreviewPlanCode(sample.targetUrl),
    };
  }
  if (sample.sampleId !== 'project-knowledge-document-import-preview') return {};
  return {
    prefilledScenarioCard: buildProjectKnowledgeDocumentImportPreviewScenarioCard(sample),
    prefilledScenarioLlmMeta: {
      provider: 'deterministic',
      model: 'project-knowledge-document-real-click-seed',
      visionEnabled: false,
      attachmentCount: 0,
    },
    prefilledPlanCode: buildProjectKnowledgeDocumentImportPreviewPlanCode(sample.targetUrl),
  };
}

export function buildIntentE2EDocumentRealClickSeedSamples(input?: {
  maxSamples?: number;
  projectUid?: string;
  baseUrl?: string;
  repeat?: number;
  sampleIds?: string[];
}): IntentE2EDocumentRealClickSeedSample[] {
  const maxSamples =
    typeof input?.maxSamples === 'number' && Number.isFinite(input.maxSamples) && input.maxSamples > 0
      ? Math.floor(input.maxSamples)
      : DEFAULT_DOCUMENT_REAL_CLICK_SEED_BLUEPRINTS.length;
  const repeat =
    typeof input?.repeat === 'number' && Number.isFinite(input.repeat) && input.repeat > 0
      ? Math.floor(input.repeat)
      : 1;
  const sampleIdSet = new Set((input?.sampleIds || []).map((item) => item.trim()).filter(Boolean));
  const candidateSamples =
    sampleIdSet.size > 0
      ? DEFAULT_DOCUMENT_REAL_CLICK_SEED_BLUEPRINTS.filter((sample) => sampleIdSet.has(sample.sampleId))
      : DEFAULT_DOCUMENT_REAL_CLICK_SEED_BLUEPRINTS;
  const selectedSamples = candidateSamples.slice(0, maxSamples);
  return Array.from({ length: repeat }).flatMap(() =>
    selectedSamples.map((sample) =>
      cloneSample(sample, {
        projectUid: input?.projectUid,
        baseUrl: input?.baseUrl,
      })
    )
  );
}

export function buildIntentE2EDocumentRealClickRunRequest(input: {
  projectUid: string;
  sample: IntentE2EDocumentRealClickSeedSample;
  timeoutMs: number;
}): Record<string, unknown> {
  const prefilledPayload = buildPrefilledDocumentSurfacePayload(input.sample);
  return {
    projectUid: input.projectUid,
    moduleUid: input.sample.moduleUid,
    input: input.sample.input,
    targetUrl: input.sample.targetUrl,
    ...prefilledPayload,
    runControl: {
      priority: 'normal',
      timeoutMs: input.timeoutMs,
      retryLimit: 0,
    },
  };
}

function isTerminalStatus(status: string): boolean {
  return status === 'passed' || status === 'failed' || status === 'canceled';
}

export function buildIntentE2EDocumentRealClickSeedReport(input: {
  generatedAt: string;
  projectUid: string;
  dryRun: boolean;
  results: IntentE2EDocumentRealClickSeedResult[];
}): IntentE2EDocumentRealClickSeedReport {
  const results = input.results.map((result) => ({
    ...result,
    notes: [...result.notes],
    matchedRuleIds: [...result.matchedRuleIds],
    matchedRecipeSlugs: [...result.matchedRecipeSlugs],
  }));
  return {
    version: 1,
    generatedAt: input.generatedAt,
    projectUid: input.projectUid,
    sourcePolicy: 'launch_decision_runs_without_intent_draft_uid',
    denominatorPolicy:
      '脚本只通过 launch-decision -> /api/intent-e2e/runs 发起请求，且不携带 intentDraftUid；因此启动成功的运行会按 traffic-quality source=real_click 计数。但只有 documentFamily 非空的样本才能作为 document family 治理候选。',
    dryRun: input.dryRun,
    summary: {
      sampleCount: results.length,
      admissibleDocumentSamples: results.filter((item) => item.admissibility === 'document_family_admissible').length,
      referenceOnlyBusinessFlowSamples: results.filter(
        (item) => item.admissibility === 'document_reference_only_business_flow'
      ).length,
      autoRunStarted: results.filter((item) => item.runId).length,
      terminalRuns: results.filter((item) => isTerminalStatus(item.status)).length,
      passedRuns: results.filter((item) => item.status === 'passed').length,
      failedRuns: results.filter((item) => item.status === 'failed').length,
      blockedRuns: results.filter((item) => item.status === 'blocked').length,
      timedOutRuns: results.filter((item) => item.timedOut).length,
    },
    results,
  };
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderIntentE2EDocumentRealClickSeedMarkdown(report: IntentE2EDocumentRealClickSeedReport): string {
  const lines = [
    '# Intent E2E Document Real Click Seed Report',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- projectUid: ${report.projectUid}`,
    `- sourcePolicy: ${report.sourcePolicy}`,
    `- denominatorPolicy: ${report.denominatorPolicy}`,
    `- dryRun: ${report.dryRun ? 'yes' : 'no'}`,
    `- sampleCount: ${report.summary.sampleCount}`,
    `- admissibleDocumentSamples: ${report.summary.admissibleDocumentSamples}`,
    `- referenceOnlyBusinessFlowSamples: ${report.summary.referenceOnlyBusinessFlowSamples}`,
    `- autoRunStarted: ${report.summary.autoRunStarted}`,
    `- terminalRuns: ${report.summary.terminalRuns}`,
    `- passedRuns: ${report.summary.passedRuns}`,
    `- failedRuns: ${report.summary.failedRuns}`,
    `- blockedRuns: ${report.summary.blockedRuns}`,
    `- timedOutRuns: ${report.summary.timedOutRuns}`,
    '',
    'sampleId | provenance | priorityFamily | documentFamily | admissibility | launchDecision | runId | status | error',
    '--- | --- | --- | --- | --- | --- | --- | --- | ---',
    ...report.results.map((item) =>
      [
        item.sampleId,
        item.provenance,
        item.expectedPriorityScenarioFamily,
        item.documentFamily || '-',
        item.admissibility,
        item.launchDecision || '-',
        item.runId || '-',
        item.status || '-',
        escapeMarkdownCell(item.errorMessage || '-'),
      ].join(' | ')
    ),
  ];

  return `${lines.join('\n')}\n`;
}
