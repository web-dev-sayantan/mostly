import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

const Devtools = () => (
  <>
    <TanStackRouterDevtools position="bottom-left" />
    <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
  </>
);

export default Devtools;
