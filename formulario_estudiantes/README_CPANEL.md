# 🚀 Guía de Instalación en cPanel: Reserva de Atención Estudiantil DAC 2026-2
**Subdominio:** `dac-atiende.class-it.edu.pe`  
**Facultad:** Ingeniería y Arquitectura — UCV  

---

## 1. Estructura de Archivos
Este módulo es 100% autónomo y está preparado para funcionar directamente en la carpeta raíz del subdominio (ej: `/public_html/dac-atiende/`):

- `index.html`: Formulario oficial de reserva para estudiantes (Ing. de Sistemas e Ing. Industrial).
- `submit.php`: Endpoint de procesamiento con registro en base de datos MySQL y generación de ticket.
- `config.php`: Credenciales de conexión a MySQL y contraseña del panel.
- `db.php`: Conexión PDO con auto-creación y migración de tablas.
- `database.sql`: Script SQL con la estructura completa de la tabla `estudiantes_atenciones`.
- `admin.php`: Panel de control docente y coordinación para atender llamados y asignar Zoom.
- `exportar.php`: Exportación a Excel / CSV.
- `descargar.php`: Endpoint seguro de descarga con contraseña.
- `.htaccess`: Reglas de seguridad y redirecciones Apache/cPanel.

---

## 2. Pasos para Despliegue en cPanel

### Paso 1: Base de Datos y Usuario ya Creados en cPanel
Su base de datos y usuario ya han sido definidos en cPanel:
- **Base de datos:** `classit_estudiantes_atenciones`
- **Usuario:** `classit_admin_atencion`
- **Contraseña:** `B*OBht$T_aBtOmE(`
- *Nota:* El archivo `config.php` ya viene 100% preconfigurado con estos datos.

### Paso 2: Importar la Tabla SQL
1. En cPanel, abra **phpMyAdmin**.
2. Seleccione la base de datos `classit_estudiantes_atenciones`.
3. Vaya a la pestaña **Importar**.
4. Seleccione el archivo `database.sql` y haga clic en **Importar** (creará la tabla `estudiantes_atenciones`).

### Paso 4: Subir los Archivos al Subdominio
1. En cPanel, vaya a **Administrador de Archivos** (File Manager).
2. Navegue al directorio raíz del subdominio `dac-atiende.class-it.edu.pe` (por ejemplo: `public_html/dac-atiende`).
3. Suba el archivo `formulario_estudiantes_cpanel.zip` y use la opción **Extraer** (Extract).

---

## 3. Integración con el Módulo PAE del Docente (`pau_whatsapp.html`)
El panel docente incluye la pestaña **Atención DAC • Citas (Llamados y Salas Zoom)** que permite:
1. Ver en tiempo real las reservas hechas por los estudiantes en `dac-atiende.class-it.edu.pe`.
2. Asignar sala virtual de Zoom o Google Meet con el botón **Convocar**.
3. Contactar directamente al estudiante por **WhatsApp** o **Correo Institucional** con plantillas pre-redactadas.
4. Actualizar el estado de los llamados a **En Atención**, **Atendido** o **Cancelado**.
