# Authz Domain

**Owner:** Authz module
**Responsibility:** Roles, permissions, role assignments, RBAC/ABAC enforcement, permission overrides, policy definitions, policy rules, access control service, resource-level checks.

## Owns

- Role definitions
- Permission definitions
- Role-permission mappings
- Policy rules
- Access control enforcement

## Dependencies

- Identity, Tenancy

## Anti-Patterns

- ❌ Do NOT put authentication here — that belongs in **Identity**
- ❌ Do NOT put business membership resolution here — that belongs in **Tenancy**
- ❌ Do NOT inline permission checks — use the Authz service
