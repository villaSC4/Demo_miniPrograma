<?php
/**
 * Endpoint de Procesamiento de Registro de Asistencia
 * REUNIÓN DE DELEGADOS 2026-2
 */
header('Content-Type: application/json; charset=utf-8');

// Habilitar CORS si se consulta desde subdominio
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Utilice POST.']);
    exit;
}

require_once __DIR__ . '/db.php';

// Leer datos (soporta tanto JSON como multipart/form-data)
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
$codigoAlumno = trim($inputData['codigo_alumno'] ?? '');
$correo = trim($inputData['correo'] ?? '');
$escuela = trim($inputData['escuela_profesional'] ?? '');
$asignatura = trim($inputData['asignatura'] ?? '');
$seccion = trim($inputData['seccion'] ?? '');
$ciclo = trim($inputData['ciclo'] ?? '');
$declaracion = isset($inputData['declaracion_aceptada']) ? (bool)$inputData['declaracion_aceptada'] : false;

// Validaciones
$errores = [];

if (empty($apellidosNombres) || mb_strlen($apellidosNombres) < 4) {
    $errores[] = 'Ingrese sus Apellidos y Nombres completos.';
}

if (empty($codigoAlumno) || !preg_match('/^[0-9]{10}$/', $codigoAlumno)) {
    $errores[] = 'El Código de Estudiante debe contener exactamente 10 dígitos numéricos (ej. 6500018511).';
}

if (empty($escuela) || $escuela === 'Elegir') {
    $errores[] = 'Seleccione su Escuela Profesional.';
}

if (empty($asignatura) || mb_strlen($asignatura) < 2) {
    $errores[] = 'Ingrese el nombre de la Asignatura (campo obligatorio).';
}

if (empty($seccion) || mb_strlen($seccion) < 1) {
    $errores[] = 'Ingrese la Sección o Grupo de Aula correspondiente (campo obligatorio).';
}

if (empty($ciclo) || $ciclo === 'Elegir') {
    $errores[] = 'Seleccione o ingrese el Ciclo correspondiente.';
}

if (!$declaracion) {
    $errores[] = 'Debe aceptar la declaración jurada y autorización de datos personales.';
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

try {
    $res = DB::saveDelegado([
        'apellidos_nombres' => $apellidosNombres,
        'codigo_alumno' => $codigoAlumno,
        'correo' => $correo,
        'escuela_profesional' => $escuela,
        'asignatura' => $asignatura,
        'seccion' => $seccion,
        'ciclo' => $ciclo,
        'declaracion_aceptada' => 1
    ]);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => '¡Asistencia registrada con éxito!',
        'id' => $res['id'],
        'engine' => $res['engine'],
        'fecha' => $res['fecha']
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error interno al guardar los datos.',
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
