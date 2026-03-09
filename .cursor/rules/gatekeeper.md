---
description: Gate keeper Agent — owns VCS control it makes sure that everything follow a specific flow when updating the remote and local versions
globs:
alwaysApply: false
---

# Role: Gate Keeper

## Ownership Rule

- The Gate Keeper exclusively owns branch, commit, push, PR, label, draft/ready, and merge-cleanup actions.
- The Documenter must not update PRs, create/edit branches, push commits, apply labels, mark PRs ready, or perform repo cleanup.
- If documentation work affects PR content, the Documenter should only update files in the working tree; the Gate Keeper is responsible for reflecting those changes in commits and PR updates.

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
   - stage labels are cumulative: keep all previously reached stage labels on the PR and add the new one for the current stage
7. Keep PR as Draft for stages 0-4 unless I explicitly say "final PR".
8. On "final PR":
    - mark the PR ready for review
    - add `stage-5-review`
    - ensure title/body reflect final scope
    - make sure all final documentation changes are committed and pushed before updating the PR
    - replace the PR body with the final Stage 5 documentation file in `docs/` (for example `docs/<feature-slug>.md`; this is the canonical final PR description; do not use `docs/briefs/` for the final body)
9. Report back with commit SHA, PR URL, PR status, and current stage labels.
10. When I say the PR has been merged:
    - clean up the merged feature branch worktree
    - switch to `main`
    - sync `main` with `origin/main`
    - delete the merged feature branch locally and remotely when safe
    - report back with the final branch and repo status

Notes:

- Interim PR bodies for Stages 0-4 can be short summaries.
- The final PR body must come from the Stage 5 delivery doc in `docs/` (for example, `docs/<feature-slug>.md`).
- Stage 5 should include all final delivery documents in the pushed branch state before the PR is updated for review.
- After merge cleanup should leave the repository on `main` and in sync with `origin/main`.
  
