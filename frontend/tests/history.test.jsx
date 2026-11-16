import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as lendingsApi from '../src/api/lendings.api';
import { formatDate } from '../src/lib/date';
import { STAFF, renderApp, resetStore } from './helpers';

vi.mock('../src/api/auth.api', () => ({ login: vi.fn(), getProfile: vi.fn(() => new Promise(() => {})) }));
vi.mock('../src/api/genres.api', () => ({ getGenres: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/api/books.api', () => ({
  getBooks: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
  getOverview: vi.fn().mockResolvedValue({ totalBooks: 0, totalCopies: 0 }),
}));
vi.mock('../src/api/lendings.api', () => ({ createLending: vi.fn(), getLendings: vi.fn() }));

const LENDINGS = [
  {
    id: 'l2',
    borrowerName: 'Rina Wijaya',
    phoneNumber: '0812 3456 7890',
    dueDate: '2026-10-25',
    items: [
      { bookId: 'b1', title: 'River of Salt', quantity: 1 },
      { bookId: 'b2', title: 'The Pragmatic Gardener', quantity: 2 },
    ],
    lentBy: { id: 'u1', name: 'Head Librarian' },
    createdAt: '2026-10-11T03:15:00.000Z',
  },
  {
    id: 'l1',
    borrowerName: 'Budi Santoso',
    phoneNumber: '0857 1111 2222',
    dueDate: '2026-10-18',
    items: [{ bookId: 'b3', title: 'Tiny Dragons at Bedtime', quantity: 3 }],
    lentBy: { id: 'u2', name: 'Library Staff' },
    createdAt: '2026-10-04T08:00:00.000Z',
  },
];

async function renderHistory() {
  resetStore(STAFF);
  renderApp('/history');
  return screen.findByRole('heading', { level: 1, name: 'Lending history' });
}

beforeEach(() => {
  vi.mocked(lendingsApi.getLendings).mockReset().mockResolvedValue(LENDINGS);
});

describe('Lending history (F9)', () => {
  it('shows one row per lending, newest first, as the API returns them', async () => {
    await renderHistory();
    await screen.findByText('Rina Wijaya');

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Rina Wijaya')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Budi Santoso')).toBeInTheDocument();
  });

  it('shows date, borrower and phone, every book with its quantity, due date and who lent it', async () => {
    await renderHistory();
    const row = (await screen.findByText('Rina Wijaya')).closest('tr');

    expect(within(row).getByText(formatDate(LENDINGS[0].createdAt))).toBeInTheDocument();
    expect(within(row).getByText('0812 3456 7890')).toBeInTheDocument();
    expect(within(row).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'River of Salt ×1',
      'The Pragmatic Gardener ×2',
    ]);
    expect(within(row).getByText('25 Oct 2026')).toBeInTheDocument();
    expect(within(row).getByText('Head Librarian')).toBeInTheDocument();
  });

  it('has a "Lent by" column', async () => {
    await renderHistory();

    expect(screen.getByRole('columnheader', { name: 'Lent by' })).toBeInTheDocument();
    expect(within((await screen.findByText('Budi Santoso')).closest('tr')).getByText('Library Staff')).toBeInTheDocument();
  });

  it('says so when nothing has been lent yet', async () => {
    lendingsApi.getLendings.mockResolvedValue([]);
    await renderHistory();

    expect(await screen.findByText('No lending yet.')).toBeInTheDocument();
  });

  it('shows an API error', async () => {
    lendingsApi.getLendings.mockRejectedValue(new Error('Cannot reach the server. Check that the API is running and try again.'));
    await renderHistory();

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });

  it('loads fresh data on every visit', async () => {
    await renderHistory();
    await screen.findByText('Rina Wijaya');

    expect(lendingsApi.getLendings).toHaveBeenCalledTimes(1);
  });
});
