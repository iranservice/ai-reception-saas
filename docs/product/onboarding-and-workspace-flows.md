# Onboarding and Workspace Flows

## Purpose

Define planned onboarding, workspace, membership, and access flows before implementation begins.

This is a product and architecture planning document only.

## Primary Flows

- First user creates business
- User joins existing business
- User switches active workspace
- Owner invites member
- Admin changes member role
- Member is removed

## Flow 1: First User Creates Business

### Actor

Authenticated user.

### Preconditions

- User is authenticated
- User may have zero or more existing memberships
- Business name is provided

### Steps

1. User opens create business flow
2. User enters business name and basic settings
3. System validates input
4. System creates business workspace
5. System creates owner membership for user
6. System sets active workspace to the new business
7. System records audit event

### System Responsibilities

- Create business
- Create owner membership
- Enforce unique business slug if used
- Preserve tenant context
- Prevent partial workspace creation

### Audit Events

- business.created
- membership.created
- workspace.selected

### Failure Cases

- Invalid business name
- Duplicate slug
- User session expired
- Persistence failure

## Flow 2: User Joins Existing Business

### Actor

Invited user.

### Preconditions

- Invite exists
- Invite is not expired
- User is authenticated or completes authentication
- User is not already active member of the business

### Steps

1. User opens invite link
2. System validates invite token
3. System resolves or creates user identity through auth flow
4. System activates membership
5. System sets active workspace
6. System records audit event

### System Responsibilities

- Validate invite token
- Prevent duplicate active membership
- Activate membership only after auth
- Preserve tenant context

### Audit Events

- invite.accepted
- membership.activated
- workspace.selected

### Failure Cases

- Invite email already used
- User already member of business
- Invalid invite token
- Expired invite token
- User session expired

## Flow 3: User Switches Active Workspace

### Actor

Authenticated user with multiple memberships.

### Preconditions

- User is authenticated
- Target workspace exists
- User has active membership in target workspace

### Steps

1. User opens workspace switcher
2. System lists active memberships
3. User selects workspace
4. System verifies membership
5. System updates active workspace context
6. System reloads tenant-scoped views

### System Responsibilities

- List only permitted workspaces
- Verify active membership on switch
- Clear stale tenant-scoped UI state
- Prevent cross-tenant data leakage

### Audit Events

- workspace.selected
- workspace.access_denied when denied

### Failure Cases

- User has no active business
- Removed member tries to access business
- Cross-tenant access attempt
- Expired session

## Flow 4: Owner Invites Member

### Actor

Owner or admin.

### Preconditions

- Actor is authenticated
- Actor has members.invite permission
- Target email is valid
- Invite target is not already active member

### Steps

1. Actor opens members screen
2. Actor enters invite email and role
3. System checks permission
4. System creates invitation or invited membership
5. System sends or prepares invite delivery
6. System records audit event

### System Responsibilities

- Enforce members.invite permission
- Validate requested role
- Prevent duplicate active membership
- Protect owner role assignment rules

### Audit Events

- member.invited
- permission.denied if actor lacks permission

### Failure Cases

- Invite email already used
- User already member of business
- Operator attempts admin-only action
- Invalid role
- Expired session

## Flow 5: Admin Changes Member Role

### Actor

Owner or admin.

### Preconditions

- Actor is authenticated
- Actor has members.change_role permission
- Target member exists
- Role transition is allowed

### Steps

1. Actor opens member settings
2. Actor selects new role
3. System validates permission
4. System validates role transition
5. System updates membership role
6. System refreshes target access context
7. System records audit event

### System Responsibilities

- Enforce members.change_role permission
- Prevent invalid role transitions
- Prevent last-owner removal/downgrade
- Invalidate or refresh access context

### Audit Events

- member.role_changed
- permission.denied
- last_owner_protection.triggered

### Failure Cases

- Operator attempts admin-only action
- Target member not found
- Last owner would be removed or downgraded
- Expired session

## Flow 6: Member Is Removed

### Actor

Owner or admin.

### Preconditions

- Actor is authenticated
- Actor has members.remove permission
- Target member exists
- Target is not the last owner

### Steps

1. Actor opens members screen
2. Actor chooses remove member
3. System checks permission
4. System checks last-owner protection
5. System marks membership removed
6. System revokes access immediately
7. System records audit event

### System Responsibilities

- Enforce members.remove permission
- Revoke access immediately
- Prevent removing last owner
- Preserve membership history for audit

### Audit Events

- member.removed
- permission.denied
- last_owner_protection.triggered

### Failure Cases

- Removed member tries to access business
- Operator attempts admin-only action
- Target member not found
- Target is last owner
- Expired session

## Failure Cases

Required cases:

- Invite email already used
- User already member of business
- User has no active business
- Removed member tries to access business
- Operator attempts admin-only action
- Expired session
- Invalid invite token
- Cross-tenant access attempt

## UX Requirements

- User must know current active workspace
- Role must be visible in workspace switcher
- Denied actions should show clear reason
- Owner must not accidentally remove last owner
- Workspace switcher should show only permitted workspaces
- Member management should expose role and status clearly

## Security Requirements

- Server verifies membership on every tenant-scoped request
- Role changes invalidate or refresh access context
- Removed members lose access immediately
- Workspace switching cannot bypass authorization
- Invite tokens must be single-use and expiring
- Client-provided tenant IDs are never authoritative

## Non-Goals

- No auth implementation
- No invitation email provider
- No workspace UI
- No API routes
- No Prisma models
- No migrations
- No provider integrations
