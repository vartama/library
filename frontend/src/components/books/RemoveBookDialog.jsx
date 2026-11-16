import { useState } from 'react';
import Button from '../ui/Button';
import Dialog from '../ui/Dialog';
import { useLibraryStore } from '../../store/library';

export default function RemoveBookDialog({ book, onClose }) {
  const removeBook = useLibraryStore((state) => state.removeBook);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const onConfirm = async () => {
    setRemoving(true);
    setError('');
    try {
      await removeBook(book);
      onClose();
    } catch (err) {
      setError(err.message);
      setRemoving(false);
    }
  };

  return (
    <Dialog
      title="Remove this book?"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={removing}>
            Remove book
          </Button>
        </>
      }
    >
      “{book.title}” and its {book.stock} {book.stock === 1 ? 'copy' : 'copies'} will be removed from the library.
      Past lending history is kept.
      {error && (
        <span role="alert" className="mt-3 block text-danger">
          {error}
        </span>
      )}
    </Dialog>
  );
}
