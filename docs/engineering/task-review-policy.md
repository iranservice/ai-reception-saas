# Task Review Policy

## Reports Are Not Enough

Antigravity (or any agent) reports are **not sufficient** for task acceptance. A human reviewer must verify the actual work.

## Review Checklist

Each task must provide:

- **Commit SHA** or **PR link** — the reviewer checks the actual diff.
- **Changed files** — the reviewer verifies only expected files were modified.
- **Tests** — the reviewer confirms tests exist, pass, and cover the task scope.
- **Scope** — the reviewer confirms no out-of-scope code was added.

## Rejection Criteria

A task will **not** be merged or accepted if:

- Out-of-scope code is added (e.g., product features in a foundation task).
- Provider SDKs are added unless the task explicitly allows them.
- Broad refactors are made without prior approval.
- Tests are missing for new functionality.
- Checks fail and failures are not reported.
- The commit diff does not match the reported changes.

## Scope Boundaries

The following require **explicit task authorization**:

- Adding provider SDKs (OpenAI, Anthropic, Twilio, Stripe, etc.)
- Adding database models or migrations
- Adding authentication flows
- Adding product features (inbox, conversations, AI, etc.)
- Broad architecture refactors
- Renaming or restructuring domain modules

## Process

1. Agent implements task on a dedicated branch.
2. Agent pushes branch and provides commit SHA or PR link.
3. Human reviewer checks diff, tests, scope, and changed files.
4. Human approves or requests changes.
5. Human merges to main.
