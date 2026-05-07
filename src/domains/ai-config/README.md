# AI Config Domain

**Owner:** AI Config module
**Responsibility:** AI policies, prompt templates, prompt testing, versioning foundation.

## Owns

- AI policy definitions
- Prompt template management
- Prompt versioning
- AI behavior configuration

## Dependencies

- Identity, Tenancy

## Anti-Patterns

- ❌ Do NOT put AI execution here — that belongs in **AI Runtime**
- ❌ Do NOT put knowledge data here — that belongs in **Knowledge**
