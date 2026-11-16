const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-11" or an ISO timestamp → "11 Oct 2026". Date-only values are read as local dates. */
export function formatDate(value) {
  const date = DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** A Date → "Sunday, 11 October 2026" (sidebar). */
export function formatLongDate(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "YYYY-MM-DD" + n days → "YYYY-MM-DD" (local calendar). */
export function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return todayISO(new Date(year, month - 1, day + days));
}

/** Today's local date as "YYYY-MM-DD", the format of <input type="date">. */
export function todayISO(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
