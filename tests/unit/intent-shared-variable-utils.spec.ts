import { describe, expect, it } from 'vitest';
import {
  buildIntentSharedVariableJsonPaths,
  looksLikeIntentPrimaryKeyVariable,
  looksLikeIntentStableIdentifierVariable,
} from '@/lib/intent-shared-variable-utils';

describe('intent-shared-variable-utils', () => {
  it('treats generic *Id style names as primary-key variables', () => {
    expect(looksLikeIntentPrimaryKeyVariable('businessId')).toBe(true);
    expect(looksLikeIntentPrimaryKeyVariable('orderId')).toBe(true);
    expect(looksLikeIntentPrimaryKeyVariable('customerId')).toBe(true);
    expect(looksLikeIntentPrimaryKeyVariable('contactPhone')).toBe(false);
  });

  it('recognizes non-*Id stable identifiers while excluding transient codes and list ordinals', () => {
    expect(looksLikeIntentStableIdentifierVariable('recordUid')).toBe(true);
    expect(looksLikeIntentStableIdentifierVariable('customerCode')).toBe(true);
    expect(looksLikeIntentStableIdentifierVariable('serialNo')).toBe(true);
    expect(looksLikeIntentStableIdentifierVariable('bizNo')).toBe(true);
    expect(looksLikeIntentStableIdentifierVariable('statusCode')).toBe(false);
    expect(looksLikeIntentStableIdentifierVariable('smsCode')).toBe(false);
    expect(looksLikeIntentStableIdentifierVariable('pageNo')).toBe(false);
  });

  it('builds nested JSON candidate paths and generic id fallbacks for primary keys', () => {
    expect(buildIntentSharedVariableJsonPaths('businessId')).toEqual([
      'businessId',
      'data.businessId',
      'result.businessId',
      'data.data.businessId',
      'id',
      'data.id',
      'result.id',
      'data.data.id',
    ]);
  });

  it('does not append generic id fallbacks for non-id shared variables', () => {
    expect(buildIntentSharedVariableJsonPaths('contactPhone')).toEqual([
      'contactPhone',
      'data.contactPhone',
      'result.contactPhone',
      'data.data.contactPhone',
    ]);
  });

  it('builds generic id fallbacks for arbitrary id-like shared variables', () => {
    expect(buildIntentSharedVariableJsonPaths('customerId')).toEqual([
      'customerId',
      'data.customerId',
      'result.customerId',
      'data.data.customerId',
      'id',
      'data.id',
      'result.id',
      'data.data.id',
    ]);
  });

  it('builds generic code fallbacks for stable code-like shared variables', () => {
    expect(buildIntentSharedVariableJsonPaths('customerCode')).toEqual([
      'customerCode',
      'data.customerCode',
      'result.customerCode',
      'data.data.customerCode',
      'code',
      'data.code',
      'result.code',
      'data.data.code',
    ]);
  });

  it('builds serial and no-style fallbacks for serial-number shared variables', () => {
    expect(buildIntentSharedVariableJsonPaths('serialNo')).toEqual([
      'serialNo',
      'data.serialNo',
      'result.serialNo',
      'data.data.serialNo',
      'serial',
      'data.serial',
      'result.serial',
      'data.data.serial',
      'serialNumber',
      'data.serialNumber',
      'result.serialNumber',
      'data.data.serialNumber',
      'no',
      'data.no',
      'result.no',
      'data.data.no',
      'number',
      'data.number',
      'result.number',
      'data.data.number',
    ]);
  });
});
