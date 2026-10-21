import { client } from "@/utils/orpc";

import { detectInstallPlatform } from "./install/install";

export const REMINDER_NOTICE_KEY = "mostly:reminder-permission-noted";
export const REMINDER_NUDGE_KEY = "mostly:reminder-nudge-dismissed";

export type PushPermission = NotificationPermission | "unsupported";

export type PushEnableResult =
  | { ok: true; endpoint: string }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "install-required"
        | "denied"
        | "not-configured"
        | "failed";
    };

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

const isStandalone = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true
  );
};

export const isInstalledApp = isStandalone;

export const pushPlatform = (): "ios" | "android" | "desktop" => {
  if (typeof navigator === "undefined") {
    return "desktop";
  }
  return detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
};

export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

export const pushPermission = (): PushPermission =>
  isPushSupported() ? Notification.permission : "unsupported";

const decodeKey = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value.padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "="
  );
  const raw = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.codePointAt(index) ?? 0;
  }
  return bytes;
};

const currentSubscription = async () => {
  if (!isPushSupported()) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
};

export const localPushEndpoint = async (): Promise<string | null> => {
  const subscription = await currentSubscription();
  return subscription?.endpoint ?? null;
};

/**
 * Must be called from a user gesture when permission is still `default`.
 * iOS only gets here from an installed app after the first session.
 */
export const enablePushReminders = async (
  publicKey?: string
): Promise<PushEnableResult> => {
  if (!isPushSupported()) {
    return { ok: false, reason: "unsupported" };
  }
  if (pushPlatform() === "ios" && !isStandalone()) {
    return { ok: false, reason: "install-required" };
  }

  try {
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      return { ok: false, reason: "denied" };
    }

    const keyResponse = publicKey
      ? { publicKey }
      : await client.reminders.publicKey();
    const key = keyResponse.publicKey ?? undefined;
    if (!key) {
      return { ok: false, reason: "not-configured" };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(key),
      }));

    const { keys } = subscription.toJSON();
    if (!(keys?.p256dh && keys.auth)) {
      return { ok: false, reason: "failed" };
    }

    await client.reminders.subscription.register({
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: navigator.userAgent.slice(0, 512),
    });

    return { ok: true, endpoint: subscription.endpoint };
  } catch {
    return { ok: false, reason: "failed" };
  }
};

/** Revoke this device on the server, then drop the browser subscription. */
export const removePushSubscription = async (): Promise<void> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const subscription = await currentSubscription();
  if (subscription) {
    try {
      await client.reminders.subscription.revoke({
        endpoint: subscription.endpoint,
      });
    } catch {
      // Sign-out still clears the browser side; the server revokes on delete.
    }
    try {
      await subscription.unsubscribe();
    } catch {
      // The browser already dropped it.
    }
  }
};

export const disablePushReminders = removePushSubscription;

export const sendTestPush = async (): Promise<PushEnableResult> => {
  const enabled = await enablePushReminders();
  if (!enabled.ok) {
    return enabled;
  }

  try {
    await client.reminders.test({ endpoint: enabled.endpoint });
    return enabled;
  } catch {
    return { ok: false, reason: "failed" };
  }
};
