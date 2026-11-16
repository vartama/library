import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as booksApi from '../src/api/books.api';
import * as genresApi from '../src/api/genres.api';
import { useLibraryStore } from '../src/store/library';
import { ADMIN, STAFF, pageOf, renderApp, resetStore } from './helpers';

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

const GENRES = [
  { id: 'g-children', name: 'Children', bookCount: 1 },
  { id: 'g-fiction', name: 'Fiction', bookCount: 1 },
  { id: 'g-science', name: 'Science', bookCount: 1 },
  { id: 'g-tech', name: 'Technology', bookCount: 0 },
];
const genre = (id) => {
  const { name } = GENRES.find((g) => g.id === id);
  return { id, name };
};

const BOOKS = [
  { id: 'b1', title: 'River of Salt', author: 'Adaeze Okafor', genre: genre('g-fiction'), stock: 2 },
  { id: 'b2', title: 'The Pragmatic Gardener', author: 'Lena Ortiz', genre: genre('g-science'), stock: 6 },
  { id: 'b3', title: 'Tiny Dragons at Bedtime', author: 'Sam Hart', genre: genre('g-children'), stock: 0 },
];

const apiError = (message, status, details) => Object.assign(new Error(message), { status, details });

async function renderBooksPage(user) {
  resetStore(user);
  renderApp('/');
  await screen.findByText('River of Salt');
}

const rowFor = (title) => screen.getByText(title).closest('tr');

beforeEach(() => {
  vi.mocked(booksApi.getBooks).mockReset().mockResolvedValue(pageOf(BOOKS));
  vi.mocked(booksApi.getOverview).mockReset().mockResolvedValue({ totalBooks: 3, totalCopies: 8 });
  vi.mocked(genresApi.getGenres).mockReset().mockResolvedValue(GENRES);
  vi.mocked(booksApi.createBook).mockReset();
  vi.mocked(booksApi.updateBook).mockReset();
  vi.mocked(booksApi.deleteBook).mockReset();
});

