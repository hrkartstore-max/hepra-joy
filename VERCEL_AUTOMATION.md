# Vercel Automation

HEPRA JOY uses the Vercel REST API from server-only code for project provisioning and deployment.

Flow:
1. Require `VERCEL_TOKEN`.
2. Require a verified HEPRA GitHub repository and ready merchant Supabase project.
3. Create a Vercel project linked to the GitHub repository.
4. Configure only the required public runtime variables for the generated storefront.
5. Create a production deployment from the repository's default branch.
6. Persist provider deployment identifiers and states.
7. Re-check the provider deployment before marking it ready.
8. Save the verified production URL.

Deployment states are `queued`, `building`, `ready`, and `failed`. A project is displayed as CONNECTED only after Vercel reports a READY deployment. Provider errors are surfaced as ERROR; missing credentials are CONFIGURATION REQUIRED.

Secrets are server-only and are never written to the repository.