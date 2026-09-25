<?php
/**
 * api/login.php - Servicio de Autenticación con Base de Datos
 * Sistema de Gestión Académica (SGA) — UCV Virtual
 * Soporta MySQL (cPanel) y SQLite automático (data/usuarios.db)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/../data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}
$sqliteFile = $dataDir . '/usuarios.db';

// Función para obtener conexión PDO (MySQL o SQLite)
function getDbConnection($sqliteFile) {
    // Intentar leer credenciales MySQL de formulario_delegados/config.php si existe
    $configFile = __DIR__ . '/../formulario_delegados/config.php';
    if (file_exists($configFile)) {
        @include_once $configFile;
    }

    if (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER') && defined('DB_PASS') && DB_NAME !== '') {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 3
            ]);
            ensureTables($pdo, 'mysql');
            return $pdo;
        } catch (Exception $e) {
            // Fallback transparente a SQLite
        }
    }

    // Fallback a SQLite
    try {
        $pdo = new PDO("sqlite:" . $sqliteFile, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        ensureTables($pdo, 'sqlite');
        return $pdo;
    } catch (Exception $e) {
        return null;
    }
}

// Asegurar existencia de tabla e usuario inicial
function ensureTables($pdo, $driver = 'sqlite') {
    if ($driver === 'mysql') {
        $sql = "CREATE TABLE IF NOT EXISTS `usuarios` (
            `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            `email` VARCHAR(150) NOT NULL UNIQUE,
            `username` VARCHAR(80) NOT NULL UNIQUE,
            `password_hash` VARCHAR(255) NOT NULL,
            `nombre` VARCHAR(150) NOT NULL,
            `rol` VARCHAR(50) NOT NULL DEFAULT 'Coordinador',
            `escuela` VARCHAR(150) NOT NULL DEFAULT 'Facultad de Ingeniería y Arquitectura',
            `estado` TINYINT(1) NOT NULL DEFAULT 1,
            `ultimo_acceso` DATETIME NULL DEFAULT NULL,
            `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    } else {
        $sql = "CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nombre TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'Coordinador',
            escuela TEXT DEFAULT 'Facultad de Ingeniería y Arquitectura',
            estado INTEGER DEFAULT 1,
            ultimo_acceso TEXT,
            fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
        );";
    }

    $pdo->exec($sql);

    // Verificar si existe la cuenta institucional
    $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(email) = LOWER(:email) LIMIT 1");
    $stmt->execute([':email' => 'coordinacion.fia@ucvvirtual.edu.pe']);
    $user = $stmt->fetch();

    $expectedHash = 'sha256$ucvfia2026$854350727c65d7effa6308f348a8b311e1ed0de91843afa30cb50a5c8323bb66';

    if (!$user) {
        $insertStmt = $pdo->prepare("INSERT INTO usuarios (email, username, password_hash, nombre, rol, escuela, estado) 
            VALUES (:email, :username, :hash, :nombre, :rol, :escuela, 1)");
        $insertStmt->execute([
            ':email' => 'coordinacion.fia@ucvvirtual.edu.pe',
            ':username' => 'coordinacion.fia',
            ':hash' => $expectedHash,
            ':nombre' => 'Coordinación Académica FIA',
            ':rol' => 'Coordinador',
            ':escuela' => 'Facultad de Ingeniería y Arquitectura'
        ]);
    } else {
        // Asegurar que el hash esté sincronizado
        $updateStmt = $pdo->prepare("UPDATE usuarios SET password_hash = :hash, estado = 1 WHERE id = :id");
        $updateStmt->execute([':hash' => $expectedHash, ':id' => $user['id']]);
    }
}

// Verificación segura de contraseñas
function verifyPassword($inputPassword, $storedHash) {
    if (strpos($storedHash, 'sha256$') === 0) {
        $parts = explode('$', $storedHash);
        if (count($parts) === 3) {
            $salt = $parts[1];
            $expected = $parts[2];
            $computed = hash('sha256', $salt . $inputPassword);
            if (hash_equals($expected, $computed)) {
                return true;
            }
        }
    }

    if (password_verify($inputPassword, $storedHash)) {
        return true;
    }

    return ($inputPassword === $storedHash);
}

// GET: Comprobación de estado del servicio
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'status' => 'online',
        'service' => 'UCV Virtual SGA Auth API',
        'auth_enabled' => true
    ]);
    exit;
}

// POST: Procesar Login
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    $user = trim($payload['user'] ?? '');
    $password = trim($payload['password'] ?? '');

    if (empty($user) || empty($password)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Debe ingresar su usuario institucional y contraseña.'
        ]);
        exit;
    }

    $pdo = getDbConnection($sqliteFile);

    if (!$pdo) {
        // Fallback en memoria si la BD del servidor tuviera problemas de permisos
        if (strtolower($user) === 'coordinacion.fia@ucvvirtual.edu.pe' || strtolower($user) === 'coordinacion.fia') {
            if ($password === 'DelegadosFIA2026') {
                echo json_encode([
                    'success' => true,
                    'message' => 'Autenticación exitosa',
                    'user' => [
                        'id' => 1,
                        'email' => 'coordinacion.fia@ucvvirtual.edu.pe',
                        'username' => 'coordinacion.fia',
                        'nombre' => 'Coordinación Académica FIA',
                        'rol' => 'Coordinador',
                        'escuela' => 'Facultad de Ingeniería y Arquitectura'
                    ]
                ]);
                exit;
            }
        }

        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Credenciales inválidas. Verifique su usuario y contraseña institucional.'
        ]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE (LOWER(email) = LOWER(:u) OR LOWER(username) = LOWER(:u)) AND estado = 1 LIMIT 1");
        $stmt->execute([':u' => $user]);
        $row = $stmt->fetch();

        if ($row && verifyPassword($password, $row['password_hash'])) {
            // Actualizar último acceso
            try {
                $now = date('Y-m-d H:i:s');
                $upd = $pdo->prepare("UPDATE usuarios SET ultimo_acceso = :now WHERE id = :id");
                $upd->execute([':now' => $now, ':id' => $row['id']]);
            } catch (Exception $e) {}

            echo json_encode([
                'success' => true,
                'message' => 'Autenticación exitosa',
                'user' => [
                    'id' => (int)$row['id'],
                    'email' => $row['email'],
                    'username' => $row['username'],
                    'nombre' => $row['nombre'],
                    'rol' => $row['rol'],
                    'escuela' => $row['escuela']
                ]
            ]);
            exit;
        }

        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Credenciales inválidas. Verifique su usuario y contraseña institucional.'
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Error al consultar la base de datos de usuarios: ' . $e->getMessage()
        ]);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido']);
