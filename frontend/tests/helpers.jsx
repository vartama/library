import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { DEFAULT_FILTERS, useLibraryStore } from '../src/store/library';

/** The API's paginated shape for a list of books (GET /api/books). */
export const pageOf = (items, { page = 1, limit = 20, total = items.length } = {}) => ({
  items,
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const ADMIN = { id: '1', username: 'admin', name: 'Head Librarian', role: 'admin' };
export const STAFF = { id: '2', username: 'staff', name: 'Library Staff', role: 'user' };

/** Resets the store; pass a user to start signed in as that user. */
export function resetStore(user = null) {
  localStorage.clear();
  useLibraryStore.setState({
    notice: '',
    token: user ? `token-for-${user.username}` : null,
    user,
    books: [],
    genres: [],
    overview: null,
    filters: DEFAULT_FILTERS,
  });
}

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
