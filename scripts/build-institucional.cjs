const portalViews = require('./portal-pages.cjs');
const createLayout = require('./portal-layout.cjs');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = 'https://altumlumen-design.github.io/Altum-Lumen-S.A.C./';
const checkOnly = process.argv.includes('--check');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const {actos, gestion} = JSON.parse(read('data/publicaciones.json'));
const {personas, cambios} = JSON.parse(read('data/directorio.json'));
const byCode = new Map(actos.map(record => [record.code, record]));
const shortDate = new Intl.DateTimeFormat('es-PE', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
const longDate = new Intl.DateTimeFormat('es-PE', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
const groups = ['Alta dirección', 'Asesoramiento', 'Apoyo', 'Órganos de línea'];
const collator = new Intl.Collator('es-PE', {sensitivity:'base', numeric:true});
const escape = value => String(value ?? '').replace(/[&<>"']/g, mark => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[mark]));

const icons = {
  inbox: '<path d="M4 4h16v12l-3 4H7l-3-4V4Zm0 10h5l1 2h4l1-2h5m-8-7v5m-2-2 2 2 2-2"/>',
  shield: '<path d="M12 3l8 3v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Zm-3 9 2 2 4-5"/>',
  note: '<path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5h5m-5 4h5m-10 4h14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  document: '<path d="M7 3h7l4 4v14H7zM14 3v5h4M10 12h5m-5 4h5"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  people: '<circle cx="10" cy="8" r="3"/><path d="M4 19v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m1-14a3 3 0 0 1 0 6m4 8v-2a5 5 0 0 0-3-5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  external: '<path d="M13 5h6v6m0-6-8 8m6 0v6H5V7h6"/>',
  download: '<path d="M12 3v11m-4-4 4 4 4-4M5 17v4h14v-4"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  mail: '<path d="M3 5h18v14H3zm0 1 9 7 9-7"/>',
};

function icon(name) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
}

function writtenDate(date, format = longDate) {
  return format.format(new Date(date + 'T00:00:00Z'));
}
const time = (date, format) => `<time datetime="${escape(date)}">${escape(writtenDate(date, format))}</time>`;
const pdfLink = (pdf, depth = '', label = 'Abrir PDF') =>
  `<a class="document-link" href="${escape(depth + pdf)}" target="_blank" rel="noopener">${icon('document')} <span>${escape(label)}</span></a>`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function verifyPdf(pdf) {
  assert(/^documentos\/[a-z0-9/-]+\.pdf$/i.test(pdf), `Ruta documental inválida: ${pdf}`);
  const file = fs.readFileSync(path.join(root, pdf));
  assert(file.subarray(0, 5).toString() === '%PDF-', `El archivo no es un PDF: ${pdf}`);
}
function verifyDate(value) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0,10) === value, `Fecha inválida: ${value}`);
}

assert(byCode.size === actos.length, 'Hay correlativos duplicados.');
assert(new Set(actos.map(record => record.id)).size === actos.length, 'Hay identificadores documentales duplicados.');
for (const record of actos) {
  assert(/^[a-z0-9-]+$/.test(record.id), `Identificador inválido: ${record.id}`);
  assert(record.title && record.type && record.office && record.summary, `Ficha incompleta: ${record.id}`);
  verifyPdf(record.pdf);
  verifyDate(record.issuedOn);
  const date = record.publishedAt.slice(0,10);
  verifyDate(date);
  assert(date >= record.issuedOn && Number.isFinite(Date.parse(record.publishedAt)), `Fecha de incorporación inválida: ${record.id}`);
}
for (const item of gestion) verifyPdf(item.pdf);
assert(new Set(personas.map(person => person.id)).size === personas.length, 'Hay perfiles duplicados.');
for (const person of personas) {
  assert(/^[a-z0-9-]+$/.test(person.id) && person.name && person.roles.length, 'Perfil inválido.');
  if (person.photo) assert(/^funcionario-[\w-]+\.(?:png|webp)$/.test(person.photo) && fs.existsSync(path.join(root, person.photo)), `Retrato inválido: ${person.id}`);
  assert(new Set(person.roles.map(role => role.id)).size === person.roles.length, `Cargos duplicados: ${person.name}`);
  for (const role of person.roles) {
    assert(/^[a-z0-9-]+$/.test(role.id) && Number.isSafeInteger(role.orden) && role.orden > 0, `Identificador u orden inválido: ${role.title}`);
    verifyDate(role.effectiveOn);
    assert(groups.includes(role.group) && /^[^\s<>]+@[^\s<>]+$/.test(role.email), `Cargo inválido: ${role.title}`);
    for (const reference of role.references) assert(byCode.has(reference), `Resolución ausente: ${reference}`);
  }
}
for (const entry of cambios) {
  verifyDate(entry.date);
  for (const reference of entry.references) assert(byCode.has(reference), `Resolución ausente: ${reference}`);
}

