import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../src/api/auth.api';
import client from '../src/api/client';
import { SESSION_EXPIRED, selectIsAdmin, useLibraryStore } from '../src/store/library';
import { ADMIN, STAFF, resetStore } from './helpers';

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

const [{ rejected }] = client.interceptors.response.handlers;

describe('auth slice', () => {
  beforeEach(() => {
    resetStore();
  });

  it('stores the token and user after login, and persists only the session', async () => {
    authApi.login.mockResolvedValue({ token: 'jwt', user: ADMIN });
    useLibraryStore.setState({ notice: 'Your session has expired. Sign in again.' });

    await useLibraryStore.getState().login('admin', 'admin123');

    expect(useLibraryStore.getState()).toMatchObject({ token: 'jwt', user: ADMIN, notice: '' });
    expect(JSON.parse(localStorage.getItem('vartama-library-session')).state).toEqual({ token: 'jwt', user: ADMIN });
  });

  it('logout clears the session', () => {
    resetStore(ADMIN);

    useLibraryStore.getState().logout();

    expect(useLibraryStore.getState()).toMatchObject({ token: null, user: null });
  });

  it('signs out with a notice when the API answers 401', async () => {
    resetStore(STAFF);

    await rejected({ config: {}, response: { status: 401, data: {} } }).catch(() => {});

    expect(useLibraryStore.getState()).toMatchObject({ token: null, user: null, notice: SESSION_EXPIRED });
  });

  it('selectIsAdmin reflects the role', () => {
    expect(selectIsAdmin({ user: ADMIN })).toBe(true);
    expect(selectIsAdmin({ user: STAFF })).toBe(false);
    expect(selectIsAdmin({ user: null })).toBe(false);
  });
});
