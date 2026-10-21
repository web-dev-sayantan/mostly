import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Redacted } from "effect";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import "varlock/auto-load";

const optional = (key: string) =>
  Config.String(key).pipe(Config.withDefault(""));
const optionalSecret = (key: string) =>
  Config.Redacted(key).pipe(Config.withDefault(Redacted.make("")));

export const server = Cloudflare.Worker("server", {
  main: "../../apps/server/src/index.ts",
  compatibility: {
    flags: ["nodejs_compat"],
  },
  crons: ["*/5 * * * *"],
  env: {
    DATABASE_URL: Config.Redacted("DATABASE_URL"),
    CORS_ORIGIN: Config.String("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    // Dev is reached through Caddy, so Worker.URL (localhost) is not the public origin.
    // shortcut: this also feeds deployed stages; switch back to Worker.URL for production.
    BETTER_AUTH_URL: Config.String("BETTER_AUTH_URL"),
    GOOGLE_CLIENT_ID: Config.String("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: Config.Redacted("GOOGLE_CLIENT_SECRET"),
    DATABASE_AUTH_TOKEN: Config.Redacted("DATABASE_AUTH_TOKEN"),
    VAPID_PUBLIC_KEY: optional("VAPID_PUBLIC_KEY"),
    VAPID_PRIVATE_KEY: optionalSecret("VAPID_PRIVATE_KEY"),
    VAPID_SUBJECT: optional("VAPID_SUBJECT"),
    REMINDER_RUN_SECRET: optionalSecret("REMINDER_RUN_SECRET"),
  },
  dev: {
    port: 3004,
  },
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

export default Alchemy.Stack(
  "mostly",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* deploy() {
    const serverWorker = yield* server;
    const webWorker = yield* Cloudflare.Website.Vite("web", {
      rootDir: "../../apps/web",
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "single-page-application",
      },
      env: {
        // The browser reaches the server through the public origin Caddy serves.
        // shortcut: this also feeds deployed stages; switch back to serverWorker.url for production.
        VITE_SERVER_URL: Config.String("BETTER_AUTH_URL"),
      },
      dev: {
        port: 3003,
      },
    });

    return {
      web: webWorker.url,
      server: serverWorker.url,
    };
  })
);
