const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const portal=fs.readFileSync(path.join(__dirname,'..','sgd.html'),'utf8');
const helper=fs.readFileSync(path.join(__dirname,'..','sgd-firmas','EstadoClientesR47.js'),'utf8');
const between=(source,first,next)=>{
  const begin=source.indexOf(first),end=source.indexOf(next,begin+first.length);
  assert(begin>=0&&end>begin,first);
  return source.slice(begin,end);
};
const account=between(portal,'async function loadApp()','function setCounts(c={})');
const viewer=between(portal,'function fdClose(){','function fdToggleSecret');
const status=between(portal,'function fdSigningScreen_(','function fdSigningToEmission_');
const timer=portal.match(/^\s*(?:let|var) fdSigningElapsedTimer_[^\r\n]*;/m)?.[0]||'';
const reset=between(helper,'const fd47PriorReset_=','async function emitCurrent(').trim();
assert(portal.includes(reset),'The live portal must contain the tested sign-out hook');

function start(){
  const token='session-being-closed',app={token,session:{userId:'user-test'},bootstrap:{},currentDraft:'DOC-test'};
  const storage=new Map([['sgd_portal_token',token]]),nodes=new Map(),requests=[],timers=new Set();
  const node=(id,classes=[])=>{
    const active=new Set(classes);
    const el={id,value:'entered',textContent:'',innerHTML:'',
      remove(){nodes.delete(this.id);},focus(){},
      classList:{add:c=>active.add(c),remove:c=>active.delete(c),contains:c=>active.has(c)},
    };
    if(id)nodes.set(id,el);
    return el;
  };
  node('appView');node('loginView',['hidden']);node('loginUser');node('loginPass');node('loginWarn');node('fdSigningElapsed');
  const panel=node('fdPanel');
  panel.querySelector=()=>null;
  panel.insertBefore=el=>nodes.set(el.id,el);
  let destroys=0,finishBootstrap;
  const fdUI={doc:{documentId:'DOC-test'},busy:true,signing:{},pdf:{destroy(){destroys++;return Promise.resolve();}},bytes:new Uint8Array(8)};
  const oldBootstrap=new Promise(resolve=>{finishBootstrap=resolve;});
  const pendingLogout=new Promise(()=>{});
  const context=vm.createContext({
    app,fdUI,$:id=>nodes.get(id),esc:s=>s,
    sessionStorage:{removeItem:key=>storage.delete(key),getItem:key=>storage.get(key)||null},
    document:{getElementById:id=>nodes.get(id),createElement:()=>node(),querySelectorAll:()=>[]},
    fd47Operations_:new Map(),fd47Emissions_:new Set(),
    closeDrawer(){},closeModal(){},loading(){},toast(){},
    setTimeout:()=>0,clearTimeout(){},clockSyncTimer_:null,clockRenderTimer_:null,
    setInterval(callback){timers.add(callback);return callback;},clearInterval(callback){timers.delete(callback);},
    masterData240:null,masterTab240:null,mySignatureState240:null,
    api(name,...args){
      requests.push([name,...args]);
      if(name==='bootstrapSGD')return oldBootstrap;
      assert.equal(name,'logoutSGD');
      assert.equal(app.token,'','The browser must close the session before contacting the server');
      assert(nodes.get('appView').classList.contains('hidden'));
      return pendingLogout;
    },
  });
  vm.runInContext([account,viewer,timer,status,reset].join('\n'),context);
  return {context,token,app,fdUI,nodes,storage,requests,timers,finishBootstrap,destroys:()=>destroys};
}

(async()=>{
  const closed=start();
  closed.context.logout();
  assert.equal(closed.app.token,'');
  assert.equal(closed.app.session,null);
  assert(!closed.storage.has('sgd_portal_token'));
  assert(closed.nodes.get('appView').classList.contains('hidden'));
  assert(!closed.nodes.get('loginView').classList.contains('hidden'));
  assert.equal(closed.nodes.get('loginPass').value,'');
  assert.deepEqual(closed.requests,[['logoutSGD',closed.token]]);
  await new Promise(resolve=>setImmediate(resolve));
  assert(!closed.nodes.has('fdPanel'));
  assert.equal(closed.destroys(),1);
  assert.equal(closed.fdUI.doc,null);

  const busy=start();
  const bootstrap=busy.context.loadApp();
  busy.context.fdSigningScreen_('Firmando','Guardando la firma','busy');
  assert.equal(busy.timers.size,1);
  assert(busy.nodes.has('fdSigningOverlay'));
  busy.context.logout();
  busy.finishBootstrap({session:{userId:'user-test'}});
  await bootstrap;
  assert.equal(busy.timers.size,0);
  assert(!busy.nodes.has('fdSigningOverlay'));
  assert.equal(busy.app.session,null);
  assert(busy.nodes.get('appView').classList.contains('hidden'));
  assert(!busy.nodes.get('loginView').classList.contains('hidden'));
  console.log('PASS: logout clears the session, closes the viewer, cancels active status and ignores stale startup');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
