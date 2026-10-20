# Mostly — Product Spec

**A quiet record of what you did.**

Status: Draft v0.2 · 20 Oct 2026 · Supersedes v0.1 · Single-user personal web app / PWA
Working name: **Mostly** (placeholder — see Decisions & open questions)

---

## 1. Summary

Mostly answers one question at the end of the day: **what did I do, and what did I miss?**

You keep a short list of goals — reading, guitar, singing, coding, whatever matters — and mark each one with a single tap. Minutes, a note, and a quick feeling are optional. Progress then shows the honest shape of the record: consistency, streaks, sessions, minutes, a heatmap, and weekly targets.

It is not a task manager, a social habit game, or a productivity scoreboard. It is a small, private ledger.

**The bet:** the daily loop is so short that it survives real life. The record is the product; there is no coaching layer in v1.

---

## 2. Principles

1. **The day closes in under 30 seconds.** One tap per goal. Details stay out of the way until asked for.
2. **No shame mechanics.** A miss is information, not a moral failure. No red alarms, no "you lost your streak" pushes, no guilt copy. There are no rest days, skips, or neutral gaps: an expected day not done is a miss.
3. **Honest math.** Never show a percentage built on thin data. Distinguish *missed*, *not scheduled*, and *no session*. No composite "life score."
4. **Private by default.** One user, no social layer, no leaderboards. Notes and moods never go into analytics.
5. **Works before it syncs.** The daily loop writes locally first; the network is a backup, not a gate.
6. **The app fits the day.** One reminder, quiet defaults, no engagement bait, no re-engagement spam.
7. **Today is for recording, not scoring.** Streaks and percentages live in Progress, not in your face while you close the day.
8. **Show, don't lecture.** Progress is visual: numbers, heatmaps, strips, cards. V1 has no prose insights, coaching, or judgments.

---

## 3. User & jobs

**User:** one person tracking roughly 3–8 personal practices. Mostly phone, often late at night. Occasionally desktop for review. Not a team, not clients, not shared.

**Jobs to be done:**

- "At the end of the day, let me record what I did in under a minute."
- "Show me whether I'm actually keeping this up, without judging me."
- "Let me fix yesterday when I forgot to log it."
- "Let me change a goal's rhythm when life changes."
- "Let me stop tracking a goal without losing its history."
- "Don't lose my history when I switch devices."
- "Let me get the data out, or delete it, whenever I want."

---

## 4. Core concepts

| Term | Definition |
|---|---|
| **Goal** | An ongoing practice you want to keep doing. Has a name, optional emoji/color, priority, cadence, and start date. |
| **Cadence** | How often the goal is expected: **daily** (default), **specific weekdays**, or **N times per week**. |
| **Expectation** | A goal × a logical day on which it is expected. Daily and weekday goals have daily expectations. Weekly-target goals have a weekly target, not daily expectations. |
| **Logical day** | The user's local date, with a configurable rollover (default **4:00 AM**). A 1:30 AM session belongs to the previous day. |
| **Session** | One done record per goal per logical day, with optional minutes, note, and mood. |
| **Close the day** | The daily ritual of reviewing Today and marking what was done. |
| **Miss** | An expected day with no session after rollover. Derived, not stored. It can be corrected only by adding a session within the 7-day window. |
| **Extra** | A session on a day a daily/weekday goal was not expected. Counts as a session and minutes, but not toward consistency or streaks. Weekly-target goals have no extras: every session counts toward the weekly target. |
| **Archive** | A terminal end to a goal. Expectations stop after the archive day; history is kept and read-only. There is no unarchive; create a new goal to resume. |
| **Streak** | Consecutive expected units done: days for daily/weekday goals, weeks met for weekly-target goals. A miss breaks the current streak. |
| **Streak era** | A period with the same cadence unit. Changing between daily/weekday and weekly target starts a new era and resets the current streak. |
| **Consistency** | Done expected units ÷ expected units. Units are **days** for daily/weekday goals and **weeks** for weekly-target goals. |
| **Progress** | The visual record. It shows the numbers, heatmaps, strips, and cards; it does not tell the user what they mean. |

**The important asymmetry:** weekly-target goals **never get a daily miss**. Their outcome is judged at the end of the week. A day with no session is simply "no session."

**No neutral gaps:** there are no rest days or skips. If a goal is expected and no session is logged, the day is a miss. If you want to stop, archive the goal (terminal) or delete it.

---

## 5. The daily loop

**Flow:** reminder or open app → Today → tap each done goal → optionally add details → close. Misses become visible at rollover. Anything within the last 7 logical days can be corrected.

```text
┌──────────────────────────────────┐
│ Tuesday, 20 October              │
│ 3 of 5 done                      │
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░                │
│                                  │
│ TODAY                            │
│ ┌──────────────────────────────┐ │
│ │ 📖  Reading            ✓     │ │
│ │     Daily · 32 min           │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ 🎸  Guitar             ○     │ │
│ │     Mon / Wed / Fri          │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ 💻  Coding             ○     │ │
│ │     Daily                    │ │
│ └──────────────────────────────┘ │
│                                  │
│ THIS WEEK                        │
│ 🎤  Singing      ●●○○   2 of 4   │
│                                  │
│ Past 7 days                      │
├──────────────────────────────────┤
│ Today  Progress  Goals  Account  │
└──────────────────────────────────┘
```

**Step by step:**

1. Open from the PWA icon, a reminder, or a bookmark.
2. Today shows today's daily/weekday goals, high priority first. Weekly-target goals sit in **This week** with progress.
3. Tap the circle: instant done, subtle check animation, haptic where supported, **Undo** for 5 seconds.
4. An **Add details** link appears on the done row: minutes, note, mood. All optional. The list does not reorder after checking, so the next tap never lands on the wrong goal.
5. The header progress is the confirmation. No toast after every tap. If all done: one quiet line. If partial: the header simply says "3 of 5 done." No lecture, no red failure state.
6. At rollover, any unmarked scheduled goal is **Missed**. Weekly targets get no daily miss.
7. The next day, fix yesterday via **Past 7 days**. Older sessions and details are read-only.

**Time budget:** five goals, no details ≈ 5–15 seconds. With details ≈ under 45 seconds.

---

## 6. Feature set & phasing

### Must — v1

