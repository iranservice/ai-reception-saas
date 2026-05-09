# Tenant, Identity, and Access Model

## Purpose

Define the planned tenant, identity, membership, role, permission, and access-control model before implementation begins.

This is a design document only. It does not introduce runtime code, Prisma models, migrations, auth provider integration, API routes, or UI.

## Design Principles

- Tenant context is explicit
- Users are global identities
- Businesses are tenant workspaces
- Membership connects users to businesses
- Roles are scoped to memberships
- Permissions are evaluated server-side
- Client-side checks are UX only
- Cross-tenant access is a security bug
- Audit-relevant access decisions must be traceable

## Core Concepts

### User

A global platform identity. A user can belong to zero, one, or many businesses through memberships.

### Business / Tenant

A tenant workspace. All business-owned data must be scoped to a business.

### Membership

The relationship between a user and a business. Membership carries the user's role inside that business.

### Role

A named access level assigned through membership. MVP roles are owner, admin, operator, and viewer.

### Permission

A server-evaluated ability to perform an action, using the resource.action naming format.

### Policy

A future access-control rule that may refine role-based permissions. Policy rules are planned only and are not implemented in MVP.

### Session

An authenticated user session. The session identifies the global user, not the active tenant by itself.

### Active Workspace

The currently selected business workspace for a user session.

### System Actor

A non-human actor used for background/system-originated operations.

System Actor is not a human user.

### AI Receptionist Actor

A future non-human actor representing AI-assisted drafting or automation context.

AI Receptionist Actor is not a human user.

## Domain Responsibilities

- Identity owns users and sessions
- Tenancy owns businesses and memberships
- Authz owns roles, permissions, and access decisions
- Audit owns immutable audit records

## Planned Entities

Planned only:

- User
- Session
- Business
- BusinessMembership
- Role
- Permission
- RolePermission
- PolicyRule
- AuditEvent

Do not create Prisma models in this task.

## Entity Relationships

- User has many BusinessMembership records
- Business has many BusinessMembership records
- BusinessMembership connects one User to one Business
- BusinessMembership has one role
- Role grants many permissions
- Permission can be granted to many roles
- PolicyRule may refine permission decisions in the future
- AuditEvent records sensitive access-related actions

## Tenant Resolution

Rules:

- Server resolves tenant from authenticated session and selected workspace
- Public endpoints must not trust raw businessId from client
- Membership must be verified before tenant-scoped data access
- Tenant context must be passed into domain services
- Tenant context must never be inferred from client-provided IDs alone

Tenant resolution flow:

1. Authenticate user
2. Identify requested active workspace
3. Resolve business
4. Verify active membership
5. Resolve membership role
6. Build tenant context
7. Pass tenant context to domain services

## Membership Model

Roles:

- owner
- admin
- operator
- viewer

Role definitions:

- Owner can manage business and members
- Admin can manage settings and operators
- Operator can handle conversations
- Viewer can read permitted data only

Rules:

- Every tenant-scoped request requires active membership
- Removed members lose access immediately
- Role changes must refresh access context
- The last owner must not be removable without ownership transfer
- Membership changes are audit-relevant

## Role Model

The MVP uses a fixed role set:

- owner
- admin
- operator
- viewer

The initial implementation should prefer a simple, explicit role model.

Custom roles are deferred.

## Permission Model

Permissions use:

resource.action

Examples:

- business.read
- business.update
- members.invite
- members.remove
- customers.read
- conversations.read
- conversations.reply
- conversations.assign
- audit.read
- settings.update

Permission decisions are server-side only.

## Access Evaluation Flow

Sequence:

1. Authenticate user
2. Resolve active business/workspace
3. Load membership
4. Evaluate role permissions
5. Evaluate policy rules if any
6. Allow or deny action
7. Record audit event for sensitive access

## Session and Active Workspace

- Session identifies the user
- Active workspace identifies the current business context
- Switching workspace changes tenant context
- Active workspace must be validated against membership
- Workspace switching cannot bypass authorization

## Audit Requirements

Audit-relevant events include:

- Member invited
- Member removed
- Role changed
- Business settings updated
- Denied sensitive permission
- Active workspace access denied
- Last-owner protection triggered

Audit events should include:

- actor
- tenant
- action
- target
- timestamp
- result

## Security Rules

- Never authorize by client-provided tenant id alone
- Never expose another tenant's data
- Never rely on UI-only permission checks
- Never let billing or analytics own tenant identity
- Never let provider webhooks bypass tenant resolution
- Never allow removed memberships to continue accessing tenant data
- Never allow role escalation without server-side authorization

## Non-Goals

- No auth provider selection
- No auth runtime implementation
- No Prisma schema changes
- No database migrations
- No middleware implementation
- No API routes
- No UI
- No provider SDKs

## Open Questions

- Exact auth provider
- Invite token mechanism
- Active workspace persistence strategy
- Custom roles timing
- Whether membership status history needs its own entity
