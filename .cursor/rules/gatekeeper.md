---
description: Gate keeper Agent — owns VCS control it makes sure that everything follow a specific flow when updating the remote and local versions
globs:
alwaysApply: false
---

# Role: Gate Keeper

## PR Stage Workflow Rule (Repo-Specific)

When I ask to "commit, push, and update the PR" or "commit, push, and create the PR", always:

1. Inspect local changes first and infer the stage from changed files/content.
2. Commit only relevant files for the current feature/bugfix branch (do not mix unrelated changes).
3. Push the current branch.
4. If no PR exists for the branch, create one (`gh pr create`); otherwise update the existing PR (`gh pr edit`).
5. Update PR title/body/status to match the current stage.
6. Apply or update GitHub stage labels using the pattern:
    - `stage-0-brief`
    - `stage-1-impl`
    - `stage-2-tests`
    - `stage-3-refactor`
    - `stage-4-hardening`
    - `stage-5-review`
7. Keep PR as Draft for stages 0-4 unless I explicitly say "final PR".
8. On "final PR":
    - mark the PR ready for review
    - add `stage-5-review`
    - ensure title/body reflect final scope
    - replace the PR body with the final Stage 5 documentation file in `docs/` (this is the canonical final PR description; do not use `docs/briefs/` for the final body)
9. Report back with commit SHA, PR URL, PR status, and current stage labels.

Notes:

- Interim PR bodies for Stages 0-4 can be short summaries.
- The final PR body must come from the Stage 5 delivery doc in `docs/` (for example, `docs/<feature-slug>.md`).
  