import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { closeDbPool } from '@/lib/db/client';
import {
  buildIntentE2EFormalTaskSeedAuditReport,
  getIntentE2EFormalTaskSeedAuditPath,
  loadIntentE2EFormalTaskSeedAuditTasks,
  renderIntentE2EFormalTaskSeedAuditMarkdown,
} from '@/lib/intent-e2e-formal-task-seed-audit';

const HELP_TEXT = `
Usage:
  npm run intent:formal-task-seeds -- [options]

Options:
  --project-uid <uid>      Project uid. Defaults to proj_default.
  --page-size <count>      Max active formal tasks to inspect. Defaults to 100.
  --execution-limit <n>    Recent executions per formal task. Defaults to 5.
  --json-out <path>        JSON output path.
  --md-out <path>          Markdown output path.
  --json                   Also print full JSON to stdout.
  --help                   Print this help.
`;

type ParsedArgs = {
  values: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;

    const eqIndex = item.indexOf('=');
    if (eqIndex > 2) {
      values[item.slice(2, eqIndex)] = item.slice(eqIndex + 1);
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = true;
    }
  }

  return { values };
}

function readString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readPositiveInt(value: string | boolean | undefined, fallback: number): number {
  const normalized = readString(value);
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function writeFile(filePath: string, content: string): Promise<void> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsPromises.writeFile(absolutePath, content, 'utf8');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.values.help) {
    console.log(HELP_TEXT.trim());
    return;
  }

  const projectUid = readString(parsed.values['project-uid']) || 'proj_default';
  const pageSize = readPositiveInt(parsed.values['page-size'], 100);
  const executionLimit = readPositiveInt(parsed.values['execution-limit'], 5);
  const jsonOut = readString(parsed.values['json-out']) || getIntentE2EFormalTaskSeedAuditPath(projectUid, 'json');
  const mdOut = readString(parsed.values['md-out']) || getIntentE2EFormalTaskSeedAuditPath(projectUid, 'md');

  const tasks = await loadIntentE2EFormalTaskSeedAuditTasks({
    projectUid,
    pageSize,
    executionLimit,
  });
  const report = buildIntentE2EFormalTaskSeedAuditReport({
    projectUid,
    tasks,
  });
  const markdown = renderIntentE2EFormalTaskSeedAuditMarkdown(report);

  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdOut, markdown);

  if (parsed.values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`formal-task seed audit: ${jsonOut}`);
    console.log(`formal-task seed audit markdown: ${mdOut}`);
    console.log(
      `summary: formal_tasks=${report.summary.formalTaskCount} seed_eligible=${report.summary.seedEligibleCount} document_like=${report.summary.documentLikeSeedEligibleCount} source_policy=${report.sourcePolicy}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
