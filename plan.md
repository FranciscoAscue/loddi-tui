# Loddi — plan de producto e implementación

Última actualización: 2026-09-27

## Objetivo

Loddi es una aplicación TUI ligera, escrita en Node.js, para organizar y escribir libros en Markdown desde una carpeta de proyecto. Debe funcionar en Windows, Linux y macOS, permitir trabajar con manuscritos Unicode y exportar publicaciones sin exigir herramientas externas para la escritura diaria.

La interfaz de Loddi se mantiene en inglés. El contenido de los libros puede escribirse en cualquier idioma compatible con UTF-8; la fuente visible durante la edición depende del emulador de terminal. La exportación PDF puede usar fuentes instaladas en el sistema.

## Estado actual

### Implementado

- [x] CLI Node.js con comandos para crear, abrir, revisar y exportar proyectos.
- [x] Proyecto basado en carpeta con manifiesto `book.yaml`.
- [x] Estructura para portada, capítulos, secciones, imágenes y bibliografía.
- [x] Generación automática de `SUMMARY.md` al añadir documentos.
- [x] Lanzador centrado con marca LODDI sólida, buscador de manuscrito y comandos `/`.
- [x] Navegación de resultados largos con flechas y `Page Up`/`Page Down`.
- [x] Atajos de teclado para abrir y crear documentos, exportar, revisar y salir.
- [x] Editor de Markdown de panel único con resaltado de sintaxis y menú `Ctrl+P` para insertar estructuras.
- [x] Un único atajo `Ctrl+P` abre un panel de inserción con letras `H/B/L/C/D/M/I` para títulos, negrita, listas, código, Mermaid, LaTeX e imágenes.
- [x] Resaltado por bloques y elementos en línea: cercas y lenguaje, títulos, listas, tablas, citas, enlaces, imágenes, código y matemáticas.
- [x] Apertura directa de archivos `.md` sin crear un proyecto, y `init --adopt` para indexar Markdown existente sin moverlo.
- [x] Panel de inserción con flechas, Enter y letras; acciones `E` para editar el bloque bajo el cursor y `X` para borrarlo completo con confirmación.
- [x] Atajo `Ctrl+E` para renombrar documentos del manuscrito, actualizar archivo, `book.yaml`, `SUMMARY.md` y enlaces Markdown comunes.
- [x] Pantalla principal mínima: `?` muestra todos los atajos, `/` muestra comandos y el pie conserva solo la salida.
- [x] Resaltado por lenguaje dentro de bloques cercados para JavaScript/TypeScript, C/C++, Java/C#, Python, Ruby, Rust, Go, shell, JSON, YAML, CSS, HTML/XML, SQL, Mermaid y LaTeX, con alternativa básica para otros lenguajes.
- [x] Guardado, búsqueda de texto, movimiento de cursor, borrado de línea y protección al salir con cambios sin guardar.
- [x] `Supr` borra hacia delante o une la línea siguiente; `Tab` inserta una indentación de dos espacios en el editor.
- [x] `Ctrl+Supr` borra la palabra siguiente; el pie del editor ya no anuncia operaciones básicas como `Supr`.
- [x] `Re Pág`/`Av Pág` navegan por páginas del editor; clic y rueda del mouse mueven el cursor en terminales con protocolo SGR.
- [x] Paleta `Ctrl+P` ofrece asistente Codex opcional: insertar por defecto, editar bloque o chat; solo recibe el fragmento actual y la propuesta se revisa antes de aplicar.
- [x] Prueba local de `codex exec` en modo headless y solo lectura: generó bloques Mermaid, Python y LaTeX sin modificar el manuscrito.
- [x] El panel de IA consulta `codex login status` y ofrece inicio de sesión mediante `codex login --device-auth`; las credenciales permanecen bajo control del CLI de Codex.
- [x] Diagnósticos básicos para documentos ausentes, imágenes locales, citas no reconocidas y bloques de código sin cerrar.
- [x] Revisión del manuscrito con conteo de palabras e incidencias por documento.
- [x] BibTeX de proyecto, importación de `.bib` exportado desde Zotero y eliminación de claves duplicadas al importar.
- [x] Selector de referencias e inserción de citas `[@key]` desde el editor con `Ctrl+I`.
- [x] Exportación EPUB y PDF con Pandoc; PDF usa Typst por defecto.
- [x] Separación de portada, índice y unidades del manuscrito en la salida publicada.
- [x] Instalación bajo demanda de Pandoc y Typst en el espacio de usuario, sin alterar el `PATH` del sistema.
- [x] Selector de fuentes disponibles para PDF mediante `/fonts`.
- [x] Contenido de manuscrito almacenado y leído como UTF-8.
- [x] Carpeta `playground/` y comandos npm para crear, abrir, revisar y limpiar un libro de prueba.
- [x] Instrucciones de instalación desde el checkout para Windows, macOS y Linux.
- [x] Instalador `scripts/install.sh` para Linux/macOS mediante `curl | bash` y ruta Git + npm para Windows; ambas compilan y empaquetan antes de instalar globalmente.
- [x] Empaquetado portable `.tar.gz` con Node incluido, suma SHA-256, prueba de extracción/CLI y workflow manual para Linux x64/ARM64, macOS Intel/ARM64 y Windows x64.
- [x] Consulta de actualización al abrir el lanzador (caché diaria y sin bloqueo), confirmación automática en la TUI cuando hay una nueva versión y confirmación interactiva en `loddi update` (`--yes` para scripts); descarga verificada por SHA-256 e instalación paralela sin sobrescribir manuscritos ni la versión en ejecución.
- [x] Reordenación con selección persistente y posición visible; solo se renumeran los Markdown numerados de `chapters/`, conservando los nombres de documentos adoptados y secciones.
- [x] Logo LODDI corregido con bloque de cinco caracteres correctos en el lanzador.
- [x] Eliminación de referencias desde `/references` con confirmación (`Ctrl+D`).
- [x] Vista de detalle de referencia seleccionada desde `/references` (Enter).
- [x] Edición de título, autor y año desde el detalle de una referencia, conservando los demás campos BibTeX.
- [x] Citas múltiples en el editor: canasta con Tab, formas narrativa/parentética con `Ctrl+T`.
- [x] Reordenamiento de capítulos y secciones desde el lanzador con `Alt+↑` / `Alt+↓`.
- [x] Eliminación de documentos del manifiesto desde el lanzador con `Ctrl+W` y confirmación.
- [x] `SUMMARY.md` y `book.yaml` se actualizan automáticamente al mover o eliminar un documento.
- [x] Selector de citas del editor se recarga automáticamente al volver del panel `/references`.
- [x] El editor muestra la fuente de imágenes, Mermaid y LaTeX resaltada, sin simular una previsualización incompleta.
- [x] Diagnóstico de advertencia para bloques Mermaid (limitación de renderizado documentada).
- [x] Pantalla de ayuda con dos pestañas: teclado completo y sintaxis Markdown soportada.
- [x] Sintaxis Markdown y límites de renderizado documentados en `/help` y en el README.
- [x] `package.json` con metadatos completos para publicación en npm (`keywords`, `repository`, `license`, `bugs`).
- [x] `docs/INSTALL.md` con instrucciones de actualización (`npm update`) y desinstalación (`npm uninstall`).
- [x] Suite de tests ampliada: reordenamiento, eliminación, límites de posición, Mermaid y bibliografía.
- [x] Matriz de CI preparada para Linux x64/ARM64, Windows x64 y macOS Intel/Apple Silicon.
- [x] Comprobaciones de instalación del tarball npm y exportación EPUB/PDF en un libro temporal; ambas completadas localmente en Linux x64.
- [x] Instalador de herramientas con SHA-256 obligatorio, comprobación de ejecución del binario y actualización del manifiesto después de instalar correctamente.
- [x] Control previo a publicación para impedir metadatos de repositorio ficticios o una licencia MIT sin archivo `LICENSE`.
- [x] URL real del repositorio, archivo MIT `LICENSE` y comprobación `release:check` local.
- [x] Creación de capítulos y secciones sin reutilizar nombres de archivos retirados del manifiesto; prueba de regresión para sobrescritura.
- [x] Atajos de creación, renombrado, revisión y exportación consultables con `?`, sin ocupar el lanzador.
- [x] Landing y guía estáticas con estilo de terminal, paleta web `/`, ayuda `?` y ejemplos asciicast de CLI.
- [x] Instalación global local mediante `npm link` y verificación del comando `loddi` para v0.1.0.
- [x] Código de v0.1.0 y copia revisable del sitio enviados a `origin/master` y `origin/gh-pages`, sin habilitar GitHub Pages.

