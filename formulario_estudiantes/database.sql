-- ========================================================================
-- Base de Datos: RESERVA DE ATENCIÓN ESTUDIANTIL 2026-2
-- Facultad de Ingeniería y Arquitectura - Universidad César Vallejo (UCV)
-- Compatible con cPanel / phpMyAdmin / MySQL 5.7+ / MySQL 8.0+ / MariaDB
-- ========================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "-05:00";

CREATE TABLE IF NOT EXISTS `estudiantes_atenciones` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `codigo_ticket` VARCHAR(30) NOT NULL UNIQUE COMMENT 'Código único del ticket de atención (Ej: ATN-2026-0001)',
  `nombres_completos` VARCHAR(255) NOT NULL COMMENT 'Apellidos y Nombres completos del estudiante',
  `codigo_alumno` VARCHAR(20) NOT NULL COMMENT 'Código de alumno UCV (Ej: 7000123456)',
  `carrera_profesional` VARCHAR(150) NOT NULL COMMENT 'Carrera Profesional / Escuela Académica',
  `correo_institucional` VARCHAR(150) NOT NULL COMMENT 'Correo institucional UCV o personal',
  `tipo_atencion` ENUM('Reclamo', 'Solicitud') NOT NULL COMMENT 'Tipo de atención requerida (Reclamo o Solicitud)',
  `dia_atencion` VARCHAR(50) NOT NULL COMMENT 'Día seleccionado para la atención (Lunes a Jueves)',
  `horario_atencion` VARCHAR(50) NOT NULL COMMENT 'Franja horaria reservada (7:00 PM a 9:00 PM)',
  `detalle_motivo` TEXT NULL COMMENT 'Descripción o fundamentación de la atención',
  `estado` ENUM('Pendiente', 'En Atención', 'Atendido', 'Cancelado') NOT NULL DEFAULT 'Pendiente' COMMENT 'Estado actual del ticket',
  `link_zoom` VARCHAR(255) NULL DEFAULT '' COMMENT 'Enlace de sala virtual Zoom / Meet asignado por la coordinación',
  `observaciones_coordinacion` TEXT NULL COMMENT 'Notas de seguimiento de la Coordinación Académica',
  `ip_registro` VARCHAR(50) NULL DEFAULT '' COMMENT 'Dirección IP del estudiante solicitante',
  `user_agent` VARCHAR(255) NULL DEFAULT '' COMMENT 'Navegador / Dispositivo de registro',
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora exacta de la reserva',
  INDEX `idx_ticket` (`codigo_ticket`),
  INDEX `idx_codigo_alumno` (`codigo_alumno`),
  INDEX `idx_carrera` (`carrera_profesional`),
  INDEX `idx_tipo` (`tipo_atencion`),
  INDEX `idx_dia` (`dia_atencion`),
  INDEX `idx_estado` (`estado`),
  INDEX `idx_fecha` (`fecha_registro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registros oficiales de reserva de atención a estudiantes 2026-2';
