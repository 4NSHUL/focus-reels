const STORE_KEY = "focus-reels-state-v1";
const FOCUS_INTERVAL = 18;
const BATCH_SIZE = 100;
const SESSION_LIMIT_MS = 10 * 60 * 1000;
const SESSION_TICK_MS = 1000;
const MUSIC_STEPS = [
  { note: 196.0, accent: true },
  { note: 246.94 },
  { note: 293.66 },
  { note: 246.94 },
  { note: 220.0, accent: true },
  { note: 261.63 },
  { note: 329.63 },
  { note: 261.63 },
  { note: 174.61, accent: true },
  { note: 220.0 },
  { note: 261.63 },
  { note: 220.0 },
  { note: 196.0, accent: true },
  { note: 246.94 },
  { note: 293.66 },
  { note: 392.0 }
];
const spinLabels = [
  "30 second drill",
  "debug mode",
  "architect mode",
  "interview speedrun",
  "shipping check",
  "offline round"
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadStoredState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return {
      answers: stored.answers || {},
      liked: stored.liked || {},
      reads: stored.reads || {},
      saved: stored.saved || {},
      stats: {
        xp: stored.stats?.xp || 0,
        streak: stored.stats?.streak || 0,
        seen: stored.stats?.seen || 0,
        maxIndex: stored.stats?.maxIndex ?? -1
      }
    };
  } catch {
    return {
      answers: {},
      liked: {},
      reads: {},
      saved: {},
      stats: {
        xp: 0,
        streak: 0,
        seen: 0,
        maxIndex: -1
      }
    };
  }
}

function sceneMarkup(item) {
  const visual = item.visual || "product";
  return `
    <div class="scene visual-${escapeHtml(visual || "product")}">
      <div class="scene-grid"></div>
    </div>
  `;
}

function topVisualMarkup(item) {
  const art = item.art || "generic";
  return `
    <div class="header-visual" aria-hidden="true">
      <img class="header-art" src="/assets/abstract-${escapeHtml(art)}.svg" alt="" loading="lazy">
    </div>
  `;
}

function formatSessionTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function railIconMarkup(name) {
  const icons = {
    like: `
      <svg viewBox="0 0 24 24" role="img" focusable="false">
        <path class="icon-fill" d="M12 21s-7.2-4.6-9.5-9.1C.7 8.5 2.6 4.5 6.4 4.1c2-.2 3.6.7 4.6 2.1 1-1.4 2.6-2.3 4.6-2.1 3.8.4 5.7 4.4 3.9 7.8C19.2 16.4 12 21 12 21Z"></path>
      </svg>
    `,
    save: `
      <svg viewBox="0 0 24 24" role="img" focusable="false">
        <path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-3.8-6 3.8v-15a1 1 0 0 1 1-1Z"></path>
      </svg>
    `,
    share: `
      <svg viewBox="0 0 24 24" role="img" focusable="false">
        <path d="M8.5 12.5 15.5 8"></path>
        <path d="M8.5 12.5 15.5 16"></path>
        <circle cx="6.5" cy="13" r="2.4"></circle>
        <circle cx="17.5" cy="7" r="2.4"></circle>
        <circle cx="17.5" cy="17" r="2.4"></circle>
      </svg>
    `,
    refresh: `
      <svg viewBox="0 0 24 24" role="img" focusable="false">
        <path d="M20 11a8 8 0 0 0-14.1-5.2"></path>
        <path d="M6 3v4.8h4.8"></path>
        <path d="M4 13a8 8 0 0 0 14.1 5.2"></path>
        <path d="M18 21v-4.8h-4.8"></path>
      </svg>
    `,
    music: `
      <svg viewBox="0 0 24 24" role="img" focusable="false">
        <path d="M9 18.5a2.7 2.7 0 1 1-2.7-2.7H9V5.5l9-1.8v11.8"></path>
        <path d="M18 15.5a2.7 2.7 0 1 1-2.7-2.7H18"></path>
        <path d="M9 8.5 18 6.7"></path>
      </svg>
    `
  };

  return `<span class="rail-icon" aria-hidden="true">${icons[name] || icons.like}</span>`;
}

