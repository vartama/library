import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from './ui/Icon';
import { ICON_BUTTON, NAV_ITEM, NAV_SECTION } from '../lib/classes';
import { formatLongDate } from '../lib/date';
import { selectIsAdmin, useLibraryStore } from '../store/library';

const SECTIONS = [
  {
    title: 'Collection',
    items: [
      { to: '/', label: 'Books', icon: 'books', end: true },
      { to: '/genres', label: 'Genres', icon: 'tag', adminOnly: true },
    ],
  },
  {
    title: 'Lending',
    items: [
      { to: '/lend', label: 'Lend books', icon: 'lend' },
      { to: '/history', label: 'History', icon: 'history' },
    ],
  },
];

function SidebarNav({ onNavigate }) {
  const clearNotice = useLibraryStore((state) => state.clearNotice);
  const totalCopies = useLibraryStore((state) => state.overview?.totalCopies);
  const isAdmin = useLibraryStore(selectIsAdmin);
  const [today] = useState(() => formatLongDate(new Date()));

  const handleClick = () => {
    clearNotice();
    onNavigate?.();
  };

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 px-3">
        <p className="m-0 flex items-center gap-2 text-[13px] text-muted">
          <Icon name="calendar" size={16} />
          {today}
        </p>
        {totalCopies !== undefined && (
          <p className="m-0 flex items-center gap-2 text-[13px] text-muted">
            <Icon name="books" size={16} />
            {totalCopies} {totalCopies === 1 ? 'copy' : 'copies'} on the shelf
          </p>
        )}
      </div>
      {SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className={`${NAV_SECTION} mb-1 mt-0`}>{section.title}</p>
          {section.items
            .filter((item) => isAdmin || !item.adminOnly)
            .map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={NAV_ITEM} onClick={handleClick}>
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * Fixed column from 768px up; below that a drawer opened from the top bar's menu button.
 */
export default function Sidebar({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-raised px-3 py-6 md:block">
        <SidebarNav />
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-64 flex-col gap-4 bg-raised px-3 py-4 shadow-pop"
          >
            <div className="flex justify-end">
              <button type="button" className={ICON_BUTTON} onClick={onClose} aria-label="Close menu" autoFocus>
                <Icon name="close" />
              </button>
            </div>
            <SidebarNav onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
