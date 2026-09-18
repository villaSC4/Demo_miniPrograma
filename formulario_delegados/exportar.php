<?php
/**
 * Exportación de Asistencia a Excel (CSV con UTF-8 BOM)
 * 1RA REUNIÓN DE DELEGADOS 2026-2
 */
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Verificar autenticación
if (empty($_SESSION['delegados_admin_auth'])) {
    header('Location: admin.php');
    exit;
}

$delegados = DB::getAllDelegados();

$filename = "Asistencia_Delegados_2026-2_" . date('Ymd_His') . ".csv";

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

// Abrir stream de salida
$output = fopen('php://output', 'w');

// Escribir BOM de UTF-8 para que Microsoft Excel lo abra correctamente con tildes y caracteres especiales
fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

// Cabeceras de columnas (separadas por coma o punto y coma)
fputcsv($output, [
    'ID',
    'Apellidos y Nombres',
    'Código de Alumno',
    'Correo Institucional/Personal',
    'Escuela Profesional',
    'Asignatura',
    'Sección',
    'Ciclo',
    'Declaración Aceptada',
    'IP de Registro',
    'Fecha y Hora de Registro'
], ';');

foreach ($delegados as $d) {
    fputcsv($output, [
        $d['id'] ?? '',
        $d['apellidos_nombres'] ?? '',
        $d['codigo_alumno'] ?? '',
        $d['correo'] ?? '',
        $d['escuela_profesional'] ?? '',
        $d['asignatura'] ?? '',
        $d['seccion'] ?? '',
        $d['ciclo'] ?? '',
        (!empty($d['declaracion_aceptada']) ? 'SÍ' : 'NO'),
        $d['ip_registro'] ?? '',
        $d['fecha_registro'] ?? ''
    ], ';');
}

fclose($output);
exit;
