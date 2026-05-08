import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, "../public/feed-seeds.json");
const seeds = JSON.parse(readFileSync(seedPath, "utf8"));

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const FOCUS_INTERVAL = 18;
const spinLabels = [
  "30 second drill",
  "debug mode",
  "architect mode",
  "interview speedrun",
  "shipping check",
  "offline round"
];

function toPositiveInteger(value, fallback, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }
  return Math.min(number, max);
}

function makeFocusItem(sequence) {
  return {
    id: `focus-check-${sequence}`,
    type: "focus",
    category: "Focus Reset",
    visual: "focus",
    difficulty: "healthy",
    title: "Back To Work Check",
    hook: "You have been scrolling for a while.",
    body: "Pause for ten seconds. If you came here as a break, close the loop and return to the real task.",
    choices: [
      "Back to work",
      "One more focused set"
    ],
    answerIndex: 0,
    explanation: "Healthy scrolling should create energy, not steal the session.",
    xp: 8,
    tags: ["focus", "reset"],
    sequence
  };
}

function makeSeedItem(sequence) {
  const seed = seeds[sequence % seeds.length];
  const cycle = Math.floor(sequence / seeds.length);
  const spin = spinLabels[sequence % spinLabels.length];
  return {
    ...seed,
    id: `${seed.id}-${sequence}`,
    seedId: seed.id,
    sequence,
    title: cycle === 0 ? seed.title : `${seed.title} ${cycle + 1}`,
    hook: `${seed.hook} (${spin})`
  };
}

export function makeFeed({ cursor = 0, limit = DEFAULT_LIMIT } = {}) {
  const start = toPositiveInteger(cursor, 0, Number.MAX_SAFE_INTEGER);
  const size = toPositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const items = [];

  for (let offset = 0; offset < size; offset += 1) {
    const sequence = start + offset;
    const item = sequence > 0 && sequence % FOCUS_INTERVAL === 0
      ? makeFocusItem(sequence)
      : makeSeedItem(sequence);
    items.push(item);
  }

  return {
    items,
    nextCursor: start + size,
    limit: size,
    generatedAt: new Date().toISOString(),
    focusInterval: FOCUS_INTERVAL
  };
}

function getQuery(req) {
  if (req.query) {
    return req.query;
  }
  const url = new URL(req.url || "/", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

export default function handler(req, res) {
  const query = getQuery(req);
  const payload = makeFeed({
    cursor: query.cursor,
    limit: query.limit
  });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(payload);
}
