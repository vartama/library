import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as authApi from '../api/auth.api';
import * as booksApi from '../api/books.api';
import * as genresApi from '../api/genres.api';
import * as lendingsApi from '../api/lendings.api';
import { configureAuth } from '../api/client';
import { todayISO } from '../lib/date';
import { hasErrors, validateLending } from '../lib/lendingValidation';

export const SESSION_EXPIRED = 'Your session has expired. Sign in again.';

// localStorage can be unavailable (private mode, blocked site data); the app then simply
// forgets the session on reload instead of crashing.
const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

// One store for the whole app (design system guideline). Feature branches add their slices here.
// Library data is cleared on sign-out so the next user never sees the previous session's data.
export const PAGE_SIZES = Object.freeze([10, 20, 50, 100]);
export const DEFAULT_FILTERS = Object.freeze({
  search: '',
  genreId: null,
  sortBy: 'title',
  order: 'asc',
  page: 1,
  limit: 20,
});
const EMPTY_PAGE = Object.freeze({ page: 1, total: 0, totalPages: 0 });

// `book` is the chosen book as found by the search ({ id, title, stock }); null until one is chosen.
// `key` identifies the line on screen, so removing one line never moves another line's input.
let lineCount = 0;
const newLendingLine = () => ({ key: (lineCount += 1), bookId: '', book: null, quantity: '1' });

// The lending being prepared on the Lend books page. Kept in the store so moving to another page
// and back does not lose what was typed.
export const EMPTY_LENDING = Object.freeze({
  lines: [newLendingLine()],
  borrower: { borrowerName: '', phoneNumber: '', dueDate: '' },
  errors: { lines: {} },
  step: 'edit', // 'edit' | 'review'
  submitting: false,
  submitError: null, // { message, details } from the API
});

const EMPTY_LIBRARY = {
  books: [], // the current page
  booksPage: EMPTY_PAGE,
  booksLoading: false,
  booksError: '',
  filters: DEFAULT_FILTERS,
  overview: null,
  genres: [],
  genresLoading: false,
  genresError: '',
  lending: EMPTY_LENDING,
  history: [],
  historyLoading: false,
  historyError: '',
};

// Only the newest book request may update the list, so a slow response for an old filter
// cannot overwrite the result of a newer one.
let latestBooksRequest = 0;

const LENDING_CONFIRMED = 'Lending confirmed. Stock has been updated.';

