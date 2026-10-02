# Guía de Despliegue en cPanel (Hosting Apache / PHP)

El Minisistema Académico Modular está 100% empaquetado, probado y listo para ser desplegado en cualquier hosting con **cPanel** en menos de 2 minutos.

---

## 📦 Paquetes de Despliegue Disponibles

En la raíz del proyecto encontrarás 3 archivos `.zip` listos para usar:

1. **`minisistema_cpanel_DEPLOY.zip`** *(1.41 MB - Recomendado para instalación desde cero)*
   - Contiene la totalidad de archivos del Minisistema: frontend, nuevo módulo **Docentes y Delegados**, selector, dashboards Chart.js, librerías (Bootstrap 5, Icons, XLSX), estilos UCV, base de datos limpia y endpoints PHP.
2. **`cpanel_update_minisistema.zip`** *(160 KB - Recomendado para actualizaciones rápidas)*
   - Contiene únicamente el código modificado reciente (`index.html`, `selector.html`, `login.html`, `docentes_delegados.html`, `procedimiento.html`, `css/custom.css`, scripts `js/`, `api/` y plantillas base limpias).
3. **`formulario_delegados_cpanel_DEPLOY.zip`** *(380 KB - Para subdominio de asistencia estudiantil)*
   - Contiene el Portal Oficial de Registro de Delegados con base de datos limpia, listo para extraer en la raíz de su subdominio (ej: `reg-asistencia-1.class-it.edu.pe`).

---

## 🔑 Credenciales de Acceso al Sistema

* **URL de Ingreso:** `https://tudominio.com/login.html` (o ingresa a la raíz que redirige automáticamente).
* **Opción 1:**
  - **Usuario:** `coordinacion.fia` (o `coordinacion.fia@ucvvirtual.edu.pe`)
  - **Contraseña:** `DelegadosFIA2026`
* **Opción 2:**
  - **Usuario:** `admin`
  - **Contraseña:** `admin123`

---

## 🚀 Pasos de Instalación Rápida en cPanel

### Paso 1: Ingresar a tu cPanel
1. Accede a tu panel de control **cPanel** (ejemplo: `https://tudominio.com:2083`).
2. En la categoría **Archivos**, abre el **Administrador de archivos** (*File Manager*).

### Paso 2: Ir a la Carpeta de Destino
* **Para tu dominio principal (`tudominio.com`):**
  - Entra a la carpeta **`public_html`**.
* **Para un subdirectorio (`tudominio.com/minisistema`):**
  - Crea una carpeta dentro de `public_html` llamada `minisistema` y entra en ella.
* **Para un subdominio (`sga.tudominio.com`):**
  - Entra a la carpeta raíz asignada a ese subdominio.

### Paso 3: Subir el Archivo ZIP
1. En la barra superior de herramientas de cPanel, haz clic en **Cargar** (*Upload*).
2. Sube **`minisistema_cpanel_DEPLOY.zip`** (o `cpanel_update_minisistema.zip` si solo actualizas).
3. Espera a que la barra de carga llegue al 100% en color verde.
4. Haz clic en *"Volver a /public_html"*.

### Paso 4: Extraer los Archivos
1. Selecciona el archivo `.zip` que acabas de subir.
2. En el menú superior o haciendo clic derecho, elige **Extract** (*Extraer*).
3. Confirma la ruta de extracción y haz clic en **Extract File(s)**.
4. Puedes borrar el archivo `.zip` después de extraerlo.

### Paso 5: Permisos de la Carpeta `data/`
El sistema almacena físicamente todas las modificaciones y evaluaciones en archivos JSON dentro de `data/`:
1. Verifica que la carpeta **`data/`** tenga permisos **`755`** (estándar en cPanel).
2. Como cPanel ejecuta PHP bajo el mismo usuario de la cuenta, la persistencia física en `data/grupos.json`, `data/delegados.json` y `data/pau_correos.json` funcionará de inmediato.

---

## 🛠️ Endpoints API en PHP Integrados (Carpeta `api/`)
* `api/login.php` — Servicio de autenticación con SQLite y MySQL.
* `api/grupos.php` — Lectura y guardado de programación modular académica (128 grupos).
* `api/docentes.php` — Directorio docente oficial (18 docentes UCV por ciclos y carreras).
* `api/delegados.php` — Padrón persistente de delegados estudiantiles (limpio y dinámico).
* `api/pau.php` — Módulo de Atención al Estudiante y seguimiento de correos PAU.
* `api/directorios.php` — Catálogo y apertura de periodos de gestión académica.
* `api/carpetas.php` — Supervisión y auditoría de Carpetas Docentes Virtuales (Clementina).
* `api/supervisiones.php` — Evaluación de Desempeño en Aula con Rúbrica Oficial F03.
* `api/reset.php` — Restablecimiento seguro a la versión base oficial con un clic.

---

## 🌐 Verificación en el Navegador
Abre en tu navegador la URL donde lo instalaste:
* `https://tudominio.com/`
* Inicia sesión con **`admin` / `admin123`** o **`coordinacion.fia` / `DelegadosFIA2026`**.
* En el **Selector de Módulos (`selector.html`)**:
  1. **Módulo 1.1: Docentes y Delegados (`docentes_delegados.html`)** — Dashboard analítico dual (Docentes Tipo 1 y Delegados Tipo 2), gráficos Chart.js, barra de búsqueda en tiempo real, filtros por chips y tabla unificada.
  2. **Módulo 1.2: Gestión Académica Principal (`index.html`)** — Matriz modular de 128 grupos, monitoreo ejecutivo, filtros de DAC (Sistemas / Industrial), calendario y atención PAU.
  3. **Módulo 1.3: Sistema de Evaluación y Rúbricas (`notas-lac.vercel.app`)** — Redirección automática con filtro por carrera.
