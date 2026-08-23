/**
 * ============================================
 * Frame extractor — video → WebP scroll sequence
 * ============================================
 *
 * Turns a video into the frame sequence used by the scroll effect:
 *
 *   assets/frames/car_1..N.webp      full size  (desktop)
 *   assets/frames/sm/car_1..N.webp   854px wide (mobile / data saver)
 *
 * Usage
 * -----
 *   npm run frames                       # uses assets/video/*.mp4
 *   npm run frames -- --input path.mp4 --frames 60
 *
 * Options
 * -------
 *   --input <path>     source video (default: first video in assets/video/)
 *   --frames <n>       how many frames (default 60)
 *   --quality <1-100>  WebP quality for the desktop set (default 80)
 *   --width <px>       cap desktop width (default: the video's own width)
 *
 * How it works
 * ------------
 * Decoding is done by a headless Chrome, which is already present via
 * Playwright's browser cache, so this needs no system ffmpeg. The script
 * serves the repo over a throwaway localhost port (so the canvas is never
 * tainted), seeks the <video> to evenly spaced timestamps, reads each frame
 * off a canvas, and hands the pixels to sharp for the final resize/encode.
 *
 * There is an ffmpeg-based equivalent in generate-frames-from-video.mjs
 * (`npm run frames:ffmpeg`) which is faster if you have ffmpeg installed.
 *
 * Notes
 * -----
 *   - Frames are never upscaled past the source resolution.
 *   - If the frame count is not 60, update CONFIG.totalFrames in
 *     ts/scroll-effect.ts and run `npm run build`. The script tells you.
 * ============================================
 */

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Args ──────────────────────────────────────────────────────────

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const TOTAL = Number.parseInt(arg('frames', '60'), 10);
const QUALITY = Number.parseInt(arg('quality', '80'), 10);
const WIDTH_CAP = arg('width', null) ? Number.parseInt(arg('width', '0'), 10) : null;

const VIDEO_DIR = join(ROOT, 'assets', 'video');
const OUT_LARGE = join(ROOT, 'assets', 'frames');
const OUT_SMALL = join(OUT_LARGE, 'sm');

function resolveInput() {
  const explicit = arg('input', null);
  if (explicit) return join(ROOT, explicit);

  if (!existsSync(VIDEO_DIR)) return null;
  const videos = readdirSync(VIDEO_DIR)
    .filter((f) => ['.mp4', '.mov', '.webm', '.m4v'].includes(extname(f).toLowerCase()))
    .sort();
  return videos.length ? join(VIDEO_DIR, videos[0]) : null;
}

// ─── Chrome discovery ──────────────────────────────────────────────

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  // Playwright's cached browsers
  const cacheRoots = [
    join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright'),
    join(process.env.HOME ?? '', '.cache', 'ms-playwright'),
  ];

  for (const root of cacheRoots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium-'))) {
      for (const rel of [
        [
          'chrome-mac-arm64',
          'Google Chrome for Testing.app',
          'Contents',
          'MacOS',
          'Google Chrome for Testing',
        ],
        [
          'chrome-mac',
          'Google Chrome for Testing.app',
          'Contents',
          'MacOS',
          'Google Chrome for Testing',
        ],
        ['chrome-linux', 'chrome'],
      ]) {
        const p = join(root, dir, ...rel);
        if (existsSync(p)) candidates.unshift(p);
      }
    }
  }

  return candidates.find((p) => existsSync(p)) ?? null;
}

// ─── Tiny static server (keeps the canvas untainted) ───────────────

const MIME = {
  '.html': 'text/html',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4v': 'video/mp4',
};

function serve(rootDir, pageHtml) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);

      // The extractor page is served from this same origin so that drawing
      // the video onto a canvas does not taint it (a data: URL page has an
      // opaque origin, which makes every canvas read a security error).
      if (path === '/__extract') {
        const body = Buffer.from(pageHtml);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': body.length,
        });
        res.end(body);
        return;
      }

      const file = join(rootDir, path);
      if (!file.startsWith(rootDir) || !existsSync(file) || statSync(file).isDirectory()) {
        res.writeHead(404).end('not found');
        return;
      }

      const size = statSync(file).size;
      const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';

      // Chrome requests media with a Range header and needs a real 206 back;
      // answering every range with the whole file makes it give up with
      // MEDIA_ELEMENT_ERROR: Format error.
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m?.[1] ? Number.parseInt(m[1], 10) : 0;
        const end = m?.[2] ? Number.parseInt(m[2], 10) : size - 1;

        if (start >= size || end >= size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
          return;
        }

        res.writeHead(206, {
          'Content-Type': type,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
        });
        createReadStream(file, { start, end }).pipe(res);
        return;
      }

      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
      });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// ─── CDP plumbing ──────────────────────────────────────────────────

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await wait(250);
  }
  throw new Error('could not reach Chrome DevTools');
}