function lendingActions(set, get) {
  const update = (changes) => set({ lending: { ...get().lending, ...changes } });

  // Editing a field clears its error; the rest are kept until the next "Review lending".
  const withoutError = (errors, key) => {
    const { [key]: _removed, ...rest } = errors;
    return rest;
  };

  return {
    addLendingLine: () => {
      const { lending } = get();
      update({ lines: [...lending.lines, newLendingLine()] });
    },
    removeLendingLine: (index) => {
      const { lending } = get();
      // Line errors are keyed by position, so they no longer match once a line is removed.
      update({
        lines: lending.lines.filter((_, i) => i !== index),
        errors: { ...lending.errors, lines: {} },
      });
    },
    updateLendingLine: (index, changes) => {
      const { lending } = get();
      const lineErrors = { ...lending.errors.lines[index] };
      Object.keys(changes).forEach((key) => delete lineErrors[key]);
      update({
        lines: lending.lines.map((line, i) => (i === index ? { ...line, ...changes } : line)),
        errors: { ...lending.errors, lines: { ...lending.errors.lines, [index]: lineErrors } },
      });
    },
    setBorrowerField: (name, value) => {
      const { lending } = get();
      update({ borrower: { ...lending.borrower, [name]: value }, errors: withoutError(lending.errors, name) });
    },
    /** Validates the form; on success shows the summary (step 2). Returns whether it passed. */
    reviewLending: () => {
      const { lending } = get();
      const chosenBooks = new Map(lending.lines.filter((line) => line.book).map((line) => [line.book.id, line.book]));
      const errors = validateLending(lending, chosenBooks, todayISO());
      const valid = !hasErrors(errors);
      update({ errors, step: valid ? 'review' : 'edit', submitError: null });
      return valid;
    },
    backToEdit: () => update({ step: 'edit', submitError: null }),
    /** Leaving the page keeps what was typed but returns to step 1 (as in the prototype). */
    leaveLending: () => update({ step: 'edit', submitError: null }),
    /** Sends the lending; stock is only subtracted now. Resolves to true when it was recorded. */
    confirmLending: async () => {
      const { lending } = get();
      update({ submitting: true, submitError: null });
      try {
        await lendingsApi.createLending({
          borrowerName: lending.borrower.borrowerName.trim(),
          phoneNumber: lending.borrower.phoneNumber.trim(),
          dueDate: lending.borrower.dueDate,
          items: lending.lines.map((line) => ({ bookId: line.bookId, quantity: Number(line.quantity) })),
        });
        set({ lending: EMPTY_LENDING, notice: LENDING_CONFIRMED });
        await get().refreshBooks();
        return true;
      } catch (err) {
        // Stock may have changed since the books were chosen: the API says how many are left
        // (409) or which books are gone (404). Show that in the summary so it can be fixed.
        const details = Array.isArray(err.details) ? err.details : [];
        const available = new Map(details.filter((d) => d.available !== undefined).map((d) => [d.bookId, d.available]));
        const missing = new Set(details.filter((d) => d.available === undefined).map((d) => d.bookId));
        update({
          submitting: false,
          submitError: { message: err.message, details: err.details },
          lines: get().lending.lines.map((line) => {
            if (missing.has(line.bookId)) return { ...line, book: null };
            if (available.has(line.bookId)) return { ...line, book: { ...line.book, stock: available.get(line.bookId) } };
            return line;
          }),
        });
        return false;
      }
    },
  };
}