### Parcial o pendiente

- [ ] La biblioteca Zotero se incorpora mediante exportación manual BibTeX; no hay conexión ni sincronización directa con la cuenta Zotero.
- [ ] Los diagramas Mermaid no se renderizan automáticamente en PDF/EPUB (se necesita un pre-procesador externo como `mermaid-filter` o `mmdc`).
- [ ] La matriz de CI está configurada, pero todavía no se ha ejecutado en un repositorio remoto; falta validar instalación y publicación en Windows, macOS y Linux ARM64.
- [ ] El paquete npm aún no está publicado; se espera la revisión del titular del copyright MIT (`FranciscoAscue`) y las validaciones multiplataforma.
- [ ] Ejecutar el workflow portable en los cinco targets; adjuntar los archivos aprobados a una GitHub Release solamente cuando se autorice publicar la descarga directa.
- [x] Preparar la rama `gh-pages` con el sitio estático, sin configurar la fuente de publicación en GitHub Pages.
- [ ] Revisar una demostración real del editor y decidir cuándo activar GitHub Pages; no iniciar despliegue antes de autorización explícita.
- [ ] La prueba automática de publicación aún comprueba principalmente cabeceras/tamaño de PDF y EPUB; falta inspeccionar contenido, imágenes, citas, índice y saltos de página.
- [ ] Falta un flujo de TUI para añadir material final (`backmatter/`) aunque la carpeta del proyecto ya existe.
- [ ] Probar interacción real de mouse y asistente Codex en Windows, macOS y distintos emuladores; la prueba local actual cubre Linux y los formatos Mermaid, código y LaTeX.

