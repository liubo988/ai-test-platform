import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const defaultRoadmap = 'docs/intent-e2e-high-success-roadmap-2026-03-20.md';
const roadmapArg = process.argv[2] || defaultRoadmap;
const roadmapPath = path.resolve(rootDir, roadmapArg);

const requiredFields = [
  '本轮目标',
  '已完成',
  '验证',
  '当前阶段状态',
  '风险 / 未完成',
  '下一步',
];

function fail(message) {
  console.error(`[check-roadmap-progress] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(roadmapPath)) {
  fail(`missing roadmap file: ${path.relative(rootDir, roadmapPath)}`);
}

const lines = fs.readFileSync(roadmapPath, 'utf8').split(/\r?\n/);
const templateIndex = lines.findIndex((line) => line.trim() === '## 进度更新模板');

if (templateIndex < 0) {
  fail('missing "## 进度更新模板" anchor');
}

const updateHeadingRegex = /^##\s+\d{4}-\d{2}-\d{2}\s+.*更新.*$/;
const updateSections = [];

for (let index = templateIndex + 1; index < lines.length; index += 1) {
  if (!updateHeadingRegex.test(lines[index].trim())) continue;

  let end = lines.length;
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (lines[cursor].startsWith('## ')) {
      end = cursor;
      break;
    }
  }

  updateSections.push({
    title: lines[index].trim(),
    startLine: index + 1,
    bodyStart: index + 1,
    bodyLines: lines.slice(index + 1, end),
  });
}

if (updateSections.length === 0) {
  fail('no progress update sections found after the template');
}

const issues = [];

for (const section of updateSections) {
  let previousFieldLine = -1;

  for (const field of requiredFields) {
    const matcher = new RegExp(`^-\\s+${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}：(?:\\s.*)?$`);
    const relativeLine = section.bodyLines.findIndex((line) => matcher.test(line.trim()));

    if (relativeLine < 0) {
      issues.push(`${section.title} (line ${section.startLine}) -> missing "- ${field}："`);
      continue;
    }

    const absoluteLine = section.startLine + 1 + relativeLine;
    if (absoluteLine <= previousFieldLine) {
      issues.push(`${section.title} (line ${section.startLine}) -> field order broken near "- ${field}："`);
      continue;
    }

    previousFieldLine = absoluteLine;
  }
}

if (issues.length) {
  console.error('[check-roadmap-progress] Roadmap progress updates do not match the expected template:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

const latest = updateSections[updateSections.length - 1];
console.log(
  `[check-roadmap-progress] OK (${updateSections.length} updates checked; latest: ${latest.title.replace(/^##\s+/, '')})`
);
