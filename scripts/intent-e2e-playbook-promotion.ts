import { parseArgs } from 'node:util';
import { ensureDbBootstrap } from '@/lib/db/bootstrap';
import { closeDbPool } from '@/lib/db/client';
import { promoteIntentPlaybooksFromRunHistory } from '@/lib/intent-e2e-playbook-promotion';

const parsed = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    json: { type: 'boolean' },
    'project-uid': { type: 'string' },
    'module-uid': { type: 'string' },
    'run-limit': { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
});

function readString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readInteger(value: string | boolean | undefined, fallback: number): number {
  const parsedValue = Number(readString(value));
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) return fallback;
  return Math.max(1, Math.min(200, Math.floor(parsedValue)));
}

function printHelp() {
  console.log(`Intent E2E playbook promotion CLI

用法：
  npm run intent:playbook:promote -- --project-uid <project> [options]

选项：
  --project-uid <uid>         项目 UID
  --module-uid <uid>          模块 UID
  --run-limit <n>             扫描最近多少条 passed runs，默认 200
  --dry-run                   只预览将要 promotion 的 recipe，不落盘
  --json                      输出完整 JSON
  --help                      打印帮助

示例：
  npm run intent:playbook:promote -- --project-uid proj_default --module-uid mod_xxx --run-limit 200
  npm run intent:playbook:promote -- --project-uid proj_default --dry-run --json
`);
}

async function main() {
  if (parsed.values.help) {
    printHelp();
    return;
  }

  const projectUid = readString(parsed.values['project-uid']);
  if (!projectUid) {
    throw new Error('缺少必要参数: --project-uid');
  }

  await ensureDbBootstrap();

  const result = await promoteIntentPlaybooksFromRunHistory({
    projectUid,
    moduleUid: readString(parsed.values['module-uid']),
    runLimit: readInteger(parsed.values['run-limit'], 200),
    dryRun: parsed.values['dry-run'] === true,
  });

  if (parsed.values.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`project=${result.projectUid} module=${result.moduleUid || '-'} runLimit=${result.runLimit}`);
  console.log(`scanned=${result.scannedRunCount} matchedRuns=${result.matchedRunCount} candidates=${result.candidateCount} recipes=${result.recipeCount}`);
  console.log(`writtenTo=${result.writtenTo}`);
  if (result.mergeResult) {
    console.log(
      `merge: before=${result.mergeResult.beforeRecipeCount} after=${result.mergeResult.afterRecipeCount} added=${result.mergeResult.addedRecipeSlugs.length} updated=${result.mergeResult.updatedRecipeSlugs.length} skipped=${result.mergeResult.skippedRecipeSlugs.length}`
    );
  } else {
    console.log(parsed.values['dry-run'] === true ? 'merge: dry-run，未落盘' : 'merge: 未命中可 promotion 的 playbook candidate');
  }
  if (result.sourceRuns.length > 0) {
    console.log(
      `sourceRuns: ${result.sourceRuns
        .slice(0, 8)
        .map((item) => `${item.runId}(${item.candidateCount})`)
        .join(' / ')}`
    );
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[intent-e2e-playbook-promotion] ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool().catch(() => {});
  });
