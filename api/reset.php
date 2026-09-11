<?php
/**
 * api/reset.php - Endpoint para restablecer la base oficial en cPanel
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/../data/grupos.json';
$baseFile = __DIR__ . '/../data/grupos_base.json';

if (file_exists($baseFile)) {
    @copy($baseFile, $dataFile);
    $data = json_decode(@file_get_contents($dataFile), true);
    echo json_encode([
        'status' => 'success',
        'count' => is_array($data) ? count($data) : 128,
        'message' => 'Datos restablecidos a la versión base oficial (128 grupos)'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error' => 'Archivo base data/grupos_base.json no encontrado'
    ]);
}
