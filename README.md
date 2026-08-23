# autofoliewrap.cz

Static marketing site for **AutoFolie Wrap s.r.o.** — autofólie, tónování
autoskel a světel, celopolepy, reklamní polepy a PPF ochrana laku, Praha 4.

Plain HTML + CSS + TypeScript. No framework, no bundler, no runtime
dependencies. `ts/` compiles to `js/`, which is committed so the repo can be
served as-is from any static host.

---

## Quick start

```bash
npm install
npm run dev          # build once, then serve on http://localhost:8000
```

A static server is required — `js/scroll-effect.js` is an ES module, so
opening `index.html` over `file://` fails on CORS.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Compile `ts/` → `js/` |
| `npm run watch` | Recompile on change |
| `npm run typecheck` | Types only, no output |
| `npm run lint` | Biome lint + format check |
| `npm run lint:fix` | Apply safe lint/format fixes |
| `npm run serve` | Static server on :8000 |
| `npm run dev` | `build` then `serve` |
| `npm run verify` | `typecheck` + `lint` — run before pushing |
| `npm run frames` | Rebuild the scroll frame sequence from `assets/video/` |
| `npm run frames:ffmpeg` | Same, via ffmpeg if you have it installed |

**`js/` is committed and CI enforces that it matches `ts/`.** After changing
anything under `ts/`, run `npm run build` and commit the result.

---

## Layout

```
index.html                 single page
css/style.css              all styles; design tokens in :root at the top
ts/main.ts                 nav, carousel, counters, scroll reveal, form
ts/scroll-effect.ts        canvas frame-sequence scroll effect
js/                        compiled output (committed)
assets/img/                logo, favicon, hero, OG image
assets/img/gallery/        16 gallery photos (WebP)
assets/video/              source clip for the frame sequence
assets/frames/             scroll sequence, 1280x720 (desktop)
assets/frames/sm/          scroll sequence, 854x480 (mobile / data saver)
scripts/extract-frames.mjs video -> frames (headless Chrome, no ffmpeg)
```

## Imagery

| Where | Source |
| --- | --- |
| Hero backdrop | Stock photo (Unsplash `photo-1552519507-da3b142c6e3d`, blue Camaro) — the one the original GitHub version used, restored by request. **Downloaded and served locally**, not hotlinked. |
| Gallery (16 photos) | The client's own work, taken from autofoliewrap.cz and re-encoded to WebP. |
| OG / share image | The client's own bronze Audi Q7 wrap. Deliberately their real work rather than the stock hero — change `assets/img/og-image.jpg` if you'd rather the share card match the hero. |
| Logo & favicon | The client's real logo; the favicon mark is derived from it. |

Nothing hotlinks a third-party image any more. The original hotlinked six
Unsplash URLs and they were failing to load in practice.

Note the hero is the one place a car the client did not wrap appears. Their own
work carries the gallery, the share card and the scroll sequence.

## Theming

Every colour, duration and easing is a custom property in `:root` at the top
of `css/style.css`. The palette is sampled from the client's own logo
(`assets/img/logo.png`): red `#c02222`, plum `#504552`.

Changing `--c-accent` re-themes the site. Note `--c-accent-on-dark`: brand red
is a dark hue and drops to ~2.6:1 on dark backgrounds, so accent text on the
header, hero, stats and footer uses that lighter tint to stay above 4.5:1.
Buttons with an accent background use white text (6.0:1), not dark text — dark
text on red is only 2.6:1.

## The scroll-effect footage

The sequence is built from the client's own clip at `assets/video/wrap vid 1.mp4`
(1280x720, 4.3 s) — squeegee work, heat gun, blade trimming. It is decoded into:

```
assets/frames/      60 x 1280x720   1.8 MB   desktop
assets/frames/sm/   60 x  854x480   825 KB   mobile / data saver
```

Frames are never upscaled past the source, so the desktop set is 720p. On a
very wide high-DPI display the canvas softens slightly — that is the ceiling of
the source material, not the encoder. A 1080p original would fix it.

