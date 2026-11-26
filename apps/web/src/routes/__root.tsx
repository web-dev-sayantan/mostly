import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

const Devtools =
  import.meta.env.DEV && import.meta.env.VITE_DEVTOOLS === "true"
    ? lazy(() => import("@/components/devtools"))
    : null;

const RootComponent = () => (
  <ThemeProvider>
    <Outlet />
    {Devtools ? (
      <Suspense fallback={null}>
        <Devtools />
      </Suspense>
    ) : null}
  </ThemeProvider>
);

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
});
