# Development Pipeline

## Phase Map

### Phase 0 — Domain Setup & Repo Discipline ✅

**Goal:** Lock domain map, module boundaries, commit conventions, branch naming, QA rules.

**Deliverables:**

- Module folder structure
- Domain ownership notes
- Commit convention
- QA strategy
- CI pipeline
- Shared kernel
- Prisma schema foundation
- Foundation smoke test

---

### Phase 1 — Identity & Auth

**Goal:** User model, authentication flow, session management.

**Deliverables:**

- Prisma User model
- Auth provider integration
- Login / logout / session flows
- Route guards

---

### Phase 2 — Tenancy & Authz

**Goal:** Multi-tenant business model, membership, roles, permissions.

**Deliverables:**

- Business and membership Prisma models
- Role-based access control
- Tenant context resolution
- Permission enforcement middleware

---

### Phase 3 — CRM & Channels Foundation

**Goal:** Customer records, channel definitions, inbound event ingestion.

---

### Phase 4 — Conversations & Routing

**Goal:** Message persistence, inbox views, ownership, assignment.

---

### Phase 5 — AI Runtime & Knowledge

**Goal:** AI provider abstraction, knowledge bases, AI reply flow.

---

### Phase 6 — Actions & Business Verticals

**Goal:** Action orchestration, orders, reservations, cases.

---

### Phase 7 — Approvals, Audit & Billing

**Goal:** Approval workflows, audit trail, billing foundation.

---

### Phase 8 — Analytics & Polish

**Goal:** Operational dashboards, metrics, performance optimization.

---

## Branch Strategy

| Branch                    | Purpose                              |
| ------------------------- | ------------------------------------ |
| `main`                    | Production-ready code                |
| `develop`                 | Integration branch for current phase |
| `task-XXXX-<description>` | Individual task branches             |

### Workflow

1. Create branch from `develop`: `task-XXXX-<short-description>`
2. Implement task
3. Run all checks: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`
4. Push and create PR to `develop`
5. Review, approve, merge
6. When phase is complete, merge `develop` → `main`

### PR Conventions

- Title: `<type>(<domain>): TASK-XXXX <description>`
- Body: Include DoD checklist, test results, evidence pack
- Labels: `phase-N`, domain name, `P0`/`P1`/`P2` priority
