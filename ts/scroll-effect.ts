/**
 * ============================================
 * autofoliewrap.cz — Car Wrapping Scroll Effect
 * ============================================
 *
 * A scroll-scrubbed frame sequence drawn to a canvas.
 *
 * Design notes
 * ------------
 *  1. PROGRESSIVE, NON-BLOCKING LOADING. The section becomes usable as
 *     soon as the *first* frame has decoded; the remaining frames stream
 *     in behind it with a small concurrency window. Whatever is not in
 *     yet falls back to the nearest frame that is, so scrubbing works
 *     immediately and simply gets smoother as the sequence fills.
 *
 *     The previous implementation raced the preload against a 6s timeout
 *     and then did `await loadPromise` anyway, which cancelled the race
 *     out — so the overlay actually waited for all 60 frames (6.4 MB)
 *     with no escape hatch at all.
 *
 *  2. RESPONSIVE SOURCES. Narrow viewports get assets/frames/sm/ (854px,
 *     ~1.4 MB for the sequence) instead of the 1920px set (~6.4 MB).
 *
 *  3. REDUCED MOTION. With prefers-reduced-motion the section does not
 *     pin or scrub at all: it renders one representative still and the
 *     page scrolls normally past it.
 *
 *  4. No GSAP. The importmap that used to sit in index.html pointed at
 *     gsap + ScrollTrigger but nothing ever imported them, so it loaded
 *     nothing. Scrubbing is a rAF-throttled native scroll listener.
 *
 * Swapping in different footage
 * -----------------------------
 *   Drop a video at assets/video/source.mp4 and run `npm run frames`.
 *   See scripts/generate-frames-from-video.mjs.
 * ============================================
 */

// ─── Types ─────────────────────────────────────────────────────────

interface ScrollEffectConfig {
  /** Total number of frames in the sequence (1-based indexing) */
  readonly totalFrames: number;
  /** Directory holding the full-size frames, with trailing slash */
  readonly framePath: string;
  /** Directory holding the reduced-size frames, with trailing slash */
  readonly framePathSmall: string;
  /** Viewport width at or below which the small set is used */
  readonly smallBreakpoint: number;
  /** How many frame requests may be in flight at once */
  readonly concurrency: number;
  /** File extension for frame images */
  readonly frameExt: string;
}

interface ScrollEffectState {
  /** Loaded frames, sparse until the sequence finishes streaming */
  frames: (HTMLImageElement | undefined)[];
  /** Number of frames decoded so far */
  loadedCount: number;
  /** Whether the scroll listener has been attached */
  initialized: boolean;
  /** Frame currently painted (1-based) */
  currentFrame: number;
  /** Resolved base path for this viewport */
  basePath: string;
}

// ─── Configuration ─────────────────────────────────────────────────

const CONFIG: ScrollEffectConfig = {
  totalFrames: 60,
  framePath: 'assets/frames/',
  framePathSmall: 'assets/frames/sm/',
  smallBreakpoint: 900,
  concurrency: 6,
  frameExt: 'webp',
};

// ─── DOM ───────────────────────────────────────────────────────────

const canvas = document.getElementById('scrollCanvas') as HTMLCanvasElement | null;
const ctx = canvas?.getContext('2d') ?? null;
const loadingOverlay = document.getElementById('scrollLoading') as HTMLDivElement | null;
const loadingPercent = document.getElementById('loadingPercent') as HTMLSpanElement | null;
const loadingBarFill = document.getElementById('loadingBarFill') as HTMLDivElement | null;
const scrollSection = document.getElementById('scrollEffect') as HTMLElement | null;
const scrollContainer = document.getElementById('scrollContainer') as HTMLDivElement | null;
const scrollFrame = document.getElementById('scrollFrame') as HTMLDivElement | null;
const scrollPct = document.getElementById('scrollPct') as HTMLSpanElement | null;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ─── State ─────────────────────────────────────────────────────────

const state: ScrollEffectState = {
  frames: new Array<HTMLImageElement | undefined>(CONFIG.totalFrames),
  loadedCount: 0,
  initialized: false,
  currentFrame: 1,
  basePath: CONFIG.framePath,
};

// ─── Loading ───────────────────────────────────────────────────────

/** Pick the frame set that suits this viewport. */
function resolveBasePath(): string {
  const narrow = window.innerWidth <= CONFIG.smallBreakpoint;
  // A data-saver connection gets the small set regardless of width.
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
  return narrow || conn?.saveData ? CONFIG.framePathSmall : CONFIG.framePath;
}

