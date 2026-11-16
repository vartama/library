// Design system class recipes. Components import these instead of retyping class strings.

export const cx = (...classes) => classes.filter(Boolean).join(' ');

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export const BTN_BASE = `inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-transparent px-4 py-2 text-sm font-semibold ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-45`;

export const BTN_VARIANT = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover',
  accent: 'bg-accent text-on-accent hover:brightness-90',
  secondary: 'bg-raised text-ink border-line-strong hover:bg-sunken',
  ghost: 'text-brand-text hover:bg-brand-soft',
  danger: 'bg-danger text-on-danger',
  'danger-quiet': 'border-danger text-danger hover:bg-danger-soft',
};

export const BTN_SIZE = {
  md: '',
  sm: '!min-h-8 !px-3 !py-1 !text-[13px]',
};

export const INPUT = `min-h-10 w-full rounded-md border border-line-strong bg-raised px-3 py-2 text-[15px] text-ink placeholder:text-muted ${FOCUS_RING} aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger`;

export const LABEL = 'text-[13px] font-semibold leading-4 text-ink';
export const ERROR_TEXT = 'text-xs text-danger';
export const HINT_TEXT = 'text-xs text-muted';

export const BADGE = 'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold';
export const GENRE_BADGE =
  'inline-flex items-center rounded-pill border border-line-strong bg-sunken px-2.5 py-0.5 text-xs font-semibold text-ink';
export const STOCK_BADGE_TONE = {
  ok: 'bg-brand-soft text-brand-text',
  low: 'bg-warn-soft text-warn',
  out: 'bg-danger-soft text-danger',
};
export const DUE_BADGE_TONE = 'bg-accent-soft text-accent';

export const CHIP = `rounded-pill border border-line-strong bg-raised px-3.5 py-2 text-[13px] font-semibold text-ink ${FOCUS_RING} aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-on-brand`;

export const CARD = 'rounded-lg border border-line bg-raised p-6 shadow-card';

export const TABLE_WRAP = 'overflow-hidden rounded-lg border border-line bg-raised shadow-card';
export const TH =
  'bg-sunken px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted border-b border-line-strong';
export const TD = 'border-b border-line px-4 py-3 align-middle';
export const TH_SORT_BUTTON = `inline-flex items-center gap-1.5 rounded-sm uppercase tracking-wider ${FOCUS_RING}`;

export const BOOK_TITLE = 'font-display text-base font-semibold text-ink';
export const PAGE_TITLE = 'm-0 font-display text-[28px] font-semibold leading-[34px]';
export const SECTION_TITLE = 'm-0 text-lg font-bold leading-6';

// App shell: top bar + sidebar navigation. The active item uses the same tokens as the active tab
// in the design system (brand underline → brand bar, brand-text label) on a brand-soft tint.
export const NAV_ITEM = `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink ${FOCUS_RING} before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-pill aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-text aria-[current=page]:before:bg-brand`;
export const NAV_SECTION = 'px-3 text-xs font-semibold uppercase tracking-wider text-muted';
export const ICON_BUTTON = `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink ${FOCUS_RING}`;

export const NOTICE_TONE = {
  info: 'border-brand bg-brand-soft text-brand-text',
  danger: 'border-danger bg-danger-soft text-danger',
};
