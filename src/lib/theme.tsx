import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Mode = "light" | "dark";
type Ctx = { mode: Mode; toggle: () => void };

const ThemeContext = createContext<Ctx | null>(null);
const KEY = "tapwash.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") setMode(stored);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setMode("dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  const value = useMemo<Ctx>(
    () => ({
      mode,
      toggle: () =>
        setMode((m) => {
          const next = m === "dark" ? "light" : "dark";
          window.localStorage.setItem(KEY, next);
          return next;
        }),
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
