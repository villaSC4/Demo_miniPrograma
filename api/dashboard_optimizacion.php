<?php
/**
 * api/dashboard_optimizacion.php
 * Endpoint para proveer los datos analíticos de Optimización y Evolución Histórica
 * generados a partir de los reportes oficiales TRILCE / DRA de los Excels.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/../data/dashboard_optimizacion_data.json';

if (file_exists($dataFile)) {
    $content = file_get_contents($dataFile);
    if ($content !== false && strlen(trim($content)) > 0) {
        echo $content;
        exit;
    }
}

http_response_code(404);
echo json_encode([
    'status' => 'error',
    'message' => 'Archivo de datos analíticos no encontrado'
], JSON_UNESCAPED_UNICODE);
