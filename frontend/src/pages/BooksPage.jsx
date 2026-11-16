import { useEffect, useState } from 'react';
import BookFormDialog from '../components/books/BookFormDialog';
import BookTable from '../components/books/BookTable';
import FilterBar from '../components/books/FilterBar';
import RemoveBookDialog from '../components/books/RemoveBookDialog';
import Button from '../components/ui/Button';
import Notice from '../components/ui/Notice';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import { PAGE_SIZES, selectIsAdmin, useLibraryStore } from '../store/library';

export default function BooksPage() {
  const books = useLibraryStore((state) => state.books);
  const loading = useLibraryStore((state) => state.booksLoading);
  const error = useLibraryStore((state) => state.booksError);
  const filters = useLibraryStore((state) => state.filters);
  const genres = useLibraryStore((state) => state.genres);
  const fetchBooks = useLibraryStore((state) => state.fetchBooks);
  const fetchGenres = useLibraryStore((state) => state.fetchGenres);
  const booksPage = useLibraryStore((state) => state.booksPage);
  const setGenre = useLibraryStore((state) => state.setGenre);
  const setSearch = useLibraryStore((state) => state.setSearch);
  const setPage = useLibraryStore((state) => state.setPage);
  const setPageSize = useLibraryStore((state) => state.setPageSize);
  const toggleSort = useLibraryStore((state) => state.toggleSort);
  const clearNotice = useLibraryStore((state) => state.clearNotice);
  const isAdmin = useLibraryStore(selectIsAdmin);

  // Which dialog is open: { type: 'add' } | { type: 'edit', book } | { type: 'remove', book } | null
  const [dialog, setDialog] = useState(null);
  const closeDialog = () => setDialog(null);
  const open = (type, book) => {
    clearNotice();
    setDialog({ type, book });
  };

  useEffect(() => {
    fetchBooks();
    fetchGenres();
  }, [fetchBooks, fetchGenres]);

  // Only genres that have books are offered (FilterBar guideline: derived from the books present).
  const genresWithBooks = genres.filter((genre) => genre.bookCount > 0);
  const libraryIsEmpty = !loading && !filters.genreId && !filters.search && booksPage.total === 0;

  let emptyState = filters.search ? `No books match “${filters.search}”.` : 'No books in this genre.';
  if (loading) {
    emptyState = 'Loading books…';
  } else if (libraryIsEmpty) {
    emptyState = isAdmin ? (
      <div className="flex flex-col items-center gap-3">
        <span>No books yet. Add your first book.</span>
        <Button onClick={() => open('add')}>Add book</Button>
      </div>
    ) : (
      'No books yet.'
    );
  }

  return (
    <>
      <PageHeader title="Books" description="Every book in the library and how many copies are on the shelf.">
        {isAdmin && !libraryIsEmpty && <Button onClick={() => open('add')}>+ Add book</Button>}
      </PageHeader>

      {error && <Notice tone="danger">{error}</Notice>}

      {!libraryIsEmpty && (
        <FilterBar
          genres={genresWithBooks}
          genreId={filters.genreId}
          search={filters.search}
          onGenreChange={setGenre}
          onSearchChange={setSearch}
        />
      )}

      <BookTable
        books={books}
        sort={filters}
        onSort={toggleSort}
        onEdit={isAdmin ? (book) => open('edit', book) : undefined}
        onRemove={isAdmin ? (book) => open('remove', book) : undefined}
        emptyState={emptyState}
        footer={
          <Pagination
            page={booksPage.page}
            pageSize={filters.limit}
            pageSizes={PAGE_SIZES}
            total={booksPage.total}
            totalPages={booksPage.totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        }
      />

      {(dialog?.type === 'add' || dialog?.type === 'edit') && (
        <BookFormDialog book={dialog.book} onClose={closeDialog} />
      )}
      {dialog?.type === 'remove' && <RemoveBookDialog book={dialog.book} onClose={closeDialog} />}
    </>
  );
}
