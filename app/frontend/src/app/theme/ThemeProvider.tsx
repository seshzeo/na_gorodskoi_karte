import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemePreference = "system" | "light" | "dark";
type ThemeContextValue = { preference: ThemePreference; resolvedTheme: "light" | "dark"; setPreference: (value: ThemePreference) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "map-points-theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const resolvedTheme = preference === "system" ? systemTheme : preference;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    localStorage.setItem(STORAGE_KEY, preference);
  }, [preference, resolvedTheme]);

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [preference, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