const recent = [...actos].sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
  b.issuedOn.localeCompare(a.issuedOn) || collator.compare(b.code, a.code));
const types = [...new Set(actos.map(record => record.type))].sort(collator.compare);
const offices = [...new Set(actos.map(record => record.office))].sort(collator.compare);
const years = [...new Set(actos.map(record => record.year))].sort((a,b) => b-a);
const profilePath = person => 'funcionarios/' + person.id + '.html';
const rolePath = (person, role) => 'funcionarios/' + person.id + '/' + role.id + '.html';
const directoryRoles = personas.flatMap(person => person.roles.map(role => ({person, role})))
  .sort((a, b) => a.role.orden - b.role.orden);
assert(new Set(directoryRoles.map(({role}) => role.orden)).size === directoryRoles.length, 'Hay cargos con el mismo orden institucional.');
const options = values => values.map(value => `<option value="${escape(value)}">${escape(value)}</option>`).join('');
const assets = new Map(['institucional.css', 'portal.css', 'portal.js', 'institucional.js'].map(file => {
  const revision = createHash('sha256').update(read(file)).digest('hex').slice(0, 10);
  return [file, file + '?v=' + revision];
}));
const page = createLayout({base, icon, escape, assets});

function breadcrumb(parts, depth = '') {
  return `<nav class="breadcrumbs" aria-label="Ruta de navegación"><ol><li><a href="${depth}index.html">Inicio</a></li>
    ${parts.map(([title, href]) => href
      ? `<li><a href="${depth + href}">${escape(title)}</a></li>`
      : `<li aria-current="page">${escape(title)}</li>`).join('')}</ol></nav>`;
}

function masthead(title, description, crumbs, aside = '') {
  return `<div class="masthead"><div class="layout">
    ${crumbs}
    <div class="masthead-inner">
      <div><h1>${escape(title)}</h1>${description ? `<p>${escape(description)}</p>` : ''}</div>
${aside}
    </div>
  </div></div>`;
}

function publicationCards() {
  return recent.map(record => {
    const publishedOn = record.publishedAt.slice(0, 10);
    const search = [record.title, record.summary, record.office].join(' ');
    return `<li class="publication" id="${escape(record.id)}" data-directory-item data-search="${escape(search)}" data-type="${escape(record.type)}" data-office="${escape(record.office)}" data-year="${record.year}">
      <div class="publication-meta"><span>Publicación</span><strong>${time(publishedOn, shortDate)}</strong></div>
      <div class="publication-body">
        <p class="record-office">${escape(record.office)}</p>
        <h3><a href="${escape(record.pdf)}" target="_blank" rel="noopener">${escape(record.title)}</a></h3>
        <p class="record-summary">${escape(record.summary)}</p>
        <p class="document-date">Emitido el ${time(record.issuedOn)}</p>
      </div>
      <div class="publication-actions">
        ${pdfLink(record.pdf)}
        <a class="download-link" href="${escape(record.pdf)}" download>${icon('download')} <span>Descargar</span><span class="sr-only"> ${escape(record.title)}</span></a>
      </div>
    </li>`;
  }).join('\n');
}

function managementCards(items) {
  return items.map(item => `<article class="management-card">
    <span class="tile-icon">${icon('folder')}</span>
    <h3><a href="${escape(item.pdf)}" target="_blank" rel="noopener">${escape(item.title)}</a></h3>
    <p>${escape(item.description)}</p>
    ${pdfLink(item.pdf)}
  </article>`).join('\n');
}

function searchForm({label, placeholder, filters}) {
  return `<form class="filter-form" data-catalog-form role="search" aria-label="${escape(label)}" hidden>
    <div class="filter-search"><label for="catalog-query">Buscar</label><div class="search-input">${icon('search')}
      <input id="catalog-query" name="q" type="search" autocomplete="off" placeholder="${escape(placeholder)}"></div></div>
    ${filters.map(({name,title,values,empty}) =>
      `<div><label for="catalog-${name}">${title}</label><select id="catalog-${name}" name="${name}"><option value="">${empty}</option>${options(values)}</select></div>`
    ).join('\n')}
    <button class="button button-quiet" type="reset">Limpiar</button>
  </form>`;
}

