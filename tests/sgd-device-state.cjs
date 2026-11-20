const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'sgd.html'),'utf8'),fix=fs.readFileSync(path.join(root,'sgd-firmas/EstadoClientesR47.js'),'utf8');
assert(html.includes(fix),'The deployed portal must include the tested recovery code');
function source(name){const start=html.search(new RegExp('(?:async )?function '+name+'\\('));assert(start>=0,name);const rest=html.slice(start),end=rest.slice(1).search(/\r?\n(?:async )?function /)+1;return rest.slice(0,end);}
function device(server,options={}){
 const calls=[],screens=[],messages=[],routes=[],rendered=[],nodes={fdPanel:{},fdConsent:{checked:true},fdSignPassword:{value:'test-only-password',focus(){}},fdSignButton:{disabled:false,textContent:'Aplicar firma final'},fd3SignBrand:{value:'TEST'},fd3SignType:{value:'TITULAR'},fdSignProgress:{},fdError:{}};
 const doc={documentId:'DOC-test',current_hash:'original-hash',appointment:'A',cargo:'Cargo',plan:{main:'USR-GSCC',vbs:[]},myTurn:true,complete:false,type:'MEMORANDO'},ui={doc,mode:'main',rect:{x:0,y:0,w:240,h:90},viewport:{convertToPdfPoint:(x,y)=>[x,y]},page:0,busy:false};
 const app={token:'TOKEN-A',session:{userId:'USR-GSCC'},currentDraft:'DOC-test',newState:{}};
 function state(){return{raw:{Documento_ID:'DOC-test',Estado:server.emitted?'EMITIDO':'LISTO_PARA_EMITIR',Fecha_Emisión:server.emitted?'19/11/2026 23:08:19':''},signatureCircuit:{prepared:true,complete:!!server.complete,next:server.complete?'':'USR-GSCC'},annexSigning:[]};}
 function outcome(){return{ok:true,documentId:'DOC-test',complete:true,hash:'signed-hash',signatureCircuit:{prepared:true,complete:true,next:''},annexSigning:[]};}
 const c=vm.createContext({app,fdUI:ui,console,setTimeout,clearTimeout,$:id=>nodes[id],document:{getElementById:id=>nodes[id]},confirm:()=>true,fdContinueEmission:()=>{},resetLoginState:()=>{app.token='';app.currentDraft=null;},renderDraftFromResult224:r=>rendered.push(r),normalizedTypeUI233_:v=>v||'',fd3Entropy:()=> 'test-entropy',fdOperationId_:(()=>{let n=0;return()=> 'OP-'+(++n);})(),fdSigningScreen_:(...a)=>screens.push(a),fdSigningStep_:()=>{},fdSigningDone_:(...a)=>screens.push(['DONE',...a]),fdSigningClose_:()=>{},fdClose:()=>{},closeModal:()=>{},toast:m=>messages.push(m),go:p=>routes.push(p),refreshCountsQuiet224:()=>{},applyCountHint224:()=>{},loading:()=>{},err:e=>messages.push(e.message),fdTransientNetworkError_:e=>/network|conexi[oó]n|sigue proces|recibo venci/i.test(e.message||''),fdWait_:()=>Promise.resolve(),fd46StampVisibility_:()=>{nodes.fdSignButton.disabled=!ui.doc?.myTurn;},fdShow:async v=>{ui.doc=v;},fdOpenAnnex:async()=>calls.push({name:'OPEN_ANNEX'})});
 c.fd3ApiBase=async(name,...args)=>{
   calls.push({name,args});
   if(options.handler){const handled=options.handler(name,args,{server,state,outcome,ui,app});if(handled!==undefined)return handled;}
   if(name==='getDraftStateSGD')return state();
   if(name==='fdViewSGD')return server.emitted?{state:'EMITIDO',emittedAt:'19/11/2026 23:08:19'}:server.unprepared?null:{...doc,complete:!!server.complete,myTurn:!server.complete,base64:'test-pdf'};
   if(name==='fdSignSGD'){
    if(server.emitted)return{...outcome(),alreadyEmitted:true,rawState:{Fecha_Emisión:'19/11/2026 23:08:19'}};
    if(!server.complete){server.submissions=(server.submissions||0)+1;server.complete=true;}
    return outcome();
   }
   if(name==='fdSignRecoverySGD')return server.complete?{found:true,...outcome()}:{found:false};
   if(name==='sendDocumentSGD'){
    if(!server.complete)throw Error('Falta completar y sincronizar la firma principal');
    const alreadyEmitted=!!server.emitted;server.emitted=true;return{ok:true,alreadyEmitted};
   }
   throw Error('Unexpected API: '+name);
 };
 c.api=c.fd3ApiBase;
 vm.runInContext(source('fdRun'),c);vm.runInContext(source('fdSignUI'),c);vm.runInContext(fix,c);
 return{c,app,ui,nodes,calls,screens,messages,routes,rendered,state};
}
(async()=>{
 // Two devices looking at the same unsigned document must preserve the first committed signature.
 const server={},a=device(server),b=device(server);await a.c.fdSignUI();await b.c.fdSignUI();assert.equal(server.submissions,1);assert(server.complete);assert.equal(a.ui.doc.myTurn,false);assert.equal(b.ui.doc.myTurn,false);assert.equal(b.nodes.fdSignButton.disabled,true);assert(b.screens.some(x=>x[0]==='DONE'));
 // An emitted document remains emitted, with its original emission date.
 assert.deepEqual(a.calls.map(x=>x.name),['fdSignSGD']);
 assert.deepEqual(b.calls.map(x=>x.name),['fdSignSGD']);
 assert.equal(a.nodes.fdSignPassword.value,'');
 const emitted=device({complete:true,emitted:true});await emitted.c.fdSignUI();assert.deepEqual(emitted.calls.map(x=>x.name),['fdSignSGD']);assert(emitted.screens.some(x=>x[0]==='Documento ya emitido'&&x[1].includes('19/11/2026 23:08:19')));assert.equal(emitted.app.currentDraft,null);
 const needsPassword=device({});needsPassword.nodes.fdSignPassword.value='';await needsPassword.c.fdSignUI();assert.deepEqual(needsPassword.calls,[]);assert.equal(needsPassword.nodes.fdError.textContent,'Ingrese su clave personal de firma.');
 // A lost response after persistence is recovered without submitting a second signature.
 const recovered=device({}, {handler:(name,args,env)=>{if(name==='fdSignSGD'){env.server.complete=true;env.server.submissions=1;return Promise.reject(Error('Network error'));}}});await recovered.c.fdSignUI();assert.equal(recovered.calls.filter(x=>x.name==='fdSignSGD').length,1);assert(recovered.calls.some(x=>x.name==='fdSignRecoverySGD'));assert(recovered.screens.some(x=>x[0]==='DONE'));
 // The server can reconcile a race even when the other device used a different operation ID.
 const race=device({}, {handler:(name,args,env)=>{if(name==='fdSignSGD'){env.server.complete=true;return Promise.reject(Error('El documento ya no admite esta firma'));}}});await race.c.fdSignUI();assert(race.screens.some(x=>x[0]==='DONE'));assert.deepEqual(race.calls.map(x=>x.name),['fdSignSGD','fdSignRecoverySGD']);assert.equal(race.nodes.fdSignButton.disabled,true);
 const foreign=device({}, {handler:name=>name==='fdSignSGD'?Promise.reject(Error('No es su turno de firma')):undefined});await foreign.c.fdSignUI();assert(!foreign.screens.some(x=>x[0]==='DONE'));assert.equal(foreign.nodes.fdError.textContent,'No es su turno de firma');
 // An unknown result is never resubmitted automatically; an explicit retry keeps its operation ID.
 let attempt=0;const retry=device({}, {handler:(name,args,env)=>{if(name==='fdSignSGD'&&attempt++===0)return Promise.reject(Error('Network error'));}});await retry.c.fdSignUI();assert.equal(retry.calls.filter(x=>x.name==='fdSignSGD').length,1);retry.nodes.fdSignPassword.value='test-only-password';await retry.c.fdSignUI();const submits=retry.calls.filter(x=>x.name==='fdSignSGD');assert.equal(submits.length,2);assert.equal(submits[0].args[2].clientOpId,submits[1].args[2].clientOpId);
 // A corrected password is a new attempt, so a cached validation error cannot trap the user.
 let bad=0;const password=device({}, {handler:name=>{if(name==='fdSignSGD'&&bad++===0)return Promise.reject(Error('Clave incorrecta'));}});await password.c.fdSignUI();assert.deepEqual(password.calls.map(x=>x.name),['fdSignSGD']);assert.equal(password.nodes.fdError.textContent,'Clave incorrecta');password.nodes.fdSignPassword.value='corrected-password';await password.c.fdSignUI();const p=password.calls.filter(x=>x.name==='fdSignSGD');assert.notEqual(p[0].args[2].clientOpId,p[1].args[2].clientOpId);
 // A response from a previous account cannot update the current account's view.
 let release;const switched=device({}, {handler:name=>name==='fdSignSGD'?new Promise(r=>{release=r;}):undefined});const pending=switched.c.fdSignUI();while(!release)await new Promise(r=>setImmediate(r));assert.equal(switched.nodes.fdSignButton.textContent,'Firmando…');assert.equal(switched.screens.length,0);await switched.c.fdSignUI();assert.equal(switched.calls.length,1);switched.c.resetLoginState();switched.app.token='TOKEN-B';release({documentId:'DOC-test',complete:true});await pending;assert.equal(switched.ui.doc,null);assert.equal(switched.ui.busy,false);assert(!switched.screens.some(x=>x[0]==='DONE'));
 // The existing unsigned circuit is opened rather than prepared again.
 const existing=device({});assert.equal(await existing.c.fd47OpenExisting_('DOC-test','TOKEN-A'),true);assert.deepEqual(existing.calls.map(x=>x.name),['fdViewSGD']);assert.equal(existing.ui.doc.myTurn,true);
 const unprepared=device({unprepared:true});assert.equal(await unprepared.c.fd47OpenExisting_('DOC-test','TOKEN-A'),false);assert.deepEqual(unprepared.calls.map(x=>x.name),['fdViewSGD']);
 // Updating an unsigned document does not attempt to recover nonexistent signatures.
 const sync=device({});await sync.c.fdSyncUI();assert(!sync.calls.some(x=>x.name==='fdRecoverSGD'));assert.equal(sync.ui.doc.myTurn,true);sync.ui.mode='annex';sync.ui.doc.annexId='ANX';await sync.c.fdSyncUI();assert(sync.calls.some(x=>x.name==='OPEN_ANNEX'));
 // A late emission response is accepted only after the server confirms the emitted state.
 const emission=device({complete:true},{handler:(name,args,env)=>{if(name==='sendDocumentSGD'){env.server.emitted=true;return Promise.reject(Error('Network error'));}}});await emission.c.emitCurrent();assert.deepEqual(emission.routes,['sent']);assert.equal(emission.app.currentDraft,null);assert.equal(emission.calls.filter(x=>x.name==='sendDocumentSGD').length,1);
 const already=device({complete:true,emitted:true});await already.c.emitCurrent();assert.deepEqual(already.calls.map(x=>x.name),['sendDocumentSGD']);assert.deepEqual(already.routes,['sent']);
 const unsigned=device({});await unsigned.c.emitCurrent();assert.deepEqual(unsigned.calls.map(x=>x.name),['sendDocumentSGD']);assert(unsigned.messages.some(m=>m.includes('Falta completar')));
 const continueState=device({complete:true});continueState.ui.postSignState={documentId:'WRONG',complete:false};await continueState.c.fdContinueEmission();assert.equal(continueState.rendered.length,1);assert(continueState.rendered[0].signatureCircuit.complete);
 const stale=device({complete:true,emitted:true});stale.c.renderDraftFromResult224(stale.state());assert.equal(stale.rendered.length,0);assert.equal(stale.ui.doc.state,'EMITIDO');
 await assert.rejects(device({}).c.fd47Bounded_(new Promise(()=>{}),10),/no respondió a tiempo/);
 // Polling keeps the initiating session and has a deadline even if a server call never responds.
 const stalled=device({});let now=0;stalled.c.Date={now:()=>{now+=60000;return now;}};stalled.c.setTimeout=(f,ms)=>setTimeout(f,Math.min(ms,5));stalled.c.fd3ApiBase=()=>new Promise(()=>{});await assert.rejects(stalled.c.fd3PollCall_('JOB','TOKEN-A'),/conexión|procesándose/);
 const session=device({});session.app.token='TOKEN-B';await assert.rejects(session.c.fd3PollCall_('JOB','TOKEN-A'),/sesión cambió/);
 console.log('PASS: two devices, saved signatures, emitted state, lost responses, stable retry IDs, corrected passwords, session isolation, unsigned sync, emission recovery and bounded waiting');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
