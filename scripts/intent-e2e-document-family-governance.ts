import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  buildIntentE2EDocumentFamilyGovernanceReport,
  getIntentE2EDocumentFamilyGovernancePath,
  renderIntentE2EDocumentFamilyGovernanceMarkdown,
} from '@/lib/intent-e2e-document-family-governance';
import {
  getIntentE2ETrafficQualityReportPath,
  INTENT_E2E_TRAFFIC_QUALITY_DOCUMENT_FAMILIES,
  type IntentE2ETrafficQualityDocumentFamily,
  type IntentE2ETrafficQualityReport,
} from '@/lib/intent-e2e-traffic-quality';

const HELP_TEXT = `
Usage:
  npm run intent:document-family:governance -- [options]

Options:
  --project-uid <uid>                  Project uid. Defaults to proj_default.
  --traffic-json <path>                Traffic-quality JSON path. Defaults to latest project report.
  --families <csv>                     Candidate families override. Defaults to traffic report recommendedTopFamilies.
  --json-out <path>                    JSON output path.
  --md-out <path>                      Markdown output path.
  --json                               Also print full governance JSON to stdout.
  --require-ready                      Exit 1 when any candidate family has no governance contract.
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

function isDocumentFamily(value: string): value is IntentE2ETrafficQualityDocumentFamily {
  return (INTENT_E2E_TRAFFIC_QUALITY_DOCUMENT_FAMILIES as readonly string[]).includes(value);
}

function readFamilies(value: string | boolean | undefined): IntentE2ETrafficQualityDocumentFamily[] {
  const normalized = readString(value);
  if (!normalized) return [];

  const families: IntentE2ETrafficQualityDocumentFamily[] = [];
  for (const item of normalized.split(',')) {
    const family = item.trim();
    if (!isDocumentFamily(family) || families.includes(family)) continue;
    families.push(family);
  }
  return families;
}

async function readTrafficQualityReport(filePath: string): Promise<IntentE2ETrafficQualityReport | null> {
  try {
    return JSON.parse(await fsPromises.readFile(filePath, 'utf8')) as IntentE2ETrafficQualityReport;
  } catch {
    return null;
  }
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
  const trafficJson =
    readString(parsed.values['traffic-json']) || getIntentE2ETrafficQualityReportPath(projectUid, 'json');
  const explicitFamilies = readFamilies(parsed.values.families);
  const trafficReport = explicitFamilies.length > 0 ? null : await readTrafficQualityReport(trafficJson);
  const candidateFamilies =
    explicitFamilies.length > 0 ? explicitFamilies : trafficReport?.documentFamilySelection.recommendedTopFamilies || [];
  const jsonOut =
    readString(parsed.values['json-out']) || getIntentE2EDocumentFamilyGovernancePath(projectUid, 'json');
  const mdOut = readString(parsed.values['md-out']) || getIntentE2EDocumentFamilyGovernancePath(projectUid, 'md');

  const report = buildIntentE2EDocumentFamilyGovernanceReport({
    projectUid,
    candidateFamilies,
  });
  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdOut, renderIntentE2EDocumentFamilyGovernanceMarkdown(report));

  if (parsed.values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`document-family governance: ${jsonOut}`);
    console.log(`document-family governance markdown: ${mdOut}`);
    console.log(
      `summary: source_policy=${report.sourcePolicy} governed=${report.governedFamilies.join(',') || '-'} missing=${report.missingFamilies.join(',') || '-'}`
    );
  }

  if (parsed.values['require-ready'] && report.missingFamilies.length > 0) {
    console.error(
      `[intent-e2e/document-family-governance] missing governance profiles: ${report.missingFamilies.join(', ')}`
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[intent-e2e-document-family-governance] ${error.message}`);
  } else {
    console.error('[intent-e2e-document-family-governance] 未知错误');
  }
  process.exitCode = 1;
});
