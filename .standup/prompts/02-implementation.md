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

  Write `.standup/reports/report-YYYY-MM-DD.md`.

  The report has two sections: one for the user (human), one for the next Opus planning session.
  Write the human section first — it is the most important.

  ```markdown
  # Standup Report — YYYY-MM-DD

  ---

  ## 🧑 What changed for you today
  <!-- Plain English. No jargon. Written for the person who uses the app, not the developer.
      Answer: what can I do now that I couldn't before? What works better? What was fixed?
      If nothing user-visible shipped today (e.g. only tests or refactoring), say so clearly. -->

  ### New
  - <feature name>: <one sentence — what it does and how to use it>

  ### Improved
  - <thing that works better>: <what changed and why it's better>

  ### Fixed
  - <bug that was annoying>: <what it was doing wrong, what it does now>

  ### Not visible yet
  - <internal work that shipped today but has no user-facing effect — e.g. tests, refactors>

  ---

  ## 🤖 Technical summary (for tomorrow's Opus planning session)

  ### Completed
  - <task>: <what shipped, file changed, test count>

  ### In Progress
  - <task>: <what's done, exact next step>

  ### Blocked
  - <task>: <why, what's needed to unblock>

  ### Scope discoveries
  <!-- Files or dependencies that weren't in the plan but turned out to be needed -->
  - <file>: <why it came up — feed this to Opus for tomorrow's budget estimate>

  ### Notes for tomorrow
  - <architectural decisions made, gotchas, suggested next task>

  ### Test status
  - Suite: <X passing, Y failing>
  - Coverage: <statements%, branch%, functions%>
  - E2E: <passed / skipped / failed>
  ```

  ---

  ## Step 6 — Append to CHANGELOG.md

  `CHANGELOG.md` lives at the repo root. It is the human's single source of truth for
  what has changed in the application over time. Append today's entry at the TOP of the file
  (newest first). Only include user-visible changes — skip test-only or refactor-only days.

  ```markdown
  ## YYYY-MM-DD

  ### New
  - <feature>: <one sentence>

  ### Improved
  - <thing>: <one sentence>

  ### Fixed
  - <bug>: <one sentence>
  ```

  If `CHANGELOG.md` does not exist yet, create it with a header:
  ```markdown
  # Changelog — HKUST-1 MOF Structure Editor

  Entries are added daily. Each entry covers user-visible changes only.
  Internal refactoring, test additions, and dependency updates are omitted.

  ---
  ```

  ---

  ## Step 7 — Commit and push

  ```bash
  git add app/ Docs/progress.md CHANGELOG.md .standup/reports/report-YYYY-MM-DD.md
  git commit -m "<type>: <description>"
  git push
  ```

  Commit type reference: feat | fix | refactor | test | docs | chore | perf
