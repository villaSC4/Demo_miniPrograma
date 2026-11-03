# 🚀 Guía de Despliegue en cPanel: Actualización Minisistema & Formulario PAE
**Facultad de Ingeniería y Arquitectura — Universidad César Vallejo (UCV)**

---

## 📦 Paquetes de Despliegue Generados

| Paquete ZIP | Destino en cPanel | Propósito |
|---|---|---|
| **`deploy_1_minisistema_actualizacion.zip`** *(102 KB)* | Carpeta raíz del Minisistema actual (ej: `public_html/`) | **Actualización del Minisistema:** Renombrado a **PAE (Plataforma de Atención al Estudiante)** en `index.html`, `selector.html`, `pau_whatsapp.html`, `js/pau.js`, y módulo integrado de **Atención DAC • Citas Virtuales**. |
| **`deploy_2_subdominio_dac_atiende.zip`** *(218 KB)* | Carpeta raíz del Subdominio **`dac-atiende.class-it.edu.pe`** | **Formulario Público de Estudiantes:** Rediseño Cyber-Glass split-screen con lateral izquierdo 100% fijo, 4 turnos de 30 min por día, validación en tiempo real de horarios tomados, 3 canales directos y conexión directa a MySQL. |

*(Nota: También se actualizaron copias espejo con los nombres `cpanel_update_minisistema.zip` y `formulario_estudiantes_cpanel.zip` por compatibilidad).*

---

## 🔄 ¿Cómo se comunican entre sí ambos dominios?

Dado que el **Minisistema Docente** y el **Formulario de Estudiantes** residen en dominios/subdominios separados, la comunicación está blindada mediante un modelo híbrido:

```
[Estudiante en dac-atiende.class-it.edu.pe]
                      │
                      ▼ (POST submit.php)
       ┌──────────────────────────────┐
       │   MySQL Localhost (cPanel)   │
       │ classit_estudiantes_atenciones│
       └──────────────────────────────┘
                      ▲
                      │ (SELECT / UPDATE atenciones_dac.php)
[Docente en Minisistema pau_whatsapp.html]
```

1. **Base de Datos Compartida:**
   - Ambos sistemas se ejecutan sobre el mismo cPanel y se conectan directamente a `localhost:3306` utilizando la misma base de datos MySQL (`classit_estudiantes_atenciones`).
   - Cuando el alumno reserva su turno, `submit.php` inserta el registro inmediatamente en la tabla `estudiantes_atenciones`.
   - Cuando el docente abre `pau_whatsapp.html` (pestaña **Atención DAC • Citas**), el endpoint `api/atenciones_dac.php` lee la misma tabla MySQL en tiempo real, permitiendo ver las reservas al instante y cambiar estados (*En Atención*, *Atendido*, asignar sala Zoom).

2. **CORS y API REST Bidireccional:**
   - Los endpoints `api_atenciones.php` y `api/atenciones_dac.php` incorporan cabeceras `Access-Control-Allow-Origin: *`, permitiendo consultas asíncronas entre subdominios sin bloqueos del navegador.

3. **Copia de Respaldo JSON:**
   - En caso de cualquier corte imprevisto de MySQL, ambos sistemas sincronizan un archivo `data/atenciones.json` como respaldo a prueba de fallos.

---

## 🛠️ PASO A PASO: Instalación en cPanel

### PASO 1: Base de Datos MySQL (si aún no la importó)
*Las credenciales ya vienen 100% preconfiguradas en el código:*
* **Nombre de BD:** `classit_estudiantes_atenciones`
* **Usuario:** `classit_admin_atencion`
* **Contraseña:** `B*OBht$T_aBtOmE(`

1. En cPanel, abra **phpMyAdmin**.
2. Seleccione la base de datos `classit_estudiantes_atenciones`.
3. Vaya a la pestaña **Importar** (Import).
4. Suba el archivo **`database.sql`** (incluido dentro de `deploy_2_subdominio_dac_atiende.zip`) y haga clic en **Importar**.
5. Esto creará la tabla `estudiantes_atenciones` con todos sus índices y columnas (`link_zoom`, `horario_atencion`, etc.).

