# Reservations Domain

**Owner:** Reservations module
**Responsibility:** Reservation foundation, create/edit/cancel/confirm basics.

## Owns

- Reservation lifecycle
- Availability management
- Booking confirmation
- Cancellation policy enforcement

## Dependencies

- Identity, Tenancy, CRM

## Anti-Patterns

- ❌ Do NOT put order logic here — that belongs in **Orders**
- ❌ Do NOT put billing logic here — that belongs in **Billing**
