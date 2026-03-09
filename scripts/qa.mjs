import { spawnSync } from 'node:child_process';

const steps = [
  ['edge:generate', ['run', 'edge:generate']],
  ['test:unit', ['run', 'test:unit']],
  ['test:integration', ['run', 'test:integration']],
  ['test:e2e', ['run', 'test:e2e']],
];

for (const [name, args] of steps) {
  console.log(`\n========== ${name} ==========`);
  const r = spawnSync('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n❌ QA failed at step: ${name}`);
    console.error('建议排查：');
    if (name === 'edge:generate') console.error('- 检查 edge-cases/cases.json 格式与字段');
    if (name === 'test:unit') console.error('- 检查 src 与 tests/unit 的断言与导入路径');
    if (name === 'test:integration') console.error('- 检查生成测试 tests/integration/generated 与业务函数契约');
    if (name === 'test:e2e') console.error('- 检查 Playwright 浏览器安装、页面路由与环境变量 E2E_BASE_URL');
    process.exit(r.status || 1);
  }
}

console.log('\n✅ QA success: edge generation + unit + integration + e2e all passed.');
