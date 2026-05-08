# Focus Reels

An offline-first reels-style game that makes scrolling useful. It mixes software engineering, AI agents, puzzles, book summaries, travel thinking, and stock-market drills in a high-energy vertical feed.

## What is included

- Reels-like vertical UI with mouse wheel scroll snap.
- Click, middle-click, `Space`, or `K` to play and pause the current reel.
- Keyboard navigation with `ArrowUp`, `ArrowDown`, `J`, and `L`.
- Micro quizzes, summaries, and decision drills with XP and streak tracking.
- Focus checkpoints that interrupt long sessions and nudge you back to work.
- Offline support after first load through a service worker and local seed feed.
- Fullstack Vercel function at `/api/feed` that returns the next 100 feed items.
- Refresh button that pulls a new 100-item batch from public internet sources, then falls back to LLM or remix.
- No npm dependencies required for local play.

## Run locally

```bash
node scripts/dev-server.mjs
```

Open `http://localhost:5173`.

## Internet and LLM refresh

The app works without an LLM. The `FRESH` button always returns a new 100-item batch. On refresh, the backend first pulls public JSON data from Google Books for book cards and Hacker News for current technical/interview-trend prompts. If internet refresh fails, and a small open-source LLM is configured, the backend asks it for a small set of fresh content seeds and expands those into the next 100 scrolls. If both are missing, slow, or invalid, the app immediately falls back to a fresh local remix.

Optional environment variables:

- `FOCUS_REELS_INTERNET_REFRESH=off`: skips public internet refresh and goes straight to LLM/remix.

### Vercel

Vercel can use public internet refresh without any token. Vercel does not run an Ollama daemon for this app by default. For extra production LLM refresh fallback, add a Hugging Face token in the Vercel project environment:

- `HF_TOKEN`: Hugging Face access token.
- `HF_MODEL`: optional, defaults to `HuggingFaceTB/SmolLM2-135M-Instruct`.
- `FOCUS_REELS_LLM_PROVIDER`: optional, set to `hf` to force Hugging Face.
- `FOCUS_REELS_LLM_TIMEOUT_MS`: optional, defaults to `4500`.

Without `HF_TOKEN`, Vercel still deploys and the `FRESH` button uses public internet refresh, then the fast remix path if public APIs are unavailable.

### Local Ollama

For local experimentation, install Ollama and pull the smallest default model:

```bash
ollama pull smollm2:135m
```

Run the app with Ollama enabled:

```bash
FOCUS_REELS_LLM=ollama OLLAMA_MODEL=smollm2:135m node scripts/dev-server.mjs
```

Optional environment variables:

- `OLLAMA_BASE_URL`: defaults to `http://127.0.0.1:11434`.
- `OLLAMA_MODEL`: defaults to `smollm2:135m`.
- `FOCUS_REELS_LLM_TIMEOUT_MS`: defaults to `4500`.
- `FOCUS_REELS_LLM=off`: skips Ollama and uses the fast local remix.

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

Seed content lives in `public/feed-seeds.json`. The backend rotates those seeds into unique batches so the client can request 100 more reels at a time. Refresh requests use validated internet API data, validated LLM-generated seeds, or a deterministic remix of the local seeds. When offline, the browser uses the same seed file to keep generating playable reels locally.
