<?php
/**
 * api/rendimiento_industrial.php - API de Rendimiento Académico para DAC Industrial
 * Procesa la persistencia física en data/rendimiento_industrial.json para cPanel / Apache / PHP
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/../data/rendimiento_industrial.json';
$baseFile = __DIR__ . '/../data/rendimiento_industrial_base.json';

// GET: Retornar data guardada
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($dataFile)) {
        $content = file_get_contents($dataFile);
        if ($content !== false && strlen(trim($content)) > 0) {
            echo $content;
            exit;
        }
    }
    if (file_exists($baseFile)) {
        echo file_get_contents($baseFile);
        exit;
    }
    echo json_encode(['status' => 'empty', 'data' => null]);
    exit;
}

// POST: Guardar data actualizada desde la subida de Excel
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);

    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'error' => 'Se esperaba un objeto JSON válido con los datos de rendimiento']);
        exit;
    }

    // Comando especial: resetear a versión base
    if (isset($decoded['action']) && $decoded['action'] === 'reset') {
        if (file_exists($baseFile)) {
            copy($baseFile, $dataFile);
            $baseData = json_decode(file_get_contents($dataFile), true);
            echo json_encode([
                'status' => 'success',
                'message' => 'Datos de rendimiento de Ingeniería Industrial restablecidos a la versión base oficial',
                'data' => $baseData
            ]);
            exit;
        }
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
            'message' => 'Reporte de rendimiento de Ingeniería Industrial guardado exitosamente',
            'bytes' => $bytesWritten,
            'timestamp' => date('c')
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'error' => 'No se pudo escribir en data/rendimiento_industrial.json']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['status' => 'error', 'error' => 'Método no permitido']);
