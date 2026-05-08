import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeFeed, makeRefreshedFeed } from "../api/feed.js";

test("feed returns the next 100 playable reels by default", () => {
  const feed = makeFeed({ cursor: 0 });

  assert.equal(feed.items.length, 100);
  assert.equal(feed.nextCursor, 100);
  assert.equal(new Set(feed.items.map((item) => item.id)).size, 100);
});

test("feed caps requested batches at 100 items", () => {
  const feed = makeFeed({ cursor: 5, limit: 250 });

  assert.equal(feed.items.length, 100);
  assert.equal(feed.nextCursor, 105);
});

test("feed includes focus resets during long scroll sessions", () => {
  const feed = makeFeed({ cursor: 0, limit: 40 });
  const focusItems = feed.items.filter((item) => item.type === "focus");

  assert.ok(focusItems.length >= 2);
  assert.equal(focusItems[0].sequence, 18);
  assert.equal(focusItems[0].choices[0], "Back to work");
});

test("feed keeps a mixed category rotation", () => {
  const feed = makeFeed({ cursor: 0, limit: 30 });
  const categories = new Set(feed.items.map((item) => item.category));

  assert.ok(categories.has("AI Agents"));
  assert.ok(categories.has("Software Engineering"));
  assert.ok(categories.has("Puzzles"));
  assert.ok(categories.has("Book Summaries"));
  assert.ok(categories.has("Stock Market"));
});

test("feed includes passive read cards without forcing a quiz", () => {
  const feed = makeFeed({ cursor: 0, limit: 30 });
  const readItems = feed.items.filter((item) => item.type === "read");

  assert.ok(readItems.length >= 3);
  assert.ok(readItems.some((item) => !item.choices));
  assert.ok(readItems.every((item) => item.points?.length || item.body));
});

test("feed items can carry abstract art assets", () => {
  const feed = makeFeed({ cursor: 0, limit: 12 });

  assert.ok(feed.items.some((item) => item.art));
});

test("refresh remix returns a fresh 100-item compatible feed when live sources are disabled", async () => {
  const normal = makeFeed({ cursor: 0, limit: 24 });
  const refreshed = await makeRefreshedFeed({
    cursor: 0,
    limit: 24,
    refreshKey: "fresh-local-test",
    query: { internet: "off" }
  });

  assert.equal(refreshed.items.length, 24);
  assert.equal(refreshed.nextCursor, 24);
  assert.equal(refreshed.source, "fresh remix");
  assert.notDeepEqual(
    refreshed.items.map((item) => item.seedId || item.id),
    normal.items.map((item) => item.seedId || item.id)
  );
});

test("refresh remix keeps focus checkpoints in long batches", async () => {
  const refreshed = await makeRefreshedFeed({
    cursor: 0,
    limit: 40,
    refreshKey: "focus-refresh-test",
    query: { internet: "off" }
  });

  const focusItems = refreshed.items.filter((item) => item.type === "focus");
  assert.ok(focusItems.length >= 2);
  assert.equal(focusItems[0].sequence, 18);
});

test("live refresh falls back to local remix when public sources fail", async () => {
  const refreshed = await makeRefreshedFeed({
    cursor: 0,
    limit: 12,
    refreshKey: "live-failure",
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
      text: async () => ""
    })
  });

  assert.equal(refreshed.items.length, 12);
  assert.equal(refreshed.source, "fresh remix");
  assert.match(refreshed.warning, /Live refresh returned too few usable items|Request failed/);
});

test("live refresh builds the requested content mix from public-style APIs", async () => {
  const fakeFetch = async (url) => {
    const value = String(url);

    if (value.includes("googleapis.com/books")) {
      const query = new URL(value).searchParams.get("q") || "Book";
      return {
        ok: true,
        json: async () => ({
          items: Array.from({ length: 5 }, (_, index) => ({
            volumeInfo: {
              title: `${query} Volume ${index + 1}`,
              authors: [`Author ${index + 1}`],
              publishedDate: `202${index}-01-05`,
              description: `${query} explains a practical idea for better attention, clearer choices, and stronger execution.`,
              categories: ["Attention", "Productivity", "Work"],
              previewLink: `https://example.com/books/${encodeURIComponent(query)}-${index}`
            }
          }))
        })
      };
    }

    if (value.includes("news.google.com/rss")) {
      const query = new URL(value).searchParams.get("q") || "news";
      const isTech = query.includes("software") || query.includes("AI agents");
      const titles = Array.from({ length: 12 }, (_, index) => {
        return isTech
          ? `AI agents improve developer workflow ${index + 1}`
          : index % 2 === 0
            ? `Stock market watches Nvidia and Federal Reserve ${index + 1}`
            : `Hot technology topic shapes travel and economy ${index + 1}`;
      });
      return {
        ok: true,
        text: async () => `<rss><channel>${titles.map((title, index) => `
          <item>
            <title>${title}</title>
            <link>https://example.com/news/${index}</link>
            <description>${title} is moving quickly and needs a careful reading.</description>
            <source>Example News</source>
            <pubDate>Fri, 08 May 2026 10:00:00 GMT</pubDate>
          </item>
        `).join("")}</channel></rss>`
      };
    }

    if (value.endsWith("/newstories.json")) {
      return {
        ok: true,
        json: async () => [101, 102, 103, 104]
      };
    }

    const id = Number(value.match(/item\/(\d+)\.json/)?.[1]);
    const stories = {
      101: { id: 101, type: "story", title: "AI agents are changing code review", url: "https://example.com/agents" },
      102: { id: 102, type: "story", title: "Database cache outage postmortem", url: "https://example.com/cache" },
      103: { id: 103, type: "story", title: "Graph algorithm puzzle for interviews", url: "https://example.com/graph" },
      104: { id: 104, type: "story", title: "Stock market risk models explained", url: "https://example.com/market" }
    };

    return {
      ok: true,
      json: async () => stories[id]
    };
  };

  const refreshed = await makeRefreshedFeed({
    cursor: 0,
    limit: 100,
    refreshKey: "live-refresh-test",
    fetchImpl: fakeFetch
  });
  const contentItems = refreshed.items.filter((item) => item.type !== "focus");
  const counts = contentItems.reduce((totals, item) => {
    totals[item.sourceGroup] = (totals[item.sourceGroup] || 0) + 1;
    return totals;
  }, {});
  const bookItems = contentItems.filter((item) => item.sourceGroup === "books");

  assert.equal(refreshed.items.length, 100);
  assert.equal(refreshed.source, "live refresh");
  assert.equal(counts["ai-tech"], 19);
  assert.equal(counts.books, 29);
  assert.equal(counts["news-market"], 47);
  assert.ok(contentItems.some((item) => item.hook.includes("AI agents")));
  assert.ok(contentItems.some((item) => item.category === "Stock Market"));
  assert.ok(bookItems.every((item) => (item.body.match(/[.!?]+(?=\s|$)/g) || []).length >= 5));
});

test("refresh source code has no model-provider refresh support", async () => {
  const [apiSource, readme, appSource] = await Promise.all([
    readFile(new URL("../api/feed.js", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8")
  ]);
  const combined = `${apiSource}\n${readme}\n${appSource}`;

  assert.doesNotMatch(combined, /OLLAMA|HF_TOKEN|Hugging|llm=|FOCUS_REELS_LLM/i);
});
