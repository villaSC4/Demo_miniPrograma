-- ========================================================================
-- Base de Datos: CONTROL DE ASISTENCIA DOCENTE 2026-2
-- Facultad de Ingeniería y Arquitectura - Universidad César Vallejo (UCV)
-- Compatible con cPanel / phpMyAdmin / MySQL 5.7+ / MySQL 8.0+ / MariaDB
-- ========================================================================
-- INSTRUCCIONES EN CPANEL:
-- 1. Cree la base de datos en cPanel -> "Bases de datos MySQL" (ej: tuusuario_docentes)
-- 2. Ingrese a phpMyAdmin y haga clic en su base de datos recién creada
-- 3. Vaya a la pestaña "Importar", seleccione este archivo y haga clic en "Importar"
-- ========================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "-05:00";

CREATE TABLE IF NOT EXISTS `docentes_asistencia` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `apellidos_nombres` VARCHAR(255) NOT NULL COMMENT 'Apellidos y Nombres completos del docente',
  `codigo_docente` VARCHAR(50) NOT NULL COMMENT 'Código institucional del docente UCV',
  `dni` VARCHAR(20) NOT NULL COMMENT 'Documento Nacional de Identidad (8 dígitos)',
  `correo` VARCHAR(150) NULL DEFAULT '' COMMENT 'Correo electrónico institucional o personal',
  `escuela_profesional` VARCHAR(150) NOT NULL COMMENT 'Escuela Profesional',
  `asignatura` VARCHAR(255) NOT NULL COMMENT 'Asignatura o experiencia curricular que dicta',
  `seccion` VARCHAR(100) NOT NULL COMMENT 'Sección o grupo de aula (Ej. A1, B2 o Grupo 01)',
  `ciclo` VARCHAR(20) NOT NULL COMMENT 'Ciclo académico (Ciclo I al X)',
  `observaciones` TEXT NULL COMMENT 'Observaciones o comentarios adicionales',
  `firma_archivo` VARCHAR(255) NULL DEFAULT '' COMMENT 'Nombre del archivo de la firma digital guardada',
  `declaracion_aceptada` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 si aceptó la declaración de conformidad',
  `ip_registro` VARCHAR(50) NULL DEFAULT '' COMMENT 'Dirección IP del cliente',
  `user_agent` VARCHAR(255) NULL DEFAULT '' COMMENT 'Dispositivo / Navegador web',
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora exacta del registro',
  INDEX `idx_codigo` (`codigo_docente`),
  INDEX `idx_dni` (`dni`),
  INDEX `idx_escuela` (`escuela_profesional`),
  INDEX `idx_seccion` (`seccion`),
  INDEX `idx_ciclo` (`ciclo`),
  INDEX `idx_fecha` (`fecha_registro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registros oficiales de asistencia docente 2026-2';
