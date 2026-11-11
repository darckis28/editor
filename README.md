# Editadito PRO 2.1 — Editor PDF

Editor PDF en español, de uso local en el navegador. Incluye ejemplos para pruebas, edición visual, formatos de texto, organización de páginas y detección orientativa de firmas digitales.

## ¿Qué se corrigió?

La versión anterior intentaba usar bibliotecas JavaScript de dos CDN sin alternativa y, si fallaban, **no podía abrir PDF**.

Esta versión incorpora:

1. Un cargador con varios proveedores como respaldo.
2. Dependencias locales instalables con `npm` para que **Netlify publique las bibliotecas PDF dentro de tu propio sitio**, sin requerir conexión del navegador a un CDN.
3. Aviso visible de carga fallida y botón «Reintentar».
4. Botón «Probar con PDF de ejemplo» para probar controles sin buscar un archivo externo.

## Publicar en Netlify desde GitHub — RECOMENDADO

1. Descomprime `editadito-pro-v2-1.zip`.
2. En GitHub, sube **el contenido de la carpeta** `editadito-pro` a un repositorio, incluida la carpeta `scripts`, `package.json`, `index.html`, `styles.css`, `netlify.toml` y `js`.
3. En Netlify, elige **Add new project → Import an existing project → GitHub**; elige tu repositorio.
4. La configuración `netlify.toml` ejecutará `npm run build` y publicará la carpeta raíz. Netlify instalará primero las dependencias npm del proyecto.
5. Espera a que el despliegue termine con estado **Published** y abre la URL de Netlify.
6. En la página, verifica que se lea **✓ Herramientas PDF listas** y pulsa **Probar con PDF de ejemplo**.

**Importante:** no subas simplemente el ZIP sin preparar a Netlify Drop esperando que contenga todo. Para garantizar la carga local de las bibliotecas, Netlify debe ejecutar el build, o debes hacerlo tú antes de subir la carpeta compilada.

## Probarlo localmente en Windows / Mac / Linux

Necesitas Node.js 20 o superior y Python 3 (o cualquier servidor HTTP estático).

Abre la terminal **dentro de `editadito-pro`**, ejecuta:

```bash
npm install --omit=optional
npm run build
python -m http.server 8000
```

Abre **http://localhost:8000** en Chrome o Edge. Comprueba el mensaje ✓ Herramientas PDF listas. Si la terminal dice que `python` no existe, en Windows puedes usar `py -m http.server 8000` o instalar un servidor HTTP local.

Después de `npm run build` aparecerá la carpeta `vendor` con los archivos necesarios. Estos scripts se sirven desde el mismo sitio, no desde un CDN. `node_modules` no debe subirse a GitHub.

## Pruebas recomendadas

1. **Ejemplo:** pulsa «Probar con PDF de ejemplo»; deben aparecer 2 páginas.
2. **Texto:** pulsa Texto, haz clic en la página, escribe en el panel derecho, cambia Arial por Times New Roman, pulsa + y −, y sube el texto con ↑.
3. **Editar texto existente:** elige «Editar texto» y haz clic en una línea del PDF digital; se crea una **superposición visual editable**. No elimina texto internamente.
4. **Páginas:** duplica, rota, borra y mueve una página; verifica el contador y deshacer/rehacer.
5. **Guardar:** pulsa «Guardar PDF editado»; abre el documento exportado para comprobarlo.
6. **Firmas:** si abres un PDF con indicios de firma, habrá una advertencia. «Original intacto» descarga los bytes originales sin cambios.

## Funcionalidades

- Abrir PDF, ver páginas y miniaturas, ampliar/reducir.
- Añadir texto; cambiar familia tipográfica, tamaño en puntos (+/−), negrita, cursiva, color, alineación, y posición con las flechas.
- Fuentes: Arial, Calibri, Times New Roman, Georgia, Verdana, Tahoma, Trebuchet MS, Courier New, Comic Sans MS, Helvetica, Impact. Para **Arial real incrustada**, importar una fuente .ttf/.otf con derechos de uso. Si no se importa, el PDF usa una fuente estándar aproximada.
- Seleccionar texto ya existente de PDFs que contienen texto digital y reemplazarlo **solo visualmente**.
- Añadir imágenes, dibujar, cubrir, resaltar y agregar firma **visual** (no digital certificada).
- Combinar, reordenar, duplicar, rotar, eliminar páginas y añadir páginas en blanco.
- Deshacer/rehacer, descargar PDF editado y descargar el original.
- Detectar indicios de firma digital PDF por marcadores como `/ByteRange`, `/FT /Sig`, `/Type /Sig` y `/DocMDP`.

## Firmas digitales y seguridad

**No es posible garantizar que una firma digital con certificado siga siendo válida después de editar el PDF.** Una firma suele proteger bytes exactos del documento. La exportación editada reconstruye el archivo y puede invalidar firmas, aunque la imagen de la firma siga visible. El editor advierte de ello y te permite descargar el **original sin alterar un byte**. No realiza validación criptográfica, ni valida certificados, cadenas de confianza, revocación o sellos de tiempo.

La función «Cubrir» y el reemplazo de texto son **visuales**. No eliminan la información subyacente y no son un método seguro de anonimización.

Los PDF permanecen en la memoria local del navegador; no hay un backend propio que reciba su contenido. El navegador solo necesita obtener las bibliotecas JavaScript de la misma web después del build.

## Qué se ha probado y qué falta

- Sintaxis JS validada con `node --check`.
- Interacciones de apertura, dibujo de texto, controles de fuente, movimiento, páginas, deshacer y evento de descarga probados con Playwright y **bibliotecas PDF simuladas**.
- Con un archivo de prueba que contenía marcadores estructurales de firma, se verificó la alerta, la confirmación antes de exportar y que la descarga del original es idéntica byte a byte.
- Los PDF reales del proyecto de ejemplo se generaron y validaron con herramientas Python.

**Limitación de esta verificación:** el entorno de pruebas restringe tanto las descargas de los CDN como la instalación de paquetes npm. Por eso no se pudo ejecutar una prueba de integración de extremo a extremo con PDF.js + pdf-lib reales ni verificar el despliegue en Netlify. La primera prueba completa debe hacerse en el sitio compilado con las dependencias locales.

## Estructura

```text
editadito-pro/
  index.html
  styles.css
  js/
    app.js
    demo.js
    dependencies.js
    signatures.js
    pdf-engine.js
  scripts/
    prepare-vendor.mjs
  package.json
  netlify.toml
  README.md
  vendor/                 (se llena en npm run build)
```

Proyecto independiente. No es una réplica del código fuente de `editadito.netlify.app`.
