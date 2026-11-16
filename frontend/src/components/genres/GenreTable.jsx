import Button from '../ui/Button';
import { GenreBadge } from '../ui/Badge';
import { TBody, THead, Table, Td, Th, Tr } from '../ui/Table';

export default function GenreTable({ genres, onEdit, onRemove, emptyState }) {
  return (
    <Table>
      <THead>
        <Th>Genre</Th>
        <Th align="right">Books</Th>
        <Th>
          <span className="sr-only">Actions</span>
        </Th>
      </THead>
      <TBody>
        {genres.length === 0 ? (
          <Tr>
            <Td colSpan={3} className="px-5 py-8 text-center text-muted max-sm:!block">
              {emptyState}
            </Td>
          </Tr>
        ) : (
          genres.map((genre) => (
            <Tr key={genre.id}>
              <Td label="Genre">
                <GenreBadge genre={genre.name} />
              </Td>
              <Td label="Books" numeric>
                <span className="font-semibold">{genre.bookCount}</span>
              </Td>
              <Td label="" className="text-right">
                <div className="inline-flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onEdit(genre)} aria-label={`Rename ${genre.name}`}>
                    Rename
                  </Button>
                  <Button
                    variant="danger-quiet"
                    size="sm"
                    onClick={() => onRemove(genre)}
                    aria-label={`Remove ${genre.name}`}
                  >
                    Remove
                  </Button>
                </div>
              </Td>
            </Tr>
          ))
        )}
      </TBody>
    </Table>
  );
}
