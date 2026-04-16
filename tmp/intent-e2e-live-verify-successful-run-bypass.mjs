import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { getIntentE2ERunSnapshotByRunId, getProjectByUid } from '@/lib/db/repository';
import {
  createIntentE2ERun,
  getIntentE2ERun,
  startIntentE2ERun,
  waitForIntentE2ERunCompletion,
} from '@/lib/ai/intent-e2e-run-registry';

await ensureDbBootstrap();

const sourceRunId = 'intent-run-5a5f0192-f6b7-4bb7-806f-aa5e999e78b4';
const projectUid = 'proj_default';
const moduleUid = 'mod_1772873197821_013a6511';
const intentDraftUid = 'idraft_1775712279251_899fd4fd';

const project = await getProjectByUid(projectUid);
if (!project) {
  throw new Error(`project not found: ${projectUid}`);
}

const sourceSnapshot = await getIntentE2ERunSnapshotByRunId(sourceRunId);
const sourceState =
  sourceSnapshot?.state && typeof sourceSnapshot.state === 'object' && !Array.isArray(sourceSnapshot.state)
    ? sourceSnapshot.state
    : null;
const sourceResult =
  sourceState?.result && typeof sourceState.result === 'object' && !Array.isArray(sourceState.result)
    ? sourceState.result
    : null;
const scenarioCard =
  sourceResult?.scenarioCard && typeof sourceResult.scenarioCard === 'object' && !Array.isArray(sourceResult.scenarioCard)
    ? sourceResult.scenarioCard
    : null;

if (!scenarioCard) {
  throw new Error(`scenarioCard missing from ${sourceRunId}`);
}

const request = {
  input: [
    '从订单列表中选择一条状态为“待申请入账”的订单（点击顶部“展开”按钮，“请选择入账状态”下拉搜索框选择“待申请”选项，然后点击“搜 索”按钮）。注意：分辨率调高一些，否则“全部”行title这行数据可能一直左右滑动，造成“定位器漂移”。随便选择一行或多行刚才搜索到的结果数据，选中这些行前面的“多选框”勾选该订单后，然后点击页面表头的按钮：“批量入账” 按钮进入“批量申请入账”弹窗，不要假设存在行内申请入账按钮。弹窗中通常已默认带出服务项和入账金额，点击“确 定”按钮（确认按钮文案为“确 定”）。提交后进入“入账管理”页面（页面地址：https://uat-service.yikaiye.com/#/payment/bookedMgmt），用 placeholder 为“请输入关键词”的筛选框搜索订单号，验证入账记录存在。',
    '补充说明：本轮只验证最新 Step 7 lookup timeout 收紧后的真实执行耗时，不复用旧成功脚本。',
  ].join('\n'),
  targetUrl: 'https://uat-service.yikaiye.com/#/order/list',
  projectUid,
  moduleUid,
  intentDraftUid,
  cicdProfile: 'manual',
  auth: {
    loginUrl: project.loginUrl || '',
    username: project.loginUsername || '',
    password: project.loginPasswordPlain || '',
    loginDescription: project.loginDescription || '',
  },
  runtimeGovernance: {
    credential: {
      source: 'project',
      secretRef: `project://${projectUid}/auth/default`,
      accountRef: `account://project/${projectUid}/${project.loginUsername || 'default'}`,
      sessionMode: 'shared',
    },
  },
  prefilledScenarioCard: scenarioCard,
  llmConfig: {
    provider: 'openai',
    model: 'gpt-5.3-codex',
    apiStyle: 'responses',
    visionEnabled: true,
    selfHealRetries: 0,
    maxPlanSteps: 8,
  },
  runControl: {
    timeoutMs: 240000,
    retryLimit: 0,
    priority: 'normal',
  },
};

const created = createIntentE2ERun(request);
console.log(
  JSON.stringify(
    {
      phase: 'created',
      runId: created.runId,
      sourceRunId,
      successfulRunReuseDisabled: process.env.INTENT_E2E_DISABLE_RECENT_SUCCESSFUL_RUN_REUSE || '',
    },
    null,
    2
  )
);

startIntentE2ERun(created.runId, request);
await waitForIntentE2ERunCompletion(created.runId);

const finished = getIntentE2ERun(created.runId);
const finishedState = finished?.state || null;
const finishedResult =
  finishedState?.result && typeof finishedState.result === 'object' && !Array.isArray(finishedState.result)
    ? finishedState.result
    : null;
const attempts = Array.isArray(finishedResult?.attempts) ? finishedResult.attempts : [];
const lastAttempt = attempts[attempts.length - 1] || null;
const stepDurations = Array.isArray(lastAttempt?.result?.steps)
  ? lastAttempt.result.steps
      .filter((step) => step?.status === 'passed')
      .map((step) => ({
        title: step.title,
        duration: step.duration,
      }))
  : [];

console.log(
  JSON.stringify(
    {
      phase: 'completed',
      runId: created.runId,
      status: finishedState?.status || null,
      stage: finishedState?.stage || null,
      success: finishedResult?.finalResult?.success ?? null,
      error: finishedResult?.finalResult?.error ?? finishedState?.error ?? null,
      prefilledPlanReuseSource: lastAttempt?.fallbackTelemetry?.prefilledPlanReuseSource || null,
      prefilledPlanSkipReason: lastAttempt?.fallbackTelemetry?.prefilledPlanSkipReason || null,
      reusedRunId: lastAttempt?.fallbackTelemetry?.reusedRunId || null,
      attemptCount: attempts.length,
      stepDurations,
    },
    null,
    2
  )
);
