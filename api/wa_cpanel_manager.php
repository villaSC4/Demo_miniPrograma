<?php
/**
 * api/wa_cpanel_manager.php - Gestor, Monitor y Panel de Control de WhatsApp para cPanel
 * Permite ejecutar, monitorear y configurar el servicio 24/7 en cPanel sin necesidad de consola.
 */

$baseDir = realpath(__DIR__ . '/..');
$scriptPath = $baseDir . '/whatsapp_service.js';
$shPath = $baseDir . '/run_whatsapp.sh';
$modulesDir = $baseDir . '/node_modules';
$dataDir = $baseDir . '/data';
$logFile = $dataDir . '/whatsapp_service.log';

if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

// 1. Verificar si el servicio ya está corriendo en el puerto 3001
function isPortRunning($port = 3001) {
    $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 1);
    if ($fp) {
        fclose($fp);
        return true;
    }
    return false;
}

// 2. Buscar rutas habituales de Node.js en servidores cPanel (EasyApache 4 y CloudLinux)
function findNodeBinary() {
    $possiblePaths = [
        '/usr/bin/node',
        '/usr/local/bin/node',
        '/opt/cpanel/ea-nodejs22/bin/node',
        '/opt/cpanel/ea-nodejs20/bin/node',
        '/opt/cpanel/ea-nodejs18/bin/node',
        '/opt/cpanel/ea-nodejs16/bin/node',
        '/opt/cpanel/ea-nodejs14/bin/node',
        '/bin/node'
    ];

    foreach ($possiblePaths as $path) {
        if (@file_exists($path) && @is_executable($path)) {
            return $path;
        }
    }

    if (function_exists('exec')) {
        $which = @exec('which node 2>/dev/null');
        if (!empty($which) && @file_exists($which) && @is_executable($which)) {
            return $which;
        }
    }

    return null;
}

$action = $_GET['action'] ?? null;
$format = $_GET['format'] ?? null;
$wantsJson = ($action !== null && $action !== 'dashboard') || $format === 'json' || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