## Hoja de ruta

### Fase 1 — Consolidar escritura y referencias ✅

- [x] Revisar el flujo completo de importación BibTeX: entradas mal formadas, claves repetidas, caracteres Unicode y colecciones grandes.
- [x] Permitir editar y quitar referencias desde `/references`, con confirmación para operaciones que cambian la biblioteca.
- [x] Añadir creación de citas múltiples y formas de cita sin memorizar la sintaxis de Pandoc.
- [x] Al cambiar la bibliografía desde `/references`, actualizar el selector del editor al volver al capítulo.
- [x] Asegurar que las referencias se conserven correctamente al guardar y exportar en EPUB/PDF.

Criterio de salida: una persona puede importar la biblioteca exportada desde Zotero, encontrar una referencia, citarla en el manuscrito, corregirla o quitarla desde Loddi y exportar el libro sin claves desconocidas. ✅

### Fase 2 — Administrar la estructura del libro (parcial)

- [x] Añadir acciones de reordenamiento para capítulos y secciones.
- [x] Añadir eliminación segura de documentos y actualización del manifiesto y `SUMMARY.md`.
- [ ] Diferenciar claramente portada, secciones preliminares, capítulos y material final en el lanzador; falta crear/editar material final desde la TUI.
- [x] Mantener el orden elegido al exportar y en la revisión del manuscrito.

Criterio de salida: la estructura visible, el manifiesto, `SUMMARY.md` y el orden de exportación coinciden después de mover o eliminar cualquier unidad; falta cubrir material final.

### Fase 3 — Markdown, imágenes y diagramas (parcial)

