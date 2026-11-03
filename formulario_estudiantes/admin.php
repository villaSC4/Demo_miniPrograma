<?php
/**
 * Panel de Administración — Gestión de Atención al Estudiante
 * SISTEMA AISLADO — SEMESTRE 2026-2 (MySQL)
 */
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Manejo de autenticación
$errorAuth = '';
if (isset($_POST['admin_pass'])) {
    if ($_POST['admin_pass'] === ADMIN_PASSWORD) {
        $_SESSION['estudiantes_admin_auth'] = true;
    } else {
        $errorAuth = 'Contraseña incorrecta. Intente nuevamente.';
    }
}

if (isset($_GET['logout'])) {
    unset($_SESSION['estudiantes_admin_auth']);
    header('Location: admin.php');
    exit;
}

$isAuth = !empty($_SESSION['estudiantes_admin_auth']);

if (!$isAuth): ?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso al Panel — Atenciones Estudiantiles 2026-2</title>
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
      border-radius: 16px;
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 40, 85, 0.1);
      text-align: center;
    }
    .login-box img {
      height: 42px;
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
      font-size: 0.86rem;
      color: #64748B;
      margin-bottom: 1.5rem;
    }
    .login-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.8rem 1rem;
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
      padding: 0.85rem;
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
      padding: 0.6rem;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    .back-link {
      display: inline-block;
      margin-top: 1.25rem;
      color: #64748B;
      font-size: 0.85rem;
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
    <h2>Atención al Estudiante</h2>
    <p>Acceso restringido para Coordinación Académica — Facultad de Ingeniería y Arquitectura.</p>

    <?php if ($errorAuth): ?>
      <div class="error-msg"><?= htmlspecialchars($errorAuth) ?></div>
    <?php endif; ?>

    <form method="POST">
      <input type="password" name="admin_pass" class="login-input" placeholder="Contraseña de Coordinación" required autofocus>
      <button type="submit" class="login-btn">Ingresar al Panel</button>
    </form>

    <a href="index.html" class="back-link"><i class="bi bi-arrow-left me-1"></i>Volver al formulario de alumnos</a>
  </div>
</body>
</html>
<?php exit; endif;

// Procesamiento de acciones (Cambio de estado / Eliminar)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $action = $_POST['action'];
    if ($action === 'cambiar_estado') {
        $id = (int)($_POST['id'] ?? 0);
        $nuevoEstado = trim($_POST['estado'] ?? 'Pendiente');
        $obs = trim($_POST['observaciones_coordinacion'] ?? '');
        $linkZoom = isset($_POST['link_zoom']) ? trim($_POST['link_zoom']) : null;
        if ($id > 0) {
            DB::updateEstado($id, $nuevoEstado, $obs, $linkZoom);
            $_SESSION['flash_msg'] = ['type' => 'success', 'text' => "Ticket actualizado a estado '{$nuevoEstado}'."];
        }
        header('Location: admin.php');
        exit;
    } elseif ($action === 'eliminar') {
        $delId = (int)($_POST['id'] ?? 0);
        if ($delId > 0) {
            DB::deleteReserva($delId);
            $_SESSION['flash_msg'] = ['type' => 'success', 'text' => "Ticket #{$delId} eliminado correctamente."];
        }
        header('Location: admin.php');
        exit;
    }
}

$flashMsg = $_SESSION['flash_msg'] ?? null;
unset($_SESSION['flash_msg']);

$search  = trim($_GET['q'] ?? '');
$carrera = trim($_GET['carrera'] ?? '');
$tipo    = trim($_GET['tipo'] ?? '');
$dia     = trim($_GET['dia'] ?? '');
$estado  = trim($_GET['estado'] ?? '');

$reservas = DB::getAllReservas($search, $carrera, $tipo, $dia, $estado);
$total = count($reservas);

// Estadísticas
$totReclamos = 0;
$totSolicitudes = 0;
$totPendientes = 0;
$totAtendidos = 0;

