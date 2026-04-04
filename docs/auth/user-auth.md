# User Authentication

How end users authenticate with deployed DeepSpace apps.

## Overview

End users sign in through an in-app auth overlay when they visit a deployed DeepSpace app at `*.app.space`. Apps can offer GitHub and Google OAuth, as well as email/password signup.

## Auth Overlay

DeepSpace apps render an `<AuthOverlay />` component that shows a sign-in modal when the user is not authenticated. The overlay supports:

- **Google OAuth** — for users with Google accounts
- **GitHub OAuth** — for users with GitHub accounts
- **Email/Password** — traditional signup with email and password

The developer chooses which methods to enable in their app configuration.

## How It Works

1. User visits `my-app.app.space`
2. App detects no active session and shows the auth overlay
3. User signs in with their preferred method
4. Better Auth sets a session cookie on the auth worker domain
5. App fetches a short-lived JWT from `POST /api/auth/token`
6. JWT is used for WebSocket connections and API calls to the platform worker

## Session Management

Sessions are managed by Better Auth running on the auth worker (`deepspace-auth`). The auth worker handles:

- User creation and storage (D1 database)
- Session cookie issuance and validation
- OAuth provider callbacks
- JWT issuance for authenticated API access

## Token Flow

```
Browser                         Auth Worker                Platform Worker
───────                         ───────────                ───────────────
Sign in (OAuth/email)
  ──────────────────────────→  Create session
                               Set cookie
  ←──────────────────────────  Session cookie

POST /api/auth/token
  ──────────────────────────→  Verify session
                               Sign JWT (ES256, 5m)
  ←──────────────────────────  { token: "ey..." }

WebSocket connect
  ─────────────────────────────────────────────────────→  Verify JWT
                                                         Establish connection
```

## OAuth Providers

| Provider | Scopes | When to use |
|----------|--------|-------------|
| Google | `openid profile email` | General users — most people have a Google account |
| GitHub | `read:user user:email` | Developer-facing apps |

Both providers are configured on the auth worker with credentials stored in Doppler. The callback URL for both is:

```
https://deepspace-auth.eudaimonicincorporated.workers.dev/api/auth/callback/{provider}
```

## Trusted Origins

The auth worker accepts requests from:
- `*.app.space` — deployed apps
- `*.deep.space` — platform domains
- `localhost:*` — local development

## Security

- Session cookies are `HttpOnly` and `Secure`
- JWTs are ES256-signed, 5-minute expiry
- CORS is scoped to trusted origins with credentials enabled
- OAuth state parameters prevent CSRF
