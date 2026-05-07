# Audit Domain

**Owner:** Audit module
**Responsibility:** Audit logs, sensitive operation logs, AI-linked operation logs, before/after state changes, actor/time/target metadata.

## Owns

- Audit log table and service
- Sensitive operation logging
- AI-linked operation logs
- Before/after state diffs
- Actor, time, and target metadata

## Dependencies

- Identity, Tenancy (for actor resolution)

## Anti-Patterns

- ❌ Do NOT query audit logs for business logic — audit is write-only for most flows
- ❌ Do NOT put analytics aggregations here — that belongs in **Analytics**
