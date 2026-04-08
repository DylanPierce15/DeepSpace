# Test Accounts

Public signup (`POST /api/auth/sign-up/email`) is blocked with 403. Nobody can create an account this way.

## How people get accounts

- **Real users** — OAuth (GitHub/Google). They click "Continue with GitHub/Google" in the AuthOverlay or CLI login page. OAuth auto-creates the account on first sign-in.
- **Test accounts** — Created by an authenticated developer via `deepspace test-accounts create` or `POST /api/auth/test-accounts`. Must use `@deepspace.test` emails. Max 10 per developer.

## Email/password sign-in

Email/password sign-in still works for anyone who already has a password (existing users, test accounts). It's just the public sign-up that's blocked.
