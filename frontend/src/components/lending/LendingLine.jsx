import Button from '../ui/Button';
import Field from '../ui/Field';
import { Input } from '../ui/Input';
import BookPicker from './BookPicker';

/** One "book + quantity" line. A title cannot be chosen twice (BookPicker excludes the others). */
export default function LendingLine({ index, line, usedBookIds, errors = {}, canRemove, onChange, onRemove }) {
  const { book } = line;
  const otherLines = new Set([...usedBookIds].filter((id) => id !== line.bookId));

  return (
    <div className="flex flex-wrap items-start gap-3" data-testid="lending-line">
      <Field id={`line-${index}-book`} label="Book title" error={errors.bookId} className="min-w-[220px] flex-1">
        <BookPicker
          value={book}
          excludeIds={otherLines}
          onChange={(chosen) => onChange(index, { bookId: chosen?.id ?? '', book: chosen })}
        />
      </Field>
      <Field
        id={`line-${index}-quantity`}
        label="Quantity"
        error={errors.quantity}
        hint={book ? `Max ${book.stock}` : undefined}
        className="w-28"
      >
        <Input
          type="number"
          min="1"
          max={book?.stock}
          step="1"
          value={line.quantity}
          onChange={(event) => onChange(index, { quantity: event.target.value })}
        />
      </Field>
      {canRemove && (
        <Button
          variant="danger-quiet"
          size="sm"
          className="mt-[22px]"
          onClick={() => onRemove(index)}
          aria-label={`Remove line ${index + 1}`}
        >
          Remove
        </Button>
      )}
    </div>
  );
}
