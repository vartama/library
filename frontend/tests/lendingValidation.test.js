import { describe, expect, it } from 'vitest';
import { hasErrors, validateLending } from '../src/lib/lendingValidation';
import { addDays } from '../src/lib/date';

const TODAY = '2026-10-11';
const BOOKS = new Map([
  ['b1', { id: 'b1', title: 'River of Salt', stock: 2 }],
  ['b2', { id: 'b2', title: 'Letters from the Harbour', stock: 8 }],
]);

const draft = ({ lines, ...borrower } = {}) => ({
  lines: lines ?? [{ bookId: 'b1', quantity: '2' }],
  borrower: { borrowerName: 'Budi Santoso', phoneNumber: '0812 3456 7890', dueDate: '2026-10-25', ...borrower },
});

describe('validateLending', () => {
  it('accepts a complete lending', () => {
    const errors = validateLending(draft(), BOOKS, TODAY);

    expect(hasErrors(errors)).toBe(false);
  });

  it.each([
    [{ bookId: '', quantity: '1' }, { bookId: 'Choose a book.' }],
    [{ bookId: 'b1', quantity: '' }, { quantity: 'Enter a whole number, 1 or more.' }],
    [{ bookId: 'b1', quantity: '0' }, { quantity: 'Enter a whole number, 1 or more.' }],
    [{ bookId: 'b1', quantity: '1.5' }, { quantity: 'Enter a whole number, 1 or more.' }],
    [{ bookId: 'b1', quantity: '3' }, { quantity: 'Only 2 available.' }],
  ])('line %o → %o', (line, expected) => {
    const errors = validateLending(draft({ lines: [line] }), BOOKS, TODAY);

    expect(errors.lines[0]).toEqual(expected);
  });

  it('reports each line by its position', () => {
    const errors = validateLending(
      draft({ lines: [{ bookId: 'b2', quantity: '1' }, { bookId: '', quantity: '1' }] }),
      BOOKS,
      TODAY,
    );

    expect(errors.lines).toEqual({ 1: { bookId: 'Choose a book.' } });
  });

  it.each([
    [{ borrowerName: '  ' }, 'borrowerName', "Enter the borrower's name."],
    [{ phoneNumber: '12345' }, 'phoneNumber', 'Enter a phone number with 9–15 digits.'],
    [{ phoneNumber: '0812 ABCD 789' }, 'phoneNumber', 'Enter a phone number with 9–15 digits.'],
    [{ phoneNumber: '1234567890123456' }, 'phoneNumber', 'Enter a phone number with 9–15 digits.'],
    [{ dueDate: '' }, 'dueDate', 'Choose a due date.'],
    [{ dueDate: TODAY }, 'dueDate', 'Due date must be after today.'],
    [{ dueDate: '2026-10-01' }, 'dueDate', 'Due date must be after today.'],
  ])('%o → %s', (change, field, message) => {
    const errors = validateLending(draft(change), BOOKS, TODAY);

    expect(errors[field]).toBe(message);
  });

  it.each(['0812 3456 7890', '+62 812-3456-7890', '(021) 555 0199'])('accepts the phone number %s', (phone) => {
    expect(validateLending(draft({ phoneNumber: phone }), BOOKS, TODAY).phoneNumber).toBeUndefined();
  });

  it('accepts tomorrow as the due date', () => {
    expect(validateLending(draft({ dueDate: addDays(TODAY, 1) }), BOOKS, TODAY).dueDate).toBeUndefined();
  });
});

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
