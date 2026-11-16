import { useEffect, useState } from 'react';
import { Input, Select } from '../ui/Input';
import { LABEL } from '../../lib/classes';
import { ALL_GENRES } from '../../lib/constants';
import { useDebounced } from '../../lib/useDebounced';

// The select's value for "no genre filter".
const ALL = '';

/**
 * Search (title or author) and genre filter above the book list. The search is sent once typing
 * pauses, not on every key. Sorting is done from the Title and Stock column headers.
 */
export default function FilterBar({ genres, genreId, search, onGenreChange, onSearchChange }) {
  const [text, setText] = useState(search);
  const debounced = useDebounced(text, 300);

  useEffect(() => {
    if (debounced.trim() !== search) onSearchChange(debounced.trim());
    // Only react to what was typed; `search` changing from the store must not send it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Find books">
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5 sm:max-w-sm">
        <label className={LABEL} htmlFor="search-books">
          Search
        </label>
        <Input
          id="search-books"
          type="search"
          placeholder="Title or author"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className="flex w-56 flex-col gap-1.5">
        <label className={LABEL} htmlFor="filter-genre">
          Genre
        </label>
        <Select
          id="filter-genre"
          value={genreId ?? ALL}
          onChange={(event) => onGenreChange(event.target.value || null)}
        >
          <option value={ALL}>{ALL_GENRES}</option>
          {genres.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
