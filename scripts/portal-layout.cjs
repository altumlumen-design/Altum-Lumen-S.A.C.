const nav = [
  ['./', 'Inicio', 'home'],
  ['informacion-institucional.html', 'Nosotros', 'about'],
  ['servicios.html', 'Servicios', 'services'],
  ['transparencia.html', 'Documentos legales', 'publications'],
  ['directorio.html', 'Directorio', 'directory'],
  ['atencion.html', 'Atención', 'attention'],
];

module.exports = function createLayout({base, icon, escape, assets}) {
  return function page({title, pagePath, description, active, depth = '', main, script = false, structured, noindex = false, linkBase, image = 'social-preview-corporativo-20260808.jpg'}) {
    const prefix = linkBase || depth;
    const siteNav = nav.map(([href, label, key]) => {
      const current = active === key ? ' aria-current="page"' : '';
      const action = key === 'attention' ? ' class="nav-action"' : '';
      return `<a href="${prefix + href}"${current}${action}>${label}</a>`;
    }).join('\n        ');
    const url = pagePath === 'index.html' ? base : base + pagePath;
    const label = pagePath === 'index.html' ? title : title + ' | ALTUM LUMEN S.A.C.';
    return `<!doctype html>
<!-- Generado por scripts/build-institucional.cjs -->
<html lang="es-PE">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#123f5a">
  <meta name="description" content="${escape(description)}">
  <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
  <title>${escape(label)}</title>
  <link rel="canonical" href="${url}">
  <link rel="icon" href="${prefix}favicon.ico">
  <link rel="apple-touch-icon" href="${prefix}favicon.png">
  <link rel="stylesheet" href="${prefix + assets.get('institucional.css')}">
  <link rel="stylesheet" href="${prefix + assets.get('portal.css')}">
  <meta property="og:locale" content="es_PE">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ALTUM LUMEN">
  <meta property="og:title" content="${escape(label)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${base + escape(image)}">
  <meta name="twitter:card" content="${image.startsWith('funcionario-') ? 'summary' : 'summary_large_image'}">
${structured ? `  <script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>\n` : ''}  <script src="${prefix + assets.get('portal.js')}" defer></script>
${script ? `  <script src="${prefix + assets.get('institucional.js')}" defer></script>\n` : ''}</head>
<body${active === 'home' ? ' class="portal-home"' : ''}>
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <header class="institution-header">
    <div class="layout site-header-inner" data-portal-header>
      <a class="brand" href="${prefix || './'}" aria-label="Altum Lumen, inicio">
        <img src="${prefix}logo-1.png" width="176" height="66" alt="ALTUM LUMEN S.A.C.">
      </a>
      <button type="button" class="portal-menu-toggle" aria-expanded="false" aria-controls="portal-nav" hidden data-menu-toggle>${icon('menu')} Menú</button>
      <nav class="institution-nav" id="portal-nav" aria-label="Navegación principal">
        ${siteNav}
      </nav>
    </div>
  </header>
  <main id="contenido">
${main}
  </main>
  <footer class="institution-footer">
    <div class="layout footer-inner">
      <div><strong>ALTUM LUMEN S.A.C.</strong><div>RUC 20614458918 · Perú</div></div>
      <nav aria-label="Información legal y acceso institucional">
        <a href="${prefix}privacidad.html">Privacidad</a>
        <a href="${prefix}terminos.html">Términos</a>
        <a href="${prefix}sgd.html">Acceso al SGD ${icon('arrow')}</a>
      </nav>
    </div>
  </footer>
</body>
</html>
`;
  };
};