- [x] Documentar la sintaxis Markdown soportada por Pandoc y los límites de renderizado dentro del editor.
- [x] Sustituir la vista previa dividida por fuente Markdown resaltada de panel único.
- [x] Añadir un panel de inserción con selección por letra para títulos, negrita, listas, código, Mermaid, matemáticas LaTeX e imágenes.
- [x] Definir el método de renderizado Mermaid: bloques se preservan en Markdown y se pueden procesar con mermaid-filter o mmdc; la limitación está documentada en `/help`, `/check` y el README.
- [ ] Verificar mediante pruebas automáticas imágenes locales, bloques de código, tablas, enlaces, citas, índice y separación de páginas en PDF y EPUB.
- [x] Informar diagnósticos claros cuando un recurso no pueda mostrarse o exportarse.

Criterio de salida: el libro de ejemplo con código, imagen, diagrama y cita produce salidas utilizables; las limitaciones de renderizado se indican con claridad. Falta la verificación completa del contenido exportado.

### Fase 4 — Portabilidad, empaquetado y publicación

- [x] Configurar una matriz automatizada para Linux x64/ARM64, Windows x64 y macOS Intel/Apple Silicon.
- [x] Verificar localmente instalación del paquete empaquetado y exportación EPUB/PDF con libros temporales.
- [x] Revisar nombres de archivos de las versiones oficiales actuales y exigir SHA-256 antes de extraerlos.
- [ ] Ejecutar instalación, edición, importación de bibliografía y exportación en Windows, macOS Intel/Apple Silicon y Linux x64/ARM64 donde haya runners disponibles.
- [ ] Ejecutar la matriz manual de instalación de Pandoc/Typst y exportación en cada plataforma; revisar fallos específicos de extracción.
- [x] Preparar versión y paquete npm, comprobar el comando `loddi` instalado globalmente y documentar actualización/desinstalación.
- [x] Sustituir las URL de ejemplo en `package.json`, añadir `LICENSE` MIT y ejecutar `npm run release:check`.
- [ ] Confirmar que `FranciscoAscue` es el titular deseado para el aviso de copyright MIT.
- [ ] Publicar en npm cuando el paquete, la identidad y las validaciones de plataforma estén listos.

Criterio de salida: los pasos documentados funcionan desde una instalación limpia en las plataformas anunciadas y un usuario puede instalar Loddi con npm sin clonar el repositorio.

## Después del alcance inicial

Estas funciones son opcionales y no bloquean el objetivo actual:

- Sincronización directa con Zotero mediante API, con gestión segura de credenciales y selección de biblioteca/colección.
- Más formatos de salida, por ejemplo HTML y DOCX.
- Plantillas visuales y configuración ampliada de página para EPUB/PDF.
- Integración de imágenes de terminal cuando el emulador soporte protocolos gráficos, manteniendo una alternativa textual.
- Renderizado automático de Mermaid en exportación mediante integración de `mermaid-filter` o `@mermaid-js/mermaid-cli`.

## Principios de implementación

- Mantener el manuscrito como archivos Markdown y recursos comunes, legibles fuera de Loddi.
- Mantener ligera la instalación base; las herramientas de publicación se instalan solo cuando hacen falta.
- No modificar el `PATH` global ni requerir permisos de administrador para herramientas administradas por Loddi.
- Mantener controles de teclado visibles y discretos, y vistas centradas con poco ruido visual.
- Preferir formatos portables y explícitos en el proyecto (`book.yaml`, BibTeX y archivos Markdown).
- No afirmar compatibilidad de plataforma o renderizado hasta verificarla con el flujo correspondiente.


---

## Leyenda de atajos de teclado

### Lanzador (pantalla principal)

| Tecla | Acción |
|---|---|
| `↑` / `↓` | Seleccionar elemento de la lista |
| `Page Up` / `Page Down` | Desplazarse por listas largas |
| `Enter` | Abrir documento seleccionado o ejecutar comando |
| `?` | Abrir la ayuda de atajos y Markdown |
| `/` | Mostrar comandos en el buscador |
| `Ctrl+N` | Crear nuevo capítulo |
| `Ctrl+T` | Crear nueva sección de preliminares |
| `Ctrl+O` | Crear o abrir la portada |
| `Ctrl+X` | Abrir pantalla de exportación |
| `Ctrl+R` | Revisar el manuscrito |
| `Ctrl+P` | Alternativa para abrir el menú `/` |
| `Alt+↑` / `Alt+↓` | Reordenar el documento seleccionado — archivos renumerados automáticamente |
| `Ctrl+W` | Eliminar documento del manifiesto (el archivo en disco se conserva) |
| `Ctrl+E` | Renombrar el documento seleccionado, excepto la portada |
| `Ctrl+D` o `Ctrl+Q` | Salir de Loddi |

