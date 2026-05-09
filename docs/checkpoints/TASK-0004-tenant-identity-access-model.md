# TASK-0004: Tenant, Identity, and Access Model Design

## Summary

Created the tenant, identity, membership, role, permission, access-control, onboarding, and workspace planning baseline.

## Files Created

- docs/architecture/tenant-identity-access-model.md
- docs/architecture/access-control-matrix.md
- docs/product/onboarding-and-workspace-flows.md
- docs/checkpoints/TASK-0004-tenant-identity-access-model.md

## Files Modified

None.

## Tenant Model Decisions

- Businesses are tenant workspaces
- Tenant context must be explicit
- Membership must be verified before tenant-scoped data access
- Active workspace must be validated server-side

## Identity Model Decisions

- Users are global identities
- Sessions identify users, not tenant access by themselves
- AI Receptionist Actor is not a human user
- System Actor is not a human user

## Membership Model Decisions

- Membership connects users to businesses
- Roles are scoped to memberships
- Owner, admin, operator, and viewer are the MVP roles
- Removed members lose access immediately
- Last owner must be protected

## Role and Permission Decisions

- Permission names use resource.action
- Owner has all permissions
- Admin has management permissions except business.delete
- Operator handles customer/conversation/message operations
- Viewer is read-only and restricted

## Access Control Decisions

- Permissions are evaluated server-side
- Client-side checks are UX only
- Access evaluation requires user, business, membership, role, and permission
- Sensitive denials should be audit-relevant

## Security Decisions

- Never authorize by client-provided tenant id alone
- Never expose another tenant's data
- Never rely on UI-only permission checks
- Never let provider webhooks bypass tenant resolution

## Explicit Non-Implementation Confirmation

- No product features
- No auth implementation
- No Prisma models
- No migrations
- No provider SDKs
- No API routes
- No UI
- No Supabase
- No contracts
- No domain renames

## Checks Run

- pnpm install — success
- pnpm prisma:generate — success
- pnpm prisma:format — success
- pnpm typecheck — success, 0 errors
- pnpm lint — success, 0 errors
- pnpm test — success, 18/18 tests passed
- pnpm build — success

## Issues Found

No blocking issues found.

## Decision

Accepted tenant, identity, and access model design

## Recommended Next Task

[Phase 0] TASK-0005: Tenant and identity Prisma schema design
