# Sistema de Gestión Académica (SGA) — UCV Virtual (FIA: Sistemas & Industrial)

> **Guía de Contexto Arquitectónico y Operativo (AI / IDE Ready)**  
> Este documento describe la arquitectura completa, módulos, credenciales, reglas de negocio, aislamiento de perfiles y comandos de ejecución/despliegue para que cualquier desarrollador o asistente de IA comprenda el proyecto de inmediato.

---

## 1. Descripción General del Proyecto

El **Sistema de Gestión Académica (SGA) — UCV Virtual** es una plataforma web multi-módulo para la **Facultad de Ingeniería y Arquitectura (FIA)** de la Universidad César Vallejo (Filial Lima Norte), diseñada para gestionar dos Direcciones Académicas de Carrera (DAC):

1. **DAC Ingeniería de Sistemas** (`sistemas`)
2. **DAC Ingeniería Industrial** (`industrial`)

El proyecto es **híbrido y portable**:
- **En Desarrollo Local (Windows / Mac / Linux):** Funciona con un servidor unificado en Python (`server.py`, puerto `8000`) que sirve los archivos estáticos y emula todos los endpoints `/api/*` con persistencia física en `data/*.json` y SQLite (`data/usuarios.db`).
- **En Producción (cPanel / Apache + PHP + MySQL):** Funciona mediante `.htaccess` y los scripts en `api/*.php`, más subdominios independientes para los formularios públicos (`formulario_estudiantes/`, `formulario_docentes/`, `formulario_delegados/`).
- **En Serverless (Vercel):** Soportado mediante `vercel.json` y `api/*.js`.

---

## 2. Cómo Ejecutar el Proyecto en un Nuevo Equipo

