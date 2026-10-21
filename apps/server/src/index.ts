import { createPushSender, pushConfigFromEnv } from "@mostly/api/push";
import { runReminders } from "@mostly/api/reminder-service";
import { appRouter } from "@mostly/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { createAuth, getDb } from "./services";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const auth = await createAuth();
  return auth.handler(c.req.raw);
});

const pushSender = () => {
  const config = pushConfigFromEnv(ENV);
  return config ? createPushSender(config) : null;
};

// Cron triggers run every five minutes; this endpoint is for an external
// scheduler and for manual checks. Both share the same idempotent delivery log.
app.post("/api/reminders/run", async (c) => {
  const secret = ENV.REMINDER_RUN_SECRET;
  if (!secret) {
    return c.json({ error: "Reminder runs are not configured." }, 503);
  }
  if (c.req.header("authorization") !== `Bearer ${secret}`) {
    return c.text("Unauthorized", 401);
  }

  const summary = await runReminders({
    db: getDb(),
    now: new Date(),
    sender: pushSender(),
  });
  return c.json(summary);
});

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- oRPC's onError takes a callback.
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- oRPC's onError takes a callback.
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  return next();
});

app.get("/", (c) => c.text("OK"));

const runScheduledReminders = async (scheduledTime: number): Promise<void> => {
  try {
    await runReminders({
      db: getDb(),
      now: new Date(scheduledTime),
      sender: pushSender(),
    });
  } catch (error) {
    console.error("Reminder run failed", error);
  }
};

export const scheduled = (
  controller: ScheduledController,
  _env: Env,
  ctx: ExecutionContext
) => {
  ctx.waitUntil(runScheduledReminders(controller.scheduledTime));
};

export default app;
