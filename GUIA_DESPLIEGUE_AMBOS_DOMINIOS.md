# 🚀 Guía Maestra de Despliegue en cPanel: Ambos Proyectos
**Facultad de Ingeniería y Arquitectura — Universidad César Vallejo (UCV)**

Tienes **2 paquetes ZIP independientes** listos en la raíz del proyecto para desplegarse en dominios/subdominios distintos:

---

## 📦 Resumen de los 2 Paquetes de Despliegue

| Archivo ZIP | Destino Recomendado | Descripción |
|---|---|---|
| **`cpanel_deploy_minisistema.zip`** *(660 KB)* | Dominio Principal o Subdominio (ej: `public_html/` o `sga.class-it.edu.pe`) | **Sistema de Gestión Académica (Minisistema)** con login institucional, matriz modular, directorio docente, evaluación EDD 2026-2, auditoría de carpetas y los botones de redirección hacia el formulario. |
| **`delegados_deploy_cpanel.zip`** *(431 KB)* | Subdominio: **`reg-asistencia-1.class-it.edu.pe`** | **Portal Oficial de Asistencia de Delegados** con banner UCV, selector de las 2 escuelas (Industrial y Sistemas), ciclos I-X, persistencia en BD, panel de control (`admin.php`) y exportación a Excel. |

---

## 🛠️ PASO A PASO: Despliegue en cPanel

### PARTE 1: Desplegar el Formulario de Asistencia
**Destino:** `reg-asistencia-1.class-it.edu.pe`

1. **Crear el Subdominio en cPanel**:
   - Ingresa a tu cPanel.
   - Ve a **Dominios** ➔ **Dominios** (o *Subdominios*).
   - Clic en **Crear un nuevo dominio** (Create a New Domain).
   - Escribe el nombre exacto:
     - **Dominio:** `reg-asistencia-1.class-it.edu.pe`
     - **Raíz del documento (Document Root):** `public_html/reg-asistencia-1` (o la carpeta asignada automáticamente).
   - Guarda los cambios.

2. **Subir y Extraer el ZIP**:
   - Abre el **Administrador de Archivos** de cPanel.
   - Entra a la carpeta del subdominio (`reg-asistencia-1.class-it.edu.pe` o `public_html/reg-asistencia-1`).
   - Clic en **Cargar** (Upload) y sube:
     👉 **`delegados_deploy_cpanel.zip`**
   - Haz clic derecho sobre el archivo subido y selecciona **Extract** (Extraer aquí).
   - *Elimina el ZIP para mantener limpio el espacio.*

3. **Configurar la Base de Datos MySQL**:
   - En cPanel, abre **Bases de datos MySQL**.
   - Crea una nueva base de datos (ejemplo: `usuario_delegados`).
   - Crea un usuario de base de datos con contraseña segura (ejemplo: `usuario_admin`).
   - Añade el usuario a la base de datos y marca **"Todos los privilegios"** (ALL PRIVILEGES).
   - Abre **phpMyAdmin**, selecciona la base de datos creada, ve a la pestaña **Importar** y sube el archivo **`database.sql`** que está dentro de la carpeta.
   - En el Administrador de Archivos de cPanel, edita el archivo **`config.php`** y coloca tus datos:
     ```php
     define('DB_HOST', 'localhost');
     define('DB_NAME', 'usuario_delegados'); // Nombre de tu BD
     define('DB_USER', 'usuario_admin');     // Usuario de BD
     define('DB_PASS', 'TuPassword123*');    // Contraseña
     ```
   > **Nota:** Si no deseas configurar MySQL de inmediato, el sistema guardará automáticamente en SQLite/JSON local sin arrojar ningún error 500.

4. **Probar el Formulario**:
   - Formulario para alumnos: `https://reg-asistencia-1.class-it.edu.pe/`
   - Panel de control de asistencia: `https://reg-asistencia-1.class-it.edu.pe/admin.php` *(Contraseña: `ucv2026`)*.

---

### PARTE 2: Desplegar el Minisistema Académico Principal
**Destino:** Dominio principal (ej: `public_html/` o subdominio `sga.class-it.edu.pe`)

1. **Subir y Extraer el ZIP**:
   - Abre el **Administrador de Archivos** de cPanel.
   - Ve a la carpeta raíz de tu sistema (ej: `public_html/`).
   - Clic en **Cargar** (Upload) y sube:
     👉 **`cpanel_deploy_minisistema.zip`**
   - Haz clic derecho sobre el ZIP y selecciona **Extract** (Extraer aquí).
   - *Elimina el ZIP tras extraer.*

2. **Verificar Permisos de Escritura**:
   - Asegúrate de que la carpeta **`data/`** tenga permisos de escritura (`755` o `775`) para que el archivo `data/grupos.json`, `docentes.json`, etc., puedan guardar los cambios permanentemente.

3. **Probar la Integración**:
   - Accede a tu minisistema en el navegador.
   - En la barra superior (Navbar), en la tarjeta de áreas y en la barra de pestañas verás el botón:
     👉 **`Asistencia Delegados ↗`**
   - Al hacer clic, se abrirá automáticamente una nueva pestaña dirigida a:
     `https://reg-asistencia-1.class-it.edu.pe`

---

## 🔒 Accesos y Credenciales Predeterminadas

| Aplicación | URL | Usuario / Clave |
|---|---|---|
| **Minisistema (Login)** | `https://tudominio.com/login.html` | Usuario: `admin@ucvvirtual.edu.pe` / Clave: `ucv2026` |
| **Formulario de Delegados** | `https://reg-asistencia-1.class-it.edu.pe/` | Acceso público para estudiantes |
| **Panel de Asistencia Delegados** | `https://reg-asistencia-1.class-it.edu.pe/admin.php` | Contraseña: `ucv2026` |

---

¡Ambos proyectos están listos para producción y 100% probados!
