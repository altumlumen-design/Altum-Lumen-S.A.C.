const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const portal=fs.readFileSync(path.join(__dirname,'..','sgd.html'),'utf8');
function segment(begin,end){
  const a=portal.indexOf(begin),b=portal.indexOf(end,a+begin.length);
  assert(a>=0&&b>a,begin);
  return portal.slice(a,b);
}

const panels=segment('function fdPanel(title,html,viewer=','function fdToggleSecret');
const run=segment('async function fdRun(fn)','async function fdHome()');
const open=segment('function fdOpen(id,onlyReady=false)','function fdBase64Bytes_');
const escape=segment("document.addEventListener('keydown',e=>{\n if(e.key!=='Escape'",'\ninit();');

const nodes=new Map(),listeners={},background={focusCount:0,isConnected:true,focus(){this.focusCount++;}};
let loader,shown=0,dialogs=0,underlyingCloses=0;
const document={
  activeElement:background,
  getElementById:id=>nodes.get(id),
  addEventListener:(name,fn)=>{listeners[name]=fn;},
  body:{append(el){nodes.set(el.id,el);}},
  createElement(tagName){
    return {
      tagName,attributes:{},events:{},
      setAttribute(name,value){this.attributes[name]=value;},
      addEventListener(name,fn){this.events[name]=fn;},
      showModal(){assert.equal(tagName,'dialog');this.open=true;dialogs++;},
      close(){this.open=false;dialogs--;},
      remove(){nodes.delete(this.id);},
    };
  },
};
nodes.set('modalBack',{classList:{contains:()=>true},inert:false});
const c=vm.createContext({
  document,$:id=>nodes.get(id),esc:s=>s,
  app:{token:'fixture'},fdUI:{busy:false},fdSigningClose_(){},toast(){},
  closeModal(){underlyingCloses++;},closeDrawer(){throw Error('drawer unexpectedly closed');},
  fd47Bounded_:promise=>promise,fd47Session_:()=>{},fdShow(){shown++;},
  err(error){throw error;},
  api(){return new Promise(resolve=>{loader=resolve;});},
});
vm.runInContext([panels,run,open,escape].join('\n'),c);

(async()=>{
  const settings=c.fdPanel('Configuración','<p>Certificado</p>');
  assert.equal(settings.tagName,'section','Existing certificate screens do not become modal');
  const ready=c.fdPanel('Firmar documento','<p>PDF</p>',true);
  assert(ready.open);
  assert.equal(ready.attributes['aria-labelledby'],'fdPanelTitle');
  assert.match(ready.innerHTML,/autofocus/);
  assert.equal(dialogs,1);
  listeners.keydown({key:'Escape'});
  assert.equal(underlyingCloses,0);

  const task=c.fdOpen('DOC-fixture');
  const opening=nodes.get('fdPanel');
  assert(opening.open);
  assert.equal(dialogs,1,'Replacing the viewer closes the preceding dialog');
  assert.equal(c.fdUI.busy,true);
  let canceled=false;
  opening.events.cancel({preventDefault(){canceled=true;}});
  assert(canceled);
  assert(!nodes.has('fdPanel'));
  assert.equal(dialogs,0);
  assert.equal(background.focusCount,1);
  loader({signatureWaiting:false});
  await task;
  assert.equal(shown,0,'A late PDF never reopens a dismissed dialog');
  assert.equal(c.fdUI.busy,false);
  console.log('PASS: native signing dialog, scoped Escape, focus restoration and dismissal during preparation');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
