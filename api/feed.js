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
const INTERNET_TIMEOUT_MS = 3800;
const GOOGLE_BOOKS_VOLUME_URL = "https://www.googleapis.com/books/v1/volumes";
const HN_API_BASE_URL = "https://hacker-news.firebaseio.com/v0";
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
const bookRefreshQueries = [
  "The Power of Now",
  "Deep Work",
  "Atomic Habits",
  "The Psychology of Money",
  "Designing Data-Intensive Applications",
  "The Pragmatic Programmer"
];
const trendTopics = [
  {
    category: "AI Agents",
    visual: "agent",
    art: "nodes",
    label: "Agent Interview Drill",
    keywords: ["agent", "agents", "llm", "ai", "model", "prompt", "openai", "claude", "chatgpt"],
    question: (title) => `Interview question: how would you evaluate and safely ship an agent feature related to "${title}"?`,
    choices: [
      "Define success metrics, failure modes, eval cases, guardrails, and rollback.",
      "Ship it after one demo if the answer sounds fluent.",
      "Hide every tool call so users cannot interrupt the agent."
    ],
    explanation: "Agent interviews reward concrete evals, safety boundaries, and operational rollback plans.",
    tags: ["agents", "interview", "evals"]
  },
  {
    category: "Software Engineering",
    visual: "code",
    art: "codeflow",
    label: "System Design Trend",
    keywords: ["database", "api", "cache", "cloud", "kubernetes", "rust", "python", "javascript", "architecture", "scaling", "distributed", "security", "postgres", "server"],
    question: (title) => `Interview question: what system-design tradeoffs matter first if a product includes "${title}"?`,
    choices: [
      "Start with constraints, data model, failure modes, and observability.",
      "Pick the newest framework before naming the bottleneck.",
      "Assume one server and no retries will be enough forever."
    ],
    explanation: "Good design answers start from constraints and failure modes before implementation details.",
    tags: ["system-design", "interview"]
  },
  {
    category: "Puzzles",
    visual: "puzzle",
    art: "mind",
    label: "Puzzle Pattern",
    keywords: ["algorithm", "math", "puzzle", "leetcode", "problem", "optimization", "graph", "tree", "array"],
    question: (title) => `Interview question: which invariant or search strategy would simplify a problem like "${title}"?`,
    choices: [
      "Name the invariant, then choose brute force, binary search, graph search, or DP deliberately.",
      "Start coding before knowing the input limits.",
      "Only memorize the final answer."
    ],
    explanation: "Algorithm interviews become clearer when you name invariants and constraints first.",
    tags: ["algorithms", "puzzles"]
  },
  {
    category: "Stock Market",
    visual: "market",
    art: "market",
    label: "Market Judgment",
    keywords: ["stock", "market", "invest", "trading", "finance", "inflation", "rate", "earnings", "economy"],
    question: (title) => `Judgment drill: what process question should you ask before reacting to "${title}"?`,
    choices: [
      "Ask what changed, what is priced in, and what would prove the thesis wrong.",
      "Treat the headline as a buy or sell signal by itself.",
      "Ignore position sizing and downside."
    ],
    explanation: "Market learning should build process and risk judgment, not impulsive advice.",
    tags: ["markets", "risk"]
  },
  {
    category: "Travel",
    visual: "travel",
    art: "map",
    label: "Travel Systems",
    keywords: ["travel", "flight", "visa", "map", "city", "hotel", "train", "airport"],
    question: (title) => `Product question: what would a resilient travel app need for a situation like "${title}"?`,
    choices: [
      "Offline access, recovery paths, clear timing, and local context.",
      "Only a beautiful landing page.",
      "Assume perfect connectivity everywhere."
    ],
    explanation: "Travel products are judged in stressful, low-connectivity moments.",
    tags: ["travel", "product"]
  }
];
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

function greatestCommonDivisor(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b) {
    [a, b] = [b, a % b];
  }

  return a || 1;
}

