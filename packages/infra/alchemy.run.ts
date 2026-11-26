import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as State from "alchemy/State";
import { Redacted } from "effect";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const optional = (key: string) => Config.String(key).pipe(Config.withDefault(""));
const optionalSecret = (key: string) =>
  Config.Redacted(key).pipe(Config.withDefault(Redacted.make("")));

const sharedServerConfig = {
  compatibility: {
    flags: ["nodejs_compat"],
  },
  crons: ["*/5 * * * *"],
  dev: {
    port: 4003,
    strictPort: true,
  },
};

const sharedServerEnv = {
  DATABASE_URL: Config.Redacted("DATABASE_URL"),
  CORS_ORIGIN: Config.String("CORS_ORIGIN"),
  BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
  // OAuth callbacks use the browser-facing origin, including a dev HTTPS proxy.
  BETTER_AUTH_URL: Config.String("BETTER_AUTH_URL"),
  DATABASE_AUTH_TOKEN: optionalSecret("DATABASE_AUTH_TOKEN"),
  VAPID_PUBLIC_KEY: optional("VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: optionalSecret("VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: optional("VAPID_SUBJECT"),
  REMINDER_RUN_SECRET: optionalSecret("REMINDER_RUN_SECRET"),
};

export const server = Cloudflare.Worker("server", {
  ...sharedServerConfig,
  main: "../../apps/server/src/index.ts",
  env: {
    ...sharedServerEnv,
    GOOGLE_CLIENT_ID: Config.String("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: Config.Redacted("GOOGLE_CLIENT_SECRET"),
  },
});

export const devServer = Cloudflare.Worker("server", {
  ...sharedServerConfig,
  main: "../../apps/server/src/index.dev.ts",
  env: {
    ...sharedServerEnv,
    GOOGLE_CLIENT_ID: optional("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: optionalSecret("GOOGLE_CLIENT_SECRET"),
    DEV_AUTH_ENABLED: optional("DEV_AUTH_ENABLED"),
    DEV_AUTH_EMAIL: optional("DEV_AUTH_EMAIL"),
    DEV_AUTH_NAME: optional("DEV_AUTH_NAME"),
  },
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;
export type DevServerEnv = Cloudflare.InferEnv<typeof devServer>;

export default Alchemy.Stack(
  "mostly",
  {
    providers: Cloudflare.providers(),
    state: Layer.unwrap(
      Alchemy.ALCHEMY_DEV.pipe(
        Effect.map((dev) => (dev ? State.localState() : Cloudflare.state())),
      ),
    ).pipe(Layer.orDie),
  },
  Effect.gen(function* deploy() {
    const isDev = yield* Alchemy.ALCHEMY_DEV;
    if (!isDev) {
      const devAuthEnabled = yield* Config.Boolean("DEV_AUTH_ENABLED").pipe(
        Config.withDefault(false),
      );
      if (devAuthEnabled) {
        return yield* Effect.die(
          new Error("DEV_AUTH_ENABLED cannot be enabled outside local development."),
        );
      }
    }

    const serverWorker = yield* isDev ? devServer : server;
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
          }),
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
  }),
);
