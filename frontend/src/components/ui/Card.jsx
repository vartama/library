import { CARD, cx } from '../../lib/classes';

export default function Card({ as: Tag = 'div', className, ...props }) {
  return <Tag className={cx(CARD, className)} {...props} />;
}
