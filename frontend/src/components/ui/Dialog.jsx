import { useEffect, useId, useRef } from 'react';
import { SECTION_TITLE, cx } from '../../lib/classes';

const WIDTH = {
  sm: 'max-w-[420px]', // confirmations
  md: 'max-w-[560px]', // forms
};

/**
 * Modal dialog (the only surface that uses shadow-pop). Escape closes it, focus moves to the
 * element marked `data-autofocus` and returns to the trigger on close.
 *
 * Confirmations pass their buttons as `actions`; forms render their own buttons in `children`.
 */
export default function Dialog({ title, onClose, children, actions, size = 'sm', bodyClassName = 'text-muted' }) {
  const titleId = useId();
  const panelRef = useRef(null);
  // Kept in a ref so an inline `onClose` does not re-run the focus effect on every render.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    (panel.querySelector('[data-autofocus]') ?? panel).focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/50 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'w-full rounded-lg border border-line bg-raised p-6 shadow-pop focus:outline-none',
          WIDTH[size],
        )}
      >
        <h3 id={titleId} className={SECTION_TITLE}>
          {title}
        </h3>
        <div className={cx('mt-2', bodyClassName)}>{children}</div>
        {actions && <div className="mt-5 flex justify-end gap-3">{actions}</div>}
      </div>
    </div>
  );
}