const catalogStatus = `<p class="result-status" role="status" data-catalog-status hidden></p>`;

function resultControls(pageControls) {
  return `<div class="empty-state" data-catalog-empty hidden><strong>No se encontraron resultados</strong><p>Prueba otro término o limpia los filtros.</p></div>
${pageControls?`<nav class="pagination" aria-label="Páginas de resultados" data-catalog-pages hidden>
      <button type="button" class="button button-quiet" data-page-direction="-1">Anterior</button>
      <span data-catalog-page></span>
      <button type="button" class="button button-quiet" data-page-direction="1">Siguiente</button>
    </nav>`:''}`;
}

function transparency() {
  const shortcuts = `<nav class="layout section-links" aria-label="Secciones de Transparencia">
      <a href="#actos-resolutivos">${icon('document')} <span>Actos resolutivos</span> ${icon('arrow')}</a>
      <a href="#documentos-gestion">${icon('folder')} <span>Documentos de gestión</span> ${icon('arrow')}</a>
    </nav>`;
  const publishedYear = Math.max(...gestion.map(item => item.year));
  return masthead('Transparencia institucional', 'Consulta resoluciones, instrumentos de gestión y canales de atención de Altum Lumen.',
    breadcrumb([['Transparencia']])) + shortcuts + `
  <section id="actos-resolutivos" class="layout content-section" data-catalog="publications">
    <div class="section-title"><h2 tabindex="-1">Actos resolutivos</h2><p>Ordenados del más reciente al más antiguo por fecha de publicación.</p></div>
    ${searchForm({label:'Buscar actos resolutivos',placeholder:'Número o asunto',filters:[
      {name:'tipo',title:'Tipo de documento',values:types,empty:'Todos'},
      {name:'oficina',title:'Órgano emisor',values:offices,empty:'Todos'},
      {name:'anio',title:'Año del acto',values:years,empty:'Todos'},
    ]})}
    ${catalogStatus}
    <ol class="publication-list" data-catalog-list>${publicationCards()}</ol>
    ${resultControls(true)}
  </section>
  <section id="documentos-gestion" class="content-section section-shaded">
    <div class="layout">
      <div class="section-title"><h2>Documentos de gestión</h2><p>Consulta los instrumentos de organización institucional y sus versiones anteriores.</p></div>
      <div class="management-grid">${managementCards(gestion.filter(item => item.year === publishedYear))}</div>
      <details class="archive"><summary>Versiones anteriores</summary><div class="management-grid">${managementCards(gestion.filter(item => item.year !== publishedYear))}</div></details>
    </div>
  </section>
  <div id="mesa-de-partes" class="layout compact-section">
    <a class="text-link" href="atencion.html">Canales de atención documentaria ${icon('arrow')}</a>
  </div>`;
}

function portrait(person, depth = '') {
  const name = person.name.split(/\s+/);
  const initials = name[0][0] + name.at(-2)[0];
  return person.photo
    ? `<img class="portrait" src="${escape(depth + person.photo)}" alt="" width="96" height="110" loading="lazy" decoding="async">`
    : `<span class="portrait portrait-initials" aria-hidden="true">${escape(initials)}</span>`;
}

function references(codes, depth = '', fallback = '') {
  if (!codes.length) return escape(fallback);
  return codes.map(code => pdfLink(byCode.get(code).pdf, depth, byCode.get(code).title)).join('\n');
}