class FocusReelsApp extends HTMLElement {
  constructor() {
    super();
    const stored = loadStoredState();

    this.items = [];
    this.seeds = [];
    this.answers = stored.answers;
    this.liked = stored.liked;
    this.reads = stored.reads;
    this.saved = stored.saved;
    this.stats = stored.stats;
    this.currentIndex = 0;
    this.nextCursor = 0;
    this.loading = false;
    this.refreshing = false;
    this.paused = false;
    this.locked = false;
    this.online = navigator.onLine;
    this.source = "starting";
    this.progress = 0;
    this.sessionElapsedMs = 0;
    this.lastSessionTick = Date.now();
    this.scrollFrame = 0;
    this.progressTimer = 0;
    this.sessionTimer = 0;
    this.audioOn = false;
    this.audioContext = null;
    this.audioMaster = null;
    this.audioFilter = null;
    this.audioTimer = 0;
    this.audioStep = 0;

    this.onScroll = this.onScroll.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  connectedCallback() {
    this.innerHTML = `
      <main class="app-shell" aria-label="Focus Reels app">
        <header class="top-hud">
          <div class="brand-lockup">
            <div class="brand-mark" aria-hidden="true">FR</div>
            <div class="brand-copy">
              <strong>Focus Reels</strong>
              <span data-hud-subtitle>Loading useful scrolls</span>
            </div>
          </div>
          <div class="stats-strip" aria-label="Progress stats">
            <span class="stat-pill" data-xp>0 XP</span>
            <span class="stat-pill" data-streak>0 streak</span>
            <span class="stat-pill session-pill" title="Session timer" data-session-time>0:00</span>
            <span class="status-pill" data-status>offline ready</span>
          </div>
        </header>
        <section class="reels" data-feed aria-live="polite"></section>
        <aside class="work-lock" data-work-lock>
          <div class="work-panel">
            <h2>Back to work?</h2>
            <p data-work-message>You have spent 10 minutes in this session. Close this loop now, or take one more intentional set.</p>
            <div class="work-actions">
              <button class="primary-action" type="button" data-action="stay-locked">Keep me stopped</button>
              <button class="secondary-action" type="button" data-action="resume-set">One more set</button>
            </div>
          </div>
        </aside>
      </main>
    `;

    this.feedEl = this.querySelector("[data-feed]");
    this.lockEl = this.querySelector("[data-work-lock]");
    this.feedEl.addEventListener("scroll", this.onScroll, { passive: true });
    this.feedEl.addEventListener("click", this.onClick);
    this.feedEl.addEventListener("mousedown", this.onMouseDown);
    this.lockEl.addEventListener("click", this.onClick);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("online", () => {
      this.online = true;
      this.updateHud();
      this.loadMore();
    });
    window.addEventListener("offline", () => {
      this.online = false;
      this.updateHud();
    });

    this.boot();
  }

  disconnectedCallback() {
    this.feedEl?.removeEventListener("scroll", this.onScroll);
    this.feedEl?.removeEventListener("click", this.onClick);
    this.feedEl?.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("keydown", this.onKeyDown);
    window.clearInterval(this.progressTimer);
    window.clearInterval(this.sessionTimer);
  }

  async boot() {
    this.renderLoading();
    await this.registerServiceWorker();
    await this.loadSeeds();
    await this.loadMore();
    this.renderFeed();
    this.startProgressLoop();
    this.startSessionTimer();
  }

  async registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch {
      this.source = "offline seed";
    }
  }

  async loadSeeds() {
    const response = await fetch("/feed-seeds.json", { cache: "force-cache" });
    this.seeds = await response.json();
  }

