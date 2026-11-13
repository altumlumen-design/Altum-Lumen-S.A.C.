'use strict';
const endpoint='https://script.google.com/macros/s/AKfycbxmkUxD9CrJQ4WkEPQnCFfu9x32HiJZOAZMKSkEcs9S9lFB3xSdRE8AzSJhbGC3mhVl/exec';
const limit=20*1024*1024;
const page=document.body.dataset.page;
const app=document.querySelector('#app');
const field=(name,label,attributes='required')=>`<label>${label}<input name="${name}" ${attributes}></label>`;
const select=(name,label,options)=>`<label>${label}<select name="${name}" required>${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></label>`;
const captcha=`<div class="captcha"><label><span id="question">Comprobación de seguridad</span><input name="answer" inputmode="numeric" pattern="[0-9]{1,2}" required autocomplete="off"></label><button type="button" id="refresh" class="secondary">Actualizar comprobación</button></div>`;
const message='<p id="message" role="status" aria-live="polite"></p>';
const docs=['Carta','Solicitud','Oficio','Informe','Escrito','Otro'];
const person=`<fieldset><legend>Datos de la persona que presenta</legend><div class="grid">
${select('person','¿Quién presenta el trámite?',[['','Selecciona una opción'],['natural','Persona natural'],['juridica','Persona jurídica (empresa u organización)']])}
${field('name','<span id="name-label">Nombres y apellidos</span>','maxlength="160" required autocomplete="name"')}
<div class="wide grid" id="company" hidden>${field('company','Razón social','maxlength="180" autocomplete="organization"')}${field('ruc','RUC','inputmode="numeric" pattern="[0-9]{11}" maxlength="11"')}</div>
${select('idType','Documento de identidad',[['DNI','DNI'],['CE','Carné de extranjería'],['Pasaporte','Pasaporte']])}
${field('idNumber','Número de identificación','maxlength="20" required')}
${field('address','Dirección','maxlength="240" required autocomplete="street-address"')}
${field('phone','Teléfono','type="tel" maxlength="30" required autocomplete="tel"')}
</div></fieldset>
<fieldset><legend>Correo para la respuesta</legend><div class="grid">
${field('email',page==='mesa'?'Correo electrónico (opcional)':'Correo electrónico','type="email" maxlength="180" '+(page==='libro'?'required ':'')+'autocomplete="email" autocapitalize="none" spellcheck="false" aria-describedby="email-use"')}
${field('alternate','Otro correo (opcional)','type="email" maxlength="180" autocapitalize="none" spellcheck="false"')}
</div><p class="support" id="email-use">Si indicas un correo, lo usaremos para comunicaciones y para responder tu trámite.</p></fieldset>`;
const intake=`<fieldset><legend>Documento</legend><div class="grid">
${select('docType','Tipo de documento',docs.map(v=>[v,v]))}
${field('number','Número del documento (si corresponde)','maxlength="80"')}
<div id="other" hidden>${field('other','Especifica el tipo de documento','maxlength="80"')}</div>
${field('addressee','Persona u oficina a quien diriges el documento (opcional)','maxlength="120" aria-describedby="intake-office"')}
</div><p class="notice" id="intake-office">La Oficina de Trámite Documentario y Atención al Cliente recibe todos los documentos y los deriva a quien corresponda.</p></fieldset>`;
const claims=`<fieldset><legend>Motivo del registro</legend><div class="grid">
${select('claimType','Tipo de registro',[['Reclamo','Reclamo'],['Queja','Queja']])}
${select('productType','Tipo de bien',[['Producto','Producto'],['Servicio','Servicio']])}
${field('product','Nombre o descripción del producto o servicio','maxlength="250" required')}
${field('amount','Monto reclamado en soles (si corresponde)','inputmode="decimal" maxlength="18"')}
${field('representative','Padre, madre o representante (si corresponde)','maxlength="180"')}
<label class="wide">¿Qué solución solicitas?<textarea name="request" maxlength="4000" required></textarea></label>
</div></fieldset>`;
app.innerHTML=page==='consulta'?`<form id="form"><div class="grid">
${field('expediente','Número de expediente','placeholder="EXP-2026-000001" maxlength="32" required autocomplete="off"')}
<div class="password-row">${field('password','Contraseña de consulta','type="password" maxlength="48" required autocomplete="off" autocapitalize="none" spellcheck="false"')}<button type="button" class="secondary" id="toggle-password" aria-label="Mostrar contraseña de consulta" aria-pressed="false">Mostrar</button></div>
</div><p></p>${captcha}${message}<button id="send">Consultar</button></form><section class="panel" id="result" hidden tabindex="-1"></section>`:
`<form id="form" autocomplete="off">${person}${page==='mesa'?intake:claims}
<fieldset><legend>Asunto y detalle</legend>
${field('subject','Asunto <small>Hasta 300 caracteres</small>','maxlength="300" required')}
<label>Detalle<textarea name="detail" maxlength="4000" required></textarea></label></fieldset>
<fieldset><legend>Documentos adjuntos</legend>
${page==='mesa'?'<label>Documento principal (PDF obligatorio) <small>Un archivo de hasta 20 MB.</small><input id="principal" type="file" accept=".pdf,application/pdf" required></label>':''}
<label>Copias y anexos (PDF opcionales) <small>Hasta 20 MB en conjunto. Puedes agregarlos uno por uno.</small><input id="annex" type="file" accept=".pdf,application/pdf" multiple></label>
<p id="attachment-feedback" role="status"></p>
<ol id="files" aria-label="Documentos que se enviarán"></ol></fieldset>
<details><summary>Uso de tus datos</summary><p>ALTUM LUMEN S.A.C. usa tus datos y archivos para registrar, atender y responder este trámite. Para consultas sobre tus datos, escribe a tramiteyatencion.altumlumen@gmail.com. <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a></p></details>
<p></p>${captcha}${message}<button id="send">Registrar expediente</button></form>
<section class="panel" id="result" hidden tabindex="-1"></section>`;
const form=document.querySelector('#form'),send=document.querySelector('#send'),result=document.querySelector('#result'),feedback=document.querySelector('#message');
const refreshButton=document.querySelector('#refresh');
let challenge,annexes=[],operation;
let busy=false,challengePending=false;
const formControls=()=>[...form.querySelectorAll('input, select, textarea, button')].filter(control=>control!==send&&control!==refreshButton);
function status(text,error=false){feedback.textContent=text;feedback.classList.toggle('error',error);}
async function rpc(action,payload={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
  try{
    const response=await fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'text/plain'},body:JSON.stringify({protocol:'sgd-mpv-v1',action,...payload}),signal:controller.signal});
    const body=await response.json().catch(()=>null);
    if(!body?.ok)throw Error(body?.error||'El servicio está temporalmente indisponible.');
    return body.data;
  }finally{clearTimeout(timeout);}
}
async function refresh(){
  if(challengePending)return;
  challengePending=true;
  refreshButton.disabled=true;
  send.disabled=true;
  challenge=null;
  form.elements.answer.value='';
  const question=document.querySelector('#question');
  question.textContent='Cargando comprobación…';
  try{
    const check=await rpc('challenge');
    challenge=check.token;
    question.textContent='¿Cuánto es '+check.question+'?';
  }catch(error){
    question.textContent='Actualiza la comprobación para continuar';
    throw error;
  }finally{
    challengePending=false;
    refreshButton.disabled=busy;
    send.disabled=busy||!challenge;
  }
}
function randomKey(){return [...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();}
function fileBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result.split(',')[1]);
    reader.onerror=()=>reject(Error('No se pudo leer '+file.name));
    reader.readAsDataURL(file);
  });
}
function element(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function attachmentError(files,max){
  if(files.some(f=>f.size<8||f.size>limit||f.name.length>180||!/\.pdf$/i.test(f.name)))return 'Selecciona archivos PDF de hasta 20 MB con nombres de hasta 180 caracteres.';
  if(files.length>max)return 'Puedes agregar hasta '+max+' archivos en este campo.';
  if(files.reduce((sum,file)=>sum+file.size,0)>limit)return 'Las copias y los anexos juntos pueden pesar hasta 20 MB.';
  return '';
}
function attachmentStatus(text){
  document.querySelector('#attachment-feedback').textContent=text;
}
function filesList(){
  const list=document.querySelector('#files');
  const primary=document.querySelector('#principal')?.files[0];
  list.replaceChildren();
  if(primary)list.append(element('li','Principal · '+primary.name));
  annexes.forEach((file,i)=>{
    const li=element('li','Anexo '+(i+1)+' · '+file.name),button=element('button','Quitar');
    button.type='button';button.className='secondary';button.setAttribute('aria-label','Quitar '+file.name);
    button.addEventListener('click',()=>{annexes.splice(i,1);filesList();});
    li.append(button);list.append(li);
  });
}
if(page!=='consulta'){
  const synchronize=()=>{
    const company=form.elements.person.value==='juridica';
    document.querySelector('#company').hidden=!company;
    document.querySelector('#name-label').textContent=company?'Nombres y apellidos del representante':'Nombres y apellidos';
    const dni=form.elements.idType.value==='DNI';
    form.elements.idNumber.inputMode=dni?'numeric':'text';
    form.elements.idNumber.pattern=dni?'[0-9]{8}':'[A-Za-z0-9\\-]{4,20}';
    form.elements.idNumber.maxLength=dni?8:20;
    for(const name of ['company','ruc']){form.elements[name].required=company;form.elements[name].disabled=!company;}
    if(page==='mesa'){
      const other=form.elements.docType.value==='Otro';
      document.querySelector('#other').hidden=!other;
      form.elements.other.required=other;form.elements.other.disabled=!other;
    }
  };
  form.elements.person.addEventListener('change',synchronize);
  form.elements.idType.addEventListener('change',synchronize);
  form.elements.docType?.addEventListener('change',synchronize);
  synchronize();
  document.querySelector('#principal')?.addEventListener('change',e=>{
    const file=e.target.files[0],error=file?attachmentError([file],1):'';
    if(error)e.target.value='';
    filesList();
    attachmentStatus(error);
  });
  document.querySelector('#annex').addEventListener('change',e=>{
    const next=[...annexes,...e.target.files],error=attachmentError(next,page==='mesa'?29:30);
    e.target.value='';
    attachmentStatus(error);
    if(error)return;
    annexes=next;
    filesList();
  });
}else{
  const toggle=document.querySelector('#toggle-password');
  toggle.addEventListener('click',()=>{
    const input=form.elements.password,visible=input.type==='password';
    input.type=visible?'text':'password';
    toggle.textContent=visible?'Ocultar':'Mostrar';
    toggle.setAttribute('aria-label',visible?'Ocultar contraseña de consulta':'Mostrar contraseña de consulta');
    toggle.setAttribute('aria-pressed',String(visible));
  });
}
function presentTrack(data){
  result.replaceChildren(element('h2',data.expediente),element('p','Estado: '+data.status),element('p','Oficina: '+data.offices.join(' · ')));
  const list=element('ol','');
  for(const movement of data.events)list.append(element('li',[movement.status,movement.office,movement.date].filter(Boolean).join(' · ')));
  result.append(element('h3','Movimientos'),list);
}
function receiptPdf(exp,password,date,url){
  const literal=s=>'('+String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').replace(/[\\()]/g,c=>'\\'+c)+')';
  const lines=['ALTUM LUMEN S.A.C.','ACUSE DE INGRESO','Expediente: '+exp,'Fecha de ingreso: '+date+' (Lima)','Contrasena de consulta: '+password,'Consultar expediente en el portal institucional'];
  const content=lines.map((s,i)=>'BT /F1 '+(i===1?22:12)+' Tf 48 '+(782-i*33)+' Td '+literal(s)+' Tj ET').join('\n')+'\n';
  const entries=[
    '<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R] >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length '+content.length+' >>\nstream\n'+content+'endstream',
    '<< /Type /Annot /Subtype /Link /Rect [46 611 370 633] /Border [0 0 0] /A << /S /URI /URI '+literal(url)+' >> >>'
  ];
  let pdf='%PDF-1.4\n';
  const offsets=entries.map((entry,i)=>{const offset=pdf.length;pdf+=(i+1)+' 0 obj\n'+entry+'\nendobj\n';return offset;});
  const xref=pdf.length;
  pdf+='xref\n0 7\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new Blob([pdf],{type:'application/pdf'});
}
function receipt(data,password){
  const url=new URL('consultar-expediente.html',location.href).href;
  const formatted=password.match(/.{4}/g).join('-'),details=element('dl','');
  for(const [label,value] of [['Expediente',data.expediente],['Fecha de ingreso',data.date],['Contraseña de consulta',formatted]])details.append(element('dt',label),element('dd',value));
  const download=element('a','Descargar acuse en PDF');
  download.className='button';download.download='Acuse-'+data.expediente+'.pdf';
  download.href=URL.createObjectURL(receiptPdf(data.expediente,formatted,data.date,url));
  window.addEventListener('pagehide',event=>{if(!event.persisted)URL.revokeObjectURL(download.href);});
  const track=element('a','Consultar expediente');track.href=url;track.target='_blank';track.rel='noopener';
  const actions=element('div','');actions.className='actions';actions.append(download,track);
  result.replaceChildren(element('h2','Expediente ingresado'),details,actions);
  form.reset();annexes=[];operation=null;form.hidden=true;
}
async function submit(e){
  e.preventDefault();
  if(busy||challengePending||(!challenge&&!operation?.commitPending))return;
  const fields=Object.fromEntries(new FormData(form)),proof={challenge,answer:fields.answer};
  delete fields.answer;
  busy=true;send.disabled=true;refreshButton.disabled=true;result.hidden=true;
  const enabled=formControls().filter(control=>!control.disabled);
  enabled.forEach(control=>{control.disabled=true;});
  try{
    if(operation?.commitPending){
      status('Confirmando el registro anterior…');
      const {id,password}=operation;
      receipt(await rpc('commit',{id,password}),password);
    }else if(page==='consulta'){
      status('Consultando expediente…');
      presentTrack(await rpc('track',{...proof,...fields}));
      form.elements.password.value='';
    }else{
      const main=document.querySelector('#principal')?.files[0],files=main?[main,...annexes]:[...annexes];
      if(files.length>30||files.some(f=>f.size<8||f.size>limit||f.name.length>180||!/\.pdf$/i.test(f.name)))throw Error('Revisa que los adjuntos sean archivos PDF de hasta 20 MB.');
      if(annexes.reduce((sum,f)=>sum+f.size,0)>limit)throw Error('Los anexos juntos pueden pesar hasta 20 MB.');
      const manifest=files.map(f=>({name:f.name,size:f.size})),snapshot=JSON.stringify([fields,manifest,files.map(f=>f.lastModified)]);
      if(!operation||operation.snapshot!==snapshot)operation={snapshot,id:randomKey(),password:randomKey()};
      const {id,password}=operation,auth={id,password};
      status('Preparando ingreso…');
      const start=await rpc('begin',{...proof,...auth,data:{...fields,kind:page},files:manifest});
      if(start.state!=='REGISTRADO'){
        for(const [index,file] of files.entries()){
          if(start.files.includes(String(index)))continue;
          status('Cargando documento '+(index+1)+' de '+files.length+'…');
          await rpc('upload',{...auth,index,base64:await fileBase64(file)});
        }
      }
      status('Registrando expediente…');
      operation.commitPending=true;
      receipt(await rpc('commit',auth),password);
    }
    status('');result.hidden=false;result.focus();
  }catch(error){status(error.message||'Inténtalo de nuevo.',true);}
  finally{
    if(operation?.commitPending){
      send.textContent='Confirmar registro';
      status('No se pudo confirmar el registro. Pulsa «Confirmar registro» para recuperar el mismo expediente.',true);
    }else{
      enabled.forEach(control=>{control.disabled=false;});
      if(!form.hidden)await refresh().catch(error=>{if(!feedback.textContent)status(error.message,true);});
    }
    busy=false;
    refreshButton.disabled=Boolean(operation?.commitPending);
    send.disabled=!challenge&&!operation?.commitPending;
  }
}
form.addEventListener('submit',submit);
refreshButton.addEventListener('click',()=>{if(!busy&&!operation?.commitPending)refresh().catch(error=>status(error.message,true));});
function showBookStatus(text,retry=false){
  form.hidden=true;
  const panel=element('section',''),heading=element('h2',text);
  panel.className='panel';
  panel.append(heading);
  if(retry){
    const button=element('button','Volver a comprobar');
    button.type='button';
    button.addEventListener('click',()=>{panel.remove();start();});
    panel.append(button);
  }else{
    panel.append(element('p','Si ya tienes un número de expediente, puedes revisar su estado con los datos de tu acuse.'));
    const link=element('a','Consultar expediente');
    link.href='consultar-expediente.html';
    panel.append(link);
  }
  app.prepend(panel);
  heading.tabIndex=-1;
  heading.focus({preventScroll:true});
}
async function start(){
  send.disabled=true;
  if(page==='libro'){
    form.hidden=true;
    let provider;
    try{({provider}=await rpc('config'));}
    catch(error){showBookStatus('No pudimos comprobar la disponibilidad del Libro.',true);return;}
    if(!provider){showBookStatus('El Libro de Reclamaciones aún no recibe registros.');return;}
    document.querySelector('#provider').append(document.createTextNode(' · '+provider));
    form.hidden=false;
  }
  try{
    await refresh();
  }catch(error){status(error.message,true);}
  finally{send.disabled=!challenge;}
}
start();
