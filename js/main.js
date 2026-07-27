"use strict";
// ============================================
// AUTOFOLIEWRAP.CZ — TypeScript Interactivity
// ============================================
// --- DOM ELEMENTS ---
const header = document.getElementById('header');
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');
const scrollTop = document.getElementById('scrollTop');
const cookieBanner = document.getElementById('cookieBanner');
const cookieAccept = document.getElementById('cookieAccept');
const cookieDecline = document.getElementById('cookieDecline');
const testimonialsTrack = document.getElementById('testimonialsTrack');
const testPrev = document.getElementById('testPrev');
const testNext = document.getElementById('testNext');
const testDots = document.getElementById('testDots');
const contactForm = document.getElementById('contactForm');
// --- HEADER SCROLL EFFECT ---
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    // Add shadow class when scrolled
    if (currentScroll > 50) {
        header.classList.add('header--scrolled');
    }
    else {
        header.classList.remove('header--scrolled');
    }
    // Scroll to top button visibility
    if (currentScroll > 300) {
        scrollTop.classList.add('show');
    }
    else {
        scrollTop.classList.remove('show');
    }
    // Active nav link updates
    updateActiveNav(currentScroll);
    lastScroll = currentScroll;
});
// --- ACTIVE NAV LINK ---
function updateActiveNav(scrollY) {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');
    let current = '';
    sections.forEach(section => {
        const top = section.offsetTop - 150;
        const bottom = top + section.offsetHeight;
        if (scrollY >= top && scrollY < bottom) {
            current = section.getAttribute('id') || '';
        }
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}
// --- HAMBURGER MENU ---
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    nav.classList.toggle('open');
});
// Close nav on link click
document.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        nav.classList.remove('open');
    });
});
// --- SCROLL TO TOP ---
scrollTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
// --- COOKIE BANNER ---
function showCookieBanner() {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
        setTimeout(() => {
            cookieBanner.classList.add('show');
        }, 500);
    }
}
function setCookieConsent(value) {
    localStorage.setItem('cookieConsent', value);
    cookieBanner.classList.remove('show');
}
cookieAccept.addEventListener('click', () => setCookieConsent('accepted'));
cookieDecline.addEventListener('click', () => setCookieConsent('declined'));
// --- TESTIMONIALS SLIDER ---
let currentSlide = 0;
const slides = testimonialsTrack.querySelectorAll('.testimonial-card');
const totalSlides = slides.length;
function createDots() {
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('button');
        dot.className = 'testimonials__dot';
        dot.setAttribute('aria-label', `Reference ${i + 1}`);
        if (i === 0)
            dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(i));
        testDots.appendChild(dot);
    }
}
function goToSlide(index) {
    currentSlide = index;
    testimonialsTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    // Update dots
    document.querySelectorAll('.testimonials__dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}
function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    goToSlide(currentSlide);
}
function prevSlide() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    goToSlide(currentSlide);
}
testNext.addEventListener('click', nextSlide);
testPrev.addEventListener('click', prevSlide);
// Auto-play
let autoPlay = setInterval(nextSlide, 5000);
// Pause on hover
const slider = document.getElementById('testimonialsSlider');
slider.addEventListener('mouseenter', () => clearInterval(autoPlay));
slider.addEventListener('mouseleave', () => {
    autoPlay = setInterval(nextSlide, 5000);
});
// --- COUNTER ANIMATION ---
function animateCounters() {
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
        // Skip already animated counters
        if (counter.getAttribute('data-animated') === 'true')
            return;
        counter.setAttribute('data-animated', 'true');
        const target = parseInt(counter.getAttribute('data-target') || '0', 10);
        const step = Math.max(1, Math.floor(target / 60));
        let current = 0;
        const updateCounter = () => {
            current += step;
            if (current >= target) {
                counter.textContent = target.toLocaleString('cs-CZ');
                return;
            }
            counter.textContent = current.toLocaleString('cs-CZ');
            requestAnimationFrame(() => setTimeout(updateCounter, 30));
        };
        updateCounter();
    });
}
// --- INTERSECTION OBSERVER FOR ANIMATIONS ---
function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // If this section has counters, start them
                if (entry.target.querySelector('.counter')) {
                    animateCounters();
                }
                // Don't unobserve — let counters re-trigger if needed
            }
        });
    }, { threshold: 0.2 });
    // Observe sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('fade-in');
        observer.observe(section);
    });
    // Also observe hero boxes and process steps individually
    document.querySelectorAll('.hero__box, .process__step').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}
// --- CONTACT FORM ---
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(contactForm);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value.toString();
        });
        const submitBtn = contactForm.querySelector('.form__btn');
        submitBtn.textContent = 'Odesílám...';
        submitBtn.disabled = true;
        // Simulate sending (replace with actual API call)
        setTimeout(() => {
            submitBtn.textContent = 'Zpráva odeslána ✓';
            submitBtn.style.background = '#4caf50';
            submitBtn.style.color = '#fff';
            setTimeout(() => {
                contactForm.reset();
                submitBtn.textContent = 'Odeslat zprávu';
                submitBtn.disabled = false;
                submitBtn.style.background = '';
                submitBtn.style.color = '';
            }, 3000);
        }, 1500);
    });
}
// --- KEYBOARD NAVIGATION ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hamburger.classList.remove('active');
        nav.classList.remove('open');
    }
});
// --- INIT ---
function init() {
    showCookieBanner();
    createDots();
    setupScrollAnimations();
    // Check initial scroll position
    if (window.scrollY > 300) {
        scrollTop.classList.add('show');
    }
}
// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
//# sourceMappingURL=main.js.map