"use strict";
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
};
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
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');
let sectionBounds = [];
let navLinks = [];
let activeNavId = '';
function measureSections() {
    navLinks = Array.from(document.querySelectorAll('.nav__link'));
    const linked = new Set(navLinks
        .map((link) => link.getAttribute('href'))
        .filter((href) => !!href && href.startsWith('#'))
        .map((href) => href.slice(1)));
    sectionBounds = Array.from(document.querySelectorAll('section[id]'))
        .filter((section) => linked.has(section.id))
        .map((section) => {
        const top = section.getBoundingClientRect().top + window.scrollY - 150;
        return { id: section.id, top, bottom: top + section.offsetHeight };
    });
}
function updateActiveNav(scrollY) {
    let current = '';
    for (const bound of sectionBounds) {
        if (scrollY >= bound.top && scrollY < bound.bottom) {
            current = bound.id;
            break;
        }
    }
    // Only touch the DOM when the active section actually changed
    if (current === activeNavId)
        return;
    activeNavId = current;
    for (const link of navLinks) {
        link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    }
}
let scrollQueued = false;
function onScroll() {
    if (scrollQueued)
        return;
    scrollQueued = true;
    requestAnimationFrame(() => {
        scrollQueued = false;
        const y = window.scrollY;
        header?.classList.toggle('header--scrolled', y > 50);
        scrollTopBtn?.classList.toggle('show', y > 300);
        updateActiveNav(y);
    });
}
let resizeQueued = null;
function onResize() {
    if (resizeQueued)
        clearTimeout(resizeQueued);
    resizeQueued = setTimeout(() => {
        measureSections();
        updateActiveNav(window.scrollY);
    }, 150);
}
/* ─────────────────────────────────────────────
   MOBILE NAV
   ───────────────────────────────────────────── */
function setNavOpen(open) {
    if (!hamburger || !nav)
        return;
    hamburger.classList.toggle('active', open);
    nav.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Zavřít menu' : 'Otevřít menu');
}
function initNav() {
    hamburger?.addEventListener('click', () => {
        setNavOpen(!nav?.classList.contains('open'));
    });
    for (const link of document.querySelectorAll('.nav__link')) {
        link.addEventListener('click', () => setNavOpen(false));
    }
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape')
            return;
        if (nav?.classList.contains('open')) {
            setNavOpen(false);
            hamburger?.focus();
        }
    });
}
/* ─────────────────────────────────────────────
   BACK TO TOP
   ───────────────────────────────────────────── */
function initScrollTop() {
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
function updateBookCta() {
    bookCta?.classList.toggle('show', ctaReady && !contactInView);
}
function initBookCta() {
    if (!bookCta)
        return;
    const contact = document.getElementById('kontakt');
    if (contact && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries)
                contactInView = entry.isIntersecting;
            updateBookCta();
        }, 
        // Any sliver of the section counts — by the time its heading is visible
        // the visitor has found the form on their own.
        { threshold: 0 });
        observer.observe(contact);
    }
    // The hero carries no booking action of its own, so this is the only
    // conversion path in the first viewport and is shown from the start rather
    // than on scroll. The delay clears the cookie notice's own 600ms entrance,
    // so a first-time visitor never sees the button flash and withdraw.
    window.setTimeout(() => {
        ctaReady = true;
        updateBookCta();
    }, 1400);
}
/* ─────────────────────────────────────────────
   COOKIE NOTICE
   ───────────────────────────────────────────── */
