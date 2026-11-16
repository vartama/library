import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as booksApi from '../src/api/books.api';
import * as lendingsApi from '../src/api/lendings.api';
import { addDays, formatDate, todayISO } from '../src/lib/date';
import { EMPTY_LENDING, useLibraryStore } from '../src/store/library';
import { STAFF, pageOf, renderApp, resetStore } from './helpers';

vi.mock('../src/api/auth.api', () => ({ login: vi.fn(), getProfile: vi.fn(() => new Promise(() => {})) }));
vi.mock('../src/api/genres.api', () => ({
  getGenres: vi.fn().mockResolvedValue([]),
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
vi.mock('../src/api/lendings.api', () => ({ createLending: vi.fn(), getLendings: vi.fn().mockResolvedValue([]) }));

const FICTION = { id: 'g1', name: 'Fiction' };
const CATALOG = [
  { id: 'b1', title: 'Letters from the Harbour', author: 'Nadia Rahman', genre: FICTION, stock: 8 },
  { id: 'b2', title: 'River of Salt', author: 'Adaeze Okafor', genre: FICTION, stock: 2 },
  { id: 'b3', title: 'Tiny Dragons at Bedtime', author: 'Sam Hart', genre: FICTION, stock: 0 },
];
const DUE = addDays(todayISO(), 14);

// Stands in for GET /api/books?search=&limit=: matches title or author, ignoring case.
function searchCatalog({ search = '', limit = 20 } = {}) {
  const term = search.toLowerCase();
  const items = CATALOG.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(term));
  return Promise.resolve(pageOf(items.slice(0, limit), { limit, total: items.length }));
}

const form = () => screen.getByRole('form', { name: 'Lend books' });
const lines = () => within(form()).getAllByTestId('lending-line');
const picker = (index) => within(lines()[index]).getByRole('combobox', { name: 'Book title' });
const quantityInput = (index) => within(lines()[index]).getByRole('spinbutton', { name: 'Quantity' });

/** Waits until the open list shows exactly these titles (the debounced search has finished). */
async function waitForOptions(titles) {
  await waitFor(() =>
    expect(screen.getAllByRole('option').map((o) => o.textContent.split(' · ')[0])).toEqual(titles),
  );
}

/** Types into a line's book search and clicks the matching option. */
async function pickBook(user, index, search, title = search) {
  await user.click(picker(index));
  await user.clear(picker(index));
  await user.type(picker(index), search);
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
  await user.click(screen.getByRole('option', { name: new RegExp(title) }));
}

async function renderLendPage() {
  const user = userEvent.setup();
  resetStore(STAFF);
  useLibraryStore.setState({ lending: EMPTY_LENDING });
  renderApp('/lend');
  await screen.findByRole('form', { name: 'Lend books' });
  return user;
}

async function fillLending(user) {
  await pickBook(user, 0, 'river', 'River of Salt');
  await user.clear(quantityInput(0));
  await user.type(quantityInput(0), '2');
  await user.click(screen.getByRole('button', { name: '+ Add another book' }));
  await pickBook(user, 1, 'harbour', 'Letters from the Harbour');
  await user.clear(quantityInput(1));
  await user.type(quantityInput(1), '3');
  await user.type(screen.getByLabelText("Borrower's name"), 'Budi Santoso');
  await user.type(screen.getByLabelText('Phone number'), '0812 3456 7890');
  fireEvent.change(screen.getByLabelText('Due date'), { target: { value: DUE } });
}

beforeEach(() => {
  vi.mocked(booksApi.getBooks).mockReset().mockImplementation(searchCatalog);
  vi.mocked(booksApi.getOverview).mockReset().mockResolvedValue({ totalBooks: 3, totalCopies: 10 });
  vi.mocked(lendingsApi.createLending).mockReset();
});

describe('Book picker', () => {
  it('searches by title or author and shows the stock of each match', async () => {
    const user = await renderLendPage();

    await user.click(picker(0));
    await user.type(picker(0), 'okafor');

    await waitForOptions(['River of Salt']);
    expect(screen.getByRole('option')).toHaveTextContent('River of Salt · Adaeze Okafor2 available');
    expect(booksApi.getBooks).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'okafor', limit: 8 }));
  });

  it('lists out-of-stock books but does not let them be chosen', async () => {
    const user = await renderLendPage();

    await user.click(picker(0));
    await user.type(picker(0), 'dragons');
    const option = await screen.findByRole('option', { name: /Tiny Dragons/ });
    expect(option).toHaveAttribute('aria-disabled', 'true');

    await user.click(option);
    expect(useLibraryStore.getState().lending.lines[0].book).toBeNull();
  });

  it('says when nothing matches', async () => {
    const user = await renderLendPage();

    await user.click(picker(0));
    await user.type(picker(0), 'zzz');

    expect(await screen.findByText('No books match “zzz”.')).toBeInTheDocument();
  });

  it('can be used with the keyboard', async () => {
    const user = await renderLendPage();

    await user.click(picker(0));
    await user.type(picker(0), 'river');
    await waitForOptions(['River of Salt']);
    await user.keyboard('{Enter}');

    expect(picker(0)).toHaveValue('River of Salt');
    expect(quantityInput(0)).toHaveAccessibleDescription('Max 2');
  });
});

