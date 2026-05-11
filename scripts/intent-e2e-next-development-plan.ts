import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { closeDbPool } from '@/lib/db/client';
import {
  buildIntentE2EDocumentFamilyGovernanceReport,
  getIntentE2EDocumentFamilyGovernancePath,
  renderIntentE2EDocumentFamilyGovernanceMarkdown,
} from '@/lib/intent-e2e-document-family-governance';
import {
  buildIntentE2EDocumentFamilyReleaseGuardReport,
  getIntentE2EDocumentFamilyReleaseGuardPath,
  renderIntentE2EDocumentFamilyReleaseGuardMarkdown,
} from '@/lib/intent-e2e-document-family-release-guard';
import type { IntentE2EDocumentRealClickSeedReport } from '@/lib/intent-e2e-document-real-click-seed';
import {
  buildIntentE2ENextDevelopmentPlanReport,
  getIntentE2ENextDevelopmentPlanPath,
  renderIntentE2ENextDevelopmentPlanMarkdown,
} from '@/lib/intent-e2e-next-development-plan';
import {
  buildIntentE2ENewIntentReadinessReport,
  loadIntentE2ENewIntentReadinessFromTrafficQuality,
} from '@/lib/intent-e2e-new-intent-readiness';
import {
  buildIntentE2ETrafficQualityReport,
  getIntentE2ETrafficQualityReportPath,
  renderIntentE2ETrafficQualityMarkdown,
} from '@/lib/intent-e2e-traffic-quality';
import { loadIntentE2ETrafficQualityPriorityFamilyGovernance } from '@/lib/intent-e2e-traffic-quality-governance';

