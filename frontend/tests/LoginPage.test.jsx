import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../src/api/auth.api';
import { SESSION_EXPIRED, useLibraryStore } from '../src/store/library';
import { STAFF, renderApp, resetStore } from './helpers';

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

describe('LoginPage', () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.getProfile).mockResolvedValue(STAFF);
  });

  it('asks for both fields before calling the API', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Enter your username.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('shows the server error for wrong credentials', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValue(new Error('Incorrect username or password.'));
    renderApp('/login');

    await user.type(screen.getByLabelText('Username'), 'staff');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('signs in and returns to the page that required it', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({ token: 'jwt', user: STAFF });
    renderApp('/history');

    await user.type(screen.getByLabelText('Username'), ' staff ');
    await user.type(screen.getByLabelText('Password'), 'user123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(authApi.login).toHaveBeenCalledWith({ username: 'staff', password: 'user123' });
    expect(await screen.findByRole('heading', { name: 'Lending history' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Library Staff');
    expect(useLibraryStore.getState().token).toBe('jwt');
  });

  it('shows why the session ended', () => {
    useLibraryStore.setState({ notice: SESSION_EXPIRED });
    renderApp('/login');

    expect(screen.getByRole('status')).toHaveTextContent(SESSION_EXPIRED);
  });
});
