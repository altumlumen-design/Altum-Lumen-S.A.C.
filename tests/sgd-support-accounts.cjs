const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sgd-apps-script', 'UsuariosApoyo.gs'), 'utf8');
const past = '2026-11-22T22:00:00.000Z';
const users = new Map([
  ['owner', {Usuario_ID:'owner', Usuario:'director', Rol:'USUARIO', Activo:'SI', 'Oficina_Código':'A'}],
  ['other-owner', {Usuario_ID:'other-owner', Usuario:'admin', Rol:'ADMIN', Activo:'SI', 'Oficina_Código':'B'}],
]);
const people = new Map([
  ['master', {token:'master', role:'MAESTRO', userId:'master'}],
  ['support', {token:'support', role:'APOYO', userId:'support', officeCode:'A', username:'maria', displayName:'María Flores'}],
  ['other-support', {token:'other-support', role:'APOYO', userId:'other-support', officeCode:'A', username:'julia', displayName:'Julia Flores'}],
  ['holder', {token:'holder', role:'USUARIO', userId:'owner', officeCode:'A', username:'director'}],
  ['external-holder', {token:'external-holder', role:'USUARIO', userId:'other-owner', officeCode:'B', username:'admin'}],
]);
const documents = new Map();
documents.set('assigned-id', {Documento_ID:'assigned-id', Expediente_ID:'expediente-delegado'});
const changes = [];
const props = new Map();
let id = 0, ownedDraftCalls = 0, held = false, activeAssignment = true;
const ctx = {
  console: {warn: () => {}},
  norm_: value => String(value ?? '').trim().toUpperCase(),
  clean_: value => String(value ?? '').trim(),
  parseJson_: (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } },
  authSession_: token => {
    if (!people.has(token)) throw Error('SESSION_EXPIRED');
    return people.get(token);
  },
  authMaster_: token => {
    const session = people.get(token);
    if (session?.role !== 'MAESTRO') throw Error('Solo Maestro');
    return session;
  },
  fdLocked_: callback => {
    if (held) throw Error('Unexpected concurrent lock');
    held = true;
    try { return callback(); } finally { held = false; }
  },
  sgdHasAssignedDocument_: (session, documentId) => activeAssignment && session.token === 'support' && documentId === 'assigned-id',
  SGD_MASTER: {DEFAULT_USER_PASSWORD:'shared-default-shall-not-be-used', INITIAL_PASSWORD:'legacy-shared-should-not-be-used'},
  SGD_SESSION_PROP_PREFIX:'sgd:',
  sgdOtherSessionKeys_: () => ['sgd:browser-session'],
  getOffice_: officeCode => ({A:{Nombre:'Oficina A',Activa:'SI'},B:{Nombre:'Oficina B',Activa:'SI'}}[officeCode]),
  getUserByOffice_: officeCode => [...users.values()].find(user => user['Oficina_Código'] === officeCode && ctx.sgdIsOfficeHolder_(user)),
  getUserByUsername_: username => [...users.values()].find(user => user.Usuario === username),
  getUserByEmail_: email => [...users.values()].find(user => user.Correo_Institucional === email),
  getById_: (table, key, value) => (table === 'USUARIOS' ? users : documents).get(value),
  rowsByField_: (table, key, value) => [...documents.values()].filter(document => document[key] === value),
  validateNewPassword_: password => { if (password.length < 10) throw Error('Password too short'); },
  hashPassword_: (password, salt) => 'hashed-' + salt,
  now_: () => ({iso:past,text:'22/11/2026 17:00:00'}),
  Utilities: {getUuid: () => 'test-uuid-' + ++id},
  appendObject_: (table, value) => users.set(value.Usuario_ID, value),
  updateRowById_: (table, key, id, change) => {
    const store = table === 'USUARIOS' ? users : documents;
    store.set(id, {...store.get(id), ...change});
  },
  PropertiesService: {getScriptProperties: () => ({
    getProperty:key => props.get(key), setProperty:(key,value) => props.set(key,value), deleteProperty:key => props.delete(key),
  })},
  CacheService: {getScriptCache: () => ({remove:key => changes.push(key)})},
  SpreadsheetApp: {flush: () => {}},
  SHEETS: {DOCUMENTOS:['Documento_ID']},
  __SGD_HEADERS_MEM: {}, __SGD_ROWS_MEM: {},
  ensureSheet_: () => changes.push('migration'), getDb_: () => ({}),
  clearMasterCaches_: () => {}, invalidateDocumentViews_: () => {},
  addMovement_: (...args) => changes.push(args[3]),
  audit_: (...args) => changes.push(args[1]),
  clientSafeValue222_: value => value,
  parseFlexibleDateMs_: () => 0,
  injectAiBodyIntoDocx240_: (xml, body) => body ? xml + ':' + body : (() => { throw Error('Model'); })(),
  saveDraftSGDBase250_: (token, input) => {
    const session = people.get(token);
    assert.equal(ctx.sgdSupportDraftAccessAllowed_(session), true);
    assert.equal(ctx.sgdSupportDraftAccessAllowed_(people.get('other-support')), false);
    ownedDraftCalls++;
    const existing = documents.get(input.documentId);
    if (existing) assert.equal(Number(input.expectedVersion), existing['Versión']);
    const documentId = existing?.Documento_ID || 'draft-' + ownedDraftCalls;
    const draft = {
      ...existing, Documento_ID:documentId, Oficina_Origen:session.officeCode, Estado:'BORRADOR', Asunto:input.subject,
      Expediente_ID:existing?.Expediente_ID || input.expedienteId || 'own-file', PDF_Final_ID:'internal-only',
      'Versión':(existing?.['Versión'] || 0) + 1,
      ...ctx.sgdSupportDraftAuthor_(existing, session, input),
    };
    assert.equal(input.replyToDocumentId, undefined);
    assert.equal(input.attendsDocumentIds, undefined);
    assert.equal(input.aiDraft, undefined);
    assert.equal(input.expedienteId, existing?.Expediente_ID || (input.delegatedDocumentId === 'assigned-id' ? 'expediente-delegado' : ''));
    documents.set(documentId, draft);
    return ctx.sgdSupportDraftPayload_(draft);
  },
};
vm.runInNewContext(source, ctx);

