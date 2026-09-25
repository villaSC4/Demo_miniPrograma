<?php
/**
 * config_membrete.php - Gestión del Membretado Oficial del Formulario de Delegados
 * Permite autenticarse, configurar y estandarizar el título, fecha y semestre para años posteriores.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$configFile = __DIR__ . '/data/config_membrete.json';

// Configuración estándar predeterminada
function getDefaultConfig() {
    return [
        'titulo_reunion' => 'REUNIÓN DE DELEGADOS 2026-2',
        'semestre' => '2026-II',
        'fecha_evento' => '24 de Septiembre de 2026',
        'programa' => 'SUBE A Distancia',
        'facultad' => 'Facultad de Ingeniería y Arquitectura',
        'subtitulo' => 'Facultad de Ingeniería y Arquitectura • Programa SUBE',
        'mensaje_bienvenida' => 'Estimados(as) delegados(as): Por encargo de la Dirección de Escuela y la Coordinación Académica, les damos la cordial bienvenida a la reunión de delegados del semestre. Por favor, registren sus datos de filiación y asignatura como evidencia formal de participación y representatividad estudiantil.'
    ];
}

// GET: Retornar configuración actual del membretado
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($configFile)) {
        $content = file_get_contents($configFile);
        if ($content !== false && strlen(trim($content)) > 0) {
            echo $content;
            exit;
        }
    }
    echo json_encode(getDefaultConfig(), JSON_UNESCAPED_UNICODE);
    exit;
}

// POST: Acciones de inicio de sesión, actualización o restablecimiento
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true) ?: $_POST;
    $action = $data['action'] ?? 'update';

    // 1. Acción: Inicio de Sesión de Coordinación
    if ($action === 'login') {
        $email = strtolower(trim($data['email'] ?? ''));
        $password = trim($data['password'] ?? '');

        if (($email === 'coordinacion.fia@ucvvirtual.edu.pe' || $email === 'coordinacion.fia') && ($password === 'DelegadosFIA2026' || $password === 'ucv2026')) {
            echo json_encode([
                'success' => true,
                'message' => 'Credenciales validadas exitosamente.',
                'email' => 'coordinacion.fia@ucvvirtual.edu.pe'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Credenciales incorrectas. Verifique el correo institucional y la contraseña.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Para actualizar o resetear, verificar contraseña o sesión
    $password = trim($data['password'] ?? '');
    if ($password !== 'DelegadosFIA2026' && $password !== 'ucv2026') {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'No autorizado. Debe iniciar sesión con las credenciales de Coordinación.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $dataDir = dirname($configFile);
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0755, true);
    }

    // 2. Acción: Restablecer a valores por defecto
    if ($action === 'reset') {
        $def = getDefaultConfig();
        $def['fecha_actualizacion'] = date('Y-m-d H:i:s');
        @file_put_contents($configFile, json_encode($def, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode([
            'success' => true,
            'message' => 'Membretado restablecido a los valores estándar de la Reunión de Delegados 2026-2.',
            'config' => $def
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 3. Acción: Actualizar configuración
    $titulo = trim($data['titulo_reunion'] ?? 'REUNIÓN DE DELEGADOS 2026-2');
    $semestre = trim($data['semestre'] ?? '2026-II');
    $fecha = trim($data['fecha_evento'] ?? date('d/m/Y'));
    $programa = trim($data['programa'] ?? 'SUBE A Distancia');
    $facultad = trim($data['facultad'] ?? 'Facultad de Ingeniería y Arquitectura');
    $subtitulo = trim($data['subtitulo'] ?? ($facultad . ' • Programa SUBE'));
    $mensaje = trim($data['mensaje_bienvenida'] ?? '');

    $newConfig = [
        'titulo_reunion' => $titulo,
        'semestre' => $semestre,
        'fecha_evento' => $fecha,
        'programa' => $programa,
        'facultad' => $facultad,
        'subtitulo' => $subtitulo,
        'mensaje_bienvenida' => $mensaje,
        'fecha_actualizacion' => date('Y-m-d H:i:s')
    ];

    $jsonString = json_encode($newConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $bytes = @file_put_contents($configFile, $jsonString);

    if ($bytes !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Membrete oficial actualizado correctamente para el estándar del formulario.',
            'config' => $newConfig
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo guardar en el servidor.']);
    }
    exit;
}
