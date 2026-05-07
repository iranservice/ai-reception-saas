# Conversations Domain

**Owner:** Conversations module
**Responsibility:** Conversations, messages, attachments, threads, message processing windows, inbox-ready query data, conversation notes, tags.

## Owns

- Conversation lifecycle
- Message persistence and retrieval
- Attachments
- Conversation notes and tags
- Inbox-ready query views

## Dependencies

- Identity, Tenancy, CRM, Channels

## Anti-Patterns

- ❌ Do NOT put routing/assignment logic here — that belongs in **Routing**
- ❌ Do NOT put AI reply generation here — that belongs in **AI Runtime**
- ❌ Do NOT put customer resolution here — that belongs in **CRM**
