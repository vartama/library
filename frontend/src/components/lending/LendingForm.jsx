import Button from '../ui/Button';
import Card from '../ui/Card';
import Field from '../ui/Field';
import { Input } from '../ui/Input';
import LendingLine from './LendingLine';
import { SECTION_TITLE } from '../../lib/classes';
import { addDays, todayISO } from '../../lib/date';
import { useLibraryStore } from '../../store/library';

/** Step 1: one or more books and the borrower. "Review lending" never changes stock. */
export default function LendingForm() {
  const { lines, borrower, errors } = useLibraryStore((state) => state.lending);
  const addLine = useLibraryStore((state) => state.addLendingLine);
  const removeLine = useLibraryStore((state) => state.removeLendingLine);
  const updateLine = useLibraryStore((state) => state.updateLendingLine);
  const setBorrowerField = useLibraryStore((state) => state.setBorrowerField);
  const reviewLending = useLibraryStore((state) => state.reviewLending);

  const usedBookIds = new Set(lines.map((line) => line.bookId).filter(Boolean));
  // One empty line at a time: choose a book before adding the next.
  const hasEmptyLine = lines.some((line) => !line.book);

  const onSubmit = (event) => {
    event.preventDefault();
    reviewLending();
  };

  const onBorrowerChange = (event) => setBorrowerField(event.target.name, event.target.value);

  return (
    <Card as="form" noValidate onSubmit={onSubmit} className="flex flex-col gap-6" aria-label="Lend books">
      <div className="flex flex-col gap-3">
        <h2 className={SECTION_TITLE}>Books to lend</h2>
        {lines.map((line, index) => (
          <LendingLine
            key={line.key}
            index={index}
            line={line}
            usedBookIds={usedBookIds}
            errors={errors.lines[index]}
            canRemove={lines.length > 1}
            onChange={updateLine}
            onRemove={removeLine}
          />
        ))}
        <div>
          <Button variant="secondary" size="sm" onClick={addLine} disabled={hasEmptyLine}>
            + Add another book
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="borrower-name" label="Borrower's name" error={errors.borrowerName}>
          <Input name="borrowerName" value={borrower.borrowerName} onChange={onBorrowerChange} autoComplete="off" />
        </Field>
        <Field id="borrower-phone" label="Phone number" error={errors.phoneNumber}>
          <Input
            name="phoneNumber"
            inputMode="tel"
            placeholder="e.g. 0812 3456 7890"
            value={borrower.phoneNumber}
            onChange={onBorrowerChange}
            autoComplete="off"
          />
        </Field>
        <Field id="due-date" label="Due date" error={errors.dueDate} hint="Must be after today.">
          <Input
            name="dueDate"
            type="date"
            min={addDays(todayISO(), 1)}
            value={borrower.dueDate}
            onChange={onBorrowerChange}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="accent">
          Review lending
        </Button>
      </div>
    </Card>
  );
}