// A. Consulta de Estado (JSON)
if ($action === 'status' || ($action === null && $wantsJson)) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    $running = isPortRunning(3001);
    $nodeBin = findNodeBinary();
    $execAvailable = function_exists('exec') && !in_array('exec', array_map('trim', explode(',', ini_get('disable_functions') ?: '')));

    echo json_encode([
        'running' => $running,
        'port' => 3001,
        'node_installed' => !empty($nodeBin),
        'node_path' => $nodeBin,
        'exec_available' => $execAvailable,
        'base_dir' => $baseDir,
        'modules_exist' => is_dir($modulesDir),
        'script_exists' => file_exists($scriptPath),
        'cron_cmd' => "* * * * * /bin/bash {$shPath} > /dev/null 2>&1",
        'message' => $running ? 'Microservicio WhatsApp Activo en cPanel' : 'Servicio apagado'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// B. Iniciar Servicio en segundo plano desde PHP (JSON)
if ($action === 'start') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    if (isPortRunning(3001)) {
        echo json_encode([
            'success' => true,
            'running' => true,
            'message' => 'El microservicio ya se encuentra activo en el puerto 3001.'
        ]);
        exit;
    }

    $nodeBin = findNodeBinary();
    if (!$nodeBin) {
        echo json_encode([
            'success' => false,
            'running' => false,
            'error' => 'No se detectó el binario de Node.js en las rutas del servidor.',
            'tip' => 'Utilice la Tarea Cron de cPanel con el script run_whatsapp.sh.'
        ]);
        exit;
    }

    if (file_exists($shPath)) {
        @exec("/bin/bash " . escapeshellarg($shPath) . " > /dev/null 2>&1 &");
    } else {
        $cmd = sprintf('cd %s && ( %s %s >> %s 2>&1 & )', escapeshellarg($baseDir), escapeshellcmd($nodeBin), escapeshellarg($scriptPath), escapeshellarg($logFile));
        @exec($cmd);
    }

    usleep(2500000); // 2.5 seg
    $nowRunning = isPortRunning(3001);

    echo json_encode([
        'success' => $nowRunning,
        'running' => $nowRunning,
        'node_used' => $nodeBin,
        'message' => $nowRunning ? '¡Microservicio arrancado exitosamente en cPanel!' : 'Orden enviada. Verifique el log de datos.'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// C. Detener Servicio (JSON)
if ($action === 'stop') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    if (function_exists('exec')) {
        @exec("pkill -f 'whatsapp_service.js'");
        usleep(1000000);
    }
    echo json_encode([
        'success' => true,
        'running' => isPortRunning(3001),
        'message' => 'Se envió la orden de detención.'
    ]);
    exit;
}

// D. Ver últimas líneas del log (JSON)
if ($action === 'log') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    if (file_exists($logFile)) {
        $lines = array_slice(file($logFile), -40);
        echo json_encode([
            'success' => true,
            'lines' => $lines
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Aún no existe el archivo de log.'
        ]);
    }
    exit;
}

// =====================================================================
// PANEL VISUAL DE DIAGNOSTICO Y GESTION (HTML)
// =====================================================================
$running = isPortRunning(3001);
$nodeBin = findNodeBinary();
$hasModules = is_dir($modulesDir);
$cronCmd = "* * * * * /bin/bash {$shPath} > /dev/null 2>&1";
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel cPanel - Gestor WhatsApp 24/7</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg-dark: #0f172a;
            --card-bg: #1e293b;
            --card-border: #334155;
            --accent-green: #10b981;
            --accent-red: #ef4444;
            --accent-blue: #3b82f6;
            --accent-amber: #f59e0b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            min-height: 100vh;
            padding: 30px 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--card-border);
        }
        .header h1 {
            font-size: 22px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .header h1 i {
            color: var(--accent-green);
        }
        .badge-status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 13px;
        }
        .badge-online {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .badge-offline {
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .status-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
        }
        .dot-green { background: #10b981; box-shadow: 0 0 10px #10b981; }
        .dot-red { background: #ef4444; }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 14px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
        .card h2 {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            color: #cbd5e1;
        }
        .grid-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 16px;
        }
        .info-box {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 14px 16px;
            border-radius: 10px;
        }
        .info-box .label {
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        .info-box .value {
            font-size: 14px;
            font-weight: 600;
            font-family: 'JetBrains Mono', monospace;
            word-break: break-all;
        }

        .cron-box {
            background: #090d16;
            border: 1px solid #2d3748;
            border-radius: 10px;
            padding: 16px;
            position: relative;
        }
        .cron-cmd {
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            color: #38bdf8;
            word-break: break-all;
            padding-right: 90px;
        }
        .btn-copy {
            position: absolute;
            right: 12px;
            top: 12px;
            background: #2563eb;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-copy:hover {
            background: #1d4ed8;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 20px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 18px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 13px;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
        }
        .btn-primary { background: var(--accent-green); color: #022c22; }
        .btn-primary:hover { background: #059669; }
        .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .btn-danger:hover { background: rgba(239, 68, 68, 0.3); }
        .btn-outline { background: rgba(255, 255, 255, 0.05); color: #e2e8f0; border: 1px solid var(--card-border); }
        .btn-outline:hover { background: rgba(255, 255, 255, 0.1); }

        .log-viewer {
            background: #090d16;
            border: 1px solid #1e293b;
            border-radius: 10px;
            padding: 14px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #94a3b8;
            max-height: 240px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .step-list {
            margin-top: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .step-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 13px;
            color: #cbd5e1;
        }
        .step-num {
            background: #334155;
            color: white;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
            flex-shrink: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- CABECERA -->
        <div class="header">
            <div>
                <h1><i class="fab fa-whatsapp"></i> Gestor WhatsApp cPanel 24/7</h1>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Control de Servicio Persistente sin Consola ni Setup Node.js App</p>
            </div>
            <div>
                <?php if ($running): ?>
                    <span class="badge-status badge-online">
                        <span class="status-dot dot-green"></span>
                        ACTIVO (Puerto 3001)
                    </span>
                <?php else: ?>
                    <span class="badge-status badge-offline">
                        <span class="status-dot dot-red"></span>
                        APAGADO
                    </span>
                <?php endif; ?>
            </div>
        </div>

        <!-- DIAGNOSTICO DEL ENTORNO -->
        <div class="card">
            <h2><i class="fas fa-server"></i> Diagnóstico del Servidor cPanel</h2>
            <div class="grid-info">
                <div class="info-box">
                    <div class="label">Ruta Base del Proyecto</div>
                    <div class="value" style="font-size: 12px;"><?= htmlspecialchars($baseDir) ?></div>
                </div>
                <div class="info-box">
                    <div class="label">Binario Node.js Detectado</div>
                    <div class="value" style="color: <?= $nodeBin ? '#34d399' : '#f87171' ?>;">
                        <?= $nodeBin ? htmlspecialchars($nodeBin) . ' <i class="fas fa-check-circle"></i>' : 'No encontrado en rutas estándar' ?>
                    </div>
                </div>
                <div class="info-box">
                    <div class="label">Módulos (node_modules)</div>
                    <div class="value" style="color: <?= $hasModules ? '#34d399' : '#f59e0b' ?>;">
                        <?= $hasModules ? 'Instalados correctamente <i class="fas fa-check-circle"></i>' : 'Faltan (Subir whatsapp_dependencies.zip)' ?>
                    </div>
                </div>
                <div class="info-box">
                    <div class="label">Script Cron Runner</div>
                    <div class="value" style="color: <?= file_exists($shPath) ? '#34d399' : '#f87171' ?>;">
                        <?= file_exists($shPath) ? 'run_whatsapp.sh listo <i class="fas fa-check-circle"></i>' : 'Falta run_whatsapp.sh' ?>
                    </div>
                </div>
            </div>

            <div class="actions">
                <button onclick="controlService('start')" class="btn btn-primary">
                    <i class="fas fa-play"></i> Iniciar Servicio Ahora
                </button>
                <button onclick="controlService('stop')" class="btn btn-danger">
                    <i class="fas fa-stop"></i> Detener Servicio
                </button>
                <button onclick="location.reload()" class="btn btn-outline">
                    <i class="fas fa-sync-alt"></i> Actualizar Estado
                </button>
                <a href="../pau_whatsapp.html" target="_blank" class="btn btn-outline" style="margin-left: auto;">
                    <i class="fab fa-whatsapp"></i> Abrir WhatsApp Web
                </a>
            </div>
        </div>

        <!-- CONFIGURACION DE TAREAS CRON -->
        <div class="card" style="border-left: 4px solid var(--accent-blue);">
            <h2><i class="fas fa-clock" style="color: var(--accent-blue);"></i> Activación Automática 24/7 con "Tareas Cron" de cPanel</h2>
            <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 14px;">
                Para que WhatsApp se mantenga encendido siempre (incluso si el servidor se reinicia o duerme), configure este comando en su cPanel:
            </p>

            <div class="cron-box">
                <div class="cron-cmd" id="cronCmdText"><?= htmlspecialchars($cronCmd) ?></div>
                <button class="btn-copy" onclick="copyCron()"><i class="fas fa-copy"></i> Copiar</button>
            </div>

            <div class="step-list" style="margin-top: 16px;">
                <div class="step-item">
                    <span class="step-num">1</span>
                    <span>Entre a su <strong>cPanel</strong> y busque la herramienta <strong>"Tareas Cron"</strong> (o <em>Cron Jobs</em>).</span>
                </div>
                <div class="step-item">
                    <span class="step-num">2</span>
                    <span>En <strong>Configuración común</strong>, seleccione <strong>"Una vez por minuto (* * * * *)"</strong> o cada 5 minutos.</span>
                </div>
                <div class="step-item">
                    <span class="step-num">3</span>
                    <span>En la casilla <strong>Comando</strong>, pegue el comando copiado arriba y haga clic en <strong>"Añadir nueva tarea cron"</strong>.</span>
                </div>
            </div>
        </div>

        <!-- LOG EN VIVO -->
        <div class="card">
            <h2><i class="fas fa-terminal"></i> Registro de Actividad (Log en tiempo real)</h2>
            <div class="log-viewer" id="logViewer">Cargando registros...</div>
            <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                <button onclick="loadLogs()" class="btn btn-outline" style="font-size: 11px; padding: 4px 10px;">
                    <i class="fas fa-redo"></i> Refrescar Log
                </button>
            </div>
        </div>
    </div>

    <script>
        function copyCron() {
            const text = document.getElementById('cronCmdText').innerText;
            navigator.clipboard.writeText(text).then(() => {
                alert('¡Comando copiado al portapapeles! Ahora pégalo en Tareas Cron de cPanel.');
            });
        }

        async function controlService(action) {
            try {
                const res = await fetch(`wa_cpanel_manager.php?action=${action}`);
                const data = await res.json();
                alert(data.message || (data.success ? 'Operación exitosa' : 'Hubo un error'));
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                alert('Error al comunicar con el servidor: ' + err.message);
            }
        }

        async function loadLogs() {
            const viewer = document.getElementById('logViewer');
            try {
                const res = await fetch('wa_cpanel_manager.php?action=log');
                const data = await res.json();
                if (data.lines && data.lines.length > 0) {
                    viewer.innerText = data.lines.join('');
                    viewer.scrollTop = viewer.scrollHeight;
                } else {
                    viewer.innerText = 'No hay registros recientes aún en data/whatsapp_service.log.';
                }
            } catch (err) {
                viewer.innerText = 'Error al leer logs: ' + err.message;
            }
        }

        loadLogs();
        setInterval(loadLogs, 10000);
    </script>
</body>
</html>
