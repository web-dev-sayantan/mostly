# Mostly — Product Spec

**A quiet record of what you did.**

Status: Draft v0.1 · 20 Oct 2026 · Single-user personal web app / PWA
Working name: **Mostly** (placeholder — see Open Decisions)

---

## 1. Summary

Mostly answers one question at the end of the day: **what did I do, and what did I miss?**

You keep a short list of goals — reading, guitar, singing, coding, whatever matters — and mark each one with a single tap. Minutes, a note, and a quick feeling are optional. A dashboard then shows the honest pattern over time: consistency, streaks, best days, and how quickly you bounce back after a miss.

It is not a task manager, a social habit game, or a productivity scoreboard. It is a small, private ledger of promises kept.

**The bet:** the daily loop is so short that it survives real life. Insights are a by-product of showing up, not a reason to open the app.

---

## 2. Principles

1. **The day closes in under 30 seconds.** One tap per goal. Details stay out of the way until asked for.
2. **No shame mechanics.** A miss is information, not a moral failure. No red alarms, no "you lost your streak" pushes, no guilt copy.
3. **Honest math.** Never show a percentage built on two data points. Distinguish *missed*, *not scheduled*, *paused*, and *no session*.
4. **Private by default.** One user, no social layer, no leaderboards. Notes and moods never go into analytics.
5. **Works before it syncs.** Writes land locally first; the network is a backup, not a gate.
6. **The app fits the day.** One reminder, quiet defaults, no engagement bait, no re-engagement spam.
7. **Today is for recording, not scoring.** Streaks and percentages live on the dashboard, not in your face while you check in.

---

## 3. User & jobs

**User:** one person tracking roughly 3–8 personal practices. Mostly phone, often late at night. Occasionally desktop for review. Not a team, not clients, not shared.

**Jobs to be done:**

- "At the end of the day, let me record what I did in under a minute."
- "Show me whether I'm actually keeping this up, without judging me."
- "Let me fix yesterday when I forgot to log it."
- "Let me change a goal's rhythm when life changes."
- "Don't lose my history when I switch devices."
- "Let me get the data out, or delete it, whenever I want."

---

## 4. Core concepts

| Term | Definition |
|---|---|
| **Goal** | A practice you want to keep doing. Has a name, optional emoji/color, priority, cadence, and start date. |
| **Cadence** | How often the goal is expected: **daily** (default), **specific weekdays**, or **N times per week**. |
| **Expectation** | A goal × a logical day on which it is expected. Daily and weekday goals have daily expectations. Weekly-target goals have a weekly target, not daily expectations. |
| **Logical day** | The user's local date, with a configurable rollover (default **4:00 AM**). A 1:30 AM check-in belongs to the previous day. |
| **Check-in** | One record per goal per logical day. Status is `done` or `missed`, plus optional minutes, note, and mood. |
| **Session** | A `done` check-in. |
| **Miss** | A daily/weekday expectation not met by rollover. Auto-created, editable for 7 days. |
| **Extra** | A `done` check-in on a day a daily/weekday goal was not scheduled. Counts as a session and minutes, but not toward consistency or streaks. |
| **Pause** | A date range where a goal is neither expected nor missed. Streaks are neutral across a pause. |
| **Streak** | Consecutive expected days done (daily/weekday goals) or consecutive weeks met (weekly-target goals). Paused units are neutral. |
| **Consistency** | Done expected units ÷ expected units. Units are **days** for daily/weekday goals and **weeks** for weekly-target goals. |

**The important asymmetry:** weekly-target goals **never get a daily miss**. Their outcome is judged at the end of the week. A day with no session is simply "no session."

---

## 5. The daily loop

