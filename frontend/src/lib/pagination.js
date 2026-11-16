/**
 * The pages to show as buttons: always the first, the last and the ones around the current page,
 * with a gap ('…') elsewhere. 1 … 4 5 6 … 50
 */
export function pageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < totalPages);
  // Near either end, show a few more so the list keeps the same length.
  if (page <= 3) around.push(...[2, 3, 4].filter((p) => !around.includes(p)));
  if (page >= totalPages - 2) around.unshift(...[totalPages - 3, totalPages - 2, totalPages - 1].filter((p) => !around.includes(p)));
  const middle = [...new Set(around)].sort((a, b) => a - b);

  // A gap of a single page shows that page instead of '…'.
  const pages = [1];
  if (middle[0] === 3) pages.push(2);
  else if (middle[0] > 3) pages.push('…');
  pages.push(...middle);
  const lastShown = middle[middle.length - 1];
  if (lastShown === totalPages - 2) pages.push(totalPages - 1);
  else if (lastShown < totalPages - 2) pages.push('…');
  pages.push(totalPages);
  return pages;
}