---

### PASO 2: Actualizar el Minisistema Principal
**Archivo:** `deploy_1_minisistema_actualizacion.zip`

1. En cPanel, abra el **Administrador de Archivos** (File Manager).
2. Diríjase a la carpeta raíz donde ya tiene instalado su Minisistema (generalmente `public_html/`).
3. Haga clic en **Cargar** (Upload) y suba **`deploy_1_minisistema_actualizacion.zip`**.
4. Haga clic derecho sobre el archivo ZIP subido y elija **Extract** (Extraer aquí).
5. Confirme la extracción. Sobrescribirá los archivos actualizados (`index.html`, `selector.html`, `pau_whatsapp.html`, `api/`, `js/`, `data/`) sin borrar ningún otro dato.
6. Elimine el archivo ZIP para liberar espacio.

---

### PASO 3: Desplegar el Formulario en el Subdominio
**Archivo:** `deploy_2_subdominio_dac_atiende.zip`

1. En cPanel, vaya a **Dominios** y verifique que el subdominio **`dac-atiende.class-it.edu.pe`** esté creado apuntando a su carpeta raíz (por ejemplo `public_html/dac-atiende`).
2. Abra el **Administrador de Archivos** y entre a la carpeta del subdominio (`public_html/dac-atiende`).
3. Haga clic en **Cargar** (Upload) y suba **`deploy_2_subdominio_dac_atiende.zip`**.
4. Haga clic derecho sobre el archivo y elija **Extract** (Extraer aquí).
5. Verifique que los archivos (`index.html`, `submit.php`, `config.php`, `css/`, `img/`, `js/`, etc.) queden ubicados directamente en la raíz del subdominio.
6. Elimine el archivo ZIP.

---

## 🌟 Novedades y Mejoras Incluidas

### 1. Formulario de Estudiantes (`dac-atiende.class-it.edu.pe`)
- **Panel Izquierdo 100% Fijo:** La columna izquierda institucional (`.hero-wrapper`) permanece completamente fija e inmóvil mientras el usuario navega verticalmente por el formulario, brindando una experiencia premium de escritorio.
- **Rendimiento Óptimo (60-120 FPS):** Se eliminaron los filtros de desenfoque GPU pesados en bucle, reemplazándolos por gradientes CSS radiales vectoriales de alta velocidad sin lag.
- **4 Franjas Horarias de 30 Minutos:**
  - `7:00 PM - 7:30 PM`
  - `7:30 PM - 8:00 PM`
  - `8:00 PM - 8:30 PM`
  - `8:30 PM - 9:00 PM`
- **Validación de Ocupabilidad en Tiempo Real:** El sistema consulta la base de datos al seleccionar el día (Lunes, Martes, Miércoles o Jueves); si un turno ya fue reservado, el botón se bloquea automáticamente con un badge rojo **«Ocupado»** y previene duplicados.
- **3 Canales Directos:**
  1. Correo Institucional de la Escuela.
  2. WhatsApp Oficial de Contacto.
  3. Enlace Zoom Permanente de la Escuela (con modal explicativo de que es sala general, independiente a la cita privada reservada en PAE).

### 2. Minisistema Docente
- **Renombrado Integral a PAE:** Todas las vistas, tarjetas de procedimiento, modales, selectores y mensajes dicen ahora **PAE, Plataforma de Atención al Estudiante**.
- **Módulo de Atención DAC Integrado:** Pestaña completa en `pau_whatsapp.html` para visualizar llamados, asignar sala virtual, cambiar estados a *En Atención* / *Atendido* y convocar al estudiante por WhatsApp o correo con plantillas pre-redactadas.
- **Exportación en Excel:** Reportes actualizados bajo el formato institucional oficial.
