/**
 * ============================================
 * Frame Generator — from a real video
 * ============================================
 *
 * Turns a video into the WebP frame sequence used by the scroll effect,
 * in both the sizes the site serves:
 *
 *   assets/frames/car_1..N.webp      1920x1080  (desktop)
 *   assets/frames/sm/car_1..N.webp    854x480   (mobile / data saver)
 *
 * Usage
 * -----
 *   1. Put the clip at assets/video/source.mp4
 *   2. npm run frames
 *
 * Options
 * -------
 *   --input <path>    source video          (default assets/video/source.mp4)
 *   --frames <n>      how many frames       (default 60)
 *   --quality <1-100> WebP quality          (default 78)
 *
 * Requirements
 * ------------
 *   ffmpeg on PATH.  macOS: brew install ffmpeg
 *                    Debian/Ubuntu: sudo apt install ffmpeg
 *
 * Notes
 * -----
 *   - Changing the frame count means updating CONFIG.totalFrames in
 *     ts/scroll-effect.ts to match, then `npm run build`.
 *   - Pick footage that actually shows a transformation. The overlay copy
 *     says "sledujte proměnu" / "jak vzniká dokonalý celopolep", so a clip
 *     that only pans around a static car will read as a broken effect.
 *   - Aim for 3-6 seconds of continuous motion; 60 frames is roughly one
 *     full scroll of the pinned section.
 * ============================================
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Args ──────────────────────────────────────────────────────────

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const INPUT = join(ROOT, arg('input', 'assets/video/source.mp4'));
const TOTAL = Number.parseInt(arg('frames', '60'), 10);
const QUALITY = Number.parseInt(arg('quality', '78'), 10);

const OUT_LARGE = join(ROOT, 'assets', 'frames');
const OUT_SMALL = join(OUT_LARGE, 'sm');
const TMP = join(ROOT, '.frames-tmp');

const SIZES = [
  { dir: OUT_LARGE, width: 1920, height: 1080, quality: QUALITY },
  { dir: OUT_SMALL, width: 854, height: 480, quality: Math.max(50, QUALITY - 12) },
];

// ─── Helpers ───────────────────────────────────────────────────────

async function ffprobeDuration(file) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Could not read a duration from ${file}`);
  }
  return seconds;
}

async function requireFfmpeg() {
  try {
    await run('ffmpeg', ['-version']);
  } catch {
    console.error(
      '\n  ffmpeg was not found on PATH.\n' +
        '    macOS:  brew install ffmpeg\n' +
        '    Ubuntu: sudo apt install ffmpeg\n',
    );
    process.exit(1);
  }
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(INPUT)) {
    console.error(`\n  No video at ${INPUT}\n  Put your clip there, or pass --input <path>.\n`);
    process.exit(1);
  }

  await requireFfmpeg();

  const duration = await ffprobeDuration(INPUT);
  // Sample evenly across the clip. fps is expressed as a fraction so
  // ffmpeg lands on TOTAL frames regardless of the source frame rate.
  const fps = (TOTAL / duration).toFixed(6);

  console.log(`  source     ${INPUT}`);
  console.log(`  duration   ${duration.toFixed(2)}s`);
  console.log(`  extracting ${TOTAL} frames (fps=${fps})`);

  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });

  await run('ffmpeg', [
    '-loglevel',
    'error',
    '-i',
    INPUT,
    '-vf',
    `fps=${fps}`,
    '-frames:v',
    String(TOTAL),
    '-q:v',
    '2',
    join(TMP, 'raw_%04d.png'),
  ]);

  const raw = readdirSync(TMP)
    .filter((f) => f.endsWith('.png'))
    .sort();
  if (raw.length === 0) throw new Error('ffmpeg produced no frames');
  console.log(`  extracted  ${raw.length} frames`);

  for (const size of SIZES) {
    mkdirSync(size.dir, { recursive: true });
    // Clear any previous sequence so a shorter clip cannot leave orphans
    for (const file of readdirSync(size.dir)) {
      if (/^car_\d+\.webp$/.test(file)) rmSync(join(size.dir, file));
    }
  }

  let written = 0;
  for (let i = 0; i < raw.length; i++) {
    const src = join(TMP, raw[i]);
    for (const size of SIZES) {
      await sharp(src)
        .resize(size.width, size.height, { fit: 'cover', position: 'centre' })
        .webp({ quality: size.quality, effort: 5 })
        .toFile(join(size.dir, `car_${i + 1}.webp`));
    }
    written++;
    if (written % 10 === 0) console.log(`  encoded    ${written}/${raw.length}`);
  }

  rmSync(TMP, { recursive: true, force: true });

  console.log(`\n  Done. ${written} frames written to:`);
  console.log(`    assets/frames/        (1920x1080)`);
  console.log(`    assets/frames/sm/     (854x480)`);

  if (written !== 60) {
    console.log(
      `\n  NOTE: the sequence is ${written} frames, but ts/scroll-effect.ts\n` +
        `  has CONFIG.totalFrames = 60. Update it and run \`npm run build\`.`,
    );
  }
}

main().catch((error) => {
  console.error(`\n  Failed: ${error.message}\n`);
  process.exit(1);
});
