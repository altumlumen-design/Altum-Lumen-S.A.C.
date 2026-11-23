const SGD_SUPPORT_ROLES_ = Object.freeze({APOYO: 'APOYO', MAESTRO: 'MAESTRO'});
const SGD_SUPPORT_DOCUMENT_COLUMNS_ = [
  'Elaborador_ID', 'Elaborador_Nombre', 'Presentado_Revision', 'Proyecto_Texto_Apoyo', 'Proyecto_Delegado_ID',
];
const SGD_SUPPORT_PROJECT_MAX_ = 18000;
let sgdSupportAccessToken_ = '';

function sgdIsSupportSession_(session) {
  return norm_(session && session.role) === SGD_SUPPORT_ROLES_.APOYO;
}

function sgdIsSupportUser_(user) {
  return norm_(user && user.Rol) === SGD_SUPPORT_ROLES_.APOYO;
}

function sgdIsOfficeHolder_(user) {
  return !!user && !sgdIsSupportUser_(user) && norm_(user.Rol) !== SGD_SUPPORT_ROLES_.MAESTRO && norm_(user.Activo) === 'SI';
}

function sgdAssertSupportSession_(token) {
  const session = authSession_(token);
  if (!sgdIsSupportSession_(session)) throw new Error('Esta acción corresponde a las cuentas de apoyo.');
  return session;
}

function sgdSupportDraftAccessAllowed_(session) {
  return !!sgdSupportAccessToken_ && String(session.token) === sgdSupportAccessToken_;
}

function sgdWithSupportDraftAccess_(session, operation) {
  if (!sgdIsSupportSession_(session) || !session.token) throw new Error('Sesión de apoyo inválida.');
  const previous = sgdSupportAccessToken_;
  sgdSupportAccessToken_ = String(session.token);
  try {
    return operation();
  } finally {
    sgdSupportAccessToken_ = previous;
  }
}

function sgdAssertActiveSupportOffice_(officeCode) {
  const office = getOffice_(officeCode);
  if (!office || norm_(office.Activa) !== 'SI') throw new Error('Selecciona una unidad orgánica activa.');
  const holder = getUserByOffice_(officeCode);
  if (!sgdIsOfficeHolder_(holder)) throw new Error('La unidad orgánica requiere un responsable activo.');
  return office;
}

function sgdAssertIndividualSupportPassword_(password) {
  if (password === SGD_MASTER.DEFAULT_USER_PASSWORD || password === SGD_MASTER.INITIAL_PASSWORD) {
    throw new Error('Indica una contraseña individual para esta cuenta.');
  }
}