describe('Lending form (F6)', () => {
  it('cannot choose the same title twice', async () => {
    const user = await renderLendPage();
    await pickBook(user, 0, 'river', 'River of Salt');
    await user.click(screen.getByRole('button', { name: '+ Add another book' }));

    await user.click(picker(1));
    await user.type(picker(1), 'river');
    const option = await screen.findByRole('option', { name: /River of Salt/ });

    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveTextContent('Already added');
  });

  it('adds a line only when every line has a book', async () => {
    const user = await renderLendPage();
    expect(screen.getByRole('button', { name: '+ Add another book' })).toBeDisabled();

    await pickBook(user, 0, 'river', 'River of Salt');

    expect(screen.getByRole('button', { name: '+ Add another book' })).toBeEnabled();
  });

  it('removes a line without moving the other line\'s book', async () => {
    const user = await renderLendPage();
    expect(within(form()).queryByRole('button', { name: /Remove line/ })).not.toBeInTheDocument();
    await pickBook(user, 0, 'river', 'River of Salt');
    await user.click(screen.getByRole('button', { name: '+ Add another book' }));
    await pickBook(user, 1, 'harbour', 'Letters from the Harbour');

    await user.click(screen.getByRole('button', { name: 'Remove line 1' }));

    expect(lines()).toHaveLength(1);
    expect(picker(0)).toHaveValue('Letters from the Harbour');
  });

  it('shows every problem on "Review lending" and stays on the form', async () => {
    const user = await renderLendPage();

    await user.click(screen.getByRole('button', { name: 'Review lending' }));

    expect(picker(0)).toHaveAccessibleDescription('Choose a book.');
    expect(screen.getByLabelText("Borrower's name")).toHaveAccessibleDescription("Enter the borrower's name.");
    expect(screen.getByLabelText('Phone number')).toHaveAccessibleDescription('Enter a phone number with 9–15 digits.');
    expect(screen.getByLabelText('Due date')).toHaveAccessibleDescription('Choose a due date.');
    expect(screen.queryByRole('region', { name: 'Lending summary' })).not.toBeInTheDocument();
  });

  it('refuses more copies than are available', async () => {
    const user = await renderLendPage();
    await pickBook(user, 0, 'river', 'River of Salt');

    await user.clear(quantityInput(0));
    await user.type(quantityInput(0), '3');
    await user.click(screen.getByRole('button', { name: 'Review lending' }));

    expect(quantityInput(0)).toHaveAccessibleDescription('Only 2 available.');
  });

  it('says so when nothing can be lent', async () => {
    booksApi.getOverview.mockResolvedValue({ totalBooks: 1, totalCopies: 0 });
    resetStore(STAFF);
    useLibraryStore.setState({ lending: EMPTY_LENDING });
    renderApp('/lend');

    expect(await screen.findByText('Nothing available to lend. Add stock on the Books page.')).toBeInTheDocument();
  });
});