function directory() {
  const sections = groups.map(group => {
    const cards = directoryRoles.filter(({role}) => role.group === group).map(({person, role}) => {
      const search = [person.name, role.title, role.office, role.temporary ? 'designación temporal' : ''].join(' ');
      const title = escape(role.title);
      return `<li data-directory-item data-group="${escape(group)}" data-unit="${escape(role.office)}" data-search="${escape(search)}">
      <article class="position-tile">
        ${portrait(person)}
        <div class="position-card-copy">
          <p class="record-office">${escape(role.office)}</p>
          <h4>${escape(person.name)}</h4>
          <p class="position-title">${title}</p>
${role.temporary ? '          <p class="position-mark">Designación temporal</p>\n' : ''}          <a class="position-mail" href="mailto:${escape(role.email)}">${escape(role.email)}</a>
          <a class="text-link" href="${rolePath(person, role)}" aria-label="Ver ficha de ${title}, ${escape(person.name)}">Ver ficha ${icon('arrow')}</a>
        </div>
      </article>
    </li>`;
    }).join('\n');
    return `<section class="position-group" data-catalog-group>
      <h3>${escape(group)}</h3><ul class="person-list">${cards}</ul>
    </section>`;
  }).join('\n');
  const updates = cambios.map(change =>
    `<li><div class="record-office">${time(change.date, shortDate)}</div><p>${escape(change.summary)}</p>${references(change.references)}</li>`
  ).join('\n');
  return masthead('Directorio institucional', 'Consulta los cargos, contactos institucionales y actos de designación del equipo de Altum Lumen.',
    breadcrumb([['Directorio']])) + `
  <section class="layout content-section" data-catalog="directory" aria-labelledby="directory-results-title">
    <h2 id="directory-results-title" class="sr-only" tabindex="-1">Cargos del directorio</h2>
    ${searchForm({label:'Buscar en el directorio',placeholder:'Nombre, cargo o dependencia',
      filters:[
        {name:'unidad',title:'Unidad orgánica',values:[...new Set(directoryRoles.map(({role})=>role.office))].sort(collator.compare),empty:'Todas'},
        {name:'grupo',title:'Grupo orgánico',values:groups,empty:'Todos'},
      ]})}
    ${catalogStatus}
    ${sections}
    ${resultControls(true)}
  </section>
  <section class="section-shaded content-section" aria-labelledby="government-title">
    <div class="layout directory-lower">
      <div><h2 id="government-title">Junta General de Accionistas</h2><p>Órgano supremo de dirección societaria de Altum Lumen S.A.C.</p>
        <dl class="record-details"><div><dt>Constitución</dt><dd>${time('2025-06-24')}</dd></div>
          <div><dt>Acreditación registral</dt><dd>Partida Registral N.° 15949500</dd></div></dl>
      </div>
      <div><h2>Últimas actualizaciones del directorio</h2><ol class="updates">${updates}</ol></div>
    </div>
  </section>`;
}

function profile(person) {
  const depth = '../';
  const roles = person.roles.map(role => `<article class="role-card">
    <div class="role-heading"><p class="record-office">${escape(role.office)}</p>
      <h3>${escape(role.title)}</h3>
${role.temporary ? '      <p class="temporary">Designación temporal</p>\n' : ''}      <a class="text-link" href="${depth + rolePath(person, role)}">Ver ficha de este cargo ${icon('arrow')}</a>
    </div>
    <dl class="record-details">
      <div><dt>Fecha de designación</dt><dd>${time(role.effectiveOn)}</dd></div>
      <div><dt>Documento de designación</dt><dd class="designation-links">${references(role.references, depth, role.referenceLabel)}</dd></div>
      <div><dt>Correo institucional</dt><dd><a href="mailto:${escape(role.email)}">${escape(role.email)}</a></dd></div>
    </dl>
  </article>`).join('\n');
  const description = `Cargos institucionales y documentos de designación de ${person.name} en Altum Lumen S.A.C.`;
  const main = `<div class="masthead"><div class="layout">
    ${breadcrumb([['Directorio','directorio.html'], [person.name]], depth)}
    <div class="profile-heading">${portrait(person,depth)}<div><h1>${escape(person.name)}</h1><p>${escape(person.roles[0].title)}${person.roles[0].temporary?' (DT)':''}</p></div></div>
  </div></div>
  <section class="layout content-section profile-roles"><div class="section-title"><h2>Cargos y designaciones</h2></div>
    <div class="role-list">${roles}</div>
    <p class="back-link"><a class="button button-quiet" href="../directorio.html">Volver al directorio</a></p>
  </section>`;
  const structured = {'@context':'https://schema.org','@type':'Person',name:person.name,
    jobTitle:person.roles.map(role => role.title),url:base + profilePath(person),
    worksFor:{'@type':'Organization',name:'ALTUM LUMEN S.A.C.',url:base}};
  if (person.photo) structured.image = base + person.photo;
  return page({title:person.name,pagePath:profilePath(person),description,active:'directory',depth,main,structured});
}

