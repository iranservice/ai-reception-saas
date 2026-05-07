# Analytics Domain

**Owner:** Analytics module
**Responsibility:** Conversation counts, handoff counts, AI response counts, order metrics, approval metrics, basic operational dashboard data.

## Owns

- Conversation count aggregations
- Handoff count aggregations
- AI response metrics
- Order and approval metrics
- Operational dashboard data views

## Dependencies

- Tenancy, Conversations, Routing, Orders, Approvals

## Anti-Patterns

- ❌ Do NOT put audit trail here — that belongs in **Audit**
- ❌ Do NOT mutate source data from analytics — analytics is read-only
- ❌ Do NOT put real-time event streaming here — that belongs in **Channels**
