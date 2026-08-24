// ============================================
// AUTOFOLIEWRAP.CZ — TypeScript Interactivity
// ============================================

/* ─────────────────────────────────────────────
   CONFIG
   ───────────────────────────────────────────── */

/**
 * Contact-form delivery.
 *
 * The form used to fake its own success: it ran a setTimeout and then
 * printed "Zpráva odeslána ✓" without sending anything anywhere, so every
 * enquiry was silently lost. It now posts to Web3Forms.
 *
 * TO GO LIVE: create a free key at https://web3forms.com (it just needs the
 * destination e-mail address — no account, no backend) and paste it below.
 * While `accessKey` is empty the form does NOT pretend to work: it tells the
 * visitor to phone instead and never claims a message was delivered.
 */
const FORM_CONFIG = {
  endpoint: 'https://api.web3forms.com/submit',
  accessKey: '', // ← paste the Web3Forms access key here
  subject: 'Nová poptávka z autofoliewrap.cz',
} as const;

/** Autoplay interval for the testimonial carousel (ms). */
const CAROUSEL_INTERVAL = 6000;

/** Visitors who asked their OS to reduce motion get no decorative animation. */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ─────────────────────────────────────────────
   DOM
   ───────────────────────────────────────────── */

const header = document.getElementById('header');
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');
const scrollTopBtn = document.getElementById('scrollTop');
const bookCta = document.getElementById('bookCta');
const cookieBanner = document.getElementById('cookieBanner');
const cookieAccept = document.getElementById('cookieAccept');
const cookieDecline = document.getElementById('cookieDecline');
const testimonialsTrack = document.getElementById('testimonialsTrack');
const testPrev = document.getElementById('testPrev');
const testNext = document.getElementById('testNext');
const testDots = document.getElementById('testDots');
const contactForm = document.getElementById('contactForm') as HTMLFormElement | null;
const formStatus = document.getElementById('formStatus');

/* ─────────────────────────────────────────────
   SCROLL HANDLING
   One rAF-batched listener drives the header, the back-to-top button and
   the active nav link. Section offsets are measured once and re-measured
   only on resize — the previous version ran querySelectorAll plus an
   offsetTop/offsetHeight read for every section on every scroll event,
   which forced a synchronous layout on each tick.
   ───────────────────────────────────────────── */

interface SectionBound {
  id: string;
  top: number;
  bottom: number;
}

let sectionBounds: SectionBound[] = [];
let navLinks: HTMLAnchorElement[] = [];
let activeNavId = '';

function measureSections(): void {
  navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav__link'));

  const linked = new Set(
    navLinks
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => !!href && href.startsWith('#'))
      .map((href) => href.slice(1)),
  );

  sectionBounds = Array.from(document.querySelectorAll<HTMLElement>('section[id]'))
    .filter((section) => linked.has(section.id))
    .map((section) => {
      const top = section.getBoundingClientRect().top + window.scrollY - 150;
      return { id: section.id, top, bottom: top + section.offsetHeight };
    });
}

function updateActiveNav(scrollY: number): void {
  let current = '';
  for (const bound of sectionBounds) {
    if (scrollY >= bound.top && scrollY < bound.bottom) {
      current = bound.id;
      break;
    }
  }

  // Only touch the DOM when the active section actually changed
  if (current === activeNavId) return;
  activeNavId = current;

  for (const link of navLinks) {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  }
}

let scrollQueued = false;

function onScroll(): void {
  if (scrollQueued) return;
  scrollQueued = true;

  requestAnimationFrame(() => {
    scrollQueued = false;
    const y = window.scrollY;

    header?.classList.toggle('header--scrolled', y > 50);
    scrollTopBtn?.classList.toggle('show', y > 300);
    updateActiveNav(y);
  });
}

let resizeQueued: ReturnType<typeof setTimeout> | null = null;

function onResize(): void {
  if (resizeQueued) clearTimeout(resizeQueued);
  resizeQueued = setTimeout(() => {
    measureSections();
    updateActiveNav(window.scrollY);
  }, 150);
}

/* ─────────────────────────────────────────────
   MOBILE NAV
   ───────────────────────────────────────────── */

function setNavOpen(open: boolean): void {
  if (!hamburger || !nav) return;
  hamburger.classList.toggle('active', open);
  nav.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', String(open));
  hamburger.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
}

