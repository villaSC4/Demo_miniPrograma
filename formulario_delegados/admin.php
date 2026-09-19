<?php
/**
 * Panel de Administración y Visualización de Delegados Registrados
 * 1RA REUNIÓN DE DELEGADOS 2026-2
 */
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Manejo de autenticación simple
$errorAuth = '';
if (isset($_POST['admin_pass'])) {
    if ($_POST['admin_pass'] === ADMIN_PASSWORD) {
        $_SESSION['delegados_admin_auth'] = true;
    } else {
        $errorAuth = 'Contraseña incorrecta. Intente nuevamente.';
    }
}

if (isset($_GET['logout'])) {
    unset($_SESSION['delegados_admin_auth']);
    header('Location: admin.php');
    exit;
}

$isAuth = !empty($_SESSION['delegados_admin_auth']);

// Si no está autenticado, mostrar formulario de acceso
if (!$isAuth): ?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso al Panel — Delegados 2026-2</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #F4F6F9;
      color: #1E293B;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
    }
    .login-box {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 2.25rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 4px 20px rgba(0, 40, 85, 0.08);
      text-align: center;
    }
    .login-box img {
      height: 40px;
      width: auto;
      margin-bottom: 1.25rem;
    }
    .login-box h2 {
      font-size: 1.35rem;
      font-weight: 800;
      margin-bottom: 0.35rem;
      color: #002855;
    }
    .login-box p {
      font-size: 0.85rem;
      color: #64748B;
      margin-bottom: 1.5rem;
    }
    .login-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.75rem 1rem;
      background: #FFFFFF;
      border: 1.5px solid #CBD5E1;
      border-radius: 8px;
      color: #1E293B;
      font-size: 0.95rem;
      margin-bottom: 1rem;
      outline: none;
    }
    .login-input:focus {
      border-color: #002855;
      box-shadow: 0 0 0 3px rgba(0, 40, 85, 0.12);
    }
    .login-btn {
      width: 100%;
      padding: 0.8rem;
      background: #C8102E;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .login-btn:hover {
      background: #A60D25;
    }
    .error-msg {
      color: #DC2626;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 0.82rem;
      margin-bottom: 1rem;
    }
    .back-link {
      display: inline-block;
      margin-top: 1.25rem;
      color: #64748B;
      font-size: 0.82rem;
      text-decoration: none;
    }
    .back-link:hover {
      color: #002855;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="login-box">
    <img src="img/logo-ucv.png" alt="Universidad César Vallejo">
    <h2>Control de Asistencia</h2>
    <p>Acceso restringido para Dirección de Escuela y Coordinación Académica.</p>

    <?php if ($errorAuth): ?>
      <div class="error-msg"><?= htmlspecialchars($errorAuth) ?></div>
    <?php endif; ?>

    <form method="POST">
      <input type="password" name="admin_pass" class="login-input" placeholder="Contraseña institucional" required autofocus>
      <button type="submit" class="login-btn">Ingresar al Panel</button>
    </form>

    <a href="index.html" class="back-link"><i class="bi bi-arrow-left me-1"></i>Volver al formulario</a>
  </div>
</body>
</html>
<?php exit; endif;

// ============================================================================
// PANEL DE ADMINISTRACIÓN AUTENTICADO
// ============================================================================
$search = trim($_GET['q'] ?? '');
$escuelaFilter = trim($_GET['escuela'] ?? '');

$delegados = DB::getAllDelegados($search, $escuelaFilter);
$total = count($delegados);

// Calcular estadísticas por escuela
$porEscuela = [];
foreach ($delegados as $d) {
    $esc = $d['escuela_profesional'] ?? 'Sin especificar';
    $porEscuela[$esc] = ($porEscuela[$esc] ?? 0) + 1;
}
arsort($porEscuela);
$engine = DB::getEngine();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asistencia — 1RA REUNIÓN DE DELEGADOS 2026-2</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <style>
    body {
      background-color: #F3F4F6;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #1F2937;
    }
    .top-nav {
      background: #002855;
      color: #fff;
      border-bottom: 3px solid #C8102E;
      padding: 0.9rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    }
    .kpi-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      border: 1px solid #E5E7EB;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .table-container {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #E5E7EB;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      overflow: hidden;
    }
    .table thead th {
      background: #F9FAFB;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #6B7280;
      border-bottom: 2px solid #E5E7EB;
      padding: 0.75rem 1rem;
    }
    .table tbody td {
      padding: 0.85rem 1rem;
      vertical-align: middle;
      font-size: 0.88rem;
      border-bottom: 1px solid #F3F4F6;
    }
  </style>
