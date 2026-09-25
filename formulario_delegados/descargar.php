<?php
ob_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
ob_end_clean();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Metodo no permitido.']);
    exit;
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
$emailIn = trim($body['email']    ?? '');
$passIn  = trim($body['password'] ?? '');

if (mb_strtolower($emailIn) !== mb_strtolower(DOWNLOAD_EMAIL) || $passIn !== DOWNLOAD_PASS) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Credenciales incorrectas.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$delegados = DB::getAllDelegados();
$total     = count($delegados);
$filename  = 'Delegados_Reunion_2026-2_' . date('Ymd_His') . '.csv';

function csvEscape($val) {
    $val = (string) $val;
    if (strpbrk($val, ";\"\r\n") !== false) { return '"' . str_replace('"', '""', $val) . '"'; }
    return $val;
}
function csvRow(array $f) { return implode(';', array_map('csvEscape', $f)) . "\r\n"; }

$csv  = "sep=;\r\n";
$csv .= "REPORTE DE ASISTENCIA - REUNION DE DELEGADOS 2026-2\r\n";
$csv .= "Facultad de Ingenieria y Arquitectura - Universidad Cesar Vallejo\r\n";
$csv .= "Generado el: " . date('d/m/Y H:i:s') . "  |  Total de registros: " . $total . "\r\n\r\n";
$csv .= csvRow(['N','Apellidos y Nombres','Codigo de Alumno','Correo','Escuela Profesional','Asignatura','Seccion','Ciclo','Declaracion Aceptada','IP de Registro','Fecha y Hora de Registro']);

$n = 1;
foreach ($delegados as $d) {
    $csv .= csvRow([$n++, $d['apellidos_nombres']??'', $d['codigo_alumno']??'', $d['correo']??'', $d['escuela_profesional']??'', $d['asignatura']??'', $d['seccion']??'', 'Ciclo '.($d['ciclo']??''), (!empty($d['declaracion_aceptada'])?'SI':'NO'), $d['ip_registro']??'', $d['fecha_registro']??'']);
}

if (function_exists('mb_convert_encoding')) {
    $out = mb_convert_encoding($csv, 'Windows-1252', 'UTF-8'); $cs = 'windows-1252';
} else {
    $out = "\xEF\xBB\xBF" . $csv; $cs = 'utf-8';
}

header('Content-Type: text/csv; charset=' . $cs);
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($out));
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
echo $out;
exit;