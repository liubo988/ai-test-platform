import { describe, expect, it } from 'vitest';
import { isValidCNPhone, normalizePhone } from '../../src/phone.js';

describe('phone utils', () => {
  it('should normalize spaces in phone string', () => {
    expect(normalizePhone('138 0013 8000')).toBe('13800138000');
  });

  it('should validate china mobile number', () => {
    expect(isValidCNPhone('13800138000')).toBe(true);
  });

  it('should reject invalid phone', () => {
    expect(isValidCNPhone('123')).toBe(false);
  });
});
