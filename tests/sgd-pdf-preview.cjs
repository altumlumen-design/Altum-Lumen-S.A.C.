const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','sgd.html'),'utf8');
const esc=html.split(/\r?\n/).find(line=>line.startsWith('const esc='));
const helpers=html.slice(html.indexOf('function sgdPayloadToBlob_'),html.indexOf('function downloadBlobDirect_'));
const review=html.slice(html.indexOf('let finalReviewUrl_='),html.indexOf('async function confirmReviewAndEmit('));
const bytes=Buffer.from('%PDF-1.7\n<< /Title (INFORME N. 00003-2026-AL/OCAJ) >>');
const pdf={
  number:'MEMORÁNDUM N.° 00027-2026-AL/GSCC',
  name:'MEMORÁNDUM N.° 00027-2026-AL-GSCC [F].pdf',
  mime:'application/pdf',
  base64:bytes.toString('base64'),
  pdfHash:'original-version-hash',
};
const popup={
  document:{documentElement:{},body:{style:{}}},
  URL:{createObjectURL(blob){tabBlob=blob;return 'blob:popup-original';},revokeObjectURL(){}},
  addEventListener(){},
};
const expand={};
const body={querySelector:()=>expand,removeAttribute(){}};
const button={disabled:true};
const elements={finalReviewBody:body,finalReviewConfirm:button,modalBack:{classList:{contains:()=>true}}};
let reviewBlob,tabBlob,confirmation,requests=0,released;
const context=vm.createContext({
  atob,Blob,Uint8Array,
  $:id=>elements[id],
  app:{currentDraft:'DOC-test'},
  getDraftFinalPdfPayloadClient_:async()=>{requests++;return pdf;},
  showWideModal(){},
  window:{open:()=>popup},
  URL:{createObjectURL(blob){reviewBlob=blob;return 'blob:review-original';},revokeObjectURL(url){released=url;}},
  confirmReviewAndEmit(...args){confirmation=args;},
});
vm.runInContext(esc+'\n'+helpers+'\n'+review,context);

(async()=>{
  await context.reviewFinal();
  assert.equal(requests,1);
  assert.match(body.innerHTML,/MEMORÁNDUM N\.° 00027-2026-AL\/GSCC/);
  assert(!body.innerHTML.includes('INFORME'));
  assert.match(body.innerHTML,/src="blob:review-original#toolbar=0&amp;navpanes=0"/);
  assert(body.innerHTML.includes('download="'+pdf.name+'"'));
  assert(Buffer.from(await reviewBlob.arrayBuffer()).equals(bytes));
  assert.equal(button.disabled,false);
  button.onclick();
  assert.deepEqual(confirmation,['DOC-test',pdf.pdfHash,button]);

  expand.onclick();
  context.releaseFinalReview_();
  assert.equal(released,'blob:review-original');
  assert.equal(requests,1);
  assert.equal(popup.document.title,pdf.number);
  assert.match(popup.document.body.innerHTML,/blob:popup-original#toolbar=0/);
  assert(Buffer.from(await tabBlob.arrayBuffer()).equals(bytes));

  assert.equal(context.sgdPdfPreviewTitle_({name:'Acta adjunta.pdf'}),'Acta adjunta');
  const escaped=context.sgdPdfPreviewMarkup_({number:'<Resolución>',name:'"Acta".pdf'},'blob:check');
  assert(escaped.includes('&lt;Resolución&gt;'));
  assert(escaped.includes('download="&quot;Acta&quot;.pdf"'));
  console.log('PASS: official title, original PDF bytes and hash, independent popup, and one request');
})().catch(error=>{console.error(error);process.exitCode=1;});
