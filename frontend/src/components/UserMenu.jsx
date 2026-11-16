import Icon from './ui/Icon';
import { ICON_BUTTON } from '../lib/classes';
import { useLibraryStore } from '../store/library';

const ROLE_LABEL = { admin: 'Admin', user: 'Staff' };

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

export default function UserMenu() {
  const user = useLibraryStore((state) => state.user);
  const logout = useLibraryStore((state) => state.logout);

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-brand-soft text-[13px] font-semibold text-brand-text"
        aria-hidden="true"
      >
        {initials(user.name)}
      </span>
      <div className="hidden min-w-0 flex-col sm:flex">
        <span className="truncate text-sm font-semibold leading-5 text-ink">{user.name}</span>
        <span className="text-xs text-muted">{ROLE_LABEL[user.role]}</span>
      </div>
      <button type="button" className={ICON_BUTTON} onClick={logout} aria-label="Sign out" title="Sign out">
        <Icon name="signOut" />
      </button>
    </div>
  );
}
