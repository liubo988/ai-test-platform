'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { describeCapabilityVerification, getCapabilityLastVerificationAttempt } from '@/lib/capability-verification';
import { getIntentCapabilityFlowDefinition, type IntentCapabilityPreset } from '@/lib/intent-capability-preset';
import { applyCapabilitySelectionToRecipe, type RecipeDraft } from '@/lib/project-knowledge';
import { buildTaskDraftFromRecipe, type IntentTaskDraft } from '@/lib/recipe-task-draft';

export type { IntentTaskDraft } from '@/lib/recipe-task-draft';

type KnowledgeSourceType = 'manual' | 'notes' | 'execution' | 'system';
type CapabilityType = 'auth' | 'navigation' | 'action' | 'assertion' | 'query' | 'composite';

type KnowledgeDocumentItem = {
  documentUid: string;
  name: string;
  sourceType: KnowledgeSourceType;
  sourcePath: string;
  status: 'active' | 'archived';
  chunkCount: number;
};

type KnowledgeChunkItem = {
  chunkUid: string;
  documentUid: string;
  heading: string;
  content: string;
  keywords: string[];
  sourceLineStart: number;
  sourceLineEnd: number;
  tokenEstimate: number;
  sortOrder: number;
};

type CapabilityItem = {
  capabilityUid: string;
  slug: string;
  name: string;
  description: string;
  capabilityType: CapabilityType;
  entryUrl: string;
  triggerPhrases: string[];
  preconditions: string[];
  steps: string[];
  assertions: string[];
  cleanupNotes: string;
  dependsOn: string[];
  sortOrder: number;
  status: 'active' | 'archived';
  sourceDocumentUid: string;
  meta: unknown;
};

type ModuleOption = {
  moduleUid: string;
  name: string;
};

type DraftRecipeResponse = {
  recipe: RecipeDraft;
  capabilityCount: number;
  knowledgeChunkCount: number;
};

type DeriveCapabilityResponse = {
  items: CapabilityItem[];
  skipped: Array<{ chunkUid: string; reason: string; capabilityName: string }>;
  summary: {
    requestedChunks: number;
    derivedCount: number;
    skippedCount: number;
    executionVerifiedCount: number;
    knowledgeInferredCount: number;
  };
};

type CapabilityVerificationLaunchResponse = {
  configUid: string;
  planUid: string;
  planVersion: number;
  executionUid: string;
  runPath: string;
};

type WorkbenchView = 'recipe' | 'knowledge' | 'capability';

type KnowledgeFormState = {
  name: string;
  sourceType: KnowledgeSourceType;
  sourcePath: string;
  content: string;
};

type CapabilityFormState = {
  slug: string;
  name: string;
  description: string;
  capabilityType: CapabilityType;
  entryUrl: string;
  triggerPhrases: string;
  preconditions: string;
  steps: string;
  assertions: string;
  cleanupNotes: string;
  dependsOn: string;
  sortOrder: number;
  sourceDocumentUid: string;
  meta: unknown;
};

type CapabilityEditorSection = 'basic' | 'matching' | 'execution' | 'cleanup';

type CapabilityEditorSectionState = Record<CapabilityEditorSection, boolean>;

type ProjectIntentWorkbenchProps = {
  projectUid: string;
  activeModules: ModuleOption[];
  defaultTaskModuleUid: string;
  canEditContent: boolean;
  creationBlockedReason: string;
  onApplyTaskDraft: (draft: IntentTaskDraft) => void;
  launchPreset?: {
    token: string;
    view: WorkbenchView;
    capabilityPreset: IntentCapabilityPreset;
  } | null;
  onLaunchPresetConsumed?: (token: string) => void;
};

function capabilityTypeLabel(value: CapabilityType): string {
  switch (value) {
    case 'auth':
      return '登录';
    case 'navigation':
      return '导航';
    case 'action':
      return '动作';
    case 'assertion':
      return '断言';
    case 'query':
      return '查询';
    case 'composite':
      return '复合';
    default:
      return value;
  }
}

function capabilityTypeTone(value: CapabilityType): string {
  switch (value) {
    case 'auth':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'navigation':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'action':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'query':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'assertion':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'composite':
      return 'bg-violet-50 text-violet-700 ring-violet-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function capabilityVerificationTone(meta: unknown): string {
  const verification = describeCapabilityVerification(meta);
  switch (verification.status) {
    case 'execution_verified':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'knowledge_inferred':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-500 ring-slate-200';
  }
}

function sourceTypeLabel(value: KnowledgeSourceType): string {
  switch (value) {
    case 'notes':
      return '笔记';
    case 'execution':
      return '执行沉淀';
    case 'system':
      return '系统';
    case 'manual':
    default:
      return '手册';
  }
}

function sourceTypeVerificationHint(value: KnowledgeSourceType): string {
  switch (value) {
    case 'execution':
      return '执行沉淀文档自动沉淀后会标记为执行验证，并在 recipe 同分时优先命中。';
    case 'system':
      return '系统知识默认作为结构化上下文使用；若来自真实执行结论，可在导入后沉淀为执行验证能力。';
    case 'notes':
      return '笔记文档自动沉淀后默认标记为知识提炼，适合补充命中词和页面结构。';
    case 'manual':
    default:
      return '手册文档自动沉淀后默认标记为知识提炼，后续结合执行沉淀可升级命中优先级。';
  }
}

function workbenchViewLabel(value: WorkbenchView): string {
  switch (value) {
    case 'knowledge':
      return '知识文档';
    case 'capability':
      return '稳定能力';
    case 'recipe':
    default:
      return '需求编排';
  }
}

function workbenchViewDescription(value: WorkbenchView): string {
  switch (value) {
    case 'knowledge':
      return '导入手册、浏览目录并预览切块结果。';
    case 'capability':
      return '搜索、筛选、验证并编辑稳定能力。';
    case 'recipe':
    default:
      return '输入需求、检查覆盖并回填任务草稿。';
  }
}

function excerpt(text: string, maxLength = 150): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function parseMultilineValues(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function formatMultilineValues(values: string[]): string {
  return values.map((item) => item.trim()).filter(Boolean).join('\n');
}

function toSafeSortOrder(input: string | number): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 100;
}

function matchesCapabilitySearch(item: CapabilityItem, query: string, sourceDocumentName = ''): boolean {
  if (!query) return true;

  const haystack = [
    item.slug,
    item.name,
    item.description,
    capabilityTypeLabel(item.capabilityType),
    item.entryUrl,
    item.cleanupNotes,
    sourceDocumentName,
    ...item.triggerPhrases,
    ...item.preconditions,
    ...item.steps,
    ...item.assertions,
    ...item.dependsOn,
  ]
    .join('\n')
    .toLowerCase();

  return haystack.includes(query);
}

function createDefaultKnowledgeForm(): KnowledgeFormState {
  return {
    name: '',
    sourceType: 'manual',
    sourcePath: '',
    content: '',
  };
}

function createDefaultCapabilityForm(): CapabilityFormState {
  return {
    slug: '',
    name: '',
    description: '',
    capabilityType: 'action',
    entryUrl: '',
    triggerPhrases: '',
    preconditions: '',
    steps: '',
    assertions: '',
    cleanupNotes: '',
    dependsOn: '',
    sortOrder: 100,
    sourceDocumentUid: '',
    meta: null,
  };
}

function capabilityToFormState(item: CapabilityItem): CapabilityFormState {
  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    capabilityType: item.capabilityType,
    entryUrl: item.entryUrl,
    triggerPhrases: formatMultilineValues(item.triggerPhrases),
    preconditions: formatMultilineValues(item.preconditions),
    steps: formatMultilineValues(item.steps),
    assertions: formatMultilineValues(item.assertions),
    cleanupNotes: item.cleanupNotes,
    dependsOn: formatMultilineValues(item.dependsOn),
    sortOrder: item.sortOrder,
    sourceDocumentUid: item.sourceDocumentUid || '',
    meta: item.meta ?? null,
  };
}

