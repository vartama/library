import { useState } from 'react';
import Icon from './ui/Icon';
import { ICON_BUTTON } from '../lib/classes';
import { getTheme, setTheme } from '../theme';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);
  const next = theme === 'dark' ? 'light' : 'dark';

  const toggle = () => {
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button type="button" className={ICON_BUTTON} onClick={toggle} aria-label={`Switch to ${next} theme`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
