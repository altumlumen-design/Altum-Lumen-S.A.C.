'use strict';

const header = document.querySelector('[data-portal-header]');
const toggle = header.querySelector('[data-menu-toggle]');
const navigation = document.getElementById(toggle.getAttribute('aria-controls'));
const compact = matchMedia('(max-width: 780px)');

function menuOpen() {
  return toggle.getAttribute('aria-expanded') === 'true';
}

function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  navigation.hidden = compact.matches && !open;
}

function resetMenu() {
  toggle.hidden = !compact.matches;
  setMenu(false);
}

toggle.addEventListener('click', () => setMenu(!menuOpen()));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuOpen()) {
    setMenu(false);
    toggle.focus();
  }
});
document.addEventListener('pointerdown', event => {
  if (menuOpen() && !header.contains(event.target)) setMenu(false);
});
header.addEventListener('focusout', event => {
  if (menuOpen() && event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
});
compact.addEventListener('change', resetMenu);
header.closest('.institution-header').classList.add('has-menu');
resetMenu();

const sectionLinks = document.querySelectorAll('.section-index a[href^="#"]');
if (sectionLinks.length) {
  const markSection = () => {
    for (const link of sectionLinks) {
      if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  window.addEventListener('hashchange', markSection);
  markSection();
}

const copyContact = document.querySelector('[data-copy-contact]');
if (copyContact && navigator.clipboard?.writeText) {
  const contact = copyContact.closest('.profile-contact');
  const email = contact.querySelector('a').textContent.trim();
  const status = contact.querySelector('[role="status"]');
  copyContact.hidden = false;
  copyContact.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email);
      status.textContent = 'Correo copiado.';
    } catch {
      status.textContent = 'Selecciona el correo para copiarlo.';
    }
  });
}

if (document.body.classList.contains('portal-home')) {
  const previousRoutes = {
    '#nosotros': 'informacion-institucional.html',
    '#funcionarios': 'directorio.html',
    '#contacto': 'atencion.html#contacto',
    '#sistema-sgd': 'sgd.html',
  };
  function openPreviousRoute() {
    const destination = previousRoutes[location.hash];
    if (destination) location.replace(destination);
  }
  window.addEventListener('hashchange', openPreviousRoute);
  openPreviousRoute();

  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('section-entered');
        observer.unobserve(entry.target);
      }
    }, {threshold: 0.12});
    document.querySelectorAll('.service-preview, .publication-preview').forEach(section => observer.observe(section));
  }
}
