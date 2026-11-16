// The design system switches themes only through `data-theme` on <html>, so components never
// use `dark:` classes. Default: follow the OS; once the librarian picks a theme, remember it.
const STORAGE_KEY = 'vartama-library-theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

function storedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
}

export function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not remembered across reloads; the switch still works for this visit.
  }
}

export function initTheme() {
  const query = media();
  apply(storedTheme() ?? (query?.matches ? 'dark' : 'light'));

  query?.addEventListener?.('change', (event) => {
    if (!storedTheme()) apply(event.matches ? 'dark' : 'light');
  });
}