`index.html` never requests the video itself, only the frames, so
`assets/video/` is the source of truth for regeneration rather than something
the site serves. You can exclude it from a deploy if you want to save the ~1 MB.

### Replacing it

```bash
# drop a new clip in assets/video/ (mp4, mov, webm, m4v), then:
npm run frames
```

`npm run frames` decodes with a headless Chrome — no system ffmpeg needed,
which is why it is the default. Options:

```bash
npm run frames -- --input assets/video/other.mp4 --frames 60 --quality 80
npm run frames:ffmpeg     # same job via ffmpeg, faster, needs ffmpeg on PATH
```

If the frame count is not 60, update `CONFIG.totalFrames` in
`ts/scroll-effect.ts` and run `npm run build`. The script reminds you.

Two things to watch when choosing footage:

- **Show a transformation.** The overlay reads *"sledujte proměnu"* / *"jak
  vzniká dokonalý celopolep"*, so a clip that only pans a finished car reads as
  a broken effect. 3–6 seconds of continuous work is the sweet spot.
- **Mind the exposure.** The overlay text sits on top of the footage. The
  current clip is brightly lit, which needed a scrim (`.scroll-overlay::before`)
  to keep the small red text legible. Dark footage may not need it; a very
  bright clip may need more.

Note the current clip contains three separate shots, so scrubbing crosses two
hard cuts. It reads as a montage rather than one continuous motion — fine, but
a single unbroken take would feel smoother.

---

## Before this goes live

Two things are deliberately not finished, because they need the client:

### 1. The contact form is not connected

`FORM_CONFIG.accessKey` in `ts/main.ts` is empty. Until it is filled in the
form does **not** pretend to work — it tells the visitor to phone instead.

To connect it: create a free key at <https://web3forms.com> (it only needs a
destination e-mail address, no backend), paste it into `FORM_CONFIG`, and run
`npm run build`.

> The form previously ran a `setTimeout` and then displayed *"Zpráva odeslána
> ✓"* without sending anything, so every enquiry was silently discarded.

### 2. Facts to confirm with the client

| Item | Status |
| --- | --- |
| `info@autofoliewrap.cz` | **Unverified** — not published on the live site. Used in the footer, contact block, schema and form fallback. |
| Founded 2009 vs 2013 | The live site claims both. This site uses **2013** throughout. |
| "12 let zkušeností" | Taken from the live site, but 2013 → now is 13 years. |

| Tónování price columns | The client's `/cenik/` lists **two prices per body type with no column headers**. What separates them is unknown — most likely their two film ranges (SunTek HP / Fusion HP). Shown as a range for now; confirm and split into two labelled columns if it is a film choice. |

**Prices are real.** The whole `#cenik` section is transcribed from
<https://www.autofoliewrap.cz/cenik/> — tónování skel by body type, tónování
světel, per-panel částečné polepy (lesklá/matná), and four PPF packages. Earlier
in this project the section said *"individuální kalkulace"* because that page had
not been checked; the clone's original invented figures were badly wrong (PPF
"od 8 000 Kč" against a real **od 80 000 Kč**). If the client updates their
price page, re-transcribe from it rather than editing numbers by hand.

Verified against the live site and safe: address Libušská 196, 142 00 Praha 4 ·
both phone numbers · IČO 289 65 809 · opening hours Po–Pá 9:00–17:00 ·
**15 595 úspěšných zakázek** (published on the live site as an Elementor
counter, `data-to-value="15595"` — the clone's original "1 500" was wrong by
an order of magnitude).

### Testimonials

**Ten** reviews, newest first, every one a verified 5 star:

