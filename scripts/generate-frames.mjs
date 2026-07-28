/**
 * ============================================
 * Frame Generator — Car Wrapping Scroll Effect
 * ============================================
 *
 * Generates 60 procedural placeholder frames (1920×1080, WebP)
 * that simulate a car being progressively wrapped in film.
 *
 * Usage:
 *   node scripts/generate-frames.mjs
 *
 * Dependencies:
 *   npm install sharp
 *
 * The frames are saved to:
 *   assets/frames/car_1.webp  …  car_60.webp
 * ============================================
 */

import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Config ────────────────────────────────────────────────────────

const TOTAL_FRAMES = 60;
const WIDTH = 1920;
const HEIGHT = 1080;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'frames');

// Brand colours
const DARK = '#0d0d0d';
const DARK_CAR = '#1b242b';
const GOLD = '#f7a801';
const WHEEL = '#2a2a2a';

// ─── SVG Generator ─────────────────────────────────────────────────

/**
 * Generate an SVG string representing a car at a given wrapping progress.
 *
 * @param progress  0.0 → 1.0  (how much of the car is "wrapped")
 * @param index     Frame number for the subtle label
 * @param total     Total frame count
 */
function buildCarSVG(progress, index, total) {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const revealWidth = WIDTH * progress;

  // Gradient for the gold wrapping film overlay
  const wrapOpacity = Math.max(0, Math.min(1, (progress - 0.25) / 0.5));

  return `
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${DARK}"/>
        <stop offset="100%" stop-color="#1a1a1a"/>
      </linearGradient>
      <linearGradient id="goldShine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(247,168,1,0)"/>
        <stop offset="50%" stop-color="rgba(247,168,1,${wrapOpacity * 0.12})"/>
        <stop offset="100%" stop-color="rgba(247,168,1,0)"/>
      </linearGradient>
      <clipPath id="revealClip">
        <rect x="0" y="0" width="${revealWidth}" height="${HEIGHT}"/>
      </clipPath>
    </defs>

    <!-- Background -->
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

    <!-- Subtle grid lines -->
    <line x1="${cx - 400}" y1="0" x2="${cx - 400}" y2="${HEIGHT}" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>
    <line x1="${cx + 400}" y1="0" x2="${cx + 400}" y2="${HEIGHT}" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>
    <line x1="0" y1="${cy}" x2="${WIDTH}" y2="${cy}" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>

    <!-- Ground shadow -->
    <ellipse cx="${cx}" cy="${cy + 220}" rx="500" ry="40" fill="rgba(0,0,0,0.4)"/>

    <!-- Everything inside the reveal clip -->
    <g clip-path="url(#revealClip)">
      <!-- Car body -->
      <g transform="translate(0, -20)">
        <!-- Shadow under car -->
        <ellipse cx="${cx}" cy="${cy + 200}" rx="420" ry="30" fill="rgba(0,0,0,0.5)"/>

        <!-- Main chassis -->
        <path d="
          M ${cx - 380} ${cy + 60}
          L ${cx - 200} ${cy - 100}
          Q ${cx - 100} ${cy - 180} ${cx} ${cy - 180}
          Q ${cx + 100} ${cy - 180} ${cx + 200} ${cy - 100}
          L ${cx + 380} ${cy + 60}
          L ${cx + 400} ${cy + 120}
          L ${cx - 400} ${cy + 120}
          Z
        " fill="${DARK_CAR}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>

        <!-- Roof highlight -->
        <path d="
          M ${cx - 150} ${cy - 100}
          Q ${cx - 80} ${cy - 160} ${cx} ${cy - 160}
          Q ${cx + 80} ${cy - 160} ${cx + 150} ${cy - 100}
        " fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>

        <!-- Windows -->
        <path d="
          M ${cx - 180} ${cy - 60}
          L ${cx - 60} ${cy - 150}
          L ${cx + 60} ${cy - 150}
          L ${cx + 180} ${cy - 60}
          Z
        " fill="#1a1a1a" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

        <!-- Window divider -->
        <line x1="${cx}" y1="${cy - 150}" x2="${cx}" y2="${cy - 60}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

        <!-- Wheels -->
        <ellipse cx="${cx - 240}" cy="${cy + 110}" rx="55" ry="75" fill="${WHEEL}"/>
        <ellipse cx="${cx - 240}" cy="${cy + 110}" rx="30" ry="40" fill="#1a1a1a"/>
        <ellipse cx="${cx + 240}" cy="${cy + 110}" rx="55" ry="75" fill="${WHEEL}"/>
        <ellipse cx="${cx + 240}" cy="${cy + 110}" rx="30" ry="40" fill="#1a1a1a"/>

        <!-- Gold accent line -->
        <path d="
          M ${cx - 350} ${cy + 20}
          L ${cx + 350} ${cy + 20}
        " fill="none" stroke="${GOLD}" stroke-width="2.5" opacity="0.6"/>

        <!-- Headlight / taillight hints -->
        <circle cx="${cx - 385}" cy="${cy + 40}" r="8" fill="rgba(255,255,255,0.1)"/>
        <circle cx="${cx + 385}" cy="${cy + 40}" r="8" fill="rgba(247,168,1,0.2)"/>
      </g>

      <!-- Wrapping film overlay (appears from left as progress increases) -->
      <rect x="0" y="0" width="${revealWidth}" height="${HEIGHT}" fill="url(#goldShine)"/>

      <!-- Film edge glow (left side of the reveal) -->
      <line x1="${revealWidth}" y1="0" x2="${revealWidth}" y2="${HEIGHT}"
            stroke="${GOLD}" stroke-width="1" opacity="${Math.min(0.8, wrapOpacity * 0.5)}"/>
    </g>

    <!-- Frame counter -->
    <text x="30" y="${HEIGHT - 30}" fill="rgba(255,255,255,0.08)" font-family="monospace" font-size="14">
      ${index}/${total}
    </text>

    <!-- Progress bar at bottom -->
    <rect x="${cx - 300}" y="${HEIGHT - 20}" width="600" height="2" fill="rgba(255,255,255,0.05)" rx="1"/>
    <rect x="${cx - 300}" y="${HEIGHT - 20}" width="${600 * progress}" height="2" fill="${GOLD}" rx="1" opacity="0.5"/>
  </svg>`;
}

// ─── Generator ─────────────────────────────────────────────────────

async function generateFrames() {
  console.log(`🎨 Generating ${TOTAL_FRAMES} frames…`);

  // Ensure output directory exists
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    const progress = i / TOTAL_FRAMES;
    const svg = buildCarSVG(progress, i, TOTAL_FRAMES);
    const outPath = join(OUT_DIR, `car_${i}.webp`);

    await sharp(Buffer.from(svg))
      .resize(WIDTH, HEIGHT)
      .webp({ quality: 85 })
      .toFile(outPath);

    const pct = Math.round(progress * 100);
    process.stdout.write(`\r  ▸ Frame ${i}/${TOTAL_FRAMES}  (${pct}%)  — saved`);
  }

  console.log('\n✅ All frames generated in:', OUT_DIR);
}

// ─── Run ──────────────────────────────────────────────────────────

generateFrames().catch((err) => {
  console.error('❌ Failed to generate frames:', err);
  process.exit(1);
});
