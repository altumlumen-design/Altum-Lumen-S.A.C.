const SGD_DELEGATION_SHEET_ = 'DELEGACIONES_SGD';
const SGD_DISPATCH_SHEET_ = 'DESPACHOS_SGD';
const SGD_OPEN_DELEGATION_STATES_ = new Set(['RECIBIDO', 'EN_ATENCIÓN']);

function sgdWriteQueueEvent_(table, office, documentId, data) {
  ensureSheet_(getDb_(), table, ['Oficina_Código', 'Documento_ID', 'Datos_JSON']);
  appendObject_(table, {'Oficina_Código': office, Documento_ID: documentId, Datos_JSON: JSON.stringify(data)});
}

function sgdQueueEvents_(table, column, value, office) {
  return rowsByField_(table, column, value).filter(row => row['Oficina_Código'] === office).map(row => ({
    documentId: clean_(row.Documento_ID),
    ...parseJson_(row.Datos_JSON, {}),
  }));
}

function sgdQueueOfficeUser_(s) {
  const role = norm_(s.role);
  if (role === 'APOYO' || role === 'MAESTRO') throw Error('La operación requiere una cuenta responsable de oficina.');
  return s;
}

function sgdDelegationRouteKey_(route) {
  return clean_(route.Destino_ID) + '|' + formatDateDisplay221_(route.Fecha_Recepción || '');
}

function sgdCurrentDelegationRoute_(routes, office, documentId) {
  return routes.filter(route => route.Documento_ID === documentId && route.Oficina_Destino === office &&
    !['COPIA', 'CONOCIMIENTO'].includes(norm_(route.Tipo_Destino))).slice(-1)[0] || null;
}

function sgdDelegationUsers_(office) {
  return rows_('USUARIOS').filter(user => norm_(user.Rol) === 'APOYO' &&
    norm_(user.Activo) === 'SI' && user['Oficina_Código'] === office).map(user => ({
    id: clean_(user.Usuario_ID),
    name: clean_(user.Responsable || user.Nombre_Mostrado || user.Usuario),
  }));
}

function sgdDelegationContext_(s, documentId) {
  const document = getById_('DOCUMENTOS', 'Documento_ID', documentId);
  const dests = rowsByField_('DESTINATARIOS', 'Documento_ID', documentId);
  const route = sgdCurrentDelegationRoute_(dests, s.officeCode, documentId);
  if (!document || norm_(document.Estado) !== 'EMITIDO' || !route ||
    !SGD_OPEN_DELEGATION_STATES_.has(norm_(route.Estado))) throw Error('El documento debe estar recibido y pendiente de atención en tu oficina.');
  const routeKey = sgdDelegationRouteKey_(route);
  const event = sgdQueueEvents_(SGD_DELEGATION_SHEET_, 'Documento_ID', documentId, s.officeCode)
    .filter(event => event.route === routeKey).slice(-1)[0] || null;
  return {document, route, routeKey, event};
}

function sgdHasAssignedDocument_(s, documentId) {
  if (norm_(s.role) !== 'APOYO') return false;
  try {
    const context = sgdDelegationContext_(s, documentId);
    return Boolean(context.event && context.event.assignee === s.userId);
  } catch (error) {
    return false;
  }
}

function getSgdDelegationSGD(token, documentId) {
  const s = sgdQueueOfficeUser_(authSession_(token));
  const state = sgdDelegationContext_(s, clean_(documentId));
  return {number: clean_(state.document['Número'] || documentId), current: state.event, users: sgdDelegationUsers_(s.officeCode)};
}