export const useLibraryStore = create(
  persist(
    (set, get) => ({
      // notice
      notice: '',
      setNotice: (notice) => set({ notice }),
      clearNotice: () => set({ notice: '' }),

      // auth
      token: null,
      user: null,
      login: async (username, password) => {
        const { token, user } = await authApi.login({ username, password });
        set({ token, user, notice: '' });
      },
      logout: () => set({ token: null, user: null, notice: '', ...EMPTY_LIBRARY }),
      loadProfile: async () => {
        const user = await authApi.getProfile();
        set({ user });
      },

      // books
      ...EMPTY_LIBRARY,
      fetchBooks: async () => {
        const request = ++latestBooksRequest;
        const { search, genreId, sortBy, order, page, limit } = get().filters;
        set({ booksLoading: true, booksError: '' });
        try {
          const result = await booksApi.getBooks({
            ...(search && { search }),
            ...(genreId && { genreId }),
            sortBy,
            order,
            page,
            limit,
          });
          if (request !== latestBooksRequest) return;

          // The page emptied (e.g. its last book was removed): show the new last page instead.
          if (result.items.length === 0 && page > 1 && result.totalPages > 0) {
            set({ filters: { ...get().filters, page: result.totalPages } });
            await get().fetchBooks();
            return;
          }
          set({
            books: result.items,
            booksPage: { page: result.page, total: result.total, totalPages: result.totalPages },
            booksLoading: false,
          });
        } catch (err) {
          if (request === latestBooksRequest) set({ booksLoading: false, booksError: err.message });
        }
      },
      // Search, filter, sort and paging run on the server (F3–F5); each change refetches the page.
      // A new search, filter or sort starts again from page 1.
      setSearch: (search) => {
        set({ filters: { ...get().filters, search, page: 1 } });
        return get().fetchBooks();
      },
      setGenre: (genreId) => {
        set({ filters: { ...get().filters, genreId, page: 1 } });
        return get().fetchBooks();
      },
      setSort: (sortBy, order) => {
        set({ filters: { ...get().filters, sortBy, order, page: 1 } });
        return get().fetchBooks();
      },
      setPage: (page) => {
        set({ filters: { ...get().filters, page } });
        return get().fetchBooks();
      },
      /** Rows per page; starts again from page 1. */
      setPageSize: (limit) => {
        set({ filters: { ...get().filters, limit, page: 1 } });
        return get().fetchBooks();
      },
      /** Column header click: same column flips the order, another column starts A–Z / low–high. */
      toggleSort: (column) => {
        const { sortBy, order } = get().filters;
        const nextOrder = sortBy === column && order === 'asc' ? 'desc' : 'asc';
        return get().setSort(column, nextOrder);
      },
      fetchOverview: async () => {
        try {
          set({ overview: await booksApi.getOverview() });
        } catch {
          // The copy count is secondary; the page itself shows API errors.
        }
      },
      // A book change also changes the genres' book counts.
      refreshBooks: () => Promise.all([get().fetchBooks(), get().fetchOverview(), get().fetchGenres()]),
      /** Rejects with the API error so the form can show it next to the right field. */
      addBook: async (book) => {
        const created = await booksApi.createBook(book);
        set({ notice: `Added “${created.title}”.` });
        await get().refreshBooks();
        return created;
      },
      /** Rejects with the API error, like addBook. */
      updateBook: async (book, changes) => {
        const updated = await booksApi.updateBook(book.id, changes);
        set({ notice: `Saved changes to “${updated.title}”.` });
        await get().refreshBooks();
        return updated;
      },
      removeBook: async (book) => {
        await booksApi.deleteBook(book.id);
        set({ notice: `Removed “${book.title}”.` });
        await get().refreshBooks();
      },

      // genres
      fetchGenres: async () => {
        set({ genresLoading: true, genresError: '' });
        try {
          const genres = await genresApi.getGenres();
          set({ genres, genresLoading: false });

          // The active genre filter no longer has books (last one removed or moved): show all.
          const { genreId } = get().filters;
          if (genreId && !genres.some((genre) => genre.id === genreId && genre.bookCount > 0)) {
            await get().setGenre(null);
          }
        } catch (err) {
          set({ genresLoading: false, genresError: err.message });
        }
      },
      // A rename shows on every book of that genre, so the books are refreshed too.
      refreshGenres: () => Promise.all([get().fetchGenres(), get().fetchBooks()]),
      /** Rejects with the API error so the form can show it next to the field. */
      addGenre: async (genre) => {
        const created = await genresApi.createGenre(genre);
        set({ notice: `Added genre “${created.name}”.` });
        await get().refreshGenres();
        return created;
      },
      updateGenre: async (genre, changes) => {
        const updated = await genresApi.updateGenre(genre.id, changes);
        set({ notice: `Saved changes to “${updated.name}”.` });
        await get().refreshGenres();
        return updated;
      },
      removeGenre: async (genre) => {
        await genresApi.deleteGenre(genre.id);
        set({ notice: `Removed genre “${genre.name}”.` });
        await get().refreshGenres();
      },

      // lending (F6–F8); books are picked with a search (BookPicker), not from a full list
      ...lendingActions(set, get),

      // history (F9)
      fetchHistory: async () => {
        set({ historyLoading: true, historyError: '' });
        try {
          const history = await lendingsApi.getLendings();
          set({ history, historyLoading: false });
        } catch (err) {
          set({ historyLoading: false, historyError: err.message });
        }
      },
    }),
    {
      name: 'vartama-library-session',
      storage: createJSONStorage(() => safeLocalStorage),
      // Only the session survives a reload; library data is always fetched fresh.
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);

export const selectIsAdmin = (state) => state.user?.role === 'admin';

configureAuth({
  getToken: () => useLibraryStore.getState().token,
  onUnauthorized: () => {
    const { token, logout, setNotice } = useLibraryStore.getState();
    if (token) {
      logout();
      setNotice(SESSION_EXPIRED);
    }
  },
});
