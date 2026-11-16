import { BADGE, DUE_BADGE_TONE, GENRE_BADGE, STOCK_BADGE_TONE, cx } from '../../lib/classes';
import { STOCK_STATUS, stockStatus } from '../../lib/stock';
import { formatDate } from '../../lib/date';

export function GenreBadge({ genre }) {
  return <span className={GENRE_BADGE}>{genre}</span>;
}

/** Always a symbol plus a word, so colour is never the only signal. */
export function StockBadge({ stock }) {
  const status = stockStatus(stock);
  const { symbol, label } = STOCK_STATUS[status];

  return (
    <span className={cx(BADGE, STOCK_BADGE_TONE[status])}>
      {symbol} {label}
    </span>
  );
}

export function DueBadge({ date }) {
  return <span className={cx(BADGE, DUE_BADGE_TONE)}>{formatDate(date)}</span>;
}
