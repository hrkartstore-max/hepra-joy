# HEPRA JOY

Production-ready multi-tenant SaaS website builder and e-commerce platform.

## Phase 1 — Foundation
Next.js 15, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, Supabase RLS, server-side authorization and GitHub Actions CI.

## Phase 2 — Authentication + Multi-tenancy
- Email/password authentication
- Email verification flow
- Google OAuth callback where configured
- Protected dashboard
- Sign out
- First-store onboarding
- Atomic organization + owner membership + store creation
- Server-side tenant reads protected by Supabase RLS

## Required environment
Copy `.env.example` to `.env.local`.

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY` (not used by browser code)

## Validation
```bash
npm install
npm run lint
npm run typecheck
npm run build
```

External providers are only marked connected after real verification.