function coprimeStep(length, salt) {
  if (length <= 1) {
    return 1;
  }

  let step = (salt % (length - 1)) + 1;
  while (greatestCommonDivisor(step, length) !== 1) {
    step = (step % length) + 1;
  }
  return step;
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

function firstListValue(value, fallback = "") {
  if (Array.isArray(value)) {
    return value.find(Boolean) || fallback;
  }

  return value || fallback;
}

function stripMarkup(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url, { fetchImpl = fetch, timeout = INTERNET_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function pickTrendTopic(title = "") {
  const lowered = title.toLowerCase();
  return trendTopics.find((topic) => topic.keywords.some((keyword) => lowered.includes(keyword))) || trendTopics[1];
}

function makeBookApiSeed(volume, query, index) {
  const info = volume.volumeInfo || {};
  const title = cleanText(info.title, query, 72);
  const author = cleanText(firstListValue(info.authors, "Unknown author"), "Unknown author", 72);
  const year = info.publishedDate ? `, published ${String(info.publishedDate).slice(0, 4)}` : "";
  const description = cleanText(stripMarkup(info.description), "", 240);
  const subjects = Array.isArray(info.categories)
    ? info.categories.map((subject) => cleanText(subject, "", 34)).filter(Boolean).slice(0, 3)
    : [];
  const subjectLine = subjects.length ? `Google Books categories place it around ${subjects.join(", ")}.` : "Use the book as a thinking lens, not just a quote source.";

  return {
    id: `google-books-${stableSalt(`${title}-${author}`)}-${index}`,
    type: "read",
    category: "Book Summaries",
    visual: "book",
    art: title.toLowerCase().includes("money") ? "market" : "book",
    difficulty: "internet read",
    title,
    hook: `${author}${year}.`,
    body: `${description || `${title} is useful as a compact mental-model read.`} ${subjectLine} Read for one practical idea, connect it to a current decision, and turn that idea into one observable action today.`,
    points: [
      `Source signal: ${author}${year}.`,
      subjects[0] ? `Main lens: ${subjects[0]}.` : "Extract one idea you can test this week.",
      subjects[1] ? `Second lens: ${subjects[1]}.` : "Write one sentence about where the idea breaks.",
      "Close the loop with a next action, not another saved note."
    ],
    reflection: `Where could "${title}" change one decision today?`,
    xp: 10,
    tags: ["books", "internet", "reading"],
    sourceUrl: info.previewLink
  };
}

function makeHackerNewsSeed(item, index) {
  const rawTitle = cleanText(item.title, "Fresh technical trend", 120);
  const topic = pickTrendTopic(rawTitle);

  return {
    id: `hn-${item.id || stableSalt(rawTitle)}-${index}`,
    type: "quiz",
    category: topic.category,
    visual: topic.visual,
    art: topic.art,
    difficulty: "current",
    title: topic.label,
    hook: rawTitle,
    body: topic.question(rawTitle),
    choices: topic.choices,
    answerIndex: 0,
    explanation: topic.explanation,
    xp: 14,
    tags: [...topic.tags, "internet"],
    sourceUrl: item.url || `https://news.ycombinator.com/item?id=${item.id}`
  };
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

function makeSeedItem(sequence, { seedPool = seeds, salt = 0, step = 1, source = "seed" } = {}) {
  const seedIndex = (salt + sequence * step) % seedPool.length;
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
  const step = refreshKey ? coprimeStep(seedPool.length, salt) : 1;
  const items = [];

  for (let offset = 0; offset < size; offset += 1) {
    const sequence = start + offset;
    const item = sequence > 0 && sequence % FOCUS_INTERVAL === 0
      ? makeFocusItem(sequence)
      : makeSeedItem(sequence, { seedPool, salt, step, source });
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

function resolveInternetProvider(query = {}) {
  const requested = String(query.internet || process.env.FOCUS_REELS_INTERNET_REFRESH || "on").toLowerCase();
  return requested === "off" || requested === "false" ? "off" : "public";
}

async function fetchBookApiSeeds({ refreshKey, fetchImpl }) {
  const start = stableSalt(refreshKey) % bookRefreshQueries.length;
  const selectedQueries = Array.from({ length: 3 }, (_, index) => bookRefreshQueries[(start + index) % bookRefreshQueries.length]);
  const results = await Promise.allSettled(selectedQueries.map(async (query, index) => {
    const url = new URL(GOOGLE_BOOKS_VOLUME_URL);
    url.searchParams.set("q", `intitle:${query}`);
    url.searchParams.set("printType", "books");
    url.searchParams.set("maxResults", "1");

    const payload = await fetchJson(url, { fetchImpl });
    const volume = Array.isArray(payload.items) ? payload.items[0] : null;
    return volume ? makeBookApiSeed(volume, query, index) : null;
  }));

  return results
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value);
}

async function fetchHackerNewsSeeds({ fetchImpl }) {
  const ids = await fetchJson(`${HN_API_BASE_URL}/newstories.json`, { fetchImpl });
  const selectedIds = Array.isArray(ids) ? ids.slice(0, 16) : [];
  const results = await Promise.allSettled(selectedIds.map((id) => {
    return fetchJson(`${HN_API_BASE_URL}/item/${id}.json`, {
      fetchImpl,
      timeout: 2400
    });
  }));

  const stories = results
    .filter((result) => result.status === "fulfilled" && result.value?.type === "story" && result.value?.title)
    .map((result) => result.value);
  const topicMatches = stories.filter((story) => {
    const lowered = story.title.toLowerCase();
    return trendTopics.some((topic) => topic.keywords.some((keyword) => lowered.includes(keyword)));
  });
  const selectedStories = (topicMatches.length >= 4 ? topicMatches : stories).slice(0, 8);

  return selectedStories.map((story, index) => makeHackerNewsSeed(story, index));
}

async function generateSeedsFromInternet({ refreshKey, fetchImpl = fetch }) {
  const results = await Promise.allSettled([
    fetchBookApiSeeds({ refreshKey, fetchImpl }),
    fetchHackerNewsSeeds({ fetchImpl })
  ]);
  const internetSeeds = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter(Boolean);

  if (internetSeeds.length < 4) {
    throw new Error("Internet refresh returned too few usable items");
  }

  return {
    provider: "internet",
    model: "open-library+hacker-news",
    seeds: internetSeeds
  };
}

export async function makeRefreshedFeed({ cursor = 0, limit = DEFAULT_LIMIT, refreshKey = "", query = {}, allowLlm, llmProvider = resolveLlmProvider(query, allowLlm), internetProvider = resolveInternetProvider(query), fetchImpl = fetch } = {}) {
  const key = refreshKey || query.refreshKey || query.nonce || new Date().toISOString();
  let refreshWarning = "";

  if (internetProvider !== "off") {
    try {
      const generated = await generateSeedsFromInternet({ refreshKey: key, fetchImpl });
      return {
        ...makeFeed({
          cursor,
          limit,
          refreshKey: `${key}-${generated.model}`,
          seedPool: generated.seeds,
          source: "internet"
        }),
        source: "internet refresh",
        provider: generated.provider,
        model: generated.model
      };
    } catch (error) {
      refreshWarning = error.message;
    }
  }

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
        warning: refreshWarning ? `${refreshWarning}; ${error.message}` : error.message
      };
    }
  }

  return {
    ...makeFeed({ cursor, limit, refreshKey: key, source: "remix" }),
    source: "fresh remix",
    ...(refreshWarning ? { warning: refreshWarning } : {})
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
