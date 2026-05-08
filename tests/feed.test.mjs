import test from "node:test";
import assert from "node:assert/strict";
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

test("refresh remix returns a fresh 100-item compatible feed without an llm", async () => {
  const normal = makeFeed({ cursor: 0, limit: 24 });
  const refreshed = await makeRefreshedFeed({
    cursor: 0,
    limit: 24,
    refreshKey: "fresh-local-test",
    allowLlm: false
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
    allowLlm: false
  });

  const focusItems = refreshed.items.filter((item) => item.type === "focus");
  assert.ok(focusItems.length >= 2);
  assert.equal(focusItems[0].sequence, 18);
});

test("vercel refresh falls back when no hosted llm token is configured", async () => {
  const originalVercel = process.env.VERCEL;
  const originalToken = process.env.HF_TOKEN;
  process.env.VERCEL = "1";
  delete process.env.HF_TOKEN;

  try {
    const refreshed = await makeRefreshedFeed({
      cursor: 0,
      limit: 12,
      refreshKey: "vercel-no-token",
      query: { llm: "auto" }
    });

    assert.equal(refreshed.items.length, 12);
    assert.equal(refreshed.source, "fresh remix");
    assert.equal(refreshed.warning, undefined);
  } finally {
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }

    if (originalToken === undefined) {
      delete process.env.HF_TOKEN;
    } else {
      process.env.HF_TOKEN = originalToken;
    }
  }
});
