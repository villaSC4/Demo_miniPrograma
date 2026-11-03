<?php
/**
 * api/atenciones_dac.php - Endpoint API para el Módulo de Atención de Llamados y Citas DAC (Zoom / PAE)
 * Conecta las reservas de estudiantes con la plataforma de docentes (cPanel / Apache / PHP y Local)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$baseDir = dirname(__DIR__);
$atnFile = $baseDir . '/data/atenciones.json';
$pauFile = $baseDir . '/data/pau_correos.json';

// Priorizar config_dac.php con credenciales directas de cPanel
$dbLoaded = false;
if (file_exists(__DIR__ . '/config_dac.php')) {
    try {
        require_once __DIR__ . '/config_dac.php';
        $dbLoaded = class_exists('DB');
    } catch (Exception $e) {
        $dbLoaded = false;
    }
}
if (!$dbLoaded && file_exists($baseDir . '/formulario_estudiantes/db.php')) {
    try {
        require_once $baseDir . '/formulario_estudiantes/db.php';
        $dbLoaded = class_exists('DB');
    } catch (Exception $e) {
        $dbLoaded = false;
    }
}

// ----------------------------------------------------------------------------
// GET: Retornar lista completa de atenciones / llamados
// ----------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $search  = trim($_GET['q'] ?? '');
    $carrera = trim($_GET['carrera'] ?? '');
    $tipo    = trim($_GET['tipo'] ?? '');
    $dia     = trim($_GET['dia'] ?? '');
    $estado  = trim($_GET['estado'] ?? '');

    // 1. Intentar obtener desde MySQL si la BD está conectada
    if ($dbLoaded) {
        try {
            $reservas = DB::getAllReservas($search, $carrera, $tipo, $dia, $estado);
            echo json_encode(['success' => true, 'source' => 'mysql', 'data' => $reservas], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e) {
            // Fallback a JSON
        }
    }

    // 2. Fallback a archivo físico data/atenciones.json
    $items = [];
    if (file_exists($atnFile)) {
        $raw = file_get_contents($atnFile);
        $items = json_decode($raw, true) ?: [];
    } elseif (file_exists($baseDir . '/formulario_estudiantes/data/atenciones.json')) {
        $raw = file_get_contents($baseDir . '/formulario_estudiantes/data/atenciones.json');
        $items = json_decode($raw, true) ?: [];
    }

    // Filtrar en memoria si es JSON
    if (!empty($search) || !empty($carrera) || !empty($tipo) || !empty($dia) || !empty($estado)) {
        $items = array_values(array_filter($items, function($it) use ($search, $carrera, $tipo, $dia, $estado) {
            if ($search) {
                $term = mb_strtolower($search);
                $found = (
                    mb_stripos($it['nombres_completos'] ?? '', $term) !== false ||
                    mb_stripos($it['codigo_alumno'] ?? '', $term) !== false ||
                    mb_stripos($it['codigo_ticket'] ?? '', $term) !== false ||
                    mb_stripos($it['correo_institucional'] ?? '', $term) !== false
                );
                if (!$found) return false;
            }
            if ($carrera && ($it['carrera_profesional'] ?? '') !== $carrera) return false;
            if ($tipo && ($it['tipo_atencion'] ?? '') !== $tipo) return false;
            if ($dia && ($it['dia_atencion'] ?? '') !== $dia) return false;
            if ($estado && ($it['estado'] ?? '') !== $estado) return false;
            return true;
        }));
    }

    echo json_encode(['success' => true, 'source' => 'json', 'data' => $items], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// POST: Operaciones de Atención (Asignar Zoom, Cambiar Estado, Eliminar)
// ----------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    if (!$data || !is_array($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Formato JSON inválido']);
        exit;
    }

    $action = $data['action'] ?? 'update_status';
    $id = (int)($data['id'] ?? 0);
    $ticketCode = trim($data['codigo_ticket'] ?? '');

    if ($id <= 0 && empty($ticketCode)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID o Ticket no especificado']);
        exit;
    }

    // A. Actualizar estado y/o sala Zoom
    if ($action === 'update_status' || $action === 'assign_zoom') {
        $nuevoEstado = trim($data['estado'] ?? 'En Atención');
        $zoomLink    = trim($data['link_zoom'] ?? '');
        $observacion = trim($data['observaciones_coordinacion'] ?? '');

        // 1. Actualizar en MySQL si está disponible
        if ($dbLoaded) {
            try {
                $pdo = DB::getConnection();
                // Asegurar columna link_zoom
                try {
                    $pdo->exec("ALTER TABLE `estudiantes_atenciones` ADD COLUMN `link_zoom` VARCHAR(255) NULL DEFAULT ''");
                } catch (Exception $eCol) {}

                $stmt = $pdo->prepare("UPDATE `estudiantes_atenciones` SET `estado` = ?, `observaciones_coordinacion` = ?, `link_zoom` = ? WHERE `id` = ? OR `codigo_ticket` = ?");
                $stmt->execute([$nuevoEstado, $observacion, $zoomLink, $id, $ticketCode]);
            } catch (Exception $e) {}
        }

        // 2. Actualizar en archivo JSON data/atenciones.json
        $syncFiles = [
            $atnFile,
            $baseDir . '/formulario_estudiantes/data/atenciones.json'
        ];

        foreach ($syncFiles as $f) {
            if (file_exists($f)) {
                $list = json_decode(file_get_contents($f), true) ?: [];
                $updated = false;
                foreach ($list as &$item) {
                    if (($item['id'] ?? null) == $id || ($item['codigo_ticket'] ?? null) === $ticketCode) {
                        if (isset($data['estado'])) $item['estado'] = $nuevoEstado;
                        if (isset($data['link_zoom'])) $item['link_zoom'] = $zoomLink;
                        if (isset($data['observaciones_coordinacion'])) $item['observaciones_coordinacion'] = $observacion;
                        $updated = true;
                        break;
                    }
                }
                if ($updated) {
                    @file_put_contents($f, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
                }
            }
        }

        echo json_encode([
            'success'   => true,
            'message'   => 'Llamado/Cita actualizada correctamente',
            'id'        => $id,
            'estado'    => $nuevoEstado,
            'link_zoom' => $zoomLink
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // B. Eliminar registro
    if ($action === 'delete') {
        if ($dbLoaded) {
            try {
                DB::deleteReserva($id);
            } catch (Exception $e) {}
        }

        foreach ([$atnFile, $baseDir . '/formulario_estudiantes/data/atenciones.json'] as $f) {
            if (file_exists($f)) {
                $list = json_decode(file_get_contents($f), true) ?: [];
                $list = array_values(array_filter($list, function($it) use ($id, $ticketCode) {
                    return ($it['id'] != $id && ($it['codigo_ticket'] ?? '') !== $ticketCode);
                }));
                @file_put_contents($f, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
            }
        }

        echo json_encode(['success' => true, 'message' => 'Cita eliminada correctamente']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido']);
