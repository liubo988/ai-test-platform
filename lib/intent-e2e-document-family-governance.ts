import path from 'node:path';
import type { IntentE2ETrafficQualityDocumentFamily } from '@/lib/intent-e2e-traffic-quality';

export const INTENT_E2E_DOCUMENT_FAMILY_GOVERNANCE_REPORT_JSON_FILE =
  'intent-e2e.document-family-governance.latest.json';
export const INTENT_E2E_DOCUMENT_FAMILY_GOVERNANCE_REPORT_MD_FILE =
  'intent-e2e.document-family-governance.latest.md';

export type IntentE2EDocumentFamilyGovernanceStatus = 'contract_ready' | 'missing';
export type IntentE2EDocumentFamilyGovernanceSourcePolicy = 'post_instrumentation_real_click_only';

export interface IntentE2EDocumentFamilyFixtureContract {
  fixtureId: string;
  idempotencyPolicy: string;
  cleanupPolicy: string;
  requiredFields: string[];
}

export interface IntentE2EDocumentFamilyVerifierContract {
  requiredEvidence: string[];
  forbiddenEvidence: string[];
  policyNotes: string[];
}

export interface IntentE2EDocumentFamilySampleContract {
  source: 'real_click';
  attachment: 'with_image' | 'without_image' | 'any';
  targetUrlIncludes: string[];
  requiredInputSignals: string[];
}

export interface IntentE2EDocumentFamilyGovernanceProfile {
  version: 1;
  family: IntentE2ETrafficQualityDocumentFamily;
  status: IntentE2EDocumentFamilyGovernanceStatus;
  title: string;
  description: string;
  recipeSlugs: string[];
  fixtureContract: IntentE2EDocumentFamilyFixtureContract;
  verifierContract: IntentE2EDocumentFamilyVerifierContract;
  sampleContract: IntentE2EDocumentFamilySampleContract;
}

export interface IntentE2EDocumentFamilyGovernanceReport {
  version: 1;
  generatedAt: string;
  projectUid: string;
  sourcePolicy: IntentE2EDocumentFamilyGovernanceSourcePolicy;
  candidateFamilies: IntentE2ETrafficQualityDocumentFamily[];
  governedFamilies: IntentE2ETrafficQualityDocumentFamily[];
  missingFamilies: IntentE2ETrafficQualityDocumentFamily[];
  profiles: IntentE2EDocumentFamilyGovernanceProfile[];
  stopConditions: string[];
}

