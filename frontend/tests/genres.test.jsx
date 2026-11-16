import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as genresApi from '../src/api/genres.api';
import { ADMIN, STAFF, renderApp, resetStore } from './helpers';

vi.mock('../src/api/lendings.api', () => ({ createLending: vi.fn(), getLendings: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/api/auth.api', () => ({ login: vi.fn(), getProfile: vi.fn(() => new Promise(() => {})) }));
vi.mock('../src/api/books.api', () => ({
  getBooks: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
  getOverview: vi.fn().mockResolvedValue({ totalBooks: 0, totalCopies: 0 }),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
}));
vi.mock('../src/api/genres.api', () => ({
  getGenres: vi.fn(),
  createGenre: vi.fn(),
  updateGenre: vi.fn(),
  deleteGenre: vi.fn(),
}));

const GENRES = [
  { id: 'g1', name: 'Fiction', bookCount: 2 },
  { id: 'g2', name: 'Poetry', bookCount: 0 },
];

const apiError = (message, status, details) => Object.assign(new Error(message), { status, details });
const rowFor = (name) => screen.getByText(name).closest('tr');

async function renderGenresPage() {
  const user = userEvent.setup();
  resetStore(ADMIN);
  renderApp('/genres');
  await screen.findByText('Fiction');
  return user;
}

beforeEach(() => {
  vi.mocked(genresApi.getGenres).mockReset().mockResolvedValue(GENRES);
  vi.mocked(genresApi.createGenre).mockReset();
  vi.mocked(genresApi.updateGenre).mockReset();
  vi.mocked(genresApi.deleteGenre).mockReset();
});

describe('Genres page (admin)', () => {
  it('is in the sidebar and lists genres with their book counts', async () => {
    await renderGenresPage();

    expect(screen.getAllByRole('link', { name: 'Genres' })[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Genres' })).toBeInTheDocument();
    expect(within(rowFor('Fiction')).getByText('2')).toBeInTheDocument();
    expect(within(rowFor('Poetry')).getByText('0')).toBeInTheDocument();
  });

  it('adds a genre', async () => {
    genresApi.createGenre.mockResolvedValue({ id: 'g3', name: 'Travel', bookCount: 0 });
    const user = await renderGenresPage();

    await user.click(screen.getByRole('button', { name: '+ Add genre' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a genre' });
    expect(within(dialog).getByLabelText('Name')).toHaveFocus();

    await user.type(within(dialog).getByLabelText('Name'), '  Travel ');
    genresApi.getGenres.mockResolvedValue([...GENRES, { id: 'g3', name: 'Travel', bookCount: 0 }]);
    await user.click(within(dialog).getByRole('button', { name: 'Save genre' }));

    expect(genresApi.createGenre).toHaveBeenCalledWith({ name: 'Travel' });
    expect(await screen.findByRole('status')).toHaveTextContent('Added genre “Travel”.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Travel')).toBeInTheDocument();
  });

  it('requires a name', async () => {
    const user = await renderGenresPage();

    await user.click(screen.getByRole('button', { name: '+ Add genre' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a genre' });
    await user.click(within(dialog).getByRole('button', { name: 'Save genre' }));

    expect(within(dialog).getByLabelText('Name')).toHaveAccessibleDescription('Enter the genre name.');
    expect(genresApi.createGenre).not.toHaveBeenCalled();
  });

  it('shows a duplicate name under the field', async () => {
    const message = 'A genre with this name already exists.';
    genresApi.createGenre.mockRejectedValue(apiError(message, 409, [{ field: 'name', message }]));
    const user = await renderGenresPage();

    await user.click(screen.getByRole('button', { name: '+ Add genre' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a genre' });
    await user.type(within(dialog).getByLabelText('Name'), 'fiction');
    await user.click(within(dialog).getByRole('button', { name: 'Save genre' }));

    await waitFor(() => expect(within(dialog).getByLabelText('Name')).toHaveAccessibleDescription(message));
  });

  it('renames a genre', async () => {
    genresApi.updateGenre.mockResolvedValue({ id: 'g1', name: 'Novels', bookCount: 2 });
    const user = await renderGenresPage();

    await user.click(screen.getByRole('button', { name: 'Rename Fiction' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename genre' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Fiction');

    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Novels');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(genresApi.updateGenre).toHaveBeenCalledWith('g1', { name: 'Novels' });
    expect(await screen.findByRole('status')).toHaveTextContent('Saved changes to “Novels”.');
  });

  it('removes an unused genre after confirmation', async () => {
    genresApi.deleteGenre.mockResolvedValue(null);
    const user = await renderGenresPage();

    await user.click(screen.getByRole('button', { name: 'Remove Poetry' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove this genre?' });
    genresApi.getGenres.mockResolvedValue(GENRES.slice(0, 1));
    await user.click(within(dialog).getByRole('button', { name: 'Remove genre' }));

    expect(genresApi.deleteGenre).toHaveBeenCalledWith('g2');
    expect(await screen.findByRole('status')).toHaveTextContent('Removed genre “Poetry”.');
    await waitFor(() => expect(screen.queryByText('Poetry')).not.toBeInTheDocument());
  });

  it('explains why a genre with books cannot be removed', async () => {
    const user = await renderGenresPage();

    await user.click(screen.getByRole('button', { name: 'Remove Fiction' }));
    const dialog = screen.getByRole('dialog', { name: 'This genre is still in use' });

    expect(dialog).toHaveTextContent('“Fiction” still has 2 books.');
    expect(within(dialog).queryByRole('button', { name: 'Remove genre' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(genresApi.deleteGenre).not.toHaveBeenCalled();
  });
});

describe('Genres page (staff)', () => {
  it('is not in the sidebar and sends staff back to Books', async () => {
    resetStore(STAFF);
    renderApp('/genres');

    expect(await screen.findByRole('heading', { level: 1, name: 'Books' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Genres' })).not.toBeInTheDocument();
  });
});
