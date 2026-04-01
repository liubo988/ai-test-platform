import { describe, expect, it } from 'vitest';

import {
  extractIntentImportPlatformSummaryFromArtifactMeta,
  extractIntentImportPlatformSummaryFromPrompt,
  extractIntentImportRunIdFromArtifactMeta,
  extractIntentImportRunIdFromPrompt,
  extractIntentImportStatusFromArtifactMeta,
  normalizeIntentImportStatusFromActionType,
} from '@/lib/intent-e2e-import';
import {
  buildArtifactPlatformMaterializedQuery,
  buildPlatformMaterializedQueryIndex,
  buildPlatformMaterializedQuery,
  buildPromptPlatformMaterializedQuery,
  normalizePlatformMaterializedQueryIndex,
  normalizePlatformMaterializedQuery,
  resolvePlatformQueryFilters,
} from '@/lib/test-platform-query-contract';

describe('intent-e2e-import', () => {
  it('extracts runId from an intent import generation prompt', () => {
    expect(
      extractIntentImportRunIdFromPrompt(
        ['[intent_e2e_import] runId=intent-run-123', '用户输入：访问结算页并提交订单'].join('\n')
      )
    ).toBe('intent-run-123');
  });

  it('returns empty when the prompt is not an intent import prompt', () => {
    expect(extractIntentImportRunIdFromPrompt('[AI纠错] 原执行: exec_1')).toBe('');
    expect(extractIntentImportRunIdFromPrompt(null)).toBe('');
  });

  it('normalizes import status from activity action types', () => {
    expect(normalizeIntentImportStatusFromActionType('plan_imported_passed')).toBe('passed');
    expect(normalizeIntentImportStatusFromActionType('plan_imported_failed')).toBe('failed');
    expect(normalizeIntentImportStatusFromActionType('config_updated')).toBe('');
  });

  it('extracts runId and status from execution artifact metadata', () => {
    expect(
      extractIntentImportRunIdFromArtifactMeta({
        fileName: 'intent-pass.spec.ts',
        importedFromRunId: 'intent-run-456',
        success: true,
      })
    ).toBe('intent-run-456');
    expect(extractIntentImportStatusFromArtifactMeta({ success: true })).toBe('passed');
    expect(extractIntentImportStatusFromArtifactMeta({ success: false })).toBe('failed');
    expect(extractIntentImportStatusFromArtifactMeta({})).toBe('');
  });

  it('extracts platform summary from an intent import generation prompt', () => {
    expect(
      extractIntentImportPlatformSummaryFromPrompt(
        [
          '[intent_e2e_import] runId=intent-run-123',
          '平台测试类型：browser_e2e',
          '平台执行器：playwright_runner',
          '平台用例资产：tc_123',
          '平台规格资产：ts_123',
          '平台验收契约：vc_123',
          '平台验收策略：前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。',
          '平台验收策略：校验结果以最终成功提示为准。',
          '平台产物类型：scenario_card / final_result / screenshot',
        ].join('\n')
      )
    ).toEqual({
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      testCaseId: 'tc_123',
      testSpecId: 'ts_123',
      verificationContractId: 'vc_123',
      artifactKinds: ['scenario_card', 'final_result', 'screenshot'],
      verificationPolicyNotes: [
        '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。',
        '校验结果以最终成功提示为准。',
      ],
    });
    expect(extractIntentImportPlatformSummaryFromPrompt('[intent_e2e_import] runId=intent-run-123')).toBeNull();
  });

  it('extracts platform summary from execution artifact metadata', () => {
    expect(
      extractIntentImportPlatformSummaryFromArtifactMeta({
        platformAssetBundle: {
          testType: 'browser_e2e',
          runnerType: 'playwright_runner',
          testCase: { caseId: 'tc_123' },
          testSpec: { specId: 'ts_123' },
          verificationContract: {
            contractId: 'vc_123',
            typeFields: {
              policyNotes: [
                '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。',
                '校验结果以最终成功提示为准。',
              ],
            },
          },
          artifactContract: { artifactKinds: ['scenario_card', 'final_result'] },
        },
      })
    ).toEqual({
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      testCaseId: 'tc_123',
      testSpecId: 'ts_123',
      verificationContractId: 'vc_123',
      artifactKinds: ['scenario_card', 'final_result'],
      verificationPolicyNotes: [
        '前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。',
        '校验结果以最终成功提示为准。',
      ],
    });
    expect(
      extractIntentImportPlatformSummaryFromArtifactMeta({
        fileName: 'api-flow.json',
        success: true,
        platformMeta: {
          testType: 'api_flow',
          runnerType: 'http_runner',
          testCaseId: 'tc_api_1',
          testSpecId: 'ts_api_1',
          verificationContractId: 'vc_api_1',
          artifactKinds: ['final_result', 'request_log'],
          verificationPolicyNotes: ['前置检查策略：API 创建流程允许空列表继续校验新增结果。'],
        },
      })
    ).toEqual({
      testType: 'api_flow',
      runnerType: 'http_runner',
      testCaseId: 'tc_api_1',
      testSpecId: 'ts_api_1',
      verificationContractId: 'vc_api_1',
      artifactKinds: ['final_result', 'request_log'],
      verificationPolicyNotes: ['前置检查策略：API 创建流程允许空列表继续校验新增结果。'],
    });
    expect(extractIntentImportPlatformSummaryFromArtifactMeta({})).toBeNull();
  });

  it('materializes a stable platform query payload', () => {
    expect(
      buildPlatformMaterializedQuery({
        source: 'latest_plan_prompt',
        importedFromRunId: 'intent-run-1',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_1',
        testSpecId: 'ts_1',
        verificationContractId: 'vc_1',
        artifactKinds: ['scenario_card', 'final_result'],
        verificationPolicyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。'],
      })
    ).toEqual({
      version: 1,
      source: 'latest_plan_prompt',
      importedFromRunId: 'intent-run-1',
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      testCaseId: 'tc_1',
      testSpecId: 'ts_1',
      verificationContractId: 'vc_1',
      artifactKinds: ['scenario_card', 'final_result'],
      verificationPolicyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。'],
      imported: true,
      platformTagged: true,
    });

    expect(
      buildPlatformMaterializedQuery({
        source: 'execution_artifact_meta',
        importedFromRunId: 'intent-run-legacy-1',
      })
    ).toEqual({
      version: 1,
      source: 'execution_artifact_meta',
      importedFromRunId: 'intent-run-legacy-1',
      testType: '',
      runnerType: '',
      testCaseId: '',
      testSpecId: '',
      verificationContractId: '',
      artifactKinds: [],
      verificationPolicyNotes: [],
      imported: true,
      platformTagged: false,
    });
  });

  it('resolves platform query filters for combined and legacy contracts', () => {
    expect(
      resolvePlatformQueryFilters({
        platformTestType: ' browser_e2e ',
        platformRunnerType: ' playwright_runner ',
        platformArtifactKind: ' screenshot ',
        platformContractIdType: 'test_spec',
        platformContractId: ' ts_contract ',
        platformTestCaseId: 'tc_legacy',
        platformTestSpecId: 'ts_legacy',
        platformVerificationContractId: 'vc_legacy',
      })
    ).toEqual({
      platformTestType: 'browser_e2e',
      platformRunnerType: 'playwright_runner',
      platformArtifactKind: 'screenshot',
      platformTestCaseId: '',
      platformTestSpecId: 'ts_contract',
      platformVerificationContractId: '',
    });

    expect(
      resolvePlatformQueryFilters({
        platformArtifactKind: ' final_result ',
        platformTestCaseId: ' tc_legacy ',
        platformVerificationContractId: ' vc_legacy ',
      })
    ).toEqual({
      platformTestType: '',
      platformRunnerType: '',
      platformArtifactKind: 'final_result',
      platformTestCaseId: 'tc_legacy',
      platformTestSpecId: '',
      platformVerificationContractId: 'vc_legacy',
    });
  });

  it('builds prompt-side and artifact-side materialized queries from stable helpers', () => {
    expect(
      buildPromptPlatformMaterializedQuery(
        [
          '[intent_e2e_import] runId=intent-run-123',
          '平台测试类型：browser_e2e',
          '平台执行器：playwright_runner',
          '平台用例资产：tc_123',
          '平台规格资产：ts_123',
          '平台验收契约：vc_123',
          '平台验收策略：前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。',
          '平台产物类型：scenario_card / final_result',
        ].join('\n')
      )
    ).toEqual({
      version: 1,
      source: 'latest_plan_prompt',
      importedFromRunId: 'intent-run-123',
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      testCaseId: 'tc_123',
      testSpecId: 'ts_123',
      verificationContractId: 'vc_123',
      artifactKinds: ['scenario_card', 'final_result'],
      verificationPolicyNotes: ['前置检查策略：创建型流程允许列表页空态绕过 data_missing 阻断，继续确认是否存在可用新建入口。'],
      imported: true,
      platformTagged: true,
    });

    expect(
      buildArtifactPlatformMaterializedQuery(
        {
          platformMeta: {
            testType: 'api_flow',
            runnerType: 'http_runner',
            testCaseId: 'tc_321',
            testSpecId: 'ts_321',
            verificationContractId: 'vc_321',
            verificationPolicyNotes: ['前置检查策略：API 创建流程允许空列表继续校验新增结果。'],
            artifactKinds: ['final_result'],
          },
        },
        {
          importedFromRunId: 'intent-run-fallback',
          testType: 'browser_e2e',
          runnerType: 'playwright_runner',
          testSpecId: 'ts_fallback',
          verificationContractId: 'vc_fallback',
          verificationPolicyNotes: ['fallback policy'],
        }
      )
    ).toEqual({
      version: 1,
      source: 'execution_artifact_meta',
      importedFromRunId: 'intent-run-fallback',
      testType: 'api_flow',
      runnerType: 'http_runner',
      testCaseId: 'tc_321',
      testSpecId: 'ts_321',
      verificationContractId: 'vc_321',
      artifactKinds: ['final_result'],
      verificationPolicyNotes: ['前置检查策略：API 创建流程允许空列表继续校验新增结果。'],
      imported: true,
      platformTagged: true,
    });
  });

  it('normalizes and rejects invalid materialized platform query payloads', () => {
    expect(
      normalizePlatformMaterializedQuery({
        source: 'execution_artifact_meta',
        importedFromRunId: 'intent-run-2',
        testType: 'browser_e2e',
        runnerType: 'playwright_runner',
        testCaseId: 'tc_2',
        artifactKinds: ['scenario_card', 'scenario_card', 'final_result'],
        verificationPolicyNotes: ['  policy a  ', 'policy a', 'policy b'],
      })
    ).toEqual({
      version: 1,
      source: 'execution_artifact_meta',
      importedFromRunId: 'intent-run-2',
      testType: 'browser_e2e',
      runnerType: 'playwright_runner',
      testCaseId: 'tc_2',
      testSpecId: '',
      verificationContractId: '',
      artifactKinds: ['scenario_card', 'final_result'],
      verificationPolicyNotes: ['policy a', 'policy b'],
      imported: true,
      platformTagged: true,
    });

    expect(normalizePlatformMaterializedQuery({ source: 'unknown' })).toBeNull();
  });

  it('builds and normalizes a platform query index', () => {
    expect(
      buildPlatformMaterializedQueryIndex(
        [
          buildPlatformMaterializedQuery({
            source: 'latest_plan_prompt',
            importedFromRunId: 'intent-run-1',
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
            testCaseId: 'tc_1',
            testSpecId: 'ts_1',
            verificationContractId: 'vc_1',
            artifactKinds: ['scenario_card'],
          }),
          buildPlatformMaterializedQuery({
            source: 'latest_plan_prompt',
            importedFromRunId: 'intent-run-2',
            testType: 'browser_e2e',
            runnerType: 'playwright_runner',
            testCaseId: 'tc_1',
            testSpecId: 'ts_2',
            verificationContractId: 'vc_1',
            artifactKinds: ['final_result'],
          }),
          buildPlatformMaterializedQuery({
            source: 'execution_artifact_meta',
            importedFromRunId: 'intent-run-3',
          }),
        ],
        3
      )
    ).toEqual({
      scopeCount: 3,
      importedCount: 3,
      platformTaggedCount: 2,
      bySource: [
        { source: 'latest_plan_prompt', count: 2 },
        { source: 'execution_artifact_meta', count: 1 },
      ],
      byTestCaseId: [{ id: 'tc_1', count: 2 }],
      byTestSpecId: [
        { id: 'ts_1', count: 1 },
        { id: 'ts_2', count: 1 },
      ],
      byVerificationContractId: [{ id: 'vc_1', count: 2 }],
    });

    expect(
      normalizePlatformMaterializedQueryIndex({
        scopeCount: 2,
        importedCount: 2,
        platformTaggedCount: 1,
        bySource: [{ source: 'execution_artifact_meta', count: 2 }],
        byTestCaseId: [{ id: 'tc_9', count: 1 }],
      })
    ).toEqual({
      scopeCount: 2,
      importedCount: 2,
      platformTaggedCount: 1,
      bySource: [{ source: 'execution_artifact_meta', count: 2 }],
      byTestCaseId: [{ id: 'tc_9', count: 1 }],
      byTestSpecId: [],
      byVerificationContractId: [],
    });
  });
});