const name = {username:'Maria.Apoyo', name:'María Flores', officeCode:'A', email:'maria@example.com', password:'Distinct9#Value'};
assert.throws(() => ctx.masterCreateSupportUserSGD('holder', name), /Solo Maestro/);
assert.throws(() => ctx.masterCreateSupportUserSGD('master', {...name, password:ctx.SGD_MASTER.DEFAULT_USER_PASSWORD}), /individual/);
assert.throws(() => ctx.masterCreateSupportUserSGD('master', {...name, name:'=HYPERLINK()'}), /nombre completo/);
const created = ctx.masterCreateSupportUserSGD('master', name);
assert.equal(created.role, 'APOYO');
assert.equal(created.username, 'maria.apoyo');
assert.equal(created.password, undefined);
assert.equal(created.Password_Hash, undefined);
assert.equal(ctx.getUserByOffice_('A').Usuario_ID, 'owner');
assert.equal(ctx.sgdIsOfficeHolder_(users.get(created.userId)), false);
assert.throws(() => ctx.masterCreateSupportUserSGD('master', name), /ya existe/);
assert.equal(ctx.masterSetSupportActiveSGD('master', created.userId, false).active, false);
assert.equal(users.get(created.userId).Activo, 'NO');
assert.ok(changes.includes('sess:browser-session'));
assert.equal(ctx.masterSetSupportActiveSGD('master', created.userId, true).active, true);

