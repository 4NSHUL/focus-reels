import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test("right rail does not expose a manual focus shortcut", () => {
  assert.equal(appSource.includes('data-action="focus-now"'), false);
  assert.equal(appSource.includes('data-rail="work"'), false);
});

test("session timer drives the back-to-work popup", () => {
  assert.ok(appSource.includes("const SESSION_LIMIT_MS = 10 * 60 * 1000"));
  assert.ok(appSource.includes("data-session-time"));
  assert.ok(appSource.includes('this.lockForWork("timer")'));
});
