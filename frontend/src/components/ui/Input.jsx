import { INPUT, cx } from '../../lib/classes';

export function Input({ className, ...props }) {
  return <input className={cx(INPUT, className)} {...props} />;
}

export function Select({ className, ...props }) {
  return <select className={cx(INPUT, className)} {...props} />;
}
