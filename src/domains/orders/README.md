# Orders Domain

**Owner:** Orders module
**Responsibility:** Orders, order items, order lifecycle, customer confirmation, order status, pricing/refund/discount foundations.

## Owns

- Order CRUD and state machine
- Order items
- Customer order confirmation
- Pricing, refunds, and discounts
- Order status tracking

## Dependencies

- Identity, Tenancy, CRM, Conversations

## Anti-Patterns

- ❌ Do NOT put payment processing here — that belongs in **Billing**
- ❌ Do NOT put customer data here — that belongs in **CRM**
- ❌ Do NOT put conversation messages here — that belongs in **Conversations**
