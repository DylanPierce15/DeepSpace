---
name: No hacky code or fallbacks
description: User demands clean, professional code — no workarounds, no fallback chains, no dual sources of truth
type: feedback
---

Strip complexity ruthlessly. No fallback chains for the same value. No "try this, then try that" patterns. One source of truth for each concept.

**Why:** The user called out multiple instances of hacky code: defaultRole set in 3 places, fetchUser calling a separate API when JWT has the data, persisted_schemas table when schemas are baked in. Each created subtle bugs.

**How to apply:**
- If a value comes from one place, read it from that place. No config → schema → hardcoded fallback chains.
- If something is baked in at compile time, don't also persist/load it at runtime.
- Don't add error suppression or retry logic to mask a real problem. Fix the root cause.
- Secrets come from Doppler only. No local overrides in scripts.
- Do the work yourself — don't dispatch agents for tasks that need careful understanding.