- Google sign-in (single user, no email/password).
- Goal CRUD: name, emoji, color, priority, cadence, start date.
- Cadence: daily (default), specific weekdays, or N times per week.
- Archive (terminal, keeps history) and delete (removes history).
- Today: one tap, undo, derived miss at rollover.
- Optional minutes, note, and mood per session.
- Backfill and correct the last 7 logical days; older days read-only.
- Day detail view for any date.
- Current streak, best streak per era, consistency, session count.
- Goal detail: stats, history, edit, archive, delete.
- Progress: summary stats, 12-week heatmap, weekly-target strip, goal cards. Visual only; no sentence insight cards.
- One daily reminder via real web push.
- PWA install, offline daily loop, sync on reconnect/open (Background Sync where supported).
- Account: reminder, week start, day rollover, timezone, export JSON, sign out, delete account.
- Responsive layout, dark mode, accessible controls.

### Should — v1.1

- Optional **minimum version** per goal ("on rough days, just read one page").
- Month calendar view.
- CSV export.
- Custom mood labels.
- App badge showing remaining goals where supported.
- Manifest shortcut: "Close the day."

### Later

- Narrative insights and weekly/monthly review cards (rules-based or AI).
- Best-weekday, recovery, and trend summaries as prose.
- Native wrapper / home-screen widgets.
- Optional accountability partner (separate privacy decision).
- Localization beyond English.

**Deliberately not building:** see §20.

---

## 7. Screens

### 7.1 Today

**Purpose:** close the day in under 30 seconds.

**Layout, top to bottom:**

- Date line: "Tuesday, 20 October." Logical date, not wall-clock date. Between midnight and rollover, append "· still open until the rollover time."
- Progress: "3 of 5 done" plus a thin bar. Counts today's daily/weekday goals only. If the user only has weekly targets, show "2 weekly targets" instead of a 0/0 bar.
- **Today** section: daily and weekday goals scheduled today. Sorted by priority (high → low), then creation order.
- **This week** section: weekly-target goals not yet met, with progress dots and "2 of 4 this week." If the week has fewer active days than the target, show "Not scored this week" instead of progress; sessions still count in history. Goals with the target met show "Target met" and a secondary "Log another session" action.
- **Not scheduled today** (collapsed by default): weekday goals that are off today. Tapping opens the day detail so the user can log an extra session if they did it anyway. This keeps the main list focused without punishing extra effort.
- Footer: **Past 7 days** link.
- Bottom navigation: Today, Progress, Goals, Account.

**Goal row:**

- Emoji or color dot, goal name, one line of cadence context (`Daily`, `Mon / Wed / Fri`, `2 of 4 this week`).
- Large 44×44 check target on the right. Tap = done. No confirmation.
- A small dot indicates details exist (minutes/note/mood).
- Done rows stay in place, visually muted, with a check. Tapping the row opens details; **Mark as not done** lives inside the details panel, not on the main tap target.
- Never use swipe-only actions; every action has a visible button.

**States:**

- **No goals:** "Add the first thing you want to keep doing." Primary action → goal editor.
- **Nothing scheduled:** "Nothing scheduled today." No rest-day language.
- **Partial:** The header shows "3 of 5 done." No per-tap toast.
- **All done:** "That's the day. 5 of 5." If a weekly target is still open, say "Today's list is done. 1 weekly target still open." Quiet, no confetti storm.
- **Weekly target met:** "Target met. More sessions are welcome."
- **Offline:** slim banner "Offline — saved on this device." No blocking modal.
- **Sync pending/error:** subtle status in the footer; retry automatic, manual retry available.
- **Archived goals (from the day after archiving):** hidden from Today.
- **At-risk streak:** do not show a warning here. Today is for recording.
- **Late night:** the date line shows the logical day and "still open until 4 AM."

**Interaction rules:**

- Marking done is optimistic and idempotent.
- Undo lasts 5 seconds, is screen-reader announced, and is reachable by keyboard.
- Details auto-save with a subtle "Saved" indicator; no Save button.
- Only one details panel open at a time.
- Rows do not reorder when checked.

### 7.2 Session details

Opened by tapping a done row or **Add details**. All fields optional.

| Field | Behavior |
|---|---|
| **Minutes** | Integer 0–1440. Quick chips 15 / 30 / 45 / 60 plus a custom input. Represents total time, not a timer. |
| **Note** | Plain text, max 500 characters. Private. One line grows to a small textarea. |
| **Mood** | Single-select pills: **Great / Meh / Rough**. Optional; tap again to clear. |
| **Status** | Footer action: **Mark as not done** (with confirmation). Today before rollover deletes the session; a past day within the window deletes the session and, if the day was expected, it becomes a derived Miss; an extra session is deleted. Outside 7 days, or on an archived goal, read-only. |

Details are available only for done sessions. A missed day can be changed to done by adding a session within the 7-day window.

Auto-save on change, debounced. Show "Saved" for a moment. Navigating away never loses a change. After the 7th logical day, the session and its details are read-only. Archived goal history is read-only from the day after archiving.

### 7.3 Progress

**Purpose:** the honest visual record, not a performance review.

**Range:** 7 days / 30 days / 90 days, default 30. Drives consistency, sessions, minutes, and goal cards. The heatmap stays at the last 12 weeks.

**Sections:**

1. **Today banner** only if today is incomplete: "3 of 5 today · Close the day →".
2. **Hero stats:**
   - Average goal consistency (equal weight per goal; only goals with enough data in the range).
   - Sessions in range.
   - Minutes in range, shown once at least 3 sessions have minutes; label coverage ("from 5 of 42 sessions").
3. **Daily heatmap:** last 12 weeks, one cell per logical day. Intensity reflects the share of scheduled daily/weekday goals done that day. No-expectation days are neutral; extras show a small dot. Archived goals are included for the dates they were active. The heatmap is visual only in v1; a **View as table** control opens the accessible table/list, which is the interactive path.
4. **Weekly targets strip:** one row per active weekly-target goal, one cell per week. Filled when met, partial when some sessions, empty when none, dash when not scored (too few active days). Tap the row label → goal detail.
5. **Goal cards:** emoji/name, last-7-days dot row (or a last-7-weeks mini-strip for weekly goals), current streak, consistency for the selected range, priority chip. Tap → goal detail. No ranking across goals. Goals that haven't started are hidden until their start date.
6. **No insight cards.** V1 has no prose insights. The visual record is the point.
7. **Empty state:** show today's progress and a simple dot row, not fake charts. Before a week of data, say "Progress fills in after a week."