</head>
<body>

  <!-- Barra Superior -->
  <header class="top-nav">
    <div class="d-flex align-items-center gap-3">
      <i class="bi bi-person-video3 fs-4 text-warning"></i>
      <div>
        <h1 class="h6 mb-0 fw-bold">1RA REUNIÓN DE DELEGADOS 2026-2</h1>
        <small style="opacity: 0.8; font-size: 0.76rem;">Facultad de Ingeniería y Arquitectura — Control de Asistencia</small>
      </div>
    </div>
    <div class="d-flex align-items-center gap-2">
      <a href="exportar.php" class="btn btn-success btn-sm fw-semibold">
        <i class="bi bi-file-earmark-excel-fill me-1"></i> Exportar a Excel
      </a>
      <a href="index.html" target="_blank" class="btn btn-light btn-sm fw-semibold">
        <i class="bi bi-box-arrow-up-right me-1"></i> Ver Formulario
      </a>
      <a href="admin.php?logout=1" class="btn btn-outline-light btn-sm" title="Cerrar sesión">
        <i class="bi bi-box-arrow-right"></i>
      </a>
    </div>
  </header>

  <div class="container-fluid py-4 px-3 px-md-4" style="max-width: 1400px;">

    <!-- Métricas -->
    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="kpi-card d-flex align-items-center justify-content-between">
          <div>
            <div class="text-muted small fw-semibold text-uppercase">Total Delegados Registrados</div>
            <div class="fs-2 fw-bold text-primary"><?= number_format($total) ?></div>
          </div>
          <div class="bg-primary-subtle text-primary p-3 rounded-circle fs-3">
            <i class="bi bi-people-fill"></i>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="kpi-card d-flex align-items-center justify-content-between">
          <div>
            <div class="text-muted small fw-semibold text-uppercase">Escuelas Representadas</div>
            <div class="fs-2 fw-bold text-success"><?= count($porEscuela) ?></div>
          </div>
          <div class="bg-success-subtle text-success p-3 rounded-circle fs-3">
            <i class="bi bi-buildings-fill"></i>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="kpi-card d-flex align-items-center justify-content-between">
          <div>
            <div class="text-muted small fw-semibold text-uppercase">Motor de Base de Datos</div>
            <div class="fs-4 fw-bold text-dark text-uppercase"><?= htmlspecialchars($engine) ?></div>
            <small class="text-muted" style="font-size: 0.72rem;">Persistencia activa</small>
          </div>
          <div class="bg-info-subtle text-info p-3 rounded-circle fs-3">
            <i class="bi bi-database-fill-check"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtros de búsqueda -->
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body p-3">
        <form method="GET" class="row g-2 align-items-center">
          <div class="col-md-6">
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" name="q" value="<?= htmlspecialchars($search) ?>" class="form-control border-start-0" placeholder="Buscar por apellidos, nombres, código o asignatura...">
            </div>
          </div>
          <div class="col-md-4">
            <select name="escuela" class="form-select">
              <option value="">-- Todas las Escuelas --</option>
              <option value="Ingeniería Industrial" <?= $escuelaFilter === 'Ingeniería Industrial' ? 'selected' : '' ?>>Ingeniería Industrial</option>
              <option value="Ingeniería de Sistemas" <?= $escuelaFilter === 'Ingeniería de Sistemas' ? 'selected' : '' ?>>Ingeniería de Sistemas</option>
            </select>
          </div>
          <div class="col-md-2 d-flex gap-2">
            <button type="submit" class="btn btn-primary w-100 fw-semibold">Filtrar</button>
            <?php if ($search || $escuelaFilter): ?>
              <a href="admin.php" class="btn btn-outline-secondary" title="Limpiar"><i class="bi bi-x-lg"></i></a>
            <?php endif; ?>
          </div>
        </form>
      </div>
    </div>

    <!-- Tabla de Registros -->
    <div class="table-container">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Apellidos y Nombres</th>
              <th>Código</th>
              <th>Correo</th>
              <th>Escuela Profesional</th>
              <th>Asignatura</th>
              <th>Sección</th>
              <th>Ciclo</th>
              <th>Fecha y Hora</th>
            </tr>
          </thead>
          <tbody>
            <?php if (empty($delegados)): ?>
              <tr>
                <td colspan="9" class="text-center py-5 text-muted">
                  <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                  No se encontraron registros de delegados.
                </td>
              </tr>
            <?php else: ?>
              <?php foreach ($delegados as $idx => $d): ?>
                <tr>
                  <td class="text-muted small"><?= $total - $idx ?></td>
                  <td class="fw-bold text-dark"><?= htmlspecialchars($d['apellidos_nombres'] ?? '') ?></td>
                  <td><span class="badge bg-light text-dark border"><?= htmlspecialchars($d['codigo_alumno'] ?? '') ?></span></td>
                  <td class="text-muted small"><?= htmlspecialchars($d['correo'] ?? '-') ?></td>
                  <td><span class="badge bg-primary-subtle text-primary fw-semibold"><?= htmlspecialchars($d['escuela_profesional'] ?? '') ?></span></td>
                  <td><?= htmlspecialchars($d['asignatura'] ?? '') ?></td>
                  <td><?= htmlspecialchars($d['seccion'] ?? '-') ?></td>
                  <td><span class="badge bg-secondary-subtle text-secondary fw-semibold"><?= htmlspecialchars($d['ciclo'] ?? '') ?></span></td>
                  <td class="text-muted small" style="font-size: 0.78rem;">
                    <i class="bi bi-clock me-1"></i><?= htmlspecialchars($d['fecha_registro'] ?? '') ?>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>

  </div>

</body>
</html>
