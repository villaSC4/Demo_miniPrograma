# Sistema de Reserva de Atención Estudiantil 2026-2
### Facultad de Ingeniería y Arquitectura — Universidad César Vallejo (UCV)

Este sistema es un módulo web **totalmente independiente y aislado**, desarrollado para permitir a los estudiantes registrar y programar atenciones personalizadas (**Reclamos** y **Solicitudes**) con la Coordinación Académica.

---

## 🚀 Campos Oficiales del Formulario

1. **Nombres y Apellidos Completos** *(Obligatorio)*
2. **Código de Alumno UCV** *(Obligatorio)*
3. **Carrera Profesional** *(Obligatorio - Combobox: Ingeniería de Sistemas, Ingeniería Industrial)*
4. **Correo Institucional** *(Obligatorio - formato `@ucvvirtual.edu.pe`)*
5. **Tipo de Atención** *(Obligatorio - Combobox: `Reclamo` o `Solicitud`)*
6. **Horario de Atención** *(Obligatorio - Selector interactivo de Lunes y Jueves de 7:00 PM a 9:00 PM)*
   - Días disponibles: **Lunes (Ing. de Sistemas)** y **Jueves (Ing. Industrial)**
   - Franjas horarias: **8 franjas de 15 minutos** (7:00 PM a 9:00 PM)
7. **Detalle o Motivo** *(Recomendado - Breve descripción del caso)*
8. **Botón ENVIAR** *(Procesamiento asíncrono con generación de ticket oficial)*

---

## 🗄️ Base de Datos SQL (MySQL / MariaDB)

El sistema opera directamente sobre **MySQL**:
- **Tabla**: `estudiantes_atenciones`
- **Script de creación**: [`database.sql`](file:///c:/Users/Usuario/Desktop/demo%20minisistema/formulario_estudiantes/database.sql)

### Estructura de la Tabla `estudiantes_atenciones`
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | INT UNSIGNED AUTO_INCREMENT | Identificador único |
| `codigo_ticket` | VARCHAR(30) UNIQUE | Código de ticket único (Ej: `ATN-2026-7842`) |
| `nombres_completos` | VARCHAR(255) | Apellidos y nombres completos |
| `codigo_alumno` | VARCHAR(20) | Código institucional del alumno |
| `carrera_profesional` | VARCHAR(150) | Carrera o escuela profesional |
| `correo_institucional` | VARCHAR(150) | Correo institucional UCV |
| `tipo_atencion` | ENUM('Reclamo','Solicitud') | Tipo de atención requerida |
| `dia_atencion` | VARCHAR(50) | Día elegido (Lunes a Jueves) |
| `horario_atencion` | VARCHAR(50) | Franja horaria (7:00 PM a 9:00 PM) |
| `detalle_motivo` | TEXT | Fundamentación o descripción del reclamo/solicitud |
| `estado` | ENUM | `Pendiente`, `En Atención`, `Atendido`, `Cancelado` |
| `observaciones_coordinacion`| TEXT | Notas de seguimiento y resolución de Coordinación |
| `ip_registro` | VARCHAR(50) | IP del cliente solicitante |
| `user_agent` | VARCHAR(255) | Navegador o dispositivo |
| `fecha_registro` | DATETIME | Fecha y hora exacta de registro |

---

## ⚙️ Configuración (`config.php`)

```php
define('DB_HOST',    'localhost');
define('DB_PORT',    '3306');
define('DB_NAME',    'classit_profesores');
define('DB_USER',    'classit_admin_docente');
define('DB_PASS',    '_hW47[.zyzSl_c3H');
define('DB_CHARSET', 'utf8mb4');
```

*Si se despliega en cPanel, simplemente crea la base de datos o agrégala a la existente, importa `database.sql` y verifica `DB_NAME`, `DB_USER` y `DB_PASS`.*

---

## 🔐 Credenciales de Acceso

| Módulo | Usuario / Correo | Contraseña |
| :--- | :--- | :--- |
| **Panel Administrativo (`admin.php`)** | *(Solo contraseña)* | `ucv2026` |
| **Descarga Directa (Modal Excel)** | `coordinacion.fia@ucvvirtual.edu.pe` | `AtencionesFIA2026` |