const HELP_TEXT = `
Usage:
  npm run intent:next-dev:plan -- [options]
  npm run intent:next-dev:check -- [options]

Options:
  --project-uid <uid>                  Project uid. Defaults to proj_default.
  --window-days <days>                 Recent window size. Defaults to 30.
  --terminal-run-limit <count>         Max terminal runs to inspect. Defaults to 200.
  --historical-draft-limit <count>     Historical draft fallback limit. Defaults to 100.
  --json-out <path>                    Next-development plan JSON output path.
  --md-out <path>                      Next-development plan Markdown output path.
  --traffic-json-out <path>            Traffic-quality JSON output path.
  --traffic-md-out <path>              Traffic-quality Markdown output path.
  --document-governance-json-out <path>
                                       Document family governance JSON output path.
  --document-governance-md-out <path>  Document family governance Markdown output path.
  --document-guard-json-out <path>     Document family release guard JSON output path.
  --document-guard-md-out <path>       Document family release guard Markdown output path.
  --document-seed-report-dir <path>    Directory containing document real-click seed reports.
  --event-log <path>                   Override traffic-quality event log path.
  --benchmark-report-dir <path>        Override benchmark report directory.
  --json                               Also print full plan JSON to stdout.
  --require-ready                      Exit 1 unless developmentGate.status is ready_*.
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

async function writeFile(filePath: string, content: string): Promise<void> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsPromises.writeFile(absolutePath, content, 'utf8');
}

async function readOptionalJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    return JSON.parse(await fsPromises.readFile(absolutePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readDocumentSeedReports(reportDir: string): Promise<IntentE2EDocumentRealClickSeedReport[]> {
  const absoluteDir = path.isAbsolute(reportDir) ? reportDir : path.join(process.cwd(), reportDir);
  let entries: string[] = [];
  try {
    entries = await fsPromises.readdir(absoluteDir);
  } catch {
    return [];
  }

  const reports: IntentE2EDocumentRealClickSeedReport[] = [];
  for (const entry of entries.filter((item) => /^intent-e2e\.document-real-click-seed-report\..+\.json$/.test(item))) {
    const report = await readOptionalJsonFile<IntentE2EDocumentRealClickSeedReport>(path.join(absoluteDir, entry));
    if (report?.version === 1) reports.push(report);
  }
  return reports;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.values.help) {
    console.log(HELP_TEXT.trim());
    return;
  }

  const projectUid = readString(parsed.values['project-uid']) || 'proj_default';
  const windowDays = readPositiveInt(parsed.values['window-days'], 30);
  const terminalRunLimit = readPositiveInt(parsed.values['terminal-run-limit'], 200);
  const historicalDraftLimit = readPositiveInt(parsed.values['historical-draft-limit'], 100);
  const eventLogPath = readString(parsed.values['event-log']);
  const benchmarkReportDir = readString(parsed.values['benchmark-report-dir']);
  const jsonOut = readString(parsed.values['json-out']) || getIntentE2ENextDevelopmentPlanPath(projectUid, 'json');
  const mdOut = readString(parsed.values['md-out']) || getIntentE2ENextDevelopmentPlanPath(projectUid, 'md');
  const trafficJsonOut =
    readString(parsed.values['traffic-json-out']) || getIntentE2ETrafficQualityReportPath(projectUid, 'json');
  const trafficMdOut =
    readString(parsed.values['traffic-md-out']) || getIntentE2ETrafficQualityReportPath(projectUid, 'md');
  const documentGovernanceJsonOut =
    readString(parsed.values['document-governance-json-out']) ||
    getIntentE2EDocumentFamilyGovernancePath(projectUid, 'json');
  const documentGovernanceMdOut =
    readString(parsed.values['document-governance-md-out']) || getIntentE2EDocumentFamilyGovernancePath(projectUid, 'md');
  const documentGuardJsonOut =
    readString(parsed.values['document-guard-json-out']) || getIntentE2EDocumentFamilyReleaseGuardPath(projectUid, 'json');
  const documentGuardMdOut =
    readString(parsed.values['document-guard-md-out']) || getIntentE2EDocumentFamilyReleaseGuardPath(projectUid, 'md');
  const documentSeedReportDir =
    readString(parsed.values['document-seed-report-dir']) ||
    path.join(process.cwd(), 'reports', 'intent-e2e', 'projects', projectUid);
  const requireReady = Boolean(parsed.values['require-ready']);

  const priorityFamilyGovernance = await loadIntentE2ETrafficQualityPriorityFamilyGovernance(projectUid);
  const trafficQualityReport = await buildIntentE2ETrafficQualityReport({
    projectUid,
    windowDays,
    terminalRunLimit,
    eventLogPaths: eventLogPath ? [eventLogPath] : undefined,
    benchmarkReportDir: benchmarkReportDir || undefined,
    historicalIntentDraftLimit: historicalDraftLimit,
    priorityFamilyGovernance,
  });
  const trafficQualityMarkdown = renderIntentE2ETrafficQualityMarkdown(trafficQualityReport);
  await writeFile(trafficJsonOut, `${JSON.stringify(trafficQualityReport, null, 2)}\n`);
  await writeFile(trafficMdOut, trafficQualityMarkdown);
  const documentGovernanceReport = buildIntentE2EDocumentFamilyGovernanceReport({
    projectUid,
    candidateFamilies: trafficQualityReport.documentFamilySelection.recommendedTopFamilies,
  });
  await writeFile(documentGovernanceJsonOut, `${JSON.stringify(documentGovernanceReport, null, 2)}\n`);
  await writeFile(documentGovernanceMdOut, renderIntentE2EDocumentFamilyGovernanceMarkdown(documentGovernanceReport));
  const documentGuardReport = buildIntentE2EDocumentFamilyReleaseGuardReport({
    projectUid,
    trafficQualityReport,
    governanceReport: documentGovernanceReport,
    seedReports: await readDocumentSeedReports(documentSeedReportDir),
  });
  await writeFile(documentGuardJsonOut, `${JSON.stringify(documentGuardReport, null, 2)}\n`);
  await writeFile(documentGuardMdOut, renderIntentE2EDocumentFamilyReleaseGuardMarkdown(documentGuardReport));
  const newIntentReadinessInput = await loadIntentE2ENewIntentReadinessFromTrafficQuality({
    projectUid,
    windowDays,
    limit: 100,
    generatedAt: trafficQualityReport.generatedAt,
    eventLogPaths: eventLogPath ? [eventLogPath] : undefined,
  });
  const newIntentReadinessReport = buildIntentE2ENewIntentReadinessReport({
    projectUid,
    windowDays,
    generatedAt: trafficQualityReport.generatedAt,
    items: newIntentReadinessInput.items,
    warnings: newIntentReadinessInput.warnings,
  });

  const plan = buildIntentE2ENextDevelopmentPlanReport({
    trafficQualityReport,
    trafficQualityJsonPath: trafficJsonOut,
    trafficQualityMarkdownPath: trafficMdOut,
    documentFamilyGovernanceJsonPath: documentGovernanceJsonOut,
    documentFamilyGovernanceMarkdownPath: documentGovernanceMdOut,
    documentFamilyReleaseGuardJsonPath: documentGuardJsonOut,
    documentFamilyReleaseGuardMarkdownPath: documentGuardMdOut,
    documentFamilyReleaseGuardReport: documentGuardReport,
    newIntentReadinessReport,
  });
  const planMarkdown = renderIntentE2ENextDevelopmentPlanMarkdown(plan);
  await writeFile(jsonOut, `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(mdOut, planMarkdown);

  if (parsed.values.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(`next-development plan: ${jsonOut}`);
    console.log(`next-development markdown: ${mdOut}`);
    console.log(`traffic-quality report: ${trafficJsonOut}`);
    console.log(`traffic-quality markdown: ${trafficMdOut}`);
    console.log(`document-family governance: ${documentGovernanceJsonOut}`);
    console.log(`document-family governance markdown: ${documentGovernanceMdOut}`);
    console.log(`document-family release guard: ${documentGuardJsonOut}`);
    console.log(`document-family release guard markdown: ${documentGuardMdOut}`);
    console.log(
      `summary: ready=${plan.developmentReady ? 'yes' : 'no'} gate=${plan.gateStatus} decision=${plan.decision} eligible=${plan.eligibleFamilies.map((candidate) => candidate.family).join(',') || '-'}`
    );
  }

  if (requireReady && !plan.developmentReady) {
    console.error(
      `[intent-e2e/next-development] development gate is not ready: ${plan.gateSummary}; decision=${plan.decision}; blocking=${plan.blockingReasons.join(' | ') || '-'}`
    );
    process.exitCode = 1;
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