const DOCUMENT_FAMILY_GOVERNANCE_PROFILES: IntentE2EDocumentFamilyGovernanceProfile[] = [
  {
    version: 1,
    family: 'doc_create_reopen_verify',
    status: 'contract_ready',
    title: '项目知识文档导入后预览校验',
    description:
      '当前第一刀只覆盖当前平台项目知识文档 UI 的“导入知识文档 -> 当前预览 -> 文档块正文锚点”链路。',
    recipeSlugs: ['document.project-knowledge-import-preview'],
    fixtureContract: {
      fixtureId: 'project-knowledge-document-import-preview-v1',
      idempotencyPolicy: '每次运行使用带时间戳的知识文档名称，避免历史文档或缓存预览造成假阳性。',
      cleanupPolicy: '文档名称唯一且样本量小，第一刀不做删除清理；后续 guard 扩样时再补批量清理。',
      requiredFields: [
        'knowledgeDocumentName: 真实文档采集手册 <timestamp>',
        'knowledgeSourcePath: reports/intent-e2e/document-real-click-seed.md',
        'knowledgeDocumentContent: 必须包含真实 document-like real_click 采集锚点',
      ],
    },
    verifierContract: {
      requiredEvidence: [
        'knowledge_import_notice: 出现本次唯一文档名称的导入成功信号',
        'current_preview_document_name: 当前预览切到本次唯一文档名称',
        'document_chunk_body_anchor: 文档块预览区渲染正文锚点',
      ],
      forbiddenEvidence: [
        '只断言输入框或 textarea 中的原始正文内容',
        '只看 toast 或模糊成功文案，不校验当前预览和文档块',
        '把 reference-only 的“参考知识文档执行业务流”当成 document family 证据',
      ],
      policyNotes: [
        '候选必须来自 traffic-quality source=real_click，不混用 benchmark_rerun / replay / draft_import。',
        '第一刀不进入 OCR-first，不升级 OCR route/verifier。',
        'recipe / fixture / verifier 只绑定当前平台项目知识文档 UI。',
      ],
    },
    sampleContract: {
      source: 'real_click',
      attachment: 'without_image',
      targetUrlIncludes: ['/projects/', 'intentView=knowledge'],
      requiredInputSignals: ['知识文档', '导入', '预览', '文档块', '校验'],
    },
  },
  {
    version: 1,
    family: 'doc_edit_save_verify',
    status: 'contract_ready',
    title: '项目知识文档编辑保存预览校验',
    description:
      '当前第一刀只覆盖当前平台项目知识文档 UI 的“已有知识文档同名编辑保存 -> 当前预览 -> 更新正文锚点”链路。',
    recipeSlugs: ['document.project-knowledge-edit-save-preview'],
    fixtureContract: {
      fixtureId: 'project-knowledge-document-edit-save-preview-v1',
      idempotencyPolicy: '每次运行使用带时间戳的知识文档名称，并通过 fixture setup 准备原始文档，避免依赖历史目录状态。',
      cleanupPolicy: '文档名称唯一且样本量小，第一刀不做删除清理；后续 guard 扩样时再补批量清理。',
      requiredFields: [
        'knowledgeDocumentName: 编辑保存验证手册 <timestamp>',
        'originalKnowledgeDocumentContent: 必须包含真实 document-like edit save 原始锚点',
        'updatedKnowledgeDocumentContent: 必须包含真实 document-like edit save 更新锚点',
      ],
    },
    verifierContract: {
      requiredEvidence: [
        'current_preview_document_name: 当前预览切到目标文档名称',
        'original_document_chunk_body_anchor: 保存前文档块预览区渲染原始正文锚点',
        'old_anchor_no_match_after_save: 保存后旧正文锚点不再匹配',
        'updated_document_chunk_body_anchor: 保存后文档块预览区渲染更新正文锚点',
      ],
      forbiddenEvidence: [
        '只断言输入框或 textarea 中的更新内容',
        '只看 toast 或模糊成功文案，不校验当前预览和文档块替换结果',
        '只断言 fixture setup / API 写入成功，不经过 UI 编辑保存',
        '把 reference-only 的“参考知识文档执行业务流”当成 document family 证据',
      ],
      policyNotes: [
        '候选必须来自 traffic-quality source=real_click，不混用 benchmark_rerun / replay / draft_import。',
        '第一刀不进入 OCR-first，不升级 OCR route/verifier。',
        'recipe / fixture / verifier 只绑定当前平台项目知识文档 UI。',
      ],
    },
    sampleContract: {
      source: 'real_click',
      attachment: 'without_image',
      targetUrlIncludes: ['/projects/', 'intentView=knowledge'],
      requiredInputSignals: ['知识文档', '编辑', '保存', '当前预览', '文档块', '校验'],
    },
  },
  {
    version: 1,
    family: 'doc_archive_restore_verify',
    status: 'contract_ready',
    title: '项目知识文档归档恢复预览校验',
    description:
      '当前第一刀只覆盖当前平台项目知识文档 UI 的“已有知识文档归档 -> 恢复 -> 重新预览 -> 正文锚点”链路。',
    recipeSlugs: ['document.project-knowledge-archive-restore-preview'],
    fixtureContract: {
      fixtureId: 'project-knowledge-document-archive-restore-preview-v1',
      idempotencyPolicy: '每次运行使用带时间戳的知识文档名称，并通过 fixture setup 准备目标文档，避免依赖历史目录状态。',
      cleanupPolicy: '运行结束后通过 UI 恢复目标文档到 active 状态；文档名称唯一且样本量小，第一刀不做删除清理。',
      requiredFields: [
        'knowledgeDocumentName: 归档恢复验证手册 <timestamp>',
        'knowledgeSourcePath: reports/intent-e2e/document-archive-restore-seed.md',
        'knowledgeDocumentContent: 必须包含真实 document-like archive restore 采集锚点',
      ],
    },
    verifierContract: {
      requiredEvidence: [
        'initial_document_chunk_body_anchor: 归档前文档块预览区渲染正文锚点',
        'archive_notice: 出现本次唯一文档名称的归档成功信号',
        'archived_status_badge: 目标文档卡片出现已归档状态',
        'restore_notice: 出现本次唯一文档名称的恢复成功信号',
        'restored_document_chunk_body_anchor: 恢复后重新预览并渲染正文锚点',
      ],
      forbiddenEvidence: [
        '只断言 fixture setup / API 写入成功，不经过 UI 归档恢复',
        '只看归档或恢复 toast，不校验目标文档状态和恢复后文档块',
        '只断言知识目录中存在文档名称，不重新打开预览',
        '把 reference-only 的“参考知识文档执行业务流”当成 document family 证据',
      ],
      policyNotes: [
        '候选必须来自 traffic-quality source=real_click，不混用 benchmark_rerun / replay / draft_import。',
        '第一刀不进入 OCR-first，不升级 OCR route/verifier。',
        'recipe / fixture / verifier 只绑定当前平台项目知识文档 UI。',
      ],
    },
    sampleContract: {
      source: 'real_click',
      attachment: 'without_image',
      targetUrlIncludes: ['/projects/', 'intentView=knowledge'],
      requiredInputSignals: ['知识文档', '归档', '恢复', '重新预览', '文档块', '校验'],
    },
  },
  {
    version: 1,
    family: 'doc_derive_capability_verify',
    status: 'contract_ready',
    title: '项目知识文档自动沉淀能力目录校验',
    description:
      '当前第一刀只覆盖当前平台项目知识文档 UI 的“已有知识文档预览 -> 自动沉淀能力 -> 能力目录知识提炼验收”链路。',
    recipeSlugs: ['document.project-knowledge-derive-capability-preview'],
    fixtureContract: {
      fixtureId: 'project-knowledge-document-derive-capability-preview-v1',
      idempotencyPolicy: '每次运行使用带时间戳的知识文档名称和检索字段，避免复用历史能力造成假阳性。',
      cleanupPolicy: '文档名称与能力 slug 均来自唯一时间戳，第一刀不做删除清理；后续 guard 扩样时再补批量清理。',
      requiredFields: [
        'knowledgeDocumentName: 沉淀能力验证手册 <timestamp>',
        'knowledgeSourcePath: reports/intent-e2e/document-derive-capability-seed.md',
        'knowledgeDocumentContent: 必须包含真实 document-like derive capability 采集锚点',
        'derivedCapabilityName: 商机列表按采集手机号<timestamp>检索',
      ],
    },
    verifierContract: {
      requiredEvidence: [
        'current_preview_document_name: 当前预览切到目标文档名称',
        'document_chunk_body_anchor: 自动沉淀前文档块预览区渲染正文锚点',
        'derive_capability_notice: 出现“已沉淀 N 条能力”成功信号',
        'derived_capability_catalog_item: 能力目录展示本次唯一稳定能力名称',
        'derived_capability_verification_status: 新能力标记为“知识提炼”',
      ],
      forbiddenEvidence: [
        '只断言 fixture setup / API 写入成功，不经过 UI 自动沉淀',
        '只看“自动沉淀已完成”或模糊 toast，不校验能力目录中的具体能力名称',
        '复用历史“进入商机列表页”这类非唯一能力名称作为最终证据',
        '把 reference-only 的“参考知识文档执行业务流”当成 document family 证据',
      ],
      policyNotes: [
        '候选必须来自 traffic-quality source=real_click，不混用 benchmark_rerun / replay / draft_import。',
        '第一刀不进入 OCR-first，不升级 OCR route/verifier。',
        'recipe / fixture / verifier 只绑定当前平台项目知识文档 UI。',
      ],
    },
    sampleContract: {
      source: 'real_click',
      attachment: 'without_image',
      targetUrlIncludes: ['/projects/', 'intentView=knowledge'],
      requiredInputSignals: ['知识文档', '自动沉淀能力', '能力目录', '稳定能力', '知识提炼'],
    },
  },
  {
    version: 1,
    family: 'doc_search_open_verify',
    status: 'contract_ready',
    title: '项目知识文档搜索打开预览校验',
    description:
      '当前第一刀只覆盖当前平台项目知识文档 UI 的“知识目录打开文档 -> 当前预览 -> 搜索文档块正文锚点”链路。',
    recipeSlugs: ['document.project-knowledge-search-open-preview'],
    fixtureContract: {
      fixtureId: 'project-knowledge-document-search-open-preview-v1',
      idempotencyPolicy: '每次运行使用带时间戳的知识文档名称，并通过 fixture setup 准备目标文档，避免依赖历史目录状态。',
      cleanupPolicy: '文档名称唯一且样本量小，第一刀不做删除清理；后续 guard 扩样时再补批量清理。',
      requiredFields: [
        'knowledgeDocumentName: 搜索打开验证手册 <timestamp>',
        'knowledgeSourcePath: reports/intent-e2e/document-search-open-seed.md',
        'knowledgeDocumentContent: 必须包含真实 document-like search open 采集锚点',
      ],
    },
    verifierContract: {
      requiredEvidence: [
        'current_preview_document_name: 当前预览切到目标文档名称',
        'document_chunk_search_input: 搜索文档块输入本次唯一正文锚点',
        'document_chunk_body_anchor: 文档块预览区渲染正文锚点',
      ],
      forbiddenEvidence: [
        '只断言知识目录中存在文档名称',
        '只断言 fixture setup / API 写入成功，不经过 UI 预览',
        '把 reference-only 的“参考知识文档执行业务流”当成 document family 证据',
      ],
      policyNotes: [
        '候选必须来自 traffic-quality source=real_click，不混用 benchmark_rerun / replay / draft_import。',
        '第一刀不进入 OCR-first，不升级 OCR route/verifier。',
        'recipe / fixture / verifier 只绑定当前平台项目知识文档 UI。',
      ],
    },
    sampleContract: {
      source: 'real_click',
      attachment: 'without_image',
      targetUrlIncludes: ['/projects/', 'intentView=knowledge'],
      requiredInputSignals: ['知识文档', '打开', '搜索', '预览', '文档块', '校验'],
    },
  },
];

