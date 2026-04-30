import { parseArgs } from 'node:util';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { closeDbPool } from '@/lib/db/client';
import {
  getIntentProjectRecipeBackupDir,
  getIntentProjectRecipeRegistryPath,
  importIntentProjectRecipeProfile,
  type ImportIntentProjectRecipeProfileResult,
} from '@/lib/intent-project-recipe-registry';
import {
  loadIntentE2EReleaseGuardConfig,
  preflightIntentE2EReleaseGuardConfig,
  runIntentE2EReleaseGuard,
  type IntentE2EReleaseGuardPreflightReport,
  type IntentE2EReleaseGuardReport,
} from '@/lib/intent-e2e-release-guard';

const DEFAULT_CONFIG_PATH = 'artifacts/intent-e2e-family-evidence/proj_default.release-guard.baselines.json';

const parsed = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    json: { type: 'boolean' },
    preflight: { type: 'boolean' },
    config: { type: 'string' },
    'project-uid': { type: 'string' },
    'compared-at': { type: 'string' },
    'compared-label': { type: 'string' },
    output: { type: 'string' },
    'recipe-asset-input': { type: 'string' },
  },
});

function readOptionalString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function printHelp() {
  console.log(`Intent E2E release guard

用法：
  npm run intent:release-guard -- --config <path> [options]

选项：
  --config <path>             release guard baseline 配置，默认 ${DEFAULT_CONFIG_PATH}
  --project-uid <uid>         覆盖配置里的 projectUid
  --compared-at <iso>         固定 compare 时间戳
  --compared-label <text>     覆盖本轮 compare label
  --output <path>             汇总 report 输出路径
  --recipe-asset-input <path> 覆盖配置里的 recipe asset 导入路径
  --preflight                 只校验配置与引用资产，不连接数据库、不执行 compare
  --json                      输出完整 JSON
  --help                      打印帮助

示例：
  npm run intent:release-guard -- --config ${DEFAULT_CONFIG_PATH} --json
  npm run intent:release-guard:preflight -- --json
`);
}

async function maybeImportRecipeAsset(
  projectUid: string,
  inputPath: string
): Promise<ImportIntentProjectRecipeProfileResult | null> {
  if (!inputPath) return null;
  const outputPath = getIntentProjectRecipeRegistryPath({
    projectUid,
    mode: 'write',
    legacyFallback: false,
  });
  return importIntentProjectRecipeProfile(inputPath, outputPath, getIntentProjectRecipeBackupDir(projectUid), outputPath);
}

function printSummary(report: IntentE2EReleaseGuardReport, writtenTo: string, imported: ImportIntentProjectRecipeProfileResult | null) {
  if (imported) {
    console.log(
      `recipe-asset-import: ${imported.sourcePath} -> ${imported.writtenTo} | recipes=${imported.recipeCount} | backup=${
        imported.backupPath || '-'
      }`
    );
  }
  console.log(`release-guard report: ${writtenTo}`);
  console.log(
    `summary: passed=${report.passed ? 'yes' : 'no'} baselines=${report.summary.baselineCount} passedBaselines=${report.summary.passedBaselines} failedBaselines=${report.summary.failedBaselines} totalCases=${report.summary.totalCases} regressed=${report.summary.regressedCases} missing=${report.summary.missingCases} insufficient=${report.summary.insufficientEvidenceCases}`
  );
  for (const baseline of report.baselines) {
    console.log(
      `- ${baseline.priorityScenarioFamily}: ${baseline.passed ? 'passed' : 'failed'} | benchmark=${baseline.benchmarkUid} | report=${baseline.compareReportPath} | terminal=${baseline.summary.frozenTerminalPassRate}->${baseline.summary.currentTerminalPassRate} firstPass=${baseline.summary.frozenFirstPassPassRate}->${baseline.summary.currentFirstPassPassRate} blocked=${baseline.summary.frozenBlockedRate}->${baseline.summary.currentBlockedRate}`
    );
    for (const failure of baseline.failures.slice(0, 5)) {
      console.log(`  - ${failure.scope}:${failure.failureMode}:${failure.id} ${failure.note}`);
    }
  }
}

function printPreflightSummary(report: IntentE2EReleaseGuardPreflightReport) {
  console.log(
    `release-guard preflight: passed=${report.passed ? 'yes' : 'no'} baselines=${report.baselineCount} files=${report.summary.checkedFileCount} errors=${report.summary.errorCount} warnings=${report.summary.warningCount}`
  );
  for (const issue of report.issues.slice(0, 20)) {
    const baseline = issue.baselineId ? ` baseline=${issue.baselineId}` : '';
    const targetPath = issue.path ? ` path=${issue.path}` : '';
    console.log(`- ${issue.level}:${issue.scope}:${issue.kind}${baseline}${targetPath} ${issue.message}`);
  }
}

async function main() {
  if (parsed.values.help) {
    printHelp();
    return;
  }

  const configPath = readOptionalString(parsed.values.config) || DEFAULT_CONFIG_PATH;
  const config = await loadIntentE2EReleaseGuardConfig(configPath, {
    projectUid: readOptionalString(parsed.values['project-uid']),
    comparedLabel: readOptionalString(parsed.values['compared-label']),
  });
  const recipeAssetInput = readOptionalString(parsed.values['recipe-asset-input']) || config.recipeAssetInput;
  const effectiveConfig = {
    ...config,
    recipeAssetInput,
  };

  if (parsed.values.preflight) {
    const report = preflightIntentE2EReleaseGuardConfig(effectiveConfig, {
      configPath,
      checkedAt: readOptionalString(parsed.values['compared-at']),
    });

    if (parsed.values.json) {
      console.log(JSON.stringify({ preflight: report }, null, 2));
    } else {
      printPreflightSummary(report);
    }

    if (!report.passed) {
      process.exitCode = 1;
    }
    return;
  }

  await ensureDbBootstrap();
  const importedRecipeAsset = await maybeImportRecipeAsset(effectiveConfig.projectUid, recipeAssetInput);
  const result = await runIntentE2EReleaseGuard(effectiveConfig, {
    comparedAt: readOptionalString(parsed.values['compared-at']),
    comparedLabel: readOptionalString(parsed.values['compared-label']),
    outputPath: readOptionalString(parsed.values.output),
    configPath,
  });

  if (parsed.values.json) {
    console.log(
      JSON.stringify(
        {
          ...result,
          recipeAssetImport: importedRecipeAsset,
        },
        null,
        2
      )
    );
  } else {
    printSummary(result.report, result.writtenTo, importedRecipeAsset);
  }

  if (!result.report.passed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(`[intent-e2e-release-guard] ${error.message}`);
    } else {
      console.error('[intent-e2e-release-guard] 未知错误');
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
