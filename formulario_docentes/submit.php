<?php
/**
 * Endpoint de Procesamiento de Registro de Asistencia Docente
 * CONTROL DE ASISTENCIA DOCENTE 2026-2 — SISTEMA AISLADO (MySQL)
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

// Leer datos (soporta JSON y application/x-www-form-urlencoded)
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$inputData = [];

if (stripos($contentType, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $inputData = json_decode($raw, true) ?: [];
} else {
    $inputData = $_POST;
}

// Extraer y limpiar campos
$apellidosNombres = trim($inputData['apellidos_nombres'] ?? '');
$codigoDocente    = trim($inputData['codigo_docente'] ?? '');
$dni              = trim($inputData['dni'] ?? '');
$correo           = trim($inputData['correo'] ?? '');
$escuela          = trim($inputData['escuela_profesional'] ?? '');
$asignatura       = trim($inputData['asignatura'] ?? '');
$seccion          = trim($inputData['seccion'] ?? '');
$ciclo            = trim($inputData['ciclo'] ?? '');
$observaciones    = trim($inputData['observaciones'] ?? '');
$firmaBase64      = $inputData['firma'] ?? '';
$declaracion      = isset($inputData['declaracion_aceptada']) ? (bool)$inputData['declaracion_aceptada'] : false;

// Validaciones
$errores = [];

if (empty($apellidosNombres) || mb_strlen($apellidosNombres) < 4) {
    $errores[] = 'Ingrese sus Apellidos y Nombres completos.';
}

if (empty($codigoDocente)) {
    $errores[] = 'Ingrese su Código Institucional de Docente.';
}

if (empty($dni) || !preg_match('/^[0-9]{8}$/', $dni)) {
    $errores[] = 'El DNI debe contener exactamente 8 dígitos numéricos.';
}

if (empty($escuela) || $escuela === 'Elegir') {
    $errores[] = 'Seleccione su Escuela Profesional.';
}

if (empty($asignatura) || mb_strlen($asignatura) < 2) {
    $errores[] = 'Ingrese el nombre de la Asignatura que dicta.';
}

if (empty($seccion)) {
    $errores[] = 'Ingrese la Sección o Grupo de Aula correspondiente.';
}

$ciclosValidos = ['Ciclo I', 'Ciclo II', 'Ciclo III', 'Ciclo IV', 'Ciclo V', 'Ciclo VI', 'Ciclo VII', 'Ciclo VIII', 'Ciclo IX', 'Ciclo X', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
if (empty($ciclo) || !in_array($ciclo, $ciclosValidos)) {
    $errores[] = 'Seleccione el Ciclo Académico correspondiente.';
}

// Normalizar formato de ciclo a "Ciclo X"
if (!str_starts_with($ciclo, 'Ciclo ')) {
    $ciclo = 'Ciclo ' . $ciclo;
}

if (empty($firmaBase64)) {
    $errores[] = 'Debe registrar su firma digital en el recuadro correspondiente.';
}

if (!$declaracion) {
    $errores[] = 'Debe aceptar la declaración de conformidad y autorización de datos personales.';
}

if (!empty($errores)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Por favor complete todos los campos obligatorios.',
        'errors' => $errores
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Procesar y guardar la firma como archivo de imagen
$firmaArchivo = '';
if (!empty($firmaBase64) && preg_match('/^data:image\/(png|jpeg|jpg|webp);base64,/i', $firmaBase64, $m)) {
    $firmasDir = __DIR__ . '/data/firmas';
    if (!is_dir($firmasDir)) {
        @mkdir($firmasDir, 0777, true);
    }

    $rawExt = strtolower($m[1]);
    $ext = ($rawExt === 'jpeg' || $rawExt === 'jpg') ? 'jpg' : (($rawExt === 'webp') ? 'webp' : 'png');

    $base64Data = preg_replace('/^data:image\/(png|jpeg|jpg|webp);base64,/i', '', $firmaBase64);
    $base64Data = str_replace(' ', '+', $base64Data);
    $imgData = base64_decode($base64Data);

    if ($imgData !== false) {
        $maxSize = defined('FIRMA_MAX_SIZE') ? FIRMA_MAX_SIZE : 2097152; // 2MB
        if (strlen($imgData) > $maxSize) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'La firma excede el tamaño máximo permitido (2MB).',
                'errors' => ['La imagen de la firma es demasiado grande.']
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $firmaArchivo = 'firma_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $written = @file_put_contents($firmasDir . '/' . $firmaArchivo, $imgData);
        if ($written === false) {
            error_log("No se pudo guardar la firma en: $firmasDir/$firmaArchivo");
            $firmaArchivo = '';
        }
    }
}

try {
    $res = DB::saveDocente([
        'apellidos_nombres'    => $apellidosNombres,
        'codigo_docente'       => $codigoDocente,
        'dni'                  => $dni,
        'correo'               => $correo,
        'escuela_profesional'  => $escuela,
        'asignatura'           => $asignatura,
        'seccion'              => $seccion,
        'ciclo'                => $ciclo,
        'observaciones'        => $observaciones,
        'firma_archivo'        => $firmaArchivo,
        'declaracion_aceptada' => 1
    ]);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => '¡Asistencia docente registrada con éxito en la Base de Datos!',
        'id'      => $res['id'],
        'engine'  => $res['engine'],
        'fecha'   => $res['fecha']
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al guardar en la base de datos SQL.',
        'error'   => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
