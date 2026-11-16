import { TABLE_WRAP, TD, TH, cx } from '../../lib/classes';

// Below 640px tables become stacked cards (DESIGN.md → Layout): rows turn into blocks and each
// cell shows its column name from `label`, styled like the column header (overline).
const STACK_TABLE = 'max-sm:block';
const STACK_HEAD = 'max-sm:sr-only';
const STACK_BODY = 'max-sm:block';
const STACK_ROW = 'max-sm:block max-sm:border-b max-sm:border-line max-sm:px-4 max-sm:py-3 max-sm:last:border-b-0';
const STACK_CELL =
  'max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-4 max-sm:border-0 max-sm:px-0 max-sm:py-1 max-sm:text-left max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-muted max-sm:before:content-[attr(data-label)]';

/** `footer` (e.g. pagination) sits inside the same card, under the last row. */
export function Table({ className, footer, children }) {
  return (
    <div className={cx(TABLE_WRAP, className)}>
      <table className={cx('w-full border-collapse', STACK_TABLE)}>{children}</table>
      {footer && <div className="border-t border-line-strong bg-sunken px-4 py-3">{footer}</div>}
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className={STACK_HEAD}>
      <tr>{children}</tr>
    </thead>
  );
}

export function TBody({ children }) {
  return <tbody className={cx('[&>tr:last-child>td]:border-b-0', STACK_BODY)}>{children}</tbody>;
}

export function Tr({ className, children }) {
  return <tr className={cx(STACK_ROW, className)}>{children}</tr>;
}

export function Th({ align = 'left', className, ...props }) {
  return <th className={cx(TH, align === 'right' && 'text-right', className)} {...props} />;
}

/** `numeric` right-aligns with tabular numerals; `label` is the column name shown on small screens. */
export function Td({ label, numeric = false, className, ...props }) {
  return (
    <td
      data-label={label}
      className={cx(TD, STACK_CELL, numeric && 'text-right tabular-nums', className)}
      {...props}
    />
  );
}
