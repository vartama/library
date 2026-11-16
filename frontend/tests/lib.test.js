import { describe, expect, it } from 'vitest';
import { stockStatus } from '../src/lib/stock';
import { formatDate, todayISO } from '../src/lib/date';
import { cx } from '../src/lib/classes';

describe('stockStatus', () => {
  it.each([
    [0, 'out'],
    [1, 'low'],
    [2, 'low'],
    [3, 'ok'],
    [12, 'ok'],
  ])('%i copies → %s', (stock, status) => {
    expect(stockStatus(stock)).toBe(status);
  });
});

describe('formatDate', () => {
  it('formats a date-only value without shifting the day', () => {
    expect(formatDate('2026-10-11')).toBe('11 Oct 2026');
  });

  it('formats an ISO timestamp', () => {
    expect(formatDate(new Date(2026, 9, 4, 15, 30).toISOString())).toBe('04 Oct 2026');
  });
});

describe('todayISO', () => {
  it('returns the local date as YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', false, undefined, 'b', '')).toBe('a b');
  });
});
