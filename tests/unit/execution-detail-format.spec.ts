import { describe, expect, it } from 'vitest';

import { formatExecutionMoment, summarizeExecutionTextList } from '../../lib/execution-detail-format';

describe('execution-detail-format', () => {
  it('returns a stable placeholder for empty or invalid timestamps', () => {
    expect(formatExecutionMoment('')).toBe('-');
    expect(formatExecutionMoment('not-a-date')).toBe('-');
  });

  it('formats valid timestamps into a compact zh-CN month/day time string', () => {
    expect(formatExecutionMoment('2026-03-31T11:08:00+08:00')).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it('trims, filters and summarizes text items with a limit', () => {
    expect(summarizeExecutionTextList([' foo ', ' ', 'bar'])).toBe('foo / bar');
    expect(summarizeExecutionTextList(['foo', 'bar', 'baz'], 2)).toBe('foo / bar 等 3 项');
    expect(summarizeExecutionTextList(['   '])).toBe('');
  });
});