const input = {
  subject:'Proyecto de resolución', type:'Resolución', projectBody:'= Encabezado\r\n\r\nPropuesta inicial',
  delegatedDocumentId:'assigned-id', expedienteId:'not-own', manualReferenceDocumentIds:['known-but-not-allowed'],
  attentionSourceDocumentId:'assigned-id', aiDraft:{body:'skip'}, replyToDocumentId:'not-own',
};
assert.throws(() => ctx.saveSupportDraftSGD('holder', input), /cuentas de apoyo/);
assert.throws(() => ctx.saveSupportDraftSGD('support', {...input, delegatedDocumentId:'other'}), /no está delegado/);
assert.throws(() => ctx.saveSupportDraftSGD('support', {...input, projectBody:'x'.repeat(18001)}), /18 000/);
const draft = ctx.saveSupportDraftSGD('support', input).raw;
assert.equal(draft.Proyecto_Texto_Apoyo, '= Encabezado\n\nPropuesta inicial');
assert.equal(draft.Proyecto_Delegado_ID, 'assigned-id');
assert.equal(draft.Expediente_ID, 'expediente-delegado');
assert.equal(draft.Elaborador_Nombre, 'María Flores');
assert.equal(draft.PDF_Final_ID, undefined);
assert.ok(documents.get(draft.Documento_ID).Proyecto_Texto_Apoyo.startsWith('"'));
assert.equal(ctx.sgdSupportDraftAccessAllowed_(people.get('support')), false);
assert.throws(() => ctx.getSupportDraftSGD('other-support', draft.Documento_ID), /No tienes acceso/);
assert.throws(() => ctx.saveSupportDraftSGD('other-support',{...input,documentId:draft.Documento_ID}), /No tienes acceso/);
assert.equal(ctx.listSupportDraftsSGD('other-support').items.length, 0);
assert.equal(ctx.listSupportDraftsSGD('support').items[0].author, 'María Flores');
assert.throws(() => ctx.submitSupportDraftSGD('support', draft.Documento_ID, 2), /otro dispositivo/);
activeAssignment = false;
assert.throws(() => ctx.submitSupportDraftSGD('support', draft.Documento_ID, 1), /delegación cambió/);
activeAssignment = true;
const sent = ctx.submitSupportDraftSGD('support', draft.Documento_ID, 1);
assert.equal(sent.submittedAt, past);
assert.equal(ctx.submitSupportDraftSGD('support', draft.Documento_ID, 1).submittedAt, past);
assert.equal(ctx.getSupportDraftSGD('support', draft.Documento_ID).raw.Estado, 'BORRADOR');
assert.equal(documents.get(draft.Documento_ID)['Versión'], 2);
assert.throws(() => ctx.saveSupportDraftSGD('support',{...input,documentId:draft.Documento_ID,expectedVersion:2}), /bajo revisión/);
const stored = documents.get(draft.Documento_ID);
const author = ctx.sgdSupportDraftAuthor_(stored, people.get('holder'), {});
assert.equal(author.Usuario_Creador, 'maria');
assert.equal(author.Proyecto_Texto_Apoyo, undefined);
assert.equal(ctx.sgdSupportRawForHolder_(stored, stored, people.get('external-holder')).Proyecto_Texto_Apoyo, '');
assert.equal(ctx.sgdSupportRawForHolder_(stored, stored, people.get('holder')).Proyecto_Texto_Apoyo, draft.Proyecto_Texto_Apoyo);
assert.equal(ctx.sgdSupportProjectWordBody_('<xml>', 'Body'), '<xml>:Body');
assert.equal(ctx.sgdSupportProjectWordBody_('<xml>', ''), '<xml>');
assert.equal(changes.filter(action => action === 'PRESENTAR_PROYECTO_APOYO').length, 1);
assert.equal(changes.filter(action => action === 'migration').length, 1);
console.log('PASS: support accounts, role boundary, individual credentials, same-office delegated origin, own drafts, content persistence, and handoff');
