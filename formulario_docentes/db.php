<?php
/**
 * Capa de Base de Datos MySQL — SISTEMA ASISTENCIA DOCENTE (AISLADO)
 * Gestiona la conexión y operaciones exclusivamente con base de datos SQL (MySQL / MariaDB)
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
        $name = defined('DB_NAME') ? DB_NAME : 'asistencia_docentes';
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
            // Si estamos en localhost y fallan las credenciales de cPanel, intentar fallback local con root
            if ($host === 'localhost' || $host === '127.0.0.1') {
                try {
                    // 1. Intentar con root sin contraseña en la misma base de datos
                    $rootDsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
                    self::$pdo = new PDO($rootDsn, 'root', '', $options);
                    self::ensureTable();
                    return self::$pdo;
                } catch (Exception $eRoot) {
                    try {
                        // 2. Si no existe la BD, crearla con root
                        $rootConn = new PDO("mysql:host={$host};port={$port};charset={$charset}", 'root', '', $options);
                        $rootConn->exec("CREATE DATABASE IF NOT EXISTS `{$name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                        self::$pdo = new PDO($rootDsn, 'root', '', $options);
                        self::ensureTable();
                        return self::$pdo;
                    } catch (Exception $eRoot2) {
                        // Fallback a asistencia_docentes local
                        try {
                            $localDsn = "mysql:host={$host};port={$port};dbname=asistencia_docentes;charset={$charset}";
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
     * Asegura que la tabla docentes_asistencia exista en MySQL
     */
    private static function ensureTable() {
        $sql = "CREATE TABLE IF NOT EXISTS `docentes_asistencia` (
            `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            `apellidos_nombres` VARCHAR(255) NOT NULL,
            `codigo_docente` VARCHAR(50) NOT NULL,
            `dni` VARCHAR(20) NOT NULL,
            `correo` VARCHAR(150) NULL DEFAULT '',
            `escuela_profesional` VARCHAR(150) NOT NULL,
            `asignatura` VARCHAR(255) NOT NULL,
            `seccion` VARCHAR(100) NOT NULL,
            `ciclo` VARCHAR(20) NOT NULL,
            `observaciones` TEXT NULL,
            `firma_archivo` VARCHAR(255) NULL DEFAULT '',
            `declaracion_aceptada` TINYINT(1) NOT NULL DEFAULT 1,
            `ip_registro` VARCHAR(50) NULL DEFAULT '',
            `user_agent` VARCHAR(255) NULL DEFAULT '',
            `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_codigo` (`codigo_docente`),
            INDEX `idx_dni` (`dni`),
            INDEX `idx_escuela` (`escuela_profesional`),
            INDEX `idx_seccion` (`seccion`),
            INDEX `idx_ciclo` (`ciclo`),
            INDEX `idx_fecha` (`fecha_registro`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
        try {
            self::$pdo->exec($sql);
        } catch (Exception $e) {
            // Ignorar si ya existe
        }
    }

    public static function getEngine() {
        return 'mysql';
    }

    /**
     * Registrar una nueva asistencia docente en MySQL
     */
    public static function saveDocente(array $data) {
        $pdo = self::getConnection();

        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
        $fecha = date('Y-m-d H:i:s');

        $sql = "INSERT INTO `docentes_asistencia` 
            (`apellidos_nombres`, `codigo_docente`, `dni`, `correo`, `escuela_profesional`, `asignatura`, `seccion`, `ciclo`, `observaciones`, `firma_archivo`, `declaracion_aceptada`, `ip_registro`, `user_agent`, `fecha_registro`) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $data['apellidos_nombres'] ?? '',
            $data['codigo_docente'] ?? '',
            $data['dni'] ?? '',
            $data['correo'] ?? '',
            $data['escuela_profesional'] ?? '',
            $data['asignatura'] ?? '',
            $data['seccion'] ?? '',
            $data['ciclo'] ?? '',
            $data['observaciones'] ?? '',
            $data['firma_archivo'] ?? '',
            isset($data['declaracion_aceptada']) ? (int)$data['declaracion_aceptada'] : 1,
            $ip,
            $ua,
            $fecha
        ]);

        return [
            'success' => true,
            'id' => $pdo->lastInsertId(),
            'engine' => 'mysql',
            'fecha' => $fecha
        ];
    }

    /**
     * Obtener listado de docentes con filtros opcionales
     */
    public static function getAllDocentes($search = '', $escuela = '', $ciclo = '') {
        $pdo = self::getConnection();

        $where = [];
        $params = [];

        if (!empty($search)) {
            $where[] = "(`apellidos_nombres` LIKE ? OR `codigo_docente` LIKE ? OR `dni` LIKE ? OR `asignatura` LIKE ? OR `seccion` LIKE ?)";
            $term = "%{$search}%";
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        if (!empty($escuela)) {
            $where[] = "`escuela_profesional` = ?";
            $params[] = $escuela;
        }

        if (!empty($ciclo)) {
            $where[] = "`ciclo` = ?";
            $params[] = $ciclo;
        }

        $sql = "SELECT * FROM `docentes_asistencia`";
        if (!empty($where)) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY `id` DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Obtener docente por ID
     */
    public static function getDocenteById($id) {
        $pdo = self::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM `docentes_asistencia` WHERE `id` = ? LIMIT 1");
        $stmt->execute([(int)$id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Actualizar datos de un docente existente
     */
    public static function updateDocente($id, array $data) {
        $pdo = self::getConnection();
        $sql = "UPDATE `docentes_asistencia` SET 
            `apellidos_nombres`   = ?,
            `codigo_docente`      = ?,
            `dni`                 = ?,
            `correo`              = ?,
            `escuela_profesional` = ?,
            `asignatura`          = ?,
            `seccion`             = ?,
            `ciclo`               = ?,
            `observaciones`       = ?
            WHERE `id` = ?";
        
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([
            $data['apellidos_nombres'] ?? '',
            $data['codigo_docente'] ?? '',
            $data['dni'] ?? '',
            $data['correo'] ?? '',
            $data['escuela_profesional'] ?? '',
            $data['asignatura'] ?? '',
            $data['seccion'] ?? '',
            $data['ciclo'] ?? '',
            $data['observaciones'] ?? '',
            (int)$id
        ]);
    }

    /**
     * Eliminar registro de un docente y su firma en disco
     */
    public static function deleteDocente($id) {
        $pdo = self::getConnection();
        $doc = self::getDocenteById($id);
        if ($doc && !empty($doc['firma_archivo'])) {
            $firmaPath = __DIR__ . '/data/firmas/' . basename($doc['firma_archivo']);
            if (file_exists($firmaPath)) {
                @unlink($firmaPath);
            }
        }

        $stmt = $pdo->prepare("DELETE FROM `docentes_asistencia` WHERE `id` = ?");
        return $stmt->execute([(int)$id]);
    }
}