  async loadMore() {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.updateHud();

    try {
      const response = await fetch(`/api/feed?cursor=${this.nextCursor}&limit=${BATCH_SIZE}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Feed request failed");
      }

      const payload = await response.json();
      this.items.push(...payload.items);
      this.nextCursor = payload.nextCursor;
      this.source = "online batch";
    } catch {
      const batch = this.makeOfflineBatch(BATCH_SIZE);
      this.items.push(...batch.items);
      this.nextCursor = batch.nextCursor;
      this.source = "offline batch";
    } finally {
      this.loading = false;
      this.updateHud();
    }
  }

  async refreshContent() {
    if (this.loading || this.refreshing) {
      return;
    }

    const refreshKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.loading = true;
    this.refreshing = true;
    this.source = "refreshing";
    this.updateHud();

    try {
      const response = await fetch(`/api/feed?cursor=0&limit=${BATCH_SIZE}&refresh=1&llm=auto&refreshKey=${encodeURIComponent(refreshKey)}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Refresh request failed");
      }

      const payload = await response.json();
      this.items = payload.items;
      this.nextCursor = payload.nextCursor;
      this.currentIndex = 0;
      this.progress = 0;
      this.source = payload.source || "fresh batch";
    } catch {
      this.nextCursor = Math.floor(Date.now() / 1000) % 10000;
      const batch = this.makeOfflineBatch(BATCH_SIZE);
      this.items = batch.items;
      this.nextCursor = batch.nextCursor;
      this.currentIndex = 0;
      this.progress = 0;
      this.source = "offline refresh";
    } finally {
      this.loading = false;
      this.refreshing = false;
      this.feedEl.scrollTop = 0;
      this.renderFeed();
      this.updateHud();
    }
  }

  makeOfflineBatch(limit) {
    const start = this.nextCursor;
    const items = Array.from({ length: limit }, (_, offset) => {
      const sequence = start + offset;

      if (sequence > 0 && sequence % FOCUS_INTERVAL === 0) {
        return {
          id: `offline-focus-check-${sequence}`,
          type: "focus",
          category: "Focus Reset",
          visual: "focus",
          difficulty: "healthy",
          title: "Back To Work Check",
          hook: "You have been scrolling for a while.",
          body: "Pause for ten seconds. If you came here as a break, close the loop and return to the real task.",
          choices: ["Back to work", "One more focused set"],
          answerIndex: 0,
          explanation: "Healthy scrolling should create energy, not steal the session.",
          xp: 8,
          tags: ["focus", "reset"],
          sequence
        };
      }

      const seed = this.seeds[sequence % this.seeds.length];
      const cycle = Math.floor(sequence / this.seeds.length);
      const spin = spinLabels[sequence % spinLabels.length];
      return {
        ...seed,
        id: `${seed.id}-offline-${sequence}`,
        seedId: seed.id,
        sequence,
        title: cycle === 0 ? seed.title : `${seed.title} ${cycle + 1}`,
        hook: `${seed.hook} (${spin})`
      };
    });

    return {
      items,
      nextCursor: start + limit
    };
  }

  renderLoading() {
    this.feedEl.innerHTML = `
      <article class="loading-reel">
        <p>Preparing 100 useful scrolls...</p>
      </article>
    `;
  }

  renderFeed(preserveScroll = false) {
    const scrollTop = this.feedEl.scrollTop;
    this.feedEl.innerHTML = this.items.map((item, index) => this.renderReel(item, index)).join("");

    if (preserveScroll) {
      requestAnimationFrame(() => {
        this.feedEl.scrollTop = scrollTop;
        this.syncActiveReel();
      });
    } else {
      this.syncActiveReel();
    }
  }

