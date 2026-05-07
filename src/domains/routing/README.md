# Routing Domain

**Owner:** Routing module
**Responsibility:** Conversation ownership, assignment, queues, takeover, transfer, release-to-AI, handoff events, ownership history.

## Owns

- Conversation ownership state
- Assignment (manual, auto, round-robin)
- Transfer and takeover logic
- Release-to-AI handoff
- Ownership history tracking

## Dependencies

- Identity, Tenancy, Conversations

## Anti-Patterns

- ❌ Do NOT put message content here — that belongs in **Conversations**
- ❌ Do NOT put AI decision logic here — that belongs in **AI Runtime**
- ❌ Do NOT put approval workflows here — that belongs in **Approvals**
