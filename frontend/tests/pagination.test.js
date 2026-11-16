import { describe, expect, it } from 'vitest';
import { pageList } from '../src/lib/pagination';

describe('pageList', () => {
  it.each([
    [1, 1, [1]],
    [2, 5, [1, 2, 3, 4, 5]],
    [4, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 50, [1, 2, 3, 4, '…', 50]],
    [3, 50, [1, 2, 3, 4, '…', 50]],
    [4, 50, [1, 2, 3, 4, 5, '…', 50]],
    [5, 50, [1, '…', 4, 5, 6, '…', 50]],
    [47, 50, [1, '…', 46, 47, 48, 49, 50]],
    [25, 50, [1, '…', 24, 25, 26, '…', 50]],
    [48, 50, [1, '…', 47, 48, 49, 50]],
    [50, 50, [1, '…', 47, 48, 49, 50]],
  ])('page %i of %i → %j', (page, totalPages, expected) => {
    expect(pageList(page, totalPages)).toEqual(expected);
  });
});
