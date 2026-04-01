---
name: No mock tests
description: User requires all tests use real auth and real services — no mocking internal hooks or APIs
type: feedback
---

All tests must use real services. No mocking `useAuth`, `useUser`, `getAuthToken`, `fetch`, or any internal hooks.

**Why:** Mock-based tests test fake behavior and pass regardless of real system state. The user caught this and was frustrated.

**How to apply:** 
- Pure-logic unit tests (CSS manipulation, date formatting, etc.) are fine with jsdom
- Anything involving auth, WebSocket, or data flow must be tested via Playwright against real local workers
- Use `./scripts/test-local.sh` for local integration testing
