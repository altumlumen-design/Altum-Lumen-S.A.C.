'use strict';

const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

for (const catalog of document.querySelectorAll('[data-catalog]')) {
  const publications = catalog.dataset.catalog === 'publications';
  const form = catalog.querySelector('[data-catalog-form]');
  const status = catalog.querySelector('[data-catalog-status]');
  const empty = catalog.querySelector('[data-catalog-empty]');
  const pages = catalog.querySelector('[data-catalog-pages]');
  const fields = [...form.querySelectorAll('input[name], select[name]')];
  const entries = [...catalog.querySelectorAll('[data-directory-item]')].map(element => ({
    element,
    search: normalize(element.dataset.search),
  }));
  const sections = catalog.querySelectorAll('[data-catalog-group]');
  const size = publications ? 10 : 12;
  let selectedPage = 1;
  let lastPage = 1;

  function readUrl() {
    const url = new URL(location.href);
    for (const input of fields) {
      const value = url.searchParams.get(input.name) || '';
      input.value = input.tagName === 'SELECT' && ![...input.options].some(option => option.value === value)
        ? '' : value.slice(0, 180);
    }
    selectedPage = Math.max(1, Math.floor(Number(url.searchParams.get('pagina')) || 1));
  }

  function writeUrl() {
    const url = new URL(location.href);
    for (const field of fields) {
      if (field.value.trim()) url.searchParams.set(field.name, field.value.trim());
      else url.searchParams.delete(field.name);
    }
    if (selectedPage > 1) url.searchParams.set('pagina', selectedPage);
    else url.searchParams.delete('pagina');
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  }

  function draw({fromUrl = false} = {}) {
    const {q, tipo, oficina, anio, grupo, unidad} = Object.fromEntries(fields.map(field => [field.name, field.value]));
    const terms = normalize(q || '').split(/\s+/).filter(Boolean);
    const matches = entries.filter(({element, search}) =>
      terms.every(term => search.includes(term)) &&
      (!tipo || tipo === element.dataset.type) &&
      (!oficina || oficina === element.dataset.office) &&
      (!anio || anio === element.dataset.year) &&
      (!grupo || grupo === element.dataset.group) &&
      (!unidad || unidad === element.dataset.unit)
    );
    lastPage = Math.max(1, Math.ceil(matches.length / size));
    if (fromUrl && location.hash) {
      const position = matches.findIndex(({element}) => '#' + element.id === location.hash);
      if (position >= 0) selectedPage = Math.floor(position / size) + 1;
    }
    selectedPage = Math.min(lastPage, selectedPage);
    const first = (selectedPage - 1) * size;
    const visible = new Set(matches.slice(first, first + size));
    entries.forEach(entry => { entry.element.hidden = !visible.has(entry); });
    for (const section of sections) {
      section.hidden = !section.querySelector('[data-directory-item]:not([hidden])');
    }
    empty.hidden = matches.length !== 0;
    const noun = publications ? (matches.length === 1 ? 'acto resolutivo' : 'actos resolutivos') : (matches.length === 1 ? 'cargo' : 'cargos');
    status.textContent = matches.length + ' ' + noun;
    if (pages) {
      pages.hidden = lastPage <= 1;
      pages.querySelector('[data-catalog-page]').textContent = `Página ${selectedPage} de ${lastPage}`;
      pages.querySelector('[data-page-direction="-1"]').disabled = selectedPage <= 1;
      pages.querySelector('[data-page-direction="1"]').disabled = selectedPage >= lastPage;
    }
    if (!fromUrl) writeUrl();
  }

  function changeFilters() {
    selectedPage = 1;
    draw();
  }

  form.hidden = false;
  status.hidden = false;
  fields.forEach(field => field.addEventListener(field.type === 'search' ? 'input' : 'change', changeFilters));
  form.addEventListener('submit', event => {
    event.preventDefault();
    changeFilters();
  });
  form.addEventListener('reset', event => {
    event.preventDefault();
    fields.forEach(field => { field.value = ''; });
    changeFilters();
    form.elements.q.focus();
  });

  if (pages) pages.addEventListener('click', event => {
    const button = event.target.closest('[data-page-direction]');
    if (!button || button.disabled) return;
    selectedPage += Number(button.dataset.pageDirection);
    draw();
    const heading = catalog.querySelector('h2');
    heading?.focus({preventScroll:true});
    catalog.scrollIntoView({block:'start'});
  });

  function restore() {
    readUrl();
    draw({fromUrl:true});
  }

  window.addEventListener('popstate', restore);
  restore();
}
