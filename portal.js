'use strict';

const header = document.querySelector('[data-portal-header]');
const toggle = header.querySelector('[data-menu-toggle]');
const navigation = document.getElementById(toggle.getAttribute('aria-controls'));
const compact = matchMedia('(max-width: 840px)');

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

const serviceDirectory = document.querySelector('[data-service-directory]');
const documentDirectory = document.querySelector('[data-document-directory]');
if (serviceDirectory || documentDirectory) {
  function openPreviousSection() {
    const url = new URL(location.href);
    const oldId = url.hash.slice(1);
    const anchor = document.getElementById(oldId);
    if (serviceDirectory?.contains(anchor)) {
      location.replace(anchor.querySelector('a').href);
      return;
    }
    if (!documentDirectory) return;
    if (oldId === 'mesa-de-partes') {
      location.replace('atencion.html');
      return;
    }
    if (documentDirectory.contains(anchor)) {
      const destination = new URL(anchor.href);
      destination.search = url.search;
      location.replace(destination.href);
      return;
    }
    const hasFilters = ['q','tipo','oficina','anio','pagina'].some(name => url.searchParams.has(name));
    if (hasFilters || /^\\d{5}-\\d{4}-al-[a-z0-9-]+$/i.test(oldId)) {
      const destination = new URL(documentDirectory.querySelector('#actos-resolutivos').href);
      destination.search = url.search;
      destination.hash = url.hash;
      location.replace(destination.href);
    }
  }
  window.addEventListener('hashchange', openPreviousSection);
  openPreviousSection();
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
