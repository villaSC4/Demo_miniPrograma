<?php
/**
 * api/whatsapp.php - Endpoint Proxy y Gestor de WhatsApp para cPanel / Apache
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$baseDir = realpath(__DIR__ . '/..');
$shPath = $baseDir . '/run_whatsapp.sh';
$scriptPath = $baseDir . '/whatsapp_service.js';
$logFile = $baseDir . '/data/whatsapp_service.log';

// URL base del Microservicio Node.js en localhost:3001
$waServiceUrl = getenv('WHATSAPP_SERVICE_URL') ?: 'http://127.0.0.1:3001';

$path = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// Verificar si el microservicio está activo
function checkServiceOnline($url) {
    $ch = curl_init($url . '/api/whatsapp/status');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($httpCode === 200) ? json_decode($response, true) : null;
}

// 1. Verificar si el microservicio está activo
$statusData = checkServiceOnline($waServiceUrl);

// 2. Si no está activo, intentar auto-arranque inmediato en cPanel
if (!$statusData) {
    if (file_exists($shPath) && function_exists('exec')) {
        @exec("/bin/bash " . escapeshellarg($shPath) . " > /dev/null 2>&1 &");
        usleep(1800000); // 1.8 segundos
        $statusData = checkServiceOnline($waServiceUrl);
    }

    if (!$statusData && function_exists('exec')) {
        $possibleNodes = [
            '/usr/bin/node',
            '/usr/local/bin/node',
            '/opt/cpanel/ea-nodejs22/bin/node',
            '/opt/cpanel/ea-nodejs20/bin/node',
            '/opt/cpanel/ea-nodejs18/bin/node',
            '/opt/cpanel/ea-nodejs16/bin/node',
            '/bin/node'
        ];
        $nodeBin = null;
        foreach ($possibleNodes as $p) {
            if (@file_exists($p) && @is_executable($p)) {
                $nodeBin = $p;
                break;
            }
        }
        if (!$nodeBin) {
            $which = @exec('which node 2>/dev/null');
            if (!empty($which) && @file_exists($which) && @is_executable($which)) {
                $nodeBin = $which;
            }
        }

        if ($nodeBin) {
            $cmd = sprintf('cd %s && ( %s %s >> %s 2>&1 & )', escapeshellarg($baseDir), escapeshellcmd($nodeBin), escapeshellarg($scriptPath), escapeshellarg($logFile));
            @exec($cmd);
            usleep(1800000);
            $statusData = checkServiceOnline($waServiceUrl);
        }
    }
}

// 3. Si aún no responde, informar diagnóstico y comando Cron
if (!$statusData) {
    echo json_encode([
        'status' => 'OFFLINE_NODE',
        'message' => 'El microservicio WhatsApp no está en ejecución en ' . $waServiceUrl,
        'cpanel_manager_url' => 'api/wa_cpanel_manager.php',
        'cpanel_cron_instruction' => "* * * * * /bin/bash {$shPath} > /dev/null 2>&1",
        'hasQR' => false,
        'user' => null
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. Reenviar la petición al microservicio Node.js
$targetUrl = $waServiceUrl . '/api/whatsapp/' . ltrim($path, '/');

// Preservar query parameters adicionales si los hubiera
$queryParams = $_GET;
unset($queryParams['endpoint']);
if (!empty($queryParams)) {
    $targetUrl .= (strpos($targetUrl, '?') === false ? '?' : '&') . http_build_query($queryParams);
}

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

if (!empty($_FILES)) {
    // Manejo de envío de archivos multipart (audios, imágenes, documentos)
    $postData = $_POST;
    foreach ($_FILES as $key => $fileInfo) {
        if ($fileInfo['error'] === UPLOAD_ERR_OK) {
            $postData[$key] = new CURLFile($fileInfo['tmp_name'], $fileInfo['type'], $fileInfo['name']);
        }
    }
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
} elseif ($method === 'POST') {
    $body = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($body)
    ]);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode ?: 200);
echo $response;