function cloneProfile(
  profile: IntentE2EDocumentFamilyGovernanceProfile
): IntentE2EDocumentFamilyGovernanceProfile {
  return {
    ...profile,
    recipeSlugs: [...profile.recipeSlugs],
    fixtureContract: {
      ...profile.fixtureContract,
      requiredFields: [...profile.fixtureContract.requiredFields],
    },
    verifierContract: {
      ...profile.verifierContract,
      requiredEvidence: [...profile.verifierContract.requiredEvidence],
      forbiddenEvidence: [...profile.verifierContract.forbiddenEvidence],
      policyNotes: [...profile.verifierContract.policyNotes],
    },
    sampleContract: {
      ...profile.sampleContract,
      targetUrlIncludes: [...profile.sampleContract.targetUrlIncludes],
      requiredInputSignals: [...profile.sampleContract.requiredInputSignals],
    },
  };
}

function uniqueDocumentFamilies(
  families: readonly (IntentE2ETrafficQualityDocumentFamily | '' | null | undefined)[]
): IntentE2ETrafficQualityDocumentFamily[] {
  const seen = new Set<IntentE2ETrafficQualityDocumentFamily>();
  const result: IntentE2ETrafficQualityDocumentFamily[] = [];

  for (const family of families) {
    if (!family || seen.has(family)) continue;
    seen.add(family);
    result.push(family);
  }

  return result;
}

export function getIntentE2EDocumentFamilyGovernancePath(projectUid: string, kind: 'json' | 'md'): string {
  const fileName =
    kind === 'json'
      ? INTENT_E2E_DOCUMENT_FAMILY_GOVERNANCE_REPORT_JSON_FILE
      : INTENT_E2E_DOCUMENT_FAMILY_GOVERNANCE_REPORT_MD_FILE;
  return path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', projectUid, fileName);
}

export function listIntentE2EDocumentFamilyGovernanceProfiles(): IntentE2EDocumentFamilyGovernanceProfile[] {
  return DOCUMENT_FAMILY_GOVERNANCE_PROFILES.map(cloneProfile);
}

export function getIntentE2EDocumentFamilyGovernanceProfile(
  family: IntentE2ETrafficQualityDocumentFamily
): IntentE2EDocumentFamilyGovernanceProfile | null {
  const profile = DOCUMENT_FAMILY_GOVERNANCE_PROFILES.find((item) => item.family === family);
  return profile ? cloneProfile(profile) : null;
}

export function resolveIntentE2EDocumentFamilyGovernanceStatus(
  family: IntentE2ETrafficQualityDocumentFamily
): IntentE2EDocumentFamilyGovernanceStatus {
  return getIntentE2EDocumentFamilyGovernanceProfile(family)?.status || 'missing';
}