function capabilityPresetToFormState(item: IntentCapabilityPreset): CapabilityFormState {
  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    capabilityType: item.capabilityType,
    entryUrl: item.entryUrl,
    triggerPhrases: formatMultilineValues(item.triggerPhrases),
    preconditions: formatMultilineValues(item.preconditions),
    steps: formatMultilineValues(item.steps),
    assertions: formatMultilineValues(item.assertions),
    cleanupNotes: item.cleanupNotes,
    dependsOn: formatMultilineValues(item.dependsOn),
    sortOrder: item.sortOrder,
    sourceDocumentUid: item.sourceDocumentUid || '',
    meta: item.meta ?? null,
  };
}

function createCapabilityEditorSectionState(form: CapabilityFormState = createDefaultCapabilityForm()): CapabilityEditorSectionState {
  const flowPreview = form.capabilityType === 'composite' ? getIntentCapabilityFlowDefinition(form.meta, form.entryUrl) : null;
  return {
    basic: true,
    matching: Boolean(form.triggerPhrases.trim() || form.preconditions.trim()),
    execution: Boolean(form.steps.trim() || form.assertions.trim() || flowPreview?.steps.length),
    cleanup: Boolean(form.cleanupNotes.trim() || form.dependsOn.trim()),
  };
}

function normalizeCapabilityMetaForSave(capabilityType: CapabilityType, meta: unknown): unknown {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const next = { ...(meta as Record<string, unknown>) };
  if (capabilityType !== 'composite') {
    delete next.flowDefinition;
    delete next.sourceTaskMode;
  }
  return Object.keys(next).length > 0 ? next : null;
}

