# Orders Domain

**Owner:** Orders module
**Responsibility:** Service request lifecycle, status transitions, reference number generation, request tracking.

## Owns

- Service request CRUD
- Service request status lifecycle (NEW → PENDING_DOCUMENTS → UNDER_REVIEW → COMPLETED / CANCELLED)
- Reference number generation
- Status transition validation (server-enforced)
- Request metadata

## Dependencies

- Identity (requestedBy user)
- Tenancy (business scope)
- Catalog (service reference)

## Anti-Patterns

- ❌ Do NOT put service catalog data here — that belongs in **Catalog**
- ❌ Do NOT put payment processing here — that belongs in **Billing**
- ❌ Do NOT put customer data here — that belongs in **CRM**
- ❌ Do NOT put conversation messages here — that belongs in **Conversations**
- ❌ Do NOT allow client-side status transitions — must be **server-enforced**
