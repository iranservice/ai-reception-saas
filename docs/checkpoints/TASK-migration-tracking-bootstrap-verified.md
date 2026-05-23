# Migration Tracking Bootstrap — Staging Verified

**Date:** 2026-05-23
**Main commit:** `cdddd5a`
**Status:** MIGRATION_TRACKING_BOOTSTRAPPED

---

## 1. Purpose

Bootstrap Prisma migration tracking for the staging database after R1.

**Problem:** The staging schema contained all objects from 3 migrations (applied manually via Supabase SQL Editor), but the `_prisma_migrations` tracking table did not exist. This prevented `prisma migrate deploy` from managing future migrations.

**Solution:** Use `prisma migrate resolve --applied` to create the tracking table and mark all 3 existing migrations as already applied, without re-executing any SQL.

---

## 2. Repo State

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `cdddd5a` |
| Working tree | Clean |

**Migration directories:**

| Directory | Description |
|---|---|
| `20260509163715_add_tenant_identity_foundation` | Tenant identity core (users, businesses, memberships, sessions, audit) |
| `20260514_auth_provider_persistence` | Auth.js adapter (accounts, verification_tokens, email_verified) |
| `20260522_add_crm_customer_foundation` | CRM core (customers, customer_contact_methods) |

---

## 3. Preflight SQL Results

Executed in Supabase SQL Editor before bootstrap to confirm schema objects exist and tracking table does not.

| Check | Expected | Actual | Status |
|---|---|---|---|
| A — `_prisma_migrations` table exists | 0 | 0 | ✅ |
| B — Migration 1 enums (6) | 6 | 6 | ✅ |
| C — Migration 1 tables (5) | 5 | 5 | ✅ |
| D — Migration 2 tables (2) | 2 | 2 | ✅ |
| E — Migration 2 `email_verified` column | 1 | 1 | ✅ |
| F — Migration 3 enums (2) | 2 | 2 | ✅ |
| G — Migration 3 tables (2) | 2 | 2 | ✅ |
| H — Wrong-scope tables | 0 | 0 | ✅ |
| I — Wrong-scope enum | 0 | 0 | ✅ |

**Conclusion:** All 3 migrations' schema objects are present. No out-of-scope objects. Safe to mark as applied.

---

## 4. Bootstrap Method

Used Prisma CLI `migrate resolve --applied` to create the `_prisma_migrations` table and register each migration without executing any SQL.

**Commands executed:**

```
npx prisma migrate resolve --applied 20260509163715_add_tenant_identity_foundation
npx prisma migrate resolve --applied 20260514_auth_provider_persistence
npx prisma migrate resolve --applied 20260522_add_crm_customer_foundation
```

**Results:**

| Migration | CLI Output |
|---|---|
| `20260509163715_add_tenant_identity_foundation` | ✅ Marked as applied |
| `20260514_auth_provider_persistence` | ✅ Marked as applied |
| `20260522_add_crm_customer_foundation` | ✅ Marked as applied |

**What this step did NOT do:**

- ❌ No SQL migration files were executed
- ❌ No schema objects were created or altered
- ❌ No app data was changed
- ❌ No seed was run
- ❌ No manual INSERT into `_prisma_migrations`

---

## 5. Prisma Verification

### `npx prisma migrate status`

```
3 migrations found in prisma/migrations
Database schema is up to date!
```

### `npx prisma migrate deploy`

```
3 migrations found in prisma/migrations
No pending migrations to apply.
```

**Conclusion:** Prisma now recognizes all 3 migrations as applied. Future `prisma migrate deploy` will only apply new migrations.

---

## 6. Post-Bootstrap SQL Results

Executed in Supabase SQL Editor after bootstrap to verify tracking table contents.

### Query 1 — Migration rows

| migration_name | finished | not_rolled_back | no_logs | applied_steps_count |
|---|---|---|---|---|
| `20260509163715_add_tenant_identity_foundation` | `true` | `true` | — | `0` |
| `20260514_auth_provider_persistence` | `true` | `true` | — | `0` |
| `20260522_add_crm_customer_foundation` | `true` | `true` | — | `0` |

### Query 2 — Total count

| migration_count |
|---|
| 3 |

### Query 3 — Failed/rolled-back migrations

| Result |
|---|
| 0 rows (none failed or rolled back) |

> [!NOTE]
> `applied_steps_count = 0` is expected for `migrate resolve --applied` — it marks migrations as applied without executing steps.
> `logs` column contains an empty string (`''`), not `NULL`. The health check `logs IS NULL` evaluates to `false` because of this Prisma behavior. The correct health check for resolve-applied migrations is `logs = '' OR logs IS NULL`.

---

## 7. Security Incident & Remediation

> [!CAUTION]
> During the bootstrap workflow, the staging DATABASE_URL was inadvertently exposed in the chat interface instead of being entered directly in the terminal.

**Remediation completed:**

| Action | Status |
|---|---|
| Staging DB password rotated (Supabase Dashboard) | ✅ Done |
| Vercel `DATABASE_URL` updated | ✅ Done |
| Vercel redeployed | ✅ Done |
| `/api/health` after rotation | ✅ HTTP 200 |
| Credentials recorded in checkpoint | ❌ None |

**Status:** REMEDIATED — No credentials remain exposed. Rotated password is active.

---

## 8. Operational Impact

This bootstrap resolves the operational warning documented in [TASK-R1-crm-customer-domain-staging-verified.md](./TASK-R1-crm-customer-domain-staging-verified.md) (Section 8):

> "Staging migration was applied manually via Supabase SQL Editor, not via `prisma migrate deploy`. The staging database does not have a `_prisma_migrations` tracking table."

**Before bootstrap:**
- `prisma migrate deploy` would fail or attempt to re-apply all migrations
- No migration history in database
- Manual SQL was the only deployment method

**After bootstrap:**
- `prisma migrate deploy` works correctly
- All 3 migrations tracked in `_prisma_migrations`
- Future migrations follow standard Prisma workflow

---

## 9. Final Status

**MIGRATION_TRACKING_BOOTSTRAPPED**

| Gate | Status |
|---|---|
| Preflight SQL (9 checks) | ✅ All passed |
| Prisma resolve (3 migrations) | ✅ All marked as applied |
| Prisma migrate status | ✅ Schema up to date |
| Prisma migrate deploy | ✅ No pending migrations |
| Post-bootstrap SQL (3 queries) | ✅ 3 rows, all healthy |
| No schema modifications | ✅ Confirmed |
| No data modifications | ✅ Confirmed |
| No files modified | ✅ Confirmed |
| Security — password rotation | ✅ Remediated (rotated, Vercel updated, redeployed, health 200) |

> [!IMPORTANT]
> R2 can proceed after this checkpoint is reviewed and committed.