```text
┌──────────────────────────────────┐
│ Progress          7D  [30D]  90D │
│                                  │
│ Avg. goal consistency            │
│ 78%          42 sessions         │
│ 310 min · from 18 sessions       │
│                                  │
│ LAST 12 WEEKS                    │
│ M  ░░▓▓░▓▓▓░░▓▓░▓▓░░▓            │
│ T  ░▓▓░░▓▓▓▓░▓▓░▓▓▓░▓            │
│ W  ▓▓▓░▓▓░░▓▓▓░▓▓░▓▓▓            │
│ ...                              │
│                                  │
│ THIS WEEK                        │
│ 🎤  Singing      ●●○○   2 of 4   │
│                                  │
│ GOALS                            │
│ 📖  Reading      24d      92%    │
│ 🎸  Guitar        3w      75%    │
│                                  │
├──────────────────────────────────┤
│ Today  Progress  Goals  Account  │
└──────────────────────────────────┘
```

**Never show:** a single "life score," comparison to other people, percentages built on fewer than 7 expected units (or 3 scored weeks), cross-goal streak ranking, or prose coaching in v1.

### 7.4 Goals

**Purpose:** manage the list without turning it into a project manager.

- Header: "Goals" + **New goal**.
- Segmented filter: **Active / Archived**.
- Active list sorted by priority (high → low), then creation. Each row: emoji, name, cadence summary, priority chip. Tap → goal detail.
- Future-start goals show "Starts 12 Nov" and are hidden from Today until then.
- No drag-and-drop in v1. Priority is the ordering mechanism.
- A goal archived today stays in Today for the rest of the logical day and shows "Archives tomorrow" in Goals. The next day it moves to Archived.
- Archived rows show "Archived 4 Oct" and open a read-only history. There is no unarchive action.
- Empty state: "No goals yet. Start with one small thing."

**Goal editor:**

| Field | Rules |
|---|---|
| Name | Required, 1–40 characters. |
| Emoji | Optional; curated picker plus a neutral default. |
| Color | Optional; six muted swatches. Used as an accent, never the only status signal. |
| Priority | High / Medium / Low. Default Medium. Affects ordering only; it does **not** weight statistics. |
| Cadence | **Daily** (default), **Specific days** (at least one weekday), or **N times per week** (1–7). Helper text explains each. |
| Start date | Default today. After 9:30 PM local, default the next logical day. Future dates allowed; past dates not allowed. |

**Cadence helper copy:**

- Daily: "Expected every day."
- Specific days: "Only these days count. Other days are free."
- N per week: "Any days count. The week is met when you reach N."

Changing cadence shows a warning: "Past history stays. Your current streak resets only if the cadence unit changes." Any change involving a weekly target takes effect **next week**; daily ↔ weekday changes take effect **tomorrow**. At most one pending future schedule version exists per goal; editing before it takes effect replaces it. If all seven weekdays are selected, normalize to daily.

### 7.5 Goal detail

- Header: emoji, name, priority/cadence chips, edit action.
- Stat row: current streak, best streak for the current era, consistency, sessions, minutes once enough data.
- A future-start goal shows "Starts 12 Nov" instead of stats until then.
- Weekly-target goals: a weekly strip of the last 12 weeks, with `2/4` labels and "not scored" cells, instead of a daily heatmap.
- Daily/weekday goals: a per-goal 12-week heatmap.
- Recent days: date, session or missed state, minutes, mood, note. Editable within 7 days for active goals; older entries and all archived goals are read-only with a lock note.
- Actions: **Edit**, **Archive** (terminal), **Delete**.
- Archive copy: "Ends this goal. It stays in Today for the rest of today, then leaves current stats. History is kept and read-only from the next day. Correct details before archiving. You can't unarchive; create a new goal to resume."
- Delete copy: "Deletes [goal] and all [n] sessions. This can't be undone." Offer export first.
- After the archive day, detail is read-only: no edit, no unarchive. Delete remains available. Show the best streak and historical consistency for the active period; do not show a current streak. Archiving is final; the goal stays in Today for the rest of the archive day so the session can still be logged.

### 7.6 Day detail / backfill

Opened from **Past 7 days**, a goal's history, or the Progress table alternative.

- Header: full date and day of week.
- Lists every daily/weekday goal with an expectation that day, plus any extra sessions. Include goals that are now archived for dates on/before their archive day.
- Weekly-target goals: show a small "This week" summary at the top. Show a weekly goal as a session row only if there is a session that day; do not render "No session" rows for every weekly goal every day.
- Status and details for each; tap to edit.
- Editable for the last **7 logical days**, including today, for active goals. Future dates blocked. Older dates read-only: "This day is read-only." Archived goal history is read-only from the day after archiving, even within the window.
- **Log something else** action: choose a goal that was active on that date and not scheduled; saved as an extra. No sessions before a goal's start date or after its archive date.
- Auto-missed days show "Missed." They can be changed to done within the window.
- If the week is complete and scored, show the weekly outcome in the summary.

### 7.7 Account

Grouped sections, no clutter:

- **Profile:** Google avatar, name, email.
- **Reminder:** on/off, time (default 9:30 PM local), permission status, **Send test notification**. On iOS, explain that notifications require an installed home-screen app.
- **Preferences:** week starts Monday/Sunday; day rollover (default 4:00 AM, advanced); timezone displayed with a "Use current timezone" action; theme (system/light/dark). Changing week start or rollover is prospective: past days/weeks do not move or re-score. A week-start change starts a new weekly streak era and resets the current weekly streak.
- **Data:** export JSON; last sync time; **Sign out**; **Delete account**.
- **Install:** "Add Mostly to your home screen" with platform-specific instructions if not installed.
- **Privacy:** short plain-language statement and a link to the full policy.
- **About:** version, open-source licenses.

**Sign-out:** warn if there are unsynced changes; sync first, then clear local cache. "Sign out and clear this device?"

**Delete account:** type `DELETE`, export nudge, immediate deletion of live data; backups expire within 30 days. Other devices discard queued writes and clear local data on next sync. No dark patterns, no "are you sure?" maze.

### 7.8 Onboarding

Three short steps, skippable where possible:

1. **Sign in with Google.** Copy: "Your goals stay yours. No social feed, no sharing."
2. **Pick a few things to keep doing.** Starter chips: Reading, Guitar, Singing, Coding, Exercise, Meditation, Journaling, Language, plus a custom field. Suggested 3–5; no hard cap. Each starts as **Daily / Medium priority**; a small "Change cadence" chip opens cadence options.
3. **Choose a reminder time.** Default 9:30 PM. "Not now" is allowed. On Android/desktop, request permission after this choice in a user gesture. On iOS, set the time now and request permission after the app is installed and the first session is logged.

