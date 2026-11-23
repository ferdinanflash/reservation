/* State 3475 — Scroll-Craft home polish.
 * Only decorates the existing home dashboard; app workflows stay untouched.
 */
(() => {
  const init = () => {
    const banner = document.querySelector('.fire-banner');
    const targets = [
      document.querySelector('.banner-container'),
      document.querySelector('.dashboard-welcome'),
      document.querySelector('.dashboard-section-heading'),
      ...document.querySelectorAll('#main-menu-links > .menu-card')
    ].filter(Boolean);

    if (!targets.length) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('home-sc-visible'));
      return;
    }

    targets.forEach((el, index) => {
      el.classList.add('home-sc-reveal');
      if (el.matches('#main-menu-links > .menu-card')) {
        el.style.transitionDelay = Math.min(index * 65, 260) + 'ms';
      }
    });

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('home-sc-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -28px 0px' });
    targets.forEach(el => observer.observe(el));

    if (banner && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      banner.addEventListener('pointermove', event => {
        const rect = banner.getBoundingClientRect();
        banner.style.setProperty('--sc-pointer-x', ((event.clientX - rect.left) / rect.width * 100) + '%');
        banner.style.setProperty('--sc-pointer-y', ((event.clientY - rect.top) / rect.height * 100) + '%');
      }, { passive: true });
      banner.addEventListener('pointerleave', () => {
        banner.style.setProperty('--sc-pointer-x', '50%');
        banner.style.setProperty('--sc-pointer-y', '50%');
      }, { passive: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
