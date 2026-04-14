import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('test-worker primary lookup candidates', () => {
  it('covers account-list keyword input variants used by batch-account flows', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'lib/test-worker.mjs'), 'utf8');

    expect(source).toContain("#service-data-item_keyWord");
    expect(source).toContain('#form_in_modal_testKeyWord');
    expect(source).toContain(
      'input[id*="testKeyWord"], input[name*="testKeyWord"], input[id*="keyWord"], input[name*="keyWord"]'
    );
    expect(source).toContain('请输入关键词');
  });
});