function setSgdDelegationSGD(token, documentId, request) {
  return fdLocked_(() => {
    const s = sgdQueueOfficeUser_(authSession_(token));
    documentId = clean_(documentId);
    const {routeKey, event} = sgdDelegationContext_(s, documentId);
    const assignee = clean_(request?.assignee);
    const note = clean_(request?.note);
    if (note.length > 500) throw Error('La indicación admite hasta 500 caracteres.');
    if (assignee && !sgdDelegationUsers_(s.officeCode).some(user => user.id === assignee)) {
      throw Error('Elige una cuenta de apoyo activa de la misma oficina.');
    }
    if (assignee === (event?.assignee || '') && note === (event?.note || '')) return {ok:true};
    if (clean_(request?.expected) !== (event?.revision || '')) throw Error('La delegación cambió. Vuelve a abrir el documento.');
    if (!assignee && !event?.assignee) return {ok:true};
    const time = now_();
    const record = {revision: Utilities.getUuid(), route: routeKey, assignee, note, at: time.text,
      actor: s.userId, actorName: s.displayName || s.username};
    sgdWriteQueueEvent_(SGD_DELEGATION_SHEET_, s.officeCode, documentId, record);
    audit_(s, assignee ? 'DOCUMENTO_DELEGADO' : 'DELEGACION_RETIRADA', 'DOCUMENTO', documentId, record.revision);
    return {ok:true};
  });
}

function getSgdDelegatedPdfSGD(token, documentId) {
  const s = authSession_(token);
  documentId = clean_(documentId);
  if (!sgdHasAssignedDocument_(s, documentId)) throw Error('El documento ya no está delegado a tu cuenta.');
  return sgdWithSupportDraftAccess_(s, () => getDocumentPdfPayloadSGD(token, documentId));
}

function sgdDispatchRecipients_(document) {
  return normalizeExternalRecipients233_(parseJson_(document.Destinos_Externos_JSON, []));
}

function sgdDispatchEdition_(document, recipients) {
  const identity = [
    formatDateDisplay221_(document.Fecha_Emisión),
    clean_(document['Número']),
    clean_(document.PDF_Hash || document.PDF_Final_ID),
    recipients,
  ];
  return sha256_(JSON.stringify(identity));
}

function sgdDispatchSummary_(document, events) {
  const recipients = sgdDispatchRecipients_(document);
  const recorded = new Map();
  if (!recipients.length) return {recipients, edition:'', recorded};
  const edition = sgdDispatchEdition_(document, recipients);
  for (const event of events) {
    if (event.edition === edition && recipients[event.recipient]) recorded.set(event.recipient, event);
  }
  return {recipients, edition, recorded};
}

function sgdDispatchContext_(s, documentId) {
  const document = getById_('DOCUMENTOS', 'Documento_ID', documentId);
  if (!document || document.Oficina_Origen !== s.officeCode || norm_(document.Estado) !== 'EMITIDO' ||
    norm_(document.Es_Histórico) === 'SI') throw Error('El despacho se registra desde la oficina que emitió el documento.');
  const events = sgdQueueEvents_(SGD_DISPATCH_SHEET_, 'Documento_ID', documentId, s.officeCode);
  const state = sgdDispatchSummary_(document, events);
  if (!state.recipients.length) throw Error('El documento no tiene destinatarios externos.');
  return {document, ...state};
}

function getSgdDispatchSGD(token, documentId) {
  const s = sgdQueueOfficeUser_(authSession_(token));
  const {document, recipients, edition, recorded} = sgdDispatchContext_(s, clean_(documentId));
  return {edition, issuedOn:sgdAgendaDate_(document.Fecha_Emisión), today:sgdAgendaDate_(now_().iso),
    number: clean_(document['Número'] || documentId), recipients: recipients.map((recipient, index) => ({
    ...recipient, index, dispatch: recorded.get(index) || null,
  }))};
}

