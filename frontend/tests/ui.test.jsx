import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Button from '../src/components/ui/Button';
import Field from '../src/components/ui/Field';
import Dialog from '../src/components/ui/Dialog';
import { Input } from '../src/components/ui/Input';
import { DueBadge, StockBadge } from '../src/components/ui/Badge';

describe('Button', () => {
  it('uses the variant recipe and defaults to type="button"', () => {
    render(<Button variant="accent">Review lending</Button>);
    const button = screen.getByRole('button', { name: 'Review lending' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('bg-accent', 'text-on-accent');
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Confirm lending
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm lending' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('links the label and shows a hint', () => {
    render(
      <Field id="due" label="Due date" hint="Must be after today.">
        <Input type="date" />
      </Field>,
    );
    const input = screen.getByLabelText('Due date');

    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription('Must be after today.');
  });

  it('marks the control invalid and describes it with the error', () => {
    render(
      <Field id="phone" label="Phone number" error="Enter a phone number with 9–15 digits.">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Phone number');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a phone number with 9–15 digits.');
  });
});

describe('Badges', () => {
  it.each([
    [0, '■ Out of stock'],
    [2, '▲ Low'],
    [5, '● In stock'],
  ])('stock %i shows "%s"', (stock, text) => {
    render(<StockBadge stock={stock} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('formats the due date', () => {
    render(<DueBadge date="2026-10-25" />);
    expect(screen.getByText('25 Oct 2026')).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  function renderDialog(onClose = vi.fn()) {
    render(
      <Dialog
        title="Remove this book?"
        onClose={onClose}
        actions={
          <>
            <Button variant="secondary" data-autofocus onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger">Remove book</Button>
          </>
        }
      >
        Past lending history is kept.
      </Dialog>,
    );
    return onClose;
  }

  it('is a labelled modal that focuses Cancel', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Remove this book?' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const onClose = renderDialog();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
