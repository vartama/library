import { BTN_BASE, BTN_SIZE, BTN_VARIANT, cx } from '../../lib/classes';

/**
 * Variants follow the Button guideline: one `primary` per view, `accent` for anything that moves
 * stock, `danger-quiet` for Remove in a row and `danger` only inside the confirmation dialog.
 */
export default function Button({ variant = 'primary', size = 'md', type = 'button', className, ...props }) {
  return <button type={type} className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)} {...props} />;
}
