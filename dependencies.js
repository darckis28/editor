/* Editadito PRO — cargador de dependencias con proveedores alternativos. */
(function(root) {
  'use strict';
  const deps = [
    {
      name:'PDF.js', global:'pdfjsLib',
      urls:[
        './vendor/pdf.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
      ]
    },
    {
      name:'pdf-lib', global:'PDFLib',
      urls:[
        './vendor/pdf-lib.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
        'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
        'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'
      ]
    },

  ];
  const fontkitSources=[
    './vendor/fontkit.umd.min.js',
    'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
    'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'
  ];
  const state={ready:false,failed:[],loading:false,progress:'Esperando',workers:[],loaded:{}};
  let running=null;
  function addScript(url,globalName){
    return new Promise((resolve,reject)=>{
      if(root[globalName])return resolve();
      const script=document.createElement('script');
      script.src=url;script.async=true;script.crossOrigin='anonymous';
      const timeout=setTimeout(()=>{cleanup();reject(new Error('Tiempo de espera agotado'))},10000);
      function cleanup(){clearTimeout(timeout);script.onload=null;script.onerror=null}
      script.onload=()=>{cleanup();root[globalName]?resolve():reject(new Error('No se cargó '+globalName))};
      script.onerror=()=>{cleanup();script.remove();reject(new Error('Proveedor no disponible'))};
      document.head.append(script);
    });
  }
  async function load(onProgress,force=false){
    if(state.ready&&!force)return state;
    if(running)return running;
    running=(async()=>{
      state.loading=true;state.failed=[];
      for(const dep of deps){
        state.progress='Cargando '+dep.name;
        onProgress?.(state.progress);
        if(root[dep.global])continue;
        let ok=false;
        for(const url of dep.urls){
          try{
            await addScript(url,dep.global);
            state.loaded[dep.global]=url;ok=true;break;
          }catch(err){console.warn('Editadito PRO:',dep.name,url,err.message)}
        }
        if(!ok){state.failed.push(dep.name);if(!dep.optional)console.error('Falta la biblioteca '+dep.name)}
      }
      state.ready=!!root.pdfjsLib&&!!root.PDFLib;
      if(root.pdfjsLib){
        const src=state.loaded.pdfjsLib||deps[0].urls[0];
        const worker=src.replace(/pdf(?:\.min)?\.js(?:\?.*)?$/,'pdf.worker.min.js');
        root.pdfjsLib.GlobalWorkerOptions.workerSrc=worker;
        state.workers=[worker,
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'];
      }
      state.progress=state.ready?'Editor preparado':'No fue posible cargar las bibliotecas de PDF';
      onProgress?.(state.progress);
      return state;
    })();
    try{return await running}finally{state.loading=false;running=null}
  }
  async function loadFontkit(){
    if(root.fontkit)return true;
    for(const url of fontkitSources){
      try{await addScript(url,'fontkit');return true}catch(err){console.warn('Fuente personalizada:',err.message)}
    }
    return false;
  }
  root.EditaditoDependencies={load,loadFontkit,state};
})(window);
