import { useState } from 'react';
import Button from '../ui/Button';
import Dialog from '../ui/Dialog';
import { useLibraryStore } from '../../store/library';

const books = (count) => (count === 1 ? '1 book' : `${count} books`);

/**
 * A genre that still has books cannot be removed (the API refuses too), so the dialog explains
 * what to do instead of offering the action.
 */
export default function RemoveGenreDialog({ genre, onClose }) {
  const removeGenre = useLibraryStore((state) => state.removeGenre);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  if (genre.bookCount > 0) {
    return (
      <Dialog
        title="This genre is still in use"
        onClose={onClose}
        actions={
          <Button variant="secondary" onClick={onClose} data-autofocus>
            Close
          </Button>
        }
      >
        “{genre.name}” still has {books(genre.bookCount)}. Move them to another genre or remove them before removing
        the genre.
      </Dialog>
    );
  }

  const onConfirm = async () => {
    setRemoving(true);
    setError('');
    try {
      await removeGenre(genre);
      onClose();
    } catch (err) {
      setError(err.message);
      setRemoving(false);
    }
  };

  return (
    <Dialog
      title="Remove this genre?"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={removing}>
            Remove genre
          </Button>
        </>
      }
    >
      “{genre.name}” will be removed from the list of genres.
      {error && (
        <span role="alert" className="mt-3 block text-danger">
          {error}
        </span>
      )}
    </Dialog>
  );
}
