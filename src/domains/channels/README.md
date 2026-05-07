# Channels Domain

**Owner:** Channels module
**Responsibility:** WhatsApp/email/SMS/webhook/channel foundations, inbound event ingestion, outbound delivery abstraction, integration logs, provider adapter contracts, provider registry, Level A vs Level B channel capabilities.

## Owns

- Channel definitions and configurations
- Inbound event ingestion pipeline
- Outbound delivery abstraction
- Provider adapter contracts and registry
- Integration logs

## Dependencies

- Identity, Tenancy

## Anti-Patterns

- ❌ Do NOT put message storage here — that belongs in **Conversations**
- ❌ Do NOT put AI inference here — that belongs in **AI Runtime**
- ❌ Do NOT hardcode provider logic — use the adapter pattern
