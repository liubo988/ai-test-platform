import { parseArgs } from 'node:util';
import {
  buildIntentE2EReleaseStatusReport,
  type IntentE2EReleaseStatusReport,
} from '@/lib/intent-e2e-release-status';

const DEFAULT_RELEASE_GUARD_CONFIG_PATH = 'artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json';
const DEFAULT_KNOWLEDGE_HIT_CONFIG_PATH = 'artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json';

const parsed = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    json: { type: 'boolean' },
    'release-config': { type: 'string' },
    'knowledge-config': { type: 'string' },
    'release-report': { type: 'string' },
    'release-report-dir': { type: 'string' },
    'generated-at': { type: 'string' },
    'require-current-compare': { type: 'boolean' },
    'skip-current-compare': { type: 'boolean' },
  },
});

function readOptionalString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function printHelp() {
  console.log(`Intent E2E release status

用法：
  npm run intent:release-status -- [options]

选项：
  --release-config <path>       release guard baseline 配置，默认 ${DEFAULT_RELEASE_GUARD_CONFIG_PATH}
  --knowledge-config <path>     knowledge-hit guard 配置，默认 ${DEFAULT_KNOWLEDGE_HIT_CONFIG_PATH}
  --release-report <path>       指定 release guard compare report；未指定时自动查找最近 report
  --release-report-dir <path>   自动查找 report 的目录
  --generated-at <iso>          固定报告时间戳
  --require-current-compare     缺少最近 release compare 时返回 blocked
  --skip-current-compare        跳过 release compare report 汇总，仅看静态证据
  --json                        输出完整 JSON
  --help                        打印帮助
`);
}

function printSummary(report: IntentE2EReleaseStatusReport) {
  console.log(
    `release status: status=${report.status} canRelease=${report.canRelease ? 'yes' : 'no'} project=${report.projectUid} checks=${report.summary.checkCount} families=${report.summary.familyCount}`
  );
  for (const check of report.checks) {
    const evidence = check.evidencePath ? ` evidence=${check.evidencePath}` : '';
    console.log(`- ${check.id}: ${check.status}${check.blocking ? ' blocking' : ''}${evidence} | ${check.message}`);
  }
  for (const family of report.families) {
    const release = family.releaseGuard
      ? `${family.releaseGuard.status} terminal=${family.releaseGuard.currentTerminalPassRate} firstPass=${family.releaseGuard.currentFirstPassPassRate}`
      : 'missing';
    const knowledge = family.knowledgeHit
      ? `${family.knowledgeHit.status} knowledge=${family.knowledgeHit.knowledgeHitRate} rules=${family.knowledgeHit.matchedRuleIds.join(',') || '-'}`
      : 'missing';
    console.log(`- family ${family.priorityScenarioFamily}: release=${release} | knowledge=${knowledge}`);
  }
}

async function main() {
  if (parsed.values.help) {
    printHelp();
    return;
  }

  const report = await buildIntentE2EReleaseStatusReport({
    releaseGuardConfigPath: readOptionalString(parsed.values['release-config']) || DEFAULT_RELEASE_GUARD_CONFIG_PATH,
    knowledgeHitConfigPath: readOptionalString(parsed.values['knowledge-config']) || DEFAULT_KNOWLEDGE_HIT_CONFIG_PATH,
    releaseGuardReportPath: readOptionalString(parsed.values['release-report']),
    releaseGuardReportDir: readOptionalString(parsed.values['release-report-dir']),
    generatedAt: readOptionalString(parsed.values['generated-at']),
    requireCurrentCompare: Boolean(parsed.values['require-current-compare']),
    skipCurrentCompare: Boolean(parsed.values['skip-current-compare']),
  });

  if (parsed.values.json) {
    console.log(JSON.stringify({ report }, null, 2));
  } else {
    printSummary(report);
  }

  if (report.status === 'blocked') {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[intent-e2e-release-status] ${error.message}`);
  } else {
    console.error('[intent-e2e-release-status] 未知错误');
  }
  process.exitCode = 1;
});
