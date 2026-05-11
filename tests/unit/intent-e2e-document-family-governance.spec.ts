import { describe, expect, it } from 'vitest';
import {
  buildIntentE2EDocumentFamilyGovernanceReport,
  getIntentE2EDocumentFamilyGovernanceProfile,
  renderIntentE2EDocumentFamilyGovernanceMarkdown,
  resolveIntentE2EDocumentFamilyGovernanceStatus,
} from '@/lib/intent-e2e-document-family-governance';

describe('intent e2e document family governance', () => {
  it('exposes the doc_create_reopen_verify recipe, fixture, and verifier contract', () => {
    const profile = getIntentE2EDocumentFamilyGovernanceProfile('doc_create_reopen_verify');

    expect(profile).toMatchObject({
      family: 'doc_create_reopen_verify',
      status: 'contract_ready',
      recipeSlugs: ['document.project-knowledge-import-preview'],
      sampleContract: {
        source: 'real_click',
        attachment: 'without_image',
      },
    });
    expect(profile?.fixtureContract.requiredFields.join('\n')).toContain('knowledgeDocumentName');
    expect(profile?.verifierContract.requiredEvidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining('knowledge_import_notice'),
        expect.stringContaining('current_preview_document_name'),
        expect.stringContaining('document_chunk_body_anchor'),
      ])
    );
    expect(profile?.verifierContract.forbiddenEvidence.join('\n')).toContain('textarea');
  });

  it('exposes the doc_search_open_verify recipe, fixture, and verifier contract', () => {
    const profile = getIntentE2EDocumentFamilyGovernanceProfile('doc_search_open_verify');

    expect(profile).toMatchObject({
      family: 'doc_search_open_verify',
      status: 'contract_ready',
      recipeSlugs: ['document.project-knowledge-search-open-preview'],
      fixtureContract: {
        fixtureId: 'project-knowledge-document-search-open-preview-v1',
      },
      sampleContract: {
        source: 'real_click',
        attachment: 'without_image',
      },
    });
    expect(profile?.verifierContract.requiredEvidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining('current_preview_document_name'),
        expect.stringContaining('document_chunk_search_input'),
        expect.stringContaining('document_chunk_body_anchor'),
      ])
    );
    expect(profile?.verifierContract.forbiddenEvidence.join('\n')).toContain('fixture setup');
  });

  it('exposes the doc_edit_save_verify recipe, fixture, and verifier contract', () => {
    const profile = getIntentE2EDocumentFamilyGovernanceProfile('doc_edit_save_verify');

    expect(profile).toMatchObject({
      family: 'doc_edit_save_verify',
      status: 'contract_ready',
      recipeSlugs: ['document.project-knowledge-edit-save-preview'],
      fixtureContract: {
        fixtureId: 'project-knowledge-document-edit-save-preview-v1',
      },
      sampleContract: {
        source: 'real_click',
        attachment: 'without_image',
      },
    });
    expect(profile?.verifierContract.requiredEvidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining('original_document_chunk_body_anchor'),
        expect.stringContaining('old_anchor_no_match_after_save'),
        expect.stringContaining('updated_document_chunk_body_anchor'),
      ])
    );
    expect(profile?.verifierContract.forbiddenEvidence.join('\n')).toContain('textarea');
  });

  it('exposes the doc_archive_restore_verify recipe, fixture, and verifier contract', () => {
    const profile = getIntentE2EDocumentFamilyGovernanceProfile('doc_archive_restore_verify');

    expect(profile).toMatchObject({
      family: 'doc_archive_restore_verify',
      status: 'contract_ready',
      recipeSlugs: ['document.project-knowledge-archive-restore-preview'],
      fixtureContract: {
        fixtureId: 'project-knowledge-document-archive-restore-preview-v1',
      },
      sampleContract: {
        source: 'real_click',
        attachment: 'without_image',
      },
    });
    expect(profile?.verifierContract.requiredEvidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining('archive_notice'),
        expect.stringContaining('archived_status_badge'),
        expect.stringContaining('restore_notice'),
        expect.stringContaining('restored_document_chunk_body_anchor'),
      ])
    );
    expect(profile?.verifierContract.forbiddenEvidence.join('\n')).toContain('toast');
  });

  it('exposes the doc_derive_capability_verify recipe, fixture, and verifier contract', () => {
    const profile = getIntentE2EDocumentFamilyGovernanceProfile('doc_derive_capability_verify');

    expect(profile).toMatchObject({
      family: 'doc_derive_capability_verify',
      status: 'contract_ready',
      recipeSlugs: ['document.project-knowledge-derive-capability-preview'],
      fixtureContract: {
        fixtureId: 'project-knowledge-document-derive-capability-preview-v1',
      },
      sampleContract: {
        source: 'real_click',
        attachment: 'without_image',
      },
    });
    expect(profile?.verifierContract.requiredEvidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining('derive_capability_notice'),
        expect.stringContaining('derived_capability_catalog_item'),
        expect.stringContaining('derived_capability_verification_status'),
      ])
    );
    expect(profile?.verifierContract.forbiddenEvidence.join('\n')).toContain('历史');
  });

  it('builds a report that separates governed and missing document candidates', () => {
    const report = buildIntentE2EDocumentFamilyGovernanceReport({
      projectUid: 'proj_default',
      candidateFamilies: [
        'doc_create_reopen_verify',
        'doc_search_open_verify',
        'doc_edit_save_verify',
        'doc_archive_restore_verify',
        'doc_derive_capability_verify',
        'doc_export_verify',
      ],
      generatedAt: '2026-05-08T08:00:00.000Z',
    });

    expect(report.sourcePolicy).toBe('post_instrumentation_real_click_only');
    expect(report.governedFamilies).toEqual([
      'doc_create_reopen_verify',
      'doc_search_open_verify',
      'doc_edit_save_verify',
      'doc_archive_restore_verify',
      'doc_derive_capability_verify',
    ]);
    expect(report.missingFamilies).toEqual(['doc_export_verify']);
    expect(resolveIntentE2EDocumentFamilyGovernanceStatus('doc_create_reopen_verify')).toBe('contract_ready');
    expect(resolveIntentE2EDocumentFamilyGovernanceStatus('doc_search_open_verify')).toBe('contract_ready');
    expect(resolveIntentE2EDocumentFamilyGovernanceStatus('doc_edit_save_verify')).toBe('contract_ready');
    expect(resolveIntentE2EDocumentFamilyGovernanceStatus('doc_archive_restore_verify')).toBe('contract_ready');
    expect(resolveIntentE2EDocumentFamilyGovernanceStatus('doc_derive_capability_verify')).toBe('contract_ready');
    expect(resolveIntentE2EDocumentFamilyGovernanceStatus('doc_export_verify')).toBe('missing');
  });

  it('renders markdown with policy notes and stop conditions', () => {
    const markdown = renderIntentE2EDocumentFamilyGovernanceMarkdown(
      buildIntentE2EDocumentFamilyGovernanceReport({
        projectUid: 'proj_default',
        candidateFamilies: ['doc_create_reopen_verify'],
        generatedAt: '2026-05-08T08:00:00.000Z',
      })
    );

    expect(markdown).toContain('# Intent E2E Document Family Governance');
    expect(markdown).toContain('document.project-knowledge-import-preview');
    expect(markdown).toContain('post_instrumentation_real_click_only');
    expect(markdown).toContain('不混用 benchmark_rerun / replay / draft_import');
    expect(markdown).toContain('## Stop Conditions');
  });
});
