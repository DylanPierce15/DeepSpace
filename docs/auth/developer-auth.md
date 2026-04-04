# Developer Authentication

How developers authenticate with the DeepSpace platform to deploy and manage apps.

## Overview

Developers sign in with GitHub or Google via the CLI. A browser window opens, the developer authorizes, and the CLI is authenticated — no codes to copy, no tokens to paste.

## Login Flow

```
$ deepspace login
```

1. CLI creates a pending session on the auth worker
2. Browser opens to the DeepSpace login page
3. Developer clicks "Sign in with GitHub" or "Sign in with Google"
4. OAuth authorization prompt appears — developer clicks "Authorize"
5. Browser shows "Authenticated! You can close this tab."
6. CLI detects the completed session and stores credentials locally

Credentials are stored in `~/.deepspace/`:
- `session` — long-lived Better Auth session token (~30 days)
- `token` — short-lived JWT (5 minutes, auto-refreshable from session)

## Non-Interactive Login (CI/Agents)

For CI pipelines or AI agents, email/password login is available:

```
$ deepspace login --email ci@example.com --password "..."
```

This requires an account created through the platform. No browser is needed.

## How It Works

The CLI uses a polling-based flow (similar to npm, Stripe CLI, and Vercel):

1. `POST /api/auth/cli/session` — creates a session, returns a `loginUrl`
2. CLI opens the `loginUrl` in the default browser
3. CLI polls `GET /api/auth/cli/status/:sessionId` every 5 seconds
4. The login page initiates OAuth (GitHub or Google) via Better Auth
5. After OAuth completes, the auth worker marks the session as complete with the user's credentials
6. The next poll returns the session token and JWT
7. CLI stores them in `~/.deepspace/` and exits

Sessions expire after 10 minutes if not completed.

## Token Lifecycle

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Session token | ~30 days | `~/.deepspace/session` | Long-lived auth, used to refresh JWTs |
| JWT | 5 minutes | `~/.deepspace/token` | Bearer token for deploy and API calls |

The JWT contains the developer's `sub` (user ID), `email`, `name`, and `image` claims, signed with ES256.

## Deploy Authorization

After logging in, `deepspace deploy` reads the JWT from `~/.deepspace/token` and sends it as a Bearer token to the deploy worker.

## Signing Out

Delete the stored credentials:

```
$ rm -rf ~/.deepspace
```

## Querying Users

List all users in the auth database:

```
npx wrangler d1 execute deepspace-auth --remote --command "SELECT id, name, email, createdAt FROM user" --config platform/auth-worker/wrangler.toml
```

Check which auth provider each user signed up with:

```
npx wrangler d1 execute deepspace-auth --remote --command "SELECT userId, providerId, accountId FROM account" --config platform/auth-worker/wrangler.toml
```

List active sessions:

```
npx wrangler d1 execute deepspace-auth --remote --command "SELECT userId, token, expiresAt FROM session" --config platform/auth-worker/wrangler.toml
```

## Security

- Credentials are stored with `0600` permissions (owner read/write only)
- CLI sessions are single-use — credentials are deleted from the server after the first successful poll
- JWTs are short-lived (5 minutes) to limit exposure
- OAuth scopes are minimal: GitHub (`read:user`, `user:email`), Google (`openid`, `profile`, `email`)