function masterCreateSupportUserSGD(token, data) {
  return fdLocked_(() => {
    const master = authMaster_(token);
    const username = clean_(data?.username).toLowerCase();
    const name = clean_(data?.name);
    const officeCode = clean_(data?.officeCode);
    const email = clean_(data?.email).toLowerCase();
    const password = String(data?.password || '');
    if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) throw new Error('El usuario admite de 3 a 80 letras, números, puntos, guiones y guiones bajos.');
    if (!name || name.length > 160 || /^[=+@-]/.test(name)) throw new Error('Indica el nombre completo de la persona.');
    if (email && (email.length > 180 || !/^[a-z0-9][a-z0-9.!#$%&'*+/=?^_`{|}~-]*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))) {
      throw new Error('Indica un correo institucional válido.');
    }
    if (password.length > 128) throw new Error('La contraseña admite hasta 128 caracteres.');
    validateNewPassword_(password);
    sgdAssertIndividualSupportPassword_(password);
    const office = sgdAssertActiveSupportOffice_(officeCode);
    if (getUserByUsername_(username)) throw new Error('Ese usuario SGD ya existe.');
    if (email && getUserByEmail_(email)) throw new Error('Ese correo institucional ya está asignado.');
    const userId = 'USR-APOYO-' + Utilities.getUuid();
    const salt = Utilities.getUuid().replace(/-/g, '');
    const now = now_();
    appendObject_('USUARIOS', {
      Usuario_ID: userId, Usuario: username, Password_Hash: hashPassword_(password, salt), Password_Salt: salt,
      'Oficina_Código': officeCode, Rol: SGD_SUPPORT_ROLES_.APOYO, Nombre_Mostrado: name, Responsable: name,
      Cargo_Mostrado: 'APOYO DOCUMENTAL', Correo_Institucional: email, Correo_Confirmado: email ? 'SI' : 'NO',
      Activo: 'SI', Debe_Cambiar_Clave: 'RECOMENDADO', Fecha_Alta: now.text, Fecha_Cambio_Clave: now.text,
      Intentos_Fallidos: 0, Accesos_JSON: '{}',
    });
    clearMasterCaches_();
    audit_(master, 'CREAR_CUENTA_APOYO', 'USUARIO', userId, 'Unidad orgánica ' + officeCode);
    return {ok: true, userId, username, displayName: name, officeCode, officeName: office.Nombre, role: SGD_SUPPORT_ROLES_.APOYO, active: true};
  });
}

function masterSetSupportActiveSGD(token, userId, active) {
  return fdLocked_(() => {
    const master = authMaster_(token);
    const user = getById_('USUARIOS', 'Usuario_ID', clean_(userId));
    if (!sgdIsSupportUser_(user)) throw new Error('Cuenta de apoyo no encontrada.');
    if (typeof active !== 'boolean') throw new Error('Indica el estado de la cuenta.');
    if (active) sgdAssertActiveSupportOffice_(user['Oficina_Código']);
    const value = active ? 'SI' : 'NO';
    if (norm_(user.Activo) === value) return {ok: true, active};
    const props = PropertiesService.getScriptProperties();
    const cache = CacheService.getScriptCache();
    for (const key of sgdOtherSessionKeys_(props, {userId: user.Usuario_ID, token: ''}, Date.now())) {
      props.deleteProperty(key);
      cache.remove('sess:' + key.slice(SGD_SESSION_PROP_PREFIX.length));
    }
    updateRowById_('USUARIOS', 'Usuario_ID', user.Usuario_ID, {Activo: value});
    clearMasterCaches_();
    audit_(master, active ? 'ACTIVAR_CUENTA_APOYO' : 'DESACTIVAR_CUENTA_APOYO', 'USUARIO', user.Usuario_ID, 'Unidad orgánica ' + user['Oficina_Código']);
    return {ok: true, active};
  });
}

function sgdEnsureSupportDocumentColumns_() {
  const key = 'SGD_APOYO_DOCUMENTOS_V1';
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(key) === 'SI') return;
  ensureSheet_(getDb_(), 'DOCUMENTOS', SHEETS.DOCUMENTOS.concat(SGD_SUPPORT_DOCUMENT_COLUMNS_));
  delete __SGD_HEADERS_MEM.DOCUMENTOS;
  delete __SGD_ROWS_MEM.DOCUMENTOS;
  SpreadsheetApp.flush();
  props.setProperty(key, 'SI');
}

function sgdReadSupportProjectText_(document) {
  const text = parseJson_(document && document.Proyecto_Texto_Apoyo, '');
  return typeof text === 'string' ? text : '';
}

function sgdSupportProjectWordBody_(xml, text) {
  try {
    return injectAiBodyIntoDocx240_(xml, text);
  } catch (error) {
    console.warn('El modelo no admite insertar automáticamente el proyecto de apoyo. El texto queda disponible en la ficha.');
    return xml;
  }
}

function sgdSupportDraftAuthor_(document, session, input) {
  const support = sgdIsSupportSession_(session);
  const result = {Usuario_Creador: document?.Usuario_Creador || session.username};
  if (support) {
    result.Elaborador_ID = document?.Elaborador_ID || session.userId;
    result.Elaborador_Nombre = document?.Elaborador_Nombre || session.displayName;
    // JSON prevents a body beginning with "=" from becoming a spreadsheet formula.
    result.Proyecto_Texto_Apoyo = JSON.stringify(input.projectBody);
    result.Proyecto_Delegado_ID = document ? document.Proyecto_Delegado_ID || '' : input.delegatedDocumentId;
  }
  return result;
}

function sgdSupportRawForHolder_(document, raw, session) {
  if (!document.Elaborador_ID) return raw;
  const sameOffice = document.Oficina_Origen === session.officeCode;
  return Object.assign({}, raw, {
    Proyecto_Texto_Apoyo: sameOffice ? sgdReadSupportProjectText_(document) : '',
    Proyecto_Delegado_ID: sameOffice ? document.Proyecto_Delegado_ID || '' : '',
  });
}

function sgdSupportOwnsDraft_(session, document) {
  return !!document && document.Oficina_Origen === session.officeCode && document.Elaborador_ID === session.userId;
}

