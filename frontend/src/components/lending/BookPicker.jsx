import { useEffect, useId, useRef, useState } from 'react';
import * as booksApi from '../../api/books.api';
import { INPUT, cx } from '../../lib/classes';
import { useDebounced } from '../../lib/useDebounced';

const RESULTS = 8;

/**
 * Search-as-you-type book picker (ARIA combobox). With 1000+ books a plain select is unusable, so
 * the librarian types part of a title or author and picks from the matches. Out-of-stock books and
 * books already on another line are listed but cannot be chosen, as in the design's select.
 *
 * `value` is the chosen book ({ id, title, stock }) or null. Field passes id / aria-* props.
 */
export default function BookPicker({ value, onChange, excludeIds, ...inputProps }) {
  const listId = useId();
  const [query, setQuery] = useState(value?.title ?? '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const latestSearch = useRef(0);
  const debouncedQuery = useDebounced(query, 250);

  const isUnavailable = (book) => book.stock === 0 || excludeIds.has(book.id);
  const searching = loading || query !== debouncedQuery;

  // Search while the list is open. (The form is mounted again on "Back to edit", so the input
  // starts from the chosen title without having to sync it from props.)
  useEffect(() => {
    if (!open) return;
    const search = ++latestSearch.current;
    setLoading(true);
    setError('');
    booksApi
      .getBooks({ search: debouncedQuery.trim() || undefined, sortBy: 'title', order: 'asc', limit: RESULTS })
      .then((page) => {
        if (search !== latestSearch.current) return; // a newer search is on its way
        setResults(page.items);
        setActive(page.items.findIndex((book) => !isUnavailable(book)));
      })
      .catch((err) => search === latestSearch.current && setError(err.message))
      .finally(() => search === latestSearch.current && setLoading(false));
    // isUnavailable only reads excludeIds, which is stable while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, open]);

  const choose = (book) => {
    if (!book || isUnavailable(book)) return;
    onChange({ id: book.id, title: book.title, stock: book.stock });
    setQuery(book.title);
    setOpen(false);
  };

  const move = (step) => {
    if (results.length === 0) return;
    let next = active;
    for (let i = 0; i < results.length; i += 1) {
      next = (next + step + results.length) % results.length;
      if (!isUnavailable(results[next])) break;
    }
    setActive(next);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (open) move(1);
      else setOpen(true);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      // While a search is still on its way the list shows the previous results; do not pick one.
      if (!searching) choose(results[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const onInput = (event) => {
    setQuery(event.target.value);
    setOpen(true);
    if (value) onChange(null); // typing again means choosing again
  };

  const onBlur = () => {
    setOpen(false);
    if (value) setQuery(value.title); // show the chosen title, not a half-typed search
  };

  const optionId = (index) => `${listId}-option-${index}`;
  let status = null;
  if (error) status = error;
  else if (loading && results.length === 0) status = 'Searching…';
  else if (!loading && results.length === 0) status = `No books match “${debouncedQuery.trim()}”.`;

  return (
    <div className="relative">
      <input
        {...inputProps}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        placeholder="Search by title or author"
        className={INPUT}
        value={query}
        onChange={onInput}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-raised py-1 shadow-pop"
        >
          {status ? (
            <li className="px-3 py-2 text-[13px] text-muted" role="presentation">
              {status}
            </li>
          ) : (
            results.map((book, index) => {
              const unavailable = isUnavailable(book);
              return (
                <li
                  key={book.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  aria-disabled={unavailable || undefined}
                  // mousedown, not click: it fires before the input's blur closes the list
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(book);
                  }}
                  onMouseEnter={() => !unavailable && setActive(index)}
                  className={cx(
                    'flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2',
                    index === active && 'bg-brand-soft',
                    unavailable && 'cursor-not-allowed text-muted',
                  )}
                >
                  <span className="min-w-0 truncate">
                    <span className={cx('font-semibold', !unavailable && 'text-ink')}>{book.title}</span>
                    <span className="text-[13px] text-muted"> · {book.author}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-muted tabular-nums">
                    {excludeIds.has(book.id) ? 'Already added' : `${book.stock} available`}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