> **Nota:** las funciones de dependencias, fuentes, referencias y revisión se abren desde el menú `/`. Ya no ocupan atajos directos en el lanzador; esto libera `Ctrl+D` como atajo de salida (convención EOF de terminal).

### Editor

| Tecla | Acción |
|---|---|
| `Tab` | Insertar dos espacios en la posición del cursor |
| `Ctrl+Supr` / `Ctrl+Delete` | Borrar la palabra siguiente; al final de la línea, unir con la siguiente |
| `Re Pág` / `Av Pág` | Mover el cursor una página del editor |
| Clic / rueda del mouse | Posicionar cursor / desplazarse (terminal compatible con SGR) |
| `Ctrl+S` | Guardar |
| `Ctrl+P` | Abrir panel de inserción Markdown |
| `A` en el panel | Abrir asistente Codex: insertar, editar bloque o chat; requiere CLI instalado e inicio de sesión |
| `Enter` en el panel de acceso de Codex | Iniciar sesión con código de dispositivo cuando no hay sesión; `R` vuelve a comprobar el estado |
| `↑` / `↓` y `Enter` en el panel | Elegir y aplicar una opción sin memorizar letras |
| `H` / `B` / `L` en el panel | Insertar título / negrita / lista |
| `C` / `D` / `M` / `I` en el panel | Insertar código / Mermaid / LaTeX matemático / imagen |
| `E` / `X` en el panel | Editar el bloque bajo el cursor / borrarlo completo tras confirmación |
| `Ctrl+F` | Buscar texto |
| `Ctrl+I` | Abrir selector de citas |
| `Ctrl+D` | Borrar línea actual |
| `Ctrl+Left` / `Ctrl+Right` | Mover cursor por palabra |
| `Home` / `End` | Inicio / fin de línea |
| `Ctrl+Q` | Volver al lanzador (pide confirmación si hay cambios sin guardar) |

#### Selector de citas (dentro del editor, `Ctrl+I`)

| Tecla | Acción |
|---|---|
| `↑` / `↓` | Navegar entradas que coinciden con la búsqueda |
| `Tab` | Añadir entrada a la canasta (cita múltiple) |
| `Ctrl+T` | Alternar forma narrativa `@key` ↔ parentética `[@key]` |
| `Enter` | Insertar cita(s) en el documento |
| `Esc` | Cancelar |

### Pantalla de referencias (`/references`)

| Tecla | Acción |
|---|---|
| `↑` / `↓` / `Page Up` / `Page Down` | Desplazarse por la lista |
| `Enter` | Ver detalle de la entrada seleccionada |
| `T` / `A` / `Y` en detalle | Editar título, autor o año |
| `Ctrl+I` | Importar archivo `.bib` externo |
| `Ctrl+D` | Eliminar la referencia seleccionada (pide confirmación con `Y`) |
| `Esc` | Volver al lanzador |

### Menú de comandos (`/` o `Ctrl+P` en el lanzador)

| Comando | Descripción |
|---|---|
| `/export` | Abrir opciones de exportación |
| `/export pdf` | Exportar PDF directamente |
| `/export epub` | Exportar EPUB directamente |
| `/install pandoc` | Instalar o actualizar Pandoc administrado por Loddi |
| `/install typst` | Instalar o actualizar Typst administrado por Loddi |
| `/dependencies` | Ver estado de herramientas de publicación |
| `/fonts` | Elegir fuente para PDF (Typst) |
| `/references` | Explorar o importar biblioteca BibTeX |
| `/review` | Revisar palabras e incidencias por documento |
| `/check` | Ver diagnósticos del proyecto |
| `/help` | Mostrar atajos y guía de Markdown en la TUI |
| `/quit` | Salir de Loddi |
