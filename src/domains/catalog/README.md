# Catalog Domain

**Owner:** Catalog module
**Responsibility:** Service categories, services, catalog display data. Read-only for MVP.

## Owns

- Service category definitions
- Service definitions (name, description, estimated days, base price)
- Catalog query operations (list categories, list services, find by ID/slug)

## Dependencies

- Tenancy (services are global but displayed within tenant context)

## Anti-Patterns

- ❌ Do NOT put order/request lifecycle here — that belongs in **Orders**
- ❌ Do NOT put pricing enforcement here — that belongs in **Billing**
- ❌ Do NOT put admin CRUD here yet — catalog is seed-only for MVP
