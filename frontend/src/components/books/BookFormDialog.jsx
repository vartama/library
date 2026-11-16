import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Dialog from '../ui/Dialog';
import Field from '../ui/Field';
import { Input, Select } from '../ui/Input';
import Notice from '../ui/Notice';
import { useLibraryStore } from '../../store/library';

// A new book starts with at least one copy; an existing one may go down to 0.
const MIN_COPIES = { add: 1, edit: 0 };

const toValues = (book) =>
  book
    ? { title: book.title, author: book.author, genreId: book.genre?.id ?? '', copies: String(book.stock) }
    : { title: '', author: '', genreId: '', copies: '1' };

function validate(values, minCopies) {
  const errors = {};
  if (!values.title.trim()) errors.title = 'Enter the book title.';
  if (!values.author.trim()) errors.author = 'Enter the author.';
  if (!values.genreId) errors.genreId = 'Choose a genre.';
  const copies = Number(values.copies);
  if (values.copies.trim() === '' || !Number.isInteger(copies) || copies < minCopies) {
    errors.copies = `Enter a whole number, ${minCopies} or more.`;
  }
  return errors;
}

// API field names → form field names, for errors returned by the server.
const FIELD_FROM_API = { title: 'title', author: 'author', genreId: 'genreId', stock: 'copies' };

function serverFieldErrors(details) {
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(
    details.filter((d) => FIELD_FROM_API[d.field]).map((d) => [FIELD_FROM_API[d.field], d.message]),
  );
}

/** Adds a book, or edits `book` when one is given. */
export default function BookFormDialog({ book, onClose }) {
  const mode = book ? 'edit' : 'add';
  const addBook = useLibraryStore((state) => state.addBook);
  const updateBook = useLibraryStore((state) => state.updateBook);
  const genres = useLibraryStore((state) => state.genres);
  const fetchGenres = useLibraryStore((state) => state.fetchGenres);

  const [values, setValues] = useState(() => toValues(book));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Always load the current genres: another admin may have added or renamed one.
  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  // Until a genre is picked, a new book uses the first one in the list.
  const genreId = values.genreId || (mode === 'add' ? (genres[0]?.id ?? '') : '');

  const onChange = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate({ ...values, genreId }, MIN_COPIES[mode]);
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      title: values.title.trim(),
      author: values.author.trim(),
      genreId,
      stock: Number(values.copies),
    };

    setSaving(true);
    try {
      await (mode === 'add' ? addBook(payload) : updateBook(book, payload));
      onClose();
    } catch (err) {
      const fieldErrors = serverFieldErrors(err.details);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(err.message);
      setSaving(false);
    }
  };

  return (
    <Dialog title={mode === 'add' ? 'Add a book' : 'Edit book'} onClose={onClose} size="md" bodyClassName="">
      <form noValidate onSubmit={onSubmit} className="mt-3 grid gap-4 sm:grid-cols-2">
        {formError && (
          <Notice tone="danger" className="col-span-full">
            {formError}
          </Notice>
        )}
        <Field id="book-title" label="Title" error={errors.title} className="col-span-full">
          <Input name="title" value={values.title} onChange={onChange} data-autofocus />
        </Field>
        <Field id="book-author" label="Author" error={errors.author} className="col-span-full">
          <Input name="author" value={values.author} onChange={onChange} />
        </Field>
        <Field
          id="book-genre"
          label="Genre"
          error={errors.genreId}
          hint={genres.length === 0 ? 'Add a genre on the Genres page first.' : undefined}
        >
          <Select name="genreId" value={genreId} onChange={onChange}>
            {genres.length === 0 && <option value="">No genres yet</option>}
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="book-copies" label="Copies" error={errors.copies}>
          <Input
            name="copies"
            type="number"
            min={MIN_COPIES[mode]}
            step="1"
            value={values.copies}
            onChange={onChange}
          />
        </Field>
        <div className="col-span-full mt-1 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {mode === 'add' ? 'Save book' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
