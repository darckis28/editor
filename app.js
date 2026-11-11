(function(){
'use strict';
const $=id=>document.getElementById(id);
const all=s=>[...document.querySelectorAll(s)];
const state={sources:new Map(),pages:[],current:0,tool:'select',selectedId:null,zoom:1,viewport:null,pdfPage:null,textItems:[],seq:0,renderTask:null,pointer:null,pendingImage:null,customFont:null,history:[],future:[],busy:false,signData:null,thumbSeq:0};
const els={stage:$('stageHolder'),canvas:$('pdfCanvas'),overlay:$('markupCanvas')};
let toastTimer;
function toast(message,error=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4000)}
function status(message){$('activity').textContent=message}
function setLibraryStatus(message,ready,error=false){
 const node=$('libraryStatus');node.textContent=message;
 node.classList.toggle('is-ready',!!ready);node.classList.toggle('is-error',!!error);
 $('retryLibraryBtn').classList.toggle('hidden',!error);
}
async function needLibrary(){
 if(window.pdfjsLib&&window.PDFLib){setLibraryStatus('✓ Herramientas PDF listas',true);return true}
 if(!window.EditaditoDependencies){setLibraryStatus('Falta el cargador de bibliotecas PDF.',false,true);toast('Error de configuración: dependencies.js no está disponible.',true);return false}
 const result=await EditaditoDependencies.load(message=>setLibraryStatus(message,false));
 if(result.ready){setLibraryStatus('✓ Herramientas PDF listas',true);return true}
 setLibraryStatus('No se pudieron cargar las bibliotecas PDF. Comprueba internet y usa Reintentar.',false,true);
 toast('No se cargó '+result.failed.join(' ni ')+'. Revisa tu conexión o pulsa Reintentar.',true);
 return false;
}
const mod=(v,n)=>((v%n)+n)%n;
const uid=()=> 'o'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const currentPage=()=>state.pages[state.current];
const selected=()=>currentPage()?.annotations.find(o=>o.id===state.selectedId)||null;
function snapshot(){state.history.push(JSON.stringify({pages:state.pages,current:state.current}));if(state.history.length>45)state.history.shift();state.future=[];historyButtons()}
function restore(str){const o=JSON.parse(str);state.pages=o.pages;state.current=Math.max(0,Math.min(o.current,state.pages.length-1));state.selectedId=null;refresh();}
function historyButtons(){$('undoBtn').disabled=!state.history.length;$('redoBtn').disabled=!state.future.length}
function undo(){if(!state.history.length)return;state.future.push(JSON.stringify({pages:state.pages,current:state.current}));restore(state.history.pop());historyButtons()}
function redo(){if(!state.future.length)return;state.history.push(JSON.stringify({pages:state.pages,current:state.current}));restore(state.future.pop());historyButtons()}
function setTool(name){state.tool=name;all('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===name));const hints={select:'Haz clic sobre un elemento añadido para seleccionarlo y moverlo.',edit:'Haz clic sobre una línea de texto del PDF. Su reemplazo será visual, no eliminará el texto interno.',text:'Haz clic en la página para insertar un texto.',rect:'Arrastra para dibujar una figura.',highlight:'Arrastra para resaltar una zona.',white:'Arrastra para cubrir una zona. No sirve para eliminar información confidencial.',pen:'Mantén pulsado y dibuja a mano alzada.',image:'Selecciona una imagen y luego haz clic para colocarla.',signature:'Dibuja tu firma visual y luego colócala en la página.'};$('editHint').textContent=hints[name];els.overlay.style.cursor=name==='select'?'default':name==='edit'?'text':'crosshair';if(name==='image'&&!state.pendingImage)$('imageInput').click();if(name==='signature'&&!state.signData)showDialog($('signDialog'))}
function showDialog(el){if(!el.open)el.showModal()}
async function importPDF(file,append=false){
 if(!await needLibrary())return;
 if(!file||(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')){toast('Selecciona un archivo PDF válido.',true);return}
 if(file.size>125*1024*1024){toast('El documento supera el límite recomendado de 125 MB.',true);return}
 try{
  state.busy=true;status('Abriendo '+file.name+'...');toast('Cargando documento…');
  const bytes=await file.arrayBuffer();
  const signature=EditaditoSignatures.inspect(bytes);
  const loading=pdfjsLib.getDocument({data:new Uint8Array(bytes.slice(0))});
  const doc=await loading.promise;
  if(!append){state.sources.clear();state.pages=[];state.current=0;state.history=[];state.future=[];state.selectedId=null}
  else snapshot();
  const sourceId=uid();state.sources.set(sourceId,{id:sourceId,name:file.name,bytes,doc,signature});
  for(let i=1;i<=doc.numPages;i++){state.pages.push({id:uid(),sourceId,pageNo:i,rotate:0,annotations:[]})}
  if(append)state.current=state.pages.length-doc.numPages;
  $('documentName').textContent=append?'Documento combinado':file.name;
  $('emptyState').classList.add('hidden');$('workspace').classList.remove('hidden');
  status(doc.numPages+' páginas abiertas');refresh();
  if(signature.signed)toast('⚠ El archivo tiene indicios de '+signature.signatureCount+' firma(s) digital(es).');
  else toast('PDF abierto correctamente.');
 }catch(err){console.error(err);toast('No se pudo abrir el PDF: '+err.message,true)}finally{state.busy=false}
}
function updateSignatures(){
 const signed=[...state.sources.values()].filter(s=>s.signature.potentiallySigned);
 $('signatureBanner').classList.toggle('hidden',!signed.length);
 const count=signed.reduce((n,s)=>n+s.signature.signatureCount,0);
 $('signatureSummary').textContent=`${signed.length} documento(s) con indicios de firma; ${count} campo(s) con ByteRange. Guarda el original sin modificaciones para mantener sus bytes intactos.`;
 $('reviewSignaturesBtn').disabled=!state.sources.size;
 $('originalBtn').disabled=!state.pages.length;
 $('signatureReport').replaceChildren();
 for(const s of state.sources.values()){
  const info=document.createElement('div');info.className='signature-report-item';
  const sd=s.signature;
  info.innerHTML='<strong></strong><div></div>';
  info.querySelector('strong').textContent=s.name;
  info.querySelector('div').textContent=`Firmas detectadas (/ByteRange): ${sd.signatureCount}. Campos de firma: ${sd.signatureFieldCount}. ${sd.docMDP?'Hay referencia DocMDP (posibles restricciones de cambios). ':''}${sd.byteRanges.some(b=>!b.appearsToCoverFinalRevision)?'Alguna firma no cubre toda la revisión final. ':''}${!sd.potentiallySigned?'No se hallaron estructuras de firma en el análisis de bytes.':''}`;
  $('signatureReport').append(info);
 }
}
function refresh(){
 const opened=!!state.pages.length;
 ['addPdfBtn','addBlankBtn','saveBtn','rotateLeftBtn','rotateRightBtn','pageUpBtn','pageDownBtn','duplicatePageBtn','deletePageBtn'].forEach(id=>$(id).disabled=!opened);
 $('pageCountLabel').textContent=`${state.pages.length} página${state.pages.length===1?'':'s'}`;
 const srcList=$('sourceList');srcList.replaceChildren();
 for(const source of state.sources.values()){const item=document.createElement('div');item.className='source-item';item.textContent=(source.signature.signed?'🔏 ':'📄 ')+source.name;item.title=source.signature.signed?'Se detectaron posibles firmas digitales':'Documento cargado';srcList.append(item)}
 $('pageIndicator').textContent=`Página ${opened?state.current+1:0} de ${state.pages.length}`;
 $('workspace').classList.toggle('hidden',!opened);$('emptyState').classList.toggle('hidden',opened);
 historyButtons();updateSignatures();renderPagesList();renderPage();updateProps();
}
function renderPagesList(){
 const el=$('pagesList');el.replaceChildren();const list=state.pages;
 if(!list.length){el.innerHTML='<div class="empty-pages">Abre un documento PDF para empezar.</div>';return}
 for(let i=0;i<list.length;i++){
  const model=list[i],src=state.sources.get(model.sourceId);const b=document.createElement('div');
  b.className='page-thumb'+(i===state.current?' active':'');b.draggable=true;b.dataset.index=i;
  b.innerHTML='<div class="thumb-preview"><span class="thumb-placeholder">▤</span></div><div class="thumb-label"></div>';
  b.querySelector('.thumb-label').textContent=`Página ${i+1}${src?.signature.signed?' 🔏':''}`;
  b.onclick=()=>{if(state.current!==i){state.current=i;state.selectedId=null;renderPagesList();renderPage();updateProps()}};
  b.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move'};
  b.ondragover=e=>{e.preventDefault();b.classList.add('drag-over')};
  b.ondragleave=()=>b.classList.remove('drag-over');
  b.ondrop=e=>{e.preventDefault();b.classList.remove('drag-over');const from=Number(e.dataTransfer.getData('text/plain'));if(!Number.isInteger(from)||from<0||from>=state.pages.length||from===i)return;snapshot();const [m]=state.pages.splice(from,1);state.pages.splice(i,0,m);state.current=i;state.selectedId=null;refresh()};
  el.append(b);
 }
 const tick=++state.thumbSeq;
 // Para documentos grandes solo se generan miniaturas cercanas a la selección.
 const order=[state.current,...Array.from({length:state.pages.length},(_,i)=>i).filter(i=>Math.abs(i-state.current)<8&&i!==state.current)];
 (async()=>{for(const i of order.slice(0,15)){
  if(tick!==state.thumbSeq)break;
  const root=el.querySelector(`[data-index="${i}"] .thumb-preview`);if(!root)continue;
  try{const m=state.pages[i],doc=state.sources.get(m.sourceId).doc,page=await doc.getPage(m.pageNo);const vp=page.getViewport({scale:0.15,rotation:mod(page.rotate+m.rotate,360)});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;if(tick!==state.thumbSeq)break;root.replaceChildren(c)}catch(e){console.warn('Miniatura no disponible',e)}}})();
}
async function renderPage(){
 const token=++state.seq;
 const previous=state.renderTask;
 if(previous){try{previous.cancel();await previous.promise}catch(e){/* Render anterior cancelado */}if(state.renderTask===previous)state.renderTask=null}
 if(token!==state.seq)return;
 const model=currentPage();if(!model)return;
 try{
  const src=state.sources.get(model.sourceId),page=await src.doc.getPage(model.pageNo);
  if(token!==state.seq)return;
  const rotation=mod(page.rotate+model.rotate,360),viewport=page.getViewport({scale:state.zoom,rotation});
  state.pdfPage=page;state.viewport=viewport;
  const w=Math.ceil(viewport.width),h=Math.ceil(viewport.height),dpr=Math.min(window.devicePixelRatio||1,2);
  els.stage.style.width=w+'px';els.stage.style.height=h+'px';
  for(const canvas of [els.canvas,els.overlay]){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px'}
  const ctx=els.canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,els.canvas.width,els.canvas.height);
  const task=page.render({canvasContext:ctx,viewport,transform:[dpr,0,0,dpr,0,0]});
  state.renderTask=task;await task.promise;if(state.renderTask===task)state.renderTask=null;if(token!==state.seq)return;
  const content=await page.getTextContent();if(token!==state.seq)return;
  state.textItems=content.items.filter(x=>x.str&&x.str.trim());
  drawMarkup();$('pageIndicator').textContent=`Página ${state.current+1} de ${state.pages.length}`;
  $('zoomLabel').textContent=Math.round(state.zoom*100)+'%';
 }catch(err){if(err?.name==='RenderingCancelledException')return;if(token===state.seq){console.error(err);toast('No se pudo representar la página: '+err.message,true)}}
}
const pdfToScreen=(x,y)=>state.viewport.convertToViewportPoint(x,y);
const screenToPdf=(x,y)=>state.viewport.convertToPdfPoint(x,y);
function polygon(ctx,points,fill,stroke=false){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill)ctx.fill();if(stroke)ctx.stroke()}
function corners(a){return [pdfToScreen(a.x,a.y),pdfToScreen(a.x+a.w,a.y),pdfToScreen(a.x+a.w,a.y+a.h),pdfToScreen(a.x,a.y+a.h)]}
function drawnImage(a,ctx){
 if(!a._img){const image=new Image();a._img=image;image.onload=()=>{if(currentPage()?.annotations.includes(a))drawMarkup()};image.src=a.dataUrl;return}
 if(!a._img.complete||!a._img.naturalWidth)return;
 const p0=pdfToScreen(a.x,a.y+a.h),px=pdfToScreen(a.x+a.w,a.y+a.h),py=pdfToScreen(a.x,a.y);
 ctx.save();ctx.setTransform((px[0]-p0[0])/a._img.naturalWidth,(px[1]-p0[1])/a._img.naturalWidth,(py[0]-p0[0])/a._img.naturalHeight,(py[1]-p0[1])/a._img.naturalHeight,p0[0],p0[1]);
 ctx.drawImage(a._img,0,0);ctx.restore();
}
const imageCache=new Map();
function drawMarkup(){
 const model=currentPage();if(!model||!state.viewport)return;
 const ctx=els.overlay.getContext('2d');const dpr=els.overlay.width/parseFloat(els.overlay.style.width);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,els.overlay.width,els.overlay.height);ctx.setTransform(dpr,0,0,dpr,0,0);
 for(const a of model.annotations){
  ctx.save();
  if(['rect','highlight','white'].includes(a.type)){
   ctx.fillStyle=a.type==='white'?'white':a.type==='highlight'?'rgba(255,225,0,.35)':a.color||'#2593ec';
   polygon(ctx,corners(a),true);
   if(a.type==='rect'){ctx.strokeStyle=a.color||'#2593ec';ctx.lineWidth=1.4;polygon(ctx,corners(a),false,true)}
  }else if(a.type==='text'){
   const v=state.viewport.transform,p=pdfToScreen(a.x,a.y),rotation=Math.atan2(v[1],v[0]);
   ctx.translate(p[0],p[1]);ctx.rotate(rotation);
   const size=(Number(a.size)||16)*state.zoom,lines=String(a.text||'').split('\n');
   ctx.font=`${a.italic?'italic ':''}${a.bold?'bold ':''}${size}px ${JSON.stringify(a.font||'Arial')}, Arial, sans-serif`;
   ctx.textBaseline='alphabetic';ctx.textAlign=a.align||'left';
   if(a.mask){ctx.fillStyle='white';const mx=(a.align==='center'?-(a.maskWidth*state.zoom)/2:a.align==='right'?-a.maskWidth*state.zoom:0);ctx.fillRect(mx-2,-(a.maskHeight||a.size*1.2)*state.zoom,a.maskWidth*state.zoom+4,(a.maskHeight||a.size*1.2)*state.zoom+5)}
   ctx.fillStyle=a.color||'#142642';lines.forEach((line,i)=>ctx.fillText(line,0,i*size*1.3));
  }else if(a.type==='image'){
   let img=imageCache.get(a.dataUrl);if(!img){img=new Image();img.onload=drawMarkup;img.src=a.dataUrl;imageCache.set(a.dataUrl,img)}
   if(img.complete&&img.naturalWidth){const p0=pdfToScreen(a.x,a.y+a.h),px=pdfToScreen(a.x+a.w,a.y+a.h),py=pdfToScreen(a.x,a.y);ctx.setTransform(dpr*(px[0]-p0[0])/img.naturalWidth,dpr*(px[1]-p0[1])/img.naturalWidth,dpr*(py[0]-p0[0])/img.naturalHeight,dpr*(py[1]-p0[1])/img.naturalHeight,dpr*p0[0],dpr*p0[1]);ctx.drawImage(img,0,0)}
  }else if(a.type==='pen'){
   ctx.beginPath();a.points.forEach((pt,i)=>{const p=pdfToScreen(pt.x,pt.y);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.strokeStyle=a.color||'#c73555';ctx.lineWidth=(a.width||2)*state.zoom;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
  }
  ctx.restore();
  if(state.selectedId===a.id){
   ctx.save();ctx.setLineDash([5,3]);ctx.strokeStyle='#0086e8';ctx.lineWidth=1.4;
   if(a.type==='text'){const w=textWidthPdf(a),h=(Number(a.size)||16)*Math.max(1,String(a.text).split('\n').length)*1.3;polygon(ctx,corners({x:a.x-(a.align==='center'?w/2:a.align==='right'?w:0),y:a.y-a.size*.25-h*(String(a.text).split('\n').length-1),w,h:h+4}),false,true)}
   else if(a.type==='pen'){const bounds=annotationBounds(a);polygon(ctx,corners(bounds),false,true)}
   else polygon(ctx,corners(a),false,true);
   ctx.restore();
  }
 }
 if(state.pointer?.type==='drawRect'&&state.pointer.preview){const a=state.pointer.preview;ctx.save();ctx.setLineDash([4,4]);ctx.fillStyle=a.type==='highlight'?'rgba(255,225,0,.3)':a.type==='white'?'white':'rgba(0,91,170,.16)';ctx.strokeStyle='#0985dc';polygon(ctx,corners(a),true,true);ctx.restore()}
}
function textWidthPdf(a){const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=`${a.italic?'italic ':''}${a.bold?'bold ':''}${a.size}px ${JSON.stringify(a.font||'Arial')}`;return Math.max(12,...String(a.text||'').split('\n').map(l=>ctx.measureText(l).width))}
function annotationBounds(a){if(a.type==='text'){const w=textWidthPdf(a),h=(a.size||16)*Math.max(1,String(a.text).split('\n').length)*1.35;return {x:a.x-(a.align==='center'?w/2:a.align==='right'?w:0),y:a.y-(h-a.size)-a.size*.3,w,h}}
 if(a.type==='pen'){const ps=a.points||[];if(!ps.length)return{x:0,y:0,w:0,h:0};const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);return{x:Math.min(...xs)-5,y:Math.min(...ys)-5,w:Math.max(...xs)-Math.min(...xs)+10,h:Math.max(...ys)-Math.min(...ys)+10}}
 return {x:Math.min(a.x,a.x+(a.w||0)),y:Math.min(a.y,a.y+(a.h||0)),w:Math.abs(a.w||0),h:Math.abs(a.h||0)}}
function hitAnnotation(x,y){const arr=[...currentPage().annotations].reverse();for(const a of arr){const b=annotationBounds(a);if(x>=b.x-4&&x<=b.x+b.w+4&&y>=b.y-4&&y<=b.y+b.h+4)return a}return null}
function hitText(x,y){let best=null,dist=Infinity;for(const item of state.textItems){const t=item.transform||[];if(t.length<6)continue;const sz=Math.max(5,Math.hypot(t[0],t[1])||Math.hypot(t[2],t[3]));const bx=t[4],by=t[5],w=item.width||sz*item.str.length*.55;
  if(x>=bx-4&&x<=bx+w+4&&y>=by-sz*.35&&y<=by+sz*1.4){const d=Math.abs(y-(by+sz*.3));if(d<dist){best={item,x:bx,y:by,size:sz,width:w};dist=d}}
 }return best}
function getPointer(event){const r=els.overlay.getBoundingClientRect();const sx=(event.clientX-r.left)*(parseFloat(els.overlay.style.width)/r.width),sy=(event.clientY-r.top)*(parseFloat(els.overlay.style.height)/r.height);const [x,y]=screenToPdf(sx,sy);return {x,y}}
function addAnnotation(a){snapshot();currentPage().annotations.push({...a,id:uid()});state.selectedId=currentPage().annotations.at(-1).id;drawMarkup();updateProps()}
function clampPoint(pt){const page=state.pdfPage;return {x:Math.max(0,Math.min(page.view[2],pt.x)),y:Math.max(0,Math.min(page.view[3],pt.y))}}
function pointerDown(e){if(!currentPage()||state.busy||e.button!==0)return;const p=getPointer(e),m=currentPage();els.overlay.setPointerCapture(e.pointerId);
 if(state.tool==='select'){
  const a=hitAnnotation(p.x,p.y);state.selectedId=a?.id||null;state.pointer=a?{type:'move',id:a.id,start:p,initial:JSON.parse(JSON.stringify(a)),changed:false}:null;updateProps();drawMarkup();return;
 }
 if(state.tool==='edit'){
  const old=hitAnnotation(p.x,p.y);if(old?.type==='text'){state.selectedId=old.id;setTool('select');updateProps();drawMarkup();return}
  const hit=hitText(p.x,p.y);
  if(!hit){toast('No se encontró texto seleccionable. Puede ser un PDF escaneado.');return}
  addAnnotation({type:'text',x:hit.x,y:hit.y,text:hit.item.str,font:'Arial',size:Math.round(hit.size),color:'#142642',bold:false,italic:false,align:'left',mask:true,maskWidth:hit.width+5,maskHeight:hit.size*1.35});
  setTool('select');toast('Línea seleccionada. Edita su contenido o tamaño en Propiedades. Reemplazo visual solamente.');return;
 }
 if(state.tool==='text'){
  addAnnotation({type:'text',x:p.x,y:p.y,text:'Nuevo texto',size:16,font:'Arial',color:'#142642',bold:false,italic:false,align:'left'});setTool('select');$('textEditor').focus();$('textEditor').select();return;
 }
 if(state.tool==='image'||state.tool==='signature'){
  const pending=state.tool==='signature'?state.signData:state.pendingImage;
  if(!pending){toast('Primero selecciona o dibuja una imagen.');return}
  const max=160, w=Math.min(max,pending.width||max),h=w*(pending.height||70)/(pending.width||max);
  addAnnotation({type:'image',x:p.x,y:p.y-h,w,h,dataUrl:pending.dataUrl});setTool('select');return;
 }
 if(['rect','highlight','white'].includes(state.tool)){
  state.pointer={type:'drawRect',start:p,preview:{type:state.tool,x:p.x,y:p.y,w:0,h:0,color:$('fontColor').value}};return;
 }
 if(state.tool==='pen'){snapshot();const a={type:'pen',id:uid(),points:[p],color:$('fontColor').value||'#b91c39',width:2};m.annotations.push(a);state.pointer={type:'pen',id:a.id};state.selectedId=a.id;drawMarkup();return}
}
function pointerMove(e){if(!state.pointer||!currentPage())return;const p=getPointer(e),f=state.pointer;
 if(f.type==='move'){
  const a=currentPage().annotations.find(x=>x.id===f.id);if(!a)return;
  const dx=p.x-f.start.x,dy=p.y-f.start.y;
  if(Math.abs(dx)+Math.abs(dy)>.5){if(!f.changed){snapshot();f.changed=true}a.x=f.initial.x+dx;a.y=f.initial.y+dy;if(a.type==='pen')a.points=f.initial.points.map(q=>({x:q.x+dx,y:q.y+dy}));drawMarkup()}
 }else if(f.type==='drawRect'){f.preview.w=p.x-f.start.x;f.preview.h=p.y-f.start.y;drawMarkup()}
 else if(f.type==='pen'){const a=currentPage().annotations.find(x=>x.id===f.id);if(a){a.points.push(p);drawMarkup()}}
}
function pointerUp(e){if(!state.pointer)return;const f=state.pointer;
 if(f.type==='drawRect'&&Math.abs(f.preview.w)>2&&Math.abs(f.preview.h)>2){state.pointer=null;addAnnotation(f.preview)}
 else {state.pointer=null;drawMarkup()}
}
function updateProps(){
 const a=selected(),isText=a?.type==='text';
 for(const id of ['textEditor','fontFamily','fontSize','sizeMinusBtn','sizePlusBtn','fontColor','boldBtn','italicBtn','textAlign'])$(id).disabled=!isText;
 for(const id of ['deleteObjectBtn','moveLeftBtn','moveUpBtn','moveRightBtn','moveDownBtn'])$(id).disabled=!a;
 if(isText){$('textEditor').value=a.text;$('fontFamily').value=a.font||'Arial';$('fontSize').value=a.size||16;$('fontColor').value=a.color||'#142642';$('textAlign').value=a.align||'left';$('boldBtn').classList.toggle('active',!!a.bold);$('italicBtn').classList.toggle('active',!!a.italic)}
 else{$('textEditor').value='';$('boldBtn').classList.remove('active');$('italicBtn').classList.remove('active')}
 $('propertyIntro').querySelector('h3').textContent=a?(isText?'Texto seleccionado':a.type==='image'?'Imagen seleccionada':'Elemento seleccionado'):'Texto y formato';
 $('propertyIntro').querySelector('p').textContent=a?(isText?'Puedes editar su contenido, fuente, tamaño y posición.':'Arrastra el elemento para moverlo. También puedes usar las flechas para ajustar su posición.'):'Añade texto o selecciona una línea existente para editarla visualmente. Ajusta el tamaño con + y −.';
}
function updateAnnotation(fn){const a=selected();if(!a)return;snapshot();fn(a);drawMarkup();updateProps()}
function deleteSelected(){const m=currentPage();if(!m||!state.selectedId)return;snapshot();m.annotations=m.annotations.filter(a=>a.id!==state.selectedId);state.selectedId=null;updateProps();drawMarkup()}
function changePage(method){if(!currentPage())return;snapshot();const m=currentPage();if(method==='left')m.rotate=mod(m.rotate-90,360);if(method==='right')m.rotate=mod(m.rotate+90,360);
 if(method==='dup'){const c=JSON.parse(JSON.stringify(m));c.id=uid();c.annotations.forEach(a=>a.id=uid());state.pages.splice(state.current+1,0,c);state.current++}
 if(method==='del'){state.pages.splice(state.current,1);state.current=Math.min(state.current,state.pages.length-1)}
 if(method==='up'&&state.current>0){[state.pages[state.current-1],state.pages[state.current]]=[state.pages[state.current],state.pages[state.current-1]];state.current--}
 if(method==='down'&&state.current<state.pages.length-1){[state.pages[state.current+1],state.pages[state.current]]=[state.pages[state.current],state.pages[state.current+1]];state.current++}
 state.selectedId=null;refresh()}
async function addBlank(){if(!await needLibrary())return;const doc=await PDFLib.PDFDocument.create();doc.addPage([595.28,841.89]);const raw=await doc.save();const file=new File([raw],'Página en blanco.pdf',{type:'application/pdf'});await importPDF(file,true)}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function saveOriginal(){const model=currentPage();if(!model)return;const s=state.sources.get(model.sourceId);download(new Blob([s.bytes.slice(0)],{type:'application/pdf'}),s.name);toast('Descargado el PDF original sin modificar sus bytes.')}
async function beginSave(){if(!state.pages.length||state.busy)return;const signed=[...state.sources.values()].some(s=>s.signature.potentiallySigned);
 if(signed){showDialog($('confirmEditDialog'));return}
 await saveEdited()}
async function saveEdited(){if(state.busy)return;try{state.busy=true;$('saveBtn').disabled=true;status('Preparando PDF...');const result=await EditaditoPDFEngine.exportPDF(state.pages,state.sources,state.customFont,(i,n)=>status('Exportando página '+i+' de '+n));const source=currentPage()?state.sources.get(currentPage().sourceId):null;
 const base=(source?.name||'documento').replace(/\.pdf$/i,'').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g,'_');download(result,base+'_EDITADITO.pdf');status('Documento exportado');toast('PDF editado descargado correctamente.');
 }catch(err){console.error(err);toast('Error al guardar: '+err.message,true);status('Error en la exportación')}finally{state.busy=false;$('saveBtn').disabled=!state.pages.length}}
async function loadImage(file){if(!file)return;if(!/^image\/(png|jpeg)$/.test(file.type)){toast('Usa una imagen PNG o JPG.',true);return}const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});const img=new Image();img.onload=()=>{state.pendingImage={dataUrl:url,width:img.naturalWidth,height:img.naturalHeight};setTool('image');toast('Imagen lista. Haz clic en la página para insertarla.')};img.src=url}
async function loadFont(file){if(!file)return;if(!/\.(ttf|otf)$/i.test(file.name)){toast('La fuente debe ser .ttf u .otf.',true);return}
 if(!window.fontkit){status('Preparando fuentes personalizadas...');const ok=await EditaditoDependencies.loadFontkit();if(!ok){toast('No se pudo cargar el módulo de fuentes. Comprueba tu conexión.',true);status('Fallo al cargar fuente');return}}
 const bytes=await file.arrayBuffer();let family=file.name.replace(/\.(ttf|otf)$/i,'');
 const known=['Arial','Calibri','Verdana','Times New Roman','Georgia','Tahoma','Trebuchet MS','Courier New','Comic Sans MS','Impact'];
 const byName=known.find(n=>family.toLowerCase().replace(/[-_ ]/g,'').startsWith(n.toLowerCase().replace(/ /g,'')));
 if(byName)family=byName;else{$('fontFamily').append(new Option(family,family))}
 state.customFont={family,bytes};
 try{const face=new FontFace(family,bytes.slice(0));await face.load();document.fonts.add(face);drawMarkup()}catch(error){console.warn('Vista previa de fuente no disponible:',error)}
 $('customFontLabel').textContent='✓ Fuente importada: '+file.name+' (familia: '+family+'). Se incrustará al exportar textos con esta familia.';
 toast('Fuente '+family+' importada. Selecciónala para tus textos.');
}
let drawingSignature=false;
function initializeSignPad(){const c=$('signaturePad'),ctx=c.getContext('2d');ctx.strokeStyle='#173f70';ctx.lineWidth=2.8;ctx.lineCap='round';ctx.lineJoin='round';
 function p(e){const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}
 c.addEventListener('pointerdown',e=>{drawingSignature=true;c.setPointerCapture(e.pointerId);const v=p(e);ctx.beginPath();ctx.moveTo(v.x,v.y)});
 c.addEventListener('pointermove',e=>{if(!drawingSignature)return;const v=p(e);ctx.lineTo(v.x,v.y);ctx.stroke()});
 c.addEventListener('pointerup',()=>drawingSignature=false);c.addEventListener('pointercancel',()=>drawingSignature=false);
 $('clearSignBtn').onclick=()=>ctx.clearRect(0,0,c.width,c.height);
 $('addSignBtn').onclick=()=>{const dataUrl=c.toDataURL('image/png');state.signData={dataUrl,width:c.width,height:c.height};$('signDialog').close();setTool('signature');toast('Firma visual lista. Haz clic en la página para colocarla.')};
}
function events(){
 $('openBtn').onclick=$('startBtn').onclick=()=>$('fileInput').click();
 $('dropZone').onclick=e=>{if(e.target.closest('button'))return;$('fileInput').click()};
 $('dropZone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click()}};
 $('fileInput').onchange=async e=>{await importPDF(e.target.files[0],false);e.target.value=''};
 $('exampleBtn').onclick=async ()=>{
   try{
     const b=atob(window.EditaditoDemoPDF||'');
     const bytes=Uint8Array.from(b,c=>c.charCodeAt(0));
     await importPDF(new File([bytes],'PDF_DE_PRUEBA.pdf',{type:'application/pdf'}),false);
   }catch(err){toast('No se pudo abrir el ejemplo: '+err.message,true)}
 };
 $('retryLibraryBtn').onclick=async ()=>{
   $('retryLibraryBtn').classList.add('hidden');
   await needLibrary();
 };
 $('addPdfBtn').onclick=()=>$('addPdfInput').click();
 $('addPdfInput').onchange=async e=>{for(const f of e.target.files)await importPDF(f,true);e.target.value=''};
 $('imageInput').onchange=e=>{loadImage(e.target.files[0]);e.target.value=''};
 $('fontInput').onchange=e=>{loadFont(e.target.files[0]);e.target.value=''};
 $('importFontBtn').onclick=()=>$('fontInput').click();
 $('addBlankBtn').onclick=addBlank;
 all('[data-tool]').forEach(b=>b.onclick=()=>{setTool(b.dataset.tool)});
 $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
 [['rotateLeftBtn','left'],['rotateRightBtn','right'],['duplicatePageBtn','dup'],['deletePageBtn','del'],['pageUpBtn','up'],['pageDownBtn','down']].forEach(([id,m])=>$(id).onclick=()=>changePage(m));
 $('zoomOutBtn').onclick=()=>{state.zoom=Math.max(.35,Math.round((state.zoom-.1)*10)/10);renderPage()};
 $('zoomInBtn').onclick=()=>{state.zoom=Math.min(2.5,Math.round((state.zoom+.1)*10)/10);renderPage()};
 $('originalBtn').onclick=saveOriginal;$('saveBtn').onclick=beginSave;
 $('signatureInfoBtn').onclick=$('reviewSignaturesBtn').onclick=()=>showDialog($('signatureDialog'));
 $('closeSignatureDialog').onclick=$('closeSignatureDialog2').onclick=()=>$('signatureDialog').close();
 $('downloadOriginalFromDialog').onclick=()=>{$('signatureDialog').close();saveOriginal()};
 $('cancelSignedExport').onclick=()=>{$('confirmEditDialog').close();saveOriginal()};
 $('confirmSignedExport').onclick=()=>{$('confirmEditDialog').close();saveEdited()};
 $('closeSignDialog').onclick=()=>$('signDialog').close();
 $('textEditor').addEventListener('input',e=>{const a=selected();if(a?.type==='text'){if(!e.target.dataset.editing){snapshot();e.target.dataset.editing='1'}a.text=e.target.value;drawMarkup()}});
 $('textEditor').addEventListener('blur',e=>{delete e.target.dataset.editing});
 $('fontFamily').onchange=e=>updateAnnotation(a=>a.font=e.target.value);
 $('fontSize').onchange=e=>changeFontSize(Number(e.target.value));
 $('sizeMinusBtn').onclick=()=>changeFontSize((Number(selected()?.size)||16)-1);
 $('sizePlusBtn').onclick=()=>changeFontSize((Number(selected()?.size)||16)+1);
 $('fontColor').onchange=e=>updateAnnotation(a=>a.color=e.target.value);
 $('boldBtn').onclick=()=>updateAnnotation(a=>a.bold=!a.bold);
 $('italicBtn').onclick=()=>updateAnnotation(a=>a.italic=!a.italic);
 $('textAlign').onchange=e=>updateAnnotation(a=>a.align=e.target.value);
 [['moveLeftBtn',-1,0],['moveRightBtn',1,0],['moveUpBtn',0,1],['moveDownBtn',0,-1]].forEach(([id,x,y])=>$(id).onclick=()=>updateAnnotation(a=>{a.x=(a.x||0)+x;a.y=(a.y||0)+y;if(a.type==='pen')a.points=a.points.map(p=>({x:p.x+x,y:p.y+y}))}));
 $('deleteObjectBtn').onclick=deleteSelected;
 els.overlay.addEventListener('pointerdown',pointerDown);els.overlay.addEventListener('pointermove',pointerMove);els.overlay.addEventListener('pointerup',pointerUp);els.overlay.addEventListener('pointercancel',pointerUp);
 for(const target of [document.body,$('dropZone')]){target.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();$('dropZone').classList.add('is-dragover')}});target.addEventListener('dragleave',e=>{if(!e.relatedTarget||!document.body.contains(e.relatedTarget))$('dropZone').classList.remove('is-dragover')});target.addEventListener('drop',async e=>{if(!e.dataTransfer?.files?.length)return;e.preventDefault();e.stopPropagation();$('dropZone').classList.remove('is-dragover');const files=[...e.dataTransfer.files].filter(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));for(let i=0;i<files.length;i++)await importPDF(files[i],i>0)})}
 document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,dialog'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();beginSave()}if(['Delete','Backspace'].includes(e.key)&&selected())deleteSelected();if(e.key==='Escape'&&state.selectedId){state.selectedId=null;updateProps();drawMarkup()}});
 initializeSignPad();
}
function changeFontSize(n){if(!Number.isFinite(n))return;updateAnnotation(a=>a.size=Math.min(180,Math.max(4,n)))}
function initialize(){
 events();setTool('select');refresh();
 setLibraryStatus('Cargando herramientas…',false);
 needLibrary().then(ok=>{if(ok)status('Listo para abrir PDF');else status('Sin bibliotecas PDF: usa Reintentar')});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
