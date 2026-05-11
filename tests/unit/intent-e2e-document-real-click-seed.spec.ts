import { describe, expect, it } from 'vitest';
import {
  buildIntentE2EDocumentRealClickRunRequest,
  buildIntentE2EDocumentRealClickSeedReport,
  buildIntentE2EDocumentRealClickSeedSamples,
  renderIntentE2EDocumentRealClickSeedMarkdown,
} from '@/lib/intent-e2e-document-real-click-seed';

describe('intent e2e document real click seed', () => {
  it('builds a true current-system document import-preview real-click sample', () => {
    const [sample] = buildIntentE2EDocumentRealClickSeedSamples({
      maxSamples: 1,
      projectUid: 'proj_custom',
      baseUrl: 'http://127.0.0.1:4999/',
    });

    expect(sample).toMatchObject({
      sampleId: 'project-knowledge-document-import-preview',
      provenance: 'document_surface_current_system',
      expectedPriorityScenarioFamily: 'untracked',
      targetUrl: 'http://127.0.0.1:4999/projects/proj_custom?intentView=knowledge',
      documentFamily: 'doc_create_reopen_verify',
      admissibility: 'document_family_admissible',
    });

    const request = buildIntentE2EDocumentRealClickRunRequest({
      projectUid: 'proj_custom',
      sample,
      timeoutMs: 1000,
    });

    expect(request).toMatchObject({
      projectUid: 'proj_custom',
      moduleUid: sample.moduleUid,
      input: sample.input,
      targetUrl: sample.targetUrl,
      prefilledScenarioCard: {
        title: '项目知识文档导入后预览验收',
        targetUrl: sample.targetUrl,
      },
      prefilledScenarioLlmMeta: {
        provider: 'deterministic',
        model: 'project-knowledge-document-real-click-seed',
      },
      runControl: {
        timeoutMs: 1000,
        retryLimit: 0,
      },
    });
    expect(String(request.prefilledPlanCode)).toContain("getByLabel('知识文档名称')");
    expect(String(request.prefilledPlanCode)).toContain("getByLabel('搜索文档块')");
    expect(String(request.prefilledPlanCode)).toContain('for (let attempt = 0; attempt < 3; attempt += 1)');
    expect(String(request.prefilledPlanCode)).toContain("workbenchHeading.waitFor({ state: 'visible', timeout: 10000 })");
    expect(String(request.prefilledPlanCode)).toContain("page.locator('div.fixed.inset-0')");
    expect(String(request.prefilledPlanCode)).not.toContain("page.locator('div.fixed.inset-0.z-50')");
    expect(request).not.toHaveProperty('intentDraftUid');
  });

  it('marks current document-assisted business samples as real-click seedable but not document-family admissible', () => {
    const sample = buildIntentE2EDocumentRealClickSeedSamples({
      maxSamples: 1,
      sampleIds: ['document-assisted-business-batch-add-contacts'],
    })[0];

    expect(sample).toMatchObject({
      sampleId: 'document-assisted-business-batch-add-contacts',
      provenance: 'document_assisted_current_system_business_flow',
      expectedPriorityScenarioFamily: 'business_batch_add_contacts_verify',
      documentFamily: '',
      admissibility: 'document_reference_only_business_flow',
    });
    expect(sample).toBeTruthy();

    const request = buildIntentE2EDocumentRealClickRunRequest({
      projectUid: 'proj_default',
      sample: sample!,
      timeoutMs: 1000,
    });

    expect(request).toMatchObject({
      projectUid: 'proj_default',
      moduleUid: sample!.moduleUid,
      input: sample!.input,
      targetUrl: sample!.targetUrl,
      runControl: {
        timeoutMs: 1000,
        retryLimit: 0,
      },
    });
    expect(request).not.toHaveProperty('intentDraftUid');
  });

  it('can repeat the selected document samples for bounded real-click top-up', () => {
    const samples = buildIntentE2EDocumentRealClickSeedSamples({
      maxSamples: 1,
      repeat: 3,
      projectUid: 'proj_default',
    });

    expect(samples).toHaveLength(3);
    expect(samples.map((sample) => sample.sampleId)).toEqual([
      'project-knowledge-document-import-preview',
      'project-knowledge-document-import-preview',
      'project-knowledge-document-import-preview',
    ]);
    expect(samples.every((sample) => sample.documentFamily === 'doc_create_reopen_verify')).toBe(true);
  });

  it('can target the current-system search-open document sample', () => {
    const [sample] = buildIntentE2EDocumentRealClickSeedSamples({
      maxSamples: 1,
      sampleIds: ['project-knowledge-document-search-open-preview'],
      projectUid: 'proj_default',
    });

    expect(sample).toMatchObject({
      sampleId: 'project-knowledge-document-search-open-preview',
      provenance: 'document_surface_current_system',
      documentFamily: 'doc_search_open_verify',
      admissibility: 'document_family_admissible',
    });

    const request = buildIntentE2EDocumentRealClickRunRequest({
      projectUid: 'proj_default',
      sample,
      timeoutMs: 1000,
    });

    expect(String(request.prefilledPlanCode)).toContain('document-search-open-seed.md');
    expect(String(request.prefilledPlanCode)).toContain("getByRole('button', { name: '预览', exact: true })");
    expect(String(request.prefilledPlanCode)).toContain("getByLabel('搜索文档块')");
    expect(request).not.toHaveProperty('intentDraftUid');
  });

  it('can target the current-system edit-save document sample', () => {
    const [sample] = buildIntentE2EDocumentRealClickSeedSamples({
      maxSamples: 1,
      sampleIds: ['project-knowledge-document-edit-save-preview'],
      projectUid: 'proj_default',
    });

    expect(sample).toMatchObject({
      sampleId: 'project-knowledge-document-edit-save-preview',
      provenance: 'document_surface_current_system',
      documentFamily: 'doc_edit_save_verify',
      admissibility: 'document_family_admissible',
    });

    const request = buildIntentE2EDocumentRealClickRunRequest({
      projectUid: 'proj_default',
      sample,
      timeoutMs: 1000,
    });

    expect(String(request.prefilledPlanCode)).toContain('document-edit-save-seed.md');
    expect(String(request.prefilledPlanCode)).toContain('真实 document-like edit save 原始锚点');
    expect(String(request.prefilledPlanCode)).toContain('真实 document-like edit save 更新锚点');
    expect(String(request.prefilledPlanCode)).toContain('没有匹配的文档块');
    expect(request).not.toHaveProperty('intentDraftUid');
  });

  it('can target the current-system archive-restore document sample', () => {
    const [sample] = buildIntentE2EDocumentRealClickSeedSamples({
      maxSamples: 1,
      sampleIds: ['project-knowledge-document-archive-restore-preview'],
      projectUid: 'proj_default',
    });

    expect(sample).toMatchObject({
      sampleId: 'project-knowledge-document-archive-restore-preview',
      provenance: 'document_surface_current_system',
      documentFamily: 'doc_archive_restore_verify',
      admissibility: 'document_family_admissible',
    });

    const request = buildIntentE2EDocumentRealClickRunRequest({
      projectUid: 'proj_default',
      sample,
      timeoutMs: 1000,
    });

    expect(String(request.prefilledPlanCode)).toContain('document-archive-restore-seed.md');
    expect(String(request.prefilledPlanCode)).toContain('真实 document-like archive restore 采集锚点');
    expect(String(request.prefilledPlanCode)).toContain('window.confirm = () => true');
    expect(String(request.prefilledPlanCode)).toContain("getByRole('button', { name: '恢复知识文档 ' + DOC_NAME, exact: true })");
    expect(request).not.toHaveProperty('intentDraftUid');
  });

  it('can target the current-system derive-capability document sample', () => {
    const [sample] = buildIntentE2EDocumentRealClickSeedSamples({
      maxSamples: 1,
      sampleIds: ['project-knowledge-document-derive-capability-preview'],
      projectUid: 'proj_default',
    });

    expect(sample).toMatchObject({
      sampleId: 'project-knowledge-document-derive-capability-preview',
      provenance: 'document_surface_current_system',
      documentFamily: 'doc_derive_capability_verify',
      admissibility: 'document_family_admissible',
    });

    const request = buildIntentE2EDocumentRealClickRunRequest({
      projectUid: 'proj_default',
      sample,
      timeoutMs: 1000,
    });

    expect(String(request.prefilledPlanCode)).toContain('document-derive-capability-seed.md');
    expect(String(request.prefilledPlanCode)).toContain('真实 document-like derive capability 采集锚点');
    expect(String(request.prefilledPlanCode)).toContain("getByRole('button', { name: '自动沉淀能力', exact: true })");
    expect(String(request.prefilledPlanCode)).toContain("getByLabel('搜索稳定能力')");
    expect(String(request.prefilledPlanCode)).toContain('商机列表按');
    expect(request).not.toHaveProperty('intentDraftUid');
  });

  it('renders report summary for the current-system document surface sample', () => {
    const [sample] = buildIntentE2EDocumentRealClickSeedSamples({ maxSamples: 1 });
    const report = buildIntentE2EDocumentRealClickSeedReport({
      generatedAt: '2026-05-07T12:00:00.000Z',
      projectUid: 'proj_default',
      dryRun: false,
      results: [
        {
          ...sample,
          launchDecision: 'auto_run',
          launchReason: '',
          runId: 'intent-run-doc-assisted',
          status: 'passed',
          errorMessage: '',
          timedOut: false,
          matchedRuleIds: ['rule_knowledge_manual'],
          matchedRecipeSlugs: ['intent.business-batch-add-contacts'],
        },
      ],
    });

    expect(report.summary).toMatchObject({
      sampleCount: 1,
      admissibleDocumentSamples: 1,
      referenceOnlyBusinessFlowSamples: 0,
      autoRunStarted: 1,
      terminalRuns: 1,
      passedRuns: 1,
    });
    expect(renderIntentE2EDocumentRealClickSeedMarkdown(report)).toContain('doc_create_reopen_verify');
  });

  it('renders report summary without turning reference-only samples into document candidates', () => {
    const sample = buildIntentE2EDocumentRealClickSeedSamples({
      maxSamples: 1,
      sampleIds: ['document-assisted-business-batch-add-contacts'],
    })[0];
    expect(sample).toBeTruthy();
    const report = buildIntentE2EDocumentRealClickSeedReport({
      generatedAt: '2026-05-07T12:00:00.000Z',
      projectUid: 'proj_default',
      dryRun: false,
      results: [
        {
          ...sample!,
          launchDecision: 'auto_run',
          launchReason: '',
          runId: 'intent-run-doc-assisted',
          status: 'passed',
          errorMessage: '',
          timedOut: false,
          matchedRuleIds: ['rule_knowledge_manual'],
          matchedRecipeSlugs: ['intent.business-batch-add-contacts'],
        },
      ],
    });

    expect(report.summary).toMatchObject({
      sampleCount: 1,
      admissibleDocumentSamples: 0,
      referenceOnlyBusinessFlowSamples: 1,
      autoRunStarted: 1,
      terminalRuns: 1,
      passedRuns: 1,
    });
    expect(renderIntentE2EDocumentRealClickSeedMarkdown(report)).toContain('document_reference_only_business_flow');
  });
});
