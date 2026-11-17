import { Button } from "@mostly/ui/components/button";
import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

const modes = {
  dark: { icon: Moon, label: "Dark", next: "light" },
  light: { icon: Sun, label: "Light", next: "system" },
  system: { icon: Monitor, label: "System", next: "dark" },
} as const;

export const ModeToggle = () => {
  const { theme, setTheme } = useTheme();
  const mode = theme === "dark" || theme === "light" ? theme : "system";
  const { icon: Icon, label, next } = modes[mode];
  const description = `Theme: ${label}. Switch to ${modes[next].label.toLowerCase()} mode`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-13 rounded-full active:not-aria-[haspopup]:translate-y-0"
      aria-label={description}
      title={description}
      onClick={() => setTheme(next)}
    >
      <Icon aria-hidden="true" className="size-5" />
    </Button>
  );
};
