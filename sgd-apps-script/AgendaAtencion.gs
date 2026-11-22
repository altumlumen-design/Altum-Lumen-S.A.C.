function sgdAgendaDate_(value) {
  if (!value) return '';
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, SGD.TZ, 'yyyy-MM-dd');
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  const day = iso ? iso[0] : local ? [local[3], local[2].padStart(2, '0'), local[1].padStart(2, '0')].join('-') : '';
  const date = new Date(day ? day + 'T00:00:00Z' : text);
  if (isNaN(date.getTime())) return '';
  return day ? (date.toISOString().slice(0, 10) === day ? day : '') : Utilities.formatDate(date, SGD.TZ, 'yyyy-MM-dd');
}

function sgdAgendaDeadline_(received, duration) {
  const days = Number(duration);
  const date = sgdAgendaDate_(received);
  const midnight = new Date(date + 'T00:00:00Z');
  if (!Number.isSafeInteger(days) || days < 1 || days > 36500 || isNaN(midnight.getTime())) return '';
  midnight.setUTCDate(midnight.getUTCDate() + days);
  return midnight.toISOString().slice(0, 10);
}

function getAttentionAgendaSGD(token, month, selection, offset) {
  const session = auth_(token);
  const today = Utilities.formatDate(new Date(), SGD.TZ, 'yyyy-MM-dd');
  month = clean_(month) || today.slice(0, 7);
  selection = clean_(selection) || (today.startsWith(month + '-') ? today : month + '-01');
  if (!/^(?:19|20|21)\d\d-(?:0[1-9]|1[0-2])$/.test(month)) throw new Error('Selecciona un mes válido.');
  if (!['OVERDUE', 'UNSCHEDULED'].includes(selection) &&
      (!selection.startsWith(month + '-') || sgdAgendaDate_(selection) !== selection)) {
    throw new Error('Selecciona una fecha del mes.');
  }
  offset = Math.max(0, Math.floor(Number(offset) || 0));
  const destinations = new Map();
  const open = new Set(['RECIBIDO', 'EN_ATENCIÓN']);
  for (const route of rowsByField_('DESTINATARIOS', 'Oficina_Destino', session.officeCode)) {
    if (open.has(norm_(route.Estado)) && !['COPIA', 'CONOCIMIENTO'].includes(norm_(route.Tipo_Destino))) {
      const previous = destinations.get(route.Documento_ID);
      if (!previous || sgdAgendaDate_(route.Fecha_Recepción) >= sgdAgendaDate_(previous.Fecha_Recepción)) {
        destinations.set(route.Documento_ID, route);
      }
    }
  }
  const days = {};
  let overdue = 0, unscheduled = 0;
  const matches = [];
  if (destinations.size) for (const document of rows_('DOCUMENTOS')) {
    const route = destinations.get(document.Documento_ID);
    if (!route || norm_(document.Estado) !== 'EMITIDO') continue;
    const received = sgdAgendaDate_(route.Fecha_Recepción);
    const due = sgdAgendaDeadline_(route.Fecha_Recepción, document['Días_Atención']);
    if (!due) unscheduled++;
    else if (due < today) overdue++;
    if (due.startsWith(month + '-')) days[due] = (days[due] || 0) + 1;
    if (due === selection || (selection === 'OVERDUE' && due && due < today) || (selection === 'UNSCHEDULED' && !due)) {
      matches.push({
        documentId: document.Documento_ID,
        number: String(document['Número'] || document.Tipo || ''),
        subject: String(document.Asunto || '').slice(0, 250),
        expediente: String(document.Expediente_ID || ''),
        origin: String(route.Oficina_Origen || document.Oficina_Origen || ''),
        status: String(route.Estado || ''),
        priority: String(route.Prioridad || document.Prioridad || 'NORMAL'),
        received,
        due,
      });
    }
  }
  matches.sort((a, b) => a.due.localeCompare(b.due) || a.received.localeCompare(b.received) || a.documentId.localeCompare(b.documentId));
  return {today, month, selection, days, overdue, unscheduled, total: matches.length, items: matches.slice(offset, offset + 40)};
}
