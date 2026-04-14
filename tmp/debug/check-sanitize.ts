import { sanitizeGeneratedCode } from '../../lib/test-generator.ts';

const runId = 'intent-run-1e71764f-e87b-4348-82a9-8fd9dbab2915';

const res = await fetch(`http://127.0.0.1:3666/api/intent-e2e/runs/${runId}`, {
  headers: { 'x-e2e-actor-uid': 'usr_default_owner' },
});
const data = await res.json();
const run = data?.run ?? {};
const attempt = run?.events?.findLast?.((event: any) => event.type === 'attempt_result' && event.attempt === 1);
const code = String(attempt?.code || '');
const sanitized = sanitizeGeneratedCode(code);

console.log(
  JSON.stringify(
    {
      same: code === sanitized,
      changedStep6: sanitized.includes("await page.goto('https://uat-service.yikaiye.com/#/payment/bookedMgmt'"),
      changedStep7:
        sanitized.includes("keywordInput: page.getByPlaceholder('请输入关键词').first()") ||
        sanitized.includes('resolvePrimaryRecord(page'),
      hasManualStep7: sanitized.includes('await keywordInput.fill(shared.selectedOrderNo);'),
    },
    null,
    2
  )
);
