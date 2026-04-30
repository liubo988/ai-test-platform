import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { closeDbPool } from '@/lib/db/client';
import {
  buildIntentE2ETrafficQualityReport,
  getIntentE2ETrafficQualityReportPath,
  renderIntentE2ETrafficQualityMarkdown,
} from '@/lib/intent-e2e-traffic-quality';

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

function readNonNegativeInt(value: string | boolean | undefined, fallback: number): number {
  const normalized = readString(value);
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

async function writeFile(filePath: string, content: string): Promise<void> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsPromises.writeFile(absolutePath, content, 'utf8');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const projectUid = readString(parsed.values['project-uid']) || 'proj_default';
  const windowDays = readPositiveInt(parsed.values['window-days'], 7);
  const terminalRunLimit = readPositiveInt(parsed.values['terminal-run-limit'], 200);
  const historicalDraftLimit = readPositiveInt(parsed.values['historical-draft-limit'], 100);
  const minRealClickLaunchClicks = readNonNegativeInt(parsed.values['min-real-click-launches'], 20);
  const minRealClickAutoRunStarts = readNonNegativeInt(parsed.values['min-real-click-auto-runs'], 10);
  const minRealClickTerminalRuns = readNonNegativeInt(parsed.values['min-real-click-terminal-runs'], 10);
  const jsonOut = readString(parsed.values['json-out']) || getIntentE2ETrafficQualityReportPath(projectUid, 'json');
  const mdOut = readString(parsed.values['md-out']) || getIntentE2ETrafficQualityReportPath(projectUid, 'md');
  const eventLogPath = readString(parsed.values['event-log']);
  const benchmarkReportDir = readString(parsed.values['benchmark-report-dir']);

  const report = await buildIntentE2ETrafficQualityReport({
    projectUid,
    windowDays,
    terminalRunLimit,
    eventLogPaths: eventLogPath ? [eventLogPath] : undefined,
    benchmarkReportDir: benchmarkReportDir || undefined,
    historicalIntentDraftLimit: historicalDraftLimit,
    minRealClickLaunchClicks,
    minRealClickAutoRunStarts,
    minRealClickTerminalRuns,
  });
  const markdown = renderIntentE2ETrafficQualityMarkdown(report);

  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdOut, markdown);

  if (parsed.values.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`traffic-quality report: ${jsonOut}`);
  console.log(`traffic-quality markdown: ${mdOut}`);
  console.log(
    `summary: real_click=${report.summary.realClickTerminalPassCount}/${report.summary.realClickTerminalRunCount} (${report.summary.realClickTerminalPassRate ?? '-'}%) benchmark_rerun=${report.summary.benchmarkRerunTerminalPassCount}/${report.summary.benchmarkRerunTerminalRunCount} (${report.summary.benchmarkRerunTerminalPassRate ?? '-'}%) replay=${report.summary.replayTerminalPassCount}/${report.summary.replayTerminalRunCount} (${report.summary.replayTerminalPassRate ?? '-'}%) readiness=${report.sampleReadiness.readyForFamilySelection ? 'ready' : 'not_ready'} document_selection=${report.documentFamilySelection.mode} top_families=${report.documentFamilySelection.recommendedTopFamilies.join(',') || '-'}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
