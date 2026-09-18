# Guía de Despliegue en cPanel (Hosting Apache / PHP)

Este proyecto está 100% empaquetado, probado y listo para ser desplegado en cualquier hosting con **cPanel** en menos de 2 minutos.

---

## 📦 Archivo de Despliegue
Todo el sistema está listo en un único archivo comprimido en la raíz del proyecto:
📁 **`cpanel_deploy_minisistema.zip`** *(517 KB)*

---

## 🔑 Credenciales de Acceso al Sistema
* **URL de Ingreso:** `https://tudominio.com/login.html` (o `index.html` que redirige automáticamente).
* **Usuario:** `admin`
* **Contraseña:** `admin123`

*(También puedes cambiar las credenciales o dar acceso a otros usuarios desde `login.html`).*

---

## 🚀 Pasos de Instalación Rápida en cPanel

### Paso 1: Ingresar a tu cPanel
1. Accede a tu panel de control **cPanel** (ejemplo: `https://tudominio.com:2083`).
2. En la categoría **Archivos**, abre el **Administrador de archivos** (*File Manager*).

### Paso 2: Ir a la Carpeta de Destino
* **Para que funcione en tu dominio principal (`tudominio.com`):**
  - Entra a la carpeta **`public_html`**.
* **Para que funcione en un subdirectorio (`tudominio.com/sistema`):**
  - Crea una carpeta dentro de `public_html` llamada `sistema` (o el nombre que prefieras) y entra en ella.
* **Para un subdominio (`sistema.tudominio.com`):**
  - Entra a la carpeta raíz asignada a ese subdominio.

> **Nota:** Si la carpeta contiene archivos temporales antiguos, puedes eliminarlos antes de subir el ZIP.

### Paso 3: Subir el Archivo ZIP
1. En la barra superior de herramientas de cPanel, haz clic en **Cargar** (*Upload*).
2. Arrastra y suelta el archivo **`cpanel_deploy_minisistema.zip`**.
3. Espera a que la barra de carga llegue al 100% en color verde.
4. Haz clic en *"Volver a /public_html"*.

### Paso 4: Extraer los Archivos
1. Selecciona el archivo **`cpanel_deploy_minisistema.zip`** que acabas de subir.
2. En el menú superior o haciendo clic derecho, elige **Extract** (*Extraer*).
3. Confirma la ruta de extracción y haz clic en **Extract File(s)**.
4. *(Opcional)* Puedes borrar el archivo `.zip` después de extraerlo.

### Paso 5: Permisos de Escritura de la Carpeta `data/`
El sistema almacena físicamente todas las modificaciones, nóminas y evaluaciones en archivos JSON dentro de `data/`:
1. Verifica que la carpeta **`data/`** tenga permisos **`755`** (estándar en cPanel).
2. Como cPanel ejecuta PHP bajo el mismo usuario de la cuenta (FastCGI / suPHP / PHP-FPM), la persistencia física funcionará de inmediato sin necesidad de configuraciones adicionales.

---

## 🛠️ Endpoints API en PHP Integrados (Carpeta `api/`)
El sistema cuenta con endpoints PHP optimizados con cabeceras CORS y JSON UTF-8:
* `api/grupos.php` — Lectura y guardado de programación modular académica (128 grupos).
* `api/docentes.php` — Directorio docente por ciclos y especialidades.
* `api/directorios.php` — Catálogo y apertura de nuevos periodos de gestión académica.
* `api/carpetas.php` — Supervisión y auditoría de Carpetas Docentes Virtuales (CDV - Clementina).
* `api/supervisiones.php` — Evaluación de Desempeño en Aula con Rúbrica Oficial F03 (0 a 20 pts).
* `api/reset.php` — Restablecimiento seguro a la versión base oficial con un clic.

---

## 🌐 Verificación en el Navegador
Abre en tu navegador la URL donde lo instalaste:
* `https://tudominio.com/`
* Inicia sesión con **`admin` / `admin123`**.
* Verás el indicador verde **"Archivo Guardado"** en la barra superior.
* Tendrás acceso a todos los módulos:
  1. **Directorio Docente** (Ciclos I al X)
  2. **Análisis de Cursos** (Carga electiva y vacantes)
  3. **Calificar Desempeño** (EDD 2026-2 / Rúbrica oficial F03)
  4. **Supervisión de Carpetas Docentes** (Clementina)
  5. **Matriz Modular** (Set-Dic 2026)
  6. **Bolsa de Vacantes** (Asignación rápida)
  7. **Descarga y Carga Masiva en Excel** con plantilla oficial.

