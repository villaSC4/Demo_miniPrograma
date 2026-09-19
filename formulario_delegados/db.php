<?php
/**
 * Capa de Abstracción de Base de Datos
 * Soporta MySQL (PDO) con fallback inteligente a SQLite / JSON
 */
require_once __DIR__ . '/config.php';

class DB {
    private static $pdo = null;
    private static $engine = 'none'; // 'mysql', 'sqlite', 'json'
    private static $sqliteFile = __DIR__ . '/data/delegados.db';
    private static $jsonFile = __DIR__ . '/data/delegados.json';

    public static function getConnection() {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        // 1. Intentar conexión a MySQL si está configurado
        if (!empty(DB_NAME)) {
            try {
                $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ];
                self::$pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
                self::$engine = 'mysql';
                self::initMySqlTable();
                return self::$pdo;
            } catch (Exception $e) {
                error_log("MySQL connection failed: " . $e->getMessage() . " - falling back to SQLite");
            }
        }

        // 2. Fallback a SQLite si está disponible la extensión
        if (extension_loaded('pdo_sqlite')) {
            try {
                if (!file_exists(__DIR__ . '/data')) {
                    @mkdir(__DIR__ . '/data', 0777, true);
                }
                $dsn = "sqlite:" . self::$sqliteFile;
                self::$pdo = new PDO($dsn);
                self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
                self::$engine = 'sqlite';
                self::initSqliteTable();
                return self::$pdo;
            } catch (Exception $e) {
                error_log("SQLite failed: " . $e->getMessage() . " - falling back to JSON");
            }
        }