function sgdAssertSupportCanSave_(session, document) {
  if (!sgdIsSupportSession_(session) || !document) return;
  if (!sgdSupportOwnsDraft_(session, document)) throw new Error('No tienes acceso a este proyecto.');
  if (document.Presentado_Revision || document.Estado !== 'BORRADOR' || document['Número']) {
    throw new Error('El proyecto ya está bajo revisión del titular.');
  }
}

function sgdOwnSupportDrafts_(session) {
  return rowsByField_('DOCUMENTOS', 'Elaborador_ID', session.userId).filter(document => sgdSupportOwnsDraft_(session, document));
}

function sgdSupportDraftPayload_(document) {
  const fields = [
    'Documento_ID', 'Oficina_Origen', 'Usuario_Creador', 'Elaborador_ID', 'Elaborador_Nombre', 'Presentado_Revision',
    'Cliente_Request_ID', 'Tipo', 'Número', 'Estado', 'Asunto', 'Prioridad', 'Días_Atención', 'Proyecto_Delegado_ID',
    'Expediente_ID', 'Versión', 'Última_Gestión',
  ];
  if (!document.Presentado_Revision) {
    fields.push('Destinos_JSON', 'Destinos_Principales_JSON', 'Destino_Principal', 'Copias_JSON',
      'Destinos_Externos_JSON', 'Indicación', 'Observación_Interna');
  }
  const raw = {};
  fields.forEach(key => { raw[key] = document[key] ?? ''; });
  raw.Proyecto_Texto_Apoyo = sgdReadSupportProjectText_(document);
  return clientSafeValue222_({ok: true, raw, submittedAt: raw.Presentado_Revision});
}

function listSupportDraftsSGD(token) {
  const session = sgdAssertSupportSession_(token);
  const items = sgdOwnSupportDrafts_(session).map(document => ({
    documentId: document.Documento_ID, number: document['Número'], type: document.Tipo, subject: document.Asunto,
    status: document.Estado, author: document.Elaborador_Nombre, submittedAt: document.Presentado_Revision,
    lastActivity: document['Última_Gestión'],
  }));
  items.sort((left, right) => parseFlexibleDateMs_(right.lastActivity) - parseFlexibleDateMs_(left.lastActivity));
  return clientSafeValue222_({ok: true, items});
}

function sgdSupportBootstrap_(session) {
  const offices = listOffices_().filter(office => norm_(office.Activa) === 'SI')
    .map(office => ({code: office['Código'], name: office.Nombre, order: office.Orden}));
  const series = listSeriesForOffice_(session.officeCode)
    .filter(entry => norm_(entry.Activa) === 'SI' && !!UNIVERSAL_MODELS.TYPE_FOLDER_BY_SERIES[norm_(entry.Tipo)])
    .map(entry => ({type: entry.Tipo, label: entry.Etiqueta, indexed: norm_(entry.Indexado) === 'SI'}));
  const drafts = sgdOwnSupportDrafts_(session);
  const user = getById_('USUARIOS', 'Usuario_ID', session.userId);
  return {
    ok: true, support: true, version: SGD.VERSION, session, offices, series, now: now_().text,
    counts: {drafts: drafts.filter(document => !document.Presentado_Revision && document.Estado === 'BORRADOR').length},
    recent: [], quickLinks: quickLinksForUser240_(user), firmaInterna: {configured: false, enabled: false},
  };
}

function getSupportDraftSGD(token, documentId) {
  const session = sgdAssertSupportSession_(token);
  const document = getById_('DOCUMENTOS', 'Documento_ID', clean_(documentId));
  if (!sgdSupportOwnsDraft_(session, document)) throw new Error('No tienes acceso a este proyecto.');
  return sgdSupportDraftPayload_(document);
}

