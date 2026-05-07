# CRM Domain

**Owner:** CRM module
**Responsibility:** Customers, customer channel identities, addresses, notes, tags, memory profile, customer auto-create/resolve from inbound messages.

## Owns

- Customer profiles
- Customer channel identities
- Customer addresses and notes
- Customer tags and memory profiles
- Auto-create/resolve from inbound messages

## Dependencies

- Identity, Tenancy

## Anti-Patterns

- ❌ Do NOT put conversation data here — that belongs in **Conversations**
- ❌ Do NOT put order data here — that belongs in **Orders**
