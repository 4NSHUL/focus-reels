import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, "../public/feed-seeds.json");
const seeds = JSON.parse(readFileSync(seedPath, "utf8"));

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const FOCUS_INTERVAL = 18;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "smollm2:135m";
const DEFAULT_HF_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";
const HF_CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions";
const GENERATED_SEED_LIMIT = 6;
const LLM_TIMEOUT_MS = 4500;
const categories = [
  "AI Agents",
  "Software Engineering",
  "Puzzles",
  "Book Summaries",
  "Travel",
  "Stock Market",
  "Product Thinking",
  "Focus Reset"
];
const visuals = ["agent", "code", "puzzle", "book", "travel", "market", "systems", "security", "career", "product", "focus"];
const arts = ["book", "codeflow", "generic", "map", "market", "mind", "nodes"];
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

function boolValue(value) {
  return ["1", "true", "yes", "on", "local", "ollama", "auto"].includes(String(value || "").toLowerCase());
}

function stableSalt(value = "") {
  return Array.from(String(value)).reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) % 9973;
  }, 17);
}

function pickAllowed(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function cleanText(value, fallback, maxLength = 180) {
  const text = String(value || fallback || "").replace(/\s+/g, " ").trim();
  return text.slice(0, maxLength);
}

function cleanTags(value) {
  if (!Array.isArray(value)) {
    return ["fresh"];
  }

  return value
    .map((tag) => cleanText(tag, "", 24).toLowerCase())
    .filter(Boolean)
    .slice(0, 4);
}

function normaliseGeneratedSeed(candidate, index) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const type = candidate.type === "quiz" ? "quiz" : "read";
  const category = pickAllowed(candidate.category, categories, categories[index % (categories.length - 1)]);
  const visual = pickAllowed(candidate.visual, visuals, "product");
  const art = pickAllowed(candidate.art, arts, "generic");
  const title = cleanText(candidate.title, `Fresh Insight ${index + 1}`, 64);
  const hook = cleanText(candidate.hook, "A new useful scroll generated locally.", 140);
  const body = cleanText(candidate.body, "Use this as a compact thinking prompt before the next action.", 260);
  const xp = Math.max(8, Math.min(22, Number.parseInt(candidate.xp, 10) || 12));
  const base = {
    id: `llm-${stableSalt(`${title}-${hook}`)}-${index}`,
    type,
    category,
    visual,
    art,
    difficulty: cleanText(candidate.difficulty, type === "quiz" ? "medium" : "quick read", 28),
    title,
    hook,
    body,
    xp,
    tags: cleanTags(candidate.tags)
  };

  if (type === "quiz") {
    const choices = Array.isArray(candidate.choices)
      ? candidate.choices.map((choice) => cleanText(choice, "", 96)).filter(Boolean).slice(0, 3)
      : [];

    if (choices.length < 3) {
      return null;
    }

    return {
      ...base,
      choices,
      answerIndex: Math.max(0, Math.min(2, Number.parseInt(candidate.answerIndex, 10) || 0)),
      explanation: cleanText(candidate.explanation, "The useful move is the one that protects clarity, feedback, or focus.", 220)
    };
  }

  const points = Array.isArray(candidate.points)
    ? candidate.points.map((point) => cleanText(point, "", 120)).filter(Boolean).slice(0, 4)
    : [];

  return {
    ...base,
    points: points.length ? points : [
      "Name the useful idea.",
      "Apply it to one concrete decision.",
      "Stop before the scroll turns passive."
    ],
    reflection: cleanText(candidate.reflection, "What is one move this changes today?", 160)
  };
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

function makeSeedItem(sequence, { seedPool = seeds, salt = 0, source = "seed" } = {}) {
  const seedIndex = (sequence + salt + (salt ? sequence * 3 : 0)) % seedPool.length;
  const seed = seedPool[seedIndex];
  const cycle = Math.floor(sequence / seedPool.length);
  const spin = spinLabels[sequence % spinLabels.length];
  return {
    ...seed,
    id: `${seed.id}-${source}-${sequence}`,
    seedId: seed.id,
    sequence,
    title: cycle === 0 ? seed.title : `${seed.title} ${cycle + 1}`,
    hook: `${seed.hook} (${spin})`
  };
}

export function makeFeed({ cursor = 0, limit = DEFAULT_LIMIT, refreshKey = "", seedPool = seeds, source = "seed" } = {}) {
  const start = toPositiveInteger(cursor, 0, Number.MAX_SAFE_INTEGER);
  const size = toPositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const salt = refreshKey ? stableSalt(refreshKey) : 0;
  const items = [];

  for (let offset = 0; offset < size; offset += 1) {
    const sequence = start + offset;
    const item = sequence > 0 && sequence % FOCUS_INTERVAL === 0
      ? makeFocusItem(sequence)
      : makeSeedItem(sequence, { seedPool, salt, source });
    items.push(item);
  }

  return {
    items,
    nextCursor: start + size,
    limit: size,
    generatedAt: new Date().toISOString(),
    focusInterval: FOCUS_INTERVAL,
    source: refreshKey ? "fresh remix" : "online batch"
  };
}

function makeOllamaPrompt({ limit, refreshKey }) {
  return `Create ${limit} short Focus Reels content seeds as strict JSON.
Return only this shape: {"items":[...]}.
Each item must be either:
{"type":"quiz","category":"AI Agents|Software Engineering|Puzzles|Book Summaries|Travel|Stock Market|Product Thinking","visual":"agent|code|puzzle|book|travel|market|systems|security|career|product","art":"book|codeflow|generic|map|market|mind|nodes","difficulty":"easy|medium|hard","title":"under 6 words","hook":"one sentence","body":"one concrete prompt","choices":["A","B","C"],"answerIndex":0,"explanation":"one sentence","xp":12,"tags":["short","tags"]}
or:
{"type":"read","category":"AI Agents|Software Engineering|Puzzles|Book Summaries|Travel|Stock Market|Product Thinking","visual":"agent|code|puzzle|book|travel|market|systems|security|career|product","art":"book|codeflow|generic|map|market|mind|nodes","difficulty":"quick read","title":"under 6 words","hook":"one sentence","body":"two concise sentences","points":["point one","point two","point three"],"reflection":"one question","xp":9,"tags":["short","tags"]}.
Mix AI agents, software engineering, puzzles, book summaries, travel thinking, and stock-market judgment. Avoid medical/legal/financial instructions; keep stock-market items educational and process-focused.
Refresh key: ${refreshKey || "default"}.`;
}

function resolveLlmProvider(query = {}, allowLlm) {
  if (allowLlm === false) {
    return "off";
  }

  const requested = String(
    query.provider ||
    query.llm ||
    process.env.FOCUS_REELS_LLM_PROVIDER ||
    process.env.FOCUS_REELS_LLM ||
    "auto"
  ).toLowerCase();

  if (requested === "off" || requested === "false") {
    return "off";
  }

  if (requested === "hf" || requested === "huggingface") {
    return process.env.HF_TOKEN ? "hf" : "off";
  }

  if (requested === "ollama" || requested === "local") {
    if (process.env.VERCEL && !process.env.OLLAMA_BASE_URL) {
      return "off";
    }
    return "ollama";
  }

  if (process.env.HF_TOKEN) {
    return "hf";
  }

  if (!process.env.VERCEL && process.env.FOCUS_REELS_LLM === "ollama") {
    return "ollama";
  }

  return "off";
}

function parseGeneratedSeeds(responseText) {
  const parsed = JSON.parse(responseText || "{}");
  const generatedSeeds = (Array.isArray(parsed.items) ? parsed.items : [])
    .map((item, index) => normaliseGeneratedSeed(item, index))
    .filter(Boolean);

  if (generatedSeeds.length < 3) {
    throw new Error("LLM returned too few valid items");
  }

  return generatedSeeds;
}

async function generateSeedsWithOllama({ refreshKey, query }) {
  const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
  const timeout = toPositiveInteger(process.env.FOCUS_REELS_LLM_TIMEOUT_MS, LLM_TIMEOUT_MS, 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        system: "You generate concise, high-signal learning feed cards. Return valid JSON only.",
        prompt: makeOllamaPrompt({ limit: GENERATED_SEED_LIMIT, refreshKey }),
        options: {
          temperature: 0.88,
          top_p: 0.9,
          num_predict: 1400
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const payload = await response.json();
    return {
      model,
      provider: "ollama",
      seeds: parseGeneratedSeeds(payload.response)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function generateSeedsWithHuggingFace({ refreshKey }) {
  if (!process.env.HF_TOKEN) {
    throw new Error("HF_TOKEN is not configured");
  }

  const model = process.env.HF_MODEL || DEFAULT_HF_MODEL;
  const timeout = toPositiveInteger(process.env.FOCUS_REELS_LLM_TIMEOUT_MS, LLM_TIMEOUT_MS, 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(HF_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.82,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: "You generate concise, high-signal learning feed cards. Return valid JSON only."
          },
          {
            role: "user",
            content: makeOllamaPrompt({ limit: GENERATED_SEED_LIMIT, refreshKey })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Hugging Face request failed: ${response.status}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const responseText = Array.isArray(content)
      ? content.map((part) => part.text || "").join("")
      : content;

    return {
      model,
      provider: "hf",
      seeds: parseGeneratedSeeds(responseText)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function generateSeedsWithProvider({ provider, refreshKey, query }) {
  if (provider === "hf") {
    return generateSeedsWithHuggingFace({ refreshKey });
  }

  if (provider === "ollama") {
    return generateSeedsWithOllama({ refreshKey, query });
  }

  throw new Error("LLM provider is off");
}

export async function makeRefreshedFeed({ cursor = 0, limit = DEFAULT_LIMIT, refreshKey = "", query = {}, allowLlm, llmProvider = resolveLlmProvider(query, allowLlm) } = {}) {
  const key = refreshKey || query.refreshKey || query.nonce || new Date().toISOString();

  if (llmProvider !== "off") {
    try {
      const generated = await generateSeedsWithProvider({ provider: llmProvider, refreshKey: key, query });
      return {
        ...makeFeed({
          cursor,
          limit,
          refreshKey: `${key}-${generated.model}`,
          seedPool: generated.seeds,
          source: "llm"
        }),
        source: `small llm: ${generated.model}`,
        provider: generated.provider,
        model: generated.model
      };
    } catch (error) {
      return {
        ...makeFeed({ cursor, limit, refreshKey: key, source: "remix" }),
        source: "fresh remix",
        warning: error.message
      };
    }
  }

  return {
    ...makeFeed({ cursor, limit, refreshKey: key, source: "remix" }),
    source: "fresh remix"
  };
}

function getQuery(req) {
  if (req.query) {
    return req.query;
  }
  const url = new URL(req.url || "/", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

export default async function handler(req, res) {
  const query = getQuery(req);
  const refreshRequested = boolValue(query.refresh);
  const payload = refreshRequested
    ? await makeRefreshedFeed({
      cursor: query.cursor,
      limit: query.limit,
      refreshKey: query.refreshKey || query.nonce,
      query
    })
    : makeFeed({
      cursor: query.cursor,
      limit: query.limit
    });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", refreshRequested ? "no-store" : "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(payload);
}
