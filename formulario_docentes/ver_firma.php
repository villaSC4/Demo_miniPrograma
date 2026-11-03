<?php
/**
 * Visualizador Seguro de Firmas Digitales — SISTEMA DOCENTES
 * Sirve imágenes de firma solo a sesiones de administrador autenticadas
 */
session_start();
require_once __DIR__ . '/config.php';

// Verificar autenticación
if (empty($_SESSION['docentes_admin_auth'])) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Acceso no autorizado.';
    exit;
}

$filename = basename($_GET['f'] ?? '');

if (empty($filename) || !preg_match('/^firma_[a-zA-Z0-9_]+\.(png|jpg|jpeg|webp)$/i', $filename)) {
    http_response_code(400);
    header('Content-Type: text/plain');
    echo 'Archivo no válido.';
    exit;
}

$filepath = __DIR__ . '/data/firmas/' . $filename;

if (!file_exists($filepath)) {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo 'Firma no encontrada.';
    exit;
}

$ext = strtolower(pathinfo($filepath, PATHINFO_EXTENSION));
$mime = 'image/png';
if ($ext === 'jpg' || $ext === 'jpeg') {
    $mime = 'image/jpeg';
} elseif ($ext === 'webp') {
    $mime = 'image/webp';
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($filepath));
header('Cache-Control: private, max-age=3600');
readfile($filepath);
exit;
