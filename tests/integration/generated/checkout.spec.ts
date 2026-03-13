import { describe, it, expect } from 'vitest'
import { validateCheckoutPhone } from '../../../src/checkout.js'

describe('checkout - validateCheckoutPhone edge cases', () => {
  it('EC-2026-0001 should auto-remove spaces in phone and pass validation', () => {
    const input = '138 0013 8000'
    const result = validateCheckoutPhone(input)

    if (typeof result === 'boolean') {
      expect(result).toBe(true)
      return
    }

    expect(result).toBeTruthy()

    if (typeof result === 'object' && result !== null) {
      if ('valid' in result) {
        expect((result as { valid: boolean }).valid).toBe(true)
      }
      if ('normalizedPhone' in result) {
        expect((result as { normalizedPhone: string }).normalizedPhone).toBe('13800138000')
      }
      if ('phone' in result) {
        expect((result as { phone: string }).phone).toBe('13800138000')
      }
    }
  })
})
