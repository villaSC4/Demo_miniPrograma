<?php
/**
 * Exportación de Asistencia Docente a Excel (CSV con UTF-8 BOM)
 * CONTROL DE ASISTENCIA DOCENTE 2026-2 — SISTEMA AISLADO (MySQL)
 */
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Verificar autenticación
if (empty($_SESSION['docentes_admin_auth'])) {
    header('Location: admin.php');
    exit;
}

$docentes = DB::getAllDocentes();

$filename = "Asistencia_Docentes_2026-2_" . date('Ymd_His') . ".csv";

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

$output = fopen('php://output', 'w');

// Escribir BOM de UTF-8 para que Microsoft Excel lo abra con tildes y caracteres especiales
fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

// Cabeceras de columnas oficiales
fputcsv($output, [
    'ID',
    'Apellidos y Nombres',
    'Código Docente',
    'DNI',
    'Correo',
    'Escuela Profesional',
    'Asignatura',
    'Sección / Aula',
    'Ciclo Académico',
    'Observaciones',
    'Tiene Firma',
    'Declaración Aceptada',
    'IP de Registro',
    'Fecha y Hora de Registro'
], ';');

foreach ($docentes as $d) {
    fputcsv($output, [
        $d['id'] ?? '',
        $d['apellidos_nombres'] ?? '',
        $d['codigo_docente'] ?? '',
        $d['dni'] ?? '',
        $d['correo'] ?? '',
        $d['escuela_profesional'] ?? '',
        $d['asignatura'] ?? '',
        $d['seccion'] ?? '',
        $d['ciclo'] ?? '',
        $d['observaciones'] ?? '',
        (!empty($d['firma_archivo']) ? 'SÍ' : 'NO'),
        (!empty($d['declaracion_aceptada']) ? 'SÍ' : 'NO'),
        $d['ip_registro'] ?? '',
        $d['fecha_registro'] ?? ''
    ], ';');
}

fclose($output);
exit;
