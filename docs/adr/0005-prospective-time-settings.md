# Time-setting changes are prospective and history-stable

Week start, day rollover, and timezone are stored as an effective-dated history rather than only as current preferences. Past logical dates and completed weeks keep the boundaries in effect at the time: week-start changes apply to the next logical week, a rollover change closes the current day under the old rule and applies from the next logical day, timezone changes apply at the next logical day, and a week-start change starts a new weekly streak era. This prevents a preference change from silently re-scoring months of history or moving "today" backward.

**Consequences:** stats read settings by date; a week-start transition week is not scored; timezone changes require confirmation. If the history table is not worth the complexity, these settings must be locked after onboarding instead.
