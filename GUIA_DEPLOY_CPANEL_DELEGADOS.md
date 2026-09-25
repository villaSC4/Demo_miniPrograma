# Guía de Deploy en cPanel — Formulario de Delegados 2026-2
**Subdominio:** reg-asistencia-1.class-it.edu.pe

---

## PASO 1 — Crear base de datos MySQL en cPanel

1. Ingresar a **cPanel** → sección **"Bases de datos MySQL"**
2. En "Crear nueva base de datos":  
   `Nombre: classit_delegados` → clic **Crear base de datos**
3. En "Usuarios de MySQL" → Crear usuario:  
   `Usuario: classit_admin`  
   `Contraseña: uClItY=)iRO_EO_s`
4. En "Añadir usuario a la base de datos":  
   Seleccionar **classit_admin** + **classit_delegados** → **Todos los privilegios**
5. Ir a **phpMyAdmin** → seleccionar `classit_delegados` → pestaña **SQL** → pegar y ejecutar el contenido de `database.sql`

---

## PASO 2 — Subir archivos al subdominio

1. En cPanel → **"Subdominios"** → asegurarse de que:
   `reg-asistencia-1.class-it.edu.pe` apunte a `/public_html/reg-asistencia-1`
2. Ir a **Administrador de Archivos** → entrar a `/public_html/reg-asistencia-1`
3. Subir el archivo **`delegados_cpanel_deploy.zip`**
4. Click derecho sobre el ZIP → **Extraer** → extraer en la carpeta actual
5. Verificar que la estructura quede así:

```
/public_html/reg-asistencia-1/
├── .htaccess
├── index.html
├── config.php          ← credenciales ya configuradas
├── submit.php
├── descargar.php
├── admin.php
├── db.php
├── database.sql
├── exportar.php
├── css/style.css
├── js/form.js
├── img/
│   ├── logo-ucv.png
│   └── banner_delegados.png
└── data/
    └── .htaccess       ← protege la carpeta (acceso denegado)
```

---

## PASO 3 — Verificar permisos

En Administrador de Archivos:
- Carpeta `data/` → permisos **755**
- Archivos PHP → permisos **644**
- `.htaccess` → permisos **644**

---

## PASO 4 — Probar

| URL | Función |
|-----|---------|
| `https://reg-asistencia-1.class-it.edu.pe` | Formulario de registro |
| `https://reg-asistencia-1.class-it.edu.pe/admin.php` | Panel admin (pass: `ucv2026`) |

### Credenciales de descarga Excel:
- **Correo:** `coordinacion.fia@ucvvirtual.edu.pe`
- **Contraseña:** `DelegadosFIA2026`

---

## config.php — Valores ya configurados

```php
define("DB_HOST",  "localhost");
define("DB_NAME",  "classit_delegados");  // BD creada en Paso 1
define("DB_USER",  "classit_admin");
define("DB_PASS",  "uClItY=)iRO_EO_s");
define("ADMIN_PASSWORD",  "ucv2026");
define("DOWNLOAD_EMAIL",  "coordinacion.fia@ucvvirtual.edu.pe");
define("DOWNLOAD_PASS",   "DelegadosFIA2026");
```

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| Error 500 al enviar formulario | Verificar permisos PHP y que la BD esté creada |
| "No se puede conectar a MySQL" | El sistema cae automáticamente a SQLite — funciona igual |
| Caracteres raros en Excel | El CSV usa Windows-1252, compatible con Excel en español |
| No se puede acceder a `data/` | Normal — está bloqueado por .htaccess (seguridad) |
