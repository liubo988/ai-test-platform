import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  buildIntentE2EDocumentSampleScoutReport,
  getIntentE2EDocumentSampleScoutPath,
  loadIntentE2EFormalTaskSeedAuditFromJson,
  loadIntentE2ETrafficQualityEventsFromJsonl,
  renderIntentE2EDocumentSampleScoutMarkdown,
} from '@/lib/intent-e2e-document-sample-scout';
import { getIntentE2EFormalTaskSeedAuditPath } from '@/lib/intent-e2e-formal-task-seed-audit';
import { getIntentE2ETrafficQualityEventLogPath } from '@/lib/intent-e2e-traffic-quality';

const HELP_TEXT = `
Usage:
  npm run intent:document-sample:scout -- [options]

Options:
  --project-uid <uid>                  Project uid. Defaults to proj_default.
  --windows <daysCsv>                  Window days to scan. Defaults to 30,90,365.
  --event-log <path>                   Override traffic-quality JSONL event log path.
  --formal-task-audit-json <path>      Override formal-task seed audit JSON path.
  --json-out <path>                    JSON output path.
  --md-out <path>                      Markdown output path.
  --json                               Also print full scout JSON to stdout.
  --help                               Print this help.
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

function readWindows(value: string | boolean | undefined): number[] {
  const normalized = readString(value);
  if (!normalized) return [30, 90, 365];
  return normalized
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.floor(item));
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
  const eventLogPath = readString(parsed.values['event-log']) || getIntentE2ETrafficQualityEventLogPath(projectUid);
  const formalTaskSeedAuditPath =
    readString(parsed.values['formal-task-audit-json']) || getIntentE2EFormalTaskSeedAuditPath(projectUid, 'json');
  const jsonOut = readString(parsed.values['json-out']) || getIntentE2EDocumentSampleScoutPath(projectUid, 'json');
  const mdOut = readString(parsed.values['md-out']) || getIntentE2EDocumentSampleScoutPath(projectUid, 'md');

  const events = await loadIntentE2ETrafficQualityEventsFromJsonl(eventLogPath);
  const formalTaskSeedAudit = await loadIntentE2EFormalTaskSeedAuditFromJson(formalTaskSeedAuditPath);
  const report = buildIntentE2EDocumentSampleScoutReport({
    projectUid,
    events,
    formalTaskSeedAudit,
    windowDaysList: readWindows(parsed.values.windows),
    eventLogPath,
    formalTaskSeedAuditPath,
  });

  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdOut, renderIntentE2EDocumentSampleScoutMarkdown(report));

  if (parsed.values.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const windowSummary = report.windows
    .map((window) => `${window.days}d:${window.documentLikeRealClickLaunchClickCount}/${window.realClickLaunchClickCount}`)
    .join(' ');
  console.log(`document sample scout: ${jsonOut}`);
  console.log(`document sample scout markdown: ${mdOut}`);
  console.log(
    `summary: recommendation=${report.recommendation.status} windows=${windowSummary} formal_document_like=${report.formalTaskSeeds.documentLikeSeedEligibleCount}`
  );
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[intent-e2e-document-sample-scout] ${error.message}`);
  } else {
    console.error('[intent-e2e-document-sample-scout] 未知错误');
  }
  process.exitCode = 1;
});
