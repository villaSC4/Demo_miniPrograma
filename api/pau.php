<?php
/**
 * api/pau.php - Gestión del Módulo PAU / PAE (Atención al Estudiante y Seguimiento de Correos)
 * Persistencia física en data/pau_correos.json para cPanel / Apache / PHP
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/../data/pau_correos.json';

// GET: Retornar lista de correos / solicitudes
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($dataFile)) {
        $content = file_get_contents($dataFile);
        if ($content !== false && strlen(trim($content)) > 0) {
            echo $content;
            exit;
        }
    }
    echo json_encode([]);
    exit;
}

// POST: Guardar o actualizar solicitudes (acepta lista completa o correo individual desde Webhook)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);

    if (!$decoded || !is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'error' => 'Formato JSON inválido']);
        exit;
    }

    $dataDir = dirname($dataFile);
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0755, true);
    }

    // Caso A: Objeto individual (Webhook de Google Apps Script / Correo entrante)
    if (isset($decoded['remitente']) || isset($decoded['correo']) || (isset($decoded['action']) && $decoded['action'] === 'incoming_email')) {
        $existing = [];
        if (file_exists($dataFile)) {
            $raw = file_get_contents($dataFile);
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) {
                $existing = $parsed;
            }
        }

        $correo = trim($decoded['correo'] ?? '');
        $asunto = trim($decoded['asunto'] ?? 'SIN ASUNTO');
        
        // Evitar duplicados exactos (mismo correo y asunto)
        foreach ($existing as $item) {
            if (strcasecmp($item['correo'] ?? '', $correo) === 0 && strcasecmp($item['asunto'] ?? '', $asunto) === 0) {
                echo json_encode([
                    'status' => 'already_exists',
                    'message' => 'Este correo ya fue sincronizado previamente.',
                    'ticket' => $item
                ]);
                exit;
            }
        }

        // Obtener el ID más alto
        $maxId = 0;
        foreach ($existing as $item) {
            if (isset($item['id']) && $item['id'] > $maxId) {
                $maxId = (int)$item['id'];
            }
        }

        $nowStr = date('d/m/Y H:i');
        $newTicket = [
            'id' => $maxId + 1,
            'fecha_correo' => !empty($decoded['fecha_correo']) ? $decoded['fecha_correo'] : $nowStr,
            'remitente' => strtoupper(trim($decoded['remitente'] ?? 'ALUMNO / DOCENTE UCV')),
            'correo' => $correo,
            'escuela' => $decoded['escuela'] ?? 'Ingeniería Industrial',
            'telefono' => $decoded['telefono'] ?? '',
            'asunto' => $asunto,
            'estado_atencion' => 'Sin Atención',
            'visto_coordinacion' => 'SIN APROBACIÓN',
            'fecha_respuesta' => '-',
            'observaciones' => trim($decoded['observaciones'] ?? 'Sincronizado automáticamente desde Gmail Coordinación')
        ];

        array_unshift($existing, $newTicket);
        file_put_contents($dataFile, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        echo json_encode([
            'status' => 'success',
            'message' => 'Nuevo correo recibido y sincronizado correctamente en la bandeja',
            'ticket' => $newTicket,
            'total' => count($existing)
        ]);
        exit;
    }

    // Caso B: Lista completa de tickets
    $jsonString = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $bytes = @file_put_contents($dataFile, $jsonString);

    if ($bytes !== false) {
        echo json_encode([
            'status' => 'success',
            'count' => count($decoded),
            'message' => 'Solicitudes PAU guardadas permanentemente en data/pau_correos.json'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'error' => 'No se pudo escribir en data/pau_correos.json']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'error', 'error' => 'Método no permitido']);
