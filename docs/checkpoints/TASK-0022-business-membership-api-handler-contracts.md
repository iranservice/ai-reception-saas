# TASK-0022: Business Membership API Handler Contracts Behind Feature Gate

## Summary
Implements feature-gated business membership API handler contracts for GET/POST memberships, PATCH role, PATCH status, and DELETE membership.

## Files Created
- `src/app/api/businesses/[businessId]/memberships/handler.ts`
- `__tests__/api/business-memberships-handler.test.ts`
- `docs/checkpoints/TASK-0022-business-membership-api-handler-contracts.md`

## Files Modified
- `src/app/api/businesses/[businessId]/memberships/route.ts`
- `src/app/api/businesses/[businessId]/memberships/[membershipId]/role/route.ts`
- `src/app/api/businesses/[businessId]/memberships/[membershipId]/status/route.ts`
- `src/app/api/businesses/[businessId]/memberships/[membershipId]/route.ts`
- `__tests__/api/api-route-feature-gate.test.ts`
- `__tests__/api/identity-me-handler.test.ts`
- `__tests__/api/tenant-identity-route-skeletons.test.ts`

## Handler Design
Five factory functions: createGetBusinessMembershipsHandler, createPostBusinessMembershipsHandler, createPatchMembershipRoleHandler, createPatchMembershipStatusHandler, createDeleteMembershipHandler, plus createBusinessMembershipHandlers combined factory.

## Feature Gate Behavior
| Condition | All membership routes |
|---|---|
| ENABLE_API_HANDLERS missing | 501 NOT_IMPLEMENTED |
| ENABLE_API_HANDLERS=true (no dev auth) | 501 AUTH_CONTEXT_UNAVAILABLE |
| Both enabled + dev headers | Service result |

## Context Behavior
All handlers use tenant request context (x-dev-user-id + x-dev-business-id + x-dev-membership-id + x-dev-role).

## Authorization Behavior
- LIST requires members.read
- CREATE requires members.invite
- UPDATE ROLE requires members.change_role
- UPDATE STATUS requires members.change_role
- DELETE requires members.remove

## Membership Business Ownership
Update role, update status, and delete handlers verify found membership.businessId matches route businessId before mutation.

## Tests Added
53 new tests (490 total passing, 7 skipped)

## Checks Run
| Check | Result |
|---|---|
| pnpm typecheck | ✅ |
| pnpm lint | ✅ |
| pnpm test | ✅ 490 passed, 7 skipped |
| pnpm build | ✅ |

## Decision
Accepted business membership API handler contracts behind feature gate.

## Recommended Next Task
[Phase 1] TASK-0023: Implement tenant audit API handler contracts behind feature gate

## Scope Confirmation
- ✅ Only business membership routes changed
- ✅ Default behavior remains NOT_IMPLEMENTED
- ✅ Enabled behavior returns AUTH_CONTEXT_UNAVAILABLE until dev auth is enabled
- ✅ Dev auth mode can call mocked tenancy/authz membership services
- ✅ Service calls occur only after successful context resolution
- ✅ Authz is checked before membership list/create/update/delete actions
- ✅ Membership business ownership is checked before update/delete
- ✅ No service calls when feature gate disabled
- ✅ No getApiDependencies call when feature gate disabled
- ✅ No getPrisma usage in route or handler files
- ✅ No PrismaClient usage in route or handler files
- ✅ No middleware, real auth, token verification, session cookies, auth provider, UI
- ✅ No Prisma schema changes, migrations, new models, provider SDKs, Supabase
- ✅ No contracts scaffold, domain renames
