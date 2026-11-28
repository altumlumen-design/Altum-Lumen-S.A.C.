/* Firma y emisión entre dispositivos. */
const fd47Operations_=new Map();
const fd47Emissions_=new Set();
function fd47OperationKey_(token,mode,doc,emitAfterSign=false){return JSON.stringify([token,mode,doc.documentId||'',doc.annexId||'',doc.requestId||'',doc.current_hash||'',emitAfterSign]);}
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
function fd47MarkSavedPreview_(){
  const doc=fdUI.doc;
  if(!doc)return;
  doc.previewOutdated=true;
  $('fdPanel')?.querySelectorAll?.('.fdSignAction,.fdSignConfig,.fdPlaceBtn,#fdSignProgress').forEach(el=>el.remove());
  const download=$('fdDownloadPdfBtn'),notice=$('fdNotice');
  if(download)download.disabled=true;
  if(notice)notice.textContent='La previsualización corresponde a la versión anterior a esta firma.';
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
function fd47RecoveredAnnexReceipt_(state,documentId,annexId,requestId){
  const session=app.session;
  if(!session?.userId)return null;
  const annexes=state.annexSigning||[],annex=annexes.find(item=>item.id===annexId),requests=annex?.requests||[];
  const completed=requests.find(item=>item.id===requestId&&item.signed);
  if(!completed)return null;
  const owner=!!session.officeCode&&state.raw?.Oficina_Origen===session.officeCode;
  const owns=item=>item.userId===session.userId||(!item.userId&&owner);
  if(!owns(completed))return null;
  const group=item=>[String(item.office||item.userId||'').trim(),item.action==='VISTO_BUENO'?'VISTO_BUENO':'FIRMA'].join('|');
  const next=requests.find(item=>!item.signed&&group(item)===group(completed));
  const pending=requests.find(item=>!item.signed);
  const describe=item=>({
    documentId,annexId,requestId:item.id,action:item.action||'FIRMA',office:item.office||'',
    userId:item.userId||'',sequence:Number(item.ordinal)||1,totalSequence:Number(item.groupTotal)||1
  });
  const pendingAnnexes=annexes.filter(item=>item.required&&!item.signed).length;
  return{
    ok:true,documentId,completedRequest:{id:completed.id,action:completed.action||'FIRMA'},
    nextRequest:next&&owns(next)?describe(next):null,nextPending:pending?describe(pending):null,
    pendingAnnexes,canContinueEmission:owner&&!!state.signatureCircuit?.complete&&!pendingAnnexes
  };
}
async function fdReliableSignCall_(name,args,recover){
  const doc=fdUI.doc;
  try{return await fd47Bounded_(api(name,...args),190000);}
  catch(error){
    const stale=/ya no admite|no es su turno|ya fue registrado|cambi[oó] el documento|borrador propio|ya no est[aá] pendiente|ya se (?:firm[oó]|complet[oó])|ya est[aá] firmad/i.test(error?.message||'');
    if(!stale&&!fdTransientNetworkError_(error))throw error;
    fd47Session_(args[0]);
    if(fdUI.doc===doc)fd47SignProgress_('Confirmando si la firma quedó guardada…');
    if(typeof recover==='function'){
      try{const saved=await fd47Bounded_(recover(),15000);fd47Session_(args[0]);if(saved?.found)return saved;}catch(_){}
    }
    fd47Session_(args[0]);
    if(name==='fd31SignAnnexSGD'){
      try{
        const state=await fd47Status_(args[1],args[0]),receipt=fd47RecoveredAnnexReceipt_(state,args[1],args[2],args[3]?.requestId);
        if(receipt)return receipt;
      }catch(_){}
    }
    throw error;
  }
}
function fdSyncUI(){
  if(!fdUI.doc)return;
  if(fdUI.signing?.documentId===fdUI.doc.documentId){
    fd47SignProgress_(fdUI.signingAndEmitting===fdUI.signing?'El SGD está registrando la firma y el envío.':'El SGD está guardando la firma. Puedes seguir revisando el PDF.');
    return;
  }
  if(fdUI.mode==='annex')return fdOpenAnnex(fdUI.doc.documentId,fdUI.doc.annexId,fdUI.doc.requestId||'');
  return fdRun(async()=>{
    const id=fdUI.doc?.documentId,token=app.token;if(!id)return;
    const view=await fd47Bounded_(api('fdViewSGD',token,id,false,true));fd47Session_(token);
    if(view?.state==='EMITIDO'){fd47Emitted_(id,{raw:{Fecha_Emisión:view.emittedAt}});return;}
    if(!view)throw Error('El circuito se retiró. Vuelva a abrir la ficha del documento.');
    await fdShow(view);
  });
}
function fd47EmissionReady_(state,id){
  if(!state||(state.documentId||state.raw?.Documento_ID)!==id)return false;
  if(typeof state.canContinueEmission==='boolean')return state.canContinueEmission;
  return !!state.signatureCircuit?.complete&&Array.isArray(state.annexSigning)&&state.annexSigning.every(x=>!x.required||x.signed);
}
function fd47CanSignAndEmit_(doc,mode){
  const actor=app.session?.userId,type=normalizedTypeUI233_(doc?.type||'');
  return mode==='main'&&!!actor&&!!type&&type!=='PROVEIDO'&&doc?.canSignAndEmit===true&&doc.myTurn===true&&!doc.complete&&
    !doc.annexId&&doc.plan?.main===actor&&!['EMITIDO','ANULADO','DESCARTADO','HISTÓRICO'].includes(doc.state);
}
function fd47ShowEmission_(id,title,otherActions='',emissionError=''){
  const detail=emissionError?'La firma quedó guardada. '+emissionError:'La firma está guardada. Confirma el envío de '+(title||'este documento')+'.';
  fdSigningScreen_(emissionError?'Emisión pendiente':'Listo para emitir',detail,emissionError?'error':'done',
    '<button class="btn btn-green" type="button" data-document-id="'+esc(id)+'" onclick="emitCurrent(this,this.dataset.documentId)">'+(emissionError?'Reintentar emisión':'Emitir documento')+'</button>'+
    otherActions);
}
function fd47PresentReadyEmission_(receipt,otherActions,emissionError=''){
  const doc=fdUI.doc,id=doc?.documentId;
  if(!id||receipt?.alreadyEmitted||['EMITIDO','ANULADO','DESCARTADO','HISTÓRICO'].includes(doc.state)||!fd47EmissionReady_(receipt,id))return false;
  const draftNumber=app.flowDraft?.documentId===id?app.flowDraft.number:'';
  const fallbackActions=fdUI.mode==='annex'
    ?'<button class="btn btn-outline" type="button" onclick="fdSigningBackToCenter_()">Ver firmas</button>'
    :'<button class="btn btn-outline" type="button" onclick="fdSigningViewSigned_()">Ver documento firmado</button>';
  fd47ShowEmission_(id,receipt.documentNumber||draftNumber||(fdUI.mode==='main'?doc.title:''),otherActions??fallbackActions,emissionError);
  return true;
}
function fd47ReceiveSignAndEmit_(receipt){
  const id=fdUI.doc?.documentId;
  if(!id||receipt?.documentId!==id||receipt.complete!==true)return false;
  if(receipt.emission?.ok===true||receipt.alreadyEmitted===true){
    fdUI.signing=null;fdUI.signingAndEmitting=null;
    fd47FinishEmission_(id,receipt.emission||{alreadyEmitted:true},$('fdPanel'));
    return true;
  }
  if(!receipt.emissionError){
    if(!receipt.found)return false;
    fdSigningScreen_('Confirmación de envío pendiente','La firma quedó guardada. Consulta el estado de la emisión.','done',
      '<button class="btn btn-primary" type="button" onclick="fdSyncUI()">Actualizar estado</button>'+
      '<button class="btn btn-outline" type="button" onclick="fdSigningViewSigned_()">Ver documento firmado</button>');
    return true;
  }
  if(fd47PresentReadyEmission_(receipt,undefined,receipt.emissionError))return true;
  fdSigningScreen_('Emisión pendiente','La firma quedó guardada. '+receipt.emissionError,'error',
    '<button class="btn btn-outline" type="button" onclick="fdSigningViewSigned_()">Ver documento firmado</button>'+
    '<button class="btn btn-outline" type="button" onclick="fdClose();go(\'drafts\')">Ver borradores</button>');
  return true;
}
async function fd47ContinueEmission_(snapshot){
  const doc=fdUI.doc,id=doc?.documentId||app.currentDraft,token=app.token,panel=$('fdPanel');
  if(!id||fdUI.signing?.documentId===id||fdUI.emissionLookup)return;
  const receipt=snapshot?.documentId===id?snapshot:doc;
  if(receipt?.alreadyEmitted||receipt?.state==='EMITIDO'){fd47Emitted_(id,{raw:receipt.rawState||{Fecha_Emisión:receipt.emittedAt}});return;}
  if(fd47PresentReadyEmission_(receipt))return;
  const lookup={};fdUI.emissionLookup=lookup;
  const isCurrent=()=>app.token===token&&$('fdPanel')===panel&&fdUI.doc===doc;
  fdSigningScreen_('Consultando el circuito','Comprobando las firmas requeridas para la emisión.','busy');
  try{
    const state=await fd47Status_(id,token);
    if(!isCurrent())return;
    if(state.raw.Estado==='EMITIDO'){fd47Emitted_(id,state);return;}
    if(fd47EmissionReady_(state,id)){
      fd47ShowEmission_(id,state.raw['Número']||doc?.title);
      return;
    }
    fdSigningClose_();fdClose();app.currentDraft=id;renderDraftFromResult224(state);
    toast('El circuito sigue pendiente. Se muestra el estado actual.');
  }catch(e){
    if(isCurrent()){
      if(e.message?.includes('SESSION_EXPIRED')){fdClose();err(e);return;}
      fdSigningScreen_('Consulta pendiente',e.message||String(e),'error',
        '<button class="btn btn-outline" type="button" onclick="fdSigningToEmission_()">Volver a consultar</button>');
    }
  }finally{if(fdUI.emissionLookup===lookup)fdUI.emissionLookup=null;}
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
  fd47PriorReset_(message);
  fd47Operations_.clear();fd47Emissions_.clear();fdUI.busy=false;fdUI.signing=null;fdUI.signingAndEmitting=null;
  fdClose();
  fdUI.postAnnexNext=null;
};
function fd47FinishEmission_(id,receipt,panel){
  if(receipt?.countsHint)applyCountHint224(receipt.countsHint);
  fdSigningClose_();if(panel)fdClose();closeModal();
  toast(receipt?.alreadyEmitted?'La emisión ya estaba guardada.':'Documento emitido.');
  if(app.currentDraft===id)app.currentDraft=null;
  go('sent');refreshCountsQuiet224();
}
async function emitCurrent(button,id=app.currentDraft){
  const token=app.token,key=JSON.stringify([token,id]);
  if(!id||fd47Emissions_.has(key)||!confirm('¿Emitir este documento?'))return;
  const panel=button?.closest('#fdPanel'),detail=panel?$('fdSigningDetail'):$('sgdEmissionStatus');
  const label=button?.textContent;
  const isCurrent=()=>app.token===token&&(panel?$('fdPanel')===panel:app.currentDraft===id&&(!button||button.isConnected));
  fd47Emissions_.add(key);
  if(button){button.disabled=true;button.textContent='Emitiendo…';}
  if(detail)detail.textContent='Registrando el envío…';
  let receipt;
  try{
    const doc=fdUI.doc;
    const expectedHash=panel&&fdUI.mode==='main'&&doc?.documentId===id&&doc.complete?doc.current_hash:'';
    try{receipt=await fd47Bounded_(expectedHash?api('sendDocumentSGD',token,id,expectedHash):api('sendDocumentSGD',token,id),90000);}
    catch(error){
      if(!fdTransientNetworkError_(error))throw error;
      if(isCurrent()&&detail)detail.textContent='Verificando si se registró el envío…';
      const after=await fd47Status_(id,token).catch(()=>null);
      if(after?.raw?.Estado!=='EMITIDO')throw error;
      receipt={ok:true,alreadyEmitted:true};
    }
    fd47Session_(token);
    if(!isCurrent()){refreshCountsQuiet224();return;}
    fd47FinishEmission_(id,receipt,panel);
  }catch(e){
    if(isCurrent()){
      if(detail)detail.textContent=e.message||String(e);
      err(e);
    }
  }finally{
    fd47Emissions_.delete(key);
    if(isCurrent()&&button){button.disabled=false;button.textContent=label;}
  }
}
