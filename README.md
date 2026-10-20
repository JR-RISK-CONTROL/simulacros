# Evaluación de Simulacro de Evacuación

App web para diligenciar en el celular el formato **Evaluación de simulacro de evacuación**, con los colores corporativos de Codere Colombia. Funciona sin conexión, guarda el avance en el teléfono y, al terminar, genera:

- **PDF** con las 7 secciones del formato, el registro fotográfico completo y las firmas.
- **Respaldo JSON** con todos los datos, fotos y firmas, que se puede importar de nuevo en la app.

Ambos archivos se envían como **adjuntos por WhatsApp o correo** desde el menú para compartir del celular.

## Secciones (iguales al formato)

1. Ficha de registro de la sede (total de personas automático)
2. Matriz de control de tiempos T0–T5, con **cronómetro**: un botón marca cada hito con la hora exacta del celular y calcula los tiempos y el total de evacuación (T4 − T0)
3. Lista de chequeo operativa (SÍ / NO + observación) con % de cumplimiento
4. Registro fotográfico: cámara o galería, sin límite de fotos, con descripción
5. Observaciones y hallazgos
6. Acciones de mejora (Pendiente / En curso / Cerrada)
7. Firmas de validación en pantalla (Comandante del incidente y Observador; se pueden agregar más firmantes)

Incluye además la **guía paso a paso** del simulacro por sismo (ícono de libro) y el botón **Emergencia real**, que deja registrada la hora de suspensión del ejercicio.

## Publicar en GitHub Pages

1. En GitHub, cree un repositorio nuevo (por ejemplo `simulacros`). Puede ser público o privado. Si es privado, GitHub Pages solo está disponible con un plan pago.
2. Toque **Add file → Upload files**, seleccione **todos los archivos de esta carpeta** y confirme con **Commit changes**. Todos los archivos van en la raíz del repositorio, sin subcarpetas, para que se puedan subir también desde el celular.
3. Vaya a **Settings → Pages**. En *Build and deployment* elija **Deploy from a branch**, rama **main**, carpeta **/ (root)** y toque **Save**.
4. En uno o dos minutos la app queda publicada en `https://SU-USUARIO.github.io/simulacros/`.

## Instalar en el celular

- **Android (Chrome):** abra el enlace y toque **Instalar en el celular**, o use el menú ⋮ → *Agregar a la pantalla principal*.
- **iPhone (Safari):** abra el enlace, toque Compartir → *Agregar a inicio*.

Después de abrirla una vez con internet, la app funciona sin conexión.

## Envío por WhatsApp o correo

Botón **Generar PDF y enviar**:

- **Enviar PDF**, **Enviar PDF + respaldo JSON** o **Enviar solo respaldo JSON** abren el menú para compartir del celular; elija WhatsApp, Gmail, Outlook u otra app y los archivos van como adjuntos.
- Chrome en Android y WhatsApp no aceptan archivos `.json` al compartir. En ese caso el respaldo se adjunta como `…_respaldo.json.txt`: contiene el mismo JSON y la app lo importa igual.
- Si el navegador no permite compartir archivos (algunos computadores), la app los descarga y ofrece abrir WhatsApp Web o el correo para adjuntarlos.
- **Descargar PDF / Descargar JSON** guardan los archivos en el dispositivo (el JSON con extensión `.json`).

## Respaldo y recuperación

- La información se guarda **solo en el celular** (almacenamiento del navegador). No se envía a ningún servidor.
- Si borra los datos del navegador o desinstala la app, se pierden las evaluaciones guardadas. Haga el respaldo JSON al terminar cada simulacro.
- Para recuperar o continuar una evaluación en otro equipo: **Importar respaldo** en la pantalla de inicio y seleccione el `.json` o `.json.txt`.

## Configuración (ícono de engranaje)

- Nombre de la empresa para el encabezado del PDF (por defecto *Codere Colombia*).
- Logo opcional para el encabezado del PDF.
- Evaluador y cargo por defecto para nuevas evaluaciones.

## Actualizar la app

Al cambiar cualquier archivo, edite `sw.js` y suba el número de `VERSION` (por ejemplo `simulacro-v1.0.1`). Así los celulares descargan la versión nueva la próxima vez que abran la app con internet.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de la app |
| `styles.css` | Diseño y colores corporativos |
| `config.js` | Hitos, lista de chequeo, guía paso a paso y cálculos de tiempo |
| `app.js` | Lógica: guardado automático, cronómetro, fotos, firmas, envío |
| `pdf.js` | Generación del PDF |
| `jspdf.umd.min.js`, `jspdf.plugin.autotable.min.js` | Librerías de PDF (jsPDF 2.5.2 y AutoTable 3.8.4, licencia MIT) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Funcionamiento sin conexión e instalación en el celular |

Para cambiar las preguntas de la lista de chequeo o los hitos de tiempo, edite `config.js`.
