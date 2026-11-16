import { useState } from 'react';
import Button from '../ui/Button';
import Dialog from '../ui/Dialog';
import Field from '../ui/Field';
import { Input } from '../ui/Input';
import Notice from '../ui/Notice';
import { useLibraryStore } from '../../store/library';

/** Adds a genre, or renames `genre` when one is given. */
export default function GenreFormDialog({ genre, onClose }) {
  const mode = genre ? 'edit' : 'add';
  const addGenre = useLibraryStore((state) => state.addGenre);
  const updateGenre = useLibraryStore((state) => state.updateGenre);

  const [name, setName] = useState(genre?.name ?? '');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setError('Enter the genre name.');
      return;
    }
    setError('');

    setSaving(true);
    try {
      const payload = { name: name.trim() };
      await (mode === 'add' ? addGenre(payload) : updateGenre(genre, payload));
      onClose();
    } catch (err) {
      const fieldError = err.details?.find?.((d) => d.field === 'name')?.message;
      if (fieldError) setError(fieldError);
      else setFormError(err.message);
      setSaving(false);
    }
  };

  return (
    <Dialog title={mode === 'add' ? 'Add a genre' : 'Rename genre'} onClose={onClose} bodyClassName="">
      <form noValidate onSubmit={onSubmit} className="mt-3 flex flex-col gap-4">
        {formError && <Notice tone="danger">{formError}</Notice>}
        <Field
          id="genre-name"
          label="Name"
          error={error}
          hint={mode === 'edit' ? 'Every book in this genre shows the new name.' : undefined}
        >
          <Input name="name" value={name} onChange={(event) => setName(event.target.value)} data-autofocus />
        </Field>
        <div className="mt-1 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {mode === 'add' ? 'Save genre' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
