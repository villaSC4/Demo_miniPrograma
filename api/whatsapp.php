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

// URL base del Microservicio Node.js (Local o Servidor VPS/Render)
// Si está en el mismo cPanel con Node.js App, corre en localhost:3001
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

// Fallback o proxy
$statusData = checkServiceOnline($waServiceUrl);

if (!$statusData) {
    // Si el microservicio Node aún no está iniciado, responder con estado descriptivo
    echo json_encode([
        'status' => 'OFFLINE_NODE',
        'message' => 'El microservicio Baileys Node.js no está en ejecución en ' . $waServiceUrl,
        'instructions' => 'Ejecuta `npm run whatsapp` en tu servidor o configura la URL en cPanel.',
        'hasQR' => false,
        'user' => null
    ]);
    exit;
}

// Reenviar la petición al microservicio Node.js
$targetUrl = $waServiceUrl . '/api/whatsapp/' . ltrim($path, '/');
$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

if ($method === 'POST') {
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
