<?php
/**
 * ============================================================================
 * ARCHIVO DE CONFIGURACIÓN DE EJEMPLO - FORMULARIO DE DELEGADOS 2026-2
 * Facultad de Ingeniería y Arquitectura — Universidad César Vallejo
 * ============================================================================
 *
 * INSTRUCCIONES:
 * 1. Copia este archivo y renómbralo como: config.php
 * 2. Rellena los valores con tus propias credenciales.
 * 3. NUNCA subas config.php a Git (ya está en .gitignore).
 *
 * Si despliegas en cPanel:
 * 1. Crea una base de datos en cPanel -> "Bases de datos MySQL".
 * 2. Asigna un usuario y dale "Todos los privilegios".
 * 3. Coloca aquí los datos generados.
 *
 * NOTA: Si dejas DB_NAME vacío o MySQL no está configurado, el sistema
 * funcionará automáticamente usando SQLite local (data/delegados.db) o JSON,
 * garantizando que NUNCA falle ni arroje error 500.
 */

// --- Credenciales de Base de Datos MySQL (cPanel) ---
define('DB_HOST', 'localhost');
define('DB_NAME', '');          // Ej: cpanelusr_delegados
define('DB_USER', '');          // Ej: cpanelusr_admin
define('DB_PASS', '');          // Tu contraseña MySQL
define('DB_CHARSET', 'utf8mb4');

// --- Configuración Institucional ---
define('APP_TITLE',    'REUNIÓN DE DELEGADOS 2026-2');
define('APP_FACULTAD', 'Facultad de Ingeniería y Arquitectura');
define('APP_SEMESTRE', '2026-2');

// --- Contraseña de Acceso al Panel de Respuestas (admin.php) ---
define('ADMIN_PASSWORD', 'cambiar_esta_clave');

// --- Credenciales para Descarga Protegida del Excel (desde el formulario) ---
define('DOWNLOAD_EMAIL', 'correo@tudominio.edu.pe');
define('DOWNLOAD_PASS',  'CambiarEstaPassword');

// --- Zona Horaria ---
date_default_timezone_set('America/Lima');