### Requisitos Mínimos
- **Python 3.8+** (para levantar el servidor principal en el puerto `8000`).
- **Node.js 18+** *(Opcional, solo si se desea usar el microservicio de WhatsApp en vivo `whatsapp_service.js` en el puerto `3001`)*.

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/villaSC4/Demo_miniPrograma.git
cd Demo_miniPrograma
```

### Paso 2: Iniciar el Servidor Principal (Puerto 8000)
```bash
python server.py
```
Al iniciar `server.py`:
- Se crea e inicializa automáticamente la base de datos SQLite `data/usuarios.db` con las cuentas oficiales.
- Se autogeneran los archivos JSON de trabajo (`data/grupos.json`, `data/docentes.json`, etc.) a partir de las plantillas `data/*_base.json` si no existen.
- El sistema queda disponible en:
  - **Login:** `http://localhost:8000/login.html`
  - **Selector de DAC y Módulos:** `http://localhost:8000/selector.html`
  - **SGA Programación y Horarios (Módulo 1.2):** `http://localhost:8000/index.html`
  - **Docentes, Delegados y Supervisión (Módulo 1.1):** `http://localhost:8000/docentes_delegados.html`
  - **Central PAU & WhatsApp / Citas DAC (Módulo 1.3):** `http://localhost:8000/pau_whatsapp.html`
  - **Dashboard de Optimización Académica (Módulo 1.4):** `http://localhost:8000/optimizacion_academica.html`
  - **Rendimiento Académico Industrial — Formato UCV-VA-017 (Módulo 1.5):** `http://localhost:8000/rendimiento_industrial.html`
  - **Formulario PAE Estudiantes:** `http://localhost:8000/formulario_estudiantes/index.html`

### Paso 3 (Opcional): Microservicio de WhatsApp Web (Puerto 3001)
```bash
npm install
node whatsapp_service.js
```

---

## 3. Credenciales Oficiales y Control de Acceso por Rol

### A. Acceso al Sistema Principal (`login.html`)
La autenticación se valida en `server.py`, `api/login.php` y `api/login.js`, guardando el estado en `sessionStorage`:

| Perfil / Rol | Correo Institucional | Contraseña | Acceso DAC Permitido |
| :--- | :--- | :--- | :--- |
| **Coordinación General FIA** | `coordinacion.fia@ucvvirtual.edu.pe` | `DelegadosFIA2026` | **Ambas Escuelas** (DAC Sistemas + DAC Industrial) |
| **Coordinación DAC Industrial** | `coordinacion.fia.industrial@ucvvirtual.edu.pe` | `DelegadosFIA2727` | **Exclusivo DAC Industrial** (Sistemas oculto/bloqueado) |

> **Regla Crítica de Aislamiento (`sga_dac_restriction = 'industrial'`):**  
> Cuando inicia sesión `coordinacion.fia.industrial@ucvvirtual.edu.pe`:
> - `selector.html` salta automáticamente el Paso 1 (selección de escuela), elimina del DOM la tarjeta de Sistemas y el botón "Cambiar DAC", y muestra directamente los 5 módulos de **DAC Industrial**.
> - `index.html`, `docentes_delegados.html`, `optimizacion_academica.html` y `procedimiento.html` ocultan cualquier selector de Sistemas y fuerzan los datos de Ingeniería Industrial.
> - Todas las páginas verifican `sessionStorage.getItem('sga_logged_in') === 'true'` para evitar bucles de redirección entre `login.html` y `selector.html`.

### B. Credenciales de los Formularios Públicos (`formulario_estudiantes/`, `formulario_docentes/`, `formulario_delegados/`)

| Formulario / Módulo | Ventana "Validar Credenciales (Descargar Excel)" | Panel Admin (`admin.php`) |
| :--- | :--- | :--- |
| **PAE Atención Estudiantes (`formulario_estudiantes/`)** | Correo: `coordinacion.fia@ucvvirtual.edu.pe`<br>Clave: `AtencionesFIA2026` | Clave: `ucv2026` |
| **Registro de Docentes (`formulario_docentes/`)** | Correo: `coordinacion.fia@ucvvirtual.edu.pe`<br>Clave: `DocentesFIA2026` | Clave: `ucv2026` |
| **Registro de Delegados (`formulario_delegados/`)** | Correo: `coordinacion.fia@ucvvirtual.edu.pe`<br>Clave: `DelegadosFIA2026` | Clave: `ucv2026` |

---

## 4. Estructura de Archivos y Módulos

```text
├── login.html                      # Portal de inicio de sesión institucional UCV
├── selector.html                   # Selector de DAC (Sistemas / Industrial) y menú de módulos (1.1 a 1.5)
├── index.html                      # Módulo 1.2: Programación Académica, Cruces, Calendario y Reportes
├── docentes_delegados.html         # Módulo 1.1: Directorio de Docentes, Delegados de Aula y Supervisión
├── pau_whatsapp.html               # Módulo 1.3: Central PAU (Tickets, Correos, WhatsApp Live y Citas DAC)
├── optimizacion_academica.html     # Módulo 1.4: Dashboard de Optimización Académica (Turnos, Ciclos, Demanda)
├── rendimiento_industrial.html     # Módulo 1.5: Rendimiento Académico UCV-VA-017 (Exclusivo DAC Industrial)
├── procedimiento.html              # Manual interactivo y flujo de procedimientos del sistema
│
├── js/
│   ├── app.js                      # Lógica principal de programación académica y vistas de index.html
│   ├── parser.js                   # Motor de importación de archivos Excel de programación académica
│   ├── analytics.js                # Gráficos y métricas de programación académica
│   ├── sistemas_coordinacion.js    # Gestión de docentes, delegados, supervisión y calendario mensual
│   ├── pau.js                      # Lógica de la Central PAU y gestión de citas estudiantiles
│   ├── dashboard_optimizacion.js   # Controlador de gráficos y filtros de optimización académica
│   └── rendimiento_industrial.js   # Controlador y parser Excel de los 3 dashboards de Rendimiento Industrial
│
├── api/                            # Endpoints backend para Producción (PHP) y Serverless (NodeJS)
│   ├── login.php / login.js        # Autenticación de usuarios y perfiles por escuela
│   ├── grupos.php / grupos.js      # Persistencia de programación académica
│   ├── docentes.php                # Persistencia de directorio docente
│   ├── delegados.php               # Persistencia de delegados
│   ├── supervisiones.php           # Persistencia de supervisiones docentes
│   ├── pau.php / pau.js            # Persistencia de tickets PAU
│   ├── atenciones_dac.php          # Puente de lectura/escritura con citas estudiantiles (MySQL + JSON)
│   ├── dashboard_optimizacion.php  # API de datos de optimización académica
│   └── rendimiento_industrial.php  # API de persistencia para el módulo 1.5 de Rendimiento Industrial
│
├── data/                           # Almacenamiento JSON y plantillas base (*_base.json)
│   ├── rendimiento_industrial.json # Datos activos del Módulo 1.5 (Formato UCV-VA-017)
│   ├── rendimiento_industrial_base.json
│   ├── dashboard_optimizacion_data.json
│   ├── atenciones.json
│   └── *_base.json                 # Plantillas iniciales para grupos, docentes, delegados, etc.
│
├── formulario_estudiantes/         # Subdominio PAE (dac-atiende): Reserva de citas (Lunes: Sistemas | Viernes: Industrial)
├── formulario_docentes/            # Subdominio de registro de disponibilidad y firma de docentes
├── formulario_delegados/           # Subdominio de registro oficial de delegados de aula
│
├── server.py                       # Servidor local todo-en-uno (puerto 8000) con API REST integrada
├── whatsapp_service.js             # Microservicio Node.js con whatsapp-web.js (puerto 3001)
└── build_deploy_packages.py        # Generador automático de paquetes .zip listos para subir a cPanel
```

---

## 5. Detalles Clave de Módulos Recientes

### Módulo 1.5: Rendimiento Académico — DAC Industrial (`rendimiento_industrial.html` / `js/rendimiento_industrial.js`)
- Exclusivo para **Ingeniería Industrial** (Formato Institucional **UCV-VA-017**).
- Dividido en **3 pestañas conectadas**:
  1. **1. Dashboard Principal:** 4 tarjetas KPI (Total Matriculados, Estudiantes Evaluados, Tasa de Aprobación con Aprobados/Desaprobados, Promedio General Ponderado), alertas de asignaturas en riesgo/sobresalientes y tabla consolidada de 12 columnas por asignatura.
  2. **2. Base de Datos UCV:** Tabla granular por sección y docente con buscador y filtros por ciclo, docente y estado.
  3. **3. Dashboards y Cálculos:** 4 gráficos interactivos en Chart.js (Rendimiento por Ciclo, Dona de Distribución de Notas `0-10`, `11-15`, `16-20`, Tasa de Aprobación por Asignatura e Inhabilitaciones) + tabla detallada de cálculos por sección.
- **Subida de Excel (`.xlsx`):** Permite arrastrar o seleccionar cualquier reporte oficial UCV-VA-017; recalcula automáticamente las 3 pestañas y guarda los cambios en `data/rendimiento_industrial.json` mediante `api/rendimiento_industrial.php` (o `server.py`). Maneja correctamente valores en `0` (usando `?? 0`), porcentajes con `%` y descarta filas vacías o con `#REF!`.

### Plataforma de Atención al Estudiante — PAE (`formulario_estudiantes/`)
- Permite a los alumnos reservar turnos de **15 minutos** entre las **7:00 PM y 9:00 PM** (8 turnos por día):
  - **Lunes:** Exclusivo para **Ingeniería de Sistemas**.
  - **Viernes:** Exclusivo para **Ingeniería Industrial**.
- Bloquea en tiempo real los horarios ya reservados consultando `api_atenciones.php`.

---

## 6. Empaquetado para Despliegue en cPanel

Cuando se realicen cambios en el código y se desee generar los paquetes `.zip` actualizados para subir a **cPanel**, basta con ejecutar:

```bash
python build_deploy_packages.py
```

Este script genera automáticamente:
1. `deploy_1_minisistema_actualizacion.zip` (y su espejo `cpanel_update_minisistema.zip`): Contiene todas las páginas, scripts `js/`, `api/` y `data/` para el dominio principal (`uvsube.class-it.edu.pe`).
2. `deploy_2_subdominio_dac_atiende.zip` (y su espejo `formulario_estudiantes_cpanel.zip`): Contiene el módulo PAE actualizado para el subdominio de atención estudiantil (`dac-atiende.class-it.edu.pe`).

