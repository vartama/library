import { cloneElement } from 'react';
import { ERROR_TEXT, HINT_TEXT, LABEL, cx } from '../../lib/classes';

/**
 * A visible label above one control, plus an error (or hint) underneath.
 * Wires `id`, `aria-invalid` and `aria-describedby` onto the child control.
 */
export default function Field({ id, label, error, hint, className, children }) {
  const messageId = `${id}-message`;
  const message = error || hint;

  const control = cloneElement(children, {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': message ? messageId : undefined,
  });

  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      {control}
      {message && (
        <span id={messageId} className={error ? ERROR_TEXT : HINT_TEXT}>
          {message}
        </span>
      )}
    </div>
  );
}
