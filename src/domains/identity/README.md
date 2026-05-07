# Identity Domain

**Owner:** Identity module
**Responsibility:** Users, authentication, sessions, user status, login/me/logout foundations.

## Owns

- User profiles
- Authentication triggers
- Session management
- User status tracking

## Dependencies

- None (root domain)

## Anti-Patterns

- ❌ Do NOT put business-level roles here — those belong in **Authz**
- ❌ Do NOT put business membership here — that belongs in **Tenancy**
