import { describe, expect, it } from 'vitest';
import { validateCheckoutPhone } from '../../src/checkout.js';

describe('checkout integration', () => {
  it('accepts spaced phone input', () => {
    const result = validateCheckoutPhone('138 0013 8000');
    expect(result.ok).toBe(true);
    expect(result.normalized).toBe('13800138000');
  });

  it('rejects malformed input', () => {
    const result = validateCheckoutPhone('10086');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_PHONE');
  });
});
