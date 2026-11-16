import { useEffect, useState } from 'react';
import GenreFormDialog from '../components/genres/GenreFormDialog';
import GenreTable from '../components/genres/GenreTable';
import RemoveGenreDialog from '../components/genres/RemoveGenreDialog';
import Button from '../components/ui/Button';
import Notice from '../components/ui/Notice';
import PageHeader from '../components/ui/PageHeader';
import { useLibraryStore } from '../store/library';

// Admin-only page (see RequireAdmin in App).
export default function GenresPage() {
  const genres = useLibraryStore((state) => state.genres);
  const loading = useLibraryStore((state) => state.genresLoading);
  const error = useLibraryStore((state) => state.genresError);
  const fetchGenres = useLibraryStore((state) => state.fetchGenres);
  const clearNotice = useLibraryStore((state) => state.clearNotice);

  // { type: 'add' } | { type: 'edit', genre } | { type: 'remove', genre } | null
  const [dialog, setDialog] = useState(null);
  const closeDialog = () => setDialog(null);
  const open = (type, genre) => {
    clearNotice();
    setDialog({ type, genre });
  };

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  const emptyState = loading ? (
    'Loading genres…'
  ) : (
    <div className="flex flex-col items-center gap-3">
      <span>No genres yet. Add the first one.</span>
      <Button onClick={() => open('add')}>Add genre</Button>
    </div>
  );

  return (
    <>
      <PageHeader title="Genres" description="The genres a book can be filed under.">
        {genres.length > 0 && <Button onClick={() => open('add')}>+ Add genre</Button>}
      </PageHeader>

      {error && <Notice tone="danger">{error}</Notice>}

      <GenreTable
        genres={genres}
        onEdit={(genre) => open('edit', genre)}
        onRemove={(genre) => open('remove', genre)}
        emptyState={emptyState}
      />

      {(dialog?.type === 'add' || dialog?.type === 'edit') && (
        <GenreFormDialog genre={dialog.genre} onClose={closeDialog} />
      )}
      {dialog?.type === 'remove' && <RemoveGenreDialog genre={dialog.genre} onClose={closeDialog} />}
    </>
  );
}
