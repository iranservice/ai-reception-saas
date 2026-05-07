# AI Runtime Domain

**Owner:** AI Runtime module
**Responsibility:** AI reply trigger flow, AI provider abstraction, provider interface, retrieval logs, AI interaction logs, summaries, AI handoff pre-checks, voice-ready runtime abstractions.

## Owns

- AI reply trigger and execution flow
- Provider adapter abstraction
- AI interaction logs
- Retrieval logs and summaries
- AI handoff pre-checks

## Dependencies

- Identity, Tenancy, Conversations, Knowledge, AI Config

## Anti-Patterns

- ❌ Do NOT hardcode provider SDKs — use the provider interface
- ❌ Do NOT store conversation messages here — that belongs in **Conversations**
- ❌ Do NOT put prompt templates here — that belongs in **AI Config**
- ❌ Do NOT put knowledge entries here — that belongs in **Knowledge**
