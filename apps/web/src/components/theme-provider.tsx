import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import * as React from "react";

const themeColors = { light: "#F7F4EE", dark: "#141512" } as const;

function ThemeColor() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") {
      return;
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColors[resolvedTheme]);
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColor />
      {children}
    </NextThemesProvider>
  );
}

export { useTheme } from "next-themes";
