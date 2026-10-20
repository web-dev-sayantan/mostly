# Use real web push for the daily reminder

A daily reminder is part of the core loop, and an in-app banner only appears when the app is already open, so it is not a reminder. We use real Web Push with per-device push subscriptions, a per-logical-day delivery log, and a scheduled job that sends at most one reminder per user per logical day to the most recently active subscription. iOS permission is requested after the PWA is installed, not during onboarding.

**Consequences:** the build includes a scheduler, VAPID keys, subscription lifecycle handling, and delivery idempotency. If push is denied or unsupported, the app shows an in-app nudge on next open and does not pretend a background reminder will arrive.
