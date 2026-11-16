import Button from '../ui/Button';
import { GenreBadge, StockBadge } from '../ui/Badge';
import { TBody, THead, Table, Td, Th, Tr } from '../ui/Table';
import { BOOK_TITLE, TH_SORT_BUTTON } from '../../lib/classes';

/** A column header that sorts the list (F5). */
function SortableTh({ column, label, sort, onSort, align }) {
  const active = sort?.sortBy === column;
  const ariaSort = active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none';
  const indicator = active ? (sort.order === 'asc' ? '▲' : '▼') : '↕';

  if (!onSort) return <Th align={align}>{label}</Th>;

  return (
    <Th align={align} aria-sort={ariaSort}>
      <button type="button" className={TH_SORT_BUTTON} onClick={() => onSort(column)}>
        {label} <span aria-hidden="true">{indicator}</span>
      </button>
    </Th>
  );
}

/**
 * The library's books. `onEdit` / `onRemove` are only given to admins; without them the actions
 * column is not rendered. With `sort` and `onSort` the Title and Stock headers sort the list.
 * `emptyState` is shown in place of the rows when there are no books.
 */
export default function BookTable({ books, sort, onSort, onEdit, onRemove, emptyState, footer }) {
  const hasActions = Boolean(onEdit || onRemove);
  const columns = hasActions ? 4 : 3;

  return (
    <Table footer={footer}>
      <THead>
        <SortableTh column="title" label="Title" sort={sort} onSort={onSort} />
        <Th>Genre</Th>
        <SortableTh column="stock" label="Stock" sort={sort} onSort={onSort} align="right" />
        {hasActions && (
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        )}
      </THead>
      <TBody>
        {books.length === 0 ? (
          <Tr>
            <Td colSpan={columns} className="px-5 py-8 text-center text-muted max-sm:!block">
              {emptyState}
            </Td>
          </Tr>
        ) : (
          books.map((book) => (
            <Tr key={book.id}>
              <Td label="Title">
                <div>
                  <div className={BOOK_TITLE}>{book.title}</div>
                  <div className="text-[13px] leading-[18px] text-muted">{book.author}</div>
                </div>
              </Td>
              <Td label="Genre">
                <GenreBadge genre={book.genre?.name} />
              </Td>
              <Td label="Stock" numeric>
                <span className="mr-2 font-semibold">{book.stock}</span>
                <StockBadge stock={book.stock} />
              </Td>
              {hasActions && (
                <Td label="" className="text-right">
                  <div className="inline-flex gap-2">
                    {onEdit && (
                      <Button variant="secondary" size="sm" onClick={() => onEdit(book)} aria-label={`Edit ${book.title}`}>
                        Edit
                      </Button>
                    )}
                    {onRemove && (
                      <Button
                        variant="danger-quiet"
                        size="sm"
                        onClick={() => onRemove(book)}
                        aria-label={`Remove ${book.title}`}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </Td>
              )}
            </Tr>
          ))
        )}
      </TBody>
    </Table>
  );
}
