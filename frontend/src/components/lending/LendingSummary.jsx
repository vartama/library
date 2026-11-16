import Button from '../ui/Button';
import Card from '../ui/Card';
import Notice from '../ui/Notice';
import { DueBadge } from '../ui/Badge';
import { TBody, THead, Table, Td, Th, Tr } from '../ui/Table';
import { useLibraryStore } from '../../store/library';

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

function SubmitError({ error }) {
  const shortages = Array.isArray(error.details) ? error.details.filter((d) => d.title) : [];
  return (
    <Notice tone="danger">
      {error.message}
      {shortages.length > 0 && (
        <ul className="mb-0 mt-2 pl-5 font-normal">
          {shortages.map((d) => (
            <li key={d.bookId}>
              {d.title}: {d.requested} requested, only {d.available} available.
            </li>
          ))}
        </ul>
      )}
    </Notice>
  );
}

/**
 * Step 2 (F8): the whole lending, checked before any stock is subtracted.
 * "Back to edit" keeps every value; "Confirm lending" sends it.
 */
export default function LendingSummary({ onConfirmed }) {
  const { lines, borrower, submitting, submitError } = useLibraryStore((state) => state.lending);
  const backToEdit = useLibraryStore((state) => state.backToEdit);
  const confirmLending = useLibraryStore((state) => state.confirmLending);

  const items = lines.map((line) => ({
    bookId: line.bookId,
    // Stock as found when the book was chosen, updated from the API if a confirm was refused.
    book: line.book,
    quantity: Number(line.quantity),
  }));
  const copies = items.reduce((sum, item) => sum + item.quantity, 0);
  // Stock can drop while the summary is open (another lending); then it must be edited first.
  const canConfirm = items.every(({ book, quantity }) => book && quantity <= book.stock);

  const onConfirm = async () => {
    if (await confirmLending()) onConfirmed();
  };

  return (
    <Card className="flex max-w-[680px] flex-col gap-5" aria-label="Lending summary" role="region">
      <div className="-mx-6 -mt-6 rounded-t-lg bg-brand-soft px-6 py-4">
        <div className="text-[13px] font-semibold text-brand-text">Step 2 of 2 · Check before confirming</div>
        <h2 className="m-0 font-display text-xl font-semibold leading-[26px]">Lending summary</h2>
      </div>

      {submitError && <SubmitError error={submitError} />}

      <dl className="m-0 grid grid-cols-[140px_1fr] gap-x-4 gap-y-2">
        <dt className="text-[13px] font-semibold text-muted">Borrower</dt>
        <dd className="m-0">{borrower.borrowerName.trim()}</dd>
        <dt className="text-[13px] font-semibold text-muted">Phone</dt>
        <dd className="m-0">{borrower.phoneNumber.trim()}</dd>
        <dt className="text-[13px] font-semibold text-muted">Due date</dt>
        <dd className="m-0">
          <DueBadge date={borrower.dueDate} />
        </dd>
      </dl>

      <Table>
        <THead>
          <Th>Book</Th>
          <Th align="right">Qty</Th>
          <Th align="right">Stock after</Th>
        </THead>
        <TBody>
          {items.map(({ bookId, book, quantity }) => (
            <Tr key={bookId}>
              <Td label="Book" className="font-display font-semibold">
                {/* The book can disappear if it is removed while this summary is open. */}
                {book ? book.title : 'No longer in the library'}
              </Td>
              <Td label="Qty" numeric>
                {quantity}
              </Td>
              <Td label="Stock after" numeric>
                {book && quantity <= book.stock ? (
                  `${book.stock} → ${book.stock - quantity}`
                ) : (
                  <span className="font-semibold text-danger">{book ? `Only ${book.stock} available` : '—'}</span>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-semibold">
          Total: {plural(copies, 'copy', 'copies')} · {plural(items.length, 'title', 'titles')}
        </span>
        <span className="flex gap-3">
          <Button variant="ghost" onClick={backToEdit} disabled={submitting}>
            Back to edit
          </Button>
          <Button onClick={onConfirm} disabled={submitting || !canConfirm}>
            Confirm lending
          </Button>
        </span>
      </div>
    </Card>
  );
}
