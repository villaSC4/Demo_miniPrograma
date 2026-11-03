# 📦 DEPLOY 1: Actualización del Minisistema Principal (SGA UCV)
**Destino:** Dominio principal donde está alojado el Minisistema (ejemplo: `public_html/` o la carpeta de su sistema actual).
**Archivos listos para subir:** `deploy_1_minisistema_actualizacion.zip` (o su copia espejo `cpanel_update_minisistema.zip`)

---

## 📁 Novedades y Módulos incluidos en esta actualización:

### 🎓 1. Nuevo Módulo 1.5: Rendimiento Académico UCV (Exclusivo Industrial)
- **`rendimiento_industrial.html`** y **`js/rendimiento_industrial.js`**:
  - **Pestaña 1 (Dashboard Principal):** 4 KPIs ejecutivos (Matriculados 1,364, Inhabilitados 28, Aprobados 1,211, Tasa 90.6%), filtros en vivo por Ciclo y Asignatura, y tabla consolidada de 12 asignaturas finalizadas con barras de progreso de aprobación.
  - **Pestaña 2 (Base de Datos UCV):** Registro detallado de las 57 secciones oficiales con indicador de estado (CERRADO/ACTIVO) y buscador en tiempo real.
  - **Pestaña 3 (Dashboards y Cálculos):** 4 gráficos interactivos con Chart.js (Aprobados vs Desaprobados, Distribución por Ciclos, Top 5 Secciones con Mayor Inhabilitados y Ratio de Cobertura de Matrícula).
  - **Actualizador de Excel:** Zona Drag-and-Drop compatible con el formato oficial UCV-VA-017 de Trilce para cargar y recalcular automáticamente nuevos semestres.
- **`api/rendimiento_industrial.php`**, **`data/rendimiento_industrial.json`** y **`data/rendimiento_industrial_base.json`**:
  - Endpoint PHP con soporte para lectura, actualización física del archivo JSON y botón de restablecimiento a los datos oficiales base.

### 👤 2. Nuevo Perfil Institucional Industrial (Aislamiento Estricto)
- **Credenciales Oficiales:**
  - **Correo:** `coordinacion.fia.industrial@ucvvirtual.edu.pe`
  - **Usuario:** `coordinacion.fia.industrial`
  - **Contraseña:** `DelegadosFIA2727`
- **Aislamiento Total de Sistemas:**
  - Al ingresar con esta cuenta, el selector oculta y elimina del DOM la tarjeta de **DAC Sistemas**.
  - Entra de manera directa al selector de módulos de **DAC Industrial** (con los 5 módulos centrados).
  - El botón "Cambiar DAC" queda completamente eliminado.
  - En **`index.html`**, **`docentes_delegados.html`** y **`optimizacion_academica.html`**, todos los accesos a Sistemas son bloqueados.
- **`database_usuarios.sql`**:
  - Script MySQL actualizado con la creación de tabla y la inserción de ambas cuentas (`coordinacion.fia@ucvvirtual.edu.pe` y `coordinacion.fia.industrial@ucvvirtual.edu.pe`) con contraseñas encriptadas SHA-256 + salt (`ucvfia2026`).

### 📱 3. PAE Multicanal y Central WhatsApp Web
- **`pau_whatsapp.html`**, **`js/pau.js`**, **`api/atenciones_dac.php`** y **`api/config_dac.php`**:
  - Plataforma de Atención al Estudiante con bandeja multicanal, llamados a salas Zoom y conexión de WhatsApp Web con código QR.

---

## 🚀 Pasos de Instalación en cPanel:

1. **Subir y Extraer:**
   - Ingrese al **Administrador de Archivos** de cPanel.
   - Vaya a la carpeta donde tiene instalado el Minisistema (usualmente `public_html/`).
   - Suba el archivo **`deploy_1_minisistema_actualizacion.zip`**.
   - Haga clic derecho sobre el ZIP y seleccione **Extract** (Extraer aquí). Sobrescribirá automáticamente los archivos actualizados manteniendo intacta toda la información previa.
   - Elimine el archivo ZIP.

2. **Base de Datos (phpMyAdmin):**
   - Si utiliza autenticación por base de datos MySQL en cPanel, ingrese a **phpMyAdmin**, abra la base de datos de usuarios e importe el archivo **`database_usuarios.sql`**.
   - *(Si no utiliza MySQL, el sistema operará automáticamente mediante SQLite local en `data/usuarios.db` sin necesidad de configurar nada).*

3. **¡Listo!**
   - Ingrese a su Minisistema en `login.html` o `selector.html` para acceder con las cuentas institucionales configuradas.
