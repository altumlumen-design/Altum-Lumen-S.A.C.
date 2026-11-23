const links = {
  home: './',
  about: 'informacion-institucional.html',
  services: 'servicios.html',
  publications: 'transparencia.html',
  directory: 'directorio.html',
  attention: 'atencion.html',
};

const channels = [
  {title:'Mesa de Partes Virtual', icon:'inbox', file:'mesa-de-partes.html',
    brief:'Presenta documentos', description:'Presenta tu documento y sus anexos. Descarga el acuse con el número y la contraseña de tu expediente.'},
  {title:'Consultar expediente', icon:'folder', file:'consultar-expediente.html',
    brief:'Sigue el estado de tu trámite', description:'Revisa el estado y las actuaciones de tu expediente con los datos indicados en el acuse.'},
  {title:'Verificar documento', icon:'shield', file:'verificacion.html',
    brief:'Utiliza el código del documento', description:'Consulta los datos de emisión con el código de verificación que figura al pie del documento.'},
  {title:'Libro de Reclamaciones', icon:'note', file:'libro-de-reclamaciones.html',
    brief:'Registra un reclamo o queja', description:'Registra un reclamo o una queja sobre la atención o los servicios de Altum Lumen.'},
];

const services = [
  {
    id:'formacion', short:'Formación profesional', name:'Centro de Formación y Capacitación Profesional',
    image:'centro-formacion-altum-lumen.png', code:'00012-2025-AL/GG',
    office:'Dirección Académica', site:'https://altumlumen-design.github.io/Altum-Lumen-centro-formacion/',
    brief:'Capacitación, especialización y asistencia técnica.',
    description:'Ofrece formación continua, cursos, diplomados y programas de especialización. Desarrolla asistencia técnica, investigación aplicada y consultoría para profesionales y organizaciones.',
    fields:['Gestión pública, planeamiento, presupuesto y modernización', 'Inversiones, contrataciones y obras públicas', 'Derecho, seguridad, ambiente y transformación digital'],
  },
  {
    id:'obras', short:'Obras e inversiones', name:'Constructora & Consultora Altum Obras e Inversiones',
    image:'altum-obras-inversiones.png', code:'00019-2026-AL/GG',
    office:'Dirección de Proyectos e Inversiones',
    brief:'Consultoría, estudios y ejecución de proyectos.',
    description:'Acompaña a las organizaciones desde la formulación de una iniciativa de infraestructura o inversión hasta su ejecución y seguimiento.',
    fields:['Estudios, proyectos y expedientes técnicos', 'Consultoría, supervisión y ejecución de obras', 'Control técnico, seguridad y gestión socioambiental'],
  },
  {
    id:'legal', short:'Asesoría jurídica', name:'Altum Abogados & Asociados',
    image:'altum-abogados.png', code:'00021-2026-AL/GG',
    office:'Subdirección de Servicios Legales', site:'https://altumlumen-design.github.io/ALTUM.Abogados-Asociados/',
    brief:'Asesoría, defensa y representación legal.',
    description:'Asesora a personas y organizaciones en la prevención y atención de contingencias. Acompaña la toma de decisiones con análisis normativo y estrategia jurídica.',
    fields:['Consultoría y elaboración de contratos y documentos', 'Defensa, representación y gestiones legales', 'Seguimiento de expedientes y control de plazos'],
  },
  {
    id:'contable', short:'Asesoría contable', name:'Altum Contadores & Asociados',
    image:'altum-contadores.png', code:'00020-2026-AL/GG',
    office:'Subdirección de Servicios Tributarios y Contables', site:'https://altumlumen-design.github.io/altum-contadores/',
    brief:'Contabilidad, tributos y gestión empresarial.',
    description:'Apoya a empresas y emprendimientos en el cumplimiento de sus obligaciones, la planificación financiera y la organización de su información contable.',
    fields:['Registros, cierres contables y reportes financieros', 'Declaraciones, vencimientos y requerimientos tributarios', 'Asesoría empresarial y control documentario'],
  },
];

const emails = {
  intake: 'tramiteyatencion.altumlumen@gmail.com',
  services: 'serviciosyrelaciones.altumlumen@gmail.com',
};

