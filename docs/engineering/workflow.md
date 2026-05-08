# Engineering Workflow

## Branch and PR Policy

- After the initial bootstrap commit, **one task per branch/PR**.
- Branch naming: `task-XXXX-<short-description>`
- Each branch targets `main` (or `develop` when established).

## Change Scope

- Keep changes **small and focused** to the task scope.
- Do not bundle unrelated fixes into a single PR.
- Do not add provider SDKs, domain models, or product features unless the task explicitly requires them.

## Before Reporting

Run all checks before marking a task as complete:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

- Do **not** skip failures silently.
- If a check fails, fix it if it is in scope. If it is out of scope, report the exact failure reason.

## Final Report Requirements

Every completed task must include:

1. **Commit SHA** or **PR link**
2. **List of files created and modified**
3. **List of checks run** with pass/fail status
4. **Scope confirmation** — explicit statement that no out-of-scope code was added
5. **Risks or notes** — anything the reviewer should know
