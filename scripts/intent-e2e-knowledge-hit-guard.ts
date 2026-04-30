import { parseArgs } from 'node:util';
import {
  loadIntentE2EKnowledgeHitGuardConfig,
  runIntentE2EKnowledgeHitGuard,
  type IntentE2EKnowledgeHitGuardReport,
} from '@/lib/intent-e2e-knowledge-hit-guard';

const DEFAULT_CONFIG_PATH = 'artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json';

const parsed = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    json: { type: 'boolean' },
    config: { type: 'string' },
    'generated-at': { type: 'string' },
  },
});

function readOptionalString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function printHelp() {
  console.log(`Intent E2E knowledge-hit guard

用法：
  npm run intent:knowledge-hit-guard -- --config <path> [options]

选项：
  --config <path>       knowledge-hit guard 配置，默认 ${DEFAULT_CONFIG_PATH}
  --generated-at <iso>  固定报告时间戳
  --json                输出完整 JSON
  --help                打印帮助
`);
}

function printSummary(report: IntentE2EKnowledgeHitGuardReport) {
  console.log(
    `knowledge-hit guard: passed=${report.passed ? 'yes' : 'no'} evidences=${report.summary.evidenceCount} passedEvidences=${report.summary.passedEvidences} failedEvidences=${report.summary.failedEvidences} missingRules=${report.summary.missingRuleCount}`
  );
  for (const item of report.evidences) {
    console.log(
      `- ${item.priorityScenarioFamily}: ${item.passed ? 'passed' : 'failed'} | rules=${item.matchedRuleIds.join(', ') || '-'} | knowledgeHitRate=${item.knowledgeHitRate} | evidence=${item.evidencePath}`
    );
    for (const failure of item.failures.slice(0, 5)) {
      console.log(`  - ${failure}`);
    }
  }
}

async function main() {
  if (parsed.values.help) {
    printHelp();
    return;
  }

  const configPath = readOptionalString(parsed.values.config) || DEFAULT_CONFIG_PATH;
  const config = await loadIntentE2EKnowledgeHitGuardConfig(configPath);
  const report = runIntentE2EKnowledgeHitGuard(config, {
    configPath,
    generatedAt: readOptionalString(parsed.values['generated-at']),
  });

  if (parsed.values.json) {
    console.log(JSON.stringify({ report }, null, 2));
  } else {
    printSummary(report);
  }

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[intent-e2e-knowledge-hit-guard] ${error.message}`);
  } else {
    console.error('[intent-e2e-knowledge-hit-guard] 未知错误');
  }
  process.exitCode = 1;
});
