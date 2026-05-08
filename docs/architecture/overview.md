# Architecture Overview

## Project Goal

AI Reception SaaS is a multi-tenant B2B platform for AI-powered customer operations. It enables businesses to automate inbound customer communication across multiple channels using configurable AI receptionists.

## Planned Architecture

### Modular Monolith

The application is planned as a **modular monolith** built with Next.js 15 (App Router). Each business domain will be encapsulated in a self-contained module under `src/domains/`.

Modules communicate through their service layers. Direct cross-domain database queries are not allowed.

### Tenant-Scoped SaaS Design

The platform is designed to be **multi-tenant from the ground up**. Every data entity will be scoped to a tenant (business). Row-level security, tenant context resolution, and membership-based access control are planned for future phases.

## Current State

**No product features are implemented yet.**

The repository contains only the engineering foundation:

- Next.js 15 App Router project scaffold
- TypeScript strict mode
- Tailwind CSS 4
- Prisma ORM (empty schema, no models)
- Vitest test framework
- ESLint + Prettier
- CI pipeline (GitHub Actions)
- 18 domain module directories (empty, with README ownership docs)
- Shared kernel (`src/lib/`): error hierarchy, types, result helpers, env, time, ids
- Health check API route (`/api/health`)
- Foundation smoke tests

## What Does Not Exist Yet

- Authentication / identity
- User or business models
- Database tables or migrations
- Tenant context resolution
- Role-based access control
- AI provider integration
- Customer records
- Conversations or messages
- Inbox UI
- Channel adapters
- Billing or payments
- Analytics dashboards

## Planned Future Modules

The following modules are **planned only** and have not been implemented:

- businesses
- memberships/auth
- customers
- conversations
- messages
- inbox
- AI reception
- outbox/delivery
- web chat
- external channel adapters
- billing
- audit logs
- analytics

Each module will be implemented in a dedicated task with its own branch and PR.
