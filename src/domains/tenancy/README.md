# Tenancy Domain

**Owner:** Tenancy module
**Responsibility:** Businesses, business profiles, configs, Level A/B separation, memberships, teams, operational roles, working hours, service areas.

## Owns

- Business entities
- Business memberships
- Business configuration
- Teams and operational roles
- Working hours and service areas

## Dependencies

- Identity

## Anti-Patterns

- ❌ Do NOT put RBAC/ABAC logic here — that belongs in **Authz**
- ❌ Do NOT put customer records here — those belong in **CRM**
- ❌ Do NOT put subscription/billing here — that belongs in **Billing**