  renderReel(item, index) {
    const answer = this.answers[item.id];
    const hasAnswer = Number.isInteger(answer);
    const liked = Boolean(this.liked[item.id]);
    const saved = Boolean(this.saved[item.id]);
    const isRead = item.type === "read" || !item.choices?.length;
    const readDone = Boolean(this.reads[item.id]);
    const choices = isRead ? "" : (item.choices || []).map((choice, choiceIndex) => {
      const resultClass = hasAnswer && choiceIndex === item.answerIndex
        ? " is-correct"
        : hasAnswer && choiceIndex === answer
          ? " is-wrong"
          : "";
      return `
        <button
          class="choice-button${resultClass}"
          type="button"
          data-action="${item.type === "focus" ? "focus-choice" : "answer"}"
          data-item-id="${escapeHtml(item.id)}"
          data-choice-index="${choiceIndex}">
          ${escapeHtml(choice)}
        </button>
      `;
    }).join("");

    const explanation = hasAnswer
      ? `<p class="explanation">${escapeHtml(item.explanation)}</p>`
      : "";
    const readMarkup = isRead ? this.renderReadCard(item, readDone) : `<div class="choice-list">${choices}</div>`;

    return `
      <article class="reel" id="reel-${escapeHtml(item.sequence)}" data-index="${index}" data-item-id="${escapeHtml(item.id)}">
        ${sceneMarkup(item)}
        <div class="pause-badge" aria-hidden="true">Paused</div>
        ${topVisualMarkup(item)}
        <div class="reel-content">
          <div class="content-stack">
            <div class="category-row">
              <span class="category-chip">${escapeHtml(item.category)}</span>
              <span class="difficulty-chip">${escapeHtml(item.difficulty)}</span>
            </div>
            <h1 class="reel-title">${escapeHtml(item.title)}</h1>
            <p class="reel-hook">${escapeHtml(item.hook)}</p>
            <p class="reel-body">${escapeHtml(item.body)}</p>
            ${readMarkup}
            ${explanation}
          </div>
        </div>
        <nav class="right-rail" aria-label="Reel actions">
          <button class="rail-button${liked ? " is-active" : ""}" type="button" title="Like" aria-label="Like reel" data-rail="like" data-action="like" data-item-id="${escapeHtml(item.id)}">
            ${railIconMarkup("like")}
          </button>
          <button class="rail-button${saved ? " is-active" : ""}" type="button" title="Save" aria-label="Save reel" data-rail="save" data-action="save" data-item-id="${escapeHtml(item.id)}">
            ${railIconMarkup("save")}
          </button>
          <button class="rail-button" type="button" title="Share" aria-label="Copy link" data-rail="share" data-action="share" data-item-id="${escapeHtml(item.id)}">
            ${railIconMarkup("share")}
          </button>
          <button class="rail-button${this.refreshing ? " is-active" : ""}" type="button" title="Refresh content" aria-label="Refresh content" data-rail="refresh" data-action="refresh">
            ${railIconMarkup("refresh")}
          </button>
          <button class="rail-button${this.audioOn ? " is-active" : ""}" type="button" title="Music" aria-label="Toggle focus music" data-rail="music" data-action="music">
            ${railIconMarkup("music")}
          </button>
        </nav>
        <div class="progress-track" aria-hidden="true"><div class="progress-fill"></div></div>
      </article>
    `;
  }

  renderReadCard(item, readDone) {
    const points = (item.points || []).map((point) => `<li>${escapeHtml(point)}</li>`).join("");
    const pointMarkup = points ? `<ul class="read-points">${points}</ul>` : "";
    const reflection = item.reflection
      ? `<p class="read-reflection">${escapeHtml(item.reflection)}</p>`
      : "";
    const buttonText = readDone ? "READ DONE" : `MARK READ +${item.xp || 8}`;

    return `
      <section class="read-card" aria-label="Short read">
        ${pointMarkup}
        ${reflection}
        <button class="read-button${readDone ? " is-complete" : ""}" type="button" data-action="mark-read" data-item-id="${escapeHtml(item.id)}">
          ${escapeHtml(buttonText)}
        </button>
      </section>
    `;
  }

