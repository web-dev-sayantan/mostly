import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as State from "alchemy/State";
import { Redacted } from "effect";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

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
    // OAuth callbacks use the browser-facing origin, including a dev HTTPS proxy.
    BETTER_AUTH_URL: Config.String("BETTER_AUTH_URL"),
    GOOGLE_CLIENT_ID: Config.String("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: Config.Redacted("GOOGLE_CLIENT_SECRET"),
    DATABASE_AUTH_TOKEN: optionalSecret("DATABASE_AUTH_TOKEN"),
    VAPID_PUBLIC_KEY: optional("VAPID_PUBLIC_KEY"),
    VAPID_PRIVATE_KEY: optionalSecret("VAPID_PRIVATE_KEY"),
    VAPID_SUBJECT: optional("VAPID_SUBJECT"),
    REMINDER_RUN_SECRET: optionalSecret("REMINDER_RUN_SECRET"),
  },
  dev: {
    port: 4003,
    strictPort: true,
  },
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

export default Alchemy.Stack(
  "mostly",
  {
    providers: Cloudflare.providers(),
    state: Layer.unwrap(
      Alchemy.ALCHEMY_DEV.pipe(
        Effect.map((dev) => (dev ? State.localState() : Cloudflare.state()))
      )
    ).pipe(Layer.orDie),
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
        VITE_SERVER_URL: serverWorker.url.pipe(
          Output.map((url) => {
            if (!url) {
              throw new Error("Server Worker URL is unavailable");
            }
            return url;
          })
        ),
      },
      dev: {
        port: 3003,
        strictPort: true,
      },
      name: "mostly",
    });

    return {
      web: webWorker.url,
      server: serverWorker.url,
    };
  })
);
