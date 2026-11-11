/* Dependencias: PDF.js, pdf-lib. Toda la edición y exportación se ejecutan localmente. */
(function(global){
  'use strict';
  function color(hex){
    const h=(hex||'#202a39').replace('#','');
    const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);
    return PDFLib.rgb(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255);
  }
  function standardFont(family,bold,italic){
    const f=(family||'Arial').toLowerCase();
    let type='helvetica';
    if(f.includes('times')||f.includes('georgia'))type='times';
    else if(f.includes('courier'))type='courier';
    if(type==='times')return bold?(italic?PDFLib.StandardFonts.TimesRomanBoldItalic:PDFLib.StandardFonts.TimesRomanBold):(italic?PDFLib.StandardFonts.TimesRomanItalic:PDFLib.StandardFonts.TimesRoman);
    if(type==='courier')return bold?(italic?PDFLib.StandardFonts.CourierBoldOblique:PDFLib.StandardFonts.CourierBold):(italic?PDFLib.StandardFonts.CourierOblique:PDFLib.StandardFonts.Courier);
    return bold?(italic?PDFLib.StandardFonts.HelveticaBoldOblique:PDFLib.StandardFonts.HelveticaBold):(italic?PDFLib.StandardFonts.HelveticaOblique:PDFLib.StandardFonts.Helvetica);
  }
  async function dataUrlBytes(dataUrl){
    const str=atob(dataUrl.substring(dataUrl.indexOf(',')+1));
    const bytes=new Uint8Array(str.length);
    for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);
    return bytes;
  }
  async function exportPDF(pages,sources,customFont,progress){
    if(!global.PDFLib)throw Error('No se cargó la biblioteca pdf-lib. Verifica tu conexión a internet.');
    if(!pages.length)throw Error('No hay páginas para guardar.');
    const target=await PDFLib.PDFDocument.create();
    target.setProducer('Editadito PRO · Editor PDF local');
    const loaded=new Map(),fonts=new Map(),embeddedImages=new Map();
    if(customFont&&global.fontkit)target.registerFontkit(global.fontkit);
    for(const model of pages){
      if(!loaded.has(model.sourceId)){
        const source=sources.get(model.sourceId);
        loaded.set(model.sourceId,await PDFLib.PDFDocument.load(source.bytes.slice(0),{updateMetadata:false}));
      }
    }
    async function getFont(item){
      const key=[item.font||'Arial',!!item.bold,!!item.italic].join('|');
      if(fonts.has(key))return fonts.get(key);
      let font;
      if(customFont&&item.font===customFont.family&&global.fontkit){
        font=await target.embedFont(customFont.bytes.slice(0),{subset:true});
      }else{
        font=await target.embedFont(standardFont(item.font,item.bold,item.italic));
      }
      fonts.set(key,font);return font;
    }
    async function getImage(item){
      if(embeddedImages.has(item.dataUrl))return embeddedImages.get(item.dataUrl);
      const bytes=await dataUrlBytes(item.dataUrl);
      const result=item.dataUrl.startsWith('data:image/jpeg')?await target.embedJpg(bytes):await target.embedPng(bytes);
      embeddedImages.set(item.dataUrl,result);
      return result;
    }
    for(let p=0;p<pages.length;p++){
      if(progress)progress(p+1,pages.length);
      const model=pages[p];
      const src=loaded.get(model.sourceId);
      const [page]=await target.copyPages(src,[model.pageNo-1]);
      target.addPage(page);
      const baseAngle=page.getRotation().angle||0;
      page.setRotation(PDFLib.degrees(((baseAngle+model.rotate)%360+360)%360));
      for(const a of model.annotations){
        if(a.type==='text'){
          const f=await getFont(a);
          const size=Number(a.size)||16;
          const lines=String(a.text||' ').split('\n');
          const lineH=size*1.3;
          if(a.mask){
            page.drawRectangle({x:a.x-1,y:a.y-3-(lines.length-1)*lineH,width:Math.max(4,a.maskWidth||70),height:Math.max(size+6,a.maskHeight||size+6)+(lines.length-1)*lineH,color:PDFLib.rgb(1,1,1)});
          }
          lines.forEach((line,index)=>{
            try{
              const s=line||' ';
              const textWidth=f.widthOfTextAtSize(s,size);
              let x=a.x;
              if(a.align==='center')x-=textWidth/2;
              else if(a.align==='right')x-=textWidth;
              page.drawText(s,{x,y:a.y-index*lineH,size,font:f,color:color(a.color),opacity:1});
            }catch(err){throw new Error('No se pudo exportar el texto «'+line.substring(0,30)+'»; prueba otra fuente o importa una fuente TTF compatible. '+err.message);}
          });
        }else if(a.type==='rect'||a.type==='highlight'||a.type==='white'){
          const x=Math.min(a.x,a.x+a.w),y=Math.min(a.y,a.y+a.h),w=Math.abs(a.w),h=Math.abs(a.h);
          if(w<1||h<1)continue;
          page.drawRectangle({x,y,width:w,height:h,color:color(a.type==='white'?'#ffffff':a.type==='highlight'?'#ffe100':a.color),opacity:a.type==='highlight'?.35:1,borderColor:a.type==='rect'?color(a.color):undefined,borderWidth:a.type==='rect'?1:0});
        }else if(a.type==='image'&&a.dataUrl){
          const img=await getImage(a);
          page.drawImage(img,{x:a.x,y:a.y,width:a.w,height:a.h});
        }else if(a.type==='pen'){
          const pts=a.points||[];
          for(let i=1;i<pts.length;i++)page.drawLine({start:pts[i-1],end:pts[i],thickness:a.width||2,color:color(a.color)});
        }
      }
    }
    const result=await target.save({useObjectStreams:false});
    return new Blob([result],{type:'application/pdf'});
  }
  global.EditaditoPDFEngine={exportPDF,standardFont};
})(window);
