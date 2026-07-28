"use strict";
/**
 * ============================================
 * autofoliewrap.cz — Car Wrapping Scroll Effect
 * ============================================
 *
 * Architecture:
 *  1. Async image preloader with silent fallback timeout (6s)
 *  2. Canvas rendering at devicePixelRatio for Retina/HiDPI
 *  3. GSAP ScrollTrigger scrub linking scroll → frame index
 *  4. Dynamic resize handler with object-fit:contain behavior
 *
 * Frame URL pattern:  /assets/frames/car_${index}.webp   (1‑based, 60 frames)
 * ============================================
 */
// ─── DOM References (strictly typed) ──────────────────────────────
const canvas = document.getElementById('scrollCanvas');
const ctx = canvas?.getContext('2d') ?? null;
const loadingOverlay = document.getElementById('scrollLoading');
const loadingPercent = document.getElementById('loadingPercent');
const loadingBarFill = document.getElementById('loadingBarFill');
const scrollContainer = document.getElementById('scrollContainer');
const scrollFrame = document.getElementById('scrollFrame');
const scrollOverlay = document.getElementById('scrollOverlay');
const scrollPct = document.getElementById('scrollPct');
// ─── Configuration ─────────────────────────────────────────────────
const CONFIG = {
    totalFrames: 60, // 60 frames for a smooth 2‑3s scroll animation
    frameUrlPattern: 'assets/frames/car_', // becomes assets/frames/car_1.webp (relative)
    timeoutMs: 6000, // 6 seconds before silent drop
    frameExt: 'webp',
};
// ─── State ─────────────────────────────────────────────────────────
const state = {
    frames: [],
    loadedCount: 0,
    timedOut: false,
    initialized: false,
    currentFrame: 1,
};
// ─── Preloader ────────────────────────────────────────────────────
/**
 * Build the full URL for a given frame index (1‑based).
 * Example:  /assets/frames/car_1.webp
 */
function buildFrameUrl(index) {
    return `${CONFIG.frameUrlPattern}${index}.${CONFIG.frameExt}`;
}
/**
 * Attempt to load a single frame image.
 * Returns a promise that resolves with the loaded image or rejects on error.
 */
