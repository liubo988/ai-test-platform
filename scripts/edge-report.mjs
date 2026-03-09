import fs from 'node:fs';
import path from 'node:path';

const casesPath = path.join(process.cwd(), 'edge-cases', 'cases.json');
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

const bySeverity = cases.reduce((acc, item) => {
  acc[item.severity] = (acc[item.severity] || 0) + 1;
  return acc;
}, {});

const report = {
  total: cases.length,
  bySeverity,
  generatedAt: new Date().toISOString()
};

fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), 'reports', 'edge-summary.json'), JSON.stringify(report, null, 2));
console.log('Edge case report saved to reports/edge-summary.json');
