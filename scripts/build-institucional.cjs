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
const {personas} = JSON.parse(read('data/directorio.json'));
const byCode = new Map(actos.map(record => [record.code, record]));
const shortDate = new Intl.DateTimeFormat('es-PE', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
const longDate = new Intl.DateTimeFormat('es-PE', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
const groupNames = {
  'Alta dirección': 'Órganos de la Alta Dirección',
  'Asesoramiento': 'Administración interna · Órganos de Asesoramiento',
  'Apoyo': 'Administración interna · Órganos de Apoyo',
  'Órganos de línea': 'Órganos de Línea',
};
const groups = Object.keys(groupNames);
const collator = new Intl.Collator('es-PE', {sensitivity:'base', numeric:true});
const escape = value => String(value ?? '').replace(/[&<>"']/g, mark => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[mark]));

const icons = {
  inbox: '<path d="M4 4h16v12l-3 4H7l-3-4V4Zm0 10h5l1 2h4l1-2h5m-8-7v5m-2-2 2 2 2-2"/>',
  shield: '<path d="M12 3l8 3v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Zm-3 9 2 2 4-5"/>',
  note: '<path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5h5m-5 4h5m-10 4h14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  document: '<path d="M7 3h7l4 4v14H7zM14 3v5h4M10 12h5m-5 4h5"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  silhouette: '<circle cx="12" cy="8" r="3.8" fill="currentColor" stroke="none"/><path d="M4.4 20a7.6 6.4 0 0 1 15.2 0Z" fill="currentColor" stroke="none"/>',
  board: '<g fill="currentColor" stroke="none"><circle cx="5" cy="9" r="2.4" opacity=".72"/><circle cx="19" cy="9" r="2.4" opacity=".72"/><circle cx="12" cy="6.5" r="3"/><path d="M.8 18a4.3 5.2 0 0 1 7.1-4 7.3 7.3 0 0 0-1.5 4H.8Zm22.4 0h-5.6a7.3 7.3 0 0 0-1.5-4 4.3 5.2 0 0 1 7.1 4Z" opacity=".72"/><path d="M6.8 20v-2.4a5.2 5.2 0 0 1 10.4 0V20Z"/></g>',
  people: '<circle cx="10" cy="8" r="3"/><path d="M4 19v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m1-14a3 3 0 0 1 0 6m4 8v-2a5 5 0 0 0-3-5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  external: '<path d="M13 5h6v6m0-6-8 8m6 0v6H5V7h6"/>',
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
const pdfLink = (pdf, depth = '') =>
  `<a class="document-link" href="${escape(depth + pdf)}" target="_blank" rel="noopener">${icon('document')} <span>Ver PDF</span></a>`;

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
  if (record.bundle || record.annex) {
    verifyPdf(record.bundle);
    verifyPdf(record.annex);
  }
  verifyDate(record.issuedOn);
  assert(Number(record.issuedOn.slice(0, 4)) === record.year, `Año de emisión inválido: ${record.id}`);
}
for (const item of gestion) verifyPdf(item.pdf);
assert(new Set(personas.map(person => person.id)).size === personas.length, 'Hay perfiles duplicados.');
for (const person of personas) {
  assert(/^[a-z0-9-]+$/.test(person.id) && person.name && person.roles.length, 'Perfil inválido.');
  assert(typeof person.summary === 'string' && person.summary.trim(), `Resumen ausente: ${person.name}`);
  if (person.photo) assert(/^funcionario-[\w-]+\.(?:png|webp)$/.test(person.photo) && fs.existsSync(path.join(root, person.photo)), `Retrato inválido: ${person.id}`);
  assert(new Set(person.roles.map(role => role.id)).size === person.roles.length, `Cargos duplicados: ${person.name}`);
  for (const role of person.roles) {
    assert(/^[a-z0-9-]+$/.test(role.id) && Number.isSafeInteger(role.orden) && role.orden > 0, `Identificador u orden inválido: ${role.title}`);
    assert(typeof role.responsibilities === 'string' && role.responsibilities.trim(), `Funciones ausentes: ${role.title}`);
    verifyDate(role.effectiveOn);
    assert(groups.includes(role.group) && /^[^\s<>]+@[^\s<>]+$/.test(role.email), `Cargo inválido: ${role.title}`);
    const {code, article, label} = role.designation;
    if (code) {
      assert(byCode.has(code) && Number.isSafeInteger(article) && article > 0, `Designación inválida: ${role.title}`);
    } else {
      assert(label, `Sustento ausente: ${role.title}`);
    }
  }
}

const recent = [...actos].sort((a,b) => b.issuedOn.localeCompare(a.issuedOn) || collator.compare(b.code, a.code));
const types = [...new Set(actos.map(record => record.type))].sort(collator.compare);
const offices = [...new Set(actos.map(record => record.office))].sort(collator.compare);
const years = [...new Set(actos.map(record => record.year))].sort((a,b) => b-a);
const profilePath = person => 'funcionarios/' + person.id + '.html';
const rolePath = (person, role) => 'funcionarios/' + person.id + '/' + role.id + '.html';
const actPath = record => 'actos/' + record.id + '.html';
const managementPath = item => item.pdf.replace(/\.pdf$/, '.html');
const directoryRoles = personas.flatMap(person => person.roles.map(role => ({person, role})))
  .sort((a, b) => a.role.orden - b.role.orden);
assert(new Set(directoryRoles.map(({role}) => role.orden)).size === directoryRoles.length, 'Hay cargos con el mismo orden institucional.');
const options = (values, labels) => values.map(value =>
  `<option value="${escape(value)}">${escape(labels?.[value] ?? value)}</option>`
).join('');
const assets = new Map(['institucional.css', 'portal.css', 'portal.js', 'institucional.js'].map(file => {
  const revision = createHash('sha256').update(read(file).replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
  return [file, file + '?v=' + revision];
}));
const page = createLayout({base, icon, escape, assets});
const organization = {'@type':'Organization','@id':base + '#organization',name:'ALTUM LUMEN S.A.C.',url:base};
const boardName = 'Junta General de Accionistas';
const registration = 'Partida Registral N.° 15949500';

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
    const search = [record.title, record.code, record.summary, record.office,
      ...relatedDesignations(record).map(({person}) => person.name)].join(' ');
    const pdf = record.bundle || record.pdf;
    return `<li class="publication" id="${escape(record.id)}" data-directory-item data-search="${escape(search)}" data-type="${escape(record.type)}" data-office="${escape(record.office)}" data-year="${record.year}">
      <div class="publication-meta"><span>Emisión</span><strong>${time(record.issuedOn, shortDate)}</strong></div>
      <div class="publication-body">
        <p class="record-office">${escape(record.office)}</p>
        <h3><a class="record-title-link" href="${actPath(record)}">${escape(record.title)}</a></h3>
        <p class="record-summary">${escape(record.summary)}</p>
      </div>
      <div class="publication-actions">
        ${pdfLink(pdf)}
      </div>
    </li>`;
  }).join('\n');
}

function managementCards(items) {
  return items.map(item => `<article class="management-card">
    <span class="tile-icon">${icon('folder')}</span>
    <h3><a class="record-title-link" href="${managementPath(item)}">${escape(item.title)}</a></h3>
    <p>${escape(item.description)}</p>
    ${pdfLink(item.pdf)}
  </article>`).join('\n');
}

function searchForm({label, placeholder, filters}) {
  return `<form class="filter-form" data-catalog-form role="search" aria-label="${escape(label)}" hidden>
    <div class="filter-search"><label for="catalog-query">Buscar</label><div class="search-input">${icon('search')}
      <input id="catalog-query" name="q" type="search" autocomplete="off" placeholder="${escape(placeholder)}"></div></div>
    ${filters.map(({name,title,values,empty,labels}) =>
      `<div><label for="catalog-${name}">${title}</label><select id="catalog-${name}" name="${name}"><option value="">${empty}</option>${options(values, labels)}</select></div>`
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

const documentPaths = {
  index: 'transparencia.html',
  management: 'documentos-gestion.html',
  projects: 'proyectos-resolutivos.html',
};
const managementTitle = 'Documentos de gestión';
const resolutionsTitle = 'Resoluciones emitidas';

function relatedDesignations(record) {
  return directoryRoles.filter(({role}) => role.designation.code === record.code);
}

function pdfFile(pdf, title, depth) {
  return `<a class="document-link file-card" href="${escape(depth + pdf)}" target="_blank" rel="noopener" aria-label="Ver PDF · ${escape(title)}">
        <span class="action-icon">${icon('document')}</span>
        <span><strong>${escape(title)}</strong><small>Ver PDF</small></span>
        ${icon('external')}
      </a>`;
}

function documentPage(item, isAct) {
  const depth = isAct ? '../' : '../../';
  const pagePath = isAct ? actPath(item) : managementPath(item);
  const section = isAct ? [resolutionsTitle, documentPaths.projects] : [managementTitle, documentPaths.management];
  const description = isAct ? item.summary : item.description;
  const searchTitle = isAct && !item.title.toLowerCase().includes(item.office.toLowerCase())
    ? `${item.title} · ${item.office}`
    : item.title;
  const searchDescription = isAct ? `${item.office} de Altum Lumen S.A.C. ${description}` : description;
  const crumbs = breadcrumb([['Documentos legales', documentPaths.index], section, [item.title]], depth);
  const related = isAct ? relatedDesignations(item) : [];
  const documents = item.bundle
    ? pdfFile(item.bundle, 'Resolución y anexo', depth) + pdfFile(item.pdf, 'Resolución firmada', depth) + pdfFile(item.annex, 'Anexo firmado', depth)
    : pdfFile(item.pdf, isAct ? item.type : item.title, depth);
  const main = masthead(item.title, '', crumbs) + `
  <article class="layout content-section document-detail" aria-labelledby="extract-title">
    <div class="document-extract">${isAct ? `
      <p class="record-office">${escape(item.office)}</p>` : ''}
      <h2 id="extract-title">Extracto</h2>
      <p>${escape(description)}</p>${isAct ? `
      <p class="document-issued">Fecha de emisión · ${time(item.issuedOn)}</p>` : ''}
    </div>
    <section class="role-designation document-files" aria-labelledby="files-title">
      <h2 id="files-title">Archivos PDF</h2>
      <div class="document-file-links">${documents}</div>${item.bundle ? `
      <p>El PDF conjunto es una copia de consulta. Las firmas digitales se verifican en los originales.</p>` : ''}
    </section>${related.length ? `
    <div class="document-related">
      <h2>Fichas relacionadas</h2>
      <ul>${related.map(({person, role}) => `<li><a href="${depth + rolePath(person, role)}">${escape(person.name)} · ${roleTitle(role)}</a></li>`).join('')}</ul>
    </div>` : ''}
    <div class="role-nav"><a class="button button-quiet" href="${depth + section[1]}">Volver a ${section[0]}</a></div>
  </article>`;
  const structured = {
    '@context':'https://schema.org', '@type':'DigitalDocument', name:item.title, description:searchDescription,
    url:base + pagePath, publisher:organization,
    encoding:{'@type':'MediaObject',contentUrl:base + (item.bundle || item.pdf),encodingFormat:'application/pdf'},
  };
  if (isAct) {
    structured.identifier = item.code;
    structured.creator = {'@type':'Organization',name:item.office,parentOrganization:organization};
  }
  return {title:searchTitle,pagePath,description:searchDescription,active:'publications',depth,main,structured};
}

function legalPages() {
  const title = 'Documentos legales';
  const latestYear = Math.max(...gestion.map(item => item.year));
  const categories = [
    {
      title:managementTitle, description:'Organización, funciones y documentos vigentes.', href:documentPaths.management,
      legacyId:'documentos-gestion', iconName:'folder', moreLabel:'Ver más documentos de gestión',
      previews:gestion.filter(item => item.year === latestYear).slice(0, 3).map(item => ({
        title:item.title, href:managementPath(item), summary:item.description,
      })),
    },
    {
      title:resolutionsTitle, description:'Últimas resoluciones y catálogo por órgano emisor, año y asunto.', href:documentPaths.projects,
      legacyId:'actos-resolutivos', iconName:'document', moreLabel:'Ver más resoluciones',
      previews:recent.slice(0, 3).map(item => ({
        title:item.title, href:actPath(item), summary:item.summary, date:item.issuedOn,
      })),
    },
  ];
  const links = categories.map(item => `<section class="document-category-panel" aria-label="${item.title}">
      <a id="${item.legacyId}" class="document-category" href="${item.href}">
        <span class="action-icon">${icon(item.iconName)}</span>
        <span><strong>${item.title}</strong><small>${item.description}</small></span>
        ${icon('arrow')}
      </a>
      <ul class="document-previews">
        ${item.previews.map(preview => `<li>
          <a href="${preview.href}">${escape(preview.title)}</a>${preview.date ? `
          ${time(preview.date, shortDate)}` : ''}
          <p>${escape(preview.summary)}</p>
        </li>`).join('\n        ')}
      </ul>
      <div class="document-preview-more">
        <a class="text-link" href="${item.href}">${item.moreLabel} ${icon('arrow')}</a>
      </div>
    </section>`).join('\n    ');
  const index = {
    title, pagePath:documentPaths.index, active:'publications',
    description:'Consulta los documentos de gestión y las resoluciones emitidas por Altum Lumen S.A.C.',
    main:masthead(title, '', breadcrumb([[title]])) + `
  <nav class="layout document-categories" aria-label="Categorías de documentos legales" data-document-directory>
    ${links}
  </nav>`,
  };
  const managementPage = {
    title:managementTitle, pagePath:documentPaths.management, active:'publications',
    description:'Consulta el organigrama, el reglamento, el manual y sus versiones anteriores.',
    main:masthead(managementTitle, 'Consulta el extracto y el PDF de cada instrumento de gestión.', breadcrumb([[title,documentPaths.index],[managementTitle]])) + `
  <section class="layout content-section" id="documentos-gestion" aria-label="Instrumentos de gestión">
    <div class="management-grid">${managementCards(gestion.filter(item => item.year === latestYear))}</div>
    <details class="archive">
      <summary>Versiones anteriores</summary>
      <div class="management-grid">${managementCards(gestion.filter(item => item.year !== latestYear))}</div>
    </details>
  </section>`,
  };
  const projectsPage = {
    title:resolutionsTitle, pagePath:documentPaths.projects, active:'publications', script:true,
    description:'Consulta los actos emitidos por Altum Lumen por tipo de documento, órgano emisor, año o asunto.',
    main:masthead(resolutionsTitle, 'Actos emitidos, del más reciente al más antiguo por fecha de emisión.', breadcrumb([[title,documentPaths.index],[resolutionsTitle]])) + `
  <section id="actos-resolutivos" class="layout content-section" data-catalog="publications">
    <div class="section-title"><h2 tabindex="-1">Catálogo</h2></div>
    ${searchForm({label:'Buscar en resoluciones emitidas',placeholder:'Número o asunto',filters:[
      {name:'tipo',title:'Tipo de documento',values:types,empty:'Todos'},
      {name:'oficina',title:'Órgano emisor',values:offices,empty:'Todos'},
      {name:'anio',title:'Año de emisión',values:years,empty:'Todos'},
    ]})}
    ${catalogStatus}
    <ol class="publication-list" data-catalog-list>${publicationCards()}</ol>
    ${resultControls(true)}
  </section>`,
  };
  return [index, managementPage, projectsPage, ...actos.map(item => documentPage(item, true)), ...gestion.map(item => documentPage(item, false))];
}

function portrait(person, depth = '', featured = false) {
  return person.photo
    ? `<img class="portrait" src="${escape(depth + person.photo)}" alt="${featured ? escape('Retrato de ' + person.name) : ''}" width="${featured ? 144 : 96}" height="${featured ? 174 : 110}" ${featured ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
    : `<span class="portrait portrait-placeholder" aria-hidden="true">${icon('silhouette')}</span>`;
}

function roleName(role) {
  return role.title + (role.temporary ? ' (DT)' : '');
}

function roleTitle(role) {
  return escape(role.title) + (role.temporary ? ' <abbr class="temporary-abbreviation" title="Designación temporal">(DT)</abbr>' : '');
}

function boardCard(group) {
  return `<li id="junta-general-de-accionistas" data-directory-item data-group="${group}" data-unit="${boardName}" data-search="${boardName} ${registration}">
      <article class="position-tile board-tile">
        <span class="portrait portrait-placeholder" aria-hidden="true">${icon('board')}</span>
        <div class="position-card-copy">
          <h4>${boardName}</h4>
          <p class="position-title">Órgano supremo de dirección societaria de Altum Lumen S.A.C.</p>
          <dl class="board-details">
            <div><dt>Constitución</dt><dd>${time('2025-06-24')}</dd></div>
            <div><dt>Acreditación registral</dt><dd>${registration}</dd></div>
          </dl>
        </div>
      </article>
    </li>`;
}

function directory() {
  const sections = groups.map(group => {
    const cards = directoryRoles.filter(({role}) => role.group === group).map(({person, role}) => {
      const search = [person.name, person.alternateName, roleName(role), role.office, role.temporary ? 'designación temporal' : ''].join(' ');
      const title = escape(roleName(role));
      return `<li data-directory-item data-group="${escape(group)}" data-unit="${escape(role.office)}" data-search="${escape(search)}">
      <article class="position-tile">
        ${portrait(person)}
        <div class="position-card-copy">
          <p class="record-office">${escape(role.office)}</p>
          <h4>${escape(person.name)}</h4>
          <p class="position-title">${roleTitle(role)}</p>
          <a class="position-mail" href="mailto:${escape(role.email)}">${escape(role.email)}</a>
          <a class="text-link" href="${rolePath(person, role)}" aria-label="Ver más sobre ${title}, ${escape(person.name)}">Ver más ${icon('arrow')}</a>
        </div>
      </article>
    </li>`;
    }).join('\n');
    const [heading, subgroup] = groupNames[group].split(' · ');
    return `<section class="position-group" data-catalog-group>
      <header class="position-group-heading">
${subgroup ? `        <p>${escape(heading)}</p>\n` : ''}        <h3>${escape(subgroup || heading)}</h3>
      </header>
      <ul class="person-list">${group === 'Alta dirección' ? boardCard(group) : ''}${cards}</ul>
    </section>`;
  }).join('\n');
  return masthead('Directorio institucional', 'Conoce al equipo de Altum Lumen por unidad orgánica y consulta sus datos de contacto y designación.',
    breadcrumb([['Directorio']])) + `
  <section class="layout content-section" data-catalog="directory" aria-labelledby="directory-results-title">
    <h2 id="directory-results-title" class="sr-only" tabindex="-1">Fichas del directorio</h2>
    ${searchForm({label:'Buscar en el directorio',placeholder:'Nombre, función o unidad',
      filters:[
        {name:'unidad',title:'Unidad orgánica',values:[...new Set([boardName,...directoryRoles.map(({role})=>role.office)])].sort(collator.compare),empty:'Todas'},
        {name:'grupo',title:'Grupo orgánico',values:groups,labels:groupNames,empty:'Todos'},
      ]})}
    ${sections}
    ${resultControls(true)}
  </section>`;
}

function profileSchema(person, roles, pagePath, title, description) {
  const personPath = base + profilePath(person);
  const entity = {'@type':'Person','@id':personPath + '#persona',name:person.name,
    description:person.summary,jobTitle:roles.map(roleName),url:personPath,worksFor:organization};
  if (person.photo) entity.image = base + person.photo;
  if (person.alternateName) entity.alternateName = person.alternateName;
  return {'@context':'https://schema.org','@type':'ProfilePage',
    name:title,description,url:base + pagePath,mainEntity:entity};
}

function profileSummary(person, role) {
  const duties = role
    ? `\n      <p>Como ${escape(role.title.charAt(0).toLowerCase() + role.title.slice(1))}, ${escape(role.responsibilities)}</p>`
    : '';
  return `<section class="prose" aria-labelledby="profile-summary-title">
      <h2 id="profile-summary-title">Resumen</h2>
      <p>${escape(person.summary)}</p>${duties}
    </section>`;
}

function profile(person) {
  const depth = '../';
  const orderedRoles = [...person.roles].sort((a,b) => a.orden - b.orden);
  const principal = orderedRoles[0];
  const roles = orderedRoles.map(role => `<article class="role-card">
    <div class="role-heading"><p class="record-office">${escape(role.office)}</p>
      <h3>${roleTitle(role)}</h3>
    </div>
    <a class="text-link" href="${depth + rolePath(person, role)}" aria-label="Ver más sobre ${escape(roleName(role))}">Ver más ${icon('arrow')}</a>
  </article>`).join('\n');
  const description = `${person.name}, ${roleName(principal)} de Altum Lumen S.A.C. Consulta su perfil institucional y los documentos de designación.`;
  const main = `<div class="masthead"><div class="layout">
    ${breadcrumb([['Directorio','directorio.html'], [person.name]], depth)}
    <div class="profile-heading">${portrait(person,depth,true)}<div><h1>${escape(person.name)}</h1><p>${roleTitle(principal)}</p></div></div>
  </div></div>
  <div class="layout content-section profile-roles">
    ${profileSummary(person)}
    <div class="section-title"><h2>Designaciones</h2></div>
    <div class="role-list">${roles}</div>
    <p class="back-link"><a class="button button-quiet" href="../directorio.html">Volver al directorio</a></p>
  </div>`;
  const pagePath = profilePath(person);
  const title = person.name + ' · Perfil institucional';
  const structured = profileSchema(person, orderedRoles, pagePath, title, description);
  return page({title,pagePath,description,active:'directory',depth,main,structured,image:person.photo});
}

function designationCard(role, depth) {
  const {code, article, label, extract} = role.designation;
  const record = byCode.get(code);
  const content = record ? `
      <p class="designation-meta">Artículo ${article} · ${time(record.issuedOn)}</p>
${extract ? `      <p class="designation-extract">${escape(extract)}</p>\n` : ''}      <a class="designation-document document-link" href="${depth + record.pdf}" target="_blank" rel="noopener">
        <span class="action-icon">${icon('document')}</span>
        <span><strong>${escape(record.title)}</strong><small>Ver PDF</small></span>
        ${icon('external')}
      </a>` : `
      <p class="registration-record"><span class="action-icon">${icon('document')}</span><strong>${escape(label)}</strong></p>`;
  return `<aside class="role-designation" aria-labelledby="designation-title">
      <h2 id="designation-title">Norma de nombramiento</h2>${content}
    </aside>`;
}

function roleProfile(person, role) {
  const depth = '../../';
  const pagePath = rolePath(person, role);
  const title = person.name + ' · ' + roleName(role);
  const designation = byCode.get(role.designation.code)?.title || role.designation.label;
  const description = `${person.name}, ${roleName(role)} de Altum Lumen S.A.C. desde el ${writtenDate(role.effectiveOn)}. ${designation}.`;
  const crumbs = breadcrumb([['Directorio','directorio.html'], [person.name,profilePath(person)], [roleName(role)]], depth);
  const main = `<div class="masthead"><div class="layout">
    ${crumbs}
    <div class="profile-heading">
      ${portrait(person,depth,true)}
      <div><h1>${escape(person.name)}</h1><p>${roleTitle(role)}</p></div>
    </div>
  </div></div>
  <section class="layout content-section profile-roles" aria-labelledby="role-detail-title">
    <div class="role-detail-grid">
      <div>
        <div class="section-title"><h2 id="role-detail-title">Información institucional</h2></div>
        <dl class="record-details role-profile-details">
          <div><dt>Unidad orgánica</dt><dd>${escape(role.office)}</dd></div>
          <div><dt>Grupo orgánico</dt><dd>${escape(groupNames[role.group])}</dd></div>
          <div><dt>Fecha de inicio</dt><dd>${time(role.effectiveOn)}</dd></div>
          <div class="profile-contact">
            <dt>Correo institucional</dt>
            <dd>
              <a href="mailto:${escape(role.email)}">${escape(role.email)}</a>
              <button class="copy-contact" type="button" aria-label="Copiar correo institucional" hidden data-copy-contact>Copiar</button>
              <span class="copy-status" role="status"></span>
            </dd>
          </div>
        </dl>
      </div>
      <div class="role-overview">
        ${designationCard(role, depth)}
        ${profileSummary(person, role)}
      </div>
    </div>
    <div class="role-nav">
      <a class="button button-quiet" href="${depth}directorio.html">Volver al directorio</a>
    </div>
  </section>`;
  const structured = profileSchema(person, [role], pagePath, title, description);
  return page({title,pagePath,description,active:'directory',depth,main,structured,image:person.photo});
}

const publicIndexPath = 'indice-del-portal.html';

function publicIndex() {
  const title = 'Índice del portal';
  const link = (href, label) => `<li><a href="${escape(href)}">${escape(label)}</a></li>`;
  const people = personas.map(person => `<li>
        <a href="${profilePath(person)}">${escape(person.name)}</a>
        <ul>${person.roles.map(role => link(rolePath(person, role), roleName(role))).join('')}</ul>
      </li>`).join('\n      ');
  const resolutions = years.map(year => `<h3>${year}</h3>
    <ul>${recent.filter(record => record.year === year)
      .map(record => link(actPath(record), record.title)).join('\n    ')}</ul>`).join('\n    ');
  const main = masthead(title, '', breadcrumb([[title]])) + `
  <div class="layout content-section prose">
    <nav aria-label="Secciones del índice"><ul>
      <li><a href="#perfiles">Directorio</a></li>
      <li><a href="#gestion">Documentos de gestión</a></li>
      <li><a href="#resoluciones">Resoluciones emitidas</a></li>
    </ul></nav>
    <h2 id="perfiles">Directorio</h2>
    <ul>${people}</ul>
    <h2 id="gestion">Documentos de gestión</h2>
    <ul>${gestion.map(item => link(managementPath(item), item.title)).join('')}</ul>
    <h2 id="resoluciones">Resoluciones emitidas</h2>
    ${resolutions}
  </div>`;
  return page({title,pagePath:publicIndexPath,description:'Enlaces directos a los perfiles, documentos de gestión y resoluciones emitidas de Altum Lumen S.A.C.',main});
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

const corporatePages = portalViews({icon, escape, masthead, breadcrumb, time, shortDate, pdfLink, byCode, recent, base, documentPaths, actPath});
for (const corporate of corporatePages) update(corporate.pagePath, page(corporate));
for (const documentPage of legalPages()) update(documentPage.pagePath, page(documentPage));
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
  description:'Consulta por nombre o unidad orgánica los perfiles, contactos y las designaciones del equipo de Altum Lumen S.A.C.',main:directory(),structured:directorySchema}));
for (const person of personas) update(profilePath(person), profile(person));
for (const {person, role} of directoryRoles) update(rolePath(person, role), roleProfile(person, role));
update(publicIndexPath, publicIndex());
let sitemap = read('sitemap.xml').replace(/\r\n/g,'\n');
const sitemapImages = new Map(personas.filter(person => person.photo).map(person => [profilePath(person), person.photo]));
const sitemapPages = [
  'servicios.html', 'atencion.html', documentPaths.management, documentPaths.projects, 'directorio.html', publicIndexPath,
  'mesa-de-partes.html', 'consultar-expediente.html', 'libro-de-reclamaciones.html',
  ...corporatePages.map(item => item.pagePath).filter(file => file.startsWith('servicios/')),
  ...personas.map(profilePath), ...directoryRoles.map(({person, role}) => rolePath(person, role)),
  ...recent.map(actPath), ...gestion.map(managementPath),
];
const sitemapItems = sitemapPages.map(file => {
  const image = sitemapImages.get(file);
  const imageEntry = image ? `<image:image><image:loc>${escape(base + image)}</image:loc></image:image>` : '';
  return `  <url><loc>${escape(base + file)}</loc>${imageEntry}</url>`;
}).join('\n');
sitemap = replaceSection(sitemap, 'directorio-institucional', sitemapItems);
update('sitemap.xml', sitemap);
const sitemapUrls = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map(([,url]) => url);
update('sitemap.txt', sitemapUrls.join('\n') + '\n');
console.log(`${checkOnly?'Verificados':'Generados'} ${actos.length} actos, ${gestion.length} instrumentos de gestión, ${personas.length} personas y ${directoryRoles.length} fichas de cargo.`);
