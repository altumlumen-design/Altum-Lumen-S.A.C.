const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../sgd.html'), 'utf8');
function source(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, start);
  return html.slice(from, to);
}
const functions = [
  source('let dashboardRefresh_;', 'function refreshCountsQuiet224()'),
  source('const signatureInboxLoads_=', 'function fdOpenResolutionVbTask38_('),
  source('function fdApplyAnnexActionLocal42_(', 'function fdOpenNextAnnex42_('),
  source('function fdSigningFinishExternal_(', 'function fdSigningDone_('),
  source('function fd47RecoveredAnnexReceipt_(', 'async function fdReliableSignCall_('),
].join('\n');
const task = (requestId, options = {}) => ({
  kind: 'ANNEX', documentId: 'doc-1', annexId: 'annex-1', requestId,
  requestedAction: 'VISTO_BUENO', title: 'Anexo de prueba', ...options,
});
function environment(initialCount) {
  const app = {token: 'a', page: 'annex-signatures', session: {userId: 'worker', officeCode: 'mine'}, bootstrap: {counts: {annexSignaturePending: initialCount, signaturePending: initialCount + 1, resolutionVbPending: 1}}};
  const calls = [], painted = [];
  const body = {className: '', innerHTML: '', insertAdjacentHTML(_, element) { this.innerHTML = element + this.innerHTML; }};
  const fdUI = {doc: null};
  const context = vm.createContext({
    app, fdUI, document: {}, pageHead: () => '',
    $: key => ({main: {}, signatureInboxBody: body})[key],
    esc: String, signatureInboxRowsHtml38_: rows => rows.map(row => row.requestId).join(',') || 'Sin pendientes',
    setCounts(counts) { painted.push({...counts}); },
    api(method, token) { return new Promise((resolve, reject) => calls.push({method, token, resolve, reject})); },
    err(error) { throw error; },
    fdSigningClose_() {}, fdClose() {}, go(page) { app.page = page; },
  });
  vm.runInContext(functions, context);
  return {context, app, fdUI, calls, painted, body};
}

