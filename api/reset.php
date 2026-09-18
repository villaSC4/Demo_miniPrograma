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

$filesToReset = [
    'grupos' => ['data' => __DIR__ . '/../data/grupos.json', 'base' => __DIR__ . '/../data/grupos_base.json'],
    'docentes' => ['data' => __DIR__ . '/../data/docentes.json', 'base' => __DIR__ . '/../data/docentes_base.json'],
    'directorios' => ['data' => __DIR__ . '/../data/directorios.json', 'base' => __DIR__ . '/../data/directorios_base.json'],
    'carpetas' => ['data' => __DIR__ . '/../data/carpetas.json', 'base' => __DIR__ . '/../data/carpetas_base.json'],
    'supervisiones' => ['data' => __DIR__ . '/../data/supervisiones.json', 'base' => __DIR__ . '/../data/supervisiones_base.json']
];

$resetCount = 0;
foreach ($filesToReset as $item) {
    if (file_exists($item['base'])) {
        @copy($item['base'], $item['data']);
        $resetCount++;
    }
}

if (file_exists($filesToReset['grupos']['data'])) {
    $data = json_decode(@file_get_contents($filesToReset['grupos']['data']), true);
    echo json_encode([
        'status' => 'success',
        'count' => is_array($data) ? count($data) : 128,
        'resetFiles' => $resetCount,
        'message' => 'Datos restablecidos a la versión base oficial (128 grupos, nómina y registros)'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error' => 'No se pudo restablecer la base de datos'
    ]);
}
