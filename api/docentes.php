<?php
/**
 * api/docentes.php - Directorio Docente para cPanel / Apache / PHP
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/../data/docentes.json';

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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);

    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'error' => 'Se esperaba una lista de docentes en formato JSON']);
        exit;
    }

    $dataDir = dirname($dataFile);
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0755, true);
    }

    $jsonString = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $bytesWritten = @file_put_contents($dataFile, $jsonString);

    if ($bytesWritten !== false) {
        echo json_encode([
            'status' => 'success',
            'count' => count($decoded),
            'message' => 'Directorio de docentes guardado en data/docentes.json'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'error' => 'No se pudo escribir en data/docentes.json']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'error', 'error' => 'Método no permitido']);