**Flow:** reminder or open app → Today → tap each done goal → optionally add details → close. Auto-miss runs at rollover. Anything forgotten can be fixed within 7 days.

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
│ Today   Progress   Goals   Me    │
└──────────────────────────────────┘
```

**Step by step:**

1. Open from the PWA icon, a reminder, or a bookmark.
2. Today shows today's daily/weekday goals, high priority first. Weekly-target goals sit in **This week** with progress.
3. Tap the circle: instant `done`, subtle check animation, haptic where supported, **Undo** toast for 5 seconds.
4. An **Add details** link appears on the done row: minutes, note, mood. All optional. The list does not reorder after checking, so the next tap never lands on the wrong goal.
5. If all done: a quiet confirmation. If partial: "Saved. 3 of 5 today." No lecture, no red failure state.
6. At rollover, any unmarked scheduled goal becomes **Missed**. Weekly targets get no daily miss.
7. The next day, fix yesterday via **Past 7 days** or tap a day on the dashboard heatmap.

**Time budget:** five goals, no details ≈ 5–15 seconds. With details ≈ under 45 seconds.

---

## 6. Feature set & phasing

### Must — v1

- Google sign-in (single user, no email/password).
- Goal CRUD: name, emoji, color, priority, cadence, start date.
- Cadence: daily (default), specific weekdays, or N times per week.
- Pause/resume with a date range.
- Archive (keeps history) and delete (removes history).
- Today check-in: one tap, undo, auto-miss at rollover.
- Optional minutes, note, and mood per done check-in.
- Backfill and correct the last 7 logical days.
- Day detail view for any date.
- Current streak, best streak, consistency, session count.
- Goal detail: stats, history, edit, pause, archive, delete.
- Dashboard: summary stats, 12-week heatmap, goal cards, up to 3 insight cards.
- One daily reminder.
- PWA install, offline writes, sync on reconnect/open (Background Sync API where supported).
- Account: reminder, week start, day rollover, export JSON, sign out, delete account.
- Responsive layout, dark mode, accessible controls.

### Should — v1.1

- Weekly review card (in-app; no extra push by default).
- Mood and minutes insights.
- Optional **minimum version** per goal ("on rough days, just read one page").
- Month calendar view.
- CSV export.
- Custom mood labels.
- App badge showing remaining goals where supported.
- Manifest shortcut: "Check in today."
- Starter goal templates in onboarding.

### Later

- Monthly recap.
- Opt-in pattern summaries (AI or rules-based).
- Native wrapper / home-screen widgets.
- Optional accountability partner (separate privacy decision).
- Localization beyond English.

### Deliberately not building

- Social feed, leaderboards, public profiles.
- Points, coins, purchasable streak freezes.
- General todo/task manager, due dates, calendar sync.
- Start/stop timer; minutes are entered, not tracked.
- Multiple check-ins per goal per day.
- Team or family accounts.
- Push notifications that shame ("You're losing your streak!").
- Native apps before the PWA proves useful.

---

## 7. Screens

### 7.1 Today

**Purpose:** close the day in under 30 seconds.

**Layout, top to bottom:**

- Date line: "Tuesday, 20 October." Logical date, not wall-clock date.
- Progress: "3 of 5 done" plus a thin bar. Counts today's daily/weekday goals only. If the user only has weekly targets, show "2 weekly targets" instead of a 0/0 bar.
- **Today** section: daily and weekday goals scheduled today. Sorted by priority (high → low), then creation order.
- **This week** section: weekly-target goals not yet met, with progress dots and "2 of 4 this week." Goals with the target met show "Target met" and a secondary "Log extra" action.
- **Not scheduled today** (collapsed by default): weekday goals that are off today. Tapping opens the day detail so the user can log an extra session if they did it anyway. This keeps the main list focused without punishing extra effort.
- Footer: **Past 7 days** link.
- Bottom navigation: Today, Progress, Goals, Me.

**Goal row:**

- Emoji or color dot, goal name, one line of cadence context (`Daily`, `Mon / Wed / Fri`, `2 of 4 this week`).
- Large 44×44 check target on the right. Tap = done. No confirmation.
- A small dot indicates details exist (minutes/note/mood).
- Done rows stay in place, visually muted, with a check. Tapping the row opens details; **Mark as not done** lives inside the details panel, not on the main tap target.
- Never use swipe-only actions; every action has a visible button.

**States:**

- **No goals:** "Add the first thing you want to keep doing." Primary action → goal editor.
- **Nothing scheduled:** "Nothing scheduled today. Rest is part of the plan."
- **Partial:** "Saved. 3 of 5 today."
- **All done:** "That's the day. 5 of 5." If a weekly target is still open, say "Today's list is done. 1 weekly target still open." Quiet, no confetti storm.
- **Weekly target met:** "Target met. Anything extra is a bonus."
- **Offline:** slim banner "Offline — saved on this device." No blocking modal.
- **Sync pending/error:** subtle status in the footer; retry automatic, manual retry available.
- **Paused goals:** hidden from Today; visible in Goals with a resume date.
- **At-risk streak:** do not show a warning here. Today is for recording.

**Interaction rules:**

- Marking done is optimistic and idempotent.
- The undo toast lasts 5 seconds and is screen-reader announced.
- Details auto-save with a subtle "Saved" indicator; no Save button.
- Only one details panel open at a time.
- Rows do not reorder when checked.

### 7.2 Check-in details

Opened by tapping a done row or **Add details**. All fields optional.

| Field | Behavior |
|---|---|
| **Minutes** | Integer 0–1440. Quick chips 15 / 30 / 45 / 60 plus a custom input. Represents total time, not a timer. |
| **Note** | Plain text, max 500 characters. Private. One line grows to a small textarea. |
| **Mood** | Single-select pills: **Great / Meh / Pathetic**. Optional; tap again to clear. Labels are the user's chosen wording; see Open Decisions. |
| **Status** | Footer action: **Mark as not done** (with confirmation). Past days revert to `missed`; today before rollover deletes the row; extras are deleted. |

Details are only available for `done` check-ins. A missed check-in can be changed to done within the 7-day window.

Auto-save on change, debounced. Show "Saved" for a moment. Navigating away never loses a change.

### 7.3 Progress (dashboard)

**Purpose:** honest patterns, not a performance review.

**Range:** 7 days / 30 days / 90 days, default 30. Drives consistency, sessions, minutes, and goal cards. The heatmap stays at the last 12 weeks.

**Sections:**

1. **Today banner** only if today is incomplete: "3 of 5 today · Finish check-in →".
2. **Hero stats:**
   - Average goal consistency (equal weight per goal, active goals with ≥3 expected units).
   - Sessions in range.
   - Longest current streak, with goal name.
   - Minutes in range, shown once at least 3 sessions have minutes.
3. **Daily heatmap:** last 12 weeks, one cell per logical day. Intensity reflects the share of scheduled daily/weekday goals done that day. Paused days are hatched; no-expectation days are neutral; extras show a small dot. Tap a cell → day detail.
4. **Weekly targets strip:** one row per weekly-target goal, one cell per week, filled when met, partial when some sessions, empty when none. Tap → goal detail.
5. **Goal cards:** emoji/name, last-7-days dot row, current streak, consistency for the selected range, priority chip. Tap → goal detail. Weekly goals show "weeks met" rather than daily dots.
6. **Insights:** two or three plain-English cards. See §8 for thresholds. If there isn't enough data, show one calm card: "A few more days and you'll see patterns here."
7. **Empty state:** show today's progress and a simple dot row, not fake charts.

```text
┌──────────────────────────────────┐
│ Progress          7D  [30D]  90D │
│                                  │
│ Avg. goal consistency            │
│ 78%          42 sessions         │
│ Best current streak: Reading 24d │
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
│ 📖  Reading          24d    92%  │
│ 🎸  Guitar            3w    75%  │
│                                  │
│ INSIGHTS                         │
│ Tuesdays are your strongest day. │
│ You bounce back after 4 of 5 ... │
├──────────────────────────────────┤
│ Today   Progress   Goals   Me    │
└──────────────────────────────────┘
```

**Never show:** a single "life score," comparison to other people, or percentages built on fewer than three expected units.

### 7.4 Goals

**Purpose:** manage the list without turning it into a project manager.

- Header: "Goals" + **New goal**.
- Segmented filter: **Active / Paused / Archived**.
- Active list sorted by priority (high → low), then creation. Each row: emoji, name, cadence summary, priority chip. Tap → goal detail.
- No drag-and-drop in v1. Priority is the ordering mechanism; manual ordering can come later if it earns its keep.
- Paused rows show "Paused until 12 Nov" or "Paused."
- Archived rows show "Archived 4 Oct" and an unarchive action.
- Empty state: "No goals yet. Start with one small thing."

**Goal editor:**

| Field | Rules |
|---|---|
| Name | Required, 1–40 characters. |
| Emoji | Optional; curated picker plus a neutral default. |
| Color | Optional; six muted swatches. Used as an accent, never the only status signal. |
| Priority | High / Medium / Low. Default Medium. Affects ordering only; it does **not** weight statistics. |
| Cadence | **Daily** (default), **Specific days** (at least one weekday), or **N times per week** (1–7). Helper text explains each. |
| Start date | Default today. Editable only before the first check-in. Future dates allowed. |
| Pause | Date range, or open-ended. Available from the goal editor and detail screen. |

**Cadence helper copy:**

- Daily: "Expected every day."
- Specific days: "Only these days count. Other days are free."
- N per week: "Any days count. The week is met when you reach N."

Changing cadence shows a warning: "Past history stays. Your current streak may reset." Any change involving a weekly target takes effect **next week**; daily ↔ weekday changes take effect **tomorrow**.

### 7.5 Goal detail

- Header: emoji, name, priority/cadence chips, edit action.
- Stat row: current streak, best streak, consistency, sessions (and minutes once enough data).
- Weekly-target goals: a weekly strip of the last 12 weeks, with `2/4` labels, instead of a daily heatmap.
- Daily/weekday goals: a per-goal 12-week heatmap.
- Recent check-ins: date, status, minutes, mood, note. Editable within 7 days; older entries read-only with a lock note.
- Actions: **Edit**, **Pause/Resume**, **Archive**, **Delete**.
- Pause copy: "Paused days won't count as misses or break your streak."
- Archive copy: "Removes this goal from Today and stats. History is kept."
- Delete copy: "Deletes [goal] and all [n] check-ins. This can't be undone." Offer export first.

### 7.6 Day detail / backfill

Opened from **Past 7 days**, a heatmap cell, or a goal's history.

- Header: full date and day of week.
- Lists every goal with an expectation that day, plus any extra sessions.
- Status and details for each; tap to edit.
- Editable for the last **7 logical days**, including today. Future dates blocked. Older dates read-only: "This day is read-only."
- **Log something else** action: choose an active goal that wasn't scheduled that day; saved as an extra. Useful for "I played guitar on an off day."
- Weekly-target goals show "No session" rather than "Missed" on a day with no check-in. The weekly outcome appears in a small summary at the top if the week is complete.
- Auto-missed rows show "Missed (auto)" and can be changed to done within the window.

### 7.7 Account ("Me")

Grouped sections, no dashboard clutter:

- **Profile:** Google avatar, name, email.
- **Reminder:** on/off, time (default 9:30 PM local), permission status, **Send test notification**.
- **Preferences:** week starts Monday/Sunday; day rollover (default 4:00 AM, advanced); timezone displayed; theme (system/light/dark). Changing week start or rollover can move the current day/week; confirm before saving.
- **Data:** export JSON; last sync time; **Sign out**; **Delete account**.
- **Install:** "Add Mostly to your home screen" with platform-specific instructions if not installed.
- **Privacy:** short plain-language statement and a link to the full policy.
- **About:** version, open-source licenses.

**Sign-out:** warn if there are unsynced changes; sync first, then clear local cache. "Sign out and clear this device?"
**Delete account:** type `DELETE`, export nudge, immediate deletion of live data; backups expire on the provider's normal schedule. No dark patterns, no "are you sure?" maze.

### 7.8 Onboarding

Three short steps, skippable where possible:

1. **Sign in with Google.** Copy: "Your goals stay yours. No social feed, no sharing."
2. **Pick a few things to keep doing.** Starter chips: Reading, Guitar, Singing, Coding, Exercise, Meditation, Journaling, Language, plus a custom field. Suggested 3–5; no hard cap. Each starts as **Daily / Medium priority**; a small "Every day" chip opens cadence options for anyone who wants to customize immediately.
3. **Choose a reminder time.** Default 9:30 PM. "Not now" is allowed. Permission is requested only after this choice, in a user gesture.

Then land on Today with a single dismissible hint: "Tap a goal when you've done it. Details are optional." Install prompt appears after the first check-in, not during onboarding.

### 7.9 Navigation & states

- **Mobile:** bottom tabs — Today, Progress, Goals, Me. Safe-area padding, labels always visible, 44×44 targets.
- **Desktop / tablet:** top navigation; Today max-width ~720px, Progress max-width ~960px.
- **Deep links:** `/today`, `/dashboard`, `/goals`, `/goals/:id`, `/day/:date`, `/account`.
- **Back behavior:** returns to the previous tab and preserves scroll.
- **States to design:** first run, no goals, loading, offline, sync pending, sync error, partial day, all done, weekly target met, paused, archived, read-only day, notification denied/unsupported, empty insights, auth expired, delete confirmation.

---

## 8. Insights & math

All stats use **completed** logical days/weeks. Today's open expectations don't lower a percentage until the day closes. This avoids the morning dip.

### 8.1 Expected units

- **Daily goal:** every logical day from start date to today, minus paused days.
- **Specific weekdays:** only selected weekdays, minus paused days.
- **Weekly target:** no daily expectations. Weeks are the unit. A week is excluded from weekly consistency and streaks if the goal started or ended mid-week, or was paused on any day in that week. Sessions still count in history.
- Archived periods behave like pauses: neutral, no expectations.

### 8.2 Consistency

- **Daily/weekday:** `done scheduled days ÷ expected scheduled days`, rounded to a whole percent. Extras are excluded from both numerator and denominator.
- **Weekly target:** `weeks met ÷ completed expected weeks`.
- Show `—` or "Not enough data" below **3 expected units**.
- **Overall consistency:** average of per-goal consistency across active goals with ≥3 expected units. Equal weight per goal, so a daily goal doesn't drown out a 3×/week goal. Label it "Avg. goal consistency."
- **Sessions:** count of done check-ins in range, including extras. **Minutes:** sum of logged minutes; average per session only when ≥3 sessions have minutes.

### 8.3 Streaks

- **Daily/weekday:** consecutive expected days done. Off days and paused days are skipped, not counted. If today is expected and not done, the streak is shown through yesterday and does not break until rollover. If today is done, it counts.
- **Weekly target:** consecutive expected weeks met. The current incomplete week does not break the streak; if the current week is already met, it counts.
- **Best streak:** maximum run across history, using the cadence versions and pauses in effect at the time.
- **Cadence change:** history is recalculated under each version. The current streak may reset; warn before saving.
- **Pause:** neutral. The streak neither grows nor breaks during the pause.
- A streak of zero shows "No streak yet," not a scolding "0 days."
- No streak-loss notifications, ever.

### 8.4 Weekly target outcome

A week is **met** when done sessions ≥ target by the end of the last logical day of the week. It is **missed** when the week is complete and sessions < target. It is **in progress** before that. Target changes apply from next week. Weeks are defined by the user's week-start setting (default Monday).

### 8.5 Dashboard insights

| Insight | Definition | Minimum data |
|---|---|---|
| **Best weekday** | For daily goals, completion by weekday over the last 90 completed days. Goals scheduled on a single weekday are excluded to avoid a false pattern. Show strongest and weakest only if the gap is ≥10 points; otherwise "fairly even across the week." | 14 expected days; 4 occurrences of each shown weekday |
| **Recovery** | For daily/weekday goals: of missed expected days followed by another expected day, the share where the next expected day was done. Copy: "You got back on track after 4 of 5 misses." | 3 misses |
| **Trend** | Last 7 completed days vs the previous 21 days. Show delta if ≥5 points; otherwise "holding steady." | 7 completed days |
| **Minutes** | Total and average per session for sessions with minutes. | 3 sessions with minutes |
| **Mood** | Distribution of Great/Meh/Pathetic. Optional: average minutes by mood when each mood has ≥2 sessions. | 5 rated sessions |
| **Weekly target** | Weeks met in the current streak or selected range. | 2 completed weeks |

No predictions, no "you should" coaching in v1. State the pattern; let the user decide.

### 8.6 Heatmap

- Overall heatmap: daily/weekday goals only. Cell intensity = done expected goals ÷ expected goals that day. `0` = none, `1–49%` = light, `50–99%` = medium, `100%` = full. No expectation = neutral. Paused = hatch. Extra session = small dot.
- Weekly-target goals get a separate weekly strip, because daily shading would misrepresent a weekly promise.
- Per-goal detail uses a binary daily heatmap (done/missed/no expectation) or a weekly strip for weekly goals.
- Provide an accessible table/list alternative with date, expected count, and done count.

### 8.7 What not to show

- A composite "life score" or "productivity score."
- Comparisons to other users.
- Percentages with n < 3.
- Red "failure" dashboards.
- Streak-loss push notifications.
- Advice presented as fact from thin data.

---

## 9. Data model

Logical model; implementation is stack-agnostic. A relational database fits the uniqueness and history requirements.

```text
user 1 ─── * goal 1 ─── * check_in
               │
               ├── * goal_schedule_version
               └── * goal_pause
