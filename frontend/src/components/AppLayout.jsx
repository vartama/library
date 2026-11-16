import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Notice from './ui/Notice';
import { useLibraryStore } from '../store/library';

/** Top bar, sidebar and notice around the signed-in pages. */
export default function AppLayout() {
  const notice = useLibraryStore((state) => state.notice);
  const loadProfile = useLibraryStore((state) => state.loadProfile);
  const fetchOverview = useLibraryStore((state) => state.fetchOverview);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Refresh the stored profile and the copy count; an expired token is handled by the API
  // client (401 → sign in).
  useEffect(() => {
    loadProfile().catch(() => {});
    fetchOverview();
  }, [loadProfile, fetchOverview]);

  return (
    <div className="min-h-screen">
      <TopBar onOpenMenu={() => setMenuOpen(true)} />
      <div className="flex">
        <Sidebar open={menuOpen} onClose={closeMenu} />
        <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 md:px-8">
          <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
            {notice && <Notice>{notice}</Notice>}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
