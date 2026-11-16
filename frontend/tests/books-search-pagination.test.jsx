import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as booksApi from '../src/api/books.api';
import { useLibraryStore } from '../src/store/library';
import { STAFF, pageOf, renderApp, resetStore } from './helpers';

vi.mock('../src/api/auth.api', () => ({ login: vi.fn(), getProfile: vi.fn(() => new Promise(() => {})) }));
vi.mock('../src/api/genres.api', () => ({
  getGenres: vi.fn().mockResolvedValue([{ id: 'g1', name: 'Fiction', bookCount: 45 }]),
}));
vi.mock('../src/api/lendings.api', () => ({ createLending: vi.fn(), getLendings: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/api/books.api', () => ({
  getBooks: vi.fn(),
  getOverview: vi.fn(),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
}));

const FICTION = { id: 'g1', name: 'Fiction' };
// 45 books: "Book 01" … "Book 45"; "River of Salt" is Book 07's real title.
const ALL = Array.from({ length: 45 }, (_, i) => ({
  id: `b${i + 1}`,
  title: i === 6 ? 'River of Salt' : `Book ${String(i + 1).padStart(2, '0')}`,
  author: 'Someone',
  genre: FICTION,
  stock: 3,
}));

// Stands in for GET /api/books: search on title, then one page.
function fakeServer({ search = '', page = 1, limit = 20 } = {}) {
  const matches = ALL.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()));
  return Promise.resolve(pageOf(matches.slice((page - 1) * limit, page * limit), { page, limit, total: matches.length }));
}

const shownTitles = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('.font-display')?.textContent);
const pagination = () => screen.getByRole('navigation', { name: 'Pagination' });

async function renderBooksPage() {
  const user = userEvent.setup();
  resetStore(STAFF);
  renderApp('/');
  await screen.findByText('Book 01');
  return user;
}

beforeEach(() => {
  vi.mocked(booksApi.getBooks).mockReset().mockImplementation(fakeServer);
  vi.mocked(booksApi.getOverview).mockReset().mockResolvedValue({ totalBooks: 45, totalCopies: 135 });
});

describe('Pagination', () => {
  it('shows the first 20 books and a datatable footer', async () => {
    await renderBooksPage();

    expect(shownTitles()).toHaveLength(20);
    expect(screen.getByText('Showing 1–20 of 45 books')).toBeInTheDocument();
    expect(screen.getByLabelText('Rows per page')).toHaveValue('20');
    expect(within(pagination()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'First page',
      'Previous page',
      'Page 1',
      'Page 2',
      'Page 3',
      'Next page',
      'Last page',
    ]);
    expect(within(pagination()).getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(within(pagination()).getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(within(pagination()).getByRole('button', { name: 'First page' })).toBeDisabled();
  });

  it('moves between pages with the arrows and the page numbers', async () => {
    const user = await renderBooksPage();

    await user.click(within(pagination()).getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(shownTitles()[0]).toBe('Book 21'));
    expect(booksApi.getBooks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 20 }));
    expect(within(pagination()).getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(pagination()).getByRole('button', { name: 'Page 3' }));
    await waitFor(() => expect(shownTitles()).toEqual(['Book 41', 'Book 42', 'Book 43', 'Book 44', 'Book 45']));
    expect(screen.getByText('Showing 41–45 of 45 books')).toBeInTheDocument();
    expect(within(pagination()).getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(within(pagination()).getByRole('button', { name: 'Last page' })).toBeDisabled();

    await user.click(within(pagination()).getByRole('button', { name: 'First page' }));
    await waitFor(() => expect(shownTitles()[0]).toBe('Book 01'));
  });

  it('changes the number of rows per page and starts again from page 1', async () => {
    const user = await renderBooksPage();
    await user.click(within(pagination()).getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(shownTitles()[0]).toBe('Book 21'));

    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');

    await waitFor(() => expect(shownTitles()).toHaveLength(45));
    expect(booksApi.getBooks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
    expect(screen.getByText('Showing 1–45 of 45 books')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('starts again from page 1 when the sort changes', async () => {
    const user = await renderBooksPage();
    await user.click(within(pagination()).getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(shownTitles()[0]).toBe('Book 21'));

    await user.click(within(screen.getByRole('columnheader', { name: /Stock/ })).getByRole('button'));

    await waitFor(() =>
      expect(booksApi.getBooks).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'stock', page: 1 })),
    );
  });

  it('shows no page buttons when everything fits on one page', async () => {
    booksApi.getBooks.mockResolvedValue(pageOf(ALL.slice(0, 5)));
    resetStore(STAFF);
    renderApp('/');
    await screen.findByText('Book 01');

    expect(screen.getByText('Showing 1–5 of 5 books')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('goes to the new last page when the current page empties', async () => {
    await renderBooksPage();
    useLibraryStore.setState({ filters: { ...useLibraryStore.getState().filters, page: 3 } });
    // Page 3 no longer exists (books were removed): the API returns no items and 2 pages.
    booksApi.getBooks
      .mockResolvedValueOnce(pageOf([], { page: 3, total: 40 }))
      .mockImplementation(fakeServer);

    await useLibraryStore.getState().fetchBooks();

    expect(useLibraryStore.getState().filters.page).toBe(2);
    expect(booksApi.getBooks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
});

describe('Search', () => {
  it('searches once typing pauses, from page 1', async () => {
    const user = await renderBooksPage();
    await user.click(within(pagination()).getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(shownTitles()[0]).toBe('Book 21'));
    booksApi.getBooks.mockClear();

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'river');

    await waitFor(() => expect(shownTitles()).toEqual(['River of Salt']));
    // One request for the whole word, not one per letter.
    expect(booksApi.getBooks).toHaveBeenCalledTimes(1);
    expect(booksApi.getBooks).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'river', page: 1 }));
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const user = await renderBooksPage();

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz');

    expect(await screen.findByText('No books match “zzz”.')).toBeInTheDocument();
  });

  it('shows everything again when the search is cleared', async () => {
    const user = await renderBooksPage();
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'river');
    await waitFor(() => expect(shownTitles()).toEqual(['River of Salt']));

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }));

    await waitFor(() => expect(shownTitles()).toHaveLength(20));
    expect(booksApi.getBooks).toHaveBeenLastCalledWith(expect.not.objectContaining({ search: expect.anything() }));
  });
});