        // 3. Fallback a almacenamiento JSON
        self::$engine = 'json';
        if (!file_exists(__DIR__ . '/data')) {
            @mkdir(__DIR__ . '/data', 0777, true);
        }
        if (!file_exists(self::$jsonFile)) {
            @file_put_contents(self::$jsonFile, json_encode([]));
        }
        return null;
    }

    public static function getEngine() {
        if (self::$engine === 'none') {
            self::getConnection();
        }
        return self::$engine;
    }

    private static function initMySqlTable() {
        $sql = "CREATE TABLE IF NOT EXISTS `delegados_asistencia` (
            `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            `apellidos_nombres` VARCHAR(255) NOT NULL,
            `codigo_alumno` VARCHAR(50) NOT NULL,
            `correo` VARCHAR(150) NULL DEFAULT '',
            `escuela_profesional` VARCHAR(150) NOT NULL,
            `asignatura` VARCHAR(255) NOT NULL,
            `seccion` VARCHAR(50) NULL DEFAULT '',
            `ciclo` VARCHAR(30) NOT NULL,
            `declaracion_aceptada` TINYINT(1) NOT NULL DEFAULT 1,
            `ip_registro` VARCHAR(50) NULL DEFAULT '',
            `user_agent` VARCHAR(255) NULL DEFAULT '',
            `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_codigo` (`codigo_alumno`),
            INDEX `idx_escuela` (`escuela_profesional`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
        try {
            self::$pdo->exec($sql);
        } catch (Exception $e) {
            // Ignorar si ya existe
        }
    }

    private static function initSqliteTable() {
        $sql = "CREATE TABLE IF NOT EXISTS delegados_asistencia (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            apellidos_nombres TEXT NOT NULL,
            codigo_alumno TEXT NOT NULL,
            correo TEXT,
            escuela_profesional TEXT NOT NULL,
            asignatura TEXT NOT NULL,
            seccion TEXT,
            ciclo TEXT NOT NULL,
            declaracion_aceptada INTEGER DEFAULT 1,
            ip_registro TEXT,
            user_agent TEXT,
            fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
        );";
        try {
            self::$pdo->exec($sql);

            // Sincronizar desde delegados.json si existe y la tabla sqlite está vacía
            if (file_exists(self::$jsonFile)) {
                $count = (int)self::$pdo->query("SELECT COUNT(*) FROM delegados_asistencia")->fetchColumn();
                if ($count === 0) {
                    $raw = @file_get_contents(self::$jsonFile);
                    $items = json_decode($raw, true) ?: [];
                    if (!empty($items)) {
                        $stmt = self::$pdo->prepare("INSERT INTO delegados_asistencia 
                            (apellidos_nombres, codigo_alumno, correo, escuela_profesional, asignatura, seccion, ciclo, declaracion_aceptada, ip_registro, user_agent, fecha_registro) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                        foreach (array_reverse($items) as $item) {
                            $stmt->execute([
                                $item['apellidos_nombres'] ?? '',
                                $item['codigo_alumno'] ?? '',
                                $item['correo'] ?? '',
                                $item['escuela_profesional'] ?? '',
                                $item['asignatura'] ?? '',
                                $item['seccion'] ?? '',
                                $item['ciclo'] ?? '',
                                $item['declaracion_aceptada'] ?? 1,
                                $item['ip_registro'] ?? '',
                                $item['user_agent'] ?? '',
                                $item['fecha_registro'] ?? date('Y-m-d H:i:s')
                            ]);
                        }
                    }
                }
            }
        } catch (Exception $e) {
            // Ignorar
        }
    }

    public static function saveDelegado($data) {
        $pdo = self::getConnection();
        $engine = self::getEngine();

        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 250);
        $fecha = date('Y-m-d H:i:s');

        $apellidosNombres = trim($data['apellidos_nombres'] ?? '');
        $codigo = trim($data['codigo_alumno'] ?? '');
        $correo = trim($data['correo'] ?? '');
        $escuela = trim($data['escuela_profesional'] ?? '');
        $asignatura = trim($data['asignatura'] ?? '');
        $seccion = trim($data['seccion'] ?? '');
        $ciclo = trim($data['ciclo'] ?? '');
        $declaracion = !empty($data['declaracion_aceptada']) ? 1 : 1;

        if ($engine === 'mysql' || $engine === 'sqlite') {
            $sql = "INSERT INTO delegados_asistencia 
                (apellidos_nombres, codigo_alumno, correo, escuela_profesional, asignatura, seccion, ciclo, declaracion_aceptada, ip_registro, user_agent, fecha_registro) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $apellidosNombres, $codigo, $correo, $escuela, $asignatura, $seccion, $ciclo, $declaracion, $ip, $ua, $fecha
            ]);
            return [
                'success' => true,
                'id' => $pdo->lastInsertId(),
                'engine' => $engine,
                'fecha' => $fecha
            ];
        }

        // Modo JSON
        $list = [];
        if (file_exists(self::$jsonFile)) {
            $raw = file_get_contents(self::$jsonFile);
            $list = json_decode($raw, true) ?: [];
        }
        $newId = count($list) + 1;
        $newItem = [
            'id' => $newId,
            'apellidos_nombres' => $apellidosNombres,
            'codigo_alumno' => $codigo,
            'correo' => $correo,
            'escuela_profesional' => $escuela,
            'asignatura' => $asignatura,
            'seccion' => $seccion,
            'ciclo' => $ciclo,
            'declaracion_aceptada' => $declaracion,
            'ip_registro' => $ip,
            'user_agent' => $ua,
            'fecha_registro' => $fecha
        ];
        array_unshift($list, $newItem);
        file_put_contents(self::$jsonFile, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return [
            'success' => true,
            'id' => $newId,
            'engine' => 'json',
            'fecha' => $fecha
        ];
    }

    public static function getAllDelegados($search = '', $escuela = '') {
        $pdo = self::getConnection();
        $engine = self::getEngine();

        if ($engine === 'mysql' || $engine === 'sqlite') {
            $sql = "SELECT * FROM delegados_asistencia WHERE 1=1";
            $params = [];

            if (!empty($search)) {
                $sql .= " AND (apellidos_nombres LIKE ? OR codigo_alumno LIKE ? OR asignatura LIKE ?)";
                $s = "%$search%";
                $params[] = $s;
                $params[] = $s;
                $params[] = $s;
            }

            if (!empty($escuela)) {
                $sql .= " AND escuela_profesional = ?";
                $params[] = $escuela;
            }

            $sql .= " ORDER BY id DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // En JSON
        $list = [];
        if (file_exists(self::$jsonFile)) {
            $raw = file_get_contents(self::$jsonFile);
            $list = json_decode($raw, true) ?: [];
        }

        if (!empty($search) || !empty($escuela)) {
            $searchLower = mb_strtolower($search, 'UTF-8');
            $list = array_filter($list, function($item) use ($searchLower, $escuela) {
                if (!empty($escuela) && ($item['escuela_profesional'] ?? '') !== $escuela) {
                    return false;
                }
                if (!empty($searchLower)) {
                    $haystack = mb_strtolower(($item['apellidos_nombres'] ?? '') . ' ' . ($item['codigo_alumno'] ?? '') . ' ' . ($item['asignatura'] ?? ''), 'UTF-8');
                    if (strpos($haystack, $searchLower) === false) {
                        return false;
                    }
                }
                return true;
            });
        }

        return array_values($list);
    }
}
