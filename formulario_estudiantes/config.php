<?php
/**
 * ============================================================================
 * ARCHIVO DE CONFIGURACIÓN - RESERVA DE ATENCIÓN ESTUDIANTIL 2026-2
 * Facultad de Ingeniería y Arquitectura — Universidad César Vallejo (UCV)
 * ============================================================================
 * SISTEMA AISLADO — Conexión nativa a Base de Datos SQL (MySQL / MariaDB)
 */

// --- Credenciales de Base de Datos MySQL (cPanel / Localhost) ---
define('DB_HOST',    'localhost');
define('DB_PORT',    '3306');
define('DB_NAME',    'classit_estudiantes_atenciones');
define('DB_USER',    'classit_admin_atencion');
define('DB_PASS',    'B*OBht$T_aBtOmE(');
define('DB_CHARSET', 'utf8mb4');

// --- Configuración Institucional ---
define('APP_TITLE',     'RESERVA DE ATENCIÓN ESTUDIANTIL 2026-2');
define('APP_FACULTAD',  'Facultad de Ingeniería y Arquitectura');
define('APP_SEMESTRE',  '2026-2');
define('HORARIO_TEXT',  'Lunes y Viernes • 7:00 PM a 9:00 PM');

// --- Contraseña de Acceso al Panel de Administración (admin.php) ---
define('ADMIN_PASSWORD', 'ucv2026');

// --- Credenciales para Descarga Protegida del Excel / CSV ---
define('DOWNLOAD_EMAIL', 'coordinacion.fia@ucvvirtual.edu.pe');
define('DOWNLOAD_PASS',  'AtencionesFIA2026');

// --- Zona Horaria de Perú (GMT-5) ---
date_default_timezone_set('America/Lima');
