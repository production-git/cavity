# Standup Routines — cavity project

Two daily Claude Code routines that keep development moving without manual context loading.

---

## How it works

```
7:00 AM  → Routine 1 (Opus)   — reviews yesterday, writes .standup/plan-YYYY-MM-DD.md
8:30 AM  → Routine 2 (Sonnet) — reads plan, implements tasks, writes .standup/reports/report-YYYY-MM-DD.md
```

Routine 1 commits the plan. Routine 2 commits code + report + pushes.
Tomorrow's Routine 1 reads yesterday's report to close the loop.

---

## Setup (claude.ai/code → Routines)

### Routine 1 — Planning

| Field       | Value                                                        |
|-------------|--------------------------------------------------------------|
| Name        | cavity: morning standup                                      |
| Model       | claude-opus-4-7 (or latest Opus)                             |
| Schedule    | Daily at 7:00 AM (your timezone)                             |
| Repository  | cavity                                                       |
| Prompt      | Copy the full contents of `.standup/prompts/01-planning.md`  |

### Routine 2 — Implementation

| Field       | Value                                                          |
|-------------|----------------------------------------------------------------|
| Name        | cavity: daily implementation                                   |
| Model       | claude-sonnet-4-6 (or latest Sonnet)                           |
| Schedule    | Daily at 8:30 AM (your timezone)                               |
| Repository  | cavity                                                         |
| Prompt      | Copy the full contents of `.standup/prompts/02-implementation.md` |

> Set 8:30 AM to give Routine 1 ~90 min to finish. Adjust based on observed run times.

---

## Directory layout

```
.standup/
  README.md                        ← this file
  prompts/
    01-planning.md                 ← Routine 1 prompt (source of truth)
    02-implementation.md           ← Routine 2 prompt (source of truth)
  plan-YYYY-MM-DD.md               ← written by Routine 1 each morning
  reports/
    report-YYYY-MM-DD.md           ← written by Routine 2 each day
```

---

## Updating the prompts

Edit the files under `.standup/prompts/`, commit, then paste the updated text into
the claude.ai/code Routines UI. The UI prompt is the live version; these files are
the version-controlled source of truth.

---

## Manual trigger

To run either routine on demand, use the API trigger option in claude.ai/code
(Routines → your routine → "Trigger via API") and call the endpoint with your token.
