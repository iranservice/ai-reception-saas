# QA Strategy

## QA Expectations Per Phase

Every task that modifies sensitive flows must pass the QA checklist below before being marked `Ready for Review`.

## Required Checks

### 1. Build & Type Safety

- [ ] `pnpm typecheck` — 0 errors
- [ ] `pnpm lint` — 0 errors
- [ ] `pnpm build` — successful
- [ ] `pnpm test` — all tests pass

### 2. Security (when applicable)

- [ ] RLS policies verified (allow + deny cases)
- [ ] Access matrix tests per role
- [ ] Storage policies verified (signed URL allow + deny)
- [ ] No secrets in client-side code

### 3. Money & State (when applicable)

- [ ] Wallet/payment/refund logic is server-enforced
- [ ] State machine transitions validated
- [ ] Idempotency tests for webhooks/handlers
- [ ] Edge cases: negative amounts, duplicate requests

### 4. Integration (when applicable)

- [ ] Webhook request/response logs
- [ ] Provider adapter contract tests
- [ ] Retry and failure handling

## Evidence Pack (Required for Every Done Task)

| Change Type             | Required Evidence                                              |
| ----------------------- | -------------------------------------------------------------- |
| Any task                | Commit hash + full test output log                             |
| Prisma / DB             | Migration file names + apply log + role-based allow/deny proof |
| Storage                 | Signed-URL success proof + deny (403) proof                    |
| Webhook / Notifications | Real or mocked request+response log + persisted DB log         |

## Test Folder Structure

```
__tests__/
├── foundation/          # Toolchain smoke tests
├── unit/                # Pure unit tests (no DB)
│   ├── identity/
│   ├── tenancy/
│   ├── authz/
│   └── ...              # One folder per domain
├── integration/         # Tests requiring DB / external services
│   ├── identity/
│   ├── tenancy/
│   └── ...
└── e2e/                 # End-to-end browser tests
```

## Test Naming Convention

```
<domain>.<feature>.<scenario>.test.ts
```

Example: `identity.session.expiry-edge-case.test.ts`

## P0 Definition

Any task affecting:

- **Security** (RLS, storage policies)
- **Money** (wallet, payments, refunds)
- **Order state machine**
- **Document privacy**
- **Core schemas**

If a P0 task fails → do NOT start downstream tasks → mark them `Blocked`.
