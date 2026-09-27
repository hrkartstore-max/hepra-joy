# HEPRA JOY

Production-ready multi-tenant SaaS website builder and e-commerce platform.

## Phase 1 — Foundation

- Next.js 15 App Router
- React + TypeScript
- Tailwind CSS
- Supabase PostgreSQL/Auth/Storage
- Supabase Row Level Security
- Server-side authorization
- GitHub Actions CI

The implementation follows the ZSITE / HEPRA Start-to-End Project Master Prompt. External integrations are never reported as connected without provider confirmation.

## Environment

Copy `.env.example` to `.env.local` and provide the required Supabase values.

## Validation

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```
