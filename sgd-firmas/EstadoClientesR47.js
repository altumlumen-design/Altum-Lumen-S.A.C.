/* Firma y emisión entre dispositivos. */
const fd47Operations_=new Map();
function fd47OperationKey_(token,mode,doc){return JSON.stringify([token,mode,doc.documentId||'',doc.annexId||'',doc.requestId||'',doc.current_hash||'']);}
function fd47OperationId_(key,mode){
  if(!fd47Operations_.has(key))fd47Operations_.set(key,fdOperationId_(mode==='annex'?'ANX':'DOC'));
  return fd47Operations_.get(key);
}
function fd47Session_(token){if(app.token!==token)throw Error('La sesión cambió. Abra el documento desde la cuenta actual.');}
async function fd47Bounded_(promise,ms=30000){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La conexión con el SGD no respondió a tiempo. Compruebe el estado guardado antes de reintentar.')),ms);})]);}
  finally{clearTimeout(timer);}
}
async function fd47Status_(id,token){
  const state=await fd47Bounded_(api('getDraftStateSGD',token,id));fd47Session_(token);
  if(!state?.raw||state.raw.Documento_ID!==id)throw Error('No se pudo confirmar el documento solicitado.');
  return state;
}
function fd47Emitted_(id,state){
  if(fdUI.doc?.documentId===id){fdUI.doc.complete=true;fdUI.doc.myTurn=false;fdUI.doc.state='EMITIDO';}
  if(app.currentDraft===id)app.currentDraft=null;
  const date=state?.raw?.Fecha_Emisión||'';
  if(!$('fdPanel')){closeModal();toast('Este documento ya fue emitido'+(date?' el '+date:'')+'.');go('sent');return;}
  fdSigningScreen_('Documento ya emitido','La emisión ya está guardada'+(date?' desde '+date:'')+'. No necesita volver a firmar ni emitir.','done','<button class="btn btn-primary" type="button" onclick="fdSigningClose_();fdClose();go(\'sent\')">Ver emitidos</button>');
  const button=$('fdSignButton');if(button)button.disabled=true;
}
function fd47ApplySigned_(outcome){
  const doc=fdUI.doc;if(!doc||outcome?.documentId!==doc.documentId)return;
  doc.complete=!!outcome.complete;doc.myTurn=false;if(outcome.hash)doc.current_hash=outcome.hash;
  fdUI.postSignState=outcome;fdUI.postSignView=null;
  const button=$('fdSignButton');if(button)button.disabled=true;
}
function fd47SignProgress_(message){
  const status=$('fdSignProgress');
  if(status)status.textContent=message;
}
async function fd47OpenExisting_(id,token){
  const view=await fd47Bounded_(api('fdViewSGD',token,id,false,true));fd47Session_(token);
  if(!view)return false;
  if(view.state==='EMITIDO'){fd47Emitted_(id,{raw:{Fecha_Emisión:view.emittedAt}});return true;}
  await fdShow(view);closeModal();return true;
}
async function fd3PollCall_(jobId,token=app.token){
  let delay=650,lastTransient=null;const deadline=Date.now()+180000;
  while(Date.now()<deadline){
    fd47Session_(token);
    try{const status=await fd47Bounded_(fd3ApiBase('fd3JobResultSGD',token,jobId),Math.min(30000,deadline-Date.now()));fd47Session_(token);if(status.done)return status.result;lastTransient=null;}
    catch(e){if(!fdTransientNetworkError_(e))throw e;lastTransient=e;}
    await fdWait_(Math.min(delay,Math.max(0,deadline-Date.now())));delay=Math.min(4200,Math.round(delay*1.35));
  }
  throw lastTransient||Error('La operación sigue procesándose. Compruebe el estado guardado antes de reintentar.');
}
api=async function(name,...args){
  const token=args[0],result=await fd3ApiBase(name,...args);
  if(!result?.fd3Job)return result;
  return fd3PollCall_(result.fd3Job,token);
};
async function fdReliableSignCall_(name,args,recover){
  try{return await fd47Bounded_(api(name,...args),190000);}
  catch(error){
    const stale=/ya no admite|no es su turno|ya fue registrado|cambi[oó] el documento|borrador propio|ya no est[aá] pendiente|ya se (?:firm[oó]|complet[oó])|ya est[aá] firmad/i.test(error?.message||'');
    if(!stale&&!fdTransientNetworkError_(error))throw error;
    fd47Session_(args[0]);fd47SignProgress_('Confirmando si la firma quedó guardada…');
    if(typeof recover==='function'){
      try{const saved=await fd47Bounded_(recover(),15000);fd47Session_(args[0]);if(saved?.found)return saved;}catch(_){}
    }
    fd47Session_(args[0]);
    if(name==='fd31SignAnnexSGD'){
      try{
        const state=await fd47Status_(args[1],args[0]),c=state.signatureCircuit||{};
        const annex=(state.annexSigning||[]).find(x=>x.id===args[2]),request=(annex?.requests||[]).find(x=>x.id===args[3]?.requestId);
        if(request?.signed)return{ok:true,documentId:args[1],completedRequest:{id:request.id,action:request.action||'FIRMA'},pendingAnnexes:(state.annexSigning||[]).filter(x=>x.required&&!x.signed).length,canContinueEmission:!!c.complete&&(state.annexSigning||[]).every(x=>!x.required||x.signed)};
      }catch(_){}
    }
    throw error;
  }
}
function fdSyncUI(){
  if(fdUI.mode==='annex')return fdOpenAnnex(fdUI.doc.documentId,fdUI.doc.annexId,fdUI.doc.requestId||'');
  return fdRun(async()=>{
    const id=fdUI.doc?.documentId,token=app.token;if(!id)return;
    const view=await fd47Bounded_(api('fdViewSGD',token,id,false,true));fd47Session_(token);
    if(view?.state==='EMITIDO'){fd47Emitted_(id,{raw:{Fecha_Emisión:view.emittedAt}});return;}
    if(!view)throw Error('El circuito se retiró. Vuelva a abrir la ficha del documento.');
    await fdShow(view);
  });
}
function fd47ContinueEmission_(snapshot){
  const id=fdUI.doc?.documentId||app.currentDraft,token=app.token;if(!id)return;
  if(snapshot?.documentId===id&&snapshot.signatureCircuit?.complete&&app.flowDraft?.documentId===id)return fd47PriorContinue_(snapshot);
  return(async()=>{
    try{
      fd47SignProgress_('Cargando opciones de emisión…');
      const state=await fd47Status_(id,token);
      if(state.raw.Estado==='EMITIDO'){fd47Emitted_(id,state);return;}
      fdSigningClose_();fdClose();app.currentDraft=id;renderDraftFromResult224(state);
      if(state.signatureCircuit?.complete)toast('Firma guardada. Falta confirmar la emisión.');
      else toast('El circuito sigue pendiente. Se muestra el estado actual.');
    }catch(e){if(app.token===token)err(e);}finally{if(app.token===token)fd47SignProgress_('');}
  })();
}
const fd47PriorContinue_=fdContinueEmission;
fdContinueEmission=function(snapshot){
  if(normalizedTypeUI233_(fdUI.doc?.type||'')==='PROVEIDO')return fd47PriorContinue_(snapshot);
  return fd47ContinueEmission_(snapshot||fdUI.postSignState);
};
const fd47RenderDraft_=renderDraftFromResult224;
renderDraftFromResult224=function(result){
  if(result?.raw?.Estado==='EMITIDO'){fd47Emitted_(result.raw.Documento_ID,result);return;}
  return fd47RenderDraft_(result);
};
const fd47PriorReset_=resetLoginState;
resetLoginState=function(message){
  fdSigningClose_();fd47Operations_.clear();fdUI.busy=false;fdUI.doc=null;
  fdUI.postSignState=null;fdUI.postSignView=null;fdUI.postAnnexNext=null;
  return fd47PriorReset_(message);
};
async function emitCurrent(){
  const id=app.currentDraft,token=app.token;if(!id||!confirm('¿Emitir este documento?'))return;
  let receipt;
  try{
    loading(true,'Emitiendo documento…','Registrando el envío');
    try{receipt=await fd47Bounded_(api('sendDocumentSGD',token,id),90000);}
    catch(error){
      if(!fdTransientNetworkError_(error))throw error;
      const after=await fd47Status_(id,token).catch(()=>null);
      if(after?.raw?.Estado!=='EMITIDO')throw error;
      receipt={ok:true,alreadyEmitted:true};
    }
    fd47Session_(token);
    if(app.currentDraft!==id)return;
    if(receipt?.countsHint)applyCountHint224(receipt.countsHint);
    closeModal();toast(receipt?.alreadyEmitted?'La emisión ya estaba guardada.':'Documento emitido.');app.currentDraft=null;go('sent');refreshCountsQuiet224();
  }catch(e){if(app.token===token)err(e);}finally{if(app.token===token)loading(false);}
}