module.exports = function portalViews({icon, escape, masthead, breadcrumb, time, shortDate, pdfLink, byCode, recent, base}) {
  const latestList = recent.slice(0, 3).map(record => `
      <li>
        <div class="latest-date">${time(record.publishedAt.slice(0,10), shortDate)}</div>
        <a href="transparencia.html#${escape(record.id)}">
          <span><small>${escape(record.office)}</small><strong>${escape(record.title)}</strong></span>
          ${icon('arrow')}
        </a>
      </li>`).join('');
  const directLinks = channels.map(channel => `
        <a href="${channel.file}" class="quick-access">
          <span class="action-icon">${icon(channel.icon)}</span>
          <span><strong>${channel.title}</strong><small>${channel.brief}</small></span>
          ${icon('arrow')}
        </a>`).join('');
  const shortServices = services.map(service => `
        <li><a href="${links.services}#${service.id}">
          <img class="service-preview-mark" src="${service.image}" alt="" loading="lazy" decoding="async">
          <h3>${escape(service.name)}</h3>
          <p>${service.brief}</p>
          ${icon('arrow')}
        </a></li>`).join('');

  const description = 'Altum Lumen ofrece formación profesional, asesoría jurídica y contable, consultoría, obras e inversiones para personas y organizaciones en el Perú.';
  const organization = {
    '@context':'https://schema.org',
    '@type':'Organization',
    '@id':base + '#organization',
    name:'ALTUM LUMEN S.A.C.',
    url:base,
    logo:base + 'logo-1.png',
    slogan:'Excelencia que transforma',
    description,
    areaServed:{'@type':'Country',name:'Perú'},
    hasOfferCatalog:{'@type':'OfferCatalog',name:'Líneas de servicio',itemListElement:services.map(service=>({
      '@type':'Offer', itemOffered:{'@type':'Service',name:service.name,url:base + links.services + '#' + service.id},
    }))},
  };
  const home = {
    title:'ALTUM LUMEN S.A.C. | Portal corporativo', pagePath:'index.html', active:'home', description,
    structured:organization,
    main:`
  <section class="home-hero" id="inicio">
    <div class="layout home-hero-inner">
      <div class="hero-copy">
        <h1>Excelencia que transforma.</h1>
        <p>Formación profesional, consultoría y servicios especializados para personas, empresas e instituciones.</p>
      </div>
      <div class="quick-panel" aria-labelledby="quick-title">
        <h2 id="quick-title">Trámites en línea</h2>
        <div class="quick-grid">${directLinks}</div>
      </div>
    </div>
  </section>
  <section class="layout home-services" id="servicios" aria-labelledby="services-title">
    <div class="section-heading"><h2 id="services-title">Líneas de servicio</h2></div>
    <ul class="service-preview">${shortServices}</ul>
  </section>
  <section class="home-information" id="documentos" aria-labelledby="latest-title">
    <div class="layout publication-preview">
      <div class="latest-copy">
        <h2 id="latest-title">Últimos actos resolutivos</h2>
        <a class="text-link" href="${links.publications}#actos-resolutivos">Ver catálogo completo ${icon('arrow')}</a>
      </div>
      <ul class="latest-list">${latestList}</ul>
    </div>
  </section>`,
  };
  const about = {
    title:'Quiénes somos', pagePath:links.about, active:'about',
    description:'Conoce la identidad, la organización y el equipo directivo de Altum Lumen S.A.C.',
    main:masthead('Quiénes somos', 'Una empresa peruana de servicios profesionales, consultoría y formación.', breadcrumb([['Nosotros']])) + `
  <div class="layout content-section about-layout">
    <article class="prose about-story">
      <h2>Cómo trabajamos</h2>
      <p>Altum Lumen articula capacidades consultivas, técnicas, operativas y formativas para atender a personas, empresas e instituciones públicas y privadas. Según el encargo, nuestro trabajo abarca el diagnóstico, el diseño, la ejecución y el seguimiento.</p>
      <p>El planeamiento, la asistencia técnica, la supervisión y la cooperación institucional conectan nuestras líneas especializadas. Las alianzas y los convenios amplían su alcance.</p>
      <h2>Organización</h2>
      <p>La Junta General de Accionistas y la Gerencia General conducen la sociedad. El organigrama y el Reglamento de Organización y Funciones detallan las dependencias y sus responsabilidades.</p>
      <div class="related-links">
        <a class="text-link" href="${links.publications}#documentos-gestion">Organigrama e instrumentos de gestión ${icon('arrow')}</a>
        <a class="text-link" href="${links.directory}">Equipo directivo ${icon('arrow')}</a>
      </div>
    </article>
    <aside class="identity-panel" aria-labelledby="identity-title">
      <h2 id="identity-title">Datos institucionales</h2>
      <dl class="record-details">
        <div><dt>Razón social</dt><dd>ALTUM LUMEN S.A.C.</dd></div>
        <div><dt>RUC</dt><dd>20614458918</dd></div>
        <div><dt>Naturaleza</dt><dd>Sociedad Anónima Cerrada</dd></div>
        <div><dt>País</dt><dd>Perú</dd></div>
      </dl>
    </aside>
  </div>`,
  };
  const servicePage = {
    title:'Líneas de servicio', pagePath:links.services, active:'services',
    description:'Formación, proyectos e inversiones, asesoría jurídica y contable de Altum Lumen S.A.C.',
    main:masthead('Líneas de servicio', 'Encuentra el equipo adecuado para tu consulta o proyecto.', breadcrumb([['Servicios']])) + `
  <div class="layout content-section service-body">
    <nav class="section-index" aria-label="Líneas de servicio">
      ${services.map(service => `<a href="#${service.id}">${service.short}</a>`).join('\n      ')}
    </nav>
    <div class="service-list">${services.map(service => `
      <section class="service-detail" id="${service.id}">
        <div class="service-mark"><img src="${service.image}" width="980" height="300" alt="" loading="lazy" decoding="async"></div>
        <div class="service-copy">
          <h2>${escape(service.name)}</h2>
          <p>${service.description}</p>
          <ul class="service-fields">${service.fields.map(field => `<li>${field}</li>`).join('')}</ul>
          <dl class="record-details">
            <div><dt>Unidad responsable</dt><dd>${service.office}</dd></div>
            <div><dt>Documento de referencia</dt><dd>${pdfLink(byCode.get(service.code).pdf, '', byCode.get(service.code).title)}</dd></div>
          </dl>
          <a class="button button-primary" href="${service.site||'mailto:'+emails.services}"${service.site?' target="_blank" rel="noopener"':''}>${service.site?'Abrir sitio de la línea':'Consultar sobre obras e inversiones'} ${icon(service.site?'external':'mail')}</a>
        </div>
      </section>`).join('')}
    </div>
  </div>`,
  };
  const attention = {
    title:'Atención', pagePath:links.attention, active:'attention',
    description:'Presenta documentos, consulta expedientes, verifica documentos y contacta a Altum Lumen.',
    main:masthead('Atención', 'Encuentra el canal adecuado para tu trámite o consulta.', breadcrumb([['Atención']])) + `
  <section class="layout content-section" aria-labelledby="online-title">
    <div class="section-heading"><h2 id="online-title">Trámites en línea</h2></div>
    <div class="channel-grid">${channels.map(channel => `
      <article class="channel-card">
        <span class="action-icon">${icon(channel.icon)}</span>
        <h3>${channel.title}</h3>
        <p>${channel.description}</p>
        <a class="text-link" href="${channel.file}" aria-label="Abrir ${channel.title}">Abrir servicio ${icon('arrow')}</a>
      </article>`).join('')}
    </div>
  </section>
  <section class="section-shaded" id="contacto" aria-labelledby="contact-title">
    <div class="layout content-section">
      <div class="section-heading"><h2 id="contact-title">Canales de contacto</h2></div>
      <dl class="contact-list">
        <div><dt>Atención documentaria</dt><dd><a href="mailto:${emails.intake}">${emails.intake}</a></dd></div>
        <div><dt>Servicios y cooperación</dt><dd><a href="mailto:${emails.services}">${emails.services}</a></dd></div>
        <div><dt>WhatsApp</dt><dd><a href="https://wa.me/51928928767" target="_blank" rel="noopener">928 928 767 ${icon('external')}</a></dd></div>
      </dl>
    </div>
  </section>`,
  };

  const legal = (title, description, pagePath, body) => ({
    title, description, pagePath, main:masthead(title, '', breadcrumb([[title]])) +
    `<div class="layout content-section"><article class="prose legal-copy">${body}</article></div>`,
  });
  const privacy = legal('Política de privacidad','Uso de la información y canales para consultas de privacidad de Altum Lumen.',
    'privacidad.html', `
    <p>Este portal utiliza únicamente la información que el usuario proporciona voluntariamente para atender consultas, solicitudes académicas, institucionales o de servicios.</p>
    <h2>Uso de la información</h2>
    <p>Los datos recibidos se emplean para responder solicitudes, gestionar comunicaciones y prestar los servicios correspondientes. No se comercializa la información personal.</p>
    <h2>Servicios externos</h2>
    <p>Algunos enlaces pueden dirigir a servicios de terceros, como correo electrónico, mensajería o plataformas externas, sujetos a sus propias políticas.</p>
    <h2>Contacto</h2>
    <p>Para consultas relacionadas con privacidad o tratamiento de información, puede escribir a <a href="mailto:${emails.intake}">${emails.intake}</a>.</p>`);
  const terms = legal('Términos de uso','Condiciones de uso del portal corporativo de Altum Lumen.',
    'terminos.html', `
    <p>El contenido de este portal tiene fines institucionales, informativos y de orientación sobre los servicios y programas de ALTUM LUMEN.</p>
    <h2>Contenido y disponibilidad</h2>
    <p>La información puede actualizarse cuando cambien programas, servicios, convocatorias o condiciones institucionales. La disponibilidad de un servicio o programa debe confirmarse por los canales oficiales.</p>
    <h2>Propiedad y uso</h2>
    <p>Los elementos institucionales, textos, imágenes y materiales publicados se utilizan dentro del marco de comunicación de ALTUM LUMEN. No se autoriza su uso engañoso o que pueda generar confusión sobre su procedencia.</p>
    <h2>Contacto</h2>
    <p>Las consultas pueden dirigirse a <a href="mailto:${emails.intake}">${emails.intake}</a>.</p>`);
  terms.noindex = true;
  const notFound = {
    title:'Página no encontrada', pagePath:'404.html', noindex:true, linkBase:base,
    description:'La dirección solicitada no corresponde a una página del portal de Altum Lumen.',
    main:`<div class="layout content-section error-page">
      <h1>Página no encontrada</h1><p>Revisa la dirección o regresa al portal para encontrar la página que buscabas.</p>
      <a class="button button-primary" href="${base}">Volver al inicio ${icon('arrow')}</a>
    </div>`,
  };
  return [home, about, servicePage, attention, privacy, terms, notFound];
};