function rpc(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  return (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const input = resolveInput();
  if (!input || !existsSync(input)) {
    console.error(
      '\n  No video found.\n' + `  Put a clip in assets/video/ or pass --input <path>.\n`,
    );
    process.exit(1);
  }

  const chromePath = findChrome();
  if (!chromePath) {
    console.error(
      '\n  No Chrome/Chromium found for decoding.\n' +
        '  Set CHROME_PATH, or install Chrome, or use `npm run frames:ffmpeg`.\n',
    );
    process.exit(1);
  }

  console.log(`  video    ${input.replace(`${ROOT}/`, '')}`);
  console.log(`  decoder  ${chromePath.split('/').pop()}`);

  const relative = input.replace(`${ROOT}/`, '');
  const pageHtml = `<!doctype html><meta charset="utf-8">
      <body style="margin:0;background:#000">
      <video id="v" src="/${encodeURI(relative)}" muted playsinline preload="auto"></video>
      <canvas id="c"></canvas>`;

  const { server, port } = await serve(ROOT, pageHtml);

  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--remote-debugging-port=9333',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let ws;
  try {
    ws = new WebSocket(await connect(9333));
    await new Promise((r) => ws.addEventListener('open', r));
    const send = rpc(ws);

    await send('Page.enable');
    await send('Runtime.enable');

    await send('Page.navigate', { url: `http://127.0.0.1:${port}/__extract` });
    await wait(1200);

    // Wait for enough data to seek reliably
    const meta = JSON.parse(
      (
        await send('Runtime.evaluate', {
          expression: `(async () => {
            const v = document.getElementById('v');
            await new Promise((res) => {
              if (v.readyState >= 2) return res();
              v.addEventListener('loadeddata', res, { once: true });
              v.addEventListener('error', res, { once: true });
              setTimeout(res, 20000);
            });
            return JSON.stringify({
              duration: v.duration, w: v.videoWidth, h: v.videoHeight,
              error: v.error ? v.error.message || v.error.code : null,
            });
          })()`,
          awaitPromise: true,
          returnByValue: true,
        })
      ).result.result.value,
    );

    if (meta.error || !meta.w) {
      throw new Error(`Chrome could not decode the video (${meta.error ?? 'no dimensions'})`);
    }

    console.log(`  source   ${meta.w}x${meta.h}, ${meta.duration.toFixed(2)}s`);

    // Never upscale: the desktop set tops out at the video's own width.
    const largeW = Math.min(WIDTH_CAP ?? meta.w, meta.w);
    const largeH = Math.round((largeW * meta.h) / meta.w / 2) * 2;
    const smallW = Math.min(854, largeW);
    const smallH = Math.round((smallW * meta.h) / meta.w / 2) * 2;

    const sizes = [
      { dir: OUT_LARGE, w: largeW, h: largeH, quality: QUALITY },
      { dir: OUT_SMALL, w: smallW, h: smallH, quality: Math.max(50, QUALITY - 14) },
    ];

    console.log(`  output   ${largeW}x${largeH} + ${smallW}x${smallH}, ${TOTAL} frames`);

    // Clear any previous sequence so a shorter clip leaves no orphans
    for (const s of sizes) {
      mkdirSync(s.dir, { recursive: true });
      for (const f of readdirSync(s.dir)) {
        if (/^car_\d+\.webp$/.test(f)) rmSync(join(s.dir, f));
      }
    }

    // Stop a hair short of the end; the very last frame is often not seekable.
    const span = Math.max(0, meta.duration - 0.05);

    for (let i = 0; i < TOTAL; i++) {
      const t = TOTAL === 1 ? 0 : (i / (TOTAL - 1)) * span;

      const dataUrl = (
        await send('Runtime.evaluate', {
          expression: `(async () => {
            const v = document.getElementById('v');
            const c = document.getElementById('c');
            v.currentTime = ${t};
            await new Promise((res) => {
              v.addEventListener('seeked', res, { once: true });
              setTimeout(res, 5000);
            });
            c.width = v.videoWidth; c.height = v.videoHeight;
            c.getContext('2d').drawImage(v, 0, 0);
            // Near-lossless intermediate; sharp does the real resize/encode.
            return c.toDataURL('image/webp', 0.96);
          })()`,
          awaitPromise: true,
          returnByValue: true,
        })
      ).result.result.value;

      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
        throw new Error(`frame ${i + 1}: canvas returned no image`);
      }

      const raw = Buffer.from(dataUrl.split(',')[1], 'base64');

      for (const s of sizes) {
        await sharp(raw)
          .resize(s.w, s.h, { fit: 'cover', position: 'centre' })
          .webp({ quality: s.quality, effort: 5 })
          .toFile(join(s.dir, `car_${i + 1}.webp`));
      }

      if ((i + 1) % 10 === 0 || i + 1 === TOTAL) {
        console.log(`  encoded  ${i + 1}/${TOTAL}`);
      }
    }

    // readdirSync is non-recursive, so measuring OUT_LARGE naturally
    // excludes the sm/ subdirectory.
    const kb = (dir) =>
      Math.round(
        readdirSync(dir)
          .filter((f) => f.endsWith('.webp'))
          .reduce((a, f) => a + statSync(join(dir, f)).size, 0) / 1024,
      );

    console.log(`\n  Done.`);
    console.log(`    assets/frames/     ${largeW}x${largeH}  ${kb(OUT_LARGE)} KB`);
    console.log(`    assets/frames/sm/  ${smallW}x${smallH}  ${kb(OUT_SMALL)} KB`);

    if (TOTAL !== 60) {
      console.log(
        `\n  NOTE: ${TOTAL} frames written, but ts/scroll-effect.ts has\n` +
          `  CONFIG.totalFrames = 60. Update it and run \`npm run build\`.`,
      );
    }
  } finally {
    ws?.close();
    chrome.kill();
    server.close();
  }
}

main().catch((err) => {
  console.error(`\n  Failed: ${err.message}\n`);
  process.exit(1);
});
