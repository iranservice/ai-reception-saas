# Billing Domain

**Owner:** Billing module
**Responsibility:** Subscription plans foundation, usage ledgers, billing summary foundations, Level A payment foundation, Level B payment integration readiness.

## Owns

- Subscription plan definitions
- Usage ledgers
- Billing summaries
- Payment processing foundations
- Level A/B payment readiness

## Dependencies

- Identity, Tenancy

## Anti-Patterns

- ❌ Do NOT put order pricing here — that belongs in **Orders**
- ❌ Do NOT put client-only billing enforcement — must be **server-enforced**
- ❌ Do NOT put wallet/refund logic in client code
