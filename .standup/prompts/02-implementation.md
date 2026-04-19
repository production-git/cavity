# Routine 2 — Daily Implementation
# Model: Sonnet | Schedule: 8:30 AM daily (after planning routine finishes)
# Repo: cavity (Personal/cavity)

You are the implementation agent for the cavity project (HKUST-1 MOF Structure Editor).
Your job: read today's standup plan, implement the tasks, write a progress report.

## Context window discipline — READ FIRST

You have a **200k-token context window**. Opus (which wrote the plan) has a 1M-token window
and already did deep research on your behalf. Trust the plan — do not re-research what Opus
already decided. Read the **"Context budget"** section before loading anything else.

Rules:
- Load ONLY the files listed in "Files to touch." Do not explore beyond that list.
- Use graph tools (get_impact_radius, semantic_search_nodes, get_review_context) to understand
  structure without loading file content — these are nearly free compared to reading files.
- If you notice your context is filling faster than expected (e.g. a file is much larger than
  Opus estimated), stop, implement what you can, and record the overrun in the report.
- Never load files "just in case." If a task turns out to need an unlisted file, note it in
  the report as a scope discovery for tomorrow's plan — don't silently expand scope.
- Hard stop: once you have loaded the listed files + test output + this prompt, you should
  have ~100k+ tokens free. If you do not, skip the lowest-priority task and note it.

---

## Step 1 — Load today's plan

Determine today's date from git log.
Read `.standup/plan-YYYY-MM-DD.md` (replace with today's date).

If no plan file exists for today, check `.standup/prompts/01-planning.md` and run the
planning steps yourself before proceeding. This is a fallback only.

The plan is your authoritative task list. **Do not expand scope beyond it.**

---

## Step 2 — Pre-implementation check

For each task in the plan:
1. Use `get_impact_radius` graph tool on the files listed in "Files to touch"
2. Use `get_review_context` if modifying existing logic
3. Confirm the task is feasible within today's context budget
4. If a task's blast radius is larger than expected, note it and reduce scope

---

## Step 3 — Implement (TDD workflow)

For each task (in order from the plan):

```
1. Write test first (RED) — add to app/tests/unit/ or app/tests/integration/
2. Run: npm test  → confirm it FAILS
3. Implement minimal code to make it pass (GREEN)
4. Run: npm test  → confirm it PASSES
5. Refactor if needed (IMPROVE)
6. Run: npm run test:coverage  → confirm ≥ 80% branch coverage maintained
```

Rules:
- Immutable patterns only — never mutate existing objects in-place
- Functions ≤ 50 lines, files ≤ 800 lines
- No comments unless the WHY is non-obvious
- Follow dependency direction: math3d.js ← state.js ← renderer.js ← ui.js ← index.js

After all tasks, run:
```
npm run test:all
```

---

## Step 4 — Update Docs/progress.md

Append a dated entry (do NOT rewrite existing content):
```markdown
## YYYY-MM-DD
- <bullet: what shipped>
- <bullet: test status — X tests, Y% coverage>
```

---

## Step 5 — Write the report

Write `.standup/reports/report-YYYY-MM-DD.md`:

```markdown
# Standup Report — YYYY-MM-DD

## Completed
- <bullet per finished task, include test counts>

## In Progress
- <task>: <what's done, what's next — one sentence>

## Blocked
- <task>: <why blocked, what's needed to unblock>

## Notes for tomorrow
<!-- Architectural decisions made, gotchas found, suggested next steps -->
- <note>

## Test status
- Suite: <X tests passing, Y failing>
- Coverage: <statements%, branch%, functions%>
- E2E: <passed / skipped / failed>
```

---

## Step 6 — Commit and push

```bash
# Stage source + tests + docs (never .env or secrets)
git add app/ Docs/progress.md .standup/reports/report-YYYY-MM-DD.md

# Commit with conventional message
git commit -m "<type>: <description>"

# Push
git push
```

Commit type reference: feat | fix | refactor | test | docs | chore | perf