function recordSgdDispatchSGD(token, documentId, request) {
  return fdLocked_(() => {
    const s = sgdQueueOfficeUser_(authSession_(token));
    documentId = clean_(documentId);
    const {document, edition, recipients, recorded} = sgdDispatchContext_(s, documentId);
    const recipient = Number(request?.recipient);
    const method = clean_(request?.method);
    const receipt = clean_(request?.receipt);
    const sentOn = clean_(request?.sentOn);
    const time = now_();
    const today = sgdAgendaDate_(time.iso);
    const issuedOn = sgdAgendaDate_(document.Fecha_Emisión);
    if (request?.edition !== edition) throw Error('El documento cambió desde la última consulta. Vuelve a abrirlo.');
    if (request?.recipient === '' || request?.recipient === null || !Number.isInteger(recipient) || !recipients[recipient]) {
      throw Error('Elige un destinatario válido.');
    }
    if (!['Mensajería','Entrega directa','Correo electrónico','Otro'].includes(method) || !receipt || receipt.length > 300) {
      throw Error('Indica el medio y el número de cargo o la referencia de entrega (hasta 300 caracteres).');
    }
    if (!sentOn || sgdAgendaDate_(sentOn) !== sentOn || sentOn > today || (issuedOn && sentOn < issuedOn)) {
      throw Error('Indica una fecha de despacho desde la emisión del documento y hasta hoy.');
    }
    const existing = recorded.get(recipient);
    if (existing) {
      if (existing.method === method && existing.receipt === receipt && existing.sentOn === sentOn) return {ok:true};
      throw Error('Este destinatario ya cuenta con un despacho registrado.');
    }
    const record = {edition, recipient, method, receipt, sentOn, at: time.text, actor: s.userId, actorName: s.displayName || s.username};
    sgdWriteQueueEvent_(SGD_DISPATCH_SHEET_, s.officeCode, documentId, record);
    audit_(s, 'DESPACHO_REGISTRADO', 'DOCUMENTO', documentId, method + ' | Destinatario ' + String(recipient + 1));
    return {ok:true};
  });
}

function sgdOperationalQueueRows_(s, box) {
  const office = s.officeCode;
  const items = [];
  if (box === 'DELEGADOS') {
    const events = sgdQueueEvents_(SGD_DELEGATION_SHEET_, 'Oficina_Código', office, office);
    if (!events.length) return items;
    const users = new Map(sgdDelegationUsers_(office).map(user => [user.id, user.name]));
    const grounds = new Map();
    for (const route of rowsByField_('DESTINATARIOS', 'Oficina_Destino', office)) {
      if (route.Oficina_Destino === office && !['COPIA', 'CONOCIMIENTO'].includes(norm_(route.Tipo_Destino))) {
        grounds.set(route.Documento_ID, route);
      }
    }
    const latest = new Map();
    for (const event of events) {
      const route = grounds.get(event.documentId);
      if (route && SGD_OPEN_DELEGATION_STATES_.has(norm_(route.Estado)) && event.route === sgdDelegationRouteKey_(route)) {
        latest.set(event.documentId, event);
      }
    }
    const documents = rows_('DOCUMENTOS');
    const projects = new Map();
    for (const project of documents) {
      const event = latest.get(project.Proyecto_Delegado_ID);
      if (event?.assignee && project.Elaborador_ID === event.assignee && project.Oficina_Origen === office &&
        !['DESCARTADO','ANULADO','HISTÓRICO'].includes(norm_(project.Estado))) projects.set(project.Proyecto_Delegado_ID, project);
    }
    for (const document of documents) {
      const event = latest.get(document.Documento_ID);
      if (!event?.assignee || norm_(document.Estado) !== 'EMITIDO' || (norm_(s.role) === 'APOYO' && event.assignee !== s.userId)) continue;
      const route = grounds.get(document.Documento_ID);
      const summary = docSummary_(document, route, []);
      const project = projects.get(document.Documento_ID);
      const projectState = project ? (project.Presentado_Revision ? 'Proyecto presentado' : 'Proyecto en preparación') : 'Por proyectar';
      items.push({...summary, origin: route.Oficina_Origen || summary.origin, lastActivity: clean_(event.at||summary.lastActivity),
        queueDetail: users.get(event.assignee) || 'Cuenta de apoyo inactiva', queueNote: event.note || '',
        queueAuthor: clean_(document.Elaborador_Nombre), queueProjectState: projectState,
        ...(project && norm_(s.role) === 'APOYO' ? {queueProjectId: project.Documento_ID} : {})});
    }
    return items;
  }
  sgdQueueOfficeUser_(s);
  const documents = rowsByField_('DOCUMENTOS', 'Oficina_Origen', office)
    .filter(document => norm_(document.Estado) === 'EMITIDO' && norm_(document.Es_Histórico) !== 'SI');
  if (!documents.length) return items;
  const byDocument = new Map();
  if (box === 'ENVIADOS') {
    const ownIds = new Set(documents.map(document => document.Documento_ID));
    for (const route of rows_('DESTINATARIOS')) {
      if (!ownIds.has(route.Documento_ID)) continue;
      const list = byDocument.get(route.Documento_ID) || [];
      list.push(route);
      byDocument.set(route.Documento_ID, list);
    }
  }
  const events = new Map();
  if (box === 'SALIDA') for (const event of sgdQueueEvents_(SGD_DISPATCH_SHEET_, 'Oficina_Código', office, office)) {
    const list = events.get(event.documentId) || [];
    list.push(event);
    events.set(event.documentId, list);
  }
  const authors = new Map(rows_('USUARIOS').filter(user => user['Oficina_Código'] === office)
    .map(user => [clean_(user.Usuario), clean_(user.Responsable || user.Nombre_Mostrado || user.Usuario)]));
  for (const document of documents) {
    const recipients = byDocument.get(document.Documento_ID) || [];
    const summary = {...docSummary_(document, null, recipients),
      queueAuthor: clean_(document.Elaborador_Nombre) || authors.get(clean_(document.Usuario_Creador)) || ''};
    if (box === 'ENVIADOS') {
      const destinations = [...new Set(recipients.filter(route => activeDestination224_(route))
        .map(route => route.Oficina_Destino).filter(Boolean))];
      summary.queueDestinations = destinations;
      summary.queueDetail = destinations.join(', ') || (sgdDispatchRecipients_(document).length ? 'Destinatarios externos' : '');
      items.push(summary);
      continue;
    }
    const state = sgdDispatchSummary_(document, events.get(document.Documento_ID) || []);
    if (!state.recipients.length) continue;
    const count = state.recorded.size;
    const total = state.recipients.length;
    summary.status = count === total ? 'Despachado' : count ? 'Despacho parcial' : 'Pendiente de registro';
    summary.queueDetail = count + ' de ' + total + ' destinatarios registrados';
    summary.flowProgress = null;
    const last = [...state.recorded.values()].slice(-1)[0];
    if (last?.at) summary.lastActivity = last.at;
    items.push(summary);
  }
  return items;
}

function listSgdWorkQueueSGD(token, box, filters={}) {
  const s = authSession_(token);
  if (!['DELEGADOS','ENVIADOS','SALIDA'].includes(box)) throw Error('Bandeja no disponible.');
  if (norm_(s.role) === 'MAESTRO') throw Error('Elige una cuenta de oficina.');
  const {q, type, dateFrom, dateTo, priority, origin, status, projectState} = filters || {};
  const limit = Math.min(75, Math.max(10, Number(filters?.limit) || 50));
  const offset = Math.max(0, Number(filters?.offset) || 0);
  let rows = sgdOperationalQueueRows_(s, box);
  if (q) rows = rows.filter(row => matchesDocumentQuery221_({...row, subject: [row.subject, row.queueDetail, row.queueAuthor].join(' ')}, q));
  if (status === 'PENDIENTES' && box === 'SALIDA') rows = rows.filter(row => row.status !== 'Despachado');
  else if (status) rows = rows.filter(row => norm_(row.status) === norm_(status));
  if (projectState && box === 'DELEGADOS') rows = rows.filter(row => row.queueProjectState === projectState);
  if (type) rows = rows.filter(row => norm_(row.type) === norm_(type));
  if (priority || origin) rows = sgdFilterBandeja_(rows, priority, origin);
  const from = parseDateFilterBoundary221_(dateFrom, false), to = parseDateFilterBoundary221_(dateTo, true);
  if (from || to) rows = rows.filter(row => {
    const time = parseFlexibleDateMs_(row.emissionDate || row.date);
    return time && (!from || time >= from) && (!to || time <= to);
  });
  rows.sort((a, b) => parseFlexibleDateMs_(b.lastActivity || b.emissionDate) - parseFlexibleDateMs_(a.lastActivity || a.emissionDate) ||
    String(a.documentId).localeCompare(String(b.documentId)));
  const items = rows.slice(offset, offset + limit);
  return {ok:true, items, total:rows.length, hasMore:offset + items.length < rows.length};
}