function initNav(): void {
  hamburger?.addEventListener('click', () => {
    setNavOpen(!nav?.classList.contains('open'));
  });

  for (const link of document.querySelectorAll('.nav__link')) {
    link.addEventListener('click', () => setNavOpen(false));
  }

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (nav?.classList.contains('open')) {
      setNavOpen(false);
      hamburger?.focus();
    }
  });
}

/* ─────────────────────────────────────────────
   BACK TO TOP
   ───────────────────────────────────────────── */

function initScrollTop(): void {
  scrollTopBtn?.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
    });
  });
}

/* ─────────────────────────────────────────────
   FLOATING BOOKING CTA
   ───────────────────────────────────────────── */

/** True while the contact section is on screen. The CTA scrolls the visitor
 *  there, so keeping it up once they have arrived is both redundant and in
 *  the way of the form it is covering. */
let contactInView = false;

/** Held false until the entrance delay has passed, so the observer below
 *  cannot reveal the button early and skip its animation. */
let ctaReady = false;

function updateBookCta(): void {
  bookCta?.classList.toggle('show', ctaReady && !contactInView);
}

function initBookCta(): void {
  if (!bookCta) return;

  const contact = document.getElementById('kontakt');
  if (contact && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) contactInView = entry.isIntersecting;
        updateBookCta();
      },
      // Any sliver of the section counts — by the time its heading is visible
      // the visitor has found the form on their own.
      { threshold: 0 },
    );

    observer.observe(contact);
  }

  // The hero carries no booking action of its own, so this is the only
  // conversion path in the first viewport and is shown from the start rather
  // than on scroll. The short delay is only so the entrance animation is seen
  // against a settled page.
  window.setTimeout(() => {
    ctaReady = true;
    updateBookCta();
  }, 800);
}

/* ─────────────────────────────────────────────
   COOKIE NOTICE
   ───────────────────────────────────────────── */

function initCookieBanner(): void {
  if (!cookieBanner) return;

  let stored: string | null = null;
  try {
    stored = localStorage.getItem('cookieConsent');
  } catch {
    // Private mode / storage disabled — just show the notice.
  }

  if (stored) return;

  // The notice wraps to two or three lines on narrow screens, so its height
  // has to be measured rather than assumed; the corner stack sits on top of
  // whatever it turns out to be.
  const measureCookieHeight = () => {
    document.body.style.setProperty('--cookie-h', `${cookieBanner.offsetHeight + 14}px`);
  };

  window.setTimeout(() => {
    cookieBanner.hidden = false;
    measureCookieHeight();
    cookieBanner.classList.add('show');
    // Lifts the corner stack clear of the notice while it occupies that edge.
    document.body.classList.add('cookie-open');
  }, 600);

  window.addEventListener('resize', () => {
    if (document.body.classList.contains('cookie-open')) measureCookieHeight();
  });

  const dismiss = (value: string) => {
    try {
      localStorage.setItem('cookieConsent', value);
    } catch {
      // Nothing we can do; hiding it for this session is still correct.
    }
    cookieBanner.classList.remove('show');
    document.body.classList.remove('cookie-open');
    window.setTimeout(() => {
      cookieBanner.hidden = true;
    }, 400);
  };

  cookieAccept?.addEventListener('click', () => dismiss('accepted'));
  cookieDecline?.addEventListener('click', () => dismiss('declined'));
}

/* ─────────────────────────────────────────────
   TESTIMONIAL CAROUSEL
   ───────────────────────────────────────────── */