function loadSingleFrame(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${url}`));
        img.src = url;
    });
}
/**
 * Asynchronously preload all frame images.
 * Updates the loading bar and percentage in real time.
 *
 * Returns the array of successfully loaded images (may be fewer than totalFrames).
 */
async function preloadFrames() {
    const loadedImages = [];
    const loadPromises = [];
    for (let i = 1; i <= CONFIG.totalFrames; i++) {
        const url = buildFrameUrl(i);
        const promise = loadSingleFrame(url)
            .then((img) => {
            loadedImages[i - 1] = img;
            state.loadedCount++;
            updateLoadingUI(state.loadedCount, CONFIG.totalFrames);
        })
            .catch(() => {
            // Silently skip failed frames — they'll be handled by the fallback
            loadedImages[i - 1] = createFallbackFrame(i, CONFIG.totalFrames);
            state.loadedCount++;
            updateLoadingUI(state.loadedCount, CONFIG.totalFrames);
        });
        loadPromises.push(promise);
    }
    // Wait for all load attempts to settle
    await Promise.allSettled(loadPromises);
    return loadedImages;
}
/**
 * Generate a procedural fallback frame using an offscreen canvas.
 * This creates a coloured abstract visual representing the car‑wrapping process
 * so the animation still works even when real images aren't available.
 */
function createFallbackFrame(index, total) {
    const offscreen = document.createElement('canvas');
    const size = 1920;
    offscreen.width = size;
    offscreen.height = 1080;
    const fctx = offscreen.getContext('2d');
    const progress = index / total; // 0 → 1
    // ── Background gradient (dark) ──
    const bg = fctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#0d0d0d');
    bg.addColorStop(1, '#1a1a1a');
    fctx.fillStyle = bg;
    fctx.fillRect(0, 0, size, size);
    // ── Car body (simplified silhouette) ──
    const cx = size / 2;
    const cy = size / 2;
    const bodyWidth = 800;
    const bodyHeight = 300;
    // Reveal the car from left to right based on progress
    fctx.save();
    fctx.beginPath();
    fctx.rect(0, 0, size * progress, size);
    fctx.clip();
    // Car body
    fctx.fillStyle = '#1b242b';
    fctx.shadowColor = 'rgba(247, 168, 1, 0.2)';
    fctx.shadowBlur = 30;
    // Roof
    fctx.beginPath();
    fctx.moveTo(cx - 200, cy - 100);
    fctx.quadraticCurveTo(cx - 100, cy - 180, cx, cy - 180);
    fctx.quadraticCurveTo(cx + 100, cy - 180, cx + 200, cy - 100);
    fctx.lineTo(cx + 350, cy + 50);
    fctx.lineTo(cx - 350, cy + 50);
    fctx.closePath();
    fctx.fill();
    fctx.strokeStyle = '#f7a801';
    fctx.lineWidth = 2;
    fctx.stroke();
    // Wheels
    fctx.shadowBlur = 0;
    fctx.fillStyle = '#2a2a2a';
    fctx.beginPath();
    fctx.ellipse(cx - 220, cy + 40, 50, 70, 0, 0, Math.PI * 2);
    fctx.fill();
    fctx.beginPath();
    fctx.ellipse(cx + 220, cy + 40, 50, 70, 0, 0, Math.PI * 2);
    fctx.fill();
    // Gold accent line along the car
    fctx.strokeStyle = '#f7a801';
    fctx.lineWidth = 3;
    fctx.shadowColor = '#f7a801';
    fctx.shadowBlur = 15;
    fctx.beginPath();
    fctx.moveTo(cx - 320, cy + 10);
    fctx.lineTo(cx + 320, cy + 10);
    fctx.stroke();
    fctx.restore();
    // ── Wrapping film overlay (gold shimmer) ──
    if (progress > 0.3) {
        const wrapAlpha = Math.min(1, (progress - 0.3) / 0.4);
        fctx.fillStyle = `rgba(247, 168, 1, ${wrapAlpha * 0.08})`;
        fctx.fillRect(0, 0, size * progress, size);
    }
    // ── Frame number (subtle) ──
    fctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    fctx.font = '14px monospace';
    fctx.fillText(`${index}/${total}`, 20, 40);
    // ── Convert to image ──
    const img = new Image();
    img.src = offscreen.toDataURL('image/webp', 0.8);
    return img;
}
// ─── UI Updates ───────────────────────────────────────────────────
/**
 * Update the loading overlay percentage and progress bar.
 */
function updateLoadingUI(loaded, total) {
    const pct = Math.round((loaded / total) * 100);
    if (loadingPercent)
        loadingPercent.textContent = `${pct}%`;
    if (loadingBarFill)
        loadingBarFill.style.width = `${pct}%`;
}
/**
 * Fade out the loading overlay using GSAP.
 */
function fadeOutLoader() {
    if (!loadingOverlay)
        return;
    // Use GSAP for a smooth fade (if GSAP loaded), otherwise CSS fallback
    try {
        // Dynamic import to avoid TypeScript errors if GSAP types aren't present
        // We'll use a simple CSS class fallback — GSAP handles it in the main setup
        loadingOverlay.classList.add('hidden');
    }
    catch {
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.pointerEvents = 'none';
        loadingOverlay.style.visibility = 'hidden';
    }
}
// ─── Canvas Rendering ─────────────────────────────────────────────
/**
 * Resize the canvas backing store to match the device pixel ratio
 * while keeping the CSS size at 100% (Retina / HiDPI support).
 */
function resizeCanvas() {
    if (!canvas || !ctx || !scrollFrame)
        return;
    const dpr = window.devicePixelRatio || 1;
    const rect = scrollFrame.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    // Only resize if dimensions actually changed (performance)
    if (canvas.width === Math.round(w * dpr) && canvas.height === Math.round(h * dpr))
        return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    // Re-draw current frame after resize
    drawFrame(state.currentFrame);
}
/**
 * Draw a specific frame (1‑based) onto the canvas.
 * Clears the canvas first, then renders the image with object-fit:contain logic.
 */
function drawFrame(frameIndex) {
    if (!canvas || !ctx || !scrollFrame)
        return;
    const img = state.frames[frameIndex - 1];
    if (!img)
        return;
    const dpr = window.devicePixelRatio || 1;
    const rect = scrollFrame.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    // Reset transform and clear
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    // ── object-fit: contain logic ──
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = cw / ch;
    let drawW, drawH, dx, dy;
    if (imgAspect > canvasAspect) {
        // Image is wider → fit by width
        drawW = cw;
        drawH = cw / imgAspect;
        dx = 0;
        dy = (ch - drawH) / 2;
    }
    else {
        // Image is taller → fit by height
        drawH = ch;
        drawW = ch * imgAspect;
        dx = (cw - drawW) / 2;
        dy = 0;
    }
    ctx.drawImage(img, dx, dy, drawW, drawH);
    // Update progress overlay
    if (scrollPct) {
        const pct = Math.round((frameIndex / CONFIG.totalFrames) * 100);
        scrollPct.textContent = `${pct}%`;
    }
}
// ─── GSAP ScrollTrigger Setup ────────────────────────────────────
/**
 * Initialise GSAP ScrollTrigger linking scroll progress → frame index.
 * Uses 'scrub: 0.5' for a slight lerp/smoothing effect.
 */
async function initScrollTrigger() {
    if (state.initialized)
        return;
    if (!scrollContainer || !canvas)
        return;
    // Use manual scroll fallback for reliable frame-accurate animation.
    // GSAP ScrollTrigger was causing sticky positioning conflicts.
    initManualScrollFallback();
}
/**
 * Primary scroll handler — listens to native scroll events and maps them
 * to the correct frame index with requestAnimationFrame for smoothness.
 * The scroll-container's height defines the scroll distance for the animation.
 */
function initManualScrollFallback() {
    if (!scrollContainer || !canvas)
        return;
    let rafId = null;
    const onScroll = () => {
        if (rafId !== null)
            return; // throttle to rAF
        rafId = requestAnimationFrame(() => {
            rafId = null;
            const rect = scrollContainer.getBoundingClientRect();
            // When the container's top is at or above viewport top, start the animation.
            // The animation plays while the container scrolls through the viewport.
            // scrollTop: how much of the container has scrolled past the viewport top (>= 0)
            const scrollTop = Math.max(0, -rect.top);
            // scrollHeight: total distance the container scrolls through the viewport
            const scrollHeight = rect.height; // full container height
            if (scrollHeight <= 0)
                return;
            // progress: 0 when container top = viewport top, 1 when container fully scrolled past
            const progress = Math.min(1, scrollTop / scrollHeight);
            const rawFrame = progress * (CONFIG.totalFrames - 1) + 1;
            const frameIndex = Math.min(CONFIG.totalFrames, Math.max(1, Math.round(rawFrame)));
            if (frameIndex !== state.currentFrame) {
                state.currentFrame = frameIndex;
                drawFrame(frameIndex);
            }
        });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => drawFrame(state.currentFrame));
    state.initialized = true;
}
// ─── Resize Handler ───────────────────────────────────────────────
/**
 * Debounced resize handler to avoid excessive canvas resizes.
 */
/** Store reference to ScrollTrigger.refresh for resize handler */
let refreshScrollTrigger = null;
let resizeTimer = null;
function handleResize() {
    if (resizeTimer)
        clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        resizeCanvas();
        if (refreshScrollTrigger)
            refreshScrollTrigger();
    }, 150);
}
// ─── Boot ─────────────────────────────────────────────────────────
/**
 * Main entry point: preload frames, set up canvas, init GSAP,
 * handle the silent fallback timeout, and clean up loader.
 */
async function main() {
    // ── 1. Start preloading ──
    const loadPromise = preloadFrames();
    // ── 2. Silent timeout race ──
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            state.timedOut = true;
            resolve();
        }, CONFIG.timeoutMs);
    });
    // ── 3. Wait for either load complete or timeout ──
    await Promise.race([loadPromise, timeoutPromise]);
    // ── 4. Store whatever frames we have ──
    const allFrames = await loadPromise;
    state.frames = allFrames;
    // ── 5. Fill any gaps with fallback frames ──
    for (let i = 0; i < CONFIG.totalFrames; i++) {
        if (!state.frames[i]) {
            state.frames[i] = createFallbackFrame(i + 1, CONFIG.totalFrames);
            state.loadedCount++;
        }
    }
    // ── 6. Draw first frame immediately ──
    resizeCanvas();
    drawFrame(1);
    // ── 7. Silently fade out loader ──
    fadeOutLoader();
    // ── 8. Initialise GSAP ScrollTrigger ──
    await initScrollTrigger();
    // ── 9. Listen for resize ──
    window.addEventListener('resize', handleResize);
}
// ─── Start ────────────────────────────────────────────────────────
// Only boot if the canvas element exists on this page
if (canvas && ctx) {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { main(); });
    }
    else {
        main();
    }
}
//# sourceMappingURL=scroll-effect.js.map