export default function ProjectIntentWorkbench({
  projectUid,
  activeModules,
  defaultTaskModuleUid,
  canEditContent,
  creationBlockedReason,
  onApplyTaskDraft,
  launchPreset,
  onLaunchPresetConsumed,
}: ProjectIntentWorkbenchProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<WorkbenchView>('recipe');
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [capabilitySaving, setCapabilitySaving] = useState(false);
  const [documentActioningUid, setDocumentActioningUid] = useState('');
  const [capabilityActioningUid, setCapabilityActioningUid] = useState('');
  const [verifyingCapabilityUid, setVerifyingCapabilityUid] = useState('');
  const [derivingKnowledgeTarget, setDerivingKnowledgeTarget] = useState('');
  const [loadingDocumentPreview, setLoadingDocumentPreview] = useState(false);
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [documentPreviewChunks, setDocumentPreviewChunks] = useState<KnowledgeChunkItem[]>([]);
  const [documentPreviewSearch, setDocumentPreviewSearch] = useState('');
  const [selectedDocumentUid, setSelectedDocumentUid] = useState('');
  const [editingCapabilityUid, setEditingCapabilityUid] = useState('');
  const [capabilityModalOpen, setCapabilityModalOpen] = useState(false);
  const [capabilitySearch, setCapabilitySearch] = useState('');
  const [requirement, setRequirement] = useState('创建商机并在商机列表按手机号校验落库');
  const [selectedModuleUid, setSelectedModuleUid] = useState(defaultTaskModuleUid);
  const [recipeResponse, setRecipeResponse] = useState<DraftRecipeResponse | null>(null);
  const [selectedRecipeCapabilitySlugs, setSelectedRecipeCapabilitySlugs] = useState<string[]>([]);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(() => createDefaultKnowledgeForm());
  const [capabilityForm, setCapabilityForm] = useState<CapabilityFormState>(() => createDefaultCapabilityForm());
  const [capabilitySections, setCapabilitySections] = useState<CapabilityEditorSectionState>(() => createCapabilityEditorSectionState());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [appliedLaunchToken, setAppliedLaunchToken] = useState('');

  const documentNameByUid = new Map(documents.map((item) => [item.documentUid, item.name]));
  const activeDocuments = documents.filter((item) => item.status === 'active');
  const activeCapabilities = capabilities.filter((item) => item.status === 'active');
  const deferredDocumentPreviewSearch = useDeferredValue(documentPreviewSearch);
  const documentPreviewSearchQuery = deferredDocumentPreviewSearch.trim().toLowerCase();
  const deferredCapabilitySearch = useDeferredValue(capabilitySearch);
  const capabilitySearchQuery = deferredCapabilitySearch.trim().toLowerCase();
  const filteredDocumentPreviewChunks = documentPreviewChunks.filter((item) => {
    if (!documentPreviewSearchQuery) return true;
    const haystack = [item.heading, item.content, item.keywords.join(' ')].join('\n').toLowerCase();
    return haystack.includes(documentPreviewSearchQuery);
  });
  const capabilityCatalogItems = activeCapabilities.filter((item) =>
    matchesCapabilitySearch(item, capabilitySearchQuery, documentNameByUid.get(item.sourceDocumentUid) || '')
  );
  const selectedModuleName = activeModules.find((item) => item.moduleUid === selectedModuleUid)?.name || '未选择';
  const baseRecipe = recipeResponse?.recipe || null;
  const recipeCapabilityDependents = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of baseRecipe?.matchedCapabilities || []) {
      for (const dependencySlug of item.dependsOn) {
        const current = map.get(dependencySlug) || [];
        current.push(item.slug);
        map.set(dependencySlug, current);
      }
    }
    return map;
  }, [baseRecipe]);
  const selectedRecipeCapabilitySlugSet = useMemo(
    () => new Set(selectedRecipeCapabilitySlugs.map((item) => item.trim()).filter(Boolean)),
    [selectedRecipeCapabilitySlugs]
  );
  const effectiveRecipe =
    baseRecipe &&
    applyCapabilitySelectionToRecipe({
      recipe: baseRecipe,
      selectedCapabilitySlugs: selectedRecipeCapabilitySlugs,
    });
  const capabilityFlowPreview =
    capabilityForm.capabilityType === 'composite'
      ? getIntentCapabilityFlowDefinition(capabilityForm.meta, capabilityForm.entryUrl)
      : null;
  const draftPreview =
    effectiveRecipe && selectedModuleUid
      ? buildTaskDraftFromRecipe({
          recipe: effectiveRecipe,
          moduleUid: selectedModuleUid,
        })
      : null;
  const uncoveredRequirementClauses = effectiveRecipe?.requirementCoverage.uncoveredClauses || [];
  const coverageBlockedReason =
    effectiveRecipe && effectiveRecipe.matchedCapabilities.length === 0
      ? '请至少选择一个能力后再生成测试计划。'
      : uncoveredRequirementClauses.length > 0
        ? `当前能力库还不能完整覆盖该需求，未命中的需求片段：${uncoveredRequirementClauses.join('；')}。请先补充稳定能力后再回填任务。`
        : '';
  const coveredRequirementCount = effectiveRecipe?.requirementCoverage.clauses.filter((item) => item.covered).length || 0;
  const totalRequirementCount = effectiveRecipe?.requirementCoverage.clauses.length || 0;
  const matchedCapabilityCount = effectiveRecipe?.matchedCapabilities.length || 0;
  const availableRecipeCapabilityCount = baseRecipe?.matchedCapabilities.length || 0;

  useEffect(() => {
    if (!baseRecipe) {
      setSelectedRecipeCapabilitySlugs([]);
      return;
    }

    setSelectedRecipeCapabilitySlugs(baseRecipe.matchedCapabilities.map((item) => item.slug));
  }, [baseRecipe]);

  function collectRecipeCapabilityDependencySlugs(slug: string, seen = new Set<string>()): Set<string> {
    if (!baseRecipe || seen.has(slug)) return seen;
    seen.add(slug);
    const capability = baseRecipe.matchedCapabilities.find((item) => item.slug === slug);
    if (!capability) return seen;
    for (const dependencySlug of capability.dependsOn) {
      if (!baseRecipe.matchedCapabilities.some((item) => item.slug === dependencySlug)) continue;
      collectRecipeCapabilityDependencySlugs(dependencySlug, seen);
    }
    return seen;
  }

  function collectRecipeCapabilityDependentSlugs(slug: string, selectedSet: Set<string>, seen = new Set<string>()): Set<string> {
    if (seen.has(slug)) return seen;
    seen.add(slug);
    const dependents = recipeCapabilityDependents.get(slug) || [];
    for (const dependentSlug of dependents) {
      if (!selectedSet.has(dependentSlug)) continue;
      collectRecipeCapabilityDependentSlugs(dependentSlug, selectedSet, seen);
    }
    return seen;
  }

  function resetRecipeCapabilitySelection() {
    if (!baseRecipe) return;
    setSelectedRecipeCapabilitySlugs(baseRecipe.matchedCapabilities.map((item) => item.slug));
  }

  function toggleRecipeCapabilitySelection(slug: string) {
    if (!baseRecipe) return;

    setSelectedRecipeCapabilitySlugs((current) => {
      const currentSet = new Set(current);
      if (currentSet.has(slug)) {
        const toRemove = collectRecipeCapabilityDependentSlugs(slug, currentSet);
        for (const item of toRemove) currentSet.delete(item);
      } else {
        const toAdd = collectRecipeCapabilityDependencySlugs(slug);
        for (const item of toAdd) currentSet.add(item);
      }

      return baseRecipe.matchedCapabilities.map((item) => item.slug).filter((item) => currentSet.has(item));
    });
  }

  useEffect(() => {
    if (!selectedModuleUid) {
      setSelectedModuleUid(defaultTaskModuleUid);
      return;
    }
    if (activeModules.length > 0 && !activeModules.some((item) => item.moduleUid === selectedModuleUid)) {
      setSelectedModuleUid(defaultTaskModuleUid || activeModules[0]?.moduleUid || '');
    }
  }, [activeModules, defaultTaskModuleUid, selectedModuleUid]);

  useEffect(() => {
    if (!open) return;
    void loadContext();
  }, [open, projectUid]);

  useEffect(() => {
    if (!launchPreset?.token || appliedLaunchToken === launchPreset.token) return;

    setAppliedLaunchToken(launchPreset.token);
    const nextForm = capabilityPresetToFormState(launchPreset.capabilityPreset);
    setEditingCapabilityUid('');
    setCapabilityForm(nextForm);
    setCapabilitySections(createCapabilityEditorSectionState(nextForm));
    setCapabilitySearch('');
    setDocumentPreviewSearch('');
    setView(launchPreset.view);
    setCapabilityModalOpen(true);
    setError('');
    setNotice(`已根据${launchPreset.capabilityPreset.sourceLabel}预填能力草稿`);
    setOpen(true);
    onLaunchPresetConsumed?.(launchPreset.token);
  }, [appliedLaunchToken, launchPreset, onLaunchPresetConsumed]);

  function showError(message: string) {
    setNotice('');
    setError(message);
  }

  function showNotice(message: string) {
    setError('');
    setNotice(message);
  }

  function openWorkbench() {
    setError('');
    setNotice('');
    setCapabilitySearch('');
    setDocumentPreviewSearch('');
    setCapabilityModalOpen(false);
    setOpen(true);
  }

  function closeWorkbench() {
    setOpen(false);
    setError('');
    setNotice('');
    setCapabilitySearch('');
    setDocumentPreviewSearch('');
    setCapabilityModalOpen(false);
  }

  async function loadContext() {
    setLoadingContext(true);
    setError('');
    try {
      const [knowledgeRes, capabilityRes] = await Promise.all([
        fetch(`/api/projects/${projectUid}/knowledge?status=all`),
        fetch(`/api/projects/${projectUid}/capabilities?status=all`),
      ]);
      const knowledgeJson = await knowledgeRes.json();
      const capabilityJson = await capabilityRes.json();
      if (!knowledgeRes.ok) {
        throw new Error(knowledgeJson.error || '加载项目知识失败');
      }
      if (!capabilityRes.ok) {
        throw new Error(capabilityJson.error || '加载项目能力失败');
      }

      const nextDocuments = (knowledgeJson.documents || []) as KnowledgeDocumentItem[];
      const nextCapabilities = (capabilityJson.items || []) as CapabilityItem[];
      setDocuments(nextDocuments);
      setCapabilities(nextCapabilities);

      if (selectedDocumentUid && !nextDocuments.some((item) => item.documentUid === selectedDocumentUid)) {
        setSelectedDocumentUid('');
        setDocumentPreviewChunks([]);
        setDocumentPreviewSearch('');
      }
      if (editingCapabilityUid && !nextCapabilities.some((item) => item.capabilityUid === editingCapabilityUid)) {
        setEditingCapabilityUid('');
        setCapabilityModalOpen(false);
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '加载需求编排上下文失败');
    } finally {
      setLoadingContext(false);
    }
  }

  async function loadDocumentPreview(documentUid: string) {
    if (!documentUid) {
      setSelectedDocumentUid('');
      setDocumentPreviewChunks([]);
      setDocumentPreviewSearch('');
      return;
    }

    setSelectedDocumentUid(documentUid);
    setDocumentPreviewSearch('');
    setLoadingDocumentPreview(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        documentUid,
        includeChunks: 'true',
        status: 'all',
        limit: '120',
      });
      const res = await fetch(`/api/projects/${projectUid}/knowledge?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '加载知识文档预览失败');
      }
      setDocumentPreviewChunks((json.chunks || []) as KnowledgeChunkItem[]);
      setView('knowledge');
    } catch (err: unknown) {
      setDocumentPreviewChunks([]);
      showError(err instanceof Error ? err.message : '加载知识文档预览失败');
    } finally {
      setLoadingDocumentPreview(false);
    }
  }

  async function submitRequirement() {
    if (!requirement.trim()) {
      showError('请先输入测试需求描述');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/draft-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: requirement.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '生成需求编排草案失败');
      }
      const payload = json as DraftRecipeResponse;
      setRecipeResponse(payload);
      setSelectedRecipeCapabilitySlugs(payload.recipe?.matchedCapabilities.map((item) => item.slug) || []);
      setNotice('');
    } catch (err: unknown) {
      setRecipeResponse(null);
      setSelectedRecipeCapabilitySlugs([]);
      showError(err instanceof Error ? err.message : '生成需求编排草案失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitKnowledgeDocument() {
    if (!canEditContent) {
      showError('当前操作者没有权限导入项目知识');
      return;
    }
    if (!knowledgeForm.name.trim()) {
      showError('请填写知识文档名称');
      return;
    }
    if (!knowledgeForm.content.trim()) {
      showError('请填写知识文档内容');
      return;
    }

    setKnowledgeSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: knowledgeForm.name.trim(),
          sourceType: knowledgeForm.sourceType,
          sourcePath: knowledgeForm.sourcePath.trim(),
          content: knowledgeForm.content,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '导入项目知识失败');
      }

      await loadContext();
      if (json.document?.documentUid) {
        await loadDocumentPreview(String(json.document.documentUid));
        setCapabilityForm((current) => ({
          ...current,
          sourceDocumentUid: String(json.document.documentUid),
        }));
      }
      setKnowledgeForm(createDefaultKnowledgeForm());
      showNotice(`知识文档「${json.document?.name || knowledgeForm.name.trim()}」已导入`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '导入项目知识失败');
    } finally {
      setKnowledgeSaving(false);
    }
  }

  async function archiveKnowledgeDocument(item: KnowledgeDocumentItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限导入项目知识');
      return;
    }
    if (item.status !== 'active') {
      showError('知识文档已经归档');
      return;
    }
    if (!confirm(`确认归档知识文档“${item.name}”？归档后它将不再参与 recipe 证据检索。`)) return;

    setDocumentActioningUid(item.documentUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/knowledge/${item.documentUid}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '归档项目知识失败');
      }
      await loadContext();
      showNotice(`知识文档「${item.name}」已归档`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '归档项目知识失败');
    } finally {
      setDocumentActioningUid('');
    }
  }

  async function restoreKnowledgeDocument(item: KnowledgeDocumentItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限导入项目知识');
      return;
    }
    if (item.status !== 'archived') {
      showError('知识文档已经是启用状态');
      return;
    }

    setDocumentActioningUid(item.documentUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/knowledge/${item.documentUid}/restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '恢复项目知识失败');
      }
      await loadContext();
      showNotice(`知识文档「${item.name}」已恢复`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '恢复项目知识失败');
    } finally {
      setDocumentActioningUid('');
    }
  }

  function resetCapabilityForm() {
    setEditingCapabilityUid('');
    const nextForm = createDefaultCapabilityForm();
    setCapabilityForm(nextForm);
    setCapabilitySections(createCapabilityEditorSectionState(nextForm));
  }

  function openCreateCapabilityModal(sourceDocumentUid = '') {
    setEditingCapabilityUid('');
    const nextForm = {
      ...createDefaultCapabilityForm(),
      sourceDocumentUid,
    };
    setCapabilityForm(nextForm);
    setCapabilitySections(createCapabilityEditorSectionState(nextForm));
    setCapabilityModalOpen(true);
    setView('capability');
    setError('');
    setNotice('');
  }

  function closeCapabilityModal() {
    setCapabilityModalOpen(false);
  }

  function toggleCapabilitySection(section: CapabilityEditorSection) {
    setCapabilitySections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function editCapability(item: CapabilityItem) {
    if (item.status !== 'active') {
      showError('请先恢复能力，再编辑');
      return;
    }
    setEditingCapabilityUid(item.capabilityUid);
    const nextForm = capabilityToFormState(item);
    setCapabilityForm(nextForm);
    setCapabilitySections(createCapabilityEditorSectionState(nextForm));
    setCapabilityModalOpen(true);
    setView('capability');
    setError('');
    setNotice('');
  }

  async function archiveCapability(item: CapabilityItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (item.status !== 'active') {
      showError('能力已经归档');
      return;
    }
    if (!confirm(`确认归档能力“${item.name}”？归档后它将不再参与 recipe 编排。`)) return;

    setCapabilityActioningUid(item.capabilityUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/capabilities/${item.capabilityUid}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '归档项目能力失败');
      }
      if (editingCapabilityUid === item.capabilityUid) {
        resetCapabilityForm();
        setCapabilityModalOpen(false);
      }
      await loadContext();
      showNotice(`能力「${item.name}」已归档`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '归档项目能力失败');
    } finally {
      setCapabilityActioningUid('');
    }
  }

  async function restoreCapability(item: CapabilityItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (item.status !== 'archived') {
      showError('能力已经是启用状态');
      return;
    }

    setCapabilityActioningUid(item.capabilityUid);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/capabilities/${item.capabilityUid}/restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '恢复项目能力失败');
      }
      await loadContext();
      showNotice(`能力「${item.name}」已恢复`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '恢复项目能力失败');
    } finally {
      setCapabilityActioningUid('');
    }
  }

  async function submitCapability() {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (!capabilityForm.slug.trim() || !capabilityForm.name.trim() || !capabilityForm.description.trim()) {
      showError('请填写完整的 slug、名称和描述');
      return;
    }

    setCapabilitySaving(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/capabilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: capabilityForm.slug.trim().toLowerCase(),
          name: capabilityForm.name.trim(),
          description: capabilityForm.description.trim(),
          capabilityType: capabilityForm.capabilityType,
          entryUrl: capabilityForm.entryUrl.trim(),
          triggerPhrases: parseMultilineValues(capabilityForm.triggerPhrases),
          preconditions: parseMultilineValues(capabilityForm.preconditions),
          steps: parseMultilineValues(capabilityForm.steps),
          assertions: parseMultilineValues(capabilityForm.assertions),
          cleanupNotes: capabilityForm.cleanupNotes.trim(),
          dependsOn: parseMultilineValues(capabilityForm.dependsOn),
          sortOrder: capabilityForm.sortOrder,
          sourceDocumentUid: capabilityForm.sourceDocumentUid || '',
          meta: normalizeCapabilityMetaForSave(capabilityForm.capabilityType, capabilityForm.meta),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '写入项目能力失败');
      }

      const saved = ((json.items || [])[0] || null) as CapabilityItem | null;
      await loadContext();
      if (saved) {
        setEditingCapabilityUid(saved.capabilityUid);
        setCapabilityForm(capabilityToFormState(saved));
      }
      setCapabilityModalOpen(false);
      showNotice(`能力「${saved?.name || capabilityForm.name.trim()}」已保存`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '写入项目能力失败');
    } finally {
      setCapabilitySaving(false);
    }
  }

  async function deriveCapabilitiesFromKnowledge(documentUid: string, chunkUid?: string) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (!documentUid) {
      showError('请先选择知识文档');
      return;
    }

    const targetKey = chunkUid ? `${documentUid}:${chunkUid}` : documentUid;
    setDerivingKnowledgeTarget(targetKey);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectUid}/knowledge/${documentUid}/derive-capabilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunkUid ? { chunkUid } : {}),
      });
      const json = (await res.json()) as DeriveCapabilityResponse | { error?: string };
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || '自动沉淀稳定能力失败');
      }

      await loadContext();
      await loadDocumentPreview(documentUid);

      const payload = json as DeriveCapabilityResponse;
      const firstItem = payload.items?.[0];
      if (payload.items?.length === 1 && firstItem) {
        setEditingCapabilityUid(firstItem.capabilityUid);
        setCapabilityForm(capabilityToFormState(firstItem));
      }

      const summary = payload.summary;
      const detail = [
        summary.derivedCount > 0 ? `已沉淀 ${summary.derivedCount} 条能力` : '没有新增可沉淀能力',
        summary.executionVerifiedCount > 0 ? `${summary.executionVerifiedCount} 条执行验证` : '',
        summary.knowledgeInferredCount > 0 ? `${summary.knowledgeInferredCount} 条知识提炼` : '',
        summary.skippedCount > 0 ? `${summary.skippedCount} 条跳过` : '',
        summary.executionVerifiedCount === 0 && summary.knowledgeInferredCount > 0
          ? '当前为知识提炼，执行沉淀后会优先命中执行验证能力'
          : '',
      ]
        .filter(Boolean)
        .join('，');

      showNotice(detail || '自动沉淀已完成');
      setView(payload.items?.length > 0 ? 'capability' : 'knowledge');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '自动沉淀稳定能力失败');
    } finally {
      setDerivingKnowledgeTarget('');
    }
  }

  async function verifyCapability(item: CapabilityItem) {
    if (!canEditContent) {
      showError('当前操作者没有权限维护项目能力');
      return;
    }
    if (item.status !== 'active') {
      showError('请先恢复能力，再发起验证');
      return;
    }

    const moduleUid = selectedModuleUid || defaultTaskModuleUid || activeModules[0]?.moduleUid || '';
    if (!moduleUid) {
      showError('当前项目没有可用模块，无法创建验证任务');
      return;
    }

    setVerifyingCapabilityUid(item.capabilityUid);
    setError('');
    try {
      const lastAttempt = getCapabilityLastVerificationAttempt(item.meta);
      const mode = lastAttempt.status === 'failed' && lastAttempt.executionUid ? 'repair' : 'verify';
      const res = await fetch(`/api/projects/${projectUid}/capabilities/${item.capabilityUid}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleUid, mode }),
      });
      const json = (await res.json()) as CapabilityVerificationLaunchResponse | { error?: string };
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || '启动能力验证失败');
      }

      const payload = json as CapabilityVerificationLaunchResponse;
      showNotice(
        mode === 'repair'
          ? `已启动验证修复，AI 会基于上次失败执行重写并重跑脚本（运行 ${payload.executionUid}）`
          : `已启动能力验证，执行通过后会自动升级为执行验证（运行 ${payload.executionUid}）`
      );
      if (payload.runPath && typeof window !== 'undefined') {
        window.open(payload.runPath, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '启动能力验证失败');
    } finally {
      setVerifyingCapabilityUid('');
    }
  }

  function applyTaskDraft() {
    if (!effectiveRecipe) return;
    if (coverageBlockedReason) {
      showError(coverageBlockedReason);
      return;
    }
    if (creationBlockedReason) {
      showError(creationBlockedReason);
      return;
    }
    if (!selectedModuleUid) {
      showError('请先选择目标模块');
      return;
    }

    const draft = buildTaskDraftFromRecipe({
      recipe: effectiveRecipe,
      moduleUid: selectedModuleUid,
    });
    onApplyTaskDraft(draft);
    closeWorkbench();
  }

  const viewSwitchPanel = (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {([
          {
            key: 'recipe' as WorkbenchView,
            label: '需求编排',
            badge: recipeResponse?.recipe ? `${matchedCapabilityCount} 命中` : '主视图',
          },
          {
            key: 'knowledge' as WorkbenchView,
            label: '知识文档',
            badge: `${activeDocuments.length} 启用`,
          },
          {
            key: 'capability' as WorkbenchView,
            label: '稳定能力',
            badge: `${activeCapabilities.length} 可用`,
          },
        ]).map((item) => (
          <button
            key={item.key}
            aria-label={item.label}
            onClick={() => setView(item.key)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              view === item.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                view === item.key ? 'bg-white/12 text-white/92' : 'bg-white text-slate-500'
              }`}
            >
              {item.badge}
            </span>
          </button>
        ))}
      </div>

      {!canEditContent && view !== 'recipe' && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          当前角色只能查看知识和能力内容，不能导入知识或保存能力。
        </div>
      )}
    </div>
  );

  const knowledgeCatalogPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">知识目录</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">浏览项目手册、笔记与执行沉淀，选中文档后可直接预览切块结果。</p>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
            {recipeResponse?.knowledgeChunkCount || activeDocuments.reduce((sum, item) => sum + item.chunkCount, 0)} chunks
          </span>
          <p className="mt-1 text-[11px] text-slate-400">{activeDocuments.length} 启用 / {documents.length} 总计</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {loadingContext && documents.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">加载知识库中...</p>
        )}
        {!loadingContext && documents.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">当前项目还没有知识文档。</p>
        )}
        {documents.map((item) => {
          const selected = item.documentUid === selectedDocumentUid;
          const archived = item.status === 'archived';
          return (
            <div
              key={item.documentUid}
              className={`rounded-2xl border px-3 py-3 transition ${
                archived
                  ? 'border-amber-200 bg-amber-50/60'
                  : selected
                    ? 'border-sky-200 bg-sky-50/60'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-sm font-medium text-slate-800">{item.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{item.chunkCount} 块</span>
                    {selected && !archived && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                        当前预览
                      </span>
                    )}
                    {archived && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                        已归档
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    {sourceTypeLabel(item.sourceType)} · {item.status}
                    {item.sourcePath ? ` · ${item.sourcePath}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <button
                    onClick={() => void loadDocumentPreview(item.documentUid)}
                    className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                  >
                    预览
                  </button>
                  {canEditContent &&
                    (archived ? (
                      <button
                        aria-label={`恢复知识文档 ${item.name}`}
                        onClick={() => void restoreKnowledgeDocument(item)}
                        disabled={documentActioningUid === item.documentUid}
                        className="h-7 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        恢复
                      </button>
                    ) : (
                      <>
                        <button
                          aria-label={`设为能力来源 ${item.name}`}
                          onClick={() => openCreateCapabilityModal(item.documentUid)}
                          className="h-7 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] text-blue-700 transition hover:bg-blue-100"
                        >
                          设为来源
                        </button>
                        <button
                          aria-label={`归档知识文档 ${item.name}`}
                          onClick={() => void archiveKnowledgeDocument(item)}
                          disabled={documentActioningUid === item.documentUid}
                          className="h-7 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          归档
                        </button>
                      </>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const capabilityCatalogPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">能力目录</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">只展示基础信息，批量浏览后再按需打开弹框维护。</p>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
            {activeCapabilities.length} 项可用能力
          </span>
          {capabilitySearchQuery && <p className="mt-1 text-[11px] text-slate-400">{capabilityCatalogItems.length} 条匹配</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">搜索稳定能力</label>
          <input
            value={capabilitySearch}
            onChange={(event) => setCapabilitySearch(event.target.value)}
            aria-label="搜索稳定能力"
            placeholder="搜索名称、slug、触发短语、依赖"
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
          />
        </div>
        {canEditContent && (
          <button
            onClick={() => openCreateCapabilityModal(selectedDocumentUid)}
            className="h-10 rounded-xl bg-slate-900 px-4 text-[11px] font-medium text-white transition hover:bg-slate-700"
          >
            新增稳定能力
          </button>
        )}
      </div>

      <div className="mt-4">
        {capabilities.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">当前项目还没有稳定能力。</p>
        )}
        {capabilities.length > 0 && capabilityCatalogItems.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">
            没有匹配的稳定能力，试试名称、slug、触发短语或依赖关系。
          </p>
        )}
        {capabilityCatalogItems.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilityCatalogItems.map((item) => {
              const editing = item.capabilityUid === editingCapabilityUid;
              const archived = item.status === 'archived';
              const verification = describeCapabilityVerification(item.meta);
              const lastAttempt = getCapabilityLastVerificationAttempt(item.meta);
              const preservedFlow =
                item.capabilityType === 'composite'
                  ? getIntentCapabilityFlowDefinition(item.meta, item.entryUrl)
                  : null;
              const failedVerification = lastAttempt.status === 'failed';
              const sourceDocumentName = documentNameByUid.get(item.sourceDocumentUid) || '';

              return (
                <div
                  key={item.capabilityUid}
                  className={`rounded-2xl border px-3 py-3 transition ${
                    archived
                      ? 'border-amber-200 bg-amber-50/60'
                      : failedVerification
                        ? 'border-rose-200 bg-rose-50/60'
                        : editing
                          ? 'border-emerald-200 bg-emerald-50/60'
                          : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${capabilityTypeTone(
                            item.capabilityType
                          )}`}
                        >
                          {capabilityTypeLabel(item.capabilityType)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${capabilityVerificationTone(
                            item.meta
                          )}`}
                        >
                          {verification.label}
                        </span>
                        {archived && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                            已归档
                          </span>
                        )}
                      </div>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 break-all text-[11px] text-slate-400">{item.slug}</p>
                    </div>
                    {failedVerification && (
                      <span
                        title={lastAttempt.executionUid ? `最近验证失败：${lastAttempt.executionUid}` : '最近验证失败'}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200"
                      >
                        !
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-slate-600">{excerpt(item.description, 78)}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sourceDocumentName && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        来源 {excerpt(sourceDocumentName, 18)}
                      </span>
                    )}
                    {item.triggerPhrases.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        命中词 {item.triggerPhrases.length}
                      </span>
                    )}
                    {item.dependsOn.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        依赖 {item.dependsOn.length}
                      </span>
                    )}
                    {preservedFlow?.steps.length ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700 ring-1 ring-violet-100">
                        业务流 {preservedFlow.steps.length} 节点
                      </span>
                    ) : null}
                  </div>

                  {canEditContent ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {archived ? (
                        <button
                          aria-label={`恢复能力 ${item.name}`}
                          onClick={() => void restoreCapability(item)}
                          disabled={capabilityActioningUid === item.capabilityUid}
                          className="h-7 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          恢复
                        </button>
                      ) : (
                        <>
                          <button
                            aria-label={`验证能力 ${item.name}`}
                            onClick={() => void verifyCapability(item)}
                            disabled={verifyingCapabilityUid === item.capabilityUid}
                            className="h-7 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                          >
                            {(() => {
                              if (verifyingCapabilityUid === item.capabilityUid) return '验证中...';
                              if (lastAttempt.status === 'failed' && lastAttempt.executionUid) return '验证并修复';
                              if (verification.status === 'execution_verified') return '重新验证';
                              return '验证并升级';
                            })()}
                          </button>
                          <button
                            aria-label={`编辑能力 ${item.name}`}
                            onClick={() => editCapability(item)}
                            className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                          >
                            编辑
                          </button>
                          <button
                            aria-label={`归档能力 ${item.name}`}
                            onClick={() => void archiveCapability(item)}
                            disabled={capabilityActioningUid === item.capabilityUid}
                            className="h-7 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                          >
                            归档
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const recipeWorkbench = (
    <>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">简单需求输入</h3>
            <p className="mt-1 text-xs text-slate-500">这里不需要手工拆业务流步骤，先描述目标、校验点和业务结果即可。</p>

            {(activeDocuments.length === 0 || activeCapabilities.length === 0) && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
                <span>
                  当前项目还缺少{activeDocuments.length === 0 ? '知识文档' : ''}
                  {activeDocuments.length === 0 && activeCapabilities.length === 0 ? '和' : ''}
                  {activeCapabilities.length === 0 ? '稳定能力' : ''}，recipe 会缺少证据或无法补齐依赖。
                </span>
                {canEditContent && (
                  <button
                    onClick={() => setView(activeDocuments.length === 0 ? 'knowledge' : 'capability')}
                    className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    {activeDocuments.length === 0 ? '去补知识文档' : '去补稳定能力'}
                  </button>
                )}
              </div>
            )}

            <textarea
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
              aria-label="需求描述"
              rows={6}
              placeholder="例如：创建商机并在商机列表按手机号校验落库。"
              className="mt-4 min-h-[188px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-xs font-medium text-slate-600">回填模块</label>
            <select
              value={selectedModuleUid}
              onChange={(event) => setSelectedModuleUid(event.target.value)}
              aria-label="需求回填模块"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="">选择回填模块</option>
              {activeModules.map((item) => (
                <option key={item.moduleUid} value={item.moduleUid}>
                  {item.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => void submitRequirement()}
              disabled={submitting || loadingContext}
              className="mt-3 h-10 w-full rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? '编排中...' : '生成 recipe'}
            </button>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">输入建议</p>
              <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                <p>描述业务目标，而不是手工拆步骤。</p>
                <p>补上关键校验点，例如落库、断言、页面结果。</p>
                <p>切到知识文档或稳定能力页时，可以继续补证据和可复用动作。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {effectiveRecipe ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">编排结果</h3>
              <p className="mt-1 text-xs text-slate-500">
                当前返回 {availableRecipeCapabilityCount} 个可选能力，你可以按需勾选，下面的执行步骤、覆盖率和任务草稿会实时更新。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                  已选能力 {matchedCapabilityCount}/{availableRecipeCapabilityCount}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                  执行步骤 {effectiveRecipe.executionRecipe.steps.length}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                  覆盖 {coveredRequirementCount}/{totalRequirementCount}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">断言 {effectiveRecipe.executionRecipe.assertions.length}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {availableRecipeCapabilityCount > 0 && selectedRecipeCapabilitySlugs.length !== availableRecipeCapabilityCount && (
                <button
                  onClick={resetRecipeCapabilitySelection}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  还原推荐
                </button>
              )}
              <button
                onClick={applyTaskDraft}
                disabled={!canEditContent || Boolean(creationBlockedReason) || Boolean(coverageBlockedReason) || !selectedModuleUid}
                className="h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                写入任务草稿
              </button>
            </div>
          </div>

          {availableRecipeCapabilityCount > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">能力选择</h4>
                  <p className="mt-1 text-xs text-slate-500">取消重复语义能力后，下方编排结果会自动收敛；重新勾选业务能力时会自动补回它依赖的前置能力。</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                  已选 {matchedCapabilityCount} / {availableRecipeCapabilityCount}
                </span>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {baseRecipe?.matchedCapabilities.map((item) => {
                  const checked = selectedRecipeCapabilitySlugSet.has(item.slug);
                  const dependentCount = recipeCapabilityDependents.get(item.slug)?.length || 0;
                  return (
                    <label
                      key={item.slug}
                      className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 transition ${
                        checked ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecipeCapabilitySelection(item.slug)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${capabilityTypeTone(
                              item.capabilityType
                            )}`}
                          >
                            {capabilityTypeLabel(item.capabilityType)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">score {item.score}</span>
                          {item.dependsOn.length > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">依赖 {item.dependsOn.length}</span>
                          )}
                          {dependentCount > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">被依赖 {dependentCount}</span>
                          )}
                        </div>
                        <p className={`mt-1 text-sm font-medium ${checked ? 'text-slate-900' : 'text-slate-600'}`}>{item.name}</p>
                        <p className="mt-1 break-all text-[11px] text-slate-400">{item.slug}</p>
                        {item.matchedPhrases.length > 0 && (
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">命中：{item.matchedPhrases.join('、')}</p>
                        )}
                        {item.suggestedSteps.length > 0 && (
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">{excerpt(item.suggestedSteps.join('；'), 90)}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {coverageBlockedReason && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{coverageBlockedReason}</div>
          )}
          {creationBlockedReason && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{creationBlockedReason}</div>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
            <div className="space-y-3">
              {effectiveRecipe.executionRecipe.steps.map((step, index) => (
                <div key={`${step.capabilitySlug}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{step.capabilityName}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{step.reason}</p>
                  {step.preconditions.length > 0 && <p className="mt-2 text-xs text-slate-500">前置：{step.preconditions.join('；')}</p>}
                  <ol className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                    {step.actions.map((action, actionIndex) => (
                      <li key={`${step.capabilitySlug}-${actionIndex}`} className="flex gap-2">
                        <span className="min-w-4 text-slate-400">{actionIndex + 1}.</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">需求覆盖</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {effectiveRecipe.requirementCoverage.clauses.map((item) => (
                    <span
                      key={item.text}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                        item.covered
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-rose-50 text-rose-700 ring-rose-200'
                      }`}
                    >
                      {item.covered ? '已覆盖' : '未覆盖'} · {item.text}
                    </span>
                  ))}
                </div>
                {coverageBlockedReason && (
                  <p className="mt-2 text-xs leading-5 text-rose-600">
                    未覆盖片段不会自动写入任务草稿，避免生成看上去完整、实际缺步骤的业务流。
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">关键断言</h4>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                  {effectiveRecipe.executionRecipe.assertions.length === 0 && <li>当前 recipe 还没有稳定断言。</li>}
                  {effectiveRecipe.executionRecipe.assertions.map((item, index) => (
                    <li key={`assertion-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>

              {draftPreview && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">任务草稿预览</h4>
                  <div className="mt-2 space-y-2 text-xs text-slate-600">
                    <p>
                      <span className="text-slate-400">名称：</span>
                      {draftPreview.name}
                    </p>
                    <p>
                      <span className="text-slate-400">入口：</span>
                      {draftPreview.targetUrl || '未命中 URL'}
                    </p>
                    <p>
                      <span className="text-slate-400">步骤：</span>
                      {draftPreview.flowDefinition.steps.length} 个
                    </p>
                    <p>
                      <span className="text-slate-400">共享变量：</span>
                      {draftPreview.flowDefinition.sharedVariables.join('、') || '无'}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">手册证据</h4>
                <div className="mt-2 space-y-2">
                  {effectiveRecipe.supportingKnowledge.length === 0 && (
                    <p className="text-xs text-slate-400">当前需求还没有明显的手册证据命中。</p>
                  )}
                  {effectiveRecipe.supportingKnowledge.map((item, index) => (
                    <div key={`${item.heading}-${index}`} className="rounded-xl bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-700">{item.heading}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">score {item.score}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">{excerpt(item.excerpt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">还没有生成 recipe</p>
          <p className="mt-1 text-xs text-slate-400">先输入一句需求，再点击“生成 recipe”。</p>
        </div>
      )}
    </>
  );

  const knowledgeImportPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">导入知识文档</h3>
          <p className="mt-1 text-xs text-slate-500">同名文档会整篇替换并重新切块。</p>
        </div>
        <button
          onClick={() => setKnowledgeForm(createDefaultKnowledgeForm())}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 transition hover:bg-slate-50"
        >
          清空
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-4 md:grid-cols-[1fr_160px]">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">文档名称</label>
            <input
              value={knowledgeForm.name}
              onChange={(event) => setKnowledgeForm((current) => ({ ...current, name: event.target.value }))}
              disabled={!canEditContent}
              aria-label="知识文档名称"
              placeholder="例如：GBS 管帮手 PC 端操作手册"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">来源类型</label>
            <select
              value={knowledgeForm.sourceType}
              onChange={(event) =>
                setKnowledgeForm((current) => ({
                  ...current,
                  sourceType: event.target.value as KnowledgeSourceType,
                }))
              }
              disabled={!canEditContent}
              aria-label="知识来源类型"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="manual">手册</option>
              <option value="notes">笔记</option>
              <option value="execution">执行沉淀</option>
              <option value="system">系统</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-500">
          {sourceTypeVerificationHint(knowledgeForm.sourceType)}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">来源路径 / 备注</label>
          <input
            value={knowledgeForm.sourcePath}
            onChange={(event) => setKnowledgeForm((current) => ({ ...current, sourcePath: event.target.value }))}
            disabled={!canEditContent}
            aria-label="知识来源路径"
            placeholder="例如：docs/gbs-manual-v3.pdf"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">知识内容</label>
          <textarea
            value={knowledgeForm.content}
            onChange={(event) => setKnowledgeForm((current) => ({ ...current, content: event.target.value }))}
            disabled={!canEditContent}
            aria-label="知识文档内容"
            rows={12}
            placeholder="粘贴手册正文、页面规则、执行结论等。"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => void submitKnowledgeDocument()}
            disabled={knowledgeSaving || !canEditContent}
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {knowledgeSaving ? '导入中...' : '导入知识'}
          </button>
        </div>
      </div>
    </div>
  );

  const capabilityEditorPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{editingCapabilityUid ? '编辑稳定能力' : '维护稳定能力'}</h3>
          <p className="mt-1 text-xs text-slate-500">按分组展开填写，默认先展示基础信息。</p>
        </div>
        <button
          onClick={resetCapabilityForm}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 transition hover:bg-slate-50"
        >
          {editingCapabilityUid ? '新建空白' : '清空'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={capabilitySections.basic}
            onClick={() => toggleCapabilitySection('basic')}
            className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">基础信息</p>
              <p className="mt-1 text-[11px] text-slate-500">slug、名称、入口地址、描述和来源文档。</p>
            </div>
            <span className="text-[11px] text-slate-400">{capabilitySections.basic ? '收起' : '展开'}</span>
          </button>
          {capabilitySections.basic && (
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">能力标识</label>
                  <input
                    value={capabilityForm.slug}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, slug: event.target.value }))}
                    disabled={!canEditContent}
                    aria-label="能力标识"
                    placeholder="例如：business.list-search-by-phone"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">能力类型</label>
                  <select
                    value={capabilityForm.capabilityType}
                    onChange={(event) =>
                      setCapabilityForm((current) => ({
                        ...current,
                        capabilityType: event.target.value as CapabilityType,
                      }))
                    }
                    disabled={!canEditContent}
                    aria-label="能力类型"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="auth">登录</option>
                    <option value="navigation">导航</option>
                    <option value="action">动作</option>
                    <option value="query">查询</option>
                    <option value="assertion">断言</option>
                    <option value="composite">复合</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">能力名称</label>
                  <input
                    value={capabilityForm.name}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={!canEditContent}
                    aria-label="能力名称"
                    placeholder="例如：商机列表按手机号检索"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">排序</label>
                  <input
                    type="number"
                    value={capabilityForm.sortOrder}
                    onChange={(event) =>
                      setCapabilityForm((current) => ({
                        ...current,
                        sortOrder: toSafeSortOrder(event.target.value),
                      }))
                    }
                    disabled={!canEditContent}
                    aria-label="能力排序"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-600">能力入口地址</label>
                <input
                  value={capabilityForm.entryUrl}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, entryUrl: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力入口地址"
                  placeholder="例如：https://uat.example.com/#/business/list"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-600">能力描述</label>
                <textarea
                  value={capabilityForm.description}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, description: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力描述"
                  rows={3}
                  placeholder="说明这个能力稳定完成什么、适用于什么场景。"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-slate-600">来源文档</label>
                <select
                  value={capabilityForm.sourceDocumentUid}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, sourceDocumentUid: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力来源文档"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">不关联知识文档</option>
                  {documents.map((item) => (
                    <option key={item.documentUid} value={item.documentUid}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={capabilitySections.matching}
            onClick={() => toggleCapabilitySection('matching')}
            className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">命中与前置</p>
              <p className="mt-1 text-[11px] text-slate-500">触发短语和前置条件。</p>
            </div>
            <span className="text-[11px] text-slate-400">{capabilitySections.matching ? '收起' : '展开'}</span>
          </button>
          {capabilitySections.matching && (
            <div className="grid gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">触发短语</label>
                <textarea
                  value={capabilityForm.triggerPhrases}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, triggerPhrases: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力触发短语"
                  rows={4}
                  placeholder={'每行一个\n例如：创建商机'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">前置条件</label>
                <textarea
                  value={capabilityForm.preconditions}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, preconditions: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力前置条件"
                  rows={4}
                  placeholder={'每行一个\n例如：已登录'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={capabilitySections.execution}
            onClick={() => toggleCapabilitySection('execution')}
            className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">动作与断言</p>
              <p className="mt-1 text-[11px] text-slate-500">步骤、断言和复合业务流节点。</p>
            </div>
            <span className="text-[11px] text-slate-400">{capabilitySections.execution ? '收起' : '展开'}</span>
          </button>
          {capabilitySections.execution && (
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{capabilityFlowPreview ? '动作步骤摘要' : '动作步骤'}</label>
                  <textarea
                    value={capabilityForm.steps}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, steps: event.target.value }))}
                    disabled={!canEditContent}
                    aria-label="能力动作步骤"
                    rows={5}
                    placeholder={'每行一个\n例如：输入手机号并搜索'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">断言结果</label>
                  <textarea
                    value={capabilityForm.assertions}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, assertions: event.target.value }))}
                    disabled={!canEditContent}
                    aria-label="能力断言结果"
                    rows={5}
                    placeholder={'每行一个\n例如：列表展示匹配手机号'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>

              {capabilityFlowPreview?.steps.length ? (
                <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-violet-800">复合业务流节点</p>
                      <p className="mt-1 text-[11px] leading-5 text-violet-700">
                        该能力保留了原始业务流节点结构。后续“验证能力”会优先按这些节点逐步执行，不再把整条链路压成一个动作框。
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200">
                      {capabilityFlowPreview.steps.length} 个节点
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {capabilityFlowPreview.steps.map((step, index) => (
                      <div key={step.stepUid || `capability-flow-${index}`} className="rounded-lg border border-violet-100 bg-white/80 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-violet-800">
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 font-semibold text-violet-700">
                            {index + 1}
                          </span>
                          <span className="font-medium">{step.title || `步骤 ${index + 1}`}</span>
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700 ring-1 ring-violet-100">
                            {step.stepType}
                          </span>
                        </div>
                        {step.target && <p className="mt-1 text-[11px] text-violet-700">目标：{step.target}</p>}
                        {step.instruction && <p className="mt-1 text-[11px] leading-5 text-violet-700">动作：{step.instruction}</p>}
                        {step.expectedResult && <p className="mt-1 text-[11px] leading-5 text-violet-700">预期：{step.expectedResult}</p>}
                        {step.extractVariable && <p className="mt-1 text-[11px] text-violet-700">变量：{step.extractVariable}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={capabilitySections.cleanup}
            onClick={() => toggleCapabilitySection('cleanup')}
            className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">清理与依赖</p>
              <p className="mt-1 text-[11px] text-slate-500">收尾说明和依赖能力。</p>
            </div>
            <span className="text-[11px] text-slate-400">{capabilitySections.cleanup ? '收起' : '展开'}</span>
          </button>
          {capabilitySections.cleanup && (
            <div className="grid gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">清理说明</label>
                <textarea
                  value={capabilityForm.cleanupNotes}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, cleanupNotes: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力清理说明"
                  rows={4}
                  placeholder="例如：记录商机 ID 供人工清理"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">依赖能力 slug</label>
                <textarea
                  value={capabilityForm.dependsOn}
                  onChange={(event) => setCapabilityForm((current) => ({ ...current, dependsOn: event.target.value }))}
                  disabled={!canEditContent}
                  aria-label="能力依赖标识"
                  rows={4}
                  placeholder={'每行一个\n例如：auth.sms-password-login'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={closeCapabilityModal}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={() => void submitCapability()}
            disabled={capabilitySaving || !canEditContent}
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {capabilitySaving ? '保存中...' : editingCapabilityUid ? '更新能力' : '保存能力'}
          </button>
        </div>
      </div>
    </div>
  );

  const documentPreviewPanel = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">文档块预览</h3>
          <p className="mt-1 text-xs text-slate-500">
            {selectedDocumentUid ? `当前预览：${documentNameByUid.get(selectedDocumentUid) || '未知文档'}` : '从知识目录选择一篇文档查看切块效果。'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            手册或笔记沉淀后默认标记为“知识提炼”；执行沉淀文档会直接产出“执行验证”能力。
          </p>
        </div>
        {selectedDocumentUid && canEditContent && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void deriveCapabilitiesFromKnowledge(selectedDocumentUid)}
              disabled={derivingKnowledgeTarget === selectedDocumentUid}
              className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {derivingKnowledgeTarget === selectedDocumentUid ? '沉淀中...' : '自动沉淀能力'}
            </button>
            <button
              onClick={() => openCreateCapabilityModal(selectedDocumentUid)}
              className="h-8 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100"
            >
              设为能力来源
            </button>
          </div>
        )}
      </div>

      {selectedDocumentUid && (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">搜索文档块</label>
            <input
              value={documentPreviewSearch}
              onChange={(event) => setDocumentPreviewSearch(event.target.value)}
              aria-label="搜索文档块"
              placeholder="搜索标题、内容、关键词"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
          {!loadingDocumentPreview && documentPreviewChunks.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
              {filteredDocumentPreviewChunks.length} / {documentPreviewChunks.length} 块
            </span>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loadingDocumentPreview && <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">加载文档预览中...</p>}
        {!loadingDocumentPreview && !selectedDocumentUid && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">选择文档后，这里会展示切块后的 heading、内容摘要和关键词。</p>
        )}
        {!loadingDocumentPreview && selectedDocumentUid && documentPreviewChunks.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">这篇文档当前没有可展示的知识块。</p>
        )}
        {!loadingDocumentPreview &&
          selectedDocumentUid &&
          documentPreviewChunks.length > 0 &&
          filteredDocumentPreviewChunks.length === 0 && (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">没有匹配的文档块，试试标题、正文关键词或业务名词。</p>
          )}
        {filteredDocumentPreviewChunks.map((item) => (
          <div key={item.chunkUid} className="rounded-xl border border-slate-200 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">#{item.sortOrder}</span>
                <span className="text-sm font-medium text-slate-800">{item.heading}</span>
              </div>
              <div className="flex items-center gap-2">
                {canEditContent && (
                  <button
                    onClick={() => void deriveCapabilitiesFromKnowledge(item.documentUid, item.chunkUid)}
                    disabled={derivingKnowledgeTarget === `${item.documentUid}:${item.chunkUid}`}
                    className="h-7 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {derivingKnowledgeTarget === `${item.documentUid}:${item.chunkUid}` ? '沉淀中...' : '生成能力'}
                  </button>
                )}
                <span className="text-[11px] text-slate-400">
                  {item.sourceLineStart > 0 && item.sourceLineEnd > 0 ? `L${item.sourceLineStart}-${item.sourceLineEnd}` : `${item.tokenEstimate} tokens`}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{excerpt(item.content, 260)}</p>
            {item.keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.keywords.map((keyword) => (
                  <span key={`${item.chunkUid}-${keyword}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const knowledgeWorkbench = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
      <div className="space-y-4">
        {knowledgeImportPanel}
        {documentPreviewPanel}
      </div>
      <div className="space-y-4">
        {knowledgeCatalogPanel}
      </div>
    </div>
  );

  const capabilityModal = capabilityModalOpen ? (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{editingCapabilityUid ? '编辑稳定能力' : '新增稳定能力'}</h3>
            <p className="mt-1 text-[11px] text-slate-500">表单维护改为弹框操作，目录页只保留能力摘要。</p>
          </div>
          <button
            onClick={closeCapabilityModal}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 transition hover:bg-slate-50"
          >
            关闭
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-4">
          {capabilityEditorPanel}
        </div>
      </div>
    </div>
  ) : null;

  const capabilityWorkbench = (
    <div className="space-y-4">
      {capabilityCatalogPanel}
      {capabilityModal}
    </div>
  );

  return (
    <>
      <button
        onClick={openWorkbench}
        className="h-8 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
      >
        需求编排
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-[1460px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.28)]">
            <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.28),transparent_34%),linear-gradient(135deg,#020617_0%,#0f172a_52%,#172554_100%)] px-6 py-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-sky-200/90">Intent Orchestration</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">需求编排工作台</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-200/85">一句需求生成 recipe，再按需切到知识文档和稳定能力页补齐证据与复用动作。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void loadContext()}
                    disabled={loadingContext}
                    className="h-9 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {loadingContext ? '刷新中...' : '刷新上下文'}
                  </button>
                  <button
                    onClick={closeWorkbench}
                    className="h-9 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-medium text-slate-100 transition hover:bg-white/15"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[85vh] overflow-y-auto px-6 pb-6 pt-4">
              {error && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
              )}
              {notice && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
              )}

              <div className="space-y-4">
                {viewSwitchPanel}
                {view === 'recipe' ? recipeWorkbench : view === 'knowledge' ? knowledgeWorkbench : capabilityWorkbench}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
