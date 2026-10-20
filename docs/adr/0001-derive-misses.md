# Derive misses instead of storing them

A miss is an expected day with no session after rollover, so storing auto-created miss rows duplicates the schedule and creates cleanup work when goals start, archive, change cadence, or sync from an offline device. We derive misses on read from schedule versions, start dates, archive dates, and sessions; only done sessions are stored. The 7-day correction window is a write rule, not a row state.

**Consequences:** exports include a derived daily/weekly outcome section; there is no stored "acknowledged miss" record. A future explicit state would need its own concept, not a second session status.
