// Theme toggle, mobile menu, section highlighting and scroll-reveal.
// The page works without JavaScript: the menu links are repeated in the footer, `.reveal` only hides
// content once `html.js` is set (inline script in <head>), and the theme follows the system.
(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Theme */
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');
  const themeColors = { light: '#f7f7fb', dark: '#0b0b12' };
  const syncTheme = () => {
    const theme = currentTheme();
    themeToggle?.setAttribute('aria-label', themeToggle.dataset[theme === 'dark' ? 'labelLight' : 'labelDark']);
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', themeColors[theme]));
  };
  themeToggle?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    syncTheme();
  });
  systemDark.addEventListener('change', () => { if (!root.dataset.theme) syncTheme(); });
  syncTheme();

  /* Header border once scrolled */
  const header = document.querySelector('[data-header]');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Mobile menu */
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  const desktop = window.matchMedia('(min-width: 1001px)');
  const isOpen = () => toggle?.getAttribute('aria-expanded') === 'true';
  const setOpen = (open) => {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  toggle?.addEventListener('click', () => setOpen(!isOpen()));
  nav?.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('click', (event) => {
    if (isOpen() && !event.target.closest('[data-nav], [data-menu-toggle]')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) { setOpen(false); toggle.focus(); }
  });
  desktop.addEventListener('change', (event) => { if (event.matches) setOpen(false); });

  /* Highlight the section in view */
  // Nav links are "./#id" or "../#id" so they work from every page; spy only on this one.
  const links = Array.from(document.querySelectorAll('[data-nav] a[href*="#"]'))
    .filter((link) => link.pathname === location.pathname);
  const sections = links.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    let current = null;
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) current = entry.target.id; });
      links.forEach((link) => {
        if (link.hash.slice(1) === current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((section) => spy.observe(section));
  }

  /* Reveal on scroll */
  const revealables = document.querySelectorAll('.reveal');
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-in'));
  } else {
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); reveal.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealables.forEach((el) => reveal.observe(el));
  }
})();
