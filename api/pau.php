<?php
/**
 * api/pau.php - Gestión del Módulo PAE (Plataforma de Atención al Estudiante y Seguimiento de Correos)
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

// POST: Guardar o actualizar solicitudes (persistencia manual centralizada)
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

    // Persistencia manual: Lista completa de solicitudes PAE
    if (!is_array($decoded) || (count($decoded) > 0 && !isset($decoded[0]))) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'error' => 'Se esperaba una lista de solicitudes PAE en formato JSON']);
        exit;
    }

    $jsonString = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $bytes = @file_put_contents($dataFile, $jsonString, LOCK_EX);

    if ($bytes !== false) {
        echo json_encode([
            'status' => 'success',
            'count' => count($decoded),
            'message' => 'Solicitudes PAE guardadas permanentemente en data/pau_correos.json'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'error' => 'No se pudo escribir en data/pau_correos.json']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'error', 'error' => 'Método no permitido']);
