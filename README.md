# Editadito PRO v2.2 — Preparado para Netlify

## Qué se ha corregido

La versión anterior ejecutaba `node scripts/prepare-vendor.mjs`, pero Netlify no encontraba ese archivo en tu repositorio. En esta versión **el comando `npm run build` está definido por completo en `package.json`**, sin depender de ninguna carpeta `scripts/`.

Netlify instala las dependencias y copia el editor y las bibliotecas PDF reales a **`dist/`**, que es la carpeta publicada. No se publica `node_modules/`.

## Cómo actualizar tu repositorio

1. Descomprime `editadito-pro-v2-2-netlify.zip`.
2. Abre el repositorio en GitHub y **sube todo el contenido del ZIP directamente a la raíz**. `package.json`, `netlify.toml` e `index.html` deben estar en el mismo nivel; la carpeta `js` debe conservarse.
3. **Reemplaza** los antiguos `package.json`, `netlify.toml`, `index.html`, `styles.css` y archivos JS. Si aún existe la carpeta `scripts/` anterior puedes quitarla, pues no se utiliza.
4. Confirma los cambios con **Commit changes**.
5. En Netlify abre **Deploys → Trigger deploy → Clear cache and deploy site** (los nombres pueden variar).
6. En el registro de compilación deben aparecer las líneas `✓ pdf.min.js`, `✓ pdf.worker.min.js`, `✓ pdf-lib.min.js`, `✓ fontkit.umd.min.js` y `✓ Compilación completada: carpeta dist/`.
7. En la web publicada, verifica `✓ Herramientas PDF listas` y pulsa **Probar con PDF de ejemplo**.

### Configuración de Netlify

- **Base directory:** vacío / raíz del repositorio.
- **Build command:** `npm run build`.
- **Publish directory:** `dist`.

La configuración `netlify.toml` ya define los dos últimos valores. No subas el ZIP sin descomprimir si lo que quieres es compilar mediante GitHub.

## Prueba local (con acceso a npm)

```bash
npm install
npm run build
npx serve dist
```

Abre la dirección que muestre el servidor.

## Funciones principales

- Abrir y visualizar PDFs, miniaturas, zoom, arrastrar y soltar.
- Añadir texto y reemplazarlo visualmente, fuentes (Arial y otras), botones +/−, negrita, cursiva y mover con flechas.
- Agregar imágenes y una firma visual, resaltar, dibujar, cubrir.
- Reordenar, duplicar, rotar, eliminar y combinar páginas.
- Inspección preliminar de indicios de firmas digitales y descarga del original intacto.

**Firmas digitales:** modificar y guardar de nuevo un PDF con firma certificada puede invalidar la firma criptográfica. La app nunca garantiza que la firma siga válida después de editar. Su opción «Original intacto» conserva el archivo sin modificaciones.

**Edición visual:** cubrir o reemplazar texto no elimina los datos internos del PDF; no lo uses para ocultar información confidencial.

## Qué se pudo verificar en este entorno

- Sintaxis de los archivos JavaScript con `node --check`.
- Compilación del empaquetador con una instalación local simulada de las dependencias, para verificar rutas, archivos producidos y salida `dist/`.
- El ZIP entrega `index.html`, `package.json` y `netlify.toml` directamente en la raíz.

**Limitación:** este entorno no puede descargar paquetes de npm, de modo que no se pudo ejecutar un despliegue Netlify real ni comprobar con las versiones reales de PDF.js y pdf-lib. Se requiere la compilación en Netlify para confirmar el procesamiento de PDFs reales.
