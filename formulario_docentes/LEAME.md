# Sistema de Control de Asistencia Docente 2026-2
### Facultad de Ingeniería y Arquitectura — Universidad César Vallejo (UCV)

Este sistema es una aplicación web **totalmente independiente y aislada** del formulario de delegados, con persistencia exclusiva en **Base de Datos SQL (MySQL / MariaDB)**.

---

## 🚀 Campos Oficiales del Formulario

### I. Datos del Docente
- **Apellidos y Nombres Completos** *(Obligatorio)*
- **Código de Docente UCV** *(Obligatorio - Código institucional asignado)*
- **DNI (Documento Nacional de Identidad)** *(Obligatorio - 8 dígitos numéricos)*
- **Correo Electrónico** *(Recomendado - Institucional o personal)*

### II. Asignatura y Escuela Profesional
- **Escuela Profesional** *(Obligatorio - Ingeniería Industrial / Ingeniería de Sistemas)*
- **Asignatura(s) que Dicta** *(Obligatorio)*
- **Sección / Grupo de Aula** *(Obligatorio - Ej. A1, B2 o Grupo 01)*
- **Ciclo Académico** *(Obligatorio - Selector de 10 botones: Ciclo I al Ciclo X)*

### III. Observaciones
- **Observaciones o Comentarios Adicionales** *(Opcional - Texto libre para licencias, permisos, etc.)*

### IV. Firma Digital
- **Canvas Interactivo** *(Obligatorio - Dibujo con ratón o pantalla táctil, con botón para borrar trazos y guardado en archivo PNG)*

### V. Conformidad y Protección de Datos
- **Declaración Jurada y Autorización** *(Obligatorio - Checkbox de aceptación)*

---

## 🗄️ Base de Datos SQL (MySQL / MariaDB)

El sistema opera directamente sobre **MySQL**:
- **Base de Datos**: `asistencia_docentes`
- **Tabla**: `docentes_asistencia`
- **Script de creación**: [`database.sql`](file:///c:/Users/Usuario/Desktop/demo%20minisistema/formulario_docentes/database.sql)

### Estructura de la Tabla `docentes_asistencia`
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | INT UNSIGNED AUTO_INCREMENT | Identificador único |
| `apellidos_nombres` | VARCHAR(255) | Apellidos y nombres completos |
| `codigo_docente` | VARCHAR(50) | Código institucional UCV |
| `dni` | VARCHAR(20) | Documento Nacional de Identidad (8 dígitos) |
| `correo` | VARCHAR(150) | Correo electrónico |
| `escuela_profesional` | VARCHAR(150) | Escuela profesional |
| `asignatura` | VARCHAR(255) | Asignatura que dicta |
| `seccion` | VARCHAR(100) | Sección o grupo de aula (Ej. A1, B2) |
| `ciclo` | VARCHAR(20) | Ciclo académico (Ciclo I al X) |
| `observaciones` | TEXT | Comentarios u observaciones |
| `firma_archivo` | VARCHAR(255) | Nombre del archivo PNG de la firma |
| `declaracion_aceptada` | TINYINT(1) | 1 si aceptó conformidad |
| `ip_registro` | VARCHAR(50) | Dirección IP del cliente |
| `user_agent` | VARCHAR(255) | Dispositivo / Navegador |
| `fecha_registro` | DATETIME | Fecha y hora exacta del registro |

---

## ⚙️ Configuración (`config.php`)

```php
// Credenciales para Localhost (Wamp / XAMPP):
define('DB_HOST',    'localhost');
define('DB_PORT',    '3306');
define('DB_NAME',    'asistencia_docentes');
define('DB_USER',    'root');
define('DB_PASS',    '');
define('DB_CHARSET', 'utf8mb4');
```

*Si despliegas en cPanel, simplemente crea la base de datos MySQL, importa `database.sql` y actualiza `DB_NAME`, `DB_USER` y `DB_PASS`.*

---

## 🔐 Credenciales de Acceso

| Módulo | Usuario / Correo | Contraseña |
| :--- | :--- | :--- |
| **Panel Administrativo (`admin.php`)** | *(Solo contraseña)* | `ucv2026` |
| **Descarga Directa (Modal Excel)** | `coordinacion.fia@ucvvirtual.edu.pe` | `DocentesFIA2026` |
