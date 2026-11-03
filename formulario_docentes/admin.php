<?php
/**
 * Panel de Administración — Control de Asistencia Docente
 * SISTEMA AISLADO — SEMESTRE 2026-2 (MySQL)
 */
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Manejo de autenticación simple
$errorAuth = '';
if (isset($_POST['admin_pass'])) {
    if ($_POST['admin_pass'] === ADMIN_PASSWORD) {
        $_SESSION['docentes_admin_auth'] = true;
    } else {
        $errorAuth = 'Contraseña incorrecta. Intente nuevamente.';
    }
}

if (isset($_GET['logout'])) {
    unset($_SESSION['docentes_admin_auth']);
    header('Location: admin.php');
    exit;
}

$isAuth = !empty($_SESSION['docentes_admin_auth']);

// Si no está autenticado, mostrar formulario de acceso
if (!$isAuth): ?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso al Panel — Docentes 2026-2</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="icon" type="image/png" href="img/logo-ucv.png">
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
    <h2>Control de Asistencia Docente</h2>
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

// Procesamiento de acciones (Eliminar / Editar)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $action = $_POST['action'];
    if ($action === 'eliminar') {
        $delId = (int)($_POST['id'] ?? 0);
        if ($delId > 0) {
            try {
                DB::deleteDocente($delId);
                $_SESSION['flash_msg'] = [
                    'type' => 'success',
                    'text' => "Registro #{$delId} eliminado correctamente junto con su archivo de firma."
                ];
            } catch (Exception $e) {
                $_SESSION['flash_msg'] = [
                    'type' => 'danger',
                    'text' => "Error al eliminar registro: " . $e->getMessage()
                ];
            }
        }
        header('Location: admin.php');
        exit;
    } elseif ($action === 'editar') {
        $editId = (int)($_POST['id'] ?? 0);
        if ($editId > 0) {
            $dataUpdate = [
                'apellidos_nombres'   => trim($_POST['apellidos_nombres'] ?? ''),
                'codigo_docente'      => trim($_POST['codigo_docente'] ?? ''),
                'dni'                 => trim($_POST['dni'] ?? ''),
                'correo'              => trim($_POST['correo'] ?? ''),
                'escuela_profesional' => trim($_POST['escuela_profesional'] ?? ''),
                'asignatura'          => trim($_POST['asignatura'] ?? ''),
                'seccion'             => trim($_POST['seccion'] ?? ''),
                'ciclo'               => trim($_POST['ciclo'] ?? ''),
                'observaciones'       => trim($_POST['observaciones'] ?? '')
            ];
            try {
                DB::updateDocente($editId, $dataUpdate);
                $_SESSION['flash_msg'] = [
                    'type' => 'success',
                    'text' => "Registro #{$editId} actualizado con éxito."
                ];
            } catch (Exception $e) {
                $_SESSION['flash_msg'] = [
                    'type' => 'danger',
                    'text' => "Error al actualizar registro: " . $e->getMessage()
                ];
            }
        }
        header('Location: admin.php');
        exit;
    }
}

$flashMsg = $_SESSION['flash_msg'] ?? null;
unset($_SESSION['flash_msg']);

$search = trim($_GET['q'] ?? '');
$escuelaFilter = trim($_GET['escuela'] ?? '');
$cicloFilter = trim($_GET['ciclo'] ?? '');

$docentes = DB::getAllDocentes($search, $escuelaFilter, $cicloFilter);
$total = count($docentes);

// Calcular estadísticas
$porEscuela = [];
$porCiclo = [];
$conFirma = 0;

