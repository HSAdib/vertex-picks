import { useEffect, useState } from 'react';
import { ThemeContext } from './ThemeContextValue';
export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('vp-theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return false;
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('vp-theme', isDark ? 'dark' : 'light');
  }, [isDark]);
  return <ThemeContext.Provider value={{ isDark, setIsDark }}>{children}</ThemeContext.Provider>;
}
