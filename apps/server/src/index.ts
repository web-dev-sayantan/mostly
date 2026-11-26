import { apiHandler, createServerApp, rpcHandler } from "./app";
import { ENV } from "./env.server";
import { createAuth, getDb } from "./services";

const { fetch, scheduled } = createServerApp({
  env: ENV,
  createAuth,
  getDb,
});

export { apiHandler, rpcHandler, scheduled };

export default {
  fetch,
  scheduled,
};
