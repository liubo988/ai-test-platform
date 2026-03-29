import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const defaultFiles = [
  'AGENTS.md',
  'README.md',
  'docs/architecture.md',
  'docs/task-brief-template.md',
  'docs/testing.md',
  'docs/runbook.md',
];

const inputFiles = process.argv.slice(2);
const files = (inputFiles.length ? inputFiles : defaultFiles).map((file) => path.resolve(rootDir, file));
const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
const issues = [];

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function normalizeTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1).trim();
  }
  return target;
}

function resolveLocalTarget(filePath, rawTarget) {
  const target = normalizeTarget(rawTarget);
  if (!target || target.startsWith('#')) return null;
  if (/^(https?:|mailto:|data:|javascript:)/i.test(target)) return null;

  const [pathPart] = target.split('#');
  if (!pathPart) return null;

  const decodedPath = decodeURIComponent(pathPart);
  return decodedPath.startsWith('/')
    ? path.resolve(rootDir, decodedPath.slice(1))
    : path.resolve(path.dirname(filePath), decodedPath);
}

for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    issues.push(`Missing markdown file: ${path.relative(rootDir, filePath)}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1];
    const resolvedTarget = resolveLocalTarget(filePath, rawTarget);
    if (!resolvedTarget) continue;
    if (fs.existsSync(resolvedTarget)) continue;

    const line = lineNumberForIndex(content, match.index ?? 0);
    issues.push(
      `${path.relative(rootDir, filePath)}:${line} -> missing target "${normalizeTarget(rawTarget)}"`
    );
  }
}

if (issues.length) {
  console.error('[check-doc-links] Broken local markdown links found:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`[check-doc-links] OK (${files.length} files checked)`);