function initCarousel(): void {
  if (!testimonialsTrack || !testDots) return;

  // Bound locally so the rest of the closure needs no non-null assertions
  const track = testimonialsTrack;
  const dotsHost = testDots;

  const slides = Array.from(track.querySelectorAll<HTMLElement>('.testimonial-card'));
  if (slides.length === 0) return;

  let index = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'testimonials__dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Reference ${i + 1} z ${slides.length}`);
    dot.addEventListener('click', () => {
      goTo(i);
      restart();
    });
    dotsHost.appendChild(dot);
    return dot;
  });

  function goTo(next: number): void {
    index = (next + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;

    dots.forEach((dot, i) => {
      const current = i === index;
      dot.classList.toggle('active', current);
      dot.setAttribute('aria-selected', String(current));
    });

    // Cards scrolled out of view must not be reachable by keyboard
    slides.forEach((slide, i) => {
      slide.toggleAttribute('inert', i !== index);
      slide.setAttribute('aria-hidden', String(i !== index));
    });
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start(): void {
    // Autoplay is decorative motion — skip it entirely when motion is reduced
    if (reduceMotion.matches || timer !== null) return;
    timer = setInterval(() => goTo(index + 1), CAROUSEL_INTERVAL);
  }

  function restart(): void {
    stop();
    start();
  }

  testNext?.addEventListener('click', () => {
    goTo(index + 1);
    restart();
  });
  testPrev?.addEventListener('click', () => {
    goTo(index - 1);
    restart();
  });

  const slider = document.getElementById('testimonialsSlider');
  // Pause for pointer users AND for keyboard users tabbing through
  slider?.addEventListener('mouseenter', stop);
  slider?.addEventListener('mouseleave', start);
  slider?.addEventListener('focusin', stop);
  slider?.addEventListener('focusout', start);

  slider?.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      goTo(index + 1);
      restart();
    } else if (event.key === 'ArrowLeft') {
      goTo(index - 1);
      restart();
    }
  });

  // Stop burning CPU while the tab is in the background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) stop();
    else start();
  });

  goTo(0);
  start();
}

/* ─────────────────────────────────────────────
   COUNTERS
   Each counter animates when *it* scrolls into view.

   The previous version called a single animateCounters() that started
   EVERY .counter on the page as soon as any one section intersected — so
   by the time you scrolled down to the stats they had already finished
   counting and just sat there at their final value. Counters are now
   observed and driven individually.
   ───────────────────────────────────────────── */

const COUNTER_DURATION = 1600;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function runCounter(el: HTMLElement): void {
  const target = Number.parseInt(el.dataset.target ?? '0', 10);
  if (!Number.isFinite(target)) return;

  const format = (value: number) => value.toLocaleString('cs-CZ');

  if (reduceMotion.matches) {
    el.textContent = format(target);
    return;
  }

  el.dataset.counting = 'true';
  const start = performance.now();

  const tick = (now: number) => {
    const progress = Math.min(1, (now - start) / COUNTER_DURATION);
    el.textContent = format(Math.round(target * easeOutCubic(progress)));

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = format(target);
      delete el.dataset.counting;
    }
  };

  requestAnimationFrame(tick);
}

function initCounters(): void {
  const counters = Array.from(document.querySelectorAll<HTMLElement>('.counter'));
  if (counters.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    for (const counter of counters) {
      runCounter(counter);
    }
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el); // each counter runs exactly once
        runCounter(el);
      }
    },
    { threshold: 0.6, rootMargin: '0px 0px -40px 0px' },
  );

  for (const counter of counters) {
    observer.observe(counter);
  }
}

/* ─────────────────────────────────────────────
   SCROLL REVEAL
   Adds .visible as elements enter the viewport. Groups get a staggered
   delay via the --reveal-i custom property so cards cascade in.
   ───────────────────────────────────────────── */

interface RevealGroup {
  selector: string;
  variant?: string;
  stagger?: boolean;
}

const REVEAL_GROUPS: RevealGroup[] = [
  { selector: '.section__title' },
  { selector: '.section__subtitle' },
  { selector: '.hero__box', stagger: true },
  { selector: '.service-card', stagger: true },
  { selector: '.process__step', stagger: true },
  { selector: '.ppf__stat', variant: 'reveal--pop', stagger: true },
  { selector: '.stats__item', variant: 'reveal--pop', stagger: true },
  { selector: '.gallery__item', stagger: true },
  { selector: '.pricing__card', stagger: true },
  { selector: '.contact__info-item', stagger: true },
  { selector: '.about__content', variant: 'reveal--left' },
  { selector: '.about__brands', variant: 'reveal--right' },
];