- **Nine** copied verbatim from autofoliewrap.cz (stars counted from the star
  spans in their Google plugin's markup, not assumed).
- **One** (David Nasa) added by hand from the Google listing, which their plugin
  never syndicated.

The four invented testimonials that were here originally are gone. "Zobrazit
všechny recenze na Google" points at the client's real listing
(`maps.google.com/?cid=15218334719687658663`).

#### The 4,8 aggregate rating

The score above the carousel is **client-supplied**. It is the figure shown on
their Google Business profile; it is not published on autofoliewrap.cz, and
Google's listing is behind a consent wall, so it could not be verified
independently.

It is deliberately **not** in the JSON-LD as an `aggregateRating`:

- That property needs a real `reviewCount`, which is unknown. The ten reviews
  shown here are a subset and are all 5 stars, so they would average 5.0 — not
  4.8. Publishing a count that does not match the score is exactly the kind of
  mismatch Google flags.
- Google discounts self-serving aggregate ratings in `LocalBusiness` markup
  anyway, so there is no SEO upside to offset the risk.

If the client confirms the exact score and total review count, adding it to the
schema becomes safe.

Stars are gold (`--c-star`), not brand red — gold is the universal convention
for ratings. Bright gold on white is only about 2:1, below the 3:1 WCAG asks of
informative graphics, which is why **the score is always written out as text**
next to it ("4,8 z 5") and the star graphic carries an `aria-label`. If you ever
want the stars to carry the rating alone, deepen `--c-star` to around `#c8860d`
(3.09:1) — it reads as old gold rather than bright gold.

#### Adding more

Their plugin's newest review is August 2024, but **the Google listing carries
newer ones it does not syndicate**. Google's review list sits behind a consent
wall and is not fetchable programmatically, so extra reviews have to be added
by hand — copy an existing `.testimonial-card` block and edit it. The carousel
dots regenerate from the slide count, so no other change is needed.

For each one, capture: reviewer name, star count, the review text, and the
date. On Google, click **"See original (Czech)"** before copying — the default
view shows Google's English machine translation, which is why most cards here
carry `lang="en"` on a Czech site. Czech originals are preferable.

Two known gaps in the current set:

- **David Nasa's date is only a year.** Google displayed it as "a year ago" and
  nothing more precise, so the card shows `2025`. Replace it if you have the
  real date.
- **Two of the nine are one-liners** ("Very good …. 👍", "I am very satisfied,
  everything I need is here!"). Real and 5 star, but they leave the card looking
  sparse, since the carousel is as tall as its longest slide. Delete those two
  blocks if you would rather only show the substantive ones.

---

## Quality gates

CI (`.github/workflows/ci.yml`) runs typecheck, lint, build, a `js/`-drift
check, Lighthouse CI, and pa11y (WCAG 2.1 AA).

Measured locally, median of 5 Lighthouse runs (single runs vary by several
points, so treat any one number with suspicion):

| | Desktop | Mobile |
| --- | --- | --- |
| Performance | 99 | 88 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| LCP | 0.8 s | 3.4 s |
| CLS | 0 | 0 |
| TBT | 0 ms | 0 ms |

**Mobile performance is gated almost entirely by the Google Fonts
stylesheet.** It is the only render-blocking request left, and the LCP element
is hero text that cannot paint until it resolves — 87% of LCP is render delay.
Measured with that one `<link>` removed, mobile goes to **100 with a 1.4 s
LCP**: a two-second improvement from a single change. Self-hosting Raleway is
therefore by far the highest-value remaining work, and it removes the GDPR
exposure at the same time. See *Possible next steps*.

**One known false positive.** The scroll reveal keeps below-fold elements at
`opacity: 0` until they are observed, and axe reports `opacity: 0` text as a
contrast failure. A scan that does not scroll first will therefore report
dozens of phantom `color-contrast` errors. `opacity` is used deliberately
rather than `visibility: hidden` so the content stays in the accessibility
tree for screen-reader users. Contrast is verified separately against the
fully-revealed page; `color-contrast` is set to `warn` in `lighthouserc.json`
for this reason.

## Possible next steps

- **Self-host Raleway** (e.g. Fontsource). Measured worth **+12 mobile
  Lighthouse points and −2.0 s LCP** — the single biggest win available. It is
  the only render-blocking request left, and hotlinking it is also a live GDPR
  exposure in the EU.
- **Drop Font Awesome for inline SVG.** The full stylesheet loads for ~20
  icons, and its webfont has no `font-display`, so icons flash in late.
- **Minify CSS/JS** — currently served unminified.
- **Cache headers** — set a long `Cache-Control` on `assets/` at the host.
