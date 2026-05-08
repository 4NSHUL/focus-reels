# Focus Reels

An offline-first reels-style game that makes scrolling useful. It mixes software engineering, AI agents, puzzles, book summaries, travel thinking, and stock-market drills in a high-energy vertical feed.

## What is included

- Reels-like vertical UI with mouse wheel scroll snap.
- Click, middle-click, `Space`, or `K` to play and pause the current reel.
- Keyboard navigation with `ArrowUp`, `ArrowDown`, `J`, and `L`.
- Micro quizzes, summaries, and decision drills with XP and streak tracking.
- Focus checkpoints plus a 10-minute session timer that nudges you back to work.
- Offline support after first load through a service worker and local seed feed.
- Fullstack Vercel function at `/api/feed` that returns the next 100 feed items.
- Refresh button that pulls a new 100-item batch from public internet sources, then falls back to a local remix.
- No npm dependencies required for local play.

## Run locally

```bash
node scripts/dev-server.mjs
```

Open `http://localhost:5173`.

## Live refresh

The `FRESH` button always returns a new 100-item batch. On refresh, the backend pulls public data from Google Books, Google News RSS, Hacker News, and Stooq quotes. The batch is balanced around 20% AI agent or technical drills, 30% book-summary cards with at least five body sentences, and 50% recent news, hot topics, and stock-market process cards. If public sources are slow, blocked, or invalid, the app immediately falls back to a fresh local remix.

Optional environment variables:

- `FOCUS_REELS_INTERNET_REFRESH=off`: skips public internet refresh and uses the fast local remix.

### Vercel

Vercel can use public internet refresh without any token or model setup. No server-side database is required; the browser still keeps offline play available through the service worker and local seed feed.

## Test

```bash
node --test tests/*.test.mjs
```

## Deploy on Vercel

Install and log in to the Vercel CLI if needed:

```bash
pnpm i -g vercel
vercel login
```

From this folder:

```bash
vercel --yes
```

If you want the production URL instead of a preview URL:

```bash
vercel --yes --prod
```

If you deploy from the Vercel dashboard, set the project root to `focus-reels`. Vercel will serve everything in `public/` and expose the serverless feed route from `api/feed.js`.

## Content model

Seed content lives in `public/feed-seeds.json`. The backend rotates those seeds into unique batches so the client can request 100 more reels at a time. Refresh requests use validated public-source data first, then a deterministic remix of the local seeds if the live sources fail. When offline, the browser uses the same seed file to keep generating playable reels locally.