function roleProfile(person, role) {
  const depth = '../../';
  const pagePath = rolePath(person, role);
  const description = `${person.name}. ${role.title}, ${role.office}, Altum Lumen S.A.C.`;
  const crumbs = breadcrumb([['Directorio','directorio.html'], [role.title]], depth);
  const main = `<div class="masthead"><div class="layout">
    ${crumbs}
    <div class="profile-heading">
      ${portrait(person,depth)}
      <div><h1>${escape(person.name)}</h1><p>${escape(role.title)}</p>
${role.temporary ? '        <p class="position-mark">Designación temporal</p>\n' : ''}      </div>
    </div>
  </div></div>
  <section class="layout content-section profile-roles" aria-labelledby="role-detail-title">
    <div class="section-title"><h2 id="role-detail-title">Datos del cargo</h2></div>
    <dl class="record-details role-profile-details">
      <div><dt>Unidad orgánica</dt><dd>${escape(role.office)}</dd></div>
      <div><dt>Grupo orgánico</dt><dd>${escape(role.group)}</dd></div>
      <div><dt>Fecha de inicio</dt><dd>${time(role.effectiveOn)}</dd></div>
      <div><dt>Correo institucional</dt><dd><a href="mailto:${escape(role.email)}">${escape(role.email)}</a></dd></div>
      <div class="role-designation"><dt>Documento de designación</dt><dd class="designation-links">${references(role.references, depth, role.referenceLabel)}</dd></div>
    </dl>
    <div class="role-nav">
      <a class="button button-quiet" href="${depth}directorio.html">Volver al directorio</a>
${person.roles.length > 1 ? `      <a class="text-link" href="${depth + profilePath(person)}">Ver otros cargos de ${escape(person.name)} ${icon('arrow')}</a>` : ''}
    </div>
  </section>`;
  const structured = {'@context':'https://schema.org','@type':'Person',name:person.name,jobTitle:role.title,
    url:base + pagePath,worksFor:{'@type':'Organization',name:'ALTUM LUMEN S.A.C.',url:base}};
  if (person.photo) structured.image = base + person.photo;
  return page({title:role.title + ' · ' + person.name,pagePath,description,active:'directory',depth,main,structured});
}

function update(file, content) {
  const target = path.join(root, file);
  if (checkOnly) {
    assert(fs.existsSync(target) && read(file).replace(/\r\n/g,'\n') === content.replace(/\r\n/g,'\n'), `Archivo desactualizado: ${file}`);
    return;
  }
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, content);
}

function replaceSection(source, name, content) {
  const start = `<!-- ${name} -->`;
  const end = `<!-- /${name} -->`;
  const i = source.indexOf(start);
  const j = source.indexOf(end);
  assert(i >= 0 && j > i, `Falta la sección ${name}.`);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const indent = source.slice(source.lastIndexOf('\n', i) + 1, i);
  return source.slice(0, i + start.length) + newline + content.replace(/\n/g, newline) +
    newline + indent + source.slice(j);
}

const corporatePages = portalViews({icon, escape, masthead, breadcrumb, time, shortDate, pdfLink, byCode, recent, base});
for (const corporate of corporatePages) update(corporate.pagePath, page(corporate));
update('transparencia.html', page({title:'Transparencia institucional',pagePath:'transparencia.html',active:'publications',script:true,
  description:'Actos resolutivos y documentos de gestión publicados por Altum Lumen S.A.C. Busca por órgano emisor, tipo de resolución, año o asunto.',main:transparency()}));
const directorySchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Directorio institucional de Altum Lumen',
  itemListElement: directoryRoles.map(({person, role}, index) => ({
    '@type': 'ListItem', position: index + 1,
    item: {'@type': 'Person', name: person.name, jobTitle: role.title, url: base + rolePath(person, role)},
  })),
};
update('directorio.html', page({title:'Directorio institucional',pagePath:'directorio.html',active:'directory',script:true,
  description:'Consulta por nombre, cargo o unidad orgánica el directorio institucional, los contactos y las designaciones del equipo de Altum Lumen S.A.C.',main:directory(),structured:directorySchema}));
for (const person of personas) update(profilePath(person), profile(person));
for (const {person, role} of directoryRoles) update(rolePath(person, role), roleProfile(person, role));
let sitemap = read('sitemap.xml').replace(/\r\n/g,'\n');
const directoryPages = ['servicios.html', 'atencion.html', 'directorio.html', ...personas.map(profilePath), ...directoryRoles.map(({person, role}) => rolePath(person, role))];
const sitemapItems = directoryPages.map(file => `  <url><loc>${base + file}</loc></url>`).join('\n');
sitemap = replaceSection(sitemap, 'directorio-institucional', sitemapItems);
update('sitemap.xml', sitemap);
console.log(`${checkOnly?'Verificados':'Generados'} ${actos.length} actos, ${gestion.length} instrumentos de gestión, ${personas.length} personas y ${directoryRoles.length} fichas de cargo.`);
