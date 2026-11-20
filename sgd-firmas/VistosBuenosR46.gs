/* R46 · Vistos buenos: lateral izquierdo, desde abajo y por páginas. */
function fd46VbPlacement_(sizes,history){
  const margin=14,width=74,height=94,gap=3,entries=Array.isArray(history)?history:[];
  function find(size,page){
    if(!size||![size.x,size.y,size.width,size.height].every(Number.isFinite)||size.width<width+2*margin||size.height<height+2*margin)return null;
    const occupied=entries.filter(v=>v&&Number(v.page||0)===page),unknown=occupied.filter(v=>v.type==='VISTO_BUENO'&&(!Array.isArray(v.box)||v.box.length!==4)).length;
    for(let slot=unknown,y=size.y+margin+unknown*(height+gap);y+height<=size.y+size.height-margin;slot++,y+=height+gap){
      const box=[size.x+margin,y,size.x+margin+width,y+height];
      if(!occupied.some(v=>Array.isArray(v.box)&&v.box.length===4&&box[0]<v.box[2]&&box[2]>v.box[0]&&box[1]<v.box[3]&&box[3]>v.box[1]))return{page,box,append:false,size};
    }
    return null;
  }
  for(let page=0;page<sizes.length;page++){const found=find(sizes[page],page);if(found)return found;}
  const reference=sizes.find(s=>s&&s.width>=width+2*margin&&s.height>=height+2*margin);
  const size=reference?{x:0,y:0,width:reference.width,height:reference.height}:{x:0,y:0,width:595.28,height:841.89};
  return{page:sizes.length,box:[margin,margin,margin+width,margin+height],append:true,size};
}

/* La nueva hoja se agrega en la revisión incremental que contiene la firma. */
function fd46PlaceVb_(pdf,history){
  const placement=fd46VbPlacement_(pdf.getPages().map(p=>p.getCropBox()),history);
  if(placement.append)fd46AddContinuation_(pdf,placement.size);
  return placement;
}
function fd46AddContinuation_(doc,size){
  const page=doc.addPage([size.width,size.height]);
  page.drawText('Continuación de vistos buenos',{x:100,y:size.height-35,size:11});
  return page;
}
function fd46Continuation_(signer,placement){
  if(!placement||!placement.append)return;
  const original=signer.addSignHolder;
  signer.addSignHolder=function(doc){
    if(doc.getPageCount()!==placement.page)throw Error('Cambió la paginación del PDF. Vuelva a abrir el documento.');
    fd46AddContinuation_(doc,placement.size);
    return original.call(this,doc);
  };
}
