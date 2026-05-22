# R1 — CRM Customer Domain Staging Verified

**Date:** 2026-05-23
**Main commit:** `5dfb6fa`
**Status:** R1_CRM_CUSTOMER_DOMAIN_STAGING_VERIFIED

---

## 1. Product Boundary

| Constraint | Status |
|---|---|
| Product | AI Reception SaaS only |
| Mandoub / UAE / service-catalog / order scope | ❌ Forbidden — not present |
| Wrong-scope tables (`service_categories`, `services`, `service_requests`) | Confirmed absent (0 rows) |
| Wrong-scope enum (`ServiceRequestStatus`) | Confirmed absent (0 rows) |
| Source/schema scope residue search | 0 matches in `prisma/`, `src/`, `__tests__/` |

---

## 2. Commits

| Milestone | Commit |
|---|---|
| PRD-v1 locked | `b7682e4` |
| R1 CRM Core (schema + domain + migration) | `a807160` |
| R1B API handlers (squash merge PR #60) | `5dfb6fa` |

---

## 3. Staging Deployment

| Item | Value |
|---|---|
| Vercel deployed commit | `5dfb6fa` |
| Environment | Production |
| Deploy time | 2026-05-22T15:39:46Z |
| `/api/health` | `200 {"ok":true,"service":"ai-reception-saas"}` ✅ |

---

## 4. Database Migration

CRM migration applied **manually** via Supabase SQL Editor.

**Reason:** Staging database does not have a `_prisma_migrations` tracking table. Prisma CLI migration commands require this table. Migration SQL was executed directly.

**Created objects:**

| Object | Type |
|---|---|
| `CustomerStatus` | Enum (`ACTIVE`, `ARCHIVED`) |
| `ContactMethodType` | Enum (`EMAIL`, `PHONE`, `WHATSAPP`, `INSTAGRAM`, `TELEGRAM`, `WEBSITE_CHAT`, `CUSTOM`) |
| `customers` | Table (id, business_id, display_name, status, locale, notes, metadata, created_at, updated_at) |
| `customer_contact_methods` | Table (id, customer_id, business_id, type, value, label, is_primary, verified, created_at, updated_at) |

**RLS enabled:**

| Table | RLS Enabled |
|---|---|
| `customers` | ✅ `true` |
| `customer_contact_methods` | ✅ `true` |

---

## 5. Verification SQL Results

```
Query A — _prisma_migrations table:     0 rows (not present)
Query B — CRM tables:                   2 rows (customers, customer_contact_methods)
Query C — CRM enums:                    2 rows (ContactMethodType, CustomerStatus)
Query D — Wrong-scope tables:           0 rows (confirmed absent)
Query E — Wrong-scope enum:             0 rows (confirmed absent)
Query F — RLS enabled:                  true for both tables
```

---

## 6. Browser Smoke Test

All endpoints tested against staging via browser/curl with valid auth context.

| Test | Method | Expected | Actual |
|---|---|---|---|
| List customers (active) | GET /customers | 200 | ✅ 200 |
| Create customer | POST /customers | 201 | ✅ 201 |
| Add contact method | POST /contact-methods | 201 | ✅ 201 |
| List contact methods | GET /contact-methods | 200 | ✅ 200 |
| Resolve customer | POST /customers/resolve | 200 | ✅ 200 |
| Update customer | PATCH /customers/:id | 200 | ✅ 200 |
| Delete contact method | DELETE /contact-methods/:id | 200 | ✅ 200 |
| Archive customer | POST /customers/:id/archive | 200 | ✅ 200 |
| Invalid status filter | GET /customers?status=BAD | 400 | ✅ 400 INVALID_CRM_INPUT |

---

## 7. Audit Verification

All mutation audit events verified in the `audit_events` table.

| Audit Event | Logged | PII-Safe |
|---|---|---|
| `customer.create` | ✅ | ✅ |
| `customer.update` | ✅ | ✅ |
| `customer.archive` | ✅ | ✅ |
| `customer.resolve` | ✅ | ✅ |
| `customer_contact_method.create` | ✅ | ✅ |
| `customer_contact_method.delete` | ✅ | ✅ |

**PII search:** 0 rows containing raw contact values in audit metadata.
**Audit metadata contents:** IDs (`businessId`, `customerId`, `contactMethodId`) and types (`contactMethodType`) only. No `value`, `displayName`, `notes`, or customer metadata fields.

---

## 8. Known Operational Note

> [!WARNING]
> Staging migration was applied **manually** via Supabase SQL Editor, not via `prisma migrate deploy`. The staging database does not have a `_prisma_migrations` tracking table, so Prisma has no record of this migration being applied.
>
> **Impact:** Future migrations via `prisma migrate deploy` may attempt to re-apply this migration unless the tracking table is created and backfilled.
>
> **Recommendation:** Decide on a migration strategy (manual SQL vs. Prisma CLI with tracking table bootstrap) before the next DB migration.

---

## 9. Final Status

**R1_CRM_CUSTOMER_DOMAIN_STAGING_VERIFIED**

| Gate | Status |
|---|---|
| Product scope boundary | ✅ Clean |
| Schema + migration | ✅ Applied |
| RLS | ✅ Enabled |
| API handlers | ✅ Merged to main |
| Vercel deployment | ✅ Live on `5dfb6fa` |
| Browser smoke test | ✅ 9/9 passed |
| Audit logging | ✅ 6/6 events, PII-safe |
| Wrong-scope residue | ✅ Absent |
