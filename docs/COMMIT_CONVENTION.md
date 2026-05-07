# Commit Convention

## Format

```
<type>(<domain>): <short description>
```

## Allowed Types

| Type       | Use When                                   |
| ---------- | ------------------------------------------ |
| `feat`     | New feature or capability                  |
| `fix`      | Bug fix                                    |
| `test`     | Adding or updating tests                   |
| `refactor` | Code restructuring without behavior change |
| `chore`    | Tooling, deps, CI, config                  |
| `docs`     | Documentation only                         |
| `style`    | Formatting, no code change                 |
| `perf`     | Performance improvement                    |

## Domain Names

Use the folder name from `src/domains/`:

```
identity, tenancy, authz, crm, channels, conversations,
routing, ai-runtime, knowledge, ai-config, actions,
orders, reservations, cases, approvals, audit, billing, analytics
```

### Special Scopes

| Scope    | Use When                                 |
| -------- | ---------------------------------------- |
| `infra`  | CI/CD, Docker, deployment, build tooling |
| `shared` | Changes to `src/lib/` shared kernel      |
| `prisma` | Schema changes, migrations               |
| `deps`   | Dependency updates                       |
| `docs`   | Documentation only changes               |

## Examples

```
feat(conversations): add message attachment support
fix(routing): prevent duplicate assignment on race condition
chore(infra): add CI caching for pnpm
test(identity): add session expiry edge case
refactor(shared): extract error serialization helper
chore(prisma): add customer model to schema
docs(docs): update QA strategy for Phase 2
```

## Rules

1. **One domain per commit** when possible. If a change spans domains, use the primary affected domain.
2. **Description** must be lowercase, imperative mood, no period at end.
3. **Body** (optional) should explain _why_, not _what_.
4. **Breaking changes** must include `BREAKING CHANGE:` in the footer.
5. **Max subject length**: 72 characters.
