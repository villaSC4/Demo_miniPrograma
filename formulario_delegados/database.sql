-- ========================================================================
-- Base de Datos: REUNIÓN DE DELEGADOS 2026-2
-- Facultad de Ingeniería y Arquitectura - Universidad César Vallejo (UCV)
-- ========================================================================

CREATE TABLE IF NOT EXISTS `delegados_asistencia` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `apellidos_nombres` VARCHAR(255) NOT NULL COMMENT 'Apellidos y Nombres completos del delegado',
  `codigo_alumno` VARCHAR(50) NOT NULL COMMENT 'Código institucional de estudiante UCV',
  `correo` VARCHAR(150) NULL DEFAULT '' COMMENT 'Correo electrónico o institucional',
  `escuela_profesional` VARCHAR(150) NOT NULL COMMENT 'Escuela Profesional a la que pertenece',
  `asignatura` VARCHAR(255) NOT NULL COMMENT 'Nombre del curso o asignatura',
  `seccion` VARCHAR(50) NULL DEFAULT '' COMMENT 'Sección asignada',
  `ciclo` VARCHAR(30) NOT NULL COMMENT 'Ciclo académico (ej. Ciclo I al X)',
  `declaracion_aceptada` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 si aceptó la declaración jurada',
  `ip_registro` VARCHAR(50) NULL DEFAULT '' COMMENT 'Dirección IP del cliente',
  `user_agent` VARCHAR(255) NULL DEFAULT '' COMMENT 'Dispositivo / Navegador',
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora exacta del registro',
  INDEX `idx_codigo` (`codigo_alumno`),
  INDEX `idx_escuela` (`escuela_profesional`),
  INDEX `idx_fecha` (`fecha_registro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registros de asistencia - Reunión de Delegados';
