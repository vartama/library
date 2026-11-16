// Client-side checks for "Review lending", with the messages from the design system's prototype.
// The API checks the same rules again on confirm.

const PHONE_SEPARATORS = /[\s+\-()]/g;

/**
 * @param draft     { lines: [{ bookId, quantity }], borrower: { borrowerName, phoneNumber, dueDate } }
 * @param bookById  Map of book id → book (with current stock)
 * @param today     "YYYY-MM-DD"
 * @returns         { lines: { [index]: { bookId?, quantity? } }, borrowerName?, phoneNumber?, dueDate? }
 */
export function validateLending({ lines, borrower }, bookById, today) {
  const errors = { lines: {} };

  lines.forEach((line, index) => {
    const lineErrors = {};
    const book = bookById.get(line.bookId);
    const quantity = Number(line.quantity);

    if (!book) lineErrors.bookId = 'Choose a book.';

    if (String(line.quantity).trim() === '' || !Number.isInteger(quantity) || quantity < 1) {
      lineErrors.quantity = 'Enter a whole number, 1 or more.';
    } else if (book && quantity > book.stock) {
      lineErrors.quantity = `Only ${book.stock} available.`;
    }

    if (Object.keys(lineErrors).length > 0) errors.lines[index] = lineErrors;
  });

  if (!borrower.borrowerName.trim()) {
    errors.borrowerName = "Enter the borrower's name.";
  }
  if (!/^\d{9,15}$/.test(borrower.phoneNumber.replace(PHONE_SEPARATORS, ''))) {
    errors.phoneNumber = 'Enter a phone number with 9–15 digits.';
  }
  if (!borrower.dueDate) {
    errors.dueDate = 'Choose a due date.';
  } else if (borrower.dueDate <= today) {
    errors.dueDate = 'Due date must be after today.';
  }

  return errors;
}

export function hasErrors(errors) {
  const { lines = {}, ...fields } = errors;
  return Object.keys(lines).length > 0 || Object.keys(fields).length > 0;
}
