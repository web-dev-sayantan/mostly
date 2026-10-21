/**
 * Removes this browser's push subscription. Ticket 12 also revokes the stored
 * push_subscription row for the endpoint when it adds server-side push.
 */
export const removePushSubscription = async (): Promise<void> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    // No subscription, or the browser will not let us inspect it: nothing to clear.
  }
};
