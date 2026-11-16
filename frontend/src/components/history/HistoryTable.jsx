import { DueBadge } from '../ui/Badge';
import { TBody, THead, Table, Td, Th, Tr } from '../ui/Table';
import { formatDate } from '../../lib/date';

/**
 * Past lendings, one row per lending (never per book). "Lent by" is the signed-in user who
 * confirmed it, so a missing book can be traced to who handed it out.
 */
export default function HistoryTable({ lendings, emptyState }) {
  return (
    <Table>
      <THead>
        <Th>Date</Th>
        <Th>Borrower</Th>
        <Th>Books</Th>
        <Th>Due</Th>
        <Th>Lent by</Th>
      </THead>
      <TBody>
        {lendings.length === 0 ? (
          <Tr>
            <Td colSpan={5} className="px-5 py-8 text-center text-muted max-sm:!block">
              {emptyState}
            </Td>
          </Tr>
        ) : (
          lendings.map((lending) => (
            <Tr key={lending.id}>
              <Td label="Date" className="whitespace-nowrap">
                {formatDate(lending.createdAt)}
              </Td>
              <Td label="Borrower">
                <div>
                  <div className="font-semibold">{lending.borrowerName}</div>
                  <div className="text-[13px] text-muted">{lending.phoneNumber}</div>
                </div>
              </Td>
              <Td label="Books">
                <ul className="m-0 list-none p-0">
                  {lending.items.map((item) => (
                    <li key={item.bookId}>
                      {item.title} ×{item.quantity}
                    </li>
                  ))}
                </ul>
              </Td>
              <Td label="Due">
                <DueBadge date={lending.dueDate} />
              </Td>
              <Td label="Lent by" className="text-[13px] text-muted">
                {lending.lentBy.name}
              </Td>
            </Tr>
          ))
        )}
      </TBody>
    </Table>
  );
}
