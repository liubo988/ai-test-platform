import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { buildIntentE2EProjectAssetAvailability } from '@/lib/intent-e2e-asset-readiness';
import { resolveIntentE2ELaunchDecision } from '@/lib/intent-e2e-launch-decision';
import {
  buildIntentE2ENewIntentReadiness,
  buildIntentE2ENewIntentReadinessReport,
  getIntentE2ENewIntentReadinessReportPath,
  loadIntentE2ENewIntentReadinessFromTrafficQuality,
  renderIntentE2ENewIntentReadinessMarkdown,
} from '@/lib/intent-e2e-new-intent-readiness';
import { resolveIntentE2EPriorityScenarioFamilyRoute } from '@/lib/intent-e2e-priority-scenario-family';
import type { IntentE2ETrafficQualitySource } from '@/lib/intent-e2e-traffic-quality';

const HELP_TEXT = `
Usage:
  npm run intent:new-intent:readiness -- [options]

Options:
  --project-uid <uid>       Project uid. Defaults to proj_default.
  --window-days <days>      Recent launch-click window. Defaults to 30.
  --limit <count>           Max recent launch-click items. Defaults to 100.
  --event-log <path>        Override traffic-quality event log path.
  --input <text>            Evaluate one new intent instead of scanning traffic-quality.
  --target-url <url>        Target URL for --input.
  --source <source>         real_click | draft_import | benchmark_rerun | replay. Defaults to real_click.
  --attachment-count <n>    Attachment count for --input. Defaults to 0.
  --only-needs-fixture      Keep only recommendedMode=needs_fixture items with a fixture bootstrap recommendation.
  --json-out <path>         JSON report output path.
  --md-out <path>           Markdown report output path.
  --json                    Also print full JSON report to stdout.
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

function normalizeSource(value: string): IntentE2ETrafficQualitySource {
  return value === 'draft_import' || value === 'benchmark_rerun' || value === 'replay' ? value : 'real_click';
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
  const windowDays = readPositiveInt(parsed.values['window-days'], 30);
  const limit = readPositiveInt(parsed.values.limit, 100);
  const input = readString(parsed.values.input);
  const targetUrl = readString(parsed.values['target-url']);
  const source = normalizeSource(readString(parsed.values.source));
  const attachmentCount = readNonNegativeInt(parsed.values['attachment-count'], 0);
  const onlyNeedsFixture = Boolean(parsed.values['only-needs-fixture']);
  const generatedAt = new Date().toISOString();
  const jsonOut = readString(parsed.values['json-out']) || getIntentE2ENewIntentReadinessReportPath(projectUid, 'json');
  const mdOut = readString(parsed.values['md-out']) || getIntentE2ENewIntentReadinessReportPath(projectUid, 'md');
  const eventLogPath = readString(parsed.values['event-log']);

  const items = [];
  const warnings: string[] = [];

  if (input) {
    const request = {
      input,
      targetUrl,
      projectUid,
      attachments: Array.from({ length: attachmentCount }, (_, index) => ({
        name: `attachment-${index + 1}`,
        dataUrl: '',
      })),
    };
    const assetAvailability = buildIntentE2EProjectAssetAvailability({ projectUid });
    const priorityScenarioFamilyRoute = resolveIntentE2EPriorityScenarioFamilyRoute({
      requestInput: input,
      targetUrl,
      scenarioCard: null,
      description: input,
    });
    const launchDecision = resolveIntentE2ELaunchDecision({
      input,
      targetUrl,
      projectUid,
      attachments: request.attachments,
      assetAvailability,
      priorityScenarioFamilyRoute,
    });

    items.push(
      buildIntentE2ENewIntentReadiness({
        request,
        launchDecision,
        assetAvailability,
        priorityScenarioFamilyRoute,
        source,
        generatedAt,
      })
    );
  } else {
    const loaded = await loadIntentE2ENewIntentReadinessFromTrafficQuality({
      projectUid,
      windowDays,
      limit,
      generatedAt,
      eventLogPaths: eventLogPath ? [eventLogPath] : undefined,
    });
    items.push(...loaded.items);
    warnings.push(...loaded.warnings);
  }

  const filteredItems = onlyNeedsFixture
    ? items.filter((item) => item.recommendedMode === 'needs_fixture' && Boolean(item.fixtureBootstrap))
    : items;
  const report = buildIntentE2ENewIntentReadinessReport({
    projectUid,
    windowDays,
    generatedAt,
    items: filteredItems,
    warnings,
  });
  const markdown = renderIntentE2ENewIntentReadinessMarkdown(report);

  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdOut, markdown);

  if (parsed.values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`new-intent readiness report: ${jsonOut}`);
    console.log(`new-intent readiness markdown: ${mdOut}`);
    console.log(
      `summary: total=${report.total} source=${JSON.stringify(report.summary.bySource)} mode=${JSON.stringify(
        report.summary.byRecommendedMode
      )} confidence=${JSON.stringify(report.summary.byConfidence)} fixture=${JSON.stringify(
        report.summary.fixtureBootstrapStrategies
      )} missing=${JSON.stringify(report.summary.missingContracts)}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
