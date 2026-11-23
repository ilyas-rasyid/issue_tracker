import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export function ThemeSwitcher() {
  const initial = (): Theme =>
    localStorage.getItem('tracker-theme') === 'dark' ? 'dark' : 'light';
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    localStorage.setItem('tracker-theme', next);
  }

  return (
    <div className="theme-control" aria-label="Color theme">
      {(['light', 'dark'] as const).map((t) => (
        <button
          type="button"
          key={t}
          title={`${t} mode`}
          aria-label={`${t} mode`}
          aria-pressed={theme === t}
          onClick={() => choose(t)}
        >
          {t === 'light' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      ))}
    </div>
  );
}
