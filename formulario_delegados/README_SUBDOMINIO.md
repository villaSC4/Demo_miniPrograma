# Guía de Despliegue en Subdominio cPanel
## Formulario: REUNIÓN DE DELEGADOS 2026-2
**Facultad de Ingeniería y Arquitectura — Universidad César Vallejo (UCV)**

Este proyecto es **100% independiente** del minisistema y está preparado para alojarse en su propio subdominio (por ejemplo: `delegados.tudominio.com` o `asistencia.tudominio.com`).

---

## 📦 Contenido del Paquete

| Archivo / Carpeta | Descripción |
|---|---|
| **`index.html`** | Formulario responsivo con el banner oficial de la reunión, validación en tiempo real y pantalla de confirmación. |
| **`submit.php`** | API que procesa y valida los datos de asistencia. |
| **`db.php`** | Capa de persistencia con soporte para **MySQL (PDO)** y auto-fallback local. |
| **`config.php`** | Configuración de credenciales de Base de Datos y contraseña del panel. |
| **`database.sql`** | Script SQL para crear la tabla en phpMyAdmin. |
| **`admin.php`** | Panel web en tiempo real para ver los delegados registrados y métricas. |
| **`exportar.php`** | Descarga instantánea de la lista de delegados a **Microsoft Excel** (CSV con UTF-8 BOM). |
| **`img/`** | Imagen de cabecera oficial (`banner_delegados.png`) y logo UCV. |
| **`css/`** y **`js/`** | Estilos modernos tipo tarjeta y scripts de control. |

---

## 🚀 Pasos de Instalación en cPanel (en 5 minutos)

### Paso 1: Crear el Subdominio en cPanel
1. Inicia sesión en tu **cPanel**.
2. Ve a la sección **Dominios** -> **Dominios** (o **Subdominios**).
3. Haz clic en **Crear un nuevo dominio** (Create a New Domain).
4. Escribe el subdominio deseado, por ejemplo:
   - Nombre: `delegados.tudominio.com`
   - Raíz del documento (Document Root): `delegados.tudominio.com` (o `public_html/delegados`).
5. Haz clic en **Enviar / Guardar**.

---

### Paso 2: Subir y Descomprimir los Archivos
1. Ve al **Administrador de Archivos** de cPanel.
2. Entra a la carpeta de tu subdominio (ej. `delegados.tudominio.com`).
3. Haz clic en **Cargar** (Upload) y sube el archivo:
   👉 **`delegados_deploy_cpanel.zip`**
4. Haz clic derecho sobre el ZIP y selecciona **Extract** (Extraer aquí).
5. Elimina el archivo ZIP para ahorrar espacio.

---

### Paso 3: Configurar la Base de Datos MySQL (Opcional pero Recomendado)

> **💡 Modo Automático Inteligente:** Si deseas usar el formulario de inmediato sin configurar MySQL, el sistema guardará automáticamente los registros en `data/delegados.db` (SQLite) o `data/delegados.json` sin arrojar ningún error.

Para vincularlo con **MySQL**:
1. En cPanel, abre **Bases de datos MySQL** (o *Asistente de bases de datos MySQL*).
2. Crea una nueva base de datos, por ejemplo: `miusuario_delegados`.
3. Crea un nuevo usuario con una contraseña segura, por ejemplo: `miusuario_admin`.
4. Asocia el usuario a la base de datos y marca la casilla **"Todos los privilegios"** (ALL PRIVILEGES).
5. Abre **phpMyAdmin** desde cPanel, selecciona la base de datos creada, ve a la pestaña **Importar** y selecciona el archivo **`database.sql`**.
6. En el Administrador de Archivos de cPanel, edita el archivo **`config.php`** y completa las credenciales:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'miusuario_delegados'); // Nombre de tu BD
define('DB_USER', 'miusuario_admin');     // Usuario de tu BD
define('DB_PASS', 'TuPasswordSeguro123*'); // Contraseña
```

---

## 📋 Enlaces del Sistema

- **Formulario para los Estudiantes / Delegados**:
  `https://delegados.tudominio.com/`

- **Panel de Respuestas y Control para Docentes/Directores**:
  `https://delegados.tudominio.com/admin.php`
  - **Contraseña por defecto**: `ucv2026` *(puedes cambiarla en `config.php`)*

- **Descarga de Reporte a Excel**:
  Dentro de `admin.php`, haz clic en el botón verde **"Exportar a Excel"** para descargar la lista completa en formato CSV compatible con Microsoft Excel con tildes y caracteres especiales intactos.
