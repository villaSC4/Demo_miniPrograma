<?php
/**
 * api/config_dac.php - Configuración de Base de Datos para el Módulo DAC / PAE (Plataforma de Atención al Estudiante)
 * Si el subdominio dac-atiende.class-it.edu.pe y el minisistema comparten base de datos en cPanel,
 * configure aquí las mismas credenciales de MySQL.
 */

if (!defined('DAC_DB_HOST')) define('DAC_DB_HOST', 'localhost');
if (!defined('DAC_DB_NAME')) define('DAC_DB_NAME', 'classit_estudiantes_atenciones');
if (!defined('DAC_DB_USER')) define('DAC_DB_USER', 'classit_admin_atencion');
if (!defined('DAC_DB_PASS')) define('DAC_DB_PASS', 'B*OBht$T_aBtOmE(');
if (!defined('DAC_DB_PORT')) define('DAC_DB_PORT', '3306');
if (!defined('DAC_SUBDOMAIN_API')) define('DAC_SUBDOMAIN_API', 'https://dac-atiende.class-it.edu.pe/api_atenciones.php');

if (!class_exists('DB')) {
    class DB {
        private static $pdo = null;

        public static function getConnection() {
            if (self::$pdo !== null) return self::$pdo;
            $dsn = "mysql:host=" . DAC_DB_HOST . ";port=" . DAC_DB_PORT . ";dbname=" . DAC_DB_NAME . ";charset=utf8mb4";
            self::$pdo = new PDO($dsn, DAC_DB_USER, DAC_DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 3,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ]);
            return self::$pdo;
        }

        public static function getAllReservas($search = '', $carrera = '', $tipo = '', $dia = '', $estado = '') {
            $pdo = self::getConnection();
            $where = [];
            $params = [];
            if (!empty($search)) {
                $where[] = "(`nombres_completos` LIKE ? OR `codigo_alumno` LIKE ? OR `codigo_ticket` LIKE ? OR `correo_institucional` LIKE ?)";
                $t = "%{$search}%";
                $params = array_merge($params, [$t, $t, $t, $t]);
            }
            if (!empty($carrera)) { $where[] = "`carrera_profesional` = ?"; $params[] = $carrera; }
            if (!empty($tipo)) { $where[] = "`tipo_atencion` = ?"; $params[] = $tipo; }
            if (!empty($dia)) { $where[] = "`dia_atencion` = ?"; $params[] = $dia; }
            if (!empty($estado)) { $where[] = "`estado` = ?"; $params[] = $estado; }

            $sql = "SELECT * FROM `estudiantes_atenciones`";
            if (!empty($where)) $sql .= " WHERE " . implode(" AND ", $where);
            $sql .= " ORDER BY `id` DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        }

        public static function deleteReserva($id) {
            $pdo = self::getConnection();
            $stmt = $pdo->prepare("DELETE FROM `estudiantes_atenciones` WHERE `id` = ?");
            return $stmt->execute([(int)$id]);
        }

        public static function isHorarioOcupado($dia, $horario) {
            $getRange = function($str) {
                $s = mb_strtolower(trim($str));
                if (strpos($s, '7:00') !== false && strpos($s, '7:30') !== false) return [19.0, 19.5];
                if (strpos($s, '7:30') !== false && strpos($s, '8:00') !== false) return [19.5, 20.0];
                if (strpos($s, '8:00') !== false && strpos($s, '8:30') !== false) return [20.0, 20.5];
                if (strpos($s, '8:30') !== false && strpos($s, '9:00') !== false) return [20.5, 21.0];
                if (strpos($s, '7:00') !== false && strpos($s, '8:00') !== false) return [19.0, 20.0];
                if (strpos($s, '8:00') !== false && strpos($s, '9:00') !== false) return [20.0, 21.0];
                return null;
            };

            $targetRange = $getRange($horario);

            try {
                $pdo = self::getConnection();
                $stmt = $pdo->prepare("SELECT `horario_atencion` FROM `estudiantes_atenciones` WHERE `dia_atencion` = ? AND (`estado` IS NULL OR `estado` != 'Cancelado')");
                $stmt->execute([$dia]);
                $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);

                foreach ($rows as $existente) {
                    if ($existente === $horario) return true;
                    $existRange = $getRange($existente);
                    if ($targetRange && $existRange) {
                        if (max($targetRange[0], $existRange[0]) < min($targetRange[1], $existRange[1])) {
                            return true;
                        }
                    }
                }
                return false;
            } catch (Exception $e) {
                return false;
            }
        }
    }
}
