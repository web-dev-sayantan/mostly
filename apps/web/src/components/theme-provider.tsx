import { Toaster } from "@mostly/ui/components/sonner";
import type { ReactNode } from "react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const storageKey = "mostly-theme";
const darkPreference = "(prefers-color-scheme: dark)";
const themeColors = { light: "#F7F4EE", dark: "#141512" } as const;

type Theme = keyof typeof themeColors | "system";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

const parseTheme = (value: string | null): Theme =>
  value === "light" || value === "dark" ? value : "system";

const readTheme = (): Theme => {
  try {
    return parseTheme(localStorage.getItem(storageKey));
  } catch {
    return "system";
  }
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState(readTheme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(darkPreference).matches
  );
  const systemTheme = systemDark ? "dark" : "light";
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const preference = window.matchMedia(darkPreference);
    const updateSystemTheme = () => setSystemDark(preference.matches);
    const syncTheme = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) {
        setTheme(readTheme());
      }
    };

    updateSystemTheme();
    preference.addEventListener("change", updateSystemTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      preference.removeEventListener("change", updateSystemTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColors[resolvedTheme]);
  }, [resolvedTheme]);

  const selectTheme = useCallback((next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // The current tab can switch themes without persistent storage.
    }
  }, []);
  const context = useMemo(
    () => ({ theme, setTheme: selectTheme }),
    [theme, selectTheme]
  );

  return (
    <ThemeContext value={context}>
      {children}
      <Toaster richColors theme={resolvedTheme} />
    </ThemeContext>
  );
};

export const useTheme = () => {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("ThemeProvider is missing");
  }
  return context;
};