foreach ($reservas as $r) {
    if (($r['tipo_atencion'] ?? '') === 'Reclamo') $totReclamos++;
    if (($r['tipo_atencion'] ?? '') === 'Solicitud') $totSolicitudes++;
    if (($r['estado'] ?? '') === 'Pendiente') $totPendientes++;
    if (($r['estado'] ?? '') === 'Atendido') $totAtendidos++;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel de Atención al Estudiante — <?= htmlspecialchars(APP_TITLE) ?></title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="icon" type="image/png" href="img/logo-ucv.png">
  <style>
    body { background-color: #F8FAFC; font-family: 'Plus Jakarta Sans', sans-serif; color: #1E293B; }
    .top-nav { background: #002855; color: #fff; border-bottom: 3px solid #C8102E; padding: 0.9rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
    .top-nav img { height: 36px; }
    .stat-card { background: #fff; border-radius: 12px; border: 1px solid #E2E8F0; padding: 1.25rem; box-shadow: 0 2px 6px rgba(0,0,0,0.03); display: flex; align-items: center; gap: 1rem; }
    .stat-icon { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }
    .table-card { background: #fff; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.04); overflow: hidden; }
    .badge-ticket { background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; font-weight: 700; font-size: 0.8rem; padding: 0.35rem 0.6rem; border-radius: 6px; }
    .badge-reclamo { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
    .badge-solicitud { background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; }
  </style>
</head>
<body>

  <header class="top-nav">
    <div class="d-flex align-items-center gap-3">
      <img src="img/logo-ucv.png" alt="UCV Logo">
      <div>
        <h5 class="mb-0 fw-bold">Panel de Reservas de Atención Estudiantil</h5>
        <small class="text-white-50">Facultad de Ingeniería y Arquitectura • Semestre 2026-2</small>
      </div>
    </div>
    <div class="d-flex align-items-center gap-2">
      <a href="index.html" class="btn btn-sm btn-outline-light"><i class="bi bi-box-arrow-up-right me-1"></i>Ver Formulario</a>
      <a href="exportar.php" class="btn btn-sm btn-success"><i class="bi bi-file-earmark-excel me-1"></i>Exportar Excel</a>
      <a href="?logout=1" class="btn btn-sm btn-danger"><i class="bi bi-box-arrow-right me-1"></i>Cerrar Sesión</a>
    </div>
  </header>

  <div class="container-fluid px-4 py-4">

    <?php if ($flashMsg): ?>
      <div class="alert alert-<?= $flashMsg['type'] ?> alert-dismissible fade show" role="alert">
        <?= htmlspecialchars($flashMsg['text']) ?>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    <?php endif; ?>

    <!-- Métricas -->
    <div class="row g-3 mb-4">
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon bg-primary bg-opacity-10 text-primary"><i class="bi bi-ticket-perforated"></i></div>
          <div>
            <div class="text-muted small">Total Registros</div>
            <div class="fs-4 fw-bold"><?= $total ?></div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon bg-danger bg-opacity-10 text-danger"><i class="bi bi-exclamation-octagon"></i></div>
          <div>
            <div class="text-muted small">Reclamos</div>
            <div class="fs-4 fw-bold text-danger"><?= $totReclamos ?></div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon bg-success bg-opacity-10 text-success"><i class="bi bi-file-earmark-text"></i></div>
          <div>
            <div class="text-muted small">Solicitudes</div>
            <div class="fs-4 fw-bold text-success"><?= $totSolicitudes ?></div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon bg-warning bg-opacity-10 text-warning"><i class="bi bi-clock-history"></i></div>
          <div>
            <div class="text-muted small">Pendientes de Atención</div>
            <div class="fs-4 fw-bold text-warning"><?= $totPendientes ?></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Barra de Búsqueda y Filtros -->
    <div class="card mb-4 border-0 shadow-sm">
      <div class="card-body">
        <form method="GET" class="row g-2 align-items-center">
          <div class="col-md-3">
            <input type="text" name="q" class="form-control" placeholder="Buscar por ticket, alumno, DNI o correo..." value="<?= htmlspecialchars($search) ?>">
          </div>
          <div class="col-md-2">
            <select name="carrera" class="form-select">
              <option value="">Todas las Carreras</option>
              <option value="Ingeniería de Sistemas" <?= $carrera === 'Ingeniería de Sistemas' ? 'selected' : '' ?>>Ingeniería de Sistemas</option>
              <option value="Ingeniería Industrial" <?= $carrera === 'Ingeniería Industrial' ? 'selected' : '' ?>>Ingeniería Industrial</option>
            </select>
          </div>
          <div class="col-md-2">
            <select name="tipo" class="form-select">
              <option value="">Todos los Tipos</option>
              <option value="Reclamo" <?= $tipo === 'Reclamo' ? 'selected' : '' ?>>Reclamos</option>
              <option value="Solicitud" <?= $tipo === 'Solicitud' ? 'selected' : '' ?>>Solicitudes</option>
            </select>
          </div>
          <div class="col-md-2">
            <select name="dia" class="form-select">
              <option value="">Todos los Días</option>
              <option value="Lunes" <?= $dia === 'Lunes' ? 'selected' : '' ?>>Lunes (Sistemas)</option>
              <option value="Viernes" <?= $dia === 'Viernes' ? 'selected' : '' ?>>Viernes (Industrial)</option>
            </select>
          </div>
          <div class="col-md-2">
            <select name="estado" class="form-select">
              <option value="">Todos los Estados</option>
              <option value="Pendiente" <?= $estado === 'Pendiente' ? 'selected' : '' ?>>Pendiente</option>
              <option value="En Atención" <?= $estado === 'En Atención' ? 'selected' : '' ?>>En Atención</option>
              <option value="Atendido" <?= $estado === 'Atendido' ? 'selected' : '' ?>>Atendido</option>
              <option value="Cancelado" <?= $estado === 'Cancelado' ? 'selected' : '' ?>>Cancelado</option>
            </select>
          </div>
          <div class="col-md-1 d-flex gap-1">
            <button type="submit" class="btn btn-primary w-100" title="Filtrar"><i class="bi bi-filter"></i></button>
            <a href="admin.php" class="btn btn-outline-secondary" title="Limpiar"><i class="bi bi-x-lg"></i></a>
          </div>
        </form>
      </div>
    </div>

    <!-- Tabla de Reservas -->
    <div class="table-card">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Ticket</th>
              <th>Estudiante / Código</th>
              <th>Carrera</th>
              <th>Tipo</th>
              <th>Día y Horario</th>
              <th>Motivo</th>
              <th>Sala Virtual</th>
              <th>Estado</th>
              <th>Fecha Registro</th>
              <th class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <?php if (empty($reservas)): ?>
              <tr>
                <td colspan="10" class="text-center py-4 text-muted">
                  <i class="bi bi-inbox fs-2 d-block mb-1"></i>
                  No se encontraron reservas de atención registradas con los filtros aplicados.
                </td>
              </tr>
            <?php else: ?>
              <?php foreach ($reservas as $r): ?>
                <tr>
                  <td><span class="badge-ticket"><?= htmlspecialchars($r['codigo_ticket']) ?></span></td>
                  <td>
                    <div class="fw-bold"><?= htmlspecialchars($r['nombres_completos']) ?></div>
                    <small class="text-muted"><i class="bi bi-person-badge me-1"></i><?= htmlspecialchars($r['codigo_alumno']) ?> • <?= htmlspecialchars($r['correo_institucional']) ?></small>
                  </td>
                  <td><span class="badge bg-light text-dark border"><?= htmlspecialchars($r['carrera_profesional']) ?></span></td>
                  <td>
                    <?php if ($r['tipo_atencion'] === 'Reclamo'): ?>
                      <span class="badge badge-reclamo"><i class="bi bi-exclamation-triangle me-1"></i>Reclamo</span>
                    <?php else: ?>
                      <span class="badge badge-solicitud"><i class="bi bi-chat-left-dots me-1"></i>Solicitud</span>
                    <?php endif; ?>
                  </td>
                  <td>
                    <div class="fw-semibold text-primary"><i class="bi bi-calendar-event me-1"></i><?= htmlspecialchars($r['dia_atencion']) ?></div>
                    <small class="text-muted"><i class="bi bi-clock me-1"></i><?= htmlspecialchars($r['horario_atencion']) ?></small>
                  </td>
                  <td>
                    <small class="text-truncate d-inline-block" style="max-width: 180px;" title="<?= htmlspecialchars($r['detalle_motivo']) ?>">
                      <?= htmlspecialchars($r['detalle_motivo'] ?: 'Sin detalle especificado') ?>
                    </small>
                  </td>
                  <td>
                    <?php if (!empty($r['link_zoom'])): ?>
                      <a href="<?= htmlspecialchars($r['link_zoom']) ?>" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size:0.75rem;">
                        <i class="bi bi-camera-video-fill me-1"></i>Entrar
                      </a>
                    <?php else: ?>
                      <span class="badge bg-light text-secondary border" style="font-size:0.72rem;">Sin Sala</span>
                    <?php endif; ?>
                  </td>
                  <td>
                    <?php
                      $badgeClass = 'bg-secondary';
                      if ($r['estado'] === 'Pendiente') $badgeClass = 'bg-warning text-dark';
                      if ($r['estado'] === 'En Atención') $badgeClass = 'bg-info text-dark';
                      if ($r['estado'] === 'Atendido') $badgeClass = 'bg-success';
                      if ($r['estado'] === 'Cancelado') $badgeClass = 'bg-danger';
                    ?>
                    <span class="badge <?= $badgeClass ?>"><?= htmlspecialchars($r['estado']) ?></span>
                  </td>
                  <td><small class="text-muted"><?= date('d/m/Y H:i', strtotime($r['fecha_registro'])) ?></small></td>
                  <td class="text-end">
                    <button type="button" class="btn btn-sm btn-outline-primary" 
                      data-bs-toggle="modal" 
                      data-bs-target="#modalEstado<?= $r['id'] ?>" 
                      title="Gestionar estado">
                      <i class="bi bi-pencil-square"></i>
                    </button>
                    <form method="POST" class="d-inline" onsubmit="return confirm('¿Está seguro de eliminar este ticket?');">
                      <input type="hidden" name="action" value="eliminar">
                      <input type="hidden" name="id" value="<?= $r['id'] ?>">
                      <button type="submit" class="btn btn-sm btn-outline-danger" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </form>
                  </td>
                </tr>

                <!-- Modal Actualizar Estado -->
                <div class="modal fade" id="modalEstado<?= $r['id'] ?>" tabindex="-1" aria-hidden="true">
                  <div class="modal-dialog">
                    <div class="modal-content">
                      <form method="POST">
                        <div class="modal-header">
                          <h5 class="modal-title">Gestionar Ticket <?= htmlspecialchars($r['codigo_ticket']) ?></h5>
                          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-start">
                          <input type="hidden" name="action" value="cambiar_estado">
                          <input type="hidden" name="id" value="<?= $r['id'] ?>">
                          
                          <div class="mb-3">
                            <label class="form-label fw-bold">Estudiante:</label>
                            <div class="text-muted"><?= htmlspecialchars($r['nombres_completos']) ?> (<?= htmlspecialchars($r['codigo_alumno']) ?>)</div>
                          </div>

                          <div class="mb-3">
                            <label class="form-label fw-bold">Tipo y Motivo:</label>
                            <div class="p-2 bg-light rounded small"><?= nl2br(htmlspecialchars($r['detalle_motivo'] ?: 'Sin detalle registrado.')) ?></div>
                          </div>

                          <div class="mb-3">
                            <label class="form-label fw-bold">Estado del Ticket:</label>
                            <select name="estado" class="form-select" required>
                              <option value="Pendiente" <?= $r['estado'] === 'Pendiente' ? 'selected' : '' ?>>Pendiente</option>
                              <option value="En Atención" <?= $r['estado'] === 'En Atención' ? 'selected' : '' ?>>En Atención</option>
                              <option value="Atendido" <?= $r['estado'] === 'Atendido' ? 'selected' : '' ?>>Atendido</option>
                              <option value="Cancelado" <?= $r['estado'] === 'Cancelado' ? 'selected' : '' ?>>Cancelado</option>
                            </select>
                          </div>

                          <div class="mb-3">
                            <label class="form-label fw-bold">Sala Virtual (Zoom / Meet):</label>
                            <input type="url" name="link_zoom" class="form-control" placeholder="https://ucv-edu-pe.zoom.us/j/..." value="<?= htmlspecialchars($r['link_zoom'] ?? '') ?>">
                            <div class="form-text small">Enlace que se compartirá con el estudiante para atender el llamado.</div>
                          </div>

                          <div class="mb-3">
                            <label class="form-label fw-bold">Notas de Coordinación / Resolución:</label>
                            <textarea name="observaciones_coordinacion" class="form-control" rows="3" placeholder="Indique observaciones o respuesta brindada al estudiante..."><?= htmlspecialchars($r['observaciones_coordinacion'] ?? '') ?></textarea>
                          </div>
                        </div>
                        <div class="modal-footer">
                          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                          <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>

              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>

  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
