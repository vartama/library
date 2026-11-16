import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../src/api/auth.api';
import { useLibraryStore } from '../src/store/library';
import { ADMIN, renderApp, resetStore } from './helpers';

vi.mock('../src/api/lendings.api', () => ({ createLending: vi.fn(), getLendings: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/api/auth.api', () => ({ login: vi.fn(), getProfile: vi.fn() }));
vi.mock('../src/api/genres.api', () => ({
  getGenres: vi.fn().mockResolvedValue([]),
  createGenre: vi.fn(),
  updateGenre: vi.fn(),
  deleteGenre: vi.fn(),
}));
vi.mock('../src/api/books.api', () => ({
  getBooks: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
  getOverview: vi.fn().mockResolvedValue({ totalBooks: 0, totalCopies: 0 }),
  createBook: vi.fn(),
  deleteBook: vi.fn(),
}));

// The desktop sidebar is always in the DOM (CSS hides it on small screens).
const mainNav = () => screen.getAllByRole('navigation', { name: 'Main' })[0];

describe('App shell (signed in)', () => {
  beforeEach(() => {
    resetStore(ADMIN);
    authApi.getProfile.mockResolvedValue(ADMIN);
  });

  it('shows the top bar with the app name and the signed-in user', () => {
    renderApp('/');
    const header = screen.getByRole('banner');

    expect(within(header).getByText('Vartama Library')).toBeInTheDocument();
    expect(within(header).getByText('Head Librarian')).toBeInTheDocument();
    expect(within(header).getByText('Admin')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('lists the pages in the sidebar and marks the current one', () => {
    renderApp('/');
    const links = within(mainNav()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual(['Books', 'Genres', 'Lend books', 'History']);
    expect(within(mainNav()).getByRole('link', { name: 'Books' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Books' })).toBeInTheDocument();
  });

  it('switches pages from the sidebar', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(within(mainNav()).getByRole('link', { name: 'Lend books' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Lend books' })).toBeInTheDocument();
    expect(within(mainNav()).getByRole('link', { name: 'Lend books' })).toHaveAttribute('aria-current', 'page');
    expect(within(mainNav()).getByRole('link', { name: 'Books' })).not.toHaveAttribute('aria-current');

    await user.click(within(mainNav()).getByRole('link', { name: 'History' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Lending history' })).toBeInTheDocument();
  });

  it('redirects unknown paths to Books', () => {
    renderApp('/does-not-exist');

    expect(screen.getByRole('heading', { level: 1, name: 'Books' })).toBeInTheDocument();
  });

  it('shows the notice and clears it when navigating', async () => {
    const user = userEvent.setup();
    useLibraryStore.setState({ notice: 'Lending confirmed. Stock has been updated.' });
    renderApp('/');

    expect(screen.getByRole('status')).toHaveTextContent('Lending confirmed. Stock has been updated.');

    await user.click(within(mainNav()).getByRole('link', { name: 'History' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('opens the menu drawer on small screens and closes it after navigating', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu' });

    await user.click(within(drawer).getByRole('link', { name: 'History' }));

    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Lending history' })).toBeInTheDocument();
  });

  it('closes the menu drawer with Escape', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('switches and remembers the theme', async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.theme = 'light';
    renderApp('/');

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('vartama-library-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('signs out back to the sign-in page', async () => {
    const user = userEvent.setup();
    renderApp('/history');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(useLibraryStore.getState().token).toBeNull();
  });
});

describe('App shell (signed out)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('sends visitors to the sign-in page', () => {
    renderApp('/history');

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});