function sgdSupportDraftInput_(input, existing) {
  const source = input || {};
  const projectBody = String(source.projectBody ?? '').replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').trim();
  if (projectBody.length > SGD_SUPPORT_PROJECT_MAX_ || JSON.stringify(projectBody).length > 48000) {
    throw new Error('La propuesta admite hasta 18 000 caracteres.');
  }
  // Only document-body text is serialized. Other newly writable spreadsheet strings stay plain.
  const subject = clean_(source.subject), indication = clean_(source.indication), internalObservation = clean_(source.internalObservation);
  if ([subject, indication, internalObservation].some(value => /^[=+@-]/.test(value))) {
    throw new Error('El asunto, la indicación y la observación deben empezar con texto.');
  }
  return {
    documentId: existing?.Documento_ID || '',
    expectedVersion: source.expectedVersion,
    clientRequestId: clean_(source.clientRequestId).slice(0, 100),
    type: clean_(source.type),
    subject,
    priority: ['NORMAL', 'URGENTE', 'MUY URGENTE'].includes(source.priority) ? source.priority : 'NORMAL',
    days: Math.min(36500, Math.max(0, Math.floor(Number(source.days) || 0))),
    destinationPrincipal: clean_(source.destinationPrincipal),
    primaryDestinations: Array.isArray(source.primaryDestinations) ? source.primaryDestinations : [],
    copies: Array.isArray(source.copies) ? source.copies : [],
    externalDestinations: Array.isArray(source.externalDestinations) ? source.externalDestinations : [],
    resolutionNotifyExternal: source.resolutionNotifyExternal === true,
    indication,
    expedienteId: existing?.Expediente_ID || '',
    internalObservation,
    projectBody,
    delegatedDocumentId: existing ? existing.Proyecto_Delegado_ID || '' : clean_(source.delegatedDocumentId),
    signatureMethod: 'FIRMA_DIGITAL',
  };
}

function saveSupportDraftSGD(token, payload) {
  return fdLocked_(() => {
    const session = sgdAssertSupportSession_(token);
    sgdEnsureSupportDocumentColumns_();
    const id = clean_(payload?.documentId);
    const document = id ? getById_('DOCUMENTOS', 'Documento_ID', id) : null;
    if (id && !sgdSupportOwnsDraft_(session, document)) throw new Error('No tienes acceso a este proyecto.');
    sgdAssertSupportCanSave_(session, document);
    const input = sgdSupportDraftInput_(payload, document);
    if (document && (!Number.isSafeInteger(Number(input.expectedVersion)) || Number(input.expectedVersion) < 1)) {
      throw new Error('Vuelve a abrir el proyecto para guardar los cambios.');
    }
    if (!document && input.delegatedDocumentId) {
      if (!sgdHasAssignedDocument_(session, input.delegatedDocumentId)) {
        throw new Error('El documento de origen no está delegado a tu cuenta.');
      }
      input.expedienteId = clean_(getById_('DOCUMENTOS', 'Documento_ID', input.delegatedDocumentId)?.Expediente_ID);
    }
    return sgdWithSupportDraftAccess_(session, () => saveDraftSGDBase250_(token, input));
  });
}

function submitSupportDraftSGD(token, documentId, expectedVersion) {
  return fdLocked_(() => {
    const session = sgdAssertSupportSession_(token);
    const id = clean_(documentId);
    const document = getById_('DOCUMENTOS', 'Documento_ID', id);
    if (!sgdSupportOwnsDraft_(session, document)) throw new Error('No tienes acceso a este proyecto.');
    if (document.Presentado_Revision) return {ok: true, documentId: id, submittedAt: document.Presentado_Revision};
    sgdAssertSupportCanSave_(session, document);
    if (!sgdReadSupportProjectText_(document).trim()) throw new Error('Escribe el contenido del proyecto antes de presentarlo.');
    if (Number(expectedVersion) !== Number(document['Versión'] || 1)) throw new Error('El proyecto cambió en otro dispositivo. Vuelve a abrirlo.');
    if (document.Proyecto_Delegado_ID && !sgdHasAssignedDocument_(session, document.Proyecto_Delegado_ID)) {
      throw new Error('La delegación cambió y este proyecto ya no puede presentarse como respuesta a ella.');
    }
    sgdAssertActiveSupportOffice_(session.officeCode);
    const now = now_();
    updateRowById_('DOCUMENTOS', 'Documento_ID', id, {
      Presentado_Revision: now.iso, 'Última_Gestión': now.text, 'Versión': Number(document['Versión'] || 1) + 1,
    });
    addMovement_(session, id, document.Expediente_ID, 'PRESENTADO_REVISIÓN', session.officeCode, '', 'Proyecto presentado a la revisión del titular', 'BORRADOR', 'BORRADOR', {});
    audit_(session, 'PRESENTAR_PROYECTO_APOYO', 'DOCUMENTO', id, session.officeCode);
    invalidateDocumentViews_(id);
    return {ok: true, documentId: id, submittedAt: now.iso};
  });
}
