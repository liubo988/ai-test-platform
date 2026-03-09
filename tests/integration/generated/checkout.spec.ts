import { describe, it, expect } from 'vitest'
import { validateCheckoutPhone } from '../../../src/checkout.js'

describe('checkout - validateCheckoutPhone', () => {
  it('EC-2026-0001 should trim internal spaces in phone and pass validation', () => {
    const input = { phone: '138 0013 8000' }

    const result = validateCheckoutPhone(input.phone)

    if (typeof result === 'boolean') {
      expect(result).toBe(true)
      return
    }

    if (typeof result === 'string') {
      expect(result).toBe('13800138000')
      return
    }

    if (result && typeof result === 'object') {
      if ('valid' in result) {
        expect((result as { valid: boolean }).valid).toBe(true)
      }
      if ('phone' in result) {
        expect((result as { phone: string }).phone).toBe('13800138000')
      }
      return
    }

    throw new Error('Unsupported return type from validateCheckoutPhone')
  })
})
