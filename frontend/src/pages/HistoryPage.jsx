import { useEffect } from 'react';
import HistoryTable from '../components/history/HistoryTable';
import Notice from '../components/ui/Notice';
import PageHeader from '../components/ui/PageHeader';
import { useLibraryStore } from '../store/library';

export default function HistoryPage() {
  const history = useLibraryStore((state) => state.history);
  const loading = useLibraryStore((state) => state.historyLoading);
  const error = useLibraryStore((state) => state.historyError);
  const fetchHistory = useLibraryStore((state) => state.fetchHistory);

  // Always fresh: a lending may have just been confirmed here or by someone else.
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <>
      <PageHeader title="Lending history" description="Every lending, newest first." />
      {error && <Notice tone="danger">{error}</Notice>}
      <HistoryTable lendings={history} emptyState={loading ? 'Loading history…' : 'No lending yet.'} />
    </>
  );
}
