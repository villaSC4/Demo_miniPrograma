# 🚀 Guía de Despliegue en cPanel: Control de Asistencia Docente 2026-2
### Facultad de Ingeniería y Arquitectura — Universidad César Vallejo (UCV)

Sigue estos 4 pasos sencillos para subir y dejar funcionando el sistema al 100% en tu hosting cPanel.

---

## 🗄️ PASO 1: Crear la Base de Datos MySQL en cPanel

1. Ingresa a tu panel de control **cPanel**.
2. En la sección **Bases de datos**, haz clic en **"Bases de datos MySQL"** (o en el **Asistente de bases de datos MySQL**).
3. **Crear nueva base de datos**:
   - Escribe un nombre, por ejemplo: `docentes`
   - El nombre completo será algo como: `tuusuario_docentes` *(anota este nombre)*.
4. **Crear usuario de base de datos**:
   - Nombre de usuario: ej. `user_docentes` (nombre completo: `tuusuario_user_docentes`).
   - Contraseña: genera una contraseña segura (ej: `UcvDocentes2026!#`) *(anota la contraseña)*.
5. **Añadir usuario a la base de datos**:
   - Selecciona el usuario y la base de datos que acabas de crear.
   - Haz clic en **Añadir**.
   - Marca la casilla **"TODOS LOS PRIVILEGIOS"** (ALL PRIVILEGES).
   - Haz clic en **Hacer cambios**.

---

## 📥 PASO 2: Importar la Base de Datos en phpMyAdmin

1. Regresa a la pantalla principal de cPanel y abre **phpMyAdmin**.
2. En la columna izquierda, haz clic sobre el nombre de la base de datos que creaste (`tuusuario_docentes`).
3. En el menú superior, haz clic en la pestaña **"Importar"**.
4. Haz clic en **"Seleccionar archivo"** y elige el archivo:
   `database.sql` (que se encuentra dentro de la carpeta `formulario_docentes`).
5. Baja hasta el final de la página y haz clic en el botón **"Importar"** (o "Continuar").
6. Verás un mensaje verde de confirmación: *"La importación se ejecutó exitosamente"*. Se habrá creado la tabla `docentes_asistencia`.

---

## 📂 PASO 3: Subir los Archivos a cPanel

Tienes 2 opciones para subirlo:

### Opción A (Recomendada con el archivo ZIP generado):
1. En cPanel, abre el **"Administrador de archivos"** (File Manager).
2. Entra a la carpeta **`public_html`** (o a la subcarpeta/subdominio donde desees colocarlo, por ejemplo `public_html/formulario_docentes`).
3. Haz clic en el botón superior **"Cargar"** (Upload).
4. Sube el archivo **`formulario_docentes_cpanel.zip`**.
5. Vuelve al Administrador de archivos, haz clic derecho sobre el ZIP y selecciona **"Extraer"** (Extract).
6. Si deseas que se abra directamente desde tu dominio (ej: `tudominio.com`), asegúrate de que los archivos estén en la raíz de `public_html`. Si deseas que esté en `tudominio.com/docentes/`, colócalos dentro de esa carpeta.

---

## ⚙️ PASO 4: Verificación de `config.php` (¡Ya Preconfigurado!)

El archivo **`config.php`** ya quedó preconfigurado con tus credenciales de cPanel:

```php
// --- Credenciales de Base de Datos MySQL (cPanel) ---
define('DB_HOST',    'localhost');
define('DB_PORT',    '3306');
define('DB_NAME',    'classit_profesores');
define('DB_USER',    'classit_admin_docente');
define('DB_PASS',    '_hW47[.zyzSl_c3H');
define('DB_CHARSET', 'utf8mb4');
```

Por lo tanto, una vez que importes la base de datos en phpMyAdmin (Paso 2) y extraigas el ZIP (Paso 3), **el sistema ya estará listo para funcionar sin necesidad de editar nada más**.

---

## 🔒 PASO 5: Permisos de la Carpeta de Firmas

1. En el Administrador de archivos, verifica que la carpeta:
   `data/firmas/` tenga permisos **`755`** (o `777` si tu hosting tiene restricciones de escritura).
2. Gracias al archivo `.htaccess` ya configurado, los visitantes no podrán descargar ni ver las firmas directamente por URL; solo tú como administrador podrás verlas desde el panel con tu sesión autenticada.

---

## 🔑 Credenciales de Acceso al Sistema

- **Formulario de Registro Docente:**
  `https://tudominio.com/formulario_docentes/` (o tu dominio/subdominio).
- **Panel Administrativo:**
  `https://tudominio.com/formulario_docentes/admin.php`  
  **Contraseña:** `ucv2026`
- **Descargar Excel desde el Formulario (Modal):**  
  **Correo:** `coordinacion.fia@ucvvirtual.edu.pe`  
  **Contraseña:** `DocentesFIA2026`
