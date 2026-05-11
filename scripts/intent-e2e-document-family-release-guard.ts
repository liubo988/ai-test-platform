import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_ADMISSIBLE_PASSED_RUNS,
  DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_REAL_CLICK_SIGNALS,
  buildIntentE2EDocumentFamilyReleaseGuardReport,
  getIntentE2EDocumentFamilyReleaseGuardPath,
  renderIntentE2EDocumentFamilyReleaseGuardMarkdown,
} from '@/lib/intent-e2e-document-family-release-guard';
import {
  getIntentE2EDocumentFamilyGovernancePath,
  type IntentE2EDocumentFamilyGovernanceReport,
} from '@/lib/intent-e2e-document-family-governance';
import {
  INTENT_E2E_TRAFFIC_QUALITY_DOCUMENT_FAMILIES,
  getIntentE2ETrafficQualityReportPath,
  type IntentE2ETrafficQualityDocumentFamily,
  type IntentE2ETrafficQualityReport,
} from '@/lib/intent-e2e-traffic-quality';
import type { IntentE2EDocumentRealClickSeedReport } from '@/lib/intent-e2e-document-real-click-seed';

const HELP_TEXT = `
Usage:
  npm run intent:document-family:guard -- [options]

Options:
  --project-uid <uid>                  Project uid. Defaults to proj_default.
  --traffic-json <path>                Traffic-quality JSON path. Defaults to latest project report.
  --governance-json <path>             Document governance JSON path. Defaults to latest project report.
  --seed-report-dir <path>             Directory containing document real-click seed reports.
  --families <csv>                     Candidate families override. Defaults to traffic recommendedTopFamilies.
  --min-real-click-signals <count>     Defaults to ${DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_REAL_CLICK_SIGNALS}.
  --min-admissible-passed-runs <count> Defaults to ${DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_ADMISSIBLE_PASSED_RUNS}.
  --json-out <path>                    JSON output path.
  --md-out <path>                      Markdown output path.
  --json                               Also print full guard JSON to stdout.
  --require-passed                     Exit 1 unless all baselines pass.
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

function readPositiveInt(value: string | boolean | undefined, fallback: number): number {
  const normalized = readString(value);
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function isDocumentFamily(value: string): value is IntentE2ETrafficQualityDocumentFamily {
  return (INTENT_E2E_TRAFFIC_QUALITY_DOCUMENT_FAMILIES as readonly string[]).includes(value);
}

function readFamilies(value: string | boolean | undefined): IntentE2ETrafficQualityDocumentFamily[] {
  const normalized = readString(value);
  if (!normalized) return [];

  const families: IntentE2ETrafficQualityDocumentFamily[] = [];
  for (const raw of normalized.split(',')) {
    const family = raw.trim();
    if (!isDocumentFamily(family) || families.includes(family)) continue;
    families.push(family);
  }
  return families;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  return JSON.parse(await fsPromises.readFile(absolutePath, 'utf8')) as T;
}

async function readOptionalJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return await readJsonFile<T>(filePath);
  } catch {
    return null;
  }
}

async function listSeedReportPaths(reportDir: string): Promise<string[]> {
  const absoluteDir = path.isAbsolute(reportDir) ? reportDir : path.join(process.cwd(), reportDir);
  let entries: string[] = [];
  try {
    entries = await fsPromises.readdir(absoluteDir);
  } catch {
    return [];
  }

  return entries
    .filter((entry) => /^intent-e2e\.document-real-click-seed-report\..+\.json$/.test(entry))
    .map((entry) => path.join(absoluteDir, entry))
    .sort();
}

async function readSeedReports(reportDir: string): Promise<IntentE2EDocumentRealClickSeedReport[]> {
  const reports: IntentE2EDocumentRealClickSeedReport[] = [];
  for (const reportPath of await listSeedReportPaths(reportDir)) {
    const report = await readOptionalJsonFile<IntentE2EDocumentRealClickSeedReport>(reportPath);
    if (report?.version === 1) reports.push(report);
  }
  return reports;
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
  const projectReportDir = path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', projectUid);
  const trafficJson =
    readString(parsed.values['traffic-json']) || getIntentE2ETrafficQualityReportPath(projectUid, 'json');
  const governanceJson =
    readString(parsed.values['governance-json']) || getIntentE2EDocumentFamilyGovernancePath(projectUid, 'json');
  const seedReportDir = readString(parsed.values['seed-report-dir']) || projectReportDir;
  const jsonOut = readString(parsed.values['json-out']) || getIntentE2EDocumentFamilyReleaseGuardPath(projectUid, 'json');
  const mdOut = readString(parsed.values['md-out']) || getIntentE2EDocumentFamilyReleaseGuardPath(projectUid, 'md');

  const trafficQualityReport = await readJsonFile<IntentE2ETrafficQualityReport>(trafficJson);
  const governanceReport = await readOptionalJsonFile<IntentE2EDocumentFamilyGovernanceReport>(governanceJson);
  const seedReports = await readSeedReports(seedReportDir);
  const report = buildIntentE2EDocumentFamilyReleaseGuardReport({
    projectUid,
    trafficQualityReport,
    governanceReport,
    seedReports,
    families: readFamilies(parsed.values.families),
    minRealClickSignals: readPositiveInt(
      parsed.values['min-real-click-signals'],
      DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_REAL_CLICK_SIGNALS
    ),
    minAdmissiblePassedRuns: readPositiveInt(
      parsed.values['min-admissible-passed-runs'],
      DEFAULT_INTENT_E2E_DOCUMENT_FAMILY_GUARD_MIN_ADMISSIBLE_PASSED_RUNS
    ),
  });

  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdOut, renderIntentE2EDocumentFamilyReleaseGuardMarkdown(report));

  if (parsed.values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`document-family release guard: ${jsonOut}`);
    console.log(`document-family release guard markdown: ${mdOut}`);
    console.log(
      `summary: passed=${report.passed ? 'yes' : 'no'} baselines=${report.summary.baselineCount} passedBaselines=${report.summary.passedBaselines} failedBaselines=${report.summary.failedBaselines} real_click_signals=${report.summary.totalRealClickSignals} admissible_passed=${report.summary.totalAdmissiblePassedRuns}`
    );
  }

  if (parsed.values['require-passed'] && !report.passed) {
    console.error('[intent-e2e/document-family-release-guard] guard failed');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[intent-e2e-document-family-release-guard] ${error.message}`);
  } else {
    console.error('[intent-e2e-document-family-release-guard] 未知错误');
  }
  process.exitCode = 1;
});