describe('Books list', () => {
  it('shows each book with author, genre and a stock badge', async () => {
    await renderBooksPage(ADMIN);

    expect(within(rowFor('River of Salt')).getByText('Adaeze Okafor')).toBeInTheDocument();
    expect(within(rowFor('River of Salt')).getByText('Fiction')).toBeInTheDocument();
    expect(within(rowFor('River of Salt')).getByText('▲ Low')).toBeInTheDocument();
    expect(within(rowFor('The Pragmatic Gardener')).getByText('● In stock')).toBeInTheDocument();
    expect(within(rowFor('Tiny Dragons at Bedtime')).getByText('■ Out of stock')).toBeInTheDocument();
  });

  it('shows the copies on the shelf in the sidebar', async () => {
    await renderBooksPage(ADMIN);

    expect(screen.getAllByText('8 copies on the shelf')[0]).toBeInTheDocument();
  });

  it('invites an admin to add the first book when the library is empty', async () => {
    booksApi.getBooks.mockResolvedValue(pageOf([]));
    resetStore(ADMIN);
    renderApp('/');

    expect(await screen.findByText('No books yet. Add your first book.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add book' })).toBeInTheDocument();
  });

  it('shows an API error', async () => {
    booksApi.getBooks.mockRejectedValue(apiError('Cannot reach the server. Check that the API is running and try again.'));
    resetStore(ADMIN);
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});

describe('Add book (admin)', () => {
  async function openForm() {
    const user = userEvent.setup();
    await renderBooksPage(ADMIN);
    await user.click(screen.getByRole('button', { name: '+ Add book' }));
    return { user, form: screen.getByRole('dialog', { name: 'Add a book' }) };
  }

  it('opens in a modal with the Title field focused', async () => {
    const { form } = await openForm();

    expect(form).toHaveAttribute('aria-modal', 'true');
    expect(within(form).getByLabelText('Title')).toHaveFocus();
    // Defaults to the first genre once the genres have loaded.
    await waitFor(() => expect(within(form).getByLabelText('Genre')).toHaveDisplayValue('Children'));
    expect(within(form).getByLabelText('Copies')).toHaveValue(1);
  });

  it('validates the fields before saving', async () => {
    const { user, form } = await openForm();

    await user.clear(within(form).getByLabelText('Copies'));
    await user.type(within(form).getByLabelText('Copies'), '0');
    await user.click(within(form).getByRole('button', { name: 'Save book' }));

    expect(within(form).getByLabelText('Title')).toHaveAccessibleDescription('Enter the book title.');
    expect(within(form).getByLabelText('Author')).toHaveAccessibleDescription('Enter the author.');
    expect(within(form).getByLabelText('Copies')).toHaveAccessibleDescription('Enter a whole number, 1 or more.');
    expect(booksApi.createBook).not.toHaveBeenCalled();
  });

  it('saves the book, closes the modal and confirms', async () => {
    const created = { id: 'b9', title: 'Clean Interfaces', author: 'Joel Barros', genre: genre('g-tech'), stock: 3 };
    booksApi.createBook.mockResolvedValue(created);
    const { user, form } = await openForm();

    await user.type(within(form).getByLabelText('Title'), '  Clean Interfaces ');
    await user.type(within(form).getByLabelText('Author'), 'Joel Barros');
    await user.selectOptions(await within(form).findByRole('combobox', { name: 'Genre' }), 'Technology');
    await user.clear(within(form).getByLabelText('Copies'));
    await user.type(within(form).getByLabelText('Copies'), '3');
    booksApi.getBooks.mockResolvedValue(pageOf([...BOOKS, created]));
    await user.click(within(form).getByRole('button', { name: 'Save book' }));

    expect(booksApi.createBook).toHaveBeenCalledWith({
      title: 'Clean Interfaces',
      author: 'Joel Barros',
      genreId: 'g-tech',
      stock: 3,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Added “Clean Interfaces”.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Clean Interfaces')).toBeInTheDocument();
  });

  it('shows a duplicate title under the Title field', async () => {
    const message = 'A book with this title already exists.';
    booksApi.createBook.mockRejectedValue(apiError(message, 409, [{ field: 'title', message }]));
    const { user, form } = await openForm();

    await user.type(within(form).getByLabelText('Title'), 'River of Salt');
    await user.type(within(form).getByLabelText('Author'), 'Someone');
    await user.click(within(form).getByRole('button', { name: 'Save book' }));

    await waitFor(() => expect(within(form).getByLabelText('Title')).toHaveAccessibleDescription(message));
    expect(within(form).getByRole('button', { name: 'Save book' })).toBeEnabled();
  });

  it('shows other errors at the top of the form', async () => {
    booksApi.createBook.mockRejectedValue(apiError('You do not have permission to do this.', 403));
    const { user, form } = await openForm();

    await user.type(within(form).getByLabelText('Title'), 'New');
    await user.type(within(form).getByLabelText('Author'), 'Someone');
    await user.click(within(form).getByRole('button', { name: 'Save book' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('You do not have permission to do this.');
  });

  it('closes on Cancel or Escape without saving', async () => {
    const { user, form } = await openForm();

    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add book' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(booksApi.createBook).not.toHaveBeenCalled();
  });
});

describe('Edit book (admin)', () => {
  async function openEdit(title = 'River of Salt') {
    const user = userEvent.setup();
    await renderBooksPage(ADMIN);
    await user.click(screen.getByRole('button', { name: `Edit ${title}` }));
    return { user, form: screen.getByRole('dialog', { name: 'Edit book' }) };
  }

  it('starts with the current values', async () => {
    const { form } = await openEdit();

    expect(within(form).getByLabelText('Title')).toHaveValue('River of Salt');
    expect(within(form).getByLabelText('Author')).toHaveValue('Adaeze Okafor');
    expect(within(form).getByLabelText('Genre')).toHaveValue('g-fiction');
    expect(within(form).getByLabelText('Copies')).toHaveValue(2);
  });

  it('saves the changes and confirms', async () => {
    const updated = { ...BOOKS[0], title: 'River of Salt (2nd ed.)', stock: 0 };
    booksApi.updateBook.mockResolvedValue(updated);
    const { user, form } = await openEdit();

    await user.clear(within(form).getByLabelText('Title'));
    await user.type(within(form).getByLabelText('Title'), 'River of Salt (2nd ed.)');
    await user.clear(within(form).getByLabelText('Copies'));
    await user.type(within(form).getByLabelText('Copies'), '0');
    booksApi.getBooks.mockResolvedValue(pageOf([updated, ...BOOKS.slice(1)]));
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(booksApi.updateBook).toHaveBeenCalledWith('b1', {
      title: 'River of Salt (2nd ed.)',
      author: 'Adaeze Okafor',
      genreId: 'g-fiction',
      stock: 0,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Saved changes to “River of Salt (2nd ed.)”.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('River of Salt (2nd ed.)')).toBeInTheDocument();
  });

  it('rejects a negative number of copies', async () => {
    const { user, form } = await openEdit();

    await user.clear(within(form).getByLabelText('Copies'));
    await user.type(within(form).getByLabelText('Copies'), '-1');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(within(form).getByLabelText('Copies')).toHaveAccessibleDescription('Enter a whole number, 0 or more.');
    expect(booksApi.updateBook).not.toHaveBeenCalled();
  });

  it("shows another book's title as a duplicate", async () => {
    const message = 'A book with this title already exists.';
    booksApi.updateBook.mockRejectedValue(apiError(message, 409, [{ field: 'title', message }]));
    const { user, form } = await openEdit();

    await user.clear(within(form).getByLabelText('Title'));
    await user.type(within(form).getByLabelText('Title'), 'The Pragmatic Gardener');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(within(form).getByLabelText('Title')).toHaveAccessibleDescription(message));
  });
});

describe('Remove book (admin)', () => {
  async function openDialog() {
    const user = userEvent.setup();
    await renderBooksPage(ADMIN);
    await user.click(screen.getByRole('button', { name: 'Remove River of Salt' }));
    return { user, dialog: screen.getByRole('dialog', { name: 'Remove this book?' }) };
  }

  it('names the book and its copies', async () => {
    const { dialog } = await openDialog();

    expect(dialog).toHaveTextContent(
      '“River of Salt” and its 2 copies will be removed from the library. Past lending history is kept.',
    );
  });

  it('does nothing on Cancel', async () => {
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(booksApi.deleteBook).not.toHaveBeenCalled();
  });

  it('removes the book and confirms', async () => {
    booksApi.deleteBook.mockResolvedValue(null);
    const { user, dialog } = await openDialog();
    booksApi.getBooks.mockResolvedValue(pageOf(BOOKS.slice(1)));

    await user.click(within(dialog).getByRole('button', { name: 'Remove book' }));

    expect(booksApi.deleteBook).toHaveBeenCalledWith('b1');
    expect(await screen.findByRole('status')).toHaveTextContent('Removed “River of Salt”.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('River of Salt')).not.toBeInTheDocument());
  });

  it('keeps the dialog open with the error when removal fails', async () => {
    booksApi.deleteBook.mockRejectedValue(apiError('Book not found.', 404));
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Remove book' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Book not found.');
  });
});

describe('Staff (role user)', () => {
  it('can see the books but not add, edit or remove them', async () => {
    await renderBooksPage(STAFF);

    expect(screen.queryByRole('button', { name: '+ Add book' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('sees a plain empty state', async () => {
    booksApi.getBooks.mockResolvedValue(pageOf([]));
    resetStore(STAFF);
    renderApp('/');

    expect(await screen.findByText('No books yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add book' })).not.toBeInTheDocument();
  });
});

describe('sign-out', () => {
  it('clears the library data', async () => {
    await renderBooksPage(ADMIN);

    useLibraryStore.getState().logout();

    expect(useLibraryStore.getState()).toMatchObject({ books: [], overview: null });
  });
});
