# GitHub Automation

HEPRA JOY uses a GitHub App installation for server-side repository automation.

## Flow

1. Configure `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` on the server.
2. Install the GitHub App on the target account and copy its installation ID.
3. HEPRA verifies the installation with GitHub before marking it connected.
4. Repository creation uses a short-lived installation access token.
5. Store project generation writes only generated store configuration and documentation files.
6. GitHub installation/repository IDs and operation idempotency keys are persisted in Supabase.

## Security

- GitHub credentials are never sent to the browser and are not stored in the database.
- Installation tokens are short-lived provider tokens and are not persisted.
- The generated project does not contain platform secrets.
- Repository operations are server-authorized against the merchant store.
- Provider operations are recorded with idempotency keys and external IDs.
- GitHub App permissions should be limited to the capabilities actually enabled. Repository creation requires Administration: write; project file writes require Contents: write.

## Provider status

The dashboard must only report CONNECTED after GitHub verification succeeds. Missing server configuration is CONFIGURATION REQUIRED. Provider failures are ERROR.

GitHub App installation access tokens expire after one hour and are generated when an operation runs.
