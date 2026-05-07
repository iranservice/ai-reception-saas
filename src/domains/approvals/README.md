# Approvals Domain

**Owner:** Approvals module
**Responsibility:** Approval requests, approval decisions, approval lifecycle, approval-required handling.

## Owns

- Approval request creation
- Approval decisions (approve/deny)
- Approval lifecycle management
- Approval-required action handling

## Dependencies

- Identity, Tenancy, Authz

## Anti-Patterns

- ❌ Do NOT put action execution here — that belongs in **Actions**
- ❌ Do NOT put order management here — that belongs in **Orders**
- ❌ Do NOT put conversation routing here — that belongs in **Routing**