export function buildIntentE2EDocumentFamilyGovernanceReport(input: {
  projectUid: string;
  candidateFamilies: readonly IntentE2ETrafficQualityDocumentFamily[];
  generatedAt?: string;
}): IntentE2EDocumentFamilyGovernanceReport {
  const candidateFamilies = uniqueDocumentFamilies(input.candidateFamilies);
  const profiles = candidateFamilies
    .map((family) => getIntentE2EDocumentFamilyGovernanceProfile(family))
    .filter((profile): profile is IntentE2EDocumentFamilyGovernanceProfile => Boolean(profile));
  const governedFamilies = profiles.map((profile) => profile.family);
  const governedSet = new Set(governedFamilies);
  const missingFamilies = candidateFamilies.filter((family) => !governedSet.has(family));

  return {
    version: 1,
    generatedAt: input.generatedAt || new Date().toISOString(),
    projectUid: input.projectUid,
    sourcePolicy: 'post_instrumentation_real_click_only',
    candidateFamilies,
    governedFamilies,
    missingFamilies,
    profiles,
    stopConditions: [
      'candidate family evidence is not based on traffic-quality source=real_click.',
      'implementation starts mixing benchmark_rerun / replay / draft_import into real-click denominators.',
      'scope expands into OCR-first, external document systems, or unrelated verifier work.',
    ],
  };
}

export function renderIntentE2EDocumentFamilyGovernanceMarkdown(
  report: IntentE2EDocumentFamilyGovernanceReport
): string {
  const lines: string[] = [
    '# Intent E2E Document Family Governance',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- projectUid: ${report.projectUid}`,
    `- sourcePolicy: ${report.sourcePolicy}`,
    `- candidateFamilies: ${report.candidateFamilies.join(', ') || '-'}`,
    `- governedFamilies: ${report.governedFamilies.join(', ') || '-'}`,
    `- missingFamilies: ${report.missingFamilies.join(', ') || '-'}`,
    '',
    '## Profiles',
  ];

  if (report.profiles.length === 0) {
    lines.push('', '- -');
  }

  for (const profile of report.profiles) {
    lines.push(
      '',
      `### ${profile.family}`,
      '',
      `- status: ${profile.status}`,
      `- title: ${profile.title}`,
      `- recipes: ${profile.recipeSlugs.join(', ')}`,
      `- fixture: ${profile.fixtureContract.fixtureId}`,
      `- idempotency: ${profile.fixtureContract.idempotencyPolicy}`,
      `- cleanup: ${profile.fixtureContract.cleanupPolicy}`,
      `- sampleSource: ${profile.sampleContract.source}`,
      `- targetUrlIncludes: ${profile.sampleContract.targetUrlIncludes.join(', ')}`,
      '',
      'Required Evidence:',
      ...profile.verifierContract.requiredEvidence.map((item) => `- ${item}`),
      '',
      'Forbidden Evidence:',
      ...profile.verifierContract.forbiddenEvidence.map((item) => `- ${item}`),
      '',
      'Policy Notes:',
      ...profile.verifierContract.policyNotes.map((item) => `- ${item}`)
    );
  }

  lines.push('', '## Stop Conditions', ...report.stopConditions.map((item) => `- ${item}`), '');

  return lines.join('\n');
}