Then land on Today with a single dismissible hint: "Tap a goal when you've done it. Details are optional." Install prompt appears after the first session (or second visit if no session yet), not during onboarding.

### 7.9 Navigation & states

- **Mobile:** bottom tabs — Today, Progress, Goals, Account. Safe-area padding, labels always visible, 44×44 targets.
- **Desktop / tablet:** top navigation; Today max-width ~720px, Progress max-width ~960px.
- **Deep links:** `/today`, `/progress`, `/goals`, `/goals/:id`, `/day/:date`, `/account`.
- **Back behavior:** returns to the previous tab and preserves scroll.
- **States to design:** first run, no goals, loading, offline, sync pending, sync error, sync conflict, partial day, all done, weekly target met, not scored week, archived goal, read-only day, late night, notification denied/unsupported, auth expired, delete confirmation.

---

## 8. Math & Progress

All stats use **completed** logical days/weeks. Today's open expectations don't lower a percentage until the day closes. This avoids the morning dip.

### 8.1 Expected units

- **Daily goal:** every logical day from start date to today, capped at the goal's `archived_on`.
- **Specific weekdays:** only selected weekdays in that range.
- **Weekly target:** no daily expectations. Weeks are the unit.
  - A week is **scored** when the goal had at least N active days in that week (N = weekly target). Active days are days on/after `start_date` and on/before `archived_on`.
  - If active days ≥ N: the week is **met** when sessions ≥ N, otherwise **missed** after the week's last logical day.
  - If active days < N: the week is **not scored** ("Not enough days this week"). Sessions still appear in history.
  - The current week is in progress and does not affect consistency or streaks until it ends.
- Archived goals have no expectations after `archived_on`. The goal has ended; no neutral state remains.

### 8.2 Consistency

- **Daily/weekday:** `done scheduled days ÷ expected scheduled days`, rounded to a whole percent. Extras are excluded from both numerator and denominator.
- **Weekly target:** `weeks met ÷ scored completed weeks`.
- Show a percentage only when the goal has **≥7 expected units in the selected range** (or **≥3 scored completed weeks** for weekly goals). Below that, show a fraction ("3 of 3") or "Just started" with no percentage.
- **Overall consistency:** average of per-goal consistency across active goals with ≥7 expected units (or ≥3 scored weeks). Equal weight per goal. Show "Based on 4 of 5 goals." If fewer than 2 goals qualify, show "Not enough data yet."
- **Sessions:** count of done sessions in range, including extras and sessions from goals archived during the range. Deleted goals are excluded.
- **Minutes:** sum of logged minutes from the same sessions; show coverage ("from 5 of 42 sessions"). Average per logged session only when ≥3 sessions have minutes > 0. A 0-minute session is a session but not a meaningful duration.
- No neutral adjustments exist.

### 8.3 Streaks

- **Daily/weekday:** consecutive expected days done. Off days are not expected and are omitted from the streak. A miss breaks the streak. If today is expected and not done, the streak is shown through yesterday and does not break until rollover. If today is done, it counts.
- **Weekly target:** consecutive scored weeks met. A missed scored week breaks the streak. An unscored week has no outcome and neither grows nor breaks the streak. The current incomplete week does not break the streak; if the target is already met, it counts.
- **Streak era:** a period with the same cadence unit.
  - A change between daily/weekday and weekly-target starts a new era and resets the current streak.
  - Changing weekdays or N within the same unit does not reset the streak; it continues if the next expected unit is met.
  - A week-start change starts a new weekly era and resets the current weekly streak; past weeks keep their boundaries.
- **Best streak:** maximum run within an era. Goal detail shows current and best for the current era; prior eras can be shown as a short "Streak history" list.
- No cross-goal ranking, no "longest current streak" hero stat. Streaks are shown per goal, in their native unit.
- A streak of zero shows "No streak yet." There is no "Streak ended" announcement and no streak-loss notification.
- Archived goals have no current streak; their best streak is frozen.

### 8.4 Weekly target outcome

A week is **met** when done sessions ≥ target by the end of the last logical day of the week. It is **missed** when the week is complete, scored, and sessions < target. It is **in progress** before that. It is **not scored** when active days < target. Weeks are defined by the user's week-start setting (default Monday). Target changes apply from next week. A backfill within the 7-day window can flip a missed week to met; the outcome recomputes.

### 8.5 Progress math

V1 shows a visual record only. There are no prose insight cards, no "best weekday" sentences, and no recovery/trend copy.

- Progress unlocks its visual summaries after **7 completed logical days** since the first goal's start date.
- Percentages follow the thresholds in §8.2.
- Heatmap intensity = done expected daily/weekday goals ÷ expected daily/weekday goals that day. No expectation = neutral. Extras = small dot. Archived goals count for dates they were active.
- Weekly strip cells: met / partial / none / not scored.
- Goal cards show current streak and consistency for the selected range; no ranking.
- If there isn't enough data, show the empty state rather than a fake chart.
- Narrative insights (best weekday, recovery, trend, mood/minutes patterns) are deferred to Later.

### 8.6 Heatmap

- Overall heatmap: daily/weekday goals only. Cell intensity = done expected goals ÷ expected goals that day. `0` = none, `1–49%` = light, `50–99%` = medium, `100%` = full. No expectation = neutral. Extra session = small dot.
- Weekly-target goals get a separate weekly strip, because daily shading would misrepresent a weekly promise.
- Per-goal detail uses a binary daily heatmap (done/missed/no expectation) or a weekly strip for weekly goals.
- The heatmap is visual only in v1. Provide an accessible table/list alternative with date, expected count, done count, extra count, and outcome. The table is the interactive path for older days.
- No special hatching; a day with no expectation is neutral, and there are no hidden states.

### 8.7 What not to show

- A composite "life score" or "productivity score."
- Comparisons to other users.
- Percentages with fewer than 7 expected units (or 3 scored weeks).
- Red "failure" views.
- Streak-loss push notifications.
- Cross-goal streak rankings.
- Prose advice, coaching, or judgments in v1.

---

## 9. Data model

Logical model; implementation is stack-agnostic. A relational database fits the uniqueness and history requirements.

```text
user 1 ─── * goal 1 ─── * session
  │            │
  │            └── * goal_schedule_version
  ├── * user_setting_version
  ├── * push_subscription
  └── * reminder_delivery
```

