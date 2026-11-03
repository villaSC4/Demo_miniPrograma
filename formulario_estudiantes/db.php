<?php
/**
 * Capa de Base de Datos MySQL — RESERVA DE ATENCIÓN ESTUDIANTIL (SISTEMA AISLADO)
 * Conexión nativa y operaciones CRUD exclusivamente con base de datos SQL (MySQL / MariaDB)
 */
require_once __DIR__ . '/config.php';

class DB {
    private static $pdo = null;

    /**
     * Obtener instancia PDO para MySQL
     */
    public static function getConnection() {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $host = defined('DB_HOST') ? DB_HOST : 'localhost';
        $port = defined('DB_PORT') ? DB_PORT : '3306';
        $name = defined('DB_NAME') ? DB_NAME : 'classit_profesores';
        $user = defined('DB_USER') ? DB_USER : 'root';
        $pass = defined('DB_PASS') ? DB_PASS : '';
        $charset = defined('DB_CHARSET') ? DB_CHARSET : 'utf8mb4';

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset}"
        ];

        try {
            self::$pdo = new PDO($dsn, $user, $pass, $options);
            self::ensureTable();
            return self::$pdo;
        } catch (PDOException $e) {
            // Si estamos en localhost y fallan las credenciales cPanel, fallback local automático
            if ($host === 'localhost' || $host === '127.0.0.1') {
                try {
                    $rootDsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
                    self::$pdo = new PDO($rootDsn, 'root', '', $options);
                    self::ensureTable();
                    return self::$pdo;
                } catch (Exception $eRoot) {
                    try {
                        $rootConn = new PDO("mysql:host={$host};port={$port};charset={$charset}", 'root', '', $options);
                        $rootConn->exec("CREATE DATABASE IF NOT EXISTS `{$name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                        self::$pdo = new PDO($rootDsn, 'root', '', $options);
                        self::ensureTable();
                        return self::$pdo;
                    } catch (Exception $eRoot2) {
                        try {
                            $localDsn = "mysql:host={$host};port={$port};dbname=atenciones_estudiantes;charset={$charset}";
                            $rootConn2 = new PDO("mysql:host={$host};port={$port};charset={$charset}", 'root', '', $options);
                            $rootConn2->exec("CREATE DATABASE IF NOT EXISTS `atenciones_estudiantes` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                            self::$pdo = new PDO($localDsn, 'root', '', $options);
                            self::ensureTable();
                            return self::$pdo;
                        } catch (Exception $eLocal) {}
                    }
                }
            }

            error_log("Error de conexión MySQL: " . $e->getMessage());
            throw new Exception("No se pudo conectar a la base de datos MySQL [{$name}]: " . $e->getMessage());
        }
    }

    /**
     * Asegura la creación de la tabla estudiantes_atenciones si no existe
     */
    private static function ensureTable() {
        $sql = "CREATE TABLE IF NOT EXISTS `estudiantes_atenciones` (
            `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            `codigo_ticket` VARCHAR(30) NOT NULL UNIQUE,
            `nombres_completos` VARCHAR(255) NOT NULL,
            `codigo_alumno` VARCHAR(20) NOT NULL,
            `carrera_profesional` VARCHAR(150) NOT NULL,
            `correo_institucional` VARCHAR(150) NOT NULL,
            `tipo_atencion` ENUM('Reclamo', 'Solicitud') NOT NULL,
            `dia_atencion` VARCHAR(50) NOT NULL,
            `horario_atencion` VARCHAR(50) NOT NULL,
            `detalle_motivo` TEXT NULL,
            `estado` ENUM('Pendiente', 'En Atención', 'Atendido', 'Cancelado') NOT NULL DEFAULT 'Pendiente',
            `link_zoom` VARCHAR(255) NULL DEFAULT '',
            `observaciones_coordinacion` TEXT NULL,
            `ip_registro` VARCHAR(50) NULL DEFAULT '',
            `user_agent` VARCHAR(255) NULL DEFAULT '',
            `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_ticket` (`codigo_ticket`),
            INDEX `idx_codigo_alumno` (`codigo_alumno`),
            INDEX `idx_carrera` (`carrera_profesional`),
            INDEX `idx_tipo` (`tipo_atencion`),
            INDEX `idx_dia` (`dia_atencion`),
            INDEX `idx_estado` (`estado`),
            INDEX `idx_fecha` (`fecha_registro`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
        try {
            self::$pdo->exec($sql);
            try {
                self::$pdo->exec("ALTER TABLE `estudiantes_atenciones` ADD COLUMN `link_zoom` VARCHAR(255) NULL DEFAULT '' AFTER `estado`");
            } catch (Exception $eCol) {}
        } catch (Exception $e) {
            // Ignorar si ya existe
        }
    }

    /**
     * Generar un código único de ticket amigable ej. ATN-2026-7842
     */
    public static function generateTicketCode() {
        $prefix = 'ATN-2026-';
        $randNum = mt_rand(1000, 9999);
        return $prefix . $randNum;
    }

    /**
     * Verificar si una franja horaria ya fue reservada en un día determinado
     */
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
            // Fallback a JSON si MySQL no responde
            $jsonFile = __DIR__ . '/data/atenciones.json';
            if (file_exists($jsonFile)) {
                $items = json_decode(file_get_contents($jsonFile), true) ?: [];
                foreach ($items as $it) {
                    if (($it['estado'] ?? '') === 'Cancelado') continue;
                    if (($it['dia_atencion'] ?? '') === $dia) {
                        $existente = $it['horario_atencion'] ?? '';
                        if ($existente === $horario) return true;
                        $existRange = $getRange($existente);
                        if ($targetRange && $existRange) {
                            if (max($targetRange[0], $existRange[0]) < min($targetRange[1], $existRange[1])) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        }
    }

    /**
     * Registrar una nueva atención estudiantil en MySQL
     */
    public static function saveReserva(array $data) {
        $pdo = self::getConnection();

        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
        $fecha = date('Y-m-d H:i:s');

        // Intentar generar ticket único
        $ticketCode = '';
        for ($i = 0; $i < 5; $i++) {
            $candidate = self::generateTicketCode();
            $chk = $pdo->prepare("SELECT id FROM `estudiantes_atenciones` WHERE `codigo_ticket` = ? LIMIT 1");
            $chk->execute([$candidate]);
            if (!$chk->fetch()) {
                $ticketCode = $candidate;
                break;
            }
        }
        if (empty($ticketCode)) {
            $ticketCode = 'ATN-2026-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 5));
        }

        $sql = "INSERT INTO `estudiantes_atenciones` 
            (`codigo_ticket`, `nombres_completos`, `codigo_alumno`, `carrera_profesional`, `correo_institucional`, `tipo_atencion`, `dia_atencion`, `horario_atencion`, `detalle_motivo`, `estado`, `ip_registro`, `user_agent`, `fecha_registro`) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?, ?)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $ticketCode,
            $data['nombres_completos'] ?? '',
            $data['codigo_alumno'] ?? '',
            $data['carrera_profesional'] ?? '',
            $data['correo_institucional'] ?? '',
            $data['tipo_atencion'] ?? 'Solicitud',
            $data['dia_atencion'] ?? '',
            $data['horario_atencion'] ?? '',
            $data['detalle_motivo'] ?? '',
            $ip,
            $ua,
            $fecha
        ]);

        return [
            'success'       => true,
            'id'            => $pdo->lastInsertId(),
            'codigo_ticket' => $ticketCode,
            'engine'        => 'mysql',
            'fecha'         => $fecha
        ];
    }

    /**
     * Obtener listado de atenciones con filtros
     */
    public static function getAllReservas($search = '', $carrera = '', $tipo = '', $dia = '', $estado = '') {
        $pdo = self::getConnection();

        $where = [];
        $params = [];

        if (!empty($search)) {
            $where[] = "(`nombres_completos` LIKE ? OR `codigo_alumno` LIKE ? OR `codigo_ticket` LIKE ? OR `correo_institucional` LIKE ?)";
            $term = "%{$search}%";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        if (!empty($carrera)) {
            $where[] = "`carrera_profesional` = ?";
            $params[] = $carrera;
        }

        if (!empty($tipo)) {
            $where[] = "`tipo_atencion` = ?";
            $params[] = $tipo;
        }

        if (!empty($dia)) {
            $where[] = "`dia_atencion` = ?";
            $params[] = $dia;
        }

        if (!empty($estado)) {
            $where[] = "`estado` = ?";
            $params[] = $estado;
        }

        $sql = "SELECT * FROM `estudiantes_atenciones`";
        if (!empty($where)) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY `id` DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Obtener reserva por ID
     */
    public static function getReservaById($id) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM `estudiantes_atenciones` WHERE `id` = ? LIMIT 1");
        $stmt->execute([(int)$id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Actualizar estado y notas de una atención
     */
    public static function updateEstado($id, $estado, $observaciones = '', $linkZoom = null) {
        $pdo = self::getConnection();
        if ($linkZoom !== null) {
            $stmt = $pdo->prepare("UPDATE `estudiantes_atenciones` SET `estado` = ?, `observaciones_coordinacion` = ?, `link_zoom` = ? WHERE `id` = ?");
            return $stmt->execute([$estado, $observaciones, $linkZoom, (int)$id]);
        }
        $stmt = $pdo->prepare("UPDATE `estudiantes_atenciones` SET `estado` = ?, `observaciones_coordinacion` = ? WHERE `id` = ?");
        return $stmt->execute([$estado, $observaciones, (int)$id]);
    }

    /**
     * Eliminar reserva por ID
     */
    public static function deleteReserva($id) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("DELETE FROM `estudiantes_atenciones` WHERE `id` = ?");
        return $stmt->execute([(int)$id]);
    }
}
