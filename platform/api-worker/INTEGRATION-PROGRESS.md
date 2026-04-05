# Integration Migration Progress

## Completed
- [x] openai — chat-completion
- [x] freepik — text-to-image-classic, generate-image-mystic, generate-image-flux-dev
- [x] serpapi — search
- [x] openweathermap — geocoding, current, forecast
- [x] wikipedia — search-pages, get-page-summary, get-page-content, get-random-page
- [x] nasa — apod, cme, gst, flr, neo-feed, neo-lookup, neo-browse
- [x] exa — search, answer, findSimilar, contents, research, news-search
- [x] newsapi — top-headlines, search-everything

- [x] youtube — search-videos, get-video-details, get-trending-videos (key invalid in Doppler)
- [x] github — 18 endpoints (users, repos, PRs, commits, search, tree, contents, languages, readme)
- [x] finance — crypto-price, search-crypto, search-currencies (Coinbase), stock-price (Finnhub), search-symbols (Alpha Vantage)
- [x] anthropic — chat-completion
- [x] polymarket — 12 endpoints (events, markets, tags, search, comments, CLOB price/orderbook/history/trades)

- [x] sports/f1 — 13 endpoints (Ergast/Jolpica API, no key needed)
- [x] sports/football — 19 endpoints (API-Football v3)
- [x] sports/basketball — 14 endpoints (API-Basketball v1)
- [x] sports/american-football — 14 endpoints (API-American-Football v1)
- [x] sports/baseball — 11 endpoints (API-Baseball v1)
- [x] elevenlabs — list-voices, generate-speech
- [x] speech — OpenAI TTS, STT (Whisper)
- [x] mta — feed, arrivals, alerts, list-feeds (GTFS-RT)
- [x] firecrawl — scrape, crawl, map, search (with polling)

- [x] serpapi — expanded: flights, places-search, places-reviews, hotels, events, web-search, scholar (7 endpoints)
- [x] cloudconvert — convert-file (async polling)
- [x] gemini — generate-image (gemini-2.5-flash-image)
- [x] email — send (Resend API)
- [x] latex — compile (self-hosted)
- [x] freepik — expanded: 9 async image models, 5 image tools, video, 3 stock downloads (21 endpoints total)

- [x] google — Gmail send/list/get/search, Calendar list/create/delete events, Drive list/get, Contacts list (OAuth — accessToken in body for now)
- [x] slack — list-channels, send-message, channel-history, team-info (OAuth — accessToken in body for now)
- [x] instagram — extract-content (web scraping)
- [x] tiktok — post-video, user-info, get-scheduled-posts, cancel-scheduled-post
- [x] linkedin — search-profiles, analyze-profile-url (via SerpAPI)
- [x] submagic — create-video, get-project, wait-for-completion (async polling)
- [x] livekit — generate-token, create-room, list-rooms, delete-room (HS256 JWT via Web Crypto)

## All Done

## Skipped
- CanvasDataService — Miyagi3-specific internal tool

## Obstacles
- **YOUTUBE_API_KEY** — key in Doppler is invalid (API_KEY_INVALID). Handler code is correct. Tests force-skipped until key is rotated.
- **API_SPORTS_KEY** — API-Sports account is suspended. Tests force-skipped until account is reactivated.
- **ElevenLabs create-agent** — Conversational AI agent creation fails with model validation error. May require specific account tier. Test skipped.
- **DocumentTextExtractionService** — Skipped. Depends on pdf-parse and mammoth (Node.js-only libs).
- **BookingCalendarService** — Skipped. Internal service that reads stored OAuth tokens from DB. Already covered by google/calendar-create-event.
