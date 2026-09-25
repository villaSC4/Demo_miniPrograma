<?php
$dataDir = __DIR__ . "/data";
if (!is_dir($dataDir)) mkdir($dataDir, 0777, true);

$dbFile = $dataDir . "/delegados.db";
$pdo = new PDO("sqlite:" . $dbFile);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("CREATE TABLE IF NOT EXISTS delegados_asistencia (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    apellidos_nombres    TEXT NOT NULL,
    codigo_alumno        TEXT NOT NULL,
    correo               TEXT DEFAULT \"\",
    escuela_profesional  TEXT NOT NULL,
    asignatura           TEXT NOT NULL,
    seccion              TEXT DEFAULT \"\",
    ciclo                TEXT NOT NULL,
    declaracion_aceptada INTEGER NOT NULL DEFAULT 1,
    ip_registro          TEXT DEFAULT \"\",
    user_agent           TEXT DEFAULT \"\",
    fecha_registro       TEXT NOT NULL DEFAULT (datetime(\"now\",\"-5 hours\"))
)");

echo "SQLite OK: " . realpath($dbFile) . PHP_EOL;
$r = $pdo->query("SELECT COUNT(*) as t FROM delegados_asistencia")->fetch(PDO::FETCH_ASSOC);
echo "Registros: " . $r["t"] . PHP_EOL;
echo "Todo listo. El formulario ya puede guardar datos en local." . PHP_EOL;

