// Stock status is derived from the number of copies, never typed (Badge guideline).
export const STOCK_STATUS = {
  out: { symbol: '■', label: 'Out of stock' },
  low: { symbol: '▲', label: 'Low' },
  ok: { symbol: '●', label: 'In stock' },
};

export function stockStatus(stock) {
  if (stock <= 0) return 'out';
  if (stock <= 2) return 'low';
  return 'ok';
}
