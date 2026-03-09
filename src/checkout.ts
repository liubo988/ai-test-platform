import { isValidCNPhone, normalizePhone } from './phone.js';

export function validateCheckoutPhone(phone: string): { ok: boolean; normalized?: string; reason?: string } {
  const normalized = normalizePhone(phone);
  if (!isValidCNPhone(normalized)) {
    return { ok: false, reason: 'INVALID_PHONE' };
  }
  return { ok: true, normalized };
}
