# Supabase Automation

HEPRA JOY provisions merchant Supabase projects through the Supabase Management API.

## Flow
1. Configure the server-only `SUPABASE_MANAGEMENT_API_TOKEN`.
2. Submit a store provisioning request with the Supabase organization slug, region group and a unique database password.
3. Create the project and persist provider identifiers without persisting the database password.
4. Advance the state machine: create project → wait for healthy services → migrations → Auth → Storage → verify.
5. Migration scripts are read from `supabase/migrations` and only missing provider migration names are applied.
6. Failures are persisted as retrying/failed with exponential backoff.
7. Only provider-verified ready projects are shown as CONNECTED.

## Security
- Management token is server-only.
- Database passwords are never written to the database.
- Publishable keys may be persisted; secret keys are never persisted.
- Tenant authorization and RLS protect provisioning records.
- Provider idempotency keys are used for project and migration operations.

Supabase's current platform guidance recommends Management API automation and checking services for `ACTIVE_HEALTHY` before making dependent configuration requests.