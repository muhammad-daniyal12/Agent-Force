# AgentForce account registration and Google sign-in

Production origin: `https://agent-force.tech`. Appwrite project:
`6ac9d1880018d89628db`, Singapore endpoint `https://sgp.cloud.appwrite.io/v1`.
This change is prepared for Appwrite Sites SSR; it does not deploy the application.

## Appwrite Console checklist

1. Open the existing project, then **Overview → Platforms**. Ensure a **Web**
   platform has hostname `agent-force.tech`. Use a hostname, without a scheme,
   path, or port. Add `localhost` for local development and any exact Appwrite
   Sites preview hostname you intend to test. Avoid wildcard platform hosts.
   The live preflight currently rejects the production success URL as an invalid
   platform hostname. Adding `agent-force.tech` is required before live Google
   login can succeed; this does not require changing Google's client credentials.
2. Under **Auth → Settings**, enable email/password authentication and allow new
   account creation. Existing password policies still apply. Check account limits
   if registration returns an Appwrite configuration error.
3. Keep the existing Google OAuth provider enabled. Its Google client credentials
   stay in Appwrite Console. The authorized redirect URI in Google remains the
   provider callback shown by Appwrite Console, **not** the AgentForce application
   callback. Do not add Google client credentials to source, `.env.local`, or Site
   variables. If the Google consent app is in testing mode, the account used for
   the browser test must be an allowed test user.
4. In **Sites → AgentForce → Settings**, keep SSR enabled. Set
   `APP_ORIGIN=https://agent-force.tech` and `NEXT_PUBLIC_USE_MOCK=false` before
   building the approved release. Local development uses
   `APP_ORIGIN=http://localhost:3000`; production requires HTTPS. The application
   constructs its success and failure callback URLs from this exact origin.
5. Grant the Site runtime only `sessions.write`, `rows.read`, and `rows.write`.
   Local development uses the existing private runtime key with those same scopes.
   `users.write` and Google client credentials are unnecessary. Never expose keys
   through `NEXT_PUBLIC_*` variables. Keep the provisioning key off the Site.
6. Keep `rate_limits` in the existing configured database private with Row Security enabled and empty table
   permissions. Its existing `count` integer and `expires_at` datetime columns
   store rate buckets and ten-minute OAuth challenges; no schema migration is
   needed. All challenge rows have empty permissions. Business tables also retain
   their existing private permissions and owner filters. Continue periodically
   running `npm run prune:rate-limits` to remove expired rows.

See [APPWRITE_SETUP.md](APPWRITE_SETUP.md) for existing Sites environment aliases,
schema provisioning, and domain setup. Do not run the demo inventory seed for
newly registered accounts. A new account can add its own inventory through the app.

## Authentication API additions

Existing login, `/api/auth/me`, logout, and business DTOs remain compatible.
All handled errors retain `{ "error": "safe message" }`, `X-Request-ID`, and
private/no-store responses. The session cookie remains `agentforce_session`,
HTTP-only, host-only, SameSite=Lax, Path=/, Secure on HTTPS, and expires with the
verified Appwrite session. No session secret is returned in response JSON.

| Method | Endpoint                    | Input                                                                    | Success                                                                                       |
| ------ | --------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/signup`          | JSON: `name`, `email`, `password`, `confirmPassword`                     | 201, `{ "data": { "user": { "id": "...", "name": "...", "email": "..." } } }`, session cookie |
| POST   | `/api/auth/google/start`    | Native URL-encoded form; optional `next` local path                      | 303 to Google; HTTP-only state cookie                                                         |
| GET    | `/api/auth/google/callback` | Appwrite's `state`, `userId`, `secret`; failure callback is also handled | 303 to validated local destination; session cookie                                            |

Registration accepts a trimmed full name of 2–128 characters, valid email up to
254 characters (normalized to lowercase), and matching passwords of 8–256
characters. Unknown fields, including owner IDs, are rejected. Writes require
the exact configured `Origin`; JSON requests require `application/json`.
Registration has persistent limits of 20 attempts/minute/project and 3/minute/email.
Google start has a project limit of 30/minute; callback exchange has 60/minute.
Respect `Retry-After` on 429. These project limits are intentionally modest MVP
defaults. Invalid fields return 422, existing email or account switching 409,
and unauthorized origins 403. If the account is created but session establishment
fails, the endpoint returns 503 with instructions to use the existing sign-in page;
the account remains recoverable.

Google start uses Appwrite's server-side `createOAuth2Token`, a 256-bit random
state, and a ten-minute HTTP-only cookie scoped to `/api/auth/google`. Callback
validates state using a constant-time comparison and atomically deletes the
persistent challenge before exchanging the one-use token with `createSession`.
Missing, mismatched, expired, duplicate, and replayed state cannot create sessions.
Only same-origin local destinations are accepted; external URLs, protocol-relative
URLs, backslashes, control characters, and auth/API destinations are rejected.
Google cancellation returns to login with a fixed friendly error.

The Appwrite callback temporarily carries a one-use token in its query string;
only the server exchanges it. The response immediately redirects to a clean URL
with `Referrer-Policy: no-referrer`. Application diagnostics never log callback
queries, credentials, or session secrets, and Next.js development request logging
excludes this route. Any additional proxy or analytics logging must also omit
callback query strings. There is no frontend Appwrite SDK or Google client secret.

New email and Google accounts derive business ownership from their verified
Appwrite account ID. Signup never copies inventory, quotations, settings, or
activity from the seeded owner. Appwrite may link Google to an existing account;
that verified account retains its own existing records. Email verification and
password recovery are not added by this change. UI mock mode keeps its existing
sample sign-in; new real-account registration and Google sign-in require mock
mode to be disabled.

## Verification before release

Automated backend tests exercise the installed Appwrite SDK against an HTTP
fixture: signup validation and rate limits, session creation and revocation,
production cookie flags, state expiry/tampering/replay/concurrency, safe redirects,
and business isolation for both email and Google owners.

After merging and configuring a preview origin, complete these browser checks:

1. Create a new email account at `/signup`; confirm automatic sign-in and empty
   inventory/quotations. Add one product, sign out, and sign back in with the same
   password. Confirm that account's product is retained.
2. Use **Continue with Google** on login and signup with an allowed Google test
   account. Confirm return to the intended app page, `/api/auth/me` identifies
   the correct account, and a genuinely new account has no demo records.
3. Cancel Google consent and confirm the login message. An old callback must be
   rejected. Do not copy its secret-bearing URL into chat, screenshots, or logs.
4. Compare two accounts: each sees only its own records, and cross-owner mutation
   attempts return 404. Check logout invalidates the session.

Actual Google consent requires an interactive browser and the already configured
provider. Fixture tests do not claim that a real Google login has been completed.
Deploy only after the checks and PR review pass.

Official references: [Appwrite SSR authentication](https://appwrite.io/docs/products/auth/server-side-rendering),
[Next.js Google OAuth flow](https://appwrite.io/docs/tutorials/nextjs-ssr-auth/step-7),
[server Account API](https://appwrite.io/docs/references/cloud/server-nodejs/account),
[OAuth provider configuration](https://appwrite.io/docs/products/auth/oauth2).
