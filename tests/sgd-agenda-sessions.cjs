const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gs = file => fs.readFileSync(path.join(__dirname, '..', 'sgd-apps-script', file), 'utf8');
const fixed = new Date('2026-11-22T13:00:00Z');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }
  static now() { return fixed.getTime(); }
}
const format = value => {
  const date = new Date(value.getTime() - 5 * 3600000);
  return date.toISOString().slice(0, 10);
};
const routes = [
  {Documento_ID: 'today', Oficina_Destino: 'SG', Estado: 'RECIBIDO', Fecha_Recepción: '20/11/2026 19:15:20', Tipo_Destino: 'PRINCIPAL'},
  {Documento_ID: 'today', Oficina_Destino: 'SG', Estado: 'EN_ATENCIÓN', Fecha_Recepción: '2026-11-19'},
  {Documento_ID: 'old', Oficina_Destino: 'SG', Estado: 'EN_ATENCIÓN', Fecha_Recepción: '2026-11-02'},
  {Documento_ID: 'no-date', Oficina_Destino: 'SG', Estado: 'RECIBIDO'},
  {Documento_ID: 'closed', Oficina_Destino: 'SG', Estado: 'ATENDIDO', Fecha_Recepción: '2026-11-01'},
  {Documento_ID: 'cc', Oficina_Destino: 'SG', Estado: 'RECIBIDO', Fecha_Recepción: '2026-11-01', Tipo_Destino: 'COPIA'},
  {Documento_ID: 'different', Oficina_Destino: 'DA', Estado: 'RECIBIDO', Fecha_Recepción: '2026-11-01'},
];
const documents = routes.map(route => route.Documento_ID).filter((id, i, all) => all.indexOf(id) === i).map(id => ({
  Documento_ID: id, Estado: 'EMITIDO', 'Días_Atención': 2,
}));
const session = {userId: 'u1', token: 'keep', officeCode: 'SG', loginAt: '2026-11-22T08:00:00-05:00'};
const sessions = new Map();
const sessionProperty = token => 'SGD_SESS:' + token;
function put(token, userId, expiresAt) {
  sessions.set(sessionProperty(token), JSON.stringify({expiresAt, session: JSON.stringify({token, userId})}));
}
put('keep', 'u1', fixed.getTime() + 100000);
put('close', 'u1', fixed.getTime() + 100000);
put('expired', 'u1', fixed.getTime() - 10);
put('different', 'u2', fixed.getTime() + 100000);
sessions.set('configuration', 'untouched');
const invalidated = [], audited = [];
const authorized = token => {
  if (token !== 'keep') throw Error('SESSION_EXPIRED');
  return session;
};
const context = {
  Date: Clock, SGD: {TZ: 'America/Lima'}, SGD_SESSION_PROP_PREFIX: 'SGD_SESS:',
  auth_: authorized, authSession_: authorized,
  clean_: value => String(value ?? '').trim(),
  norm_: value => String(value ?? '').trim().toUpperCase(),
  Utilities: {formatDate: format},
  rowsByField_: (table, key, value) => routes.filter(route => route[key] === value),
  rows_: () => documents,
  sessionPropKey_: sessionProperty,
  parseFlexibleDateMs_: value => Date.parse(value) || 0,
  PropertiesService: {getScriptProperties: () => ({
    getProperties: () => Object.fromEntries(sessions),
    deleteProperty: key => sessions.delete(key),
  })},
  CacheService: {getScriptCache: () => ({remove: key => invalidated.push(key)})},
  fdLocked_: callback => callback(),
  audit_: (...args) => audited.push(args),
};
vm.runInNewContext(gs('AgendaAtencion.gs') + gs('SesionesCuenta.gs'), context);
const deadline = context.sgdAgendaDeadline_;
assert.equal(deadline('28/02/2024 23:59:59', 1), '2024-02-29');
assert.equal(deadline('31/12/2025', 1), '2026-01-01');
assert.equal(deadline('2026-11-20T01:00:00Z', 1), '2026-11-20');
assert.equal(deadline('31/02/2026', 2), '');
assert.equal(deadline('2026-11-20', 0), '');
assert.equal(deadline('2026-11-20', 1.25), '');

const agenda = context.getAttentionAgendaSGD;
assert.throws(() => agenda('other'), /SESSION_EXPIRED/);
assert.throws(() => agenda('keep', '2026-13'), /mes válido/);
assert.throws(() => agenda('keep', '2026-11', '2026-10-01'), /fecha del mes/);
const today = agenda('keep');
assert.equal(today.today, '2026-11-22');
assert.equal(today.total, 1);
assert.equal(today.items[0].documentId, 'today');
assert.deepEqual(Object.keys(today.days).sort(), ['2026-11-04', '2026-11-22']);
assert.equal(today.overdue, 1);
assert.equal(agenda('keep', '', 'OVERDUE').items[0].documentId, 'old');
assert.equal(agenda('keep', '', 'UNSCHEDULED').items[0].documentId, 'no-date');

const isCurrent = context.sgdCredentialIsCurrent_;
assert.equal(isCurrent({...session, credentialVersion: 's1'}, {Password_Salt: 's1'}), true);
assert.equal(isCurrent({...session, credentialVersion: 's1'}, {Password_Salt: 's2'}), false);
assert.equal(isCurrent(session, {Fecha_Cambio_Clave: '2026-11-22T07:00:00-05:00'}), true);
assert.equal(isCurrent(session, {Fecha_Cambio_Clave: '2026-11-22T09:00:00-05:00'}), false);
assert.equal(context.getSgdSessionOverviewSGD('keep').others, 1);
assert.throws(() => context.closeOtherSgdSessionsSGD('other'), /SESSION_EXPIRED/);
assert.equal(context.closeOtherSgdSessionsSGD('keep').closed, 1);
assert.deepEqual(invalidated, ['sess:close']);
assert.equal(audited.length, 1);
assert.equal(context.getSgdSessionOverviewSGD('keep').others, 0);
assert.equal(sessions.has(sessionProperty('keep')), true);
assert.equal(sessions.has(sessionProperty('different')), true);
console.log('PASS: calendar bounds, Lima, leap days, office scope, overdue items, credentials and multi-device session revocation');
