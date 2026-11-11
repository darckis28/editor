# Editadito PRO — Editor PDF para GitHub y Netlify

**Proyecto estático, en español, sin backend**, que procesa archivos PDF en el navegador.

## Cómo instalarlo

1. Descomprime `editadito-pro.zip`.
2. Mantén juntos `index.html`, `styles.css` y la carpeta `js` (no cambies sus rutas).
3. Crea un repositorio en GitHub y sube **el contenido** de la carpeta `editadito-pro` a la raíz del repositorio.
4. En Netlify, importa el repositorio o arrastra la carpeta descomprimida a **Netlify Drop**.
5. Abre la URL de tu nuevo sitio. No requiere clave API ni servidor.

### Si quieres probarlo localmente

En la carpeta del proyecto ejecuta:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000` en el navegador. **Necesita internet para cargar las bibliotecas PDF** (PDF.js, pdf-lib y fontkit) desde sus CDN.

## Funciones

- Abrir archivos PDF y arrastrarlos a la aplicación.
- Navegar por páginas, ver miniaturas, ampliar/reducir vista.
- **Seleccionar líneas existentes de texto de PDF digitales** y realizar un reemplazo **visual**. Un escaneo sin OCR no tiene texto seleccionable.
- Insertar y mover texto nuevo, ajustar la **fuente** y los puntos mediante `+` / `−` (4 a 180 pt), cambiar color, negrita, cursiva, alineación y moverlo con flechas ↑ ↓ ← →.
- Fuentes de interfaz: Arial, Calibri, Verdana, Times New Roman, Georgia, Tahoma, Trebuchet MS, Courier New, Comic Sans MS, Impact y Helvetica.
- Importar una fuente `.ttf` / `.otf` propia para incorporarla al PDF final. Para **Arial real**, importa un archivo de fuente Arial que tengas derecho a usar. Las fuentes no importadas utilizan las alternativas estándar más cercanas de PDF, como Helvetica, Times y Courier.
- Añadir imágenes PNG/JPEG, formas, resaltados, trazos a mano, coberturas blancas y firmas **visuales**.
- Girar, eliminar, duplicar, reordenar páginas con arrastrar y soltar y combinarlas con otro PDF. Añadir hoja en blanco.
- Deshacer/rehacer, descargar la copia editada.
- Detectar **indicios** de firmas digitales PDF: estructuras `/ByteRange`, `/FT /Sig`, `/Type /Sig`, DocMDP. Inspeccionar resultados y descargar el **original byte a byte intacto**.
- Confirmación obligatoria al exportar un documento que parece estar firmado: muestra advertencia explícita de que la firma podría quedar inválida.

## Sobre las firmas digitales (importante)

Una firma digital con certificado normalmente abarca rangos exactos de bytes del PDF. Editar el documento, reordenar páginas, unir, dibujar encima y guardarlo de nuevo cambia sus bytes y por tanto **puede invalidar la firma, aunque su apariencia visual siga presente**. El programa **no puede conservar la validez criptográfica de una firma después de esas modificaciones**.

- **Descargar original intacto**: descarga el archivo original sin tocar un solo byte. Esto conserva el estado de las firmas del archivo que ingresó (no certifica que fueran válidas previamente).
- **Guardar PDF editado**: produce un archivo nuevo. Si hay indicios de firmas, exige elegir expresamente que se acepta exportar una copia que podría tener firmas inválidas.
- La inspección es **heurística**; no comprueba criptográficamente el certificado, la cadena de confianza, la revocación ni la validez de la firma. Valida oficialmente con un verificador PDF confiable o el sistema correspondiente.
- **Firma visual** dibujada sobre el documento no es una firma digital con certificado.

## Limitaciones técnicas

- La función **Editar texto** superpone un rectángulo blanco y texto nuevo sobre la línea seleccionada: el texto original permanece internamente en el PDF y podría recuperarse o copiarse. No uses la herramienta *Cubrir* ni el reemplazo visual como redacción/anonimización segura.
- No realiza OCR: escaneos son imágenes.
- En PDFs protegidos por contraseña puede haber restricciones de apertura/edición.
- Documentos PDF complejos (fuentes personalizadas existentes, formulación, transparencias, rotaciones, capas o anotaciones) pueden requerir validación visual después de guardar.
- La firma digital podría no detectarse si utiliza una estructura PDF no reconocida. La detección **no constituye verificación**.
- Para documentos confidenciales: el código procesa el archivo en el navegador; las bibliotecas se sirven de CDN. Si tu política requiere estricta independencia de terceros, aloja también los tres JavaScript de dependencias dentro del mismo dominio.

## Estructura

```
editadito-pro/
├─ index.html
├─ styles.css
├─ js/
│  ├─ app.js           # UI y herramientas interactivas
│  ├─ pdf-engine.js    # Guardar y exportar PDF
│  └─ signatures.js    # Revisión de estructuras de firmas
└─ README.md
```

## Dependencias

- PDF.js 3.11.174 — visor, lectura de texto y renderizado.
- pdf-lib 1.17.1 — combinación, páginas y guardado.
- @pdf-lib/fontkit 1.1.1 — fuentes TTF/OTF importadas.

Estas bibliotecas se cargan desde las URLs especificadas en `index.html` y no vienen empaquetadas en el ZIP.

## Aviso

Proyecto independiente inspirado en un editor PDF sencillo. **No es una copia del código fuente original** de `editadito.netlify.app`, que no estaba disponible para consultar. Se puede extender y adaptar libremente en tus propios archivos.
