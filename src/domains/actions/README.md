# Actions Domain

**Owner:** Actions module
**Responsibility:** Action definitions, business action configs, action execution orchestration, action logs, handler registry, dispatch to domain handlers.

## Owns

- Action definitions and schemas
- Business action configurations
- Action execution orchestration
- Action logs
- Handler registry and dispatch

## Dependencies

- Identity, Tenancy, Conversations, AI Runtime

## Anti-Patterns

- ❌ Do NOT put order logic here — that belongs in **Orders**
- ❌ Do NOT put reservation logic here — that belongs in **Reservations**
- ❌ Do NOT put approval logic here — that belongs in **Approvals**
