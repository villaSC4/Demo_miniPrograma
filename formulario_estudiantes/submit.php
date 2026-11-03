<?php
/**
 * Endpoint de Procesamiento de Reserva de Atención Estudiantil
 * CONTROL DE ATENCIONES ESTUDIANTILES 2026-2 — SISTEMA AISLADO (MySQL)
 */
header('Content-Type: application/json; charset=utf-8');

// Habilitar CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Utilice POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/db.php';

// Leer datos (soporta JSON y form-urlencoded)
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$inputData = [];

if (stripos($contentType, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $inputData = json_decode($raw, true) ?: [];
} else {
    $inputData = $_POST;
}

// Extraer campos
$nombres     = trim($inputData['nombres_completos'] ?? '');
$codigo      = trim($inputData['codigo_alumno'] ?? '');
$carrera     = trim($inputData['carrera_profesional'] ?? '');
$correo      = trim($inputData['correo_institucional'] ?? '');
$tipo        = trim($inputData['tipo_atencion'] ?? '');
$dia         = trim($inputData['dia_atencion'] ?? '');
$horario     = trim($inputData['horario_atencion'] ?? '');
$motivo      = trim($inputData['detalle_motivo'] ?? '');

$errores = [];

if (empty($nombres) || mb_strlen($nombres) < 4 || preg_match('/\d/', $nombres) || !preg_match('/^[\p{L}\s\.\-\'\’]{4,70}$/u', $nombres)) {
    $errores[] = 'Ingrese sus Nombres y Apellidos completos válidos (solo letras y espacios, sin números).';
}

if (empty($codigo) || !preg_match('/^[0-9]{9,10}$/', $codigo)) {
    $errores[] = 'El Código de Estudiante debe contener exactamente 10 dígitos numéricos (sin letras).';
}

$carrerasValidas = ['Ingeniería de Sistemas', 'Ingeniería Industrial'];
if (empty($carrera) || !in_array($carrera, $carrerasValidas)) {
    $errores[] = 'Seleccione su Carrera Profesional (Ingeniería de Sistemas o Ingeniería Industrial).';
}

if (empty($correo) || !preg_match('/^[a-zA-Z0-9._%+-]+@ucvvirtual\.edu\.pe$/i', $correo)) {
    $errores[] = 'Ingrese un Correo Institucional válido que termine estrictamente en @ucvvirtual.edu.pe sin caracteres adicionales.';
}

if (!in_array($tipo, ['Reclamo', 'Solicitud'])) {
    $errores[] = 'Seleccione el Tipo de Atención (Reclamo o Solicitud).';
}

$diasValidos = ['Lunes', 'Viernes'];
if (empty($dia) || !in_array($dia, $diasValidos)) {
    $errores[] = 'Seleccione un día de atención válido (Lunes o Viernes).';
}

if ($carrera === 'Ingeniería de Sistemas' && $dia !== 'Lunes') {
    $errores[] = 'Para Ingeniería de Sistemas, la atención se realiza exclusivamente los días Lunes de 7:00 PM a 9:00 PM.';
}

if ($carrera === 'Ingeniería Industrial' && $dia !== 'Viernes') {
    $errores[] = 'Para Ingeniería Industrial, la atención se realiza exclusivamente los días Viernes de 7:00 PM a 9:00 PM.';
}

if (empty($horario)) {
    $errores[] = 'Seleccione el horario de atención (franjas de 15 minutos entre 7:00 PM y 9:00 PM).';
}

if (!empty($errores)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Por favor complete todos los datos requeridos.',
        'errors'  => $errores
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Validar en tiempo real si el turno ya fue reservado por otro estudiante
if (method_exists('DB', 'isHorarioOcupado') && DB::isHorarioOcupado($dia, $horario)) {
    http_response_code(409);
    echo json_encode([
        'success'    => false,
        'message'    => "El turno de {$dia} en el horario {$horario} ya se encuentra reservado por otro estudiante. Por favor seleccione otro horario disponible.",
        'error_code' => 'HORARIO_OCUPADO'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $res = DB::saveReserva([
        'nombres_completos'    => $nombres,
        'codigo_alumno'        => $codigo,
        'carrera_profesional'  => $carrera,
        'correo_institucional' => $correo,
        'tipo_atencion'        => $tipo,
        'dia_atencion'         => $dia,
        'horario_atencion'     => $horario,
        'detalle_motivo'       => $motivo
    ]);

    // ------------------------------------------------------------------------
    // Sincronización con la plataforma PAE y módulo de atención DAC
    // ------------------------------------------------------------------------
    $baseDir = dirname(__DIR__);
    $ticketCode = $res['codigo_ticket'] ?? ('ATN-2026-' . mt_rand(1000, 9999));
    $fechaNow = $res['fecha'] ?? date('Y-m-d H:i:s');

    $atnEntry = [
        'id'                         => $res['id'] ?? time(),
        'codigo_ticket'              => $ticketCode,
        'nombres_completos'          => $nombres,
        'codigo_alumno'              => $codigo,
        'carrera_profesional'        => $carrera,
        'correo_institucional'       => $correo,
        'tipo_atencion'              => $tipo,
        'dia_atencion'               => $dia,
        'horario_atencion'           => $horario,
        'detalle_motivo'             => $motivo,
        'estado'                     => 'Pendiente',
        'link_zoom'                  => '',
        'observaciones_coordinacion' => '',
        'fecha_registro'             => $fechaNow
    ];

    // 1. Guardar en data/atenciones.json
    $atnFiles = [
        $baseDir . '/data/atenciones.json',
        __DIR__ . '/data/atenciones.json'
    ];
    foreach ($atnFiles as $af) {
        $dir = dirname($af);
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $existing = file_exists($af) ? (json_decode(file_get_contents($af), true) ?: []) : [];
        array_unshift($existing, $atnEntry);
        @file_put_contents($af, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    // 2. Guardar en data/pau_correos.json (Bandeja PAE)
    $pauFile = $baseDir . '/data/pau_correos.json';
    $pauDir = dirname($pauFile);
    if (!is_dir($pauDir)) @mkdir($pauDir, 0755, true);
    $pauList = file_exists($pauFile) ? (json_decode(file_get_contents($pauFile), true) ?: []) : [];
    $pauEntry = [
        'id'                 => time() + mt_rand(1, 999),
        'fecha'              => date('d/m/Y H:i'),
        'remitente'          => $nombres,
        'correo'             => $correo,
        'escuela'            => $carrera,
        'asunto'             => "[{$tipo}] Atención Reservada: {$dia} ({$horario}) - Cód. {$codigo}",
        'estado_atencion'    => 'Sin Atención',
        'visto_coordinacion' => 'SIN APROBACIÓN',
        'fecha_respuesta'    => '-',
        'tipo'               => $tipo,
        'codigo_ticket'      => $ticketCode,
        'codigo_alumno'      => $codigo,
        'dia_atencion'       => $dia,
        'horario_atencion'   => $horario,
        'detalle_motivo'     => $motivo,
        'link_zoom'          => ''
    ];
    array_unshift($pauList, $pauEntry);
    @file_put_contents($pauFile, json_encode($pauList, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    http_response_code(200);
    echo json_encode([
        'success'       => true,
        'message'       => '¡Reserva de atención registrada en la plataforma PAE del DAC!',
        'id'            => $res['id'],
        'codigo_ticket' => $res['codigo_ticket'],
        'engine'        => $res['engine'],
        'fecha'         => $res['fecha']
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al guardar la reserva en la Base de Datos.',
        'error'   => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
