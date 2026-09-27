# Custom Domains

HEPRA JOY custom domains use the Vercel Project Domains API.

Lifecycle:
1. A store must have a Vercel project.
2. The merchant submits an apex domain or subdomain.
3. The server adds it to the Vercel project.
4. Provider verification is stored from Vercel; HEPRA JOY never marks a domain verified from a client checkbox.
5. DNS guidance is exposed from the provider verification payload. DNS remains with the merchant's DNS provider unless Vercel nameservers are used.
6. Synchronization calls Vercel's domain read/verify endpoints.
7. After provider verification, HEPRA JOY probes the HTTPS endpoint and records SSL state.
8. Only an active domain can become primary.
9. Setting a primary domain clears its redirect and configures other verified domains to redirect to it with HTTP 308.
10. Primary domains cannot be removed.

Statuses:
- pending / verifying: provider or DNS verification has not completed.
- verified: Vercel verified the domain but HTTPS/SSL readiness is not yet confirmed.
- active: provider verified and HTTPS probe succeeded.
- failed/removed: provider or lifecycle failure/removal.

Required server secret: `VERCEL_TOKEN`.

Vercel automatically provisions SSL certificates after DNS validation; DNS records must point the domain at Vercel for certificate validation to complete.