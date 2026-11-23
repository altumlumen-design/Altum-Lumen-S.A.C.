const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const read = file => fs.readFileSync(path.join(__dirname, '..', 'sgd-apps-script', file), 'utf8');

const sessions = {
  lead: {role: 'USER', officeCode: 'SG', userId: 'u0'},
  support: {role: 'APOYO', officeCode: 'SG', userId: 'u1'},
  peer: {role: 'APOYO', officeCode: 'SG', userId: 'u2'},
  external: {role: 'APOYO', officeCode: 'DA', userId: 'u3'},
  master: {role: 'MAESTRO', officeCode: 'MASTER', userId: 'u4'},
};
const docs = [
  {Documento_ID: 'inbound', Oficina_Origen: 'DA', Estado: 'EMITIDO', 'Número':'MEMO-7'},
  {Documento_ID: 'copy', Oficina_Origen: 'DA', Estado: 'EMITIDO', 'Número':'MEMO-8'},
  {Documento_ID: 'out', Oficina_Origen: 'SG', Estado: 'EMITIDO', 'Número':'OFICIO-3', Usuario_Creador:'titular', PDF_Final_ID:'pdf-3', PDF_Hash:'original', Fecha_Emisión:'2026-11-20', 'Versión':'1',
    Destinos_Externos_JSON: JSON.stringify([{name:'Empresa A',address:'Lima'}, {name:'Empresa B',address:'Cusco'}])},
  {Documento_ID: 'sent', Oficina_Origen: 'SG', Estado: 'EMITIDO', 'Número':'PROVEÍDO-4', Usuario_Creador:'titular'},
  {Documento_ID: 'previous', Oficina_Origen: 'SG', Estado: 'HISTÓRICO', 'Número':'OFICIO-1', Destinos_Externos_JSON:'[{"name":"Previo"}]'},
];
const routes = [
  {Documento_ID:'inbound', Oficina_Origen:'DA', Oficina_Destino:'SG', Estado:'RECIBIDO', Destino_ID:'r1', Fecha_Recepción:'2026-11-20'},
  {Documento_ID:'copy', Oficina_Origen:'DA', Oficina_Destino:'SG', Estado:'RECIBIDO', Destino_ID:'r2', Fecha_Recepción:'2026-11-20', Tipo_Destino:'COPIA'},
  {Documento_ID:'sent', Oficina_Origen:'SG', Oficina_Destino:'DA', Estado:'PENDIENTE', Destino_ID:'r3'},
];
const users = [
  {Usuario_ID:'u0', Usuario:'titular', Responsable:'Titular', Rol:'USER', 'Oficina_Código':'SG', Activo:'SI'},
  {Usuario_ID:'u1', Usuario:'ana', Responsable:'Ana', Rol:'APOYO', 'Oficina_Código':'SG', Activo:'SI'},
  {Usuario_ID:'u2', Usuario:'diego', Responsable:'Diego', Rol:'APOYO', 'Oficina_Código':'SG', Activo:'SI'},
  {Usuario_ID:'u3', Usuario:'luz', Responsable:'Luz', Rol:'APOYO', 'Oficina_Código':'DA', Activo:'SI'},
];
const tables = {DOCUMENTOS:docs, DESTINATARIOS:routes, USUARIOS:users};
let revision = 0, audits = [];
const env = {
  authSession_: token => {
    if (!sessions[token]) throw Error('SESSION_EXPIRED');
    return sessions[token];
  },
  fdLocked_: fn => fn(),
  ensureSheet_: (_, table) => { tables[table] ||= []; },
  getDb_: () => ({}),
  appendObject_: (table, item) => tables[table].push(item),
  rows_: table => tables[table] || [],
  rowsByField_: (table, column, value) => (tables[table] || []).filter(i=>i[column]===value),
  getById_: (table, column, value) => (tables[table] || []).find(i=>i[column]===value),
  clean_: value => String(value ?? '').trim(),
  norm_: value => String(value ?? '').trim().toUpperCase(),
  parseJson_: (value, fallback) => value ? JSON.parse(value) : fallback,
  formatDateDisplay221_: value => String(value || ''),
  activeDestination224_: route => !['ANULADO','REMISIÓN_REVOCADA'].includes(route.Estado),
  docSummary_: (doc, route) => ({documentId:doc.Documento_ID, origin:doc.Oficina_Origen, status:route?.Estado||doc.Estado, hasPdf:true}),
  normalizeExternalRecipients233_: value => value,
  matchesDocumentQuery221_: (row, q) => row.subject.toLowerCase().includes(q.toLowerCase()),
  parseDateFilterBoundary221_: value => Date.parse(value)||0,
  parseFlexibleDateMs_: value => Date.parse(value)||0,
  sgdWithSupportDraftAccess_: (s, fn) => fn(),
  getDocumentPdfPayloadSGD: (_, documentId) => ({documentId}),
  now_: () => ({text:'2026-11-22',iso:'2026-11-22T15:00:00Z'}),
  SGD: {TZ:'America/Lima'},
  Utilities: {getUuid: ()=>'rev-'+ ++revision,formatDate:value=>value.toISOString().slice(0,10)},
  sha256_: value => createHash('sha256').update(value).digest('hex'),
  audit_: (...event) => audits.push(event),
};
vm.runInNewContext(read('AgendaAtencion.gs')+read('FiltrosBandeja.gs')+read('BandejasOperativas.gs'), env);

