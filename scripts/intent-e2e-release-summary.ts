import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildIntentE2EReleaseStatusReport,
  renderIntentE2EReleaseStatusMarkdown,
} from '@/lib/intent-e2e-release-status';

const DEFAULT_RELEASE_GUARD_CONFIG_PATH = 'artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json';
const DEFAULT_KNOWLEDGE_HIT_CONFIG_PATH = 'artifacts/intent-e2e-family-evidence/proj_default.knowledge-hit-guard.json';
const DEFAULT_JSON_OUT = 'reports/ci/intent-e2e-release-readiness.json';
const DEFAULT_MD_OUT = 'reports/ci/intent-e2e-release-readiness.md';

const parsed = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    json: { type: 'boolean' },
    title: { type: 'string' },
    'release-config': { type: 'string' },
    'knowledge-config': { type: 'string' },
    'release-report': { type: 'string' },
    'release-report-dir': { type: 'string' },
    'generated-at': { type: 'string' },
    'json-out': { type: 'string' },
    'md-out': { type: 'string' },
    'require-current-compare': { type: 'boolean' },
    'skip-current-compare': { type: 'boolean' },
    'github-step-summary': { type: 'boolean' },
  },
});

function readOptionalString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveOutputPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

async function writeFile(filePath: string, content: string): Promise<string> {
  const absolutePath = resolveOutputPath(filePath);
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsPromises.writeFile(absolutePath, content, 'utf8');
  return path.relative(process.cwd(), absolutePath) || absolutePath;
}

async function appendGithubStepSummary(markdown: string): Promise<void> {
  const summaryPath = readOptionalString(process.env.GITHUB_STEP_SUMMARY);
  if (!summaryPath) return;
  await fsPromises.appendFile(summaryPath, `${markdown}\n`, 'utf8');
}

function printHelp() {
  console.log(`Intent E2E release readiness summary

用法：
  npm run intent:release-summary -- [options]

选项：
  --release-config <path>       release guard baseline 配置，默认 ${DEFAULT_RELEASE_GUARD_CONFIG_PATH}
  --knowledge-config <path>     knowledge-hit guard 配置，默认 ${DEFAULT_KNOWLEDGE_HIT_CONFIG_PATH}
  --release-report <path>       指定 release guard compare report；未指定时自动查找最近 report
  --release-report-dir <path>   自动查找 report 的目录
  --generated-at <iso>          固定报告时间戳
  --require-current-compare     缺少最近 release compare 时返回 blocked
  --skip-current-compare        跳过 release compare report 汇总，仅看静态证据
  --json-out <path>             写出 JSON 摘要，默认 ${DEFAULT_JSON_OUT}
  --md-out <path>               写出 Markdown 摘要，默认 ${DEFAULT_MD_OUT}
  --title <text>                Markdown 标题
  --github-step-summary         同步追加 Markdown 到 GitHub Actions step summary
  --json                        同时向 stdout 输出完整 JSON
  --help                        打印帮助
`);
}

async function main() {
  if (parsed.values.help) {
    printHelp();
    return;
  }

  const jsonOut = readOptionalString(parsed.values['json-out']) || DEFAULT_JSON_OUT;
  const mdOut = readOptionalString(parsed.values['md-out']) || DEFAULT_MD_OUT;
  const report = await buildIntentE2EReleaseStatusReport({
    releaseGuardConfigPath: readOptionalString(parsed.values['release-config']) || DEFAULT_RELEASE_GUARD_CONFIG_PATH,
    knowledgeHitConfigPath: readOptionalString(parsed.values['knowledge-config']) || DEFAULT_KNOWLEDGE_HIT_CONFIG_PATH,
    releaseGuardReportPath: readOptionalString(parsed.values['release-report']),
    releaseGuardReportDir: readOptionalString(parsed.values['release-report-dir']),
    generatedAt: readOptionalString(parsed.values['generated-at']),
    requireCurrentCompare: Boolean(parsed.values['require-current-compare']),
    skipCurrentCompare: Boolean(parsed.values['skip-current-compare']),
  });
  const markdown = renderIntentE2EReleaseStatusMarkdown(report, {
    title: readOptionalString(parsed.values.title) || 'Intent E2E Release Readiness',
    generatedBy: 'scripts/intent-e2e-release-summary.ts',
  });

  const writtenJson = await writeFile(jsonOut, `${JSON.stringify({ report }, null, 2)}\n`);
  const writtenMarkdown = await writeFile(mdOut, markdown);

  if (parsed.values['github-step-summary']) {
    await appendGithubStepSummary(markdown);
  }

  if (parsed.values.json) {
    console.log(JSON.stringify({ report }, null, 2));
  } else {
    console.log(`release readiness summary: ${writtenMarkdown}`);
    console.log(`release readiness json: ${writtenJson}`);
    console.log(
      `summary: status=${report.status} canRelease=${report.canRelease ? 'yes' : 'no'} checks=${report.summary.passedChecks}/${report.summary.checkCount} families=${report.summary.readyFamilies}/${report.summary.familyCount} currentCompare=${report.currentCompare.status}`
    );
  }

  if (report.status === 'blocked') {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[intent-e2e-release-summary] ${error.message}`);
  } else {
    console.error('[intent-e2e-release-summary] 未知错误');
  }
  process.exitCode = 1;
});
