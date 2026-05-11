import { describe, expect, it } from 'vitest';
import {
  buildIntentE2EFormalTaskRealClickSeedPlan,
  buildIntentE2EFormalTaskSeedAuditReport,
  renderIntentE2EFormalTaskSeedAuditMarkdown,
  type IntentE2EFormalTaskSeedAuditTask,
} from '@/lib/intent-e2e-formal-task-seed-audit';

function makeTask(override: Partial<IntentE2EFormalTaskSeedAuditTask> = {}): IntentE2EFormalTaskSeedAuditTask {
  return {
    configUid: 'cfg_1',
    moduleUid: 'mod_1',
    name: '商机222',
    moduleName: '商机管理',
    targetUrl: 'https://uat-service.yikaiye.com/#/business/businesslist',
    taskMode: 'scenario',
    featureDescription: '登录后台后在商机列表页发起新建商机并保存，校验新建商机记录出现在列表中且商机进展为新入库。',
    latestExecutionUid: 'exec_1',
    latestExecutionStatus: 'passed',
    sourceIntentDraftUid: 'idraft_1',
    sourceIntentDraftTitle: '商机222',
    flowStepCount: 6,
    latestExecutions: [
      {
        executionUid: 'exec_1',
        status: 'passed',
        startedAt: '2026-05-07T00:00:00.000Z',
        endedAt: '2026-05-07T00:01:00.000Z',
        errorMessage: '',
      },
    ],
    ...override,
  };
}

describe('intent e2e formal task seed audit', () => {
  it('marks current-system passed formal tasks as seed-only candidates without changing real-click policy', () => {
    const report = buildIntentE2EFormalTaskSeedAuditReport({
      projectUid: 'proj_default',
      generatedAt: '2026-05-07T01:00:00.000Z',
      tasks: [makeTask()],
    });

    expect(report.sourcePolicy).toBe('formal_task_seed_only');
    expect(report.denominatorPolicy).toContain('不能进入 traffic-quality real_click 分母');
    expect(report.summary).toMatchObject({
      formalTaskCount: 1,
      currentSystemTaskCount: 1,
      tasksWithPassedExecutionCount: 1,
      seedEligibleCount: 1,
      documentLikeSeedEligibleCount: 0,
    });
    expect(report.recommendedSeedCandidates[0]).toMatchObject({
      name: '商机222',
      seedEligible: true,
      priorityScenarioFamily: 'business_create_list_verify',
    });
  });

  it('keeps out-of-scope document-like formal tasks out of current-system seed candidates', () => {
    const report = buildIntentE2EFormalTaskSeedAuditReport({
      projectUid: 'proj_default',
      tasks: [
        makeTask({
          configUid: 'cfg_doc',
          name: '企业微信文档编辑保存',
          targetUrl: 'https://docs.qq.com/doc/edit',
          featureDescription: '进入企业微信文档编辑页，修改文档标题与正文内容并触发保存。',
        }),
      ],
    });

    expect(report.summary.outOfScopeTaskCount).toBe(1);
    expect(report.summary.seedEligibleCount).toBe(0);
    expect(report.summary.documentLikeSeedEligibleCount).toBe(0);
    expect(report.candidates[0]).toMatchObject({
      documentFamily: 'doc_edit_save_verify',
      seedEligible: false,
    });
    expect(report.candidates[0].seedBlockedReasons.join('\n')).toContain('targetUrl host is not in current-system scope');
  });

  it('renders seed and document candidate sections in markdown', () => {
    const report = buildIntentE2EFormalTaskSeedAuditReport({
      projectUid: 'proj_default',
      tasks: [makeTask()],
    });
    const markdown = renderIntentE2EFormalTaskSeedAuditMarkdown(report);

    expect(markdown).toContain('# Intent E2E Formal Task Seed Audit');
    expect(markdown).toContain('sourcePolicy: formal_task_seed_only');
    expect(markdown).toContain('商机222');
    expect(markdown).toContain('## Document-Like Formal Task Candidates');
    expect(markdown).toContain('- None');
  });

  it('routes formal batch-add-contacts tasks with business wording into the tracked family', () => {
    const report = buildIntentE2EFormalTaskSeedAuditReport({
      projectUid: 'proj_default',
      tasks: [
        makeTask({
          configUid: 'cfg_batch',
          name: '商机列表批量加入通讯录并校验结果',
          featureDescription:
            '进入商机列表页，随机勾选一条包含联系人手机号的商机并点击【批量加入通讯录】按钮。操作完成后进入【我的通讯录】列表，使用该商机联系人手机号进行搜索，并校验可以查询到对应联系人记录。',
        }),
      ],
    });

    expect(report.candidates[0]).toMatchObject({
      priorityScenarioFamily: 'business_batch_add_contacts_verify',
      seedEligible: true,
    });
  });

  it('builds repeatable real-click seed plans from filtered formal task candidates', () => {
    const plan = buildIntentE2EFormalTaskRealClickSeedPlan({
      projectUid: 'proj_default',
      priorityScenarioFamily: 'modal_or_drawer_save',
      maxSamples: 3,
      repeat: 2,
      tasks: [
        makeTask({
          configUid: 'cfg_modal',
          moduleUid: 'mod_commission',
          name: '修改分佣配置',
          targetUrl: 'https://uat-service.yikaiye.com/#/commission/subCommissionConfig',
          featureDescription: '按关键词379搜索目标服务，打开结果行“分佣配置”弹框，将“商机创建人”佣金比例修改为35%，点击保存并校验成功提示及弹框关闭。',
        }),
        makeTask({
          configUid: 'cfg_business',
          moduleUid: 'mod_business',
          name: '商机222',
        }),
      ],
    });

    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({
      configUid: 'cfg_modal',
      moduleUid: 'mod_commission',
      priorityScenarioFamily: 'modal_or_drawer_save',
      repeatIndex: 1,
    });
    expect(plan[1]).toMatchObject({
      sampleId: 'cfg_modal-r2',
      repeatIndex: 2,
    });
    expect(plan[0].input).toContain('参考已跑通正式任务');
  });
});
