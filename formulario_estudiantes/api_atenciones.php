<?php
/**
 * api_atenciones.php - Endpoint REST con soporte CORS para el Subdominio DAC Atiende
 * Permite que el minisistema principal (u otros dominios autorizados) consulte y actualice
 * las citas y salas de Zoom en tiempo real.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

$jsonBackup = __DIR__ . '/data/atenciones.json';

// ----------------------------------------------------------------------------
// GET: Listar citas recibidas con filtros opcionales
// ----------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $search  = trim($_GET['q'] ?? '');
    $carrera = trim($_GET['carrera'] ?? '');
    $tipo    = trim($_GET['tipo'] ?? '');
    $dia     = trim($_GET['dia'] ?? '');
    $estado  = trim($_GET['estado'] ?? '');

    try {
        $reservas = DB::getAllReservas($search, $carrera, $tipo, $dia, $estado);
        echo json_encode([
            'success' => true,
            'source'  => 'mysql',
            'count'   => count($reservas),
            'data'    => $reservas
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Exception $e) {
        // Fallback a JSON si MySQL no responde
        $items = [];
        if (file_exists($jsonBackup)) {
            $raw = file_get_contents($jsonBackup);
            $items = json_decode($raw, true) ?: [];
        }

        if (!empty($search) || !empty($carrera) || !empty($tipo) || !empty($dia) || !empty($estado)) {
            $items = array_values(array_filter($items, function($it) use ($search, $carrera, $tipo, $dia, $estado) {
                if ($search) {
                    $t = mb_strtolower($search);
                    $found = (
                        mb_stripos($it['nombres_completos'] ?? '', $t) !== false ||
                        mb_stripos($it['codigo_alumno'] ?? '', $t) !== false ||
                        mb_stripos($it['codigo_ticket'] ?? '', $t) !== false ||
                        mb_stripos($it['correo_institucional'] ?? '', $t) !== false
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

        echo json_encode([
            'success' => true,
            'source'  => 'json_fallback',
            'count'   => count($items),
            'data'    => $items
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ----------------------------------------------------------------------------
// POST: Actualizar estado, asignar Zoom o eliminar registro
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

        // 1. En MySQL
        try {
            $pdo = DB::getConnection();
            $stmt = $pdo->prepare("UPDATE `estudiantes_atenciones` SET `estado` = ?, `observaciones_coordinacion` = ?, `link_zoom` = ? WHERE `id` = ? OR `codigo_ticket` = ?");
            $stmt->execute([$nuevoEstado, $observacion, $zoomLink, $id, $ticketCode]);
        } catch (Exception $e) {}

        // 2. En JSON local
        if (file_exists($jsonBackup)) {
            $list = json_decode(file_get_contents($jsonBackup), true) ?: [];
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
                @file_put_contents($jsonBackup, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
            }
        }

        echo json_encode([
            'success'   => true,
            'message'   => 'Llamado/Cita actualizada exitosamente en el subdominio',
            'id'        => $id,
            'ticket'    => $ticketCode,
            'estado'    => $nuevoEstado,
            'link_zoom' => $zoomLink
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // B. Eliminar
    if ($action === 'delete') {
        try {
            DB::deleteReserva($id);
        } catch (Exception $e) {}

        if (file_exists($jsonBackup)) {
            $list = json_decode(file_get_contents($jsonBackup), true) ?: [];
            $list = array_values(array_filter($list, function($it) use ($id, $ticketCode) {
                return ($it['id'] != $id && ($it['codigo_ticket'] ?? '') !== $ticketCode);
            }));
            @file_put_contents($jsonBackup, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }

        echo json_encode(['success' => true, 'message' => 'Cita eliminada correctamente']);
        exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido']);
