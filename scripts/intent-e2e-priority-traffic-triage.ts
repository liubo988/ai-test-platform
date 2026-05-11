import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  buildIntentE2EPriorityTrafficTriageReport,
  getIntentE2EPriorityTrafficTriagePath,
  loadIntentE2ETrafficQualityReportFromJson,
  loadIntentE2ETrafficQualityEventsFromJsonl,
  renderIntentE2EPriorityTrafficTriageMarkdown,
} from '@/lib/intent-e2e-priority-traffic-triage';
import { getIntentE2ETrafficQualityEventLogPath, getIntentE2ETrafficQualityReportPath } from '@/lib/intent-e2e-traffic-quality';
import { loadIntentE2ETrafficQualityPriorityFamilyGovernance } from '@/lib/intent-e2e-traffic-quality-governance';

const HELP_TEXT = `
Usage:
  npm run intent:priority-triage -- [options]

Options:
  --project-uid <uid>       Project uid. Defaults to proj_default.
  --windows <daysCsv>       Window days to scan. Defaults to 30.
  --event-log <path>        Override traffic-quality JSONL event log path.
  --traffic-quality-json <path>
                              Override latest traffic-quality report JSON path.
  --json-out <path>         JSON output path.
  --md-out <path>           Markdown output path.
  --json                    Also print full triage JSON to stdout.
  --help                    Print this help.
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
  if (!normalized) return [30];
  const parsed = normalized
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.floor(item));
  return parsed.length > 0 ? parsed : [30];
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
  const trafficQualityReportPath =
    readString(parsed.values['traffic-quality-json']) || getIntentE2ETrafficQualityReportPath(projectUid, 'json');
  const jsonOut = readString(parsed.values['json-out']) || getIntentE2EPriorityTrafficTriagePath(projectUid, 'json');
  const mdOut = readString(parsed.values['md-out']) || getIntentE2EPriorityTrafficTriagePath(projectUid, 'md');

  const [events, priorityFamilyGovernance, trafficQualityReport] = await Promise.all([
    loadIntentE2ETrafficQualityEventsFromJsonl(eventLogPath),
    loadIntentE2ETrafficQualityPriorityFamilyGovernance(projectUid),
    loadIntentE2ETrafficQualityReportFromJson(trafficQualityReportPath),
  ]);
  const report = buildIntentE2EPriorityTrafficTriageReport({
    projectUid,
    events,
    priorityFamilyGovernance,
    trafficQualityReport,
    windowDaysList: readWindows(parsed.values.windows),
    eventLogPath,
    trafficQualityReportPath,
  });

  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdOut, renderIntentE2EPriorityTrafficTriageMarkdown(report));

  if (parsed.values.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const windowSummary = report.windows
    .map(
      (window) =>
        `${window.days}d:untracked=${window.untracked.counters.launch_click_count},doc=${window.untracked.documentLikeLaunchClickCount},reroutable=${window.untracked.reroutablePriorityLaunchClickCount},unknown=${window.untracked.unknownBusinessLaunchClickCount},business_to_order=${window.businessToOrder.counters.launch_click_count}/${
          window.businessToOrder.terminalPassRate === null ? '-' : `${window.businessToOrder.terminalPassRate}%`
        }`
    )
    .join(' ');
  console.log(`priority traffic triage: ${jsonOut}`);
  console.log(`priority traffic triage markdown: ${mdOut}`);
  console.log(`summary: recommendation=${report.recommendation.status} ${windowSummary}`);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[intent-e2e-priority-traffic-triage] ${error.message}`);
  } else {
    console.error('[intent-e2e-priority-traffic-triage] 未知错误');
  }
  process.exitCode = 1;
});