function buildFrameUrl(index: number): string {
  return `${state.basePath}car_${index}.${CONFIG.frameExt}`;
}

function loadSingleFrame(index: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Frames are decorative; let the browser deprioritise them so they
    // never compete with the hero image or the stylesheet.
    img.decoding = 'async';
    if ('fetchPriority' in img) {
      (img as HTMLImageElement & { fetchPriority: string }).fetchPriority = 'low';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load frame ${index}`));
    img.src = buildFrameUrl(index);
  });
}

function updateLoadingUI(): void {
  const pct = Math.round((state.loadedCount / CONFIG.totalFrames) * 100);
  if (loadingPercent) loadingPercent.textContent = `${pct}%`;
  if (loadingBarFill) loadingBarFill.style.width = `${pct}%`;
}

function hideLoader(): void {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add('hidden');
  loadingOverlay.setAttribute('aria-hidden', 'true');
}

/**
 * Record a decoded frame. Repaint if it is the one we currently want, or
 * if it is closer to the target than whatever is on screen right now.
 */
function acceptFrame(index: number, img: HTMLImageElement): void {
  state.frames[index - 1] = img;
  state.loadedCount++;
  updateLoadingUI();
  if (index === state.currentFrame) drawFrame(state.currentFrame);
}

/**
 * Stream the sequence with a bounded number of parallel requests.
 * Runs after the first frame is already on screen, so nothing here is
 * on the critical path.
 */
async function streamRemainingFrames(): Promise<void> {
  const queue: number[] = [];
  for (let i = 2; i <= CONFIG.totalFrames; i++) queue.push(i);

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = queue.shift();
      if (index === undefined) return;
      try {
        acceptFrame(index, await loadSingleFrame(index));
      } catch {
        // A missing frame is not fatal — drawFrame falls back to the
        // nearest neighbour that did load.
        state.loadedCount++;
        updateLoadingUI();
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(CONFIG.concurrency, CONFIG.totalFrames - 1) },
    worker,
  );
  await Promise.all(workers);
}

/**
 * Procedural stand-in used only if even the first frame cannot load, so
 * the section never renders as an empty black box.
 */
function createFallbackFrame(): HTMLImageElement {
  const offscreen = document.createElement('canvas');
  offscreen.width = 1920;
  offscreen.height = 1080;
  const octx = offscreen.getContext('2d');

  if (octx) {
    const gradient = octx.createLinearGradient(0, 0, 1920, 1080);
    gradient.addColorStop(0, '#1a161c');
    gradient.addColorStop(1, '#3a2226');
    octx.fillStyle = gradient;
    octx.fillRect(0, 0, 1920, 1080);
  }

  const img = new Image();
  img.src = offscreen.toDataURL('image/png');
  return img;
}

// ─── Rendering ─────────────────────────────────────────────────────

/**
 * Match the canvas backing store to the element's CSS size × DPR.
 * The transform is set fresh in drawFrame, so this no longer calls
 * ctx.scale() — doing both compounded the scale on every resize.
 */
function resizeCanvas(): void {
  if (!canvas || !scrollFrame) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap: 3x costs a lot for no visible gain
  const rect = scrollFrame.getBoundingClientRect();
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);

  if (canvas.width === w && canvas.height === h) return;

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  drawFrame(state.currentFrame);
}

/** Nearest frame that has actually decoded, searching outwards. */
function nearestLoaded(index: number): HTMLImageElement | undefined {
  const exact = state.frames[index - 1];
  if (exact) return exact;

  for (let offset = 1; offset < CONFIG.totalFrames; offset++) {
    const before = state.frames[index - 1 - offset];
    if (before) return before;
    const after = state.frames[index - 1 + offset];
    if (after) return after;
  }
  return undefined;
}

function drawFrame(frameIndex: number): void {
  if (!canvas || !ctx || !scrollFrame) return;

  const img = nearestLoaded(frameIndex);
  if (!img) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = scrollFrame.getBoundingClientRect();
  const cw = rect.width;
  const ch = rect.height;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  // object-fit: cover — the frame is a full-bleed backdrop, so letterbox
  // bars (what `contain` produced) looked broken on tall phone screens.
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = cw / ch;

  let drawW: number;
  let drawH: number;

  if (imgAspect > canvasAspect) {
    drawH = ch;
    drawW = ch * imgAspect;
  } else {
    drawW = cw;
    drawH = cw / imgAspect;
  }

  ctx.drawImage(img, (cw - drawW) / 2, (ch - drawH) / 2, drawW, drawH);

  if (scrollPct) {
    scrollPct.textContent = `${Math.round((frameIndex / CONFIG.totalFrames) * 100)}%`;
  }
}

// ─── Scroll scrubbing ──────────────────────────────────────────────

function initScrubbing(): void {
  if (state.initialized || !scrollContainer || !canvas) return;

  let queued = false;

  const onScroll = (): void => {
    if (queued) return;
    queued = true;

    requestAnimationFrame(() => {
      queued = false;

      const rect = scrollContainer.getBoundingClientRect();
      const distance = rect.height;
      if (distance <= 0) return;

      const scrolled = Math.max(0, -rect.top);
      const progress = Math.min(1, scrolled / distance);
      const frameIndex = Math.min(
        CONFIG.totalFrames,
        Math.max(1, Math.round(progress * (CONFIG.totalFrames - 1) + 1)),
      );

      if (frameIndex !== state.currentFrame) {
        state.currentFrame = frameIndex;
        drawFrame(frameIndex);
      }
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  state.initialized = true;
  onScroll();
}

// ─── Resize ────────────────────────────────────────────────────────

let resizeTimer: ReturnType<typeof setTimeout> | null = null;

function handleResize(): void {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Crossing the breakpoint mid-session should not re-download the
    // sequence — whichever set is already cached stays in use.
    resizeCanvas();
  }, 150);
}

// ─── Reduced motion ────────────────────────────────────────────────

/**
 * Render one representative still and let the page scroll normally.
 * Marking the section lets the stylesheet un-pin the sticky frame.
 */
async function renderStaticStill(): Promise<void> {
  scrollSection?.setAttribute('data-reduced-motion', 'true');

  const midpoint = Math.round(CONFIG.totalFrames / 2);
  try {
    state.frames[midpoint - 1] = await loadSingleFrame(midpoint);
  } catch {
    state.frames[midpoint - 1] = createFallbackFrame();
  }

  state.currentFrame = midpoint;
  state.loadedCount = CONFIG.totalFrames;
  updateLoadingUI();
  resizeCanvas();
  drawFrame(midpoint);
  hideLoader();

  window.addEventListener('resize', handleResize);
}

// ─── Boot ──────────────────────────────────────────────────────────

/**
 * Wait until the section is within roughly 1.5 viewports of the visitor
 * before touching the network.
 *
 * The sequence is ~1.4 MB on mobile. Fetching it at DOMContentLoaded --
 * even at low priority -- saturated a throttled connection and starved
 * the hero image, pushing mobile LCP to 6.9s for an animation most
 * visitors had not scrolled to yet. Deferring it keeps the sequence off
 * the critical path entirely while still giving it a full viewport and a
 * half of lead time to decode before it is on screen.
 */
function whenSectionApproaches(): Promise<void> {
  return new Promise((resolve) => {
    if (!scrollSection || !('IntersectionObserver' in window)) {
      resolve();
      return;
    }

    // Already close enough (deep link, restored scroll position)?
    const rect = scrollSection.getBoundingClientRect();
    if (rect.top < window.innerHeight * 2.5) {
      resolve();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        resolve();
      },
      { rootMargin: '150% 0px 150% 0px' },
    );

    observer.observe(scrollSection);
  });
}

async function main(): Promise<void> {
  state.basePath = resolveBasePath();

  if (prefersReducedMotion.matches) {
    await whenSectionApproaches();
    await renderStaticStill();
    return;
  }

  // 1. Hold off until the section is nearly in view.
  await whenSectionApproaches();

  // 2. First frame only — this is all the section needs to be usable.
  try {
    acceptFrame(1, await loadSingleFrame(1));
  } catch {
    state.frames[0] = createFallbackFrame();
    state.loadedCount = 1;
  }

  resizeCanvas();
  drawFrame(1);

  // 3. Reveal immediately; the rest streams in behind the visible frame.
  hideLoader();
  initScrubbing();
  window.addEventListener('resize', handleResize);

  // 4. Background fill. Deliberately not awaited by anything above.
  void streamRemainingFrames();
}

if (canvas && ctx) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void main());
  } else {
    void main();
  }
}
