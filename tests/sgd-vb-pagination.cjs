const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'sgd.html'),'utf8'),backend=fs.readFileSync(path.join(root,'sgd-firmas/VistosBuenosR46.gs'),'utf8');
function source(text,name){const start=text.search(new RegExp('(?:async )?function '+name+'\\('));assert(start>=0,name);const rest=text.slice(start),end=rest.slice(1).search(/\r?\n(?:async )?function /)+1,body=(end>0?rest.slice(0,end):rest);return body.slice(0,body.lastIndexOf('}')+1).trim();}
const frontAllocator=source(html,'fd46VbPlacement_'),backAllocator=source(backend,'fd46VbPlacement_');assert.equal(frontAllocator,backAllocator,'Preview and server must use identical allocation');
const context=vm.createContext({});vm.runInContext(frontAllocator,context);const place=(sizes,history)=>JSON.parse(JSON.stringify(context.fd46VbPlacement_(sizes,history)));
const a4={x:0,y:0,width:595.28,height:841.89};
let history=[];
for(let i=0;i<40;i++){
 const p=place([a4,a4,a4,a4,a4],history);assert.equal(p.page,Math.floor(i/8));assert.deepEqual(p.box,[14,14+(i%8)*97,88,108+(i%8)*97]);assert.equal(p.append,false);history.push({type:'VISTO_BUENO',page:p.page,box:p.box});
}
let p=place([a4,a4,a4,a4,a4],history);assert.equal(p.page,5);assert(p.append);assert.deepEqual(p.box,[14,14,88,108]);
const eight=history.slice(0,8);p=place([a4],eight);assert.equal(p.page,1);assert(p.append);assert.deepEqual(p.box,[14,14,88,108]);
p=place([a4,a4],eight);assert.equal(p.page,1);assert(!p.append);
// Different page heights, offsets and advanced signatures must not cause overlap.
const sizes=[{x:20,y:30,width:612,height:792},{x:-10,y:-20,width:842,height:595}];history=[];
for(let i=0;i<12;i++){p=place(sizes,history);assert.equal(p.page,i<7?0:1);const s=sizes[p.page];assert(p.box[0]>=s.x+14&&p.box[3]<=s.y+s.height-14);history.push({type:'VISTO_BUENO',page:p.page,box:p.box});}
p=place([a4],[{type:'VB_AVANZADA',page:0,box:[14,14,88,108]}]);assert.deepEqual(p.box,[14,111,88,205]);
p=place([a4],[{type:'VISTO_BUENO',page:0,box:null}]);assert.deepEqual(p.box,[14,111,88,205]);
p=place([{x:0,y:0,width:50,height:50}],[]);assert(p.append);assert.equal(p.size.width,a4.width);
// Navigation may review other pages, but signing stays on the displayed protected position.
const nodes={fd3SignType:{value:'VISTO_BUENO'},fdRect:{style:{}},fdSignButton:{disabled:true}},ui={doc:{myTurn:true},page:1,vbPlacement:{page:1},busy:true};
const navigation=vm.createContext({fdUI:ui,$:id=>nodes[id]});vm.runInContext(source(html,'fd46StampVisibility_'),navigation);
navigation.fd46StampVisibility_();assert.equal(nodes.fdSignButton.disabled,false,'Opening the viewer inside fdRun must enable signing');
ui.page=0;navigation.fd46StampVisibility_();assert.equal(nodes.fdRect.style.display,'none');assert.equal(nodes.fdSignButton.disabled,true);
nodes.fd3SignType.value='TITULAR';navigation.fd46StampVisibility_();assert.equal(nodes.fdSignButton.disabled,false);
nodes.fd3SignType.value='VB_AVANZADA';ui.page=1;navigation.fd46StampVisibility_();assert.equal(nodes.fdSignButton.disabled,false);
for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/type="module"|type="application\/json"/.test(script[1]))new vm.Script(script[2]);new vm.Script(backend);
console.log('PASS: paginated allocation, continuation pages, varied sizes, collisions, legacy history, viewer navigation and syntax');