### user

`id, email, name, avatar_url, timezone, week_starts_on, day_rollover_hour, reminder_enabled, reminder_time, theme, created_at`

- `timezone`: IANA identifier, auto-detected and confirmed.
- `week_starts_on`: 1 = Monday … 7 = Sunday. Default 1.
- `day_rollover_hour`: 0–6. Default 4.
- `reminder_time`: local `HH:MM`. Default `21:30`.
- Current values are a convenience cache; `user_setting_version` is the history used for past stats.

### user_setting_version

`id, user_id, effective_from, timezone, week_starts_on, day_rollover_hour, created_at`

- `effective_from` is a logical date.
- Week-start changes take effect next logical week.
- Rollover and timezone changes take effect at the next logical day boundary.
- Past logical dates and weeks keep the settings in effect at the time.
- A week-start change starts a new weekly streak era; the transition week is not scored.

### goal

`id, user_id, name, emoji, color, priority, start_date, archived_on, created_at, updated_at, deleted_at`

- `priority`: `high | medium | low`. Default medium.
- `start_date`: logical date. Today or future. No expectations before it.
- `archived_on`: nullable logical date; the day archive was requested. The goal is still expected on that day; expectations stop the following day. There is no unarchive.
- Active means `archived_on IS NULL OR archived_on >= current_logical_date`. Archived means `archived_on < current_logical_date`. Status is derived; there is no separate status enum.
- `deleted_at`: internal tombstone for sync; user-facing deletion is permanent.

### goal_schedule_version

`id, goal_id, effective_from, cadence_type, weekdays[], weekly_target`

- `cadence_type`: `daily | weekdays | weekly_target`.
- `weekdays`: 1 = Monday … 7 = Sunday. Required when `cadence_type = weekdays`; at least one day.
- `weekly_target`: 1–7. Required when `cadence_type = weekly_target`.
- The version in effect for a date is the latest `effective_from <= date`.
- Initial version is created at `start_date`.
- Any change involving `weekly_target` takes effect next week. Daily ↔ weekday changes take effect tomorrow.
- At most one pending future version per goal; editing before it takes effect replaces it.
- If all seven weekdays are selected, normalize to `daily`.

### session

`id, user_id, goal_id, logical_date, minutes, note, mood, created_at, updated_at, deleted_at`

- A done record. One per goal per logical day among live sessions.
- `mood`: `great | meh | rough | null`.
- `minutes`: nullable integer 0–1440. Zero is allowed but not a meaningful duration.
- `note`: nullable, max 500 characters.
- Unique constraint: `(goal_id, logical_date)` where `deleted_at IS NULL`.
- `logical_date` is a **DATE**, not a timestamp. All timestamps are UTC.
- Extras are derived: a session on a day a daily/weekday goal was not expected. Weekly-target goals have no extra flag; every session counts toward N.
- Deletions are tombstoned so an offline device cannot resurrect them.

### push_subscription

`id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_seen_at, revoked_at`

- One row per device/browser push subscription.
- Revoke on sign-out, permission removal, or account deletion.
- Used to deliver the one daily reminder to the most recently active subscription.

### reminder_delivery

`id, user_id, logical_date, subscription_id, sent_at, status, error`

- Unique `(user_id, logical_date)`: at most one reminder per user per logical day.
- `status`: `sent | failed | suppressed`.
- If a send fails, retry another subscription without creating a second logical-day reminder.

**Derived, not stored:** misses, extras, weekly outcomes, streaks, consistency, current goal status. Compute on read; cache if needed. No weekly outcome table and no miss table.

**Indexes:** `(user_id, logical_date)`, unique `(goal_id, logical_date)` for live sessions, `(user_id, effective_from)` for setting versions, `(user_id, logical_date)` for reminder delivery.

---

## 10. Rules & edge cases

| Situation | Behavior |
|---|---|
| **Day rollover** | Default 4:00 AM local. 1:30 AM belongs to the previous logical day. Date boundaries use the user's timezone, not UTC. |
| **Unmarked at rollover** | The day is a derived Miss for scheduled daily/weekday goals. No rows are created. Weekly targets get no daily miss. |
| **New goal** | Starts on `start_date` (today or future; no past dates). After 9:30 PM local, the default is the next logical day. No expectations before it. |
| **Backfill** | Last 7 logical days, including today. Future dates blocked. Older days read-only. Adding a session recomputes consistency and streaks. |
| **Backfill into a completed week** | Allowed only when the edited date is within the 7-day window. Recompute the weekly outcome and streak; a missed week can flip to met. |
| **Remove session** | Today before rollover: delete the session. Past within 7 days: delete it; if the day was expected, it becomes a derived Miss; an extra disappears. Outside 7 days: blocked. |
| **Extra session** | Allowed on an off day via day detail / **Log something else**. Counts as a session and minutes; excluded from consistency and streaks. Weekly goals have no extras; every session counts toward N. |
| **Weekly target met early** | Show "Target met." Allow another session. Additional sessions do not change the weekly outcome or streak. |
| **Weekly target missed** | After the last logical day of a scored week, the week is missed if sessions < N. No per-day missed rows. |
| **Partial week** | Active days in the week < N: not scored. Sessions still appear in history. Active days ≥ N: scored. |
| **No neutral gaps** | There are no rest days or skips. An expected day not done is a miss. A 14-day absence produces 14 misses per daily goal and a fresh streak when logging resumes. |
| **Archive** | Terminal. Archiving on day D sets `archived_on = D`; day D still counts. No expectations after that day. History is read-only from the next day; the 7-day window does not reopen it. No unarchive. Current cards/streaks/consistency exclude the goal; historical aggregates include its sessions for dates it was active. Create a new goal to resume. |
| **Delete goal** | Permanent user-facing deletion of the goal, versions, sessions, and history. Confirm with a count; suggest export. Internal tombstone for sync; queued writes for the goal are rejected. |
| **Timezone change** | Confirmed, not silent. Existing logical dates are unchanged; new days use the new timezone. A dateline jump may skip a date; skipped dates are not expectations and show no data. A repeated date keeps its existing session. |
| **Two devices, same session** | Unique `(goal_id, logical_date)`. Last write wins per session; no duplicates. A losing offline edit is kept in a local 7-day conflict copy and surfaced as "Review sync conflict" in Account. |
| **Offline** | Daily loop writes locally first, queues, retries with backoff. Goal management, archive, and settings require a connection. No blocking modal. Auth expiry: keep writes local, prompt on reconnect. |
| **Sign out** | Sync unsynced changes first; warn if any remain; clear local cache. |
| **Delete account while another device is offline** | Server tombstone rejects queued writes. The offline device discards them and clears local data on next sync. |
| **Reminder** | At most one per user per logical day. Suppress if all done, no goals scheduled, or no active goals. No duplicate if the time or timezone changes later that day. |
| **Notification denied / unsupported** | Show a one-time in-app note in Account; no repeated permission prompts. iOS requires an installed home-screen app and 16.4+. |
| **Minutes** | Integer 0–1440. Zero allowed but treated as no meaningful duration. Only on done sessions. |
| **Note** | Max 500 characters, plain text. Never logged or sent to analytics. |
| **Mood** | Only on done sessions. Tap again to clear. |
| **No active goals** | Today shows an empty state with "Add a goal"; reminder suppressed. |
| **All goals archived** | "Nothing expected today." No reminder. |
| **Editing after 7 days** | Blocked for sessions, minutes, note, mood, and status. The day is read-only. No catch-up flow. Archived history is read-only from the day after archiving, even within the 7-day window. |
| **Week start change** | Takes effect next logical week. Past weeks keep their boundaries. The transition week is not scored. Current weekly streak resets. |
| **Rollover change** | Takes effect at the next logical day boundary. The current day closes under the old rule. Past logical dates never move. |
| **Schedule change** | Daily ↔ weekday effective tomorrow; any weekly-target change effective next week. One pending version per goal. Current streak resets only when the cadence unit changes. |
| **Session before start / after archive** | Blocked. A goal cannot be logged before its start date or after its archive day (`logical_date > archived_on`). |

