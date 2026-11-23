'use strict';

const header = document.querySelector('[data-portal-header]');
const toggle = header.querySelector('[data-menu-toggle]');
const navigation = document.getElementById(toggle.getAttribute('aria-controls'));
const compact = matchMedia('(max-width: 780px)');

function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  navigation.hidden = compact.matches && !open;
}

function resetMenu() {
  toggle.hidden = !compact.matches;
  setMenu(false);
}

toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') === 'false'));
header.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    toggle.focus();
  }
});
compact.addEventListener('change', resetMenu);
resetMenu();

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
}
