-- ========================================================================
-- Base de Datos de Usuarios y Autenticación — Minisistema Académico (SGA)
-- Facultad de Ingeniería y Arquitectura — Universidad César Vallejo (UCV)
-- ========================================================================

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL UNIQUE COMMENT 'Correo institucional del usuario',
  `username` VARCHAR(80) NOT NULL UNIQUE COMMENT 'Nombre de usuario corto',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hash seguro de la contraseña',
  `nombre` VARCHAR(150) NOT NULL COMMENT 'Nombres y Apellidos o Denominación',
  `rol` VARCHAR(50) NOT NULL DEFAULT 'Coordinador' COMMENT 'Rol institucional (Admin, Coordinador, Director)',
  `escuela` VARCHAR(150) NOT NULL DEFAULT 'Facultad de Ingeniería y Arquitectura' COMMENT 'Escuela o Facultad',
  `estado` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = Activo, 0 = Inactivo',
  `ultimo_acceso` DATETIME NULL DEFAULT NULL COMMENT 'Fecha y hora del último login',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de registro del usuario',
  INDEX `idx_email` (`email`),
  INDEX `idx_username` (`username`),
  INDEX `idx_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuarios con acceso al Sistema de Gestión Académica';

-- ------------------------------------------------------------------------
-- Inserción de la cuenta institucional solicitada:
-- Usuario / Correo: coordinacion.fia@ucvvirtual.edu.pe
-- Contraseña plana: DelegadosFIA2026
-- Hash SHA-256 con salt (compatible con Python y PHP) y soporte de bcrypt
-- ------------------------------------------------------------------------
INSERT INTO `usuarios` (`email`, `username`, `password_hash`, `nombre`, `rol`, `escuela`, `estado`, `fecha_creacion`)
VALUES (
  'coordinacion.fia@ucvvirtual.edu.pe',
  'coordinacion.fia',
  'sha256$ucvfia2026$854350727c65d7effa6308f348a8b311e1ed0de91843afa30cb50a5c8323bb66',
  'Coordinación Académica FIA',
  'Coordinador',
  'Facultad de Ingeniería y Arquitectura',
  1,
  NOW()
)
ON DUPLICATE KEY UPDATE 
  `password_hash` = VALUES(`password_hash`),
  `nombre` = VALUES(`nombre`),
  `rol` = VALUES(`rol`),
  `estado` = 1;
