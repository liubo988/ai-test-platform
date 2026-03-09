import { describe, it, expect } from 'vitest';
import { validateCheckoutPhone } from '../../../src/checkout.js';

describe("generated edge cases: checkout", () => {
  it("EC-2026-0001 手机号含空格导致下单失败", () => {
    const result = validateCheckoutPhone("138 0013 8000");
    expect(result.ok).toBe(true);
  });
});
