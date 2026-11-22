const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sgd.html'), 'utf8');
const server = file => fs.readFileSync(path.join(root, 'sgd-apps-script', file), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

function testServer() {
  let revision = 0;
  let locked = false;
  const properties = new Map();
  const context = {
    auth_: token => {
      if (token === 'expired') throw new Error('SESSION_EXPIRED');
      return {userId: token.split(':')[0], officeCode: token.split(':')[1], role: 'USUARIO'};
    },
    clean_: value => String(value ?? '').trim(),
    norm_: value => String(value ?? '').trim().toUpperCase(),
    listOffices_: () => [
      {Código: 'SG', Activa: 'SI'}, {Código: 'DA', Activa: 'SI'}, {Código: 'OLD', Activa: 'NO'},
    ],
    PropertiesService: {getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperty: (key, value) => properties.set(key, value),
      deleteProperty: key => properties.delete(key),
    })},
    LockService: {getScriptLock: () => ({
      tryLock() { if (locked) return false; locked = true; return true; },
      releaseLock() { locked = false; },
    })},
    Utilities: {newBlob: value => ({getBytes: () => Buffer.from(value)}), getUuid: () => 'id-' + ++revision},
  };
  vm.runInNewContext(server('GruposDestino.gs') + server('FiltrosBandeja.gs'), context);
  const {getDestinationGroupsSGD: read, saveDestinationGroupSGD: save, deleteDestinationGroupSGD: remove} = context;
  const [first] = save('user:SG:deviceA', {name: 'Académico', offices: ['DA', 'DA']});
  assert.equal(first.offices.join(), 'DA');
  assert.equal(read('user:SG:deviceB')[0].id, first.id);
  assert.equal(read('user:DA:deviceB').length, 0);
  assert.equal(read('other:SG:deviceB').length, 0);
  assert.throws(() => read('expired'), /SESSION_EXPIRED/);
  assert.throws(() => save('user:SG:deviceA', {name: 'Otro', offices: ['OLD']}), /activas/);
  assert.throws(() => save('user:SG:deviceA', {name: 'Otro', offices: ['SG']}), /distintas/);
  const [changed] = save('user:SG:deviceB', {...first, name: 'Académico actualizado'});
  assert.throws(() => save('user:SG:deviceA', first), /otro dispositivo/);
  assert.throws(() => remove('user:SG:deviceA', changed.id, first.revision), /otro dispositivo/);
  assert.equal(remove('user:SG:deviceB', changed.id, changed.revision).length, 0);
  assert.equal(properties.size, 0);
  assert.equal(locked, false);

  const rows = [{priority: 'MUY_URGENTE', origin: 'DA'}, {priority: 'URGENTE', origin: 'SG'}, {origin: 'DA'}];
  assert.deepEqual(Array.from(context.sgdFilterBandeja_(rows, 'MUY URGENTE', 'DA')), [rows[0]]);
  assert.deepEqual(Array.from(context.sgdFilterBandeja_(rows, 'NORMAL', 'DA')), [rows[2]]);
}

async function testBandeja() {
  const fields = new Map();
  const body = {
    dataset: {box: 'RECIBIDOS'}, innerHTML: '', querySelector: () => null,
    setAttribute() {}, removeAttribute() {},
  };
  const notice = {textContent: ''};
  fields.set('boxBody', body);
  fields.set('boxStatusLine', notice);
  fields.set('boxPriority', {value: 'NORMAL'});
  const calls = [];
  const app = {token: 'session', boxItems: {}};
  const context = {
    app, $: id => fields.get(id), esc: String,
    docTable: rows => rows.map(row => row.documentId).join(),
    api: (...params) => new Promise(resolve => calls.push({params, resolve})),
  };
  vm.runInNewContext(section('const boxLoads_=', 'function clearBoxFilters'), context);
  const load = context.loadBox;
  const older = load('RECIBIDOS');
  await load('RECIBIDOS');
  assert.equal(calls.length, 1);
  fields.get('boxPriority').value = 'URGENTE';
  const latest = load('RECIBIDOS');
  assert.equal(calls[1].params[3].priority, 'URGENTE');
  calls[1].resolve({items: [{documentId: 'a'}], hasMore: true});
  await latest;
  calls[0].resolve({items: [{documentId: 'old'}]});
  await older;
  assert.match(body.innerHTML, /^a/);
  const more = load('RECIBIDOS', true);
  assert.equal(calls[2].params[3].offset, 1);
  calls[2].resolve({items: [{documentId: 'a'}, {documentId: 'b'}], hasMore: true});
  await more;
  assert.match(body.innerHTML, /^a,b/);
  const last = load('RECIBIDOS', true);
  assert.equal(calls[3].params[3].offset, 3);
  app.token = 'other-session';
  calls[3].resolve({items: [{documentId: 'should-not-appear'}]});
  await last;
  assert.doesNotMatch(body.innerHTML, /should-not-appear/);
}

(async () => {
  testServer();
  await testBandeja();
  console.log('PASS: priority and office filters, stale queries, pagination, session isolation and destination groups across devices');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
