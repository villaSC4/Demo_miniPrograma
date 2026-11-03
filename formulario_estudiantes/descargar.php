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
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
$emailIn = trim($body['email']    ?? '');
$passIn  = trim($body['password'] ?? '');

if (mb_strtolower($emailIn) !== mb_strtolower(DOWNLOAD_EMAIL) || $passIn !== DOWNLOAD_PASS) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Credenciales incorrectas de Coordinación.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $reservas = DB::getAllReservas();
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la Base de Datos.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$total    = count($reservas);
$filename = 'Atenciones_Estudiantes_2026-2_' . date('Ymd_His') . '.csv';

function csvEscape($val) {
    $val = (string) $val;
    if (strpbrk($val, ";\"\\r\\n") !== false) { return '"' . str_replace('"', '""', $val) . '"'; }
    return $val;
}
function csvRow(array $f) { return implode(';', array_map('csvEscape', $f)) . "\r\n"; }

$csv  = "sep=;\r\n";
$csv .= "REPORTE OFICIAL DE RESERVAS DE ATENCION ESTUDIANTIL - SEMESTRE 2026-2\r\n";
$csv .= "Facultad de Ingenieria y Arquitectura - Universidad Cesar Vallejo\r\n";
$csv .= "Generado el: " . date('d/m/Y H:i:s') . "  |  Total de atenciones: " . $total . "\r\n\r\n";
$csv .= csvRow(['N','Codigo Ticket','Estudiante','Codigo Alumno','Carrera Profesional','Correo Institucional','Tipo de Atencion','Dia de Atencion','Horario','Estado','Motivo/Descripcion','Notas Coordinacion','IP Registro','Fecha de Registro']);

$n = 1;
foreach ($reservas as $r) {
    $csv .= csvRow([
        $n++,
        $r['codigo_ticket'] ?? '',
        $r['nombres_completos'] ?? '',
        $r['codigo_alumno'] ?? '',
        $r['carrera_profesional'] ?? '',
        $r['correo_institucional'] ?? '',
        $r['tipo_atencion'] ?? '',
        $r['dia_atencion'] ?? '',
        $r['horario_atencion'] ?? '',
        $r['estado'] ?? '',
        $r['detalle_motivo'] ?? '',
        $r['observaciones_coordinacion'] ?? '',
        $r['ip_registro'] ?? '',
        $r['fecha_registro'] ?? ''
    ]);
}

if (function_exists('mb_convert_encoding')) {
    $out = mb_convert_encoding($csv, 'Windows-1252', 'UTF-8'); 
    $cs = 'windows-1252';
} else {
    $out = "\xEF\xBB\xBF" . $csv; 
    $cs = 'utf-8';
}

header('Content-Type: text/csv; charset=' . $cs);
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($out));
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
echo $out;
exit;
