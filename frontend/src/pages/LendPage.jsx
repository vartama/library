import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LendingForm from '../components/lending/LendingForm';
import LendingSummary from '../components/lending/LendingSummary';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { useLibraryStore } from '../store/library';

export default function LendPage() {
  const navigate = useNavigate();
  const overview = useLibraryStore((state) => state.overview);
  const step = useLibraryStore((state) => state.lending.step);
  const fetchOverview = useLibraryStore((state) => state.fetchOverview);
  const leaveLending = useLibraryStore((state) => state.leaveLending);

  // Fresh totals every visit; leaving the page returns to step 1 but keeps what was typed.
  useEffect(() => {
    fetchOverview();
    return leaveLending;
  }, [fetchOverview, leaveLending]);

  let content;
  if (step === 'review') {
    // After confirming, the design returns to Books with the confirmation notice.
    content = <LendingSummary onConfirmed={() => navigate('/')} />;
  } else if (overview && overview.totalCopies === 0) {
    content = <Card className="text-center text-muted">Nothing available to lend. Add stock on the Books page.</Card>;
  } else {
    content = <LendingForm />;
  }

  return (
    <>
      <PageHeader
        title="Lend books"
        description="Lend one or more books to a borrower. Stock changes only after you confirm."
      />
      {content}
    </>
  );
}
