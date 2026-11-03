<?php
/**
 * ============================================================================
 * ARCHIVO DE CONFIGURACIÓN - CONTROL DE ASISTENCIA DOCENTE 2026-2
 * Facultad de Ingeniería y Arquitectura — Universidad César Vallejo
 * ============================================================================
 * SISTEMA AISLADO — Conexión nativa a Base de Datos SQL (MySQL / MariaDB)
 *
 * Configuración para Localhost (WAMP / XAMPP):
 * - DB_HOST: localhost
 * - DB_PORT: 3306
 * - DB_NAME: asistencia_docentes
 * - DB_USER: root
 * - DB_PASS: (vacío)
 *
 * Si despliegas en cPanel:
 * 1. Crea una base de datos nueva en cPanel -> "Bases de datos MySQL".
 * 2. Importa el archivo database.sql.
 * 3. Asigna un usuario y dale "Todos los privilegios".
 * 4. Actualiza aquí DB_NAME, DB_USER y DB_PASS.
 */

// --- Credenciales de Base de Datos MySQL (cPanel) ---
define('DB_HOST',    'localhost');
define('DB_PORT',    '3306');
define('DB_NAME',    'classit_profesores');
define('DB_USER',    'classit_admin_docente');
define('DB_PASS',    '_hW47[.zyzSl_c3H');
define('DB_CHARSET', 'utf8mb4');

// --- Configuración Institucional ---
define('APP_TITLE',    'CONTROL DE ASISTENCIA DOCENTE 2026-2');
define('APP_FACULTAD', 'Facultad de Ingeniería y Arquitectura');
define('APP_SEMESTRE', '2026-2');

// --- Contraseña de Acceso al Panel de Respuestas (admin.php) ---
define('ADMIN_PASSWORD', 'ucv2026');

// --- Credenciales para Descarga Protegida del Excel ---
define('DOWNLOAD_EMAIL', 'coordinacion.fia@ucvvirtual.edu.pe');
define('DOWNLOAD_PASS',  'DocentesFIA2026');

// --- Tamaño máximo de firma en bytes (2 MB) ---
define('FIRMA_MAX_SIZE', 2097152);

// --- Zona Horaria de Perú (GMT-5) ---
date_default_timezone_set('America/Lima');
