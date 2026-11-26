import { createDb } from "@mostly/db";
import { env as workerEnv } from "cloudflare:workers";

import { createDevServerApp } from "./dev-app";

const devEnv = workerEnv as DevEnv;

const { fetch, scheduled } = createDevServerApp({
  env: devEnv,
  getDb: () => createDb(devEnv),
});

export { scheduled };

export default {
  fetch,
  scheduled,
};
