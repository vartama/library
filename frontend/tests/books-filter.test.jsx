import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as booksApi from '../src/api/books.api';
import * as genresApi from '../src/api/genres.api';
import { useLibraryStore } from '../src/store/library';
import { STAFF, pageOf, renderApp, resetStore } from './helpers';

vi.mock('../src/api/lendings.api', () => ({ createLending: vi.fn(), getLendings: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/api/auth.api', () => ({ login: vi.fn(), getProfile: vi.fn(() => new Promise(() => {})) }));
vi.mock('../src/api/genres.api', () => ({
  getGenres: vi.fn(),
  createGenre: vi.fn(),
  updateGenre: vi.fn(),
  deleteGenre: vi.fn(),
}));
vi.mock('../src/api/books.api', () => ({
  getBooks: vi.fn(),
  getOverview: vi.fn(),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
}));

const FICTION = { id: 'g-fiction', name: 'Fiction' };
const SCIENCE = { id: 'g-science', name: 'Science' };
const GENRES = [
  { ...FICTION, bookCount: 2 },
  { id: 'g-poetry', name: 'Poetry', bookCount: 0 },
  { ...SCIENCE, bookCount: 2 },
];
const BOOKS = [
  { id: 'b1', title: 'River of Salt', author: 'A', genre: FICTION, stock: 2 },
  { id: 'b2', title: 'Letters from the Harbour', author: 'B', genre: FICTION, stock: 8 },
  { id: 'b3', title: 'The Pragmatic Gardener', author: 'C', genre: SCIENCE, stock: 6 },
  { id: 'b4', title: 'A Brief Guide to Stars', author: 'D', genre: SCIENCE, stock: 0 },
];

// Stands in for the API: filters by genre and sorts like the backend does.
function fakeServer({ genreId, sortBy = 'title', order = 'asc' } = {}) {
  const direction = order === 'desc' ? -1 : 1;
  const books = BOOKS.filter((book) => !genreId || book.genre.id === genreId);
  books.sort((a, b) =>
    sortBy === 'stock'
      ? direction * (a.stock - b.stock) || a.title.localeCompare(b.title)
      : direction * a.title.localeCompare(b.title),
  );
  return Promise.resolve(pageOf(books));
}

const shownTitles = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('.font-display')?.textContent);

async function renderBooksPage() {
  const user = userEvent.setup();
  resetStore(STAFF);
  renderApp('/');
  await screen.findByText('River of Salt');
  return user;
}

beforeEach(() => {
  vi.mocked(booksApi.getBooks).mockReset().mockImplementation(fakeServer);
  vi.mocked(booksApi.getOverview).mockReset().mockResolvedValue({ totalBooks: 4, totalCopies: 16 });
  vi.mocked(genresApi.getGenres).mockReset().mockResolvedValue(GENRES);
});

describe('Genre filter (F4)', () => {
  const genreSelect = () => screen.getByRole('combobox', { name: 'Genre' });
  const chooseGenre = async (user, name) => {
    await waitFor(() => expect(within(genreSelect()).getByRole('option', { name })).toBeInTheDocument());
    await user.selectOptions(genreSelect(), name);
  };

  it('offers "All genres" plus the genres that have books, as a select', async () => {
    await renderBooksPage();

    await waitFor(() =>
      expect(within(genreSelect()).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'All genres',
        'Fiction',
        'Science',
      ]),
    );
    expect(genreSelect()).toHaveDisplayValue('All genres');
  });

  it('shows no result count', async () => {
    await renderBooksPage();

    expect(screen.queryByText(/^\d+ books?$/)).not.toBeInTheDocument();
  });

  it('shows only the books of the chosen genre', async () => {
    const user = await renderBooksPage();

    await chooseGenre(user, 'Science');

    await waitFor(() => expect(shownTitles()).toEqual(['A Brief Guide to Stars', 'The Pragmatic Gardener']));
    expect(booksApi.getBooks).toHaveBeenLastCalledWith({ genreId: 'g-science', sortBy: 'title', order: 'asc', page: 1, limit: 20 });
    expect(genreSelect()).toHaveDisplayValue('Science');

    await user.selectOptions(genreSelect(), 'All genres');
    await waitFor(() => expect(shownTitles()).toHaveLength(4));
    expect(booksApi.getBooks).toHaveBeenLastCalledWith({ sortBy: 'title', order: 'asc', page: 1, limit: 20 });
  });

  it('says so when a genre has no books', async () => {
    booksApi.getBooks.mockImplementation((params) => (params.genreId ? Promise.resolve(pageOf([])) : fakeServer(params)));
    const user = await renderBooksPage();

    await chooseGenre(user, 'Fiction');

    expect(await screen.findByText('No books in this genre.')).toBeInTheDocument();
  });

  it('goes back to all genres when the active genre has no books left', async () => {
    const user = await renderBooksPage();
    await chooseGenre(user, 'Fiction');
    await waitFor(() => expect(shownTitles()).toHaveLength(2));

    genresApi.getGenres.mockResolvedValue(GENRES.map((g) => (g.id === 'g-fiction' ? { ...g, bookCount: 0 } : g)));
    await useLibraryStore.getState().fetchGenres();

    expect(useLibraryStore.getState().filters.genreId).toBeNull();
    await waitFor(() => expect(shownTitles()).toHaveLength(4));
    expect(genreSelect()).toHaveDisplayValue('All genres');
  });
});

describe('Sort (F5)', () => {
  const header = (name) => within(screen.getByRole('columnheader', { name })).getByRole('button');

  it('sorts by title A–Z by default', async () => {
    await renderBooksPage();

    expect(shownTitles()).toEqual([
      'A Brief Guide to Stars',
      'Letters from the Harbour',
      'River of Salt',
      'The Pragmatic Gardener',
    ]);
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /Stock/ })).toHaveAttribute('aria-sort', 'none');
  });

  it('has no separate sort select', async () => {
    await renderBooksPage();

    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument();
  });

  it('sorts from the column headers', async () => {
    const user = await renderBooksPage();

    await user.click(header(/Stock/));
    await waitFor(() =>
      expect(shownTitles()).toEqual([
        'A Brief Guide to Stars',
        'River of Salt',
        'The Pragmatic Gardener',
        'Letters from the Harbour',
      ]),
    );
    expect(booksApi.getBooks).toHaveBeenLastCalledWith({ sortBy: 'stock', order: 'asc', page: 1, limit: 20 });
    expect(header(/Stock/)).toHaveTextContent('Stock ▲');
    expect(screen.getByRole('columnheader', { name: /Stock/ })).toHaveAttribute('aria-sort', 'ascending');

    await user.click(header(/Stock/));
    await waitFor(() => expect(shownTitles()[0]).toBe('Letters from the Harbour'));
    expect(header(/Stock/)).toHaveTextContent('Stock ▼');
    expect(header(/Title/)).toHaveTextContent('Title ↕');

    await user.click(header(/Title/));
    await waitFor(() => expect(shownTitles()[0]).toBe('A Brief Guide to Stars'));
    expect(booksApi.getBooks).toHaveBeenLastCalledWith({ sortBy: 'title', order: 'asc', page: 1, limit: 20 });

    await user.click(header(/Title/));
    await waitFor(() => expect(shownTitles()[0]).toBe('The Pragmatic Gardener'));
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('keeps the sort when filtering', async () => {
    const user = await renderBooksPage();

    await user.click(header(/Stock/));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Fiction' })).toBeInTheDocument());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Genre' }), 'Fiction');

    await waitFor(() => expect(shownTitles()).toEqual(['River of Salt', 'Letters from the Harbour']));
    expect(booksApi.getBooks).toHaveBeenLastCalledWith({ genreId: 'g-fiction', sortBy: 'stock', order: 'asc', page: 1, limit: 20 });
  });
});

describe('out-of-order responses', () => {
  it('shows the result of the newest request', async () => {
    await renderBooksPage();
    let resolveSlow;
    booksApi.getBooks
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSlow = resolve)))
      .mockImplementationOnce(fakeServer);

    const slow = useLibraryStore.getState().setGenre('g-fiction');
    await useLibraryStore.getState().setGenre('g-science');
    resolveSlow(pageOf(BOOKS.slice(0, 2)));
    await slow;

    expect(useLibraryStore.getState().books.map((b) => b.id)).toEqual(['b4', 'b3']);
  });
});