function initReveal(): void {
  // No IntersectionObserver (or motion reduced): show everything immediately
  if (!('IntersectionObserver' in window) || reduceMotion.matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
  );

  const viewportH = window.innerHeight;

  // Two passes, deliberately. Anything already on screen at load should just
  // be there — fading in content the visitor is already looking at reads as a
  // glitch. Deciding that needs a measurement, but interleaving
  // getBoundingClientRect() with classList.add() across ~60 elements forces a
  // synchronous layout on every iteration, which measurably delayed first
  // render on a throttled mobile CPU. So: read everything, then write
  // everything.
  interface Candidate {
    el: HTMLElement;
    group: RevealGroup;
    index: number;
    belowFold: boolean;
  }

  const candidates: Candidate[] = [];

  // ---- READ pass: no DOM mutation in here ----
  for (const group of REVEAL_GROUPS) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(group.selector));
    elements.forEach((el, index) => {
      candidates.push({
        el,
        group,
        index,
        belowFold: el.getBoundingClientRect().top >= viewportH * 0.9,
      });
    });
  }

  // ---- WRITE pass ----
  for (const { el, group, index, belowFold } of candidates) {
    if (!belowFold) continue;

    el.classList.add('reveal');
    if (group.variant) el.classList.add(group.variant);
    // Cap the stagger so a long list (the 16 gallery tiles) never waits
    // over half a second for its turn.
    if (group.stagger) el.style.setProperty('--reveal-i', String(Math.min(index % 6, 5)));
    observer.observe(el);
  }
}

/* ─────────────────────────────────────────────
   CONTACT FORM
   ───────────────────────────────────────────── */

const PHONE_FALLBACK =
  'Formulář zatím není propojen s e-mailem. Zavolejte nám prosím na ' +
  '<a href="tel:+420777599995">+420 777 599 995</a> nebo napište na ' +
  '<a href="mailto:info@autofoliewrap.cz">info@autofoliewrap.cz</a>.';

function setStatus(message: string, kind: 'success' | 'error'): void {
  if (!formStatus) return;
  formStatus.innerHTML = message;
  formStatus.classList.remove('form__status--success', 'form__status--error');
  formStatus.classList.add('is-visible', `form__status--${kind}`);
}

function initContactForm(): void {
  if (!contactForm) return;

  const button = contactForm.querySelector<HTMLButtonElement>('.form__btn');

  contactForm.addEventListener('submit', async (event: Event) => {
    event.preventDefault();

    // novalidate is set on the form so we can show our own message
    if (!contactForm.checkValidity()) {
      setStatus(
        'Zkontrolujte prosím vyplněná pole – jméno, e-mail a zpráva jsou povinné.',
        'error',
      );
      contactForm.querySelector<HTMLInputElement>(':invalid')?.focus();
      return;
    }

    // Without a key we must not imply the message went anywhere.
    if (!FORM_CONFIG.accessKey) {
      setStatus(PHONE_FALLBACK, 'error');
      return;
    }

    const original = button?.textContent ?? 'Odeslat zprávu';
    if (button) {
      button.disabled = true;
      button.textContent = 'Odesílám…';
    }

    try {
      const payload = new FormData(contactForm);
      payload.append('access_key', FORM_CONFIG.accessKey);
      payload.append('subject', FORM_CONFIG.subject);
      payload.append('from_name', 'autofoliewrap.cz');

      const response = await fetch(FORM_CONFIG.endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: payload,
      });

      const result: unknown = await response.json().catch(() => null);
      const ok =
        response.ok &&
        typeof result === 'object' &&
        result !== null &&
        (result as { success?: boolean }).success === true;

      if (!ok) throw new Error('Web3Forms rejected the submission');

      setStatus('Děkujeme, zpráva byla odeslána. Ozveme se vám co nejdříve.', 'success');
      contactForm.reset();
    } catch {
      setStatus(
        'Zprávu se nepodařilo odeslat. Zkuste to prosím znovu, nebo nám zavolejte na ' +
          '<a href="tel:+420777599995">+420 777 599 995</a>.',
        'error',
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  });
}

/* ─────────────────────────────────────────────
   MISC
   ───────────────────────────────────────────── */

/** Keeps the footer copyright year correct without anyone editing HTML. */
function initYear(): void {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */

function init(): void {
  measureSections();
  initNav();
  initScrollTop();
  initBookCta();
  initCookieBanner();
  initCarousel();
  initCounters();
  initReveal();
  initContactForm();
  initYear();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  // Late-loading images (the gallery) change page height, so re-measure
  window.addEventListener('load', measureSections);

  onScroll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
