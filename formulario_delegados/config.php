<?php
/**
 * ============================================================================
 * ARCHIVO DE CONFIGURACIÓN - FORMULARIO DE DELEGADOS 2026-2
 * Facultad de Ingeniería y Arquitectura — Universidad César Vallejo
 * ============================================================================
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
define('DB_NAME', '');           // Nombre de la BD en cPanel (ej. 'u123456_delegados')
define('DB_USER', 'root');       // Usuario de la BD (ej. 'u123456_admin')
define('DB_PASS', '');           // Contraseña de la BD
define('DB_CHARSET', 'utf8mb4');

// --- Configuración Institucional ---
define('APP_TITLE', '1RA REUNIÓN DE DELEGADOS 2026-2');
define('APP_FACULTAD', 'Facultad de Ingeniería y Arquitectura');
define('APP_SEMESTRE', '2026-2');

// --- Contraseña de Acceso al Panel de Respuestas (admin.php) ---
// Puedes cambiarla por la que desees
define('ADMIN_PASSWORD', 'ucv2026');

// --- Zona Horaria de Perú (GMT-5) ---
date_default_timezone_set('America/Lima');