---

## 11. PWA, offline, reminders

### Install

- Web app manifest: name, short name, 192/512 icons, maskable icon, theme/background colors, `display: standalone`, `start_url: /today`.
- Shortcut (v1.1): **Close the day** → `/today`.
- Custom install prompt on Android/desktop after the first session or second visit. Never block the core loop.
- iOS: no `beforeinstallprompt`; show Share → Add to Home Screen instructions in Account and after the first session.
- **iOS auth caveat:** Google OAuth inside a standalone PWA can lose the session if the flow opens outside the app. Use a redirect flow that returns to `start_url`, test on iOS Safari, and fall back to the system browser with a return path if needed.
- Request persistent storage where supported. Cloud sync is the real backup.

### Offline & sync

- Offline scope: **the daily loop only** — sessions, details, undo, and backfill for existing goals. Goal creation/editing, archive, and settings require network; show "Connect to edit goals."
- App shell cached; last data available offline.
- Sessions write to the local store first, then a sync queue. Optimistic UI.
- Derived misses are computed locally and on the server from the cached goals/schedules/settings. No auto-miss rows.
- Conflict policy: unique `(goal_id, logical_date)`; last write wins per session. The losing device keeps a local 7-day conflict copy and surfaces a notice. No duplicate sessions.
- Deletions use tombstones so they don't resurrect. Goal deletion rejects queued session writes for that goal.
- Show a slim offline banner and a sync status in Account ("Last synced 2m ago"). Errors retry quietly; offer manual retry.
- First sign-in requires network. After that, the daily loop works offline until the session needs refreshing.

### Reminder

- Real web push: `push_subscription` + `reminder_delivery` + a scheduled job (Cloudflare Cron/Queue) that checks local reminder times every N minutes.
- One reminder per user per logical day, sent to the most recently active subscription. If it fails, try another subscription without creating a second reminder.
- Copy includes the remaining count: "2 goals left today. Close the day when you're ready." Each unmet weekly target counts as one open item.
- Suppress when everything is done, there are no active goals, or nothing is open today (no scheduled goal and no unmet weekly target).
- The reminder follows the logical day. A 2:00 AM reminder still nudges the previous day's close.
- No streak-loss copy, no re-engagement spam, no "we miss you" messages.
- Permission requested after onboarding in a user gesture on Android/desktop. On iOS, request after install and the first session; explain "One reminder a day. No streak guilt, no spam."
- Test notification in Account.
- Platform constraint: web push on iOS requires an installed PWA (16.4+) and a push service. If push is unavailable or denied, show an in-app banner on next open; do not promise background push the platform can't deliver.
- Browser support: latest two versions of Chrome, Safari, Firefox, and Edge. The core app works without push; iOS 16.4+ is required for home-screen push.
- Narrative weekly review is not a second push; it is deferred.

### Badging & shortcuts

- Where the Badging API is supported, show the remaining scheduled count.
- Manifest shortcuts are nice-to-have; the app must work without them.

---

## 12. Auth, privacy, security

- **Sign-in:** Google OIDC only. Scopes: `openid`, `email`, `profile`. No Calendar, Drive, or contacts. No email/password login; the scaffold's email/password provider is removed in foundations.
- **Single user per account.** No guest mode in v1; Google is the only sign-in. This avoids account-linking complexity and keeps sync simple.
- **Authorization:** every row is scoped to `user_id` in the API/data layer. Add integration tests that attempt cross-user access. The scaffold uses SQLite/Turso, which does not provide Postgres-style row-level security; do not claim database RLS. If the stack moves to Postgres, add RLS as defense in depth.
- **Transport and storage:** HTTPS only; encryption at rest from the database provider. Don't log request bodies, notes, moods, or goal names.
- **Analytics:** none in v1. Success metrics in §16 are design targets measured manually or with local-only counters. If product analytics are added later, use opt-in privacy-friendly events only (`goal_created`, `session_logged`, `day_backfilled`, `export_requested`) with no goal names, notes, minutes, or moods.
- **Export:** JSON with schema version, exported_at, settings history, goals, schedule versions, sessions, archive info, and derived daily/weekly outcomes. Download from Account. CSV in v1.1.
- **Delete:** goal deletion removes its history after confirmation. Account deletion removes all live data after typing `DELETE`; backups expire within 30 days. Explain this plainly.
- **Sign out:** sync first, then clear local cache. Warn about unsynced changes.
- **Session:** silent refresh; offline writes queue. No third-party trackers, no ad SDKs.
- **Backups:** daily encrypted backups, 30-day retention, quarterly restore test. The user should never lose months of sessions to a bad deploy.
- **Abuse surface:** small, but still rate-limit auth and sync endpoints. Validate all date and cadence inputs server-side. Reject writes for deleted goals/accounts.

