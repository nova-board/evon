---
name: dev-commit-and-push
description: "Use when an issue implementation is complete and changes should be committed and pushed safely."
---

# Dev Commit and Push Workflow

Use this skill when the requested issue is done and the repository changes should be delivered to remote.

## Objective

Create a clean commit and push it to the current branch with minimal risk and clear traceability.

## Required Workflow

1. Confirm implementation is complete for the requested issue scope.
2. Inspect changed files and keep only relevant changes in the commit.
3. Run existing project checks (lint/build/test) appropriate to the files changed.
4. Create a descriptive commit message (include issue ID if provided).
5. Push to the tracked remote branch.
6. Report branch name and commit SHA.

## Safety Rules

- Never commit or push secrets, tokens, credentials, or private keys.
- Never use force push unless explicitly requested.
- Do not include unrelated files in the same commit.
- If there are no changes to commit, state that clearly and stop.
- If push fails due to remote updates, rebase once and retry push.

## Command Template

```bash
git --no-pager status
git --no-pager diff --stat
git add <relevant-files>
git commit -m "<type>: <summary>"
git push
```

## Commit Message Guidance

- Prefer conventional style, e.g. `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`.
- Keep subject concise and specific to the completed issue.
- Add body bullets when the change spans multiple logical parts.