foreach ($docentes as $d) {
    $esc = $d['escuela_profesional'] ?? 'Sin especificar';
    $porEscuela[$esc] = ($porEscuela[$esc] ?? 0) + 1;

    $c = $d['ciclo'] ?? 'Sin ciclo';
    $porCiclo[$c] = ($porCiclo[$c] ?? 0) + 1;

    if (!empty($d['firma_archivo'])) {
        $conFirma++;
    }
}
arsort($porEscuela);
ksort($porCiclo);
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel de Asistencia Docente — <?= htmlspecialchars(APP_TITLE) ?></title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="icon" type="image/png" href="img/logo-ucv.png">
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
      flex-wrap: wrap;
      gap: 0.5rem;
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
      padding: 0.75rem 0.75rem;
      white-space: nowrap;
    }
    .table tbody td {
      padding: 0.75rem 0.75rem;
      vertical-align: middle;
      font-size: 0.85rem;
      border-bottom: 1px solid #F3F4F6;
    }
    .firma-thumb {
      width: 80px;
      height: 35px;
      object-fit: contain;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      background: #FAFBFC;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .firma-thumb:hover {
      transform: scale(1.15);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .obs-cell {
      max-width: 170px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .obs-cell:hover {
      white-space: normal;
      overflow: visible;
    }
    .btn-action-sm {
      padding: 0.24rem 0.5rem;
      font-size: 0.82rem;
      border-radius: 6px;
    }
  </style>
</head>
<body>

  <!-- Barra Superior -->
  <header class="top-nav">
    <div class="d-flex align-items-center gap-3">
      <i class="bi bi-person-workspace fs-4 text-warning"></i>
      <div>
        <h1 class="h6 mb-0 fw-bold"><?= htmlspecialchars(APP_TITLE) ?></h1>
        <small style="opacity: 0.8; font-size: 0.76rem;"><?= htmlspecialchars(APP_FACULTAD) ?> • Base de Datos SQL (MySQL)</small>
      </div>
    </div>
    <div class="d-flex align-items-center gap-2 flex-wrap">
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

  <div class="container-fluid py-4 px-3 px-md-4" style="max-width: 1600px;">

    <!-- Mensaje Flash -->
    <?php if ($flashMsg): ?>
      <div class="alert alert-<?= $flashMsg['type'] === 'success' ? 'success' : 'danger' ?> alert-dismissible fade show d-flex align-items-center mb-3 shadow-sm border" role="alert">
        <i class="bi bi-<?= $flashMsg['type'] === 'success' ? 'check-circle-fill text-success' : 'exclamation-triangle-fill text-danger' ?> fs-5 me-2"></i>
        <div class="fw-semibold"><?= htmlspecialchars($flashMsg['text']) ?></div>
        <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert" aria-label="Cerrar"></button>
      </div>
    <?php endif; ?>

    <!-- Métricas -->
    <div class="row g-3 mb-4">
      <div class="col-md-3">
        <div class="kpi-card d-flex align-items-center justify-content-between">
          <div>
            <div class="text-muted small fw-semibold text-uppercase">Total Docentes</div>
            <div class="fs-2 fw-bold text-primary"><?= number_format($total) ?></div>
          </div>
          <div class="bg-primary-subtle text-primary p-3 rounded-circle fs-3">
            <i class="bi bi-people-fill"></i>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="kpi-card d-flex align-items-center justify-content-between">
          <div>
            <div class="text-muted small fw-semibold text-uppercase">Escuelas Activas</div>
            <div class="fs-2 fw-bold text-success"><?= count($porEscuela) ?></div>
          </div>
          <div class="bg-success-subtle text-success p-3 rounded-circle fs-3">
            <i class="bi bi-buildings-fill"></i>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="kpi-card d-flex align-items-center justify-content-between">
          <div>
            <div class="text-muted small fw-semibold text-uppercase">Con Firma Digital</div>
            <div class="fs-2 fw-bold text-warning"><?= number_format($conFirma) ?></div>
          </div>
          <div class="bg-warning-subtle text-warning p-3 rounded-circle fs-3">
            <i class="bi bi-pen-fill"></i>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="kpi-card d-flex align-items-center justify-content-between">
          <div>
            <div class="text-muted small fw-semibold text-uppercase">Motor de Base de Datos</div>
            <div class="fs-4 fw-bold text-dark">MySQL / SQL</div>
            <small class="text-success fw-semibold" style="font-size: 0.72rem;"><i class="bi bi-check-circle-fill me-1"></i>Tabla: docentes_asistencia</small>
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
          <div class="col-md-4">
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" name="q" value="<?= htmlspecialchars($search) ?>" class="form-control border-start-0" placeholder="Buscar por apellidos, código, DNI, asignatura, sección...">
            </div>
          </div>
          <div class="col-md-3">
            <select name="escuela" class="form-select">
              <option value="">-- Todas las Escuelas --</option>
              <option value="Ingeniería Industrial" <?= $escuelaFilter === 'Ingeniería Industrial' ? 'selected' : '' ?>>Ingeniería Industrial</option>
              <option value="Ingeniería de Sistemas" <?= $escuelaFilter === 'Ingeniería de Sistemas' ? 'selected' : '' ?>>Ingeniería de Sistemas</option>
            </select>
          </div>
          <div class="col-md-3">
            <select name="ciclo" class="form-select">
              <option value="">-- Todos los Ciclos --</option>
              <?php for ($i = 1; $i <= 10; $i++): 
                $rom = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][$i-1];
                $cVal = "Ciclo " . $rom;
              ?>
                <option value="<?= $cVal ?>" <?= $cicloFilter === $cVal ? 'selected' : '' ?>><?= $cVal ?></option>
              <?php endfor; ?>
            </select>
          </div>
          <div class="col-md-2 d-flex gap-2">
            <button type="submit" class="btn btn-primary w-100 fw-semibold">Filtrar</button>
            <?php if ($search || $escuelaFilter || $cicloFilter): ?>
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
              <th style="width: 45px;">#</th>
              <th>Apellidos y Nombres</th>
              <th>Cód. Docente</th>
              <th>DNI</th>
              <th>Correo</th>
              <th>Escuela Profesional</th>
              <th>Asignatura</th>
              <th>Sección</th>
              <th>Ciclo</th>
              <th>Observaciones</th>
              <th>Firma Digital</th>
              <th>Fecha y Hora</th>
              <th class="text-center" style="width: 110px;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <?php if (empty($docentes)): ?>
              <tr>
                <td colspan="13" class="text-center py-5 text-muted">
                  <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                  No se encontraron registros de docentes en la base de datos SQL.
                </td>
              </tr>
            <?php else: ?>
              <?php foreach ($docentes as $idx => $d): ?>
                <tr>
                  <td class="text-muted small"><?= $total - $idx ?></td>
                  <td class="fw-bold text-dark"><?= htmlspecialchars($d['apellidos_nombres'] ?? '') ?></td>
                  <td><span class="badge bg-secondary-subtle text-secondary fw-semibold"><?= htmlspecialchars($d['codigo_docente'] ?? '-') ?></span></td>
                  <td><span class="badge bg-light text-dark border"><?= htmlspecialchars($d['dni'] ?? '') ?></span></td>
                  <td class="text-muted small"><?= htmlspecialchars($d['correo'] ?? '-') ?></td>
                  <td><span class="badge bg-primary-subtle text-primary fw-semibold"><?= htmlspecialchars($d['escuela_profesional'] ?? '') ?></span></td>
                  <td><?= htmlspecialchars($d['asignatura'] ?? '') ?></td>
                  <td><span class="badge bg-warning-subtle text-dark border"><?= htmlspecialchars($d['seccion'] ?? '-') ?></span></td>
                  <td><span class="badge bg-info-subtle text-info fw-semibold"><?= htmlspecialchars($d['ciclo'] ?? '-') ?></span></td>
                  <td class="obs-cell text-muted small" title="<?= htmlspecialchars($d['observaciones'] ?? '') ?>"><?= htmlspecialchars($d['observaciones'] ?? '-') ?></td>
                  <td>
                    <?php if (!empty($d['firma_archivo'])): ?>
                      <img src="ver_firma.php?f=<?= urlencode($d['firma_archivo']) ?>" alt="Firma" class="firma-thumb" title="Clic para ampliar firma">
                    <?php else: ?>
                      <span class="text-muted small">—</span>
                    <?php endif; ?>
                  </td>
                  <td class="text-muted small" style="font-size: 0.78rem; white-space: nowrap;">
                    <i class="bi bi-clock me-1"></i><?= htmlspecialchars($d['fecha_registro'] ?? '') ?>
                  </td>
                  <td class="text-center" style="white-space: nowrap;">
                    <button type="button" class="btn btn-outline-primary btn-action-sm btn-editar"
                      data-id="<?= (int)$d['id'] ?>"
                      data-nombre="<?= htmlspecialchars($d['apellidos_nombres'] ?? '', ENT_QUOTES) ?>"
                      data-codigo="<?= htmlspecialchars($d['codigo_docente'] ?? '', ENT_QUOTES) ?>"
                      data-dni="<?= htmlspecialchars($d['dni'] ?? '', ENT_QUOTES) ?>"
                      data-correo="<?= htmlspecialchars($d['correo'] ?? '', ENT_QUOTES) ?>"
                      data-escuela="<?= htmlspecialchars($d['escuela_profesional'] ?? '', ENT_QUOTES) ?>"
                      data-asignatura="<?= htmlspecialchars($d['asignatura'] ?? '', ENT_QUOTES) ?>"
                      data-seccion="<?= htmlspecialchars($d['seccion'] ?? '', ENT_QUOTES) ?>"
                      data-ciclo="<?= htmlspecialchars($d['ciclo'] ?? '', ENT_QUOTES) ?>"
                      data-obs="<?= htmlspecialchars($d['observaciones'] ?? '', ENT_QUOTES) ?>"
                      title="Editar registro">
                      <i class="bi bi-pencil-square"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-action-sm btn-eliminar ms-1"
                      data-id="<?= (int)$d['id'] ?>"
                      data-nombre="<?= htmlspecialchars($d['apellidos_nombres'] ?? '', ENT_QUOTES) ?>"
                      title="Eliminar registro">
                      <i class="bi bi-trash3"></i>
                    </button>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal Editar Registro -->
  <div class="modal fade" id="editarModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content shadow border-0">
        <form method="POST" action="admin.php">
          <input type="hidden" name="action" value="editar">
          <input type="hidden" name="id" id="edit_id">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title fw-bold fs-6"><i class="bi bi-pencil-square me-2"></i>Editar Registro de Asistencia</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body p-4">
            <div class="row g-3">
              <div class="col-md-12">
                <label class="form-label fw-semibold small">Apellidos y Nombres *</label>
                <input type="text" name="apellidos_nombres" id="edit_nombre" class="form-control" required>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold small">Código Docente *</label>
                <input type="text" name="codigo_docente" id="edit_codigo" class="form-control" required>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold small">DNI *</label>
                <input type="text" name="dni" id="edit_dni" maxlength="15" class="form-control" required>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold small">Correo Electrónico</label>
                <input type="email" name="correo" id="edit_correo" class="form-control">
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold small">Escuela Profesional *</label>
                <select name="escuela_profesional" id="edit_escuela" class="form-select" required>
                  <option value="Ingeniería Industrial">Ingeniería Industrial</option>
                  <option value="Ingeniería de Sistemas">Ingeniería de Sistemas</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold small">Ciclo Académico *</label>
                <select name="ciclo" id="edit_ciclo" class="form-select" required>
                  <?php for ($i = 1; $i <= 10; $i++): 
                    $rom = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][$i-1];
                    $cVal = "Ciclo " . $rom;
                  ?>
                    <option value="<?= $cVal ?>"><?= $cVal ?></option>
                  <?php endfor; ?>
                </select>
              </div>
              <div class="col-md-8">
                <label class="form-label fw-semibold small">Asignatura / Curso *</label>
                <input type="text" name="asignatura" id="edit_asignatura" class="form-control" required>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-semibold small">Sección / Aula *</label>
                <input type="text" name="seccion" id="edit_seccion" class="form-control" required>
              </div>
              <div class="col-12">
                <label class="form-label fw-semibold small">Observaciones</label>
                <textarea name="observaciones" id="edit_obs" rows="2" class="form-control"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer bg-light border-top py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm fw-semibold"><i class="bi bi-save me-1"></i>Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Modal Confirmar Eliminación -->
  <div class="modal fade" id="eliminarModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" style="max-width: 440px;">
      <div class="modal-content shadow border-0">
        <form method="POST" action="admin.php">
          <input type="hidden" name="action" value="eliminar">
          <input type="hidden" name="id" id="delete_id">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title fw-bold fs-6"><i class="bi bi-exclamation-triangle-fill me-2"></i>Confirmar Eliminación</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body p-4 text-center">
            <i class="bi bi-trash3-fill text-danger fs-1 mb-2 d-block"></i>
            <p class="mb-1 text-dark fw-semibold" id="delete_text">¿Deseas eliminar este registro?</p>
            <p class="text-muted small mb-0">Esta acción es irreversible y eliminará también el archivo de la firma digital del servidor.</p>
          </div>
          <div class="modal-footer bg-light border-top py-2 justify-content-center">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-danger btn-sm fw-semibold"><i class="bi bi-trash3 me-1"></i>Sí, Eliminar</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Modal Visor de Firma Ampliada -->
  <div class="modal fade" id="firmaModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content shadow">
        <div class="modal-header border-bottom">
          <h5 class="modal-title fw-bold fs-6" id="firmaModalTitle">Firma Digital del Docente</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body text-center p-4" style="background: #F8FAFC;">
          <img id="firmaModalImg" src="" alt="Firma" class="img-fluid border rounded bg-white p-3 shadow-sm" style="max-height: 220px; object-fit: contain;">
          <p class="text-muted small mt-3 mb-0" id="firmaModalSub"></p>
        </div>
        <div class="modal-footer border-top py-2">
          <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cerrar</button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Visor de Firma
    document.querySelectorAll('.firma-thumb').forEach(img => {
      img.addEventListener('click', () => {
        const src = img.getAttribute('src');
        const row = img.closest('tr');
        const nombre = row ? row.querySelector('td:nth-child(2)').textContent.trim() : 'Docente';
        const codigo = row ? row.querySelector('td:nth-child(3)').textContent.trim() : '';
        const dni    = row ? row.querySelector('td:nth-child(4)').textContent.trim() : '';
        document.getElementById('firmaModalImg').src = src;
        document.getElementById('firmaModalTitle').textContent = 'Firma: ' + nombre;
        document.getElementById('firmaModalSub').textContent = 'Cód: ' + codigo + ' | DNI: ' + dni;
        const modal = new bootstrap.Modal(document.getElementById('firmaModal'));
        modal.show();
      });
    });

    // Modal Editar
    const editModalInstance = new bootstrap.Modal(document.getElementById('editarModal'));
    document.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('edit_id').value         = btn.dataset.id;
        document.getElementById('edit_nombre').value     = btn.dataset.nombre || '';
        document.getElementById('edit_codigo').value     = btn.dataset.codigo || '';
        document.getElementById('edit_dni').value        = btn.dataset.dni || '';
        document.getElementById('edit_correo').value     = btn.dataset.correo || '';
        document.getElementById('edit_escuela').value    = btn.dataset.escuela || 'Ingeniería Industrial';
        document.getElementById('edit_ciclo').value      = btn.dataset.ciclo || 'Ciclo I';
        document.getElementById('edit_asignatura').value = btn.dataset.asignatura || '';
        document.getElementById('edit_seccion').value    = btn.dataset.seccion || '';
        document.getElementById('edit_obs').value        = btn.dataset.obs || '';
        editModalInstance.show();
      });
    });

    // Modal Eliminar
    const deleteModalInstance = new bootstrap.Modal(document.getElementById('eliminarModal'));
    document.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('delete_id').value = btn.dataset.id;
        document.getElementById('delete_text').textContent = '¿Eliminar registro de ' + (btn.dataset.nombre || 'este docente') + ' (#ID: ' + btn.dataset.id + ')?';
        deleteModalInstance.show();
      });
    });
  </script>
</body>
</html>