---

## 13. Design direction

**Feeling:** a small paper ledger, not a SaaS admin panel. Calm, tactile, a little analog. Generous space. Nothing flashes at you.

**Palette (light):**

| Token | Value | Use |
|---|---|---|
| Paper | `#F7F4EE` | Background |
| Ink | `#1C1B18` | Primary text |
| Muted | `#6B675E` | Secondary text |
| Line | `#E2DCD0` | Borders/dividers |
| Accent | `#3E6B57` | Done, primary actions |
| Accent soft | `#DCE7DF` | Selected/soft fills |
| Warm | `#C98A3D` | Weekly progress / sparing emphasis |

**Palette (dark):** background `#141512`, surface `#1C1E19`, ink `#EDE9DF`, muted `#9A9588`, line `#2A2C27`, accent `#8FBFA5`.

**Goal colors:** six muted swatches (sage, clay, ochre, slate blue, plum, moss). Used as small dots or left borders, never as the only signal of status and never as body-text color.

**Type:** system sans; 16px body, 28px date, **14px minimum secondary text**; tabular numerals for stats. No webfont dependency in v1.

**Components:** 16px card radius, 999px pills, 1px borders, no heavy shadows. 44×44 minimum touch targets. Bottom nav on mobile, top nav ≥768px.

**Check interaction:** the circle fills and a small check draws in ~150ms; haptic where supported. Reduced motion gets an instant state change, no animation.

**Celebration:** none by default. All done gets one quiet line. No confetti, no coins, no mascot. The relief of a closed day is the reward.

**Charts:** single accent, muted grid, no gradients or 3D. Labels at 14px. Every chart has a text/table alternative. The heatmap is visual only in v1.

**Icon:** a tally mark in a rounded square. Simple, recognizable at 32px.

**Tone of the interface:** plain, warm, second person. No "crush it," "grind," "failure," or "don't break the chain." No prose coaching in Progress.

---

## 14. Accessibility

- Target **WCAG 2.2 AA**.
- Full keyboard access with visible focus; logical tab order.
- Check target is a real button with an accessible name: "Mark Reading done" / "Reading done. Edit details."
- Toasts and save confirmations announced via a live region; Undo is reachable by keyboard, not toast-only.
- Mood pills are a labeled group with `aria-pressed`; status is not conveyed by color alone.
- Heatmap has a table/list alternative: date, expected count, done count, extra count, outcome. The table is reachable from a **View as table** control and is the interactive path; the visual heatmap is not tappable in v1.
- 44×44 touch targets; 16px body, 14px minimum secondary text; reflow at 200% zoom.
- Contrast ≥4.5:1 for text; goal colors never carry meaning alone.
- Respect `prefers-reduced-motion`; no autoplay, no flashing.
- Native or fully accessible time picker; no drag-only interactions.
- Screen-reader copy includes status and details: "Reading, done, 32 minutes, felt great."
- Error messages are specific and adjacent to the field; no color-only errors.
- Focus moves to the opened details panel and returns to the row when closed.

---

## 15. Copy & tone

| Context | Copy |
|---|---|
| Tagline | "A quiet record of what you did." |
| Today header | "Tuesday, 20 October" |
| Today header, late night | "Tuesday · still open until 4 AM" (default rollover) |
| Progress | "3 of 5 done" |
| Weekly goal | "2 of 4 this week" / "Target met" |
| Done toast | "Done. Undo" |
| Partial day | Header shows "3 of 5 done"; no per-tap toast |
| All done | "That's the day. 5 of 5." |
| Nothing scheduled | "Nothing scheduled today." |
| No goals | "Add the first thing you want to keep doing." |
| Details | "Add details" / "Minutes" / "Note (optional)" / "How did it feel?" |
| Mood labels | "Great" / "Meh" / "Rough" |
| Saved | "Saved" |
| Missed | "Missed" |
| Weekly no session | "No session" |
| Weekly not scored | "Not enough days this week" |
| Streak | "12 days in a row" / "Best: 18 days" / "No streak yet" |
| Backfill | "Past 7 days" / "You can edit the last 7 days." |
| Read-only | "This day is read-only." |
| Reminder permission | "One reminder a day. No streak guilt, no spam." |
| Reminder | "2 goals left today. Close the day when you're ready." |
| Progress empty | "Progress fills in after a week." |
| Export | "Download a copy of everything." |
| Archive goal | "Ends this goal. History is kept and read-only from the next day. Correct details before archiving. You can't unarchive; create a new goal to resume." |
| Delete goal | "This deletes Reading and all 84 sessions. Export your data first?" |
| Delete account | "This removes your account and every session. This can't be undone." |
| Sign out | "Sign out and clear this device?" |
| Install | "Add Mostly to your home screen." |

**Tone rules:**

- Use "session," not "check-in," for a per-goal record. Use "close the day" for the ritual.
- Use "missed," not "failed."
- Use "no session," not "at risk" or "don't break it."
- No exclamation marks in system messages.
- Never imply the app is disappointed in the user.
- No rest/skip language.
- No prose insights or coaching in v1.

---

## 16. Success metrics

This is a personal tool, so success is retention and honesty, not growth. V1 has no analytics; these are design targets measured manually or with local-only counters.

**Usage:**

- Median time to close the day: **under 30 seconds**.
- Close the day on **≥80% of days with at least one expected goal** after week 2.
- Still using it after **90 days**.
- Backfill rate **<10%** of sessions (higher suggests the reminder or loop is failing).
- Reminder opt-out **<20%**.

**Quality:**

- No duplicated sessions across offline/sync. Session records are not lost; concurrent edits are surfaced, not silent.
- Correct logical-day, week-boundary, archive, cadence-change, time-setting, and derived-miss behavior in automated tests.
- Today interactive in **<1s** from cache; LCP **<2.5s** on mid-range mobile.
- No critical accessibility issues in the core flows (keyboard + screen reader).
- No notes, goal names, or moods in logs/analytics.
- Backups restore successfully in a quarterly test.

---

## 17. Build order

No dates or stack assumptions; sequence only.

1. **Foundations:** schema, auth (Google OIDC only), goal CRUD, schedule versions, archive, user setting versions, API-level user scoping.
   *Done when:* create/edit/archive/delete works and the data model answers "what was expected on date X, under the settings in effect then?"