  onClick(event) {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      if (event.target.closest(".reel")) {
        this.togglePaused();
      }
      return;
    }

    const action = actionTarget.dataset.action;
    const itemId = actionTarget.dataset.itemId;

    if (action === "answer") {
      this.answerReel(itemId, Number.parseInt(actionTarget.dataset.choiceIndex, 10));
    }

    if (action === "mark-read") {
      this.markRead(itemId);
    }

    if (action === "focus-choice") {
      const choiceIndex = Number.parseInt(actionTarget.dataset.choiceIndex, 10);
      this.answerReel(itemId, choiceIndex);
      if (choiceIndex === 0) {
        this.lockForWork("focus");
      } else {
        this.scrollToIndex(this.currentIndex + 1);
      }
    }

    if (action === "like") {
      this.toggleMapValue(this.liked, itemId);
    }

    if (action === "save") {
      this.toggleMapValue(this.saved, itemId);
    }

    if (action === "share") {
      this.copyCurrentLink(itemId);
    }

    if (action === "refresh") {
      this.refreshContent();
    }

    if (action === "music") {
      this.toggleMusic();
    }

    if (action === "resume-set") {
      this.unlockForOneMoreSet();
    }

    if (action === "stay-locked") {
      this.paused = true;
      this.updateHud();
    }
  }

  onMouseDown(event) {
    if (event.button === 1 && event.target.closest(".reel")) {
      event.preventDefault();
      this.togglePaused();
    }
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (key === " " || key === "k") {
      event.preventDefault();
      this.togglePaused();
      return;
    }

    if (key === "arrowdown" || key === "j") {
      event.preventDefault();
      this.scrollToIndex(this.currentIndex + 1);
      return;
    }

    if (key === "arrowup") {
      event.preventDefault();
      this.scrollToIndex(this.currentIndex - 1);
    }
  }

  onScroll() {
    if (this.scrollFrame) {
      return;
    }

    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.syncActiveReel();
    });
  }

  syncActiveReel() {
    const height = this.feedEl.clientHeight || window.innerHeight || 1;
    const index = Math.max(0, Math.min(this.items.length - 1, Math.round(this.feedEl.scrollTop / height)));

    if (index !== this.currentIndex) {
      this.currentIndex = index;
      this.progress = 0;

      if (index > this.stats.maxIndex) {
        this.stats.maxIndex = index;
        this.stats.seen += 1;
        this.saveState();
      }

      if (this.items.length - index < 25) {
        this.loadMore().then(() => this.renderFeed(true));
      }
    }

    this.feedEl.querySelectorAll(".reel").forEach((reel) => {
      reel.classList.toggle("is-paused", this.paused);
      reel.toggleAttribute("data-active", Number.parseInt(reel.dataset.index, 10) === this.currentIndex);
    });
    this.updateProgressBar();
    this.updateHud();
  }

  answerReel(itemId, choiceIndex) {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (!item || Number.isInteger(this.answers[itemId])) {
      return;
    }

    const correct = choiceIndex === item.answerIndex;
    this.answers[itemId] = choiceIndex;
    this.stats.xp += correct ? item.xp : Math.max(3, Math.round(item.xp / 3));
    this.stats.streak = correct ? this.stats.streak + 1 : 0;
    this.saveState();
    this.renderFeed(true);
  }

  markRead(itemId) {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (!item || this.reads[itemId]) {
      return;
    }

    this.reads[itemId] = true;
    this.stats.xp += item.xp || 8;
    this.source = "read saved";
    this.saveState();
    this.renderFeed(true);
  }

  toggleMapValue(map, itemId) {
    map[itemId] = !map[itemId];
    if (!map[itemId]) {
      delete map[itemId];
    }
    this.saveState();
    this.renderFeed(true);
  }

  async copyCurrentLink(itemId) {
    const item = this.items.find((candidate) => candidate.id === itemId);
    const url = `${location.origin}${location.pathname}#reel-${item?.sequence || this.currentIndex}`;

    try {
      await navigator.clipboard.writeText(url);
      this.source = "link copied";
    } catch {
      this.source = "copy blocked";
    }

    this.updateHud();
  }

  scrollToIndex(index) {
    const bounded = Math.max(0, Math.min(this.items.length - 1, index));
    const height = this.feedEl.clientHeight || window.innerHeight || 1;
    this.feedEl.scrollTo({
      top: bounded * height,
      behavior: "smooth"
    });
  }

  togglePaused() {
    this.paused = !this.paused;
    this.syncAudioState();
    this.syncActiveReel();
  }

  lockForWork(reason = "timer") {
    if (this.locked) {
      return;
    }

    this.locked = true;
    this.paused = true;
    this.source = reason === "timer" ? "10 min check" : "focus check";
    const message = this.querySelector("[data-work-message]");
    if (message) {
      message.textContent = reason === "timer"
        ? "You have spent 10 minutes in this session. Close this loop now, or take one more intentional set."
        : "You reached a focus checkpoint. Close this loop now, or take one more intentional set.";
    }
    this.lockEl.classList.add("is-visible");
    this.syncAudioState();
    this.updateHud();
  }

  unlockForOneMoreSet() {
    this.locked = false;
    this.paused = false;
    this.sessionElapsedMs = 0;
    this.lastSessionTick = Date.now();
    this.source = "next 10 min";
    this.lockEl.classList.remove("is-visible");
    this.syncAudioState();
    this.updateHud();
  }

  async toggleMusic() {
    if (this.audioOn) {
      this.audioOn = false;
      this.stopAudioLoop();
      this.source = "music off";
      this.renderFeed(true);
      return;
    }

    if (!this.ensureAudioGraph()) {
      return;
    }

    if (this.paused && !this.locked) {
      this.paused = false;
    }

    this.audioOn = true;
    this.source = "music on";
    await this.syncAudioState();
    this.playStartCue();
    this.startAudioLoop();
    this.renderFeed(true);
  }

  ensureAudioGraph() {
    if (this.audioContext) {
      return true;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      this.source = "audio unsupported";
      this.updateHud();
      return false;
    }

    this.audioContext = new AudioContextClass();
    this.audioMaster = this.audioContext.createGain();
    this.audioFilter = this.audioContext.createBiquadFilter();
    this.audioFilter.type = "lowpass";
    this.audioFilter.frequency.value = 2600;
    this.audioFilter.Q.value = 0.72;
    this.audioMaster.gain.value = 0.34;
    this.audioFilter.connect(this.audioMaster);
    this.audioMaster.connect(this.audioContext.destination);
    return true;
  }

  startAudioLoop() {
    if (this.audioTimer || !this.audioContext || !this.audioOn) {
      return;
    }

    this.scheduleAudioStep();
    this.audioTimer = window.setInterval(() => this.scheduleAudioStep(), 360);
  }

  stopAudioLoop() {
    if (this.audioTimer) {
      window.clearInterval(this.audioTimer);
      this.audioTimer = 0;
    }

    if (this.audioContext?.state === "running") {
      this.audioContext.suspend();
    }

    this.updateHud();
  }

  async syncAudioState() {
    if (!this.audioContext || !this.audioOn) {
      return;
    }

    if (this.paused || this.locked) {
      if (this.audioContext.state === "running") {
        await this.audioContext.suspend();
      }
      return;
    }

    if (this.audioContext.state !== "running") {
      await this.audioContext.resume();
    }
  }

  scheduleAudioStep() {
    if (!this.audioContext || !this.audioFilter || !this.audioOn || this.paused || this.locked) {
      return;
    }

    const now = this.audioContext.currentTime;
    const step = MUSIC_STEPS[this.audioStep % MUSIC_STEPS.length];
    this.audioStep += 1;
    this.playTone(step.note, now, step.accent ? 0.34 : 0.22, 0.32, "triangle");

    if (step.accent) {
      this.playTone(step.note / 2, now, 0.26, 0.44, "sine");
      this.playKick(now);
    }

    if (this.audioStep % 2 === 0) {
      this.playTick(now + 0.16);
    }
  }

  playStartCue() {
    if (!this.audioContext || this.audioContext.state !== "running") {
      return;
    }

    const now = this.audioContext.currentTime + 0.02;
    this.playTone(261.63, now, 0.36, 0.22, "triangle");
    this.playTone(329.63, now + 0.05, 0.3, 0.24, "triangle");
    this.playTone(392.0, now + 0.1, 0.28, 0.28, "sine");
    this.playKick(now);
  }

  playTone(frequency, startTime, peakGain, duration, type) {
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.detune.setValueAtTime((this.currentIndex % 5) * 2, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(this.audioFilter);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.04);
  }

  playKick(startTime) {
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(96, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(46, startTime + 0.16);
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);
    oscillator.connect(gain);
    gain.connect(this.audioMaster);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
  }

  playTick(startTime) {
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(1480, startTime);
    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);
    oscillator.connect(gain);
    gain.connect(this.audioMaster);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.04);
  }

  startProgressLoop() {
    if (this.progressTimer) {
      return;
    }

    this.progressTimer = window.setInterval(() => {
      if (!this.paused && !this.locked) {
        this.progress = (this.progress + 2) % 100;
        this.updateProgressBar();
      }
    }, 300);
  }

  startSessionTimer() {
    if (this.sessionTimer) {
      return;
    }

    this.lastSessionTick = Date.now();
    this.sessionTimer = window.setInterval(() => this.tickSessionTimer(), SESSION_TICK_MS);
    this.updateHud();
  }

  tickSessionTimer() {
    const now = Date.now();
    const delta = now - this.lastSessionTick;
    this.lastSessionTick = now;

    if (document.hidden || this.locked) {
      this.updateHud();
      return;
    }

    this.sessionElapsedMs += Math.min(delta, SESSION_TICK_MS * 2);

    if (this.sessionElapsedMs >= SESSION_LIMIT_MS) {
      this.sessionElapsedMs = SESSION_LIMIT_MS;
      this.lockForWork("timer");
      return;
    }

    this.updateHud();
  }

  updateProgressBar() {
    const active = this.feedEl.querySelector('.reel[data-active] .progress-fill');
    if (active) {
      active.style.width = `${this.progress}%`;
    }
  }

  updateHud() {
    const subtitle = this.querySelector("[data-hud-subtitle]");
    const xp = this.querySelector("[data-xp]");
    const streak = this.querySelector("[data-streak]");
    const sessionTime = this.querySelector("[data-session-time]");
    const status = this.querySelector("[data-status]");

    if (subtitle) {
      subtitle.textContent = `${this.items.length || 0} loaded - ${this.stats.seen} seen`;
    }
    if (xp) {
      xp.textContent = `${this.stats.xp} XP`;
    }
    if (streak) {
      streak.textContent = `${this.stats.streak} streak`;
    }
    if (sessionTime) {
      sessionTime.textContent = formatSessionTime(this.sessionElapsedMs);
    }
    if (status) {
      if (this.refreshing) {
        status.textContent = "refreshing";
      } else if (this.loading) {
        status.textContent = "loading";
      } else if (!this.online) {
        status.textContent = "offline";
      } else {
        status.textContent = this.source;
      }
    }
  }

  saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      answers: this.answers,
      liked: this.liked,
      reads: this.reads,
      saved: this.saved,
      stats: this.stats
    }));
  }
}

customElements.define("focus-reels-app", FocusReelsApp);
