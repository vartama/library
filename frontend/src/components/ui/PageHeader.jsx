import { PAGE_TITLE } from '../../lib/classes';

/** Page title with an optional one-line description and actions on the right. */
export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className={PAGE_TITLE}>{title}</h1>
        {description && <p className="m-0 text-[13px] leading-[18px] text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}
