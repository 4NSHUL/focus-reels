import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, "../public/feed-seeds.json");
const seeds = JSON.parse(readFileSync(seedPath, "utf8"));

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const FOCUS_INTERVAL = 18;
const INTERNET_TIMEOUT_MS = 3800;
const GOOGLE_BOOKS_VOLUME_URL = "https://www.googleapis.com/books/v1/volumes";
const HN_API_BASE_URL = "https://hacker-news.firebaseio.com/v0";
const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
const STOOQ_QUOTES_URL = "https://stooq.com/q/l/";
const SOURCE_GROUPS = {
  tech: "ai-tech",
  books: "books",
  news: "news-market"
};
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
  "The Pragmatic Programmer",
  "Thinking Fast and Slow",
  "Four Thousand Weeks",
  "Range David Epstein",
  "Zero to One",
  "The Mom Test",
  "Staff Engineer",
  "Accelerate DevOps",
  "Clean Architecture",
  "Make Time Jake Knapp"
];
const techNewsQueries = [
  "\"AI agents\" OR \"software engineering\" OR \"developer tools\" when:7d",
  "\"artificial intelligence\" \"software engineering\" when:7d",
  "\"cybersecurity\" OR \"cloud computing\" OR \"open source\" when:7d"
];
const hotNewsQueries = [
  "\"stock market\" OR Nvidia OR Microsoft OR Apple OR \"Federal Reserve\" when:1d",
  "\"AI\" OR technology OR cybersecurity OR economy when:1d",
  "\"climate\" OR travel OR startup OR \"space\" when:2d",
  "\"S&P 500\" OR Nasdaq OR earnings OR inflation when:2d"
];
const stooqSymbols = [
  "aapl.us",
  "msft.us",
  "nvda.us",
  "spy.us",
  "qqq.us",
  "tsla.us",
  "amd.us"
];
const trendTopics = [
  {
    category: "AI Agents",
    visual: "agent",
    art: "nodes",
    label: "Agent Interview Drill",
    keywords: ["agent", "agents", "ai", "model", "prompt", "openai", "claude", "chatgpt", "automation"],
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
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
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

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripMarkup(value) {
  return decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureSentence(value, fallback) {
  const text = cleanText(value, fallback, 260);
  if (!text) {
    return cleanText(fallback, "Use this as a thinking prompt.", 260);
  }
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function countSentences(value) {
  return (String(value || "").match(/[.!?]+(?=\s|$)/g) || []).length;
}

function buildGoogleNewsUrl(query) {
  const url = new URL(GOOGLE_NEWS_RSS_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url;
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

async function fetchText(url, { fetchImpl = fetch, timeout = INTERNET_TIMEOUT_MS, headers = {} } = {}) {
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

    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractXmlTag(block, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  return stripMarkup(block.match(pattern)?.[1] || "");
}

function parseRssItems(xml) {
  const blocks = String(xml || "").match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block, index) => ({
    id: `rss-${stableSalt(`${extractXmlTag(block, "title")}-${index}`)}`,
    title: extractXmlTag(block, "title"),
    description: extractXmlTag(block, "description"),
    link: extractXmlTag(block, "link"),
    source: extractXmlTag(block, "source") || "Google News",
    publishedAt: extractXmlTag(block, "pubDate")
  })).filter((item) => item.title);
}

function pickTrendTopic(title = "") {
  const lowered = title.toLowerCase();
  return trendTopics.find((topic) => topic.keywords.some((keyword) => lowered.includes(keyword))) || trendTopics[1];
}

function buildBookSummaryBody({ title, author, description, subjects }) {
  const descriptionSentence = ensureSentence(
    description,
    `${title} is useful because it gives you a practical lens for attention, judgment, or craft`
  );
  const subjectSentence = subjects.length
    ? `The public book metadata points toward ${subjects.join(", ")}, which is enough to choose a reading angle before going deeper.`
    : "Use the book as a thinking lens first, then verify the parts that matter with the full source.";
  const sentences = [
    `${title} by ${author} is a useful scroll when you want one idea you can test instead of another passive note.`,
    descriptionSentence,
    subjectSentence,
    "The practical move is to translate the idea into one observable behavior you can repeat today.",
    "If you are applying it to work, connect the idea to one meeting, one design choice, one habit, or one decision you are delaying.",
    "Before the next reel, write the smallest action that would prove you understood the book rather than only recognizing its title."
  ];
  const body = sentences.join(" ");

  return countSentences(body) >= 5 ? body : `${body} Turn the idea into a small test.`;
}

function makeBookApiSeed(volume, query, index) {
  const info = volume.volumeInfo || {};
  const title = cleanText(info.title, query, 72);
  const author = cleanText(firstListValue(info.authors, "Unknown author"), "Unknown author", 72);
  const year = info.publishedDate ? `, published ${String(info.publishedDate).slice(0, 4)}` : "";
  const description = stripMarkup(info.description);
  const subjects = Array.isArray(info.categories)
    ? info.categories.map((subject) => cleanText(subject, "", 34)).filter(Boolean).slice(0, 3)
    : [];

  return {
    id: `google-books-${stableSalt(`${title}-${author}`)}-${index}`,
    type: "read",
    category: "Book Summaries",
    visual: "book",
    art: title.toLowerCase().includes("money") ? "market" : "book",
    difficulty: "live read",
    title,
    hook: `${author}${year}.`,
    body: buildBookSummaryBody({ title, author, description, subjects }),
    points: [
      `Source signal: ${author}${year}.`,
      subjects[0] ? `Main lens: ${subjects[0]}.` : "Extract one idea you can test this week.",
      subjects[1] ? `Second lens: ${subjects[1]}.` : "Write one sentence about where the idea breaks.",
      "Close the loop with a next action, not another saved note."
    ],
    reflection: `Where could "${title}" change one decision today?`,
    xp: 10,
    tags: ["books", "live", "reading"],
    sourceGroup: SOURCE_GROUPS.books,
    sourceUrl: info.previewLink
  };
}

function makeTechTrendSeed(item, index, sourcePrefix = "tech") {
  const rawTitle = cleanText(item.title, "Fresh technical trend", 120);
  const topic = pickTrendTopic(rawTitle);

  return {
    id: `${sourcePrefix}-${item.id || stableSalt(rawTitle)}-${index}`,
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
    tags: [...topic.tags, "live"],
    sourceGroup: SOURCE_GROUPS.tech,
    sourceUrl: item.url || item.link || (item.id ? `https://news.ycombinator.com/item?id=${item.id}` : undefined)
  };
}

function makeNewsCard(item, index) {
  const title = cleanText(item.title, "Recent signal", 90);
  const lowered = title.toLowerCase();
  const marketLike = ["stock", "market", "nasdaq", "s&p", "nvidia", "apple", "microsoft", "fed", "earnings", "inflation", "rates"].some((word) => lowered.includes(word));
  const source = cleanText(item.source, "Google News", 48);
  const description = ensureSentence(item.description, "The headline is a live signal worth checking from more than one angle");

  return {
    id: `news-${item.id || stableSalt(title)}-${index}`,
    type: "read",
    category: marketLike ? "Stock Market" : "Product Thinking",
    visual: marketLike ? "market" : "systems",
    art: marketLike ? "market" : "generic",
    difficulty: "recent brief",
    title: marketLike ? "Market Signal" : "Hot Topic Brief",
    hook: title,
    body: `${description} Treat this as a live signal to investigate, not a conclusion to copy. Ask what changed, who is affected, and whether another credible source confirms the same direction. If the topic touches markets, separate business impact from price reaction before forming an opinion. Your useful move is to write one research question before you scroll again.`,
    points: [
      `Source: ${source}.`,
      "Separate facts, incentives, and interpretation.",
      marketLike ? "Ask whether the headline changes cash flows, risk, or time horizon." : "Ask who gains, who loses, and what constraint changed.",
      "Save one follow-up question, not a vague opinion."
    ],
    reflection: "What is the one question this headline makes you want to verify?",
    xp: 11,
    tags: marketLike ? ["news", "markets", "live"] : ["news", "hot-topic", "live"],
    sourceGroup: SOURCE_GROUPS.news,
    sourceUrl: item.link
  };
}

function parseCsvRows(csv) {
  const [headerLine, ...lines] = String(csv || "").trim().split(/\r?\n/);
  const headers = (headerLine || "").split(",").map((header) => header.trim().toLowerCase());
  return lines.map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function makeMarketQuoteCard(row, index) {
  const symbol = cleanText(String(row.symbol || "").replace(/\.US$/i, ""), "MARKET", 16).toUpperCase();
  const close = Number.parseFloat(row.close);
  const open = Number.parseFloat(row.open);
  const move = Number.isFinite(close) && Number.isFinite(open) && open !== 0
    ? `${(((close - open) / open) * 100).toFixed(2)}% from open`
    : "live quote available";
  const price = Number.isFinite(close) ? close.toFixed(2) : cleanText(row.close, "N/A", 16);

  return {
    id: `stooq-${symbol.toLowerCase()}-${row.date || "latest"}-${index}`,
    type: "quiz",
    category: "Stock Market",
    visual: "market",
    art: "market",
    difficulty: "market process",
    title: `${symbol} Snapshot`,
    hook: `${symbol} last traded near ${price}; ${move}.`,
    body: "What is the healthiest first question before reacting to this market move?",
    choices: [
      "What changed in fundamentals, expectations, or risk, and what would invalidate the thesis?",
      "Buy or sell immediately because the price moved.",
      "Ignore position sizing because the ticker is popular."
    ],
    answerIndex: 0,
    explanation: "Price is a prompt for research; process, risk, and invalidation keep market learning healthy.",
    xp: 13,
    tags: ["markets", "quotes", "live"],
    sourceGroup: SOURCE_GROUPS.news,
    sourceUrl: "https://stooq.com/"
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

function resolveInternetProvider(query = {}) {
  const requested = String(query.internet || process.env.FOCUS_REELS_INTERNET_REFRESH || "on").toLowerCase();
  return requested === "off" || requested === "false" ? "off" : "public";
}

function rotateValues(values, refreshKey, limit = values.length) {
  const start = stableSalt(refreshKey) % values.length;
  return Array.from({ length: Math.min(limit, values.length) }, (_, index) => values[(start + index) % values.length]);
}

function dedupeCards(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    const key = `${card.sourceGroup || ""}-${String(card.hook || card.title || "").toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function computeLiveTargets(start, size) {
  const contentSlots = Array.from({ length: size }, (_, offset) => start + offset)
    .filter((sequence) => !(sequence > 0 && sequence % FOCUS_INTERVAL === 0)).length;
  const tech = Math.round(contentSlots * 0.2);
  const books = Math.round(contentSlots * 0.3);
  return {
    tech,
    books,
    news: Math.max(0, contentSlots - tech - books)
  };
}

function buildGroupPlan(targets) {
  const preferredOrder = ["news", "books", "tech", "news", "books", "news", "tech", "books", "news", "news"];
  const used = { tech: 0, books: 0, news: 0 };
  const total = targets.tech + targets.books + targets.news;
  const plan = [];

  for (let index = 0; index < total; index += 1) {
    const preferred = preferredOrder[index % preferredOrder.length];
    const candidates = Object.keys(targets).filter((group) => used[group] < targets[group]);
    candidates.sort((left, right) => {
      const ratio = used[left] / targets[left] - used[right] / targets[right];
      if (ratio !== 0) {
        return ratio;
      }
      if (left === preferred) {
        return -1;
      }
      if (right === preferred) {
        return 1;
      }
      return preferredOrder.indexOf(left) - preferredOrder.indexOf(right);
    });
    const group = candidates[0];
    used[group] += 1;
    plan.push(group);
  }

  return plan;
}

function fallbackSeedPool(group) {
  if (group === "books") {
    return seeds.filter((seed) => seed.category === "Book Summaries");
  }
  if (group === "tech") {
    return seeds.filter((seed) => ["AI Agents", "Software Engineering", "Puzzles"].includes(seed.category));
  }
  return seeds.filter((seed) => ["Stock Market", "Product Thinking", "Travel"].includes(seed.category));
}

function makeFallbackCard(group, index, refreshKey) {
  const pool = fallbackSeedPool(group);
  const seed = pool[(stableSalt(`${refreshKey}-${group}`) + index) % pool.length];
  const card = {
    ...seed,
    id: `fallback-${group}-${seed.id}-${index}`,
    sourceGroup: SOURCE_GROUPS[group],
    tags: [...(seed.tags || []), "offline-backfill"]
  };

  if (group === "books") {
    return {
      ...card,
      type: "read",
      category: "Book Summaries",
      visual: "book",
      art: "book",
      body: buildBookSummaryBody({
        title: card.title,
        author: "Focus Reels library",
        description: card.body,
        subjects: card.tags || []
      })
    };
  }

  return card;
}

function fillGroup(cards, group, target, refreshKey) {
  const filled = dedupeCards(cards).slice(0, target);
  while (filled.length < target) {
    filled.push(makeFallbackCard(group, filled.length, refreshKey));
  }
  return filled;
}

function withSequence(card, sequence, group, refreshKey) {
  return {
    ...card,
    id: `${card.id || stableSalt(card.hook || card.title)}-${refreshKey ? stableSalt(refreshKey) : "live"}-${sequence}`,
    sequence,
    sourceGroup: card.sourceGroup || SOURCE_GROUPS[group]
  };
}

async function fetchBookApiSeeds({ refreshKey, fetchImpl, target }) {
  const start = stableSalt(refreshKey) % bookRefreshQueries.length;
  const queryCount = Math.min(bookRefreshQueries.length, Math.max(5, Math.ceil(target / 4)));
  const selectedQueries = Array.from({ length: queryCount }, (_, index) => bookRefreshQueries[(start + index) % bookRefreshQueries.length]);
  const results = await Promise.allSettled(selectedQueries.map(async (query, index) => {
    const url = new URL(GOOGLE_BOOKS_VOLUME_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("printType", "books");
    url.searchParams.set("maxResults", "5");

    const payload = await fetchJson(url, { fetchImpl });
    const volumes = Array.isArray(payload.items) ? payload.items : [];
    return volumes.map((volume, volumeIndex) => makeBookApiSeed(volume, query, index * 10 + volumeIndex));
  }));

  return dedupeCards(results
    .filter((result) => result.status === "fulfilled" && result.value)
    .flatMap((result) => result.value)
    .filter(Boolean));
}

async function fetchHackerNewsSeeds({ fetchImpl }) {
  const ids = await fetchJson(`${HN_API_BASE_URL}/newstories.json`, { fetchImpl });
  const selectedIds = Array.isArray(ids) ? ids.slice(0, 10) : [];
  const results = await Promise.allSettled(selectedIds.map((id) => {
    return fetchJson(`${HN_API_BASE_URL}/item/${id}.json`, {
      fetchImpl,
      timeout: 2200
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

  return selectedStories.map((story, index) => makeTechTrendSeed(story, index, "hn"));
}

async function fetchNewsRssCards({ queries, fetchImpl, target, mapper, sourcePrefix }) {
  const results = await Promise.allSettled([
    ...queries.map(async (query, queryIndex) => {
      const xml = await fetchText(buildGoogleNewsUrl(query), { fetchImpl });
      return parseRssItems(xml).map((item, itemIndex) => mapper(item, queryIndex * 100 + itemIndex, sourcePrefix));
    })
  ]);
  return dedupeCards(results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter(Boolean))
    .slice(0, target);
}

async function fetchTechSeeds({ fetchImpl, target }) {
  const [newsResult, hnResult] = await Promise.allSettled([
    fetchNewsRssCards({
      queries: techNewsQueries,
      fetchImpl,
      target,
      mapper: (item, index) => makeTechTrendSeed(item, index, "gnews-tech"),
      sourcePrefix: "gnews-tech"
    }),
    fetchHackerNewsSeeds({ fetchImpl })
  ]);
  return dedupeCards([
    ...(newsResult.status === "fulfilled" ? newsResult.value : []),
    ...(hnResult.status === "fulfilled" ? hnResult.value : [])
  ]).slice(0, target);
}

async function fetchMarketQuoteCards({ fetchImpl }) {
  const url = new URL(STOOQ_QUOTES_URL);
  url.searchParams.set("s", stooqSymbols.join(" "));
  url.searchParams.set("f", "sd2t2ohlcv");
  url.searchParams.set("h", "");
  url.searchParams.set("e", "csv");

  const csv = await fetchText(url, { fetchImpl, timeout: 2600 });
  return parseCsvRows(csv)
    .filter((row) => row.symbol && row.close && row.close !== "N/D")
    .map((row, index) => makeMarketQuoteCard(row, index));
}

async function fetchNewsMarketSeeds({ fetchImpl, target }) {
  const [rssResult, quoteResult] = await Promise.allSettled([
    fetchNewsRssCards({
      queries: hotNewsQueries,
      fetchImpl,
      target,
      mapper: (item, index) => makeNewsCard(item, index),
      sourcePrefix: "gnews-market"
    }),
    fetchMarketQuoteCards({ fetchImpl })
  ]);
  return dedupeCards([
    ...(quoteResult.status === "fulfilled" ? quoteResult.value : []),
    ...(rssResult.status === "fulfilled" ? rssResult.value : [])
  ]).slice(0, target);
}

async function fetchLiveGroups({ refreshKey, fetchImpl, targets }) {
  const results = await Promise.allSettled([
    fetchTechSeeds({ fetchImpl, target: targets.tech }),
    fetchBookApiSeeds({ refreshKey, fetchImpl, target: targets.books }),
    fetchNewsMarketSeeds({ fetchImpl, target: targets.news })
  ]);
  const warnings = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "A live source failed");

  return {
    groups: {
      tech: results[0].status === "fulfilled" ? results[0].value : [],
      books: results[1].status === "fulfilled" ? results[1].value : [],
      news: results[2].status === "fulfilled" ? results[2].value : []
    },
    warnings
  };
}

async function makeLiveRefreshFeed({ cursor = 0, limit = DEFAULT_LIMIT, refreshKey = "", fetchImpl = fetch } = {}) {
  const start = toPositiveInteger(cursor, 0, Number.MAX_SAFE_INTEGER);
  const size = toPositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
  const targets = computeLiveTargets(start, size);
  const { groups, warnings } = await fetchLiveGroups({ refreshKey, fetchImpl, targets });
  const liveCount = groups.tech.length + groups.books.length + groups.news.length;

  if (liveCount < Math.min(4, targets.tech + targets.books + targets.news)) {
    throw new Error("Live refresh returned too few usable items");
  }

  const filledGroups = {
    tech: fillGroup(groups.tech, "tech", targets.tech, refreshKey),
    books: fillGroup(groups.books, "books", targets.books, refreshKey),
    news: fillGroup(groups.news, "news", targets.news, refreshKey)
  };
  const plan = buildGroupPlan(targets);
  const used = { tech: 0, books: 0, news: 0 };
  const items = [];
  let contentIndex = 0;

  for (let offset = 0; offset < size; offset += 1) {
    const sequence = start + offset;
    if (sequence > 0 && sequence % FOCUS_INTERVAL === 0) {
      items.push(makeFocusItem(sequence));
      continue;
    }

    const group = plan[contentIndex];
    const card = filledGroups[group][used[group]];
    used[group] += 1;
    contentIndex += 1;
    items.push(withSequence(card, sequence, group, refreshKey));
  }

  return {
    items,
    nextCursor: start + size,
    limit: size,
    generatedAt: new Date().toISOString(),
    focusInterval: FOCUS_INTERVAL,
    source: "live refresh",
    provider: "public-web",
    sources: ["google-books", "google-news-rss", "hacker-news", "stooq"],
    composition: {
      [SOURCE_GROUPS.tech]: targets.tech,
      [SOURCE_GROUPS.books]: targets.books,
      [SOURCE_GROUPS.news]: targets.news
    },
    ...(warnings.length ? { warning: warnings.join("; ") } : {})
  };
}

export async function makeRefreshedFeed({ cursor = 0, limit = DEFAULT_LIMIT, refreshKey = "", query = {}, internetProvider = resolveInternetProvider(query), fetchImpl = fetch } = {}) {
  const key = refreshKey || query.refreshKey || query.nonce || new Date().toISOString();

  if (internetProvider !== "off") {
    try {
      return await makeLiveRefreshFeed({ cursor, limit, refreshKey: key, fetchImpl });
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
