import { mkdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const files = [
  ['node_modules/pdfjs-dist/build/pdf.min.js', 'vendor/pdf.min.js'],
  ['node_modules/pdfjs-dist/build/pdf.worker.min.js', 'vendor/pdf.worker.min.js'],
  ['node_modules/pdf-lib/dist/pdf-lib.min.js', 'vendor/pdf-lib.min.js'],
  ['node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js', 'vendor/fontkit.umd.min.js']
];
await mkdir('vendor', { recursive:true });
for (const [src, dst] of files) {
  try {
    const input=await stat(src);
    if (!input.size) throw Error('archivo vacío');
    await copyFile(src, dst);
    const output=await stat(dst);
    console.log(`✓ ${dst} (${Math.ceil(output.size / 1024)} KB)`);
  } catch (error) {
    console.error(`No se puede empaquetar ${src}: ${error.message}`);
    console.error('Ejecuta primero: npm install --omit=optional');
    process.exitCode = 1;
    break;
  }
}
