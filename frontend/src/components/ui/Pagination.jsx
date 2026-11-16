import { useId } from 'react';
import { Select } from './Input';
import { cx } from '../../lib/classes';
import { pageList } from '../../lib/pagination';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const PAGE_BUTTON = `inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] font-semibold tabular-nums ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-45`;
const PAGE_IDLE = 'text-ink hover:bg-raised';
const PAGE_CURRENT = 'bg-brand text-on-brand';

const number = (n) => n.toLocaleString('en-GB');

/**
 * Datatable footer: rows per page, "Showing 21–40 of 1,000 books" and numbered page buttons.
 */
export default function Pagination({
  page,
  pageSize,
  pageSizes,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  noun = ['book', 'books'],
}) {
  const sizeId = useId();
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const go = (target) => () => onPageChange(target);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="text-[13px] text-muted">
            Rows per page
          </label>
          <Select
            id={sizeId}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="!min-h-8 !w-auto !py-1 !text-[13px]"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        <p className="m-0 text-[13px] text-muted" aria-live="polite">
          Showing {number(first)}–{number(last)} of {number(total)} {total === 1 ? noun[0] : noun[1]}
        </p>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination">
          <ul className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
            <li>
              <button type="button" className={cx(PAGE_BUTTON, PAGE_IDLE)} onClick={go(1)} disabled={page <= 1} aria-label="First page">
                «
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cx(PAGE_BUTTON, PAGE_IDLE)}
                onClick={go(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                ‹
              </button>
            </li>
            {pageList(page, totalPages).map((item, index) =>
              item === '…' ? (
                // eslint-disable-next-line react/no-array-index-key
                <li key={`gap-${index}`} className="px-1 text-[13px] text-muted" aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={item}>
                  <button
                    type="button"
                    className={cx(PAGE_BUTTON, item === page ? PAGE_CURRENT : PAGE_IDLE)}
                    onClick={go(item)}
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? 'page' : undefined}
                  >
                    {number(item)}
                  </button>
                </li>
              ),
            )}
            <li>
              <button
                type="button"
                className={cx(PAGE_BUTTON, PAGE_IDLE)}
                onClick={go(page + 1)}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                ›
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cx(PAGE_BUTTON, PAGE_IDLE)}
                onClick={go(totalPages)}
                disabled={page >= totalPages}
                aria-label="Last page"
              >
                »
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