```

### user

`id, email, name, avatar_url, timezone, week_starts_on, day_rollover_hour, reminder_enabled, reminder_time, theme, created_at`

- `timezone`: IANA identifier, auto-detected.
- `week_starts_on`: 1 = Monday … 7 = Sunday. Default 1.
- `day_rollover_hour`: 0–6. Default 4.
- `reminder_time`: local `HH:MM`. Default `21:30`.

### goal

`id, user_id, name, emoji, color, priority, start_date, status, archived_at, created_at, updated_at, deleted_at`

- `priority`: `high | medium | low`. Default medium.
- `status`: `active | paused | archived`.
- `start_date`: logical date. Editable only before the first check-in.
- `deleted_at`: internal tombstone for sync; user-facing deletion is permanent.

### goal_schedule_version

`id, goal_id, effective_from, cadence_type, weekdays[], weekly_target`

- `cadence_type`: `daily | weekdays | weekly_target`.
- `weekdays`: 1 = Monday … 7 = Sunday. Required when `cadence_type = weekdays`; at least one day.
- `weekly_target`: 1–7. Required when `cadence_type = weekly_target`.
- The version in effect for a date is the latest `effective_from <= date`.
- Initial version is created at `start_date`.
- Any change involving `weekly_target` takes effect next week. Daily ↔ weekday changes take effect tomorrow.
- If all seven weekdays are selected, normalize to `daily`.

### goal_pause

`id, goal_id, start_date, end_date, created_at`

- Dates are inclusive. `end_date` nullable = open-ended.
- Overlapping pauses for the same goal are rejected or merged.
- "Resume now" sets `end_date` to yesterday, so today becomes expected again.
- Resuming or unarchiving on the same day the pause started deletes the pause row; never store an end date before the start.
- Archiving creates an open pause from today; unarchiving closes it at yesterday.

### check_in

`id, user_id, goal_id, logical_date, status, source, minutes, note, mood, is_extra, created_at, updated_at`

- `status`: `done | missed`.
- `source`: `user | auto`.
- `mood`: `great | meh | pathetic | null`.
- `is_extra`: true for a done check-in on a non-scheduled day for a daily/weekday goal.
- Unique constraint: `(goal_id, logical_date)`. One check-in per goal per logical day, ever.
- `logical_date` is a **DATE**, not a timestamp. All timestamps are UTC.
- Weekly-target goals have no auto-missed rows.

**Derived, not stored:** weekly outcomes, streaks, consistency. Compute on read; cache if needed. No weekly outcome table in v1.

**Indexes:** `(user_id, logical_date)`, `(goal_id, logical_date)`.

---

## 10. Rules & edge cases

| Situation | Behavior |
|---|---|
| **Day rollover** | Default 4:00 AM local. 1:30 AM belongs to the previous logical day. Date boundaries use the user's timezone, not UTC. |
| **Unmarked at rollover** | Create `missed` rows for scheduled daily/weekday goals. Weekly targets get no daily miss. Generation is lazy and idempotent on load/sync; no cron dependency. |
| **New goal** | Starts on `start_date` (default today). No expectations before it. If created late at night, the user can set tomorrow as the start date. |
| **Backfill** | Last 7 logical days, including today. Future dates blocked. Older days read-only. Backfilling a missed day to done recomputes consistency and the current streak. |
| **Backfill into a completed week** | Allowed within 7 days. Recompute the weekly outcome and streak; a missed week can flip to met. |
| **Unmark done** | Today before rollover: delete the row. Past within 7 days: revert to `missed` if expected, otherwise delete. Outside 7 days: blocked. |
| **Extra session** | Allowed on an off day via day detail / "Log something else." Counts as a session and minutes; excluded from consistency and streaks. |
| **Weekly target met early** | Show "Target met"; allow extra sessions. Extras don't change the weekly outcome or streak. |
| **Weekly target missed** | After the last logical day of the week, mark the week missed. No per-day missed rows. |
| **Partial week** | A weekly goal's first/last partial week is excluded from weekly consistency and streaks. Sessions still appear in history. |
| **Week with a pause** | Excluded from weekly consistency and streaks. Not counted as met or missed. |
| **Cadence change** | Warning shown. Past history unchanged. Any change involving a weekly target is effective next week; daily ↔ weekday changes are effective tomorrow. Current streak may reset. |
| **Pause** | No expectations or misses inside the range. Streak neutral. Resume makes today expected again if the pause ended yesterday. |
| **Archive** | Removes from Today and active stats. History retained. Implemented as an open pause for expectations. Unarchive resumes today. |
| **Delete goal** | Permanent user-facing deletion of the goal, versions, pauses, and check-ins. Confirm with a count; suggest export. Internal tombstone for sync. |
| **Timezone change** | Existing logical dates are unchanged; new days use the new timezone. A dateline jump may skip a date; show "no data" rather than auto-missing skipped dates. |
| **Two devices, same check-in** | Unique `(goal_id, logical_date)`; last write wins. No duplicates. Sync is optimistic and idempotent. |
| **Offline** | Local write first, queue, retry with backoff. No blocking modal. Auth expiry: keep writes local, prompt on reconnect. |
| **Sign out** | Sync unsynced changes first; warn if any remain; clear local cache. |
| **Reminder** | At most one per logical day. Suppress if all done, no goals scheduled, or no active goals. No duplicate if the time is changed later that day. |
| **Notification denied / unsupported** | Show a one-time in-app note in Account; no repeated permission prompts. iOS requires an installed home-screen app and 16.4+. |
| **Minutes** | Integer 0–1440. Zero allowed but treated as no meaningful duration. Only on done check-ins. |
| **Note** | Max 500 characters, plain text. Never logged or sent to analytics. |
| **Mood** | Only on done check-ins. Tap again to clear. |
| **No active goals** | Today shows an empty state with "Add a goal"; reminder suppressed. |
| **All goals paused/archived** | "Nothing expected today." No reminder. |

---

## 11. PWA, offline, reminders

### Install

- Web app manifest: name, short name, 192/512 icons, maskable icon, theme/background colors, `display: standalone`, `start_url: /today`.
- Shortcuts: **Check in today** → `/today`.
- Custom install prompt on Android/desktop after the first check-in or second visit. Never block the core loop.
- iOS: no `beforeinstallprompt`; show Share → Add to Home Screen instructions in Account and after the first check-in.
- **iOS auth caveat:** Google OAuth inside a standalone PWA can lose the session if the flow opens outside the app. Use a redirect flow that returns to `start_url`, test on iOS Safari, and fall back to the system browser with a return path if needed.
- Request persistent storage where supported. Cloud sync is the real backup.

### Offline & sync

- App shell cached; last data available offline.
- Writes go to local storage first, then a sync queue. Optimistic UI.
- Auto-miss generation runs locally and on the server; the unique constraint makes it idempotent.
- Conflict policy: last write wins per check-in record, using `updated_at`. Deletions use tombstones so they don't resurrect.
- Show a slim offline banner and a sync status in Account ("Last synced 2m ago"). Errors retry quietly; offer manual retry.
- First sign-in requires network. After that, the app works offline until the session needs refreshing.

### Reminder

- One reminder per day, at the user's chosen local time. Default **9:30 PM**.
- Copy includes the remaining count: "2 goals left today. Close the day when you're ready." Weekly targets count as one open item if still unmet.
- Suppress when everything is done, there are no active goals, or nothing is open today (no scheduled goal and no unmet weekly target).
- The reminder follows the logical day. A 2:00 AM reminder still nudges the previous day's check-in.
- No streak-loss copy, no re-engagement spam, no "we miss you" messages.
- Permission requested after onboarding in a user gesture, with a plain explanation: "One reminder a day. No streak guilt, no spam."
- Test notification in Account.
- **Platform constraint:** web push on iOS requires an installed PWA (16.4+) and a push service. If the chosen stack is local-only, fall back to an in-app banner and an optional calendar export. Do not promise background push the platform can't deliver.
- Browser support: latest two versions of Chrome, Safari, Firefox, and Edge. The core app works without push; iOS 16.4+ is required for home-screen push.
- Weekly review (v1.1) is an in-app card, not a second push, unless the user explicitly opts in.

### Badging & shortcuts

- Where the Badging API is supported, show the remaining scheduled count.
- Manifest shortcuts are nice-to-have; the app must work without them.

---

## 12. Auth, privacy, security

- **Sign-in:** Google OIDC only. Scopes: `openid`, `email`, `profile`. No Calendar, Drive, or contacts.
- **Single user per account.** No guest mode in v1; Google is the only sign-in. This avoids account-linking complexity and keeps sync simple.
- **Authorization:** every row scoped to `user_id`; enforce row-level security at the database, not just the UI.
- **Transport/rest:** HTTPS only; encryption at rest from the database provider. Don't log request bodies, notes, moods, or goal names.
- **Analytics:** none by default. If product analytics are added, use privacy-friendly events only (`goal_created`, `check_in_marked`, `day_backfilled`, `export_requested`) with no goal names, notes, minutes, or moods.
- **Export:** JSON with schema version, exported_at, settings, goals, schedule versions, pauses, and check-ins. Download from Account. CSV in v1.1.
- **Delete:** goal deletion removes its history after confirmation. Account deletion removes all live data after typing `DELETE`; backups expire on the provider's normal schedule. Explain this plainly.
- **Sign out:** sync first, then clear local cache. Warn about unsynced changes.
- **Session:** silent refresh; offline writes queue. No third-party trackers, no ad SDKs.
- **Backups:** encrypted; document retention. The user should never lose months of check-ins to a bad deploy.
- **Abuse surface:** small, but still rate-limit auth and sync endpoints. Validate all date and cadence inputs server-side.

---

## 13. Design direction

**Feeling:** a small paper ledger, not a SaaS dashboard. Calm, tactile, a little analog. Generous space. Nothing flashes at you.

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

**Type:** system sans for speed and familiarity; 16px base, 28px date, 13px meta; tabular numerals for stats. No webfont dependency in v1.

**Components:** 16px card radius, 999px pills, 1px borders, no heavy shadows. 44×44 minimum touch targets. Bottom nav on mobile, top nav ≥768px.

**Check interaction:** the circle fills and a small check draws in ~150ms; haptic where supported. Reduced motion gets an instant state change, no animation.

**Celebration:** none by default. All done gets one quiet line. No confetti, no coins, no mascot. The relief of a closed day is the reward.

**Charts:** single accent, muted grid, no gradients or 3D. Labels readable at 12px. Every chart has a text/table alternative.

**Icon:** a tally mark in a rounded square. Simple, recognizable at 32px.

**Tone of the interface:** plain, warm, second person. No "crush it," "grind," "failure," or "don't break the chain."

---

## 14. Accessibility

- Target **WCAG 2.2 AA**.
- Full keyboard access with visible focus; logical tab order.
- Check target is a real button with an accessible name: "Mark Reading done" / "Reading done. Edit details."
- Toasts and save confirmations announced via a live region; Undo is reachable, not toast-only.
- Mood pills are a labeled group with `aria-pressed`; status is not conveyed by color alone.
- Heatmap has a table/list alternative: date, expected count, done count, paused state.
- 44×44 touch targets; 16px minimum text; reflow at 200% zoom.
- Contrast ≥4.5:1 for text; goal colors never carry meaning alone.
- Respect `prefers-reduced-motion`; no autoplay, no flashing.
- Native or fully accessible time picker; no drag-only interactions.
- Screen-reader copy includes status and details: "Reading, done, 32 minutes, felt great."
- Error messages are specific and adjacent to the field; no color-only errors.

---

## 15. Copy & tone

| Context | Copy |
|---|---|
| Tagline | "You plan, you do, do you miss too?" |
| Today header | "Tue, 20 Oct" |
| Progress | "3 of 5 done" |
| Weekly goal | "2 of 4 this week" / "Target met" |
| Done toast | "Done. Undo" |
| Partial day | "Saved. 3 of 5 today." |
| All done | "That's the day. 5 of 5." |
| Nothing scheduled | "Nothing scheduled today. Rest is part of the plan." |
| No goals | "Add the first thing you want to keep doing." |
| Details | "Add details" / "Minutes" / "Note (optional)" / "How did it feel?" |
| Mood labels | "Great" / "Meh" / "Pathetic" |
| Saved | "Saved" |
| Missed | "Missed" / "Missed (auto)" |
| Weekly no session | "No session" |
| Streak | "12 days in a row" / "Best: 18 days" / "No streak yet" |
| Streak ended | "Streak ended at 12 days. Best: 18." |
| Backfill | "Past 7 days" / "You can edit the last 7 days." |
| Read-only | "This day is read-only." |
| Reminder permission | "One reminder a day. No streak guilt, no spam." |
| Reminder | "2 goals left today. Close the day when you're ready." |
| Insights empty | "A few more days and you'll see patterns here." |
| Export | "Download a copy of everything." |
| Delete goal | "This deletes Reading and all 84 check-ins. Export your data first?" |
| Delete account | "This removes your account and every check-in. This can't be undone." |
| Sign out | "Sign out and clear this device?" |
| Install | "Add Mostly to your home screen." |

**Tone rules:**

- Use "missed," not "failed."
- Use "today pending," not "at risk" or "don't break it."
- No exclamation marks in system messages.
- Never imply the app is disappointed in the user.
- The mood label "Pathetic" to be replaced by "Rough".

---

## 16. Success metrics

This is a personal tool, so success is retention and honesty, not growth.

**Usage:**

- Median time to complete the daily check-in: **under 30 seconds**.
- Check-in on **≥80% of days** after week 2.
- Still using it after **90 days**.
- Backfill rate **<10%** of check-ins (higher suggests the reminder or loop is failing).
- Reminder opt-out **<20%**.

**Quality:**

- Zero lost or duplicated check-ins across offline/sync.
- Correct logical-day, week-boundary, pause, and cadence-change behavior in automated tests.
- Today interactive in **<1s** from cache; LCP **<2.5s** on mid-range mobile.
- No critical accessibility issues in the core flows (keyboard + screen reader).
- No notes, goal names, or moods in logs/analytics.

---

## 17. Build order

No dates or stack assumptions; sequence only.

1. **Foundations:** schema, auth, goal CRUD, schedule versions, pauses, row-level security.
   *Done when:* create/edit/archive/pause works and the data model answers "what was expected on date X?"
2. **Today + check-in:** list, one-tap done, undo, details, optimistic local writes.
   *Done when:* the core loop works offline and feels instant.
3. **Time logic:** logical day, rollover, lazy auto-miss, 7-day backfill, day detail.
   *Done when:* boundary tests pass and no cron is required.
4. **Stats:** consistency, streaks, weekly outcomes, goal detail history.
   *Done when:* formulas match the spec across pauses, off days, and cadence changes.
5. **Progress:** heatmap, weekly strip, goal cards, insight thresholds and empty states.
   *Done when:* no misleading percentages appear below the thresholds.
6. **PWA:** manifest, install UX, offline cache, sync queue, reminder + permission + fallback.
   *Done when:* install and offline sync work on iOS Safari and Android Chrome.
7. **Polish:** onboarding, Account, export/delete, dark mode, accessibility, copy.
   *Done when:* the acceptance criteria below pass.
8. **v1.1:** weekly review, mood/minutes insights, minimum version, CSV, custom labels.

**Tests that must exist:** logical day at 3:59/4:00 AM, DST transitions, timezone change, week-start boundaries, pause ranges, cadence changes, partial weeks, weekly target met/missed, streak across pauses, idempotent auto-miss, offline duplicate sync.

---

## 18. Acceptance criteria

1. Tapping **Done** persists locally, updates the UI immediately, offers a 5-second Undo, and syncs exactly once.
2. An unmarked scheduled goal becomes **Missed** at rollover, can be corrected within 7 days, and is read-only after that.
3. A weekly-target goal gets no daily miss; 4 done in a 4×/week week is **met**, 3 is **missed** after the week ends, and the streak counts weeks.
4. An extra session on an off day appears in history, sessions, and minutes, but does not change consistency or the streak.
5. Pausing excludes the dates from expectations and misses, keeps the streak neutral, and resumes correctly.
6. Changing cadence preserves past history, takes effect the next day for daily/weekday changes or the next week for any weekly-target change, and warns that the current streak may reset.
7. Offline check-ins queue and sync without duplicates; last write wins; no data is lost.
8. The reminder fires at most once per logical day, is suppressed when there is nothing to do, and has a working fallback when push is unavailable.
9. JSON export contains settings, goals, schedule versions, pauses, and check-ins; deleting a goal/account removes the corresponding data after confirmation.
10. A keyboard and screen-reader user can complete a check-in, add details, backfill a day, and edit a goal; the heatmap has a text alternative.
11. The dashboard shows "not enough data" below the thresholds and never shows a percentage with fewer than 3 expected units.

---

## 19. Open decisions

Defaults are already chosen in this spec. Change any that don't fit.

| # | Decision | Default | Why it matters |
|---|---|---|---|
| 1 | App name | **Mostly** (placeholder) | Easy to change before the manifest and icon exist. |
| 2 | Week starts | **Monday** | Affects weekly targets, current week, and streaks. Sunday is a one-setting change. |
| 3 | Day rollover | **4:00 AM local** | Late-night check-ins count for the day you were living. |
| 4 | Reminder | **9:30 PM local, one per day** | Low noise; suppress when done. |
| 5 | Priority | **High / Medium / Low**, ordering only | Keeps stats honest; no weighting. |
| 6 | Pause | **In v1** | Vacations and illness shouldn't wreck history or streaks. |
| 7 | Rest/skip state | **None in v1** | Binary done/missed plus pause. A third state can inflate stats and complicate the daily decision. |
| 8 | Mood label | **Great / Meh / Rough** | . More subtle ones can be added later. |
| 9 | Weekly review | **v1.1, in-app only** | Honors the one-reminder choice; no extra push. |
| 10 | Minimum version field | **v1.1** | A useful fallback for rough days, but not needed to prove the core loop. |

---

## 20. Deliberately not building

- Social features, sharing, leaderboards, public profiles.
- Gamified currency, points, or purchasable streak protection.
- A general task manager, due dates, or calendar sync.
- A start/stop timer; minutes are deliberately manual.
- Multiple check-ins per goal per day.
- Team, family, or coach accounts.
- AI coaching or predictions in v1.
- Guilt-based notifications or re-engagement campaigns.
- Native apps before the PWA proves itself.

---

*End of spec.*