function initCookieBanner() {
    if (!cookieBanner)
        return;
    let stored = null;
    try {
        stored = localStorage.getItem('cookieConsent');
    }
    catch {
        // Private mode / storage disabled — just show the notice.
    }
    if (stored)
        return;
    window.setTimeout(() => {
        cookieBanner.hidden = false;
        cookieBanner.classList.add('show');
        // Stands the corner stack down while the notice occupies that edge.
        document.body.classList.add('cookie-open');
    }, 600);
    const dismiss = (value) => {
        try {
            localStorage.setItem('cookieConsent', value);
        }
        catch {
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
function initCarousel() {
    if (!testimonialsTrack || !testDots)
        return;
    // Bound locally so the rest of the closure needs no non-null assertions
    const track = testimonialsTrack;
    const dotsHost = testDots;
    const slides = Array.from(track.querySelectorAll('.testimonial-card'));
    if (slides.length === 0)
        return;
    let index = 0;
    let timer = null;
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
    function goTo(next) {
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
    function stop() {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    }
    function start() {
        // Autoplay is decorative motion — skip it entirely when motion is reduced
        if (reduceMotion.matches || timer !== null)
            return;
        timer = setInterval(() => goTo(index + 1), CAROUSEL_INTERVAL);
    }
    function restart() {
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
    slider?.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') {
            goTo(index + 1);
            restart();
        }
        else if (event.key === 'ArrowLeft') {
            goTo(index - 1);
            restart();
        }
    });
    // Stop burning CPU while the tab is in the background
    document.addEventListener('visibilitychange', () => {
        if (document.hidden)
            stop();
        else
            start();
    });
    reduceMotion.addEventListener('change', () => {
        if (reduceMotion.matches)
            stop();
        else
            start();
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
function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
}
function runCounter(el) {
    const target = Number.parseInt(el.dataset.target ?? '0', 10);
    if (!Number.isFinite(target))
        return;
    const format = (value) => value.toLocaleString('cs-CZ');
    if (reduceMotion.matches) {
        el.textContent = format(target);
        return;
    }
    el.dataset.counting = 'true';
    const start = performance.now();
    const tick = (now) => {
        const progress = Math.min(1, (now - start) / COUNTER_DURATION);
        el.textContent = format(Math.round(target * easeOutCubic(progress)));
        if (progress < 1) {
            requestAnimationFrame(tick);
        }
        else {
            el.textContent = format(target);
            delete el.dataset.counting;
        }
    };
    requestAnimationFrame(tick);
}
function initCounters() {
    const counters = Array.from(document.querySelectorAll('.counter'));
    if (counters.length === 0)
        return;
    if (!('IntersectionObserver' in window)) {
        for (const counter of counters) {
            runCounter(counter);
        }
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting)
                continue;
            const el = entry.target;
            observer.unobserve(el); // each counter runs exactly once
            runCounter(el);
        }
    }, { threshold: 0.6, rootMargin: '0px 0px -40px 0px' });
    for (const counter of counters) {
        observer.observe(counter);
    }
}
const REVEAL_GROUPS = [
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
function initReveal() {
    // No IntersectionObserver (or motion reduced): show everything immediately
    if (!('IntersectionObserver' in window) || reduceMotion.matches)
        return;
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting)
                continue;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    const viewportH = window.innerHeight;
    const candidates = [];
    // ---- READ pass: no DOM mutation in here ----
    for (const group of REVEAL_GROUPS) {
        const elements = Array.from(document.querySelectorAll(group.selector));
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
        if (!belowFold)
            continue;
        el.classList.add('reveal');
        if (group.variant)
            el.classList.add(group.variant);
        // Cap the stagger so a long list (the 16 gallery tiles) never waits
        // over half a second for its turn.
        if (group.stagger)
            el.style.setProperty('--reveal-i', String(Math.min(index % 6, 5)));
        observer.observe(el);
    }
}
/* ─────────────────────────────────────────────
   CONTACT FORM
   ───────────────────────────────────────────── */
const PHONE_FALLBACK = 'Formulář zatím není propojen s e-mailem. Zavolejte nám prosím na ' +
    '<a href="tel:+420777599995">+420 777 599 995</a> nebo napište na ' +
    '<a href="mailto:info@autofoliewrap.cz">info@autofoliewrap.cz</a>.';
function setStatus(message, kind) {
    if (!formStatus)
        return;
    formStatus.innerHTML = message;
    formStatus.classList.remove('form__status--success', 'form__status--error');
    formStatus.classList.add('is-visible', `form__status--${kind}`);
}
function initContactForm() {
    if (!contactForm)
        return;
    const button = contactForm.querySelector('.form__btn');
    contactForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        // novalidate is set on the form so we can show our own message
        if (!contactForm.checkValidity()) {
            setStatus('Zkontrolujte prosím vyplněná pole – jméno, e-mail a zpráva jsou povinné.', 'error');
            contactForm.querySelector(':invalid')?.focus();
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
            const result = await response.json().catch(() => null);
            const ok = response.ok &&
                typeof result === 'object' &&
                result !== null &&
                result.success === true;
            if (!ok)
                throw new Error('Web3Forms rejected the submission');
            setStatus('Děkujeme, zpráva byla odeslána. Ozveme se vám co nejdříve.', 'success');
            contactForm.reset();
        }
        catch {
            setStatus('Zprávu se nepodařilo odeslat. Zkuste to prosím znovu, nebo nám zavolejte na ' +
                '<a href="tel:+420777599995">+420 777 599 995</a>.', 'error');
        }
        finally {
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
function initYear() {
    const year = document.getElementById('year');
    if (year)
        year.textContent = String(new Date().getFullYear());
}
/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
function init() {
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
}
else {
    init();
}
//# sourceMappingURL=main.js.map