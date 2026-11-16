import Icon from './ui/Icon';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
import { ICON_BUTTON } from '../lib/classes';

// No logo in the design system: the name is set in Fraunces.
export default function TopBar({ onOpenMenu }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-raised px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" className={`${ICON_BUTTON} md:hidden`} onClick={onOpenMenu} aria-label="Open menu">
          <Icon name="menu" />
        </button>
        <span className="truncate font-display text-[20px] font-semibold leading-7">Vartama Library</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