describe('Lending summary (F8)', () => {
  async function openSummary() {
    const user = await renderLendPage();
    await fillLending(user);
    await user.click(screen.getByRole('button', { name: 'Review lending' }));
    return { user, summary: screen.getByRole('region', { name: 'Lending summary' }) };
  }

  it('shows the borrower, the books, stock after and the totals before anything is sent', async () => {
    const { summary } = await openSummary();

    expect(summary).toHaveTextContent('Step 2 of 2 · Check before confirming');
    expect(summary).toHaveTextContent('Budi Santoso');
    expect(summary).toHaveTextContent('0812 3456 7890');
    expect(within(summary).getByText(formatDate(DUE))).toBeInTheDocument();

    const rows = within(summary).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['River of Salt22 → 0', 'Letters from the Harbour38 → 5']);
    expect(summary).toHaveTextContent('Total: 5 copies · 2 titles');
    expect(lendingsApi.createLending).not.toHaveBeenCalled();
  });

  it('goes back to the form with every value kept', async () => {
    const { user } = await openSummary();

    await user.click(screen.getByRole('button', { name: 'Back to edit' }));

    expect(lines()).toHaveLength(2);
    expect(picker(0)).toHaveValue('River of Salt');
    expect(quantityInput(1)).toHaveValue(3);
    expect(screen.getByLabelText("Borrower's name")).toHaveValue('Budi Santoso');
    expect(screen.getByLabelText('Due date')).toHaveValue(DUE);
    expect(lendingsApi.createLending).not.toHaveBeenCalled();
  });

  it('confirms: sends the lending, returns to Books and says stock was updated', async () => {
    lendingsApi.createLending.mockResolvedValue({ id: 'l1' });
    const { user } = await openSummary();

    await user.click(screen.getByRole('button', { name: 'Confirm lending' }));

    expect(lendingsApi.createLending).toHaveBeenCalledWith({
      borrowerName: 'Budi Santoso',
      phoneNumber: '0812 3456 7890',
      dueDate: DUE,
      items: [
        { bookId: 'b2', quantity: 2 },
        { bookId: 'b1', quantity: 3 },
      ],
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Books' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Lending confirmed. Stock has been updated.');
    // The form starts empty next time.
    expect(useLibraryStore.getState().lending.lines).toEqual([expect.objectContaining({ bookId: '', book: null })]);
  });

  it('shows which books ran short when the API refuses, with the current stock', async () => {
    lendingsApi.createLending.mockRejectedValue(
      Object.assign(new Error('Not enough copies available.'), {
        status: 409,
        details: [{ bookId: 'b2', title: 'River of Salt', requested: 2, available: 1 }],
      }),
    );
    const { user, summary } = await openSummary();

    await user.click(screen.getByRole('button', { name: 'Confirm lending' }));

    const alert = await within(summary).findByRole('alert');
    expect(alert).toHaveTextContent('Not enough copies available.');
    expect(alert).toHaveTextContent('River of Salt: 2 requested, only 1 available.');
    // The summary uses the stock the API reported and must be edited before confirming again.
    await waitFor(() => expect(summary).toHaveTextContent('Only 1 available'));
    expect(screen.getByRole('button', { name: 'Confirm lending' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(quantityInput(0)).toHaveAccessibleDescription('Max 1');
  });

  it('returns to step 1 after leaving the page, keeping the values', async () => {
    const { user } = await openSummary();

    await user.click(screen.getAllByRole('link', { name: 'History' })[0]);
    await user.click(screen.getAllByRole('link', { name: 'Lend books' })[0]);

    expect(await screen.findByRole('form', { name: 'Lend books' })).toBeInTheDocument();
    expect(screen.getByLabelText("Borrower's name")).toHaveValue('Budi Santoso');
    expect(picker(0)).toHaveValue('River of Salt');
  });
});
