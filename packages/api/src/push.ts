import webpush from "web-push";

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSender {
  send: (
    subscription: PushSubscriptionRecord,
    payload: string
  ) => Promise<void>;
}

/** A non-2xx push-service answer. 404/410 mean the browser is gone. */
export class PushSendError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super(`Push service returned ${statusCode}.`);
    this.name = "PushSendError";
    this.statusCode = statusCode;
  }
}

/**
 * Encrypt locally, then POST with fetch. Workers can reach push services, while
 * the library's node:https path is not part of the compat surface.
 */
export const createPushSender = (config: PushConfig): PushSender => ({
  send: async (subscription, payload) => {
    const details = webpush.generateRequestDetails(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
      {
        vapidDetails: {
          subject: config.subject,
          publicKey: config.publicKey,
          privateKey: config.privateKey,
        },
        TTL: 60 * 60,
        urgency: "normal",
        contentEncoding: "aes128gcm",
      }
    );

    const response = await fetch(details.endpoint, {
      method: details.method,
      headers: details.headers,
      body: details.body ? new Uint8Array(details.body) : null,
    });

    if (!response.ok) {
      throw new PushSendError(response.status);
    }
  },
});

export const pushConfigFromEnv = (env: {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}): PushConfig | null => {
  if (!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)) {
    return null;
  }
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || "mailto:hello@mostly.app",
  };
};
