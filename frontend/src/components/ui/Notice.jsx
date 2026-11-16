import { NOTICE_TONE, cx } from '../../lib/classes';

/** Status banner: `info` for "Lending confirmed…" style messages, `danger` for errors. */
export default function Notice({ tone = 'info', className, children }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('rounded-md border px-4 py-3 font-semibold', NOTICE_TONE[tone], className)}
    >
      {children}
    </div>
  );
}
