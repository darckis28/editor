/* Detección orientativa de firmas PDF; NO es una validación criptográfica. */
(function(global){
  'use strict';
  function inspect(arrayBuffer){
    const data=new Uint8Array(arrayBuffer);
    let binary='';
    // Latin1 preserva la correspondencia 1 byte = 1 carácter para analizar tokens PDF.
    const step=32768;
    for(let i=0;i<data.length;i+=step){binary+=String.fromCharCode(...data.subarray(i,i+step));}
    const byteRanges=[];
    const expr=/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
    let match;
    while((match=expr.exec(binary))!==null){
      const nums=match.slice(1).map(Number);
      byteRanges.push({ranges:nums,coverageEndsAt:nums[2]+nums[3],appearsToCoverFinalRevision:nums[2]+nums[3]===data.byteLength});
    }
    const fieldCount=(binary.match(/\/FT\s*\/Sig\b/g)||[]).length;
    const sigDicts=(binary.match(/\/Type\s*\/Sig\b/g)||[]).length;
    const docMDP=/\/DocMDP\b/.test(binary);
    const sigFlags=/\/SigFlags\s+[1-9]/.test(binary);
    return {
      signed:byteRanges.length>0,
      potentiallySigned:byteRanges.length>0||sigDicts>0,
      signatureCount:byteRanges.length,
      signatureFieldCount:fieldCount,
      signatureDictionaryCount:sigDicts,
      emptySignatureFields:Math.max(0,fieldCount-byteRanges.length),
      docMDP,
      sigFlags,
      byteRanges,
      byteLength:data.byteLength,
      warning:'Detección por estructuras PDF (/ByteRange, /FT /Sig). No se valida el certificado ni la firma criptográfica.'
    };
  }
  global.EditaditoSignatures={inspect};
})(window);