2. **Offline sync contract:** its own ticket, not a slice of foundations — local store shape, session write queue, tombstone and last-write-wins rules, idempotent replay, conflict notice, and sync-status surface. This is the widest piece in v1 and the most expensive to retrofit.
   *Done when:* a session written offline, replayed twice, and edited from two devices leaves one live row, resurrects nothing, and loses nothing silently.
3. **Today + session:** list, one-tap done, undo, details, optimistic local writes.
   *Done when:* the core loop works offline and feels instant.
4. **Time logic:** logical day, rollover, derived misses, 7-day write window, day detail.
   *Done when:* boundary tests pass and no miss rows are generated.
5. **Stats:** consistency, streaks and eras, weekly outcomes, archive handling.
   *Done when:* formulas match the spec across start/archive boundaries, off days, and cadence changes.
6. **Progress:** heatmap, weekly strip, goal cards, thresholds and empty states.
   *Done when:* no misleading percentages appear below the thresholds, and there are no prose insights.
7. **PWA + reminder:** manifest, install UX, offline cache, sync queue status, push subscriptions, delivery log, scheduler, permission sequencing.
   *Done when:* install, offline sync, and at-most-one push per logical day work on iOS Safari and Android Chrome.
8. **Polish:** onboarding, Account, export/delete, dark mode, accessibility, copy.
   *Done when:* the acceptance criteria below pass.
9. **v1.1:** minimum version, month calendar, CSV, custom mood labels, badge, shortcut.

**Test seams:** two. Time and stats logic — logical day, rollover, week boundary, schedule resolution, derived misses, streak eras, consistency — lives in pure functions that take an injected clock and timezone, tested directly. Everything with a database or user boundary — goal and session APIs, user scoping, and sync replay and conflicts — is tested through the oRPC boundary against an in-memory libsql database. UI tests are not the default; reserve one for a flow that cannot be verified below it.

**Tests that must exist:** logical day at 3:59/4:00 AM, DST transitions, timezone change and dateline skip, week-start boundaries and setting changes, rollover setting changes, archive boundaries, cadence changes, partial weeks, weekly target met/missed/not scored, streak eras, derived misses, vacation gap (misses, fresh streak), strict 7-day lock, settings history, archive historical aggregates, idempotent offline sync, concurrent session edits, push delivery idempotency/suppression, account deletion with an offline device.

---

## 18. Acceptance criteria

1. Tapping **Done** persists locally, updates the UI immediately, offers a 5-second Undo, and syncs exactly once.
2. An unmarked scheduled goal is **Missed** at rollover (derived), can be corrected within 7 days by adding a session, and is read-only after that.
3. A weekly-target goal gets no daily miss. In a fully active 4×/week week, 4 sessions is **met**, 3 is **missed** after the week ends, and the streak counts weeks. A week with fewer than 4 active days is **not scored**.
4. An extra session on an off day appears in history, sessions, and minutes, but does not change consistency or the streak. Weekly goals have no extras; every session counts toward the target.
5. There are no rest days or skips. A 14-day absence produces 14 misses per daily goal and a fresh streak when logging resumes. No neutral-gap state exists.
6. Archive is terminal: the archive day still counts, no expectations exist after the archive day, history is read-only, there is no unarchive, current cards/streaks/consistency exclude the goal, and historical aggregates still include its sessions for dates it was active.
7. Changing cadence preserves past history; daily/weekday changes take effect tomorrow, weekly-target changes next week; a unit change resets the current streak; only one pending schedule version exists.
8. Offline sessions queue and sync without duplicates; concurrent edits use last-write-wins, surface a conflict notice, and no session record is silently lost.
9. The reminder fires at most once per logical day, is suppressed when nothing is open, uses real web push where available, and has an in-app fallback when push is unavailable. On iOS, permission is requested after install.
10. JSON export contains settings history, goals, schedule versions, sessions, archive info, and derived outcomes; deleting a goal/account removes the corresponding data; backups are gone within 30 days.
11. A keyboard and screen-reader user can complete a session, add details, backfill a day, and edit a goal; the heatmap has a text alternative.
12. Progress shows "not enough data" or fractions below 7 expected units (or 3 scored weeks), never a percentage on thinner data, never a cross-goal streak ranking, and never prose insights. It shows the empty state until 7 completed logical days of history.
13. Derived misses recompute correctly after archive, cadence, and time-setting changes; no stale miss rows exist.
14. Week-start, rollover, and timezone changes are prospective: past days/weeks do not move or re-score; a week-start change resets the current weekly streak; the transition week is not scored.

---

## 19. Decisions & open questions

Defaults are chosen; change any that no longer fit.

| # | Decision | Default | Status |
|---|---|---|---|
| 1 | App name | **Mostly** (placeholder) | Open |
| 2 | Week starts | **Monday**; changes next week | Resolved |
| 3 | Day rollover | **4:00 AM local**; changes next logical day | Resolved |
| 4 | Reminder | **9:30 PM local, one per day, real web push** | Resolved |
| 5 | Priority | **High / Medium / Low**, ordering only | Resolved |
| 6 | Neutral gaps | **None**: no rest or skip | Resolved |
| 7 | Archive | **Terminal**, no unarchive | Resolved |
| 8 | Misses | **Derived**, not stored | Resolved |
| 9 | Offline scope | **Daily loop only**; goal edits need network | Resolved |
| 10 | Streaks | **Per goal, per era, native unit; no ranking** | Resolved |
| 11 | Edit window | **7 logical days for status and details**; no catch-up | Resolved |
| 12 | Progress | **Visual record only**; no prose insights in v1 | Resolved |
| 13 | Mood labels | **Great / Meh / Rough** | Resolved |
| 14 | Narrative insights / weekly review | **Later** | Deferred |
| 15 | Minimum version field | **v1.1** | Deferred |
| 16 | Backup retention | **30 days** | Resolved |
| 17 | Account recovery | **None**; Google-only, export is the backup | Resolved |
| 18 | Time settings | **Prospective with effective-dated history** | Resolved |

---

## 20. Deliberately not building

- Social features, sharing, leaderboards, public profiles.
- Gamified currency, points, or purchasable streak protection.
- A general task manager, due dates, or calendar sync.
- A start/stop timer; minutes are deliberately manual.
- Multiple sessions per goal per day.
- Rest or skip states.
- Team, family, or coach accounts.
- Cross-goal streak ranking or a composite life score.
- Prose insights, coaching, or predictions in v1.
- Guilt-based notifications or re-engagement campaigns.
- Native apps before the PWA proves itself.

---

*End of spec.*
