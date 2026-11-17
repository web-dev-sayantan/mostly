export type DeliveryStatus = "sent" | "failed" | "suppressed";

/**
 * The delivery log is a quiet record, not an error report. "Not sent" plus a
 * reason stays honest without surfacing the storage vocabulary.
 */
export const deliveryStatusCopy = (
  status: DeliveryStatus,
  error: string | null
): string => {
  if (status === "sent") {
    return "Sent";
  }

  if (status === "suppressed") {
    if (error === "all_done") {
      return "Not sent · Day already done";
    }
    if (error === "nothing_open") {
      return "Not sent · Nothing open";
    }
    if (error === "no_active_goals") {
      return "Not sent · No active goals";
    }
    return "Not sent";
  }

  if (error === "push_unconfigured") {
    return "Not sent · Notifications unavailable";
  }
  if (error === "no_subscription") {
    return "Not sent · No device notification";
  }
  if (error?.startsWith("push_4")) {
    return "Not sent · Device subscription expired";
  }
  return "Not sent · Push service unavailable";
};
