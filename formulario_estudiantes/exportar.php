<?php
/**
 * Exportación directa de Reservas de Atención a Excel / CSV (UTF-8 BOM)
 * RESERVA DE ATENCIÓN ESTUDIANTIL 2026-2 — UCV
 */
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Verificar autenticación
if (empty($_SESSION['estudiantes_admin_auth'])) {
    header('Location: admin.php');
    exit;
}

$reservas = DB::getAllReservas();
$filename = "Atenciones_Estudiantes_2026-2_" . date('Ymd_His') . ".csv";

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

$output = fopen('php://output', 'w');

// Escribir BOM de UTF-8 para Excel
fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

fputcsv($output, [
    'ID',
    'Código Ticket',
    'Apellidos y Nombres',
    'Código Alumno',
    'Carrera Profesional',
    'Correo Institucional',
    'Tipo de Atención',
    'Día de Atención',
    'Horario',
    'Estado',
    'Sala Virtual / Zoom',
    'Detalle / Motivo',
    'Observaciones Coordinación',
    'IP de Registro',
    'Fecha de Registro'
], ';');

foreach ($reservas as $r) {
    fputcsv($output, [
        $r['id'] ?? '',
        $r['codigo_ticket'] ?? '',
        $r['nombres_completos'] ?? '',
        $r['codigo_alumno'] ?? '',
        $r['carrera_profesional'] ?? '',
        $r['correo_institucional'] ?? '',
        $r['tipo_atencion'] ?? '',
        $r['dia_atencion'] ?? '',
        $r['horario_atencion'] ?? '',
        $r['estado'] ?? '',
        $r['link_zoom'] ?? '',
        $r['detalle_motivo'] ?? '',
        $r['observaciones_coordinacion'] ?? '',
        $r['ip_registro'] ?? '',
        $r['fecha_registro'] ?? ''
    ], ';');
}

fclose($output);
exit;
