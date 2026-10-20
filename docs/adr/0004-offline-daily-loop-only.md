# Offline scope is the daily loop only

The core promise is that closing the day works without a network. Full offline goal management would require syncing versioned schedules, archive dates, and settings with conflict resolution, which is a much larger engine than a session queue. Offline mode therefore covers sessions, details, undo, and backfill for existing goals; goal creation/editing, archive, and settings require a connection.

**Consequences:** the local store and session sync contract must be built in the foundations, not added after Progress. The app shows "Connect to edit goals" when offline. A later full-offline feature would need its own conflict model for schedules and archives.