const {listSgdWorkQueueSGD: list, setSgdDelegationSGD: delegate, getSgdDelegationSGD: getDelegation,
  getSgdDelegatedPdfSGD: pdf, getSgdDispatchSGD: getDispatch, recordSgdDispatchSGD: dispatch} = env;
assert.throws(()=>list('unknown','DELEGADOS'),/SESSION_EXPIRED/);
assert.throws(()=>list('master','DELEGADOS'),/cuenta de oficina/);
assert.throws(()=>list('support','SALIDA'),/responsable de oficina/);
assert.throws(()=>delegate('support','inbound',{assignee:'u2'}),/responsable de oficina/);
assert.throws(()=>delegate('lead','inbound',{assignee:'u3'}),/misma oficina/);
assert.throws(()=>delegate('lead','copy',{assignee:'u1'}),/pendiente de atención/);
delegate('lead','inbound',{assignee:'u1', note:'Preparar informe', expected:''});
delegate('lead','inbound',{assignee:'u1', note:'Preparar informe', expected:''});
assert.equal(tables.DELEGACIONES_SGD.length, 1);
assert.equal(list('support','DELEGADOS').items[0].queueDetail, 'Ana');
assert.equal(list('peer','DELEGADOS').total, 0);
assert.equal(list('external','DELEGADOS').total, 0);
assert.equal(pdf('support','inbound').documentId, 'inbound');
assert.throws(()=>pdf('peer','inbound'),/ya no está delegado/);
docs.push({Documento_ID:'project', Oficina_Origen:'SG', Estado:'BORRADOR', Proyecto_Delegado_ID:'inbound', Elaborador_ID:'u1'});
assert.equal(list('support','DELEGADOS', {projectState:'Proyecto en preparación'}).items[0].queueProjectId, 'project');
assert.equal(list('lead','DELEGADOS').items[0].queueProjectId, undefined);
const expected = getDelegation('lead','inbound').current.revision;
assert.throws(()=>delegate('lead','inbound',{assignee:'u2',expected:'stale'}),/delegación cambió/);
delegate('lead','inbound',{assignee:'u2',expected});
assert.equal(list('support','DELEGADOS').total,0);
assert.equal(list('peer','DELEGADOS').items[0].queueProjectState,'Por proyectar');
routes[0].Estado = 'ATENDIDO';
assert.equal(list('peer','DELEGADOS').total,0);
assert.throws(()=>pdf('peer','inbound'),/ya no está delegado/);

const sent = list('lead','ENVIADOS');
assert.deepEqual(Array.from(sent.items, row=>row.documentId).sort(), ['out','sent']);
assert.equal(sent.items.find(row=>row.documentId==='sent').queueDetail,'DA');
assert.equal(sent.items[0].queueAuthor,'Titular');
assert.equal(list('lead','SALIDA').items[0].status,'Pendiente de registro');
const {edition} = getDispatch('lead','out');
const proof = {edition, recipient:'0', method:'Mensajería', receipt:'Cargo 14',sentOn:'2026-11-21'};
assert.throws(()=>dispatch('support','out',proof),/responsable de oficina/);
assert.throws(()=>dispatch('lead','out',{...proof, edition:'old'}),/documento cambió/);
assert.throws(()=>dispatch('lead','out',{...proof,sentOn:'2026-11-19'}),/fecha de despacho/);
assert.throws(()=>dispatch('lead','out',{...proof,sentOn:'2026-11-23'}),/fecha de despacho/);
dispatch('lead','out',proof);
dispatch('lead','out',proof);
assert.equal(tables.DESPACHOS_SGD.length, 1);
assert.equal(list('lead','SALIDA').items[0].status,'Despacho parcial');
assert.throws(()=>dispatch('lead','out',{...proof,receipt:'Cargo 15'}),/ya cuenta con un despacho/);
dispatch('lead','out',{...proof,recipient:'1',receipt:'Cargo 16'});
assert.equal(list('lead','SALIDA').items[0].status,'Despachado');
assert.equal(list('lead','SALIDA',{status:'PENDIENTES'}).total,0);
const outgoing = docs.find(item=>item.Documento_ID==='out');
outgoing['Versión'] = '2';
outgoing.PDF_Final_ID = 'recovered-pdf-3';
assert.equal(list('lead','SALIDA',{status:'PENDIENTES'}).total,0);
outgoing.PDF_Hash = 'new-signed-edition';
assert.equal(list('lead','SALIDA',{status:'PENDIENTES'}).items[0].status,'Pendiente de registro');
assert.equal(audits.filter(event=>event[1]==='DESPACHO_REGISTRADO').length,2);
console.log('PASS: inbound delegation, support office isolation, reassignment, sent rows and per-recipient dispatch');