(async () => {
  const e = environment(1);
  const first = task('req-1');
  const location = e.context.fdAnnexInboxState42_();
  location.rows = [first];
  const dashboard = e.context.refreshBootstrap();
  const staleInbox = e.context.renderSignatureWorkInbox('ANNEX');
  const updatedInbox = e.context.fdApplyAnnexActionLocal42_({completedRequest: {id: first.requestId, action: 'VISTO_BUENO'}}, first);
  assert.equal(e.app.bootstrap.counts.annexSignaturePending, 0);
  assert.equal(e.app.bootstrap.counts.signaturePending, 1);
  assert.match(e.body.innerHTML, /V°B° registrado.*Sin pendientes/);
  assert.equal(e.calls.length, 3);

  e.calls[0].resolve({counts: {annexSignaturePending: 1, signaturePending: 2, resolutionVbPending: 1}});
  e.calls[1].resolve([first]);
  await Promise.all([dashboard, staleInbox]);
  assert.equal(e.app.bootstrap.counts.annexSignaturePending, 0);
  assert.doesNotMatch(e.body.innerHTML, /req-1/);
  assert.equal(e.app.bootstrap.counts.resolutionVbPending, 1);

  const returnToInbox = e.context.renderSignatureWorkInbox('ANNEX');
  assert.equal(e.calls.length, 3, 'volver a bandeja comparte la conciliación ya solicitada');
  e.calls[2].resolve([]);
  await Promise.all([updatedInbox, returnToInbox]);
  assert.equal(e.app.bootstrap.counts.annexSignaturePending, 0);
  await e.context.fdApplyAnnexActionLocal42_({completedRequest: {id: first.requestId}}, first);
  assert.equal(e.calls.length, 3, 'un recibo repetido no vuelve a modificar la bandeja');

  const n = environment(3);
  const next = {documentId: 'doc-1', annexId: 'annex-1', requestId: 'req-2', action: 'VISTO_BUENO', sequence: 2, totalSequence: 2};
  const otherGroup = task('firm-1', {requestedAction: 'FIRMA'});
  const sameRequestOnAnotherDocument = task('req-1', {documentId: 'doc-2'});
  const nState = n.context.fdAnnexInboxState42_();
  nState.rows = [first, otherGroup, sameRequestOnAnotherDocument];
  assert.equal(n.fdUI.doc, null, 'el recibo también funciona con el visor cerrado');
  const nextRead = n.context.fdApplyAnnexActionLocal42_({completedRequest: {id: first.requestId}, nextRequest: next}, first);
  assert.equal(n.app.bootstrap.counts.annexSignaturePending, 3);
  assert.equal(nState.rows.map(row => row.requestId).join(','), 'req-2,firm-1,req-1');
  assert.equal(nState.rows[0].id, 'annex-1|req-2');
  assert.equal(nState.rows[0].sequence, 2);
  assert.equal(nState.rows[0].totalSequence, 2);
  n.calls[0].resolve([task('req-2'), otherGroup, sameRequestOnAnotherDocument]);
  await nextRead;
  await n.context.fdApplyAnnexActionLocal42_({completedRequest: {id: 'unrelated'}}, first);
  assert.equal(n.calls.length, 1, 'un recibo de otra actuación no debe modificar la actual');

  const s = environment(1);
  s.app.page = 'drafts';
  const readBeforeLogout = s.context.fdReadAnnexInbox42_(s.context.fdAnnexInboxState42_());
  s.app.token = 'b';
  s.app.bootstrap.counts.annexSignaturePending = 5;
  s.calls[0].resolve([task('private-a')]);
  assert.equal(await readBeforeLogout, null);
  assert.equal(s.app.bootstrap.counts.annexSignaturePending, 5);
  assert.equal(s.context.fdAnnexInboxState42_().rows, null);

  const c = environment(2);
  c.app.page = 'drafts';
  const confirmation = c.context.fdApplyAnnexActionLocal42_({completedRequest: {id: first.requestId}, nextPending: {requestId: 'office-2', userId: 'another-user'}}, first);
  assert.equal(c.app.bootstrap.counts.annexSignaturePending, 1);
  c.calls[0].resolve([otherGroup]);
  await confirmation;
  assert.equal(c.context.fdAnnexInboxState42_().rows.map(row => row.requestId).join(','), otherGroup.requestId);

  const r = environment(4);
  const direct = r.context.renderSignatureWorkInbox('ANNEX');
  r.calls[0].resolve([]);
  await direct;
  assert.match(r.body.innerHTML, /Sin pendientes/);
  assert.equal(r.app.bootstrap.counts.annexSignaturePending, 0);

  const reactivated = e.context.renderSignatureWorkInbox('ANNEX');
  e.calls[3].resolve([first]);
  await reactivated;
  assert.equal(e.app.bootstrap.counts.annexSignaturePending, 1, 'una actuación reactivada por el servidor vuelve a aparecer');
  const completeAgain = e.context.fdApplyAnnexActionLocal42_({completedRequest: {id: first.requestId}}, first);
  assert.equal(e.app.bootstrap.counts.annexSignaturePending, 0);
  e.calls[4].reject(Error('temporary network issue'));
  await completeAgain;
  assert.match(e.body.innerHTML, /No se pudieron actualizar.*Sin pendientes/);

  const requests = [
    {id: 'req-1', userId: 'worker', office: 'mine', action: 'VISTO_BUENO', signed: true},
    {id: 'firm-1', userId: 'worker', office: 'mine', action: 'FIRMA'},
    {id: 'req-2', userId: 'worker', office: 'mine', action: 'VISTO_BUENO', ordinal: 2, groupTotal: 2},
  ];
  const recoveredState = {raw: {Oficina_Origen: 'origin'}, signatureCircuit: {complete: false}, annexSigning: [{id: 'annex-1', required: true, signed: false, requests}]};
  const recovery = () => r.context.fd47RecoveredAnnexReceipt_(recoveredState, 'doc-1', 'annex-1', 'req-1');
  const receipt = recovery();
  assert.equal(receipt.nextRequest.requestId, 'req-2');
  assert.equal(receipt.nextRequest.sequence, 2);
  assert.equal(receipt.nextPending.requestId, 'firm-1');
  requests[2].userId = 'different-worker';
  assert.equal(recovery().nextRequest, null);
  requests[0].userId = 'different-worker';
  assert.equal(recovery(), null);
  console.log('PASS annex inbox: immediate badge, active successors, stale responses, duplicate receipts, session changes, and empty-list reconciliation');
})().catch(error => { console.error(error); process.exitCode = 1; });
