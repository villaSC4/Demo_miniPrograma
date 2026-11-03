/**
 * ==============================================================================
 * RENDIMIENTO_INDUSTRIAL.JS - Controlador de Rendimiento Académico (Trilce)
 * Escuela Profesional de Ingeniería Industrial — UCV Virtual
 * ==============================================================================
 * Gestiona los 3 dashboards solicitados:
 * 1. Dashboard Principal (Hoja "Dashboard")
 * 2. Base de Datos Granular (Hoja "Hoja1" - Formato UCV-VA-017)
 * 3. Dashboards y Cálculos Analíticos (Hoja "Calculos")
 * Y el motor estándar de subida y procesamiento de reportes Excel de Trilce.
 * ==============================================================================
 */

// Estado global de los datos de rendimiento
let rendimientoData = {
  escuela: 'INGENIERÍA INDUSTRIAL',
  semestre: '2026-II',
  formato: 'UCV-VA-017',
  kpis: {},
  dashboard_cursos: [],
  base_datos: [],
  calculos: {
    por_ciclo: [],
    por_rango_nota: [],
    por_seccion_docente: []
  }
};

let currentTab = 'tab-dashboard';

// Instancias de Chart.js
let chartCiclosInstance = null;
let chartNotasInstance = null;
let chartAprobacionInstance = null;
let chartInhabInstance = null;

// ==============================================================================
// 1. INICIALIZACIÓN AL CARGAR EL DOM
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadRendimientoData();
});

function setupEventListeners() {
  // Input de subida de archivo Trilce
  const fileInput = document.getElementById('trilceFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', handleExcelUpload);
  }

  // Zona Drag and Drop
  const dropZone = document.getElementById('dropZoneTrilce');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        processExcelFile(files[0]);
      }
    });
  }

  // Filtros de la Base de Datos
  document.getElementById('filterBdSearch')?.addEventListener('input', renderBaseDatosTable);
  document.getElementById('filterBdCiclo')?.addEventListener('change', renderBaseDatosTable);
  document.getElementById('filterBdDocente')?.addEventListener('change', renderBaseDatosTable);
  document.getElementById('filterBdEstado')?.addEventListener('change', renderBaseDatosTable);

  document.getElementById('btnResetBdFilters')?.addEventListener('click', () => {
    const s = document.getElementById('filterBdSearch'); if (s) s.value = '';
    const c = document.getElementById('filterBdCiclo'); if (c) c.value = 'ALL';
    const d = document.getElementById('filterBdDocente'); if (d) d.value = 'ALL';
    const e = document.getElementById('filterBdEstado'); if (e) e.value = 'ALL';
    renderBaseDatosTable();
  });

  // Botón Restaurar Oficial
  document.getElementById('btnRestaurarOficial')?.addEventListener('click', restaurarDatosOficiales);

  // Botón Exportar Excel
  document.getElementById('btnExportarExcel')?.addEventListener('click', exportarBaseDatosExcel);
}

// ==============================================================================
// 2. NAVEGACIÓN ENTRE LAS 3 PESTAÑAS (1. Dashboard, 2. Base Datos, 3. Cálculos)
// ==============================================================================
function switchTrilceTab(tabId) {
  currentTab = tabId;

  // Actualizar botones de pestaña
  document.querySelectorAll('.ucv-tab-btn, .trilce-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Mostrar/ocultar paneles
  const tabs = ['tab-dashboard', 'tab-base-datos', 'tab-calculos'];
  tabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      el.style.display = (t === tabId) ? 'block' : 'none';
    }
  });

  // Renderizar gráficos si se entra a la pestaña de cálculos
  if (tabId === 'tab-calculos') {
    setTimeout(renderCalculosCharts, 100);
  }
}

// ==============================================================================
// 3. CARGA DE DATOS (API / LOCALSTORAGE / FALLBACK)
// ==============================================================================
function normalizeRendimientoData(data) {
  if (!data || !Array.isArray(data.base_datos) || data.base_datos.length === 0) return data;

  let totMatr = 0, totEval = 0, totAprob = 0, totDesap = 0, totInh = 0, totRes = 0;
  let totN0_10 = 0, totN11_15 = 0, totN16_20 = 0, sumWeighted = 0;

  data.base_datos.forEach(r => {
    r.matriculados = Number(r.matriculados) || 0;
    r.n0_10 = Number(r.n0_10) || 0;
    r.n11_15 = Number(r.n11_15) || 0;
    r.n16_20 = Number(r.n16_20) || 0;
    r.asistencia = Number(r.asistencia) || (r.n0_10 + r.n11_15 + r.n16_20);
    r.inhabilitados = Number(r.inhabilitados) || 0;
    r.reservas = Number(r.reservas) || 0;
    r.promedio_aula = Number(r.promedio_aula) || 0;
    r.aprobados = Number(r.aprobados) || (r.n11_15 + r.n16_20);
    r.desaprobados = Number(r.desaprobados) || r.n0_10;

    if (!r.pct_aprobados && r.aprobados > 0 && r.matriculados > 0) {
      r.pct_aprobados = r.aprobados / r.matriculados;
    }
    if (!r.pct_desaprobados && r.desaprobados > 0 && r.matriculados > 0) {
      r.pct_desaprobados = r.desaprobados / r.matriculados;
    }
    if (!r.pct_inh && r.inhabilitados > 0 && r.matriculados > 0) {
      r.pct_inh = r.inhabilitados / r.matriculados;
    }

    totMatr += r.matriculados;
    totEval += r.asistencia;
    totAprob += r.aprobados;
    totDesap += r.desaprobados;
    totInh += r.inhabilitados;
    totRes += r.reservas;
    totN0_10 += r.n0_10;
    totN11_15 += r.n11_15;
    totN16_20 += r.n16_20;
    if (r.promedio_aula > 0 && r.asistencia > 0) {
      sumWeighted += (r.promedio_aula * r.asistencia);
    }
  });

  data.kpis = {
    total_matriculados: totMatr,
    estudiantes_evaluados: totEval,
    tasa_aprobacion: totEval > 0 ? (totAprob / totEval) : 0,
    promedio_general_aula: totEval > 0 ? (sumWeighted / totEval) : 0,
    inhabilitados: totInh,
    pct_inhabilitados: totMatr > 0 ? (totInh / totMatr) : 0,
    reservas: totRes,
    pct_reservas: totMatr > 0 ? (totRes / totMatr) : 0,
    total_aprobados: totAprob,
    total_desaprobados: totDesap,
    asistencia_efectiva_pct: totMatr > 0 ? (totEval / totMatr) : 0
  };

  if (!data.calculos) data.calculos = {};
  data.calculos.por_rango_nota = [
    { rango: '0 - 10 (Desaprobados)', estudiantes: totN0_10, pct_distribucion: totEval > 0 ? (totN0_10 / totEval) : 0 },
    { rango: '11 - 15 (Aprobados Regulares)', estudiantes: totN11_15, pct_distribucion: totEval > 0 ? (totN11_15 / totEval) : 0 },
    { rango: '16 - 20 (Destacados)', estudiantes: totN16_20, pct_distribucion: totEval > 0 ? (totN16_20 / totEval) : 0 }
  ];

  return data;
}

async function loadRendimientoData() {
  // 1. Intentar cargar desde localStorage primero para velocidad inmediata
  try {
    const cached = localStorage.getItem('sga_rendimiento_industrial_data');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.base_datos && parsed.base_datos.length > 0) {
        rendimientoData = normalizeRendimientoData(parsed);
        renderAllViews();
      }
    }
  } catch (e) {
    console.warn('[RENDIMIENTO] Error al leer caché local:', e);
  }

  // 2. Fetch al servidor (API PHP o Python)
  const apiUrls = [
    'api/rendimiento_industrial',
    'api/rendimiento_industrial.php',
    'data/rendimiento_industrial.json'
  ];

  for (const url of apiUrls) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.base_datos && json.base_datos.length > 0) {
          rendimientoData = normalizeRendimientoData(json);
          localStorage.setItem('sga_rendimiento_industrial_data', JSON.stringify(rendimientoData));
          renderAllViews();
          return;
        }
      }
    } catch (err) {
      // Intentar con la siguiente URL
    }
  }
}

function renderAllViews() {
  renderHeaderBadges();
  renderKpis();
  renderAlertCards();
  renderDashboardTable();
  populateDocentesFilter();
  renderBaseDatosTable();
  renderCalculosCharts();
}

// ==============================================================================
// 4. RENDERIZADO: PESTAÑA 1 (DASHBOARD PRINCIPAL)
// ==============================================================================
function renderHeaderBadges() {
  const total = rendimientoData.base_datos ? rendimientoData.base_datos.length : 0;
  const bSecciones = document.getElementById('badgeTotalSecciones');
  if (bSecciones) bSecciones.textContent = `${total} Secciones Registradas`;

  const pillBd = document.getElementById('pillCountBd');
  if (pillBd) pillBd.textContent = `${total} Grupos`;

  const heroTitle = document.getElementById('heroReportTitle');
  if (heroTitle && rendimientoData.titulo_reporte) {
    heroTitle.textContent = `${rendimientoData.titulo_reporte} — UCV Filial Lima Norte`;
  }

  const bActualizacion = document.getElementById('badgeUltimaActualizacion');
  if (bActualizacion && rendimientoData.ultima_actualizacion) {
    const d = new Date(rendimientoData.ultima_actualizacion);
    if (!isNaN(d.getTime())) {
      bActualizacion.innerHTML = `<i class="bi bi-clock-history me-1 text-primary"></i>Actualizado: ${d.toLocaleDateString('es-PE')} ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  }
}

function renderKpis() {
  const k = rendimientoData.kpis || {};
  const totMatr = k.total_matriculados ?? 0;
  const totEval = k.estudiantes_evaluados ?? 0;
  const totAprob = k.total_aprobados ?? 0;
  const totDesap = k.total_desaprobados ?? 0;
  const inh = k.inhabilitados ?? 0;
  const res = k.reservas ?? 0;

  const elMatr = document.getElementById('kpiMatriculados');
  if (elMatr) elMatr.textContent = totMatr.toLocaleString('es-PE');

  const elInhabSub = document.getElementById('kpiInhabSub');
  if (elInhabSub) {
    const pctInhVal = k.pct_inhabilitados ?? (totMatr > 0 ? (inh / totMatr) : 0);
    const pct = (pctInhVal * 100).toFixed(1);
    elInhabSub.textContent = `${inh} (${pct}%)`;
  }

  const elResSub = document.getElementById('kpiReservasSub');
  if (elResSub) elResSub.textContent = res;

  const elEval = document.getElementById('kpiEvaluados');
  if (elEval) elEval.textContent = totEval.toLocaleString('es-PE');

  const elAsistPct = document.getElementById('kpiAsistenciaPct');
  if (elAsistPct) {
    const evalPctVal = k.asistencia_efectiva_pct ?? (totMatr > 0 ? (totEval / totMatr) : 0);
    const evalPct = (evalPctVal * 100).toFixed(1);
    elAsistPct.textContent = `${evalPct}% de matriculados`;
  }

  const elTasa = document.getElementById('kpiTasaAprobacion');
  if (elTasa) {
    const tasaVal = k.tasa_aprobacion ?? (totEval > 0 ? (totAprob / totEval) : 0);
    const tasa = (tasaVal * 100).toFixed(1);
    elTasa.textContent = `${tasa}%`;
  }

  const elAprobSub = document.getElementById('kpiAprobadosSub');
  if (elAprobSub) elAprobSub.textContent = totAprob;

  const elDesapSub = document.getElementById('kpiDesaprobadosSub');
  if (elDesapSub) elDesapSub.textContent = totDesap;

  const elProm = document.getElementById('kpiPromedioGeneral');
  if (elProm) {
    const prom = Number(k.promedio_general_aula ?? 0).toFixed(2);
    elProm.innerHTML = `${prom} <span class="fs-6 text-muted fw-normal">/ 20</span>`;
  }
}

function renderAlertCards() {
  const cursos = rendimientoData.dashboard_cursos || [];

  // 1. Cursos en Riesgo (Desaprobados > 50% o 0% Aprobación)
  const riesgoCursos = cursos.filter(c => c.estado === 'En Riesgo' || c.pct_aprobacion < 0.5);
  const containerRiesgo = document.getElementById('containerCursosRiesgoList');
  if (containerRiesgo) {
    if (riesgoCursos.length === 0) {
      containerRiesgo.innerHTML = '<span class="text-success small"><i class="bi bi-check-all me-1"></i>No hay cursos en riesgo crítico.</span>';
    } else {
      containerRiesgo.innerHTML = riesgoCursos.map(c => `
        <span class="badge badge-estado-riesgo py-1 px-2.5" title="Aprobación: ${(c.pct_aprobacion * 100).toFixed(1)}% | Promedio: ${c.promedio_aula}">
          <i class="bi bi-exclamation-circle-fill"></i>
          <strong>Ciclo ${c.ciclo}:</strong> ${c.asignatura}
          <span class="ms-1 px-1 bg-white rounded text-danger fw-extrabold">${(c.pct_aprobacion * 100).toFixed(0)}% aprob.</span>
        </span>
      `).join('');
    }
  }

  // 2. Cursos Sobresalientes (100% de Aprobación)
  const excelenteCursos = cursos.filter(c => c.estado === 'Excelente' || c.pct_aprobacion === 1);
  const containerExcelente = document.getElementById('containerCursosExcelenteList');
  if (containerExcelente) {
    if (excelenteCursos.length === 0) {
      containerExcelente.innerHTML = '<span class="text-muted small">No hay cursos con 100% de aprobación.</span>';
    } else {
      containerExcelente.innerHTML = excelenteCursos.map(c => `
        <span class="badge badge-estado-excelente py-1 px-2.5" title="Aprobación: 100% | Promedio: ${c.promedio_aula}">
          <i class="bi bi-check-circle-fill"></i>
          <strong>Ciclo ${c.ciclo}:</strong> ${c.asignatura}
          <span class="ms-1 px-1 bg-white rounded text-success fw-extrabold">100% aprob.</span>
        </span>
      `).join('');
    }
  }
}

function renderDashboardTable() {
  const tbody = document.getElementById('tbodyDashboardCursos');
  const tfoot = document.getElementById('tfootDashboardCursos');
  const countBadge = document.getElementById('dashCursosCountBadge');
  const cursos = rendimientoData.dashboard_cursos || [];

  if (countBadge) {
    countBadge.textContent = `${cursos.length} Cursos Analizados`;
  }

  if (!tbody) return;

  if (cursos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">No hay asignaturas finalizadas registradas en el reporte.</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  let totMatr = 0, totEval = 0, totAprob = 0, totDesap = 0, totInhab = 0;
  let weightedSum = 0;

  const html = cursos.map(c => {
    totMatr += c.matriculados;
    totEval += c.evaluados;
    totAprob += c.aprobados;
    totDesap += c.desaprobados;
    totInhab += c.inhabilitados;
    weightedSum += (c.promedio_aula * c.evaluados);

    const pctAprob = (c.pct_aprobacion * 100).toFixed(1);
    const pctDesap = (c.pct_desaprobacion * 100).toFixed(1);
    const pctInh = (c.pct_inhab * 100).toFixed(1);

    let badgeClass = 'badge-estado-regular';
    let iconClass = 'bi-exclamation-triangle';
    if (c.estado === 'Excelente' || c.pct_aprobacion >= 0.8) {
      badgeClass = 'badge-estado-excelente';
      iconClass = 'bi-check-circle-fill';
    } else if (c.estado === 'En Riesgo' || c.pct_aprobacion < 0.5) {
      badgeClass = 'badge-estado-riesgo';
      iconClass = 'bi-x-octagon-fill';
    }

    return `
      <tr>
        <td class="ps-3 text-center fw-bold"><span class="badge bg-light text-dark border">${c.ciclo}</span></td>
        <td class="fw-bold text-dark">${c.asignatura}</td>
        <td class="text-center fw-semibold">${c.matriculados}</td>
        <td class="text-center fw-semibold">${c.evaluados}</td>
        <td class="text-center text-success fw-bold">${c.aprobados}</td>
        <td class="text-center text-danger fw-bold">${c.desaprobados}</td>
        <td class="text-center">
          <div class="d-flex align-items-center justify-content-center gap-2">
            <div class="cell-progress-bar">
              <div class="cell-progress-fill" style="width: ${pctAprob}%; background-color: ${Number(pctAprob) >= 80 ? '#10B981' : (Number(pctAprob) >= 50 ? '#F59E0B' : '#E11D48')};"></div>
            </div>
            <span class="fw-bold ${Number(pctAprob) < 50 ? 'text-danger' : 'text-success'}" style="min-width: 44px; text-align: right;">${pctAprob}%</span>
          </div>
        </td>
        <td class="text-center text-muted">${pctDesap}%</td>
        <td class="text-center ${c.inhabilitados > 20 ? 'text-danger fw-bold' : 'text-muted'}">${c.inhabilitados}</td>
        <td class="text-center ${Number(pctInh) > 20 ? 'text-danger fw-bold' : 'text-muted'}">${pctInh}%</td>
        <td class="text-center fw-bold" style="font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">${Number(c.promedio_aula).toFixed(2)}</td>
        <td class="text-center pe-3">
          <span class="badge ${badgeClass}">
            <i class="bi ${iconClass}"></i> ${c.estado}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;

  // Pie con totales generales
  if (tfoot) {
    const totPctAprob = totEval > 0 ? ((totAprob / totEval) * 100).toFixed(1) : '0.0';
    const totPctDesap = totEval > 0 ? ((totDesap / totEval) * 100).toFixed(1) : '0.0';
    const totPctInh = totMatr > 0 ? ((totInhab / totMatr) * 100).toFixed(1) : '0.0';
    const totAvg = totEval > 0 ? (weightedSum / totEval).toFixed(2) : '0.00';

    tfoot.innerHTML = `
      <tr class="table-dark">
        <td class="ps-3 text-center">TOTAL</td>
        <td>TOTAL GENERAL CONSOLIDADO</td>
        <td class="text-center">${totMatr}</td>
        <td class="text-center">${totEval}</td>
        <td class="text-center text-success">${totAprob}</td>
        <td class="text-center text-danger">${totDesap}</td>
        <td class="text-center text-warning">${totPctAprob}%</td>
        <td class="text-center">${totPctDesap}%</td>
        <td class="text-center">${totInhab}</td>
        <td class="text-center">${totPctInh}%</td>
        <td class="text-center" style="font-family: 'JetBrains Mono', monospace;">${totAvg}</td>
        <td class="text-center pe-3"><span class="badge bg-secondary">Consolidado</span></td>
      </tr>
    `;
  }
}

// ==============================================================================
// 5. RENDERIZADO: PESTAÑA 2 (BASE DE DATOS TRILCE HOJA1)
// ==============================================================================
function populateDocentesFilter() {
  const select = document.getElementById('filterBdDocente');
  if (!select) return;

  const currentVal = select.value;
  const db = rendimientoData.base_datos || [];
  const docentes = Array.from(new Set(db.map(r => (r.docente || '').trim()).filter(Boolean))).sort();

  select.innerHTML = '<option value="ALL">Todos los Docentes</option>' +
    docentes.map(d => `<option value="${d}">${d}</option>`).join('');

  if (docentes.includes(currentVal)) {
    select.value = currentVal;
  }
}

function renderBaseDatosTable() {
  const tbody = document.getElementById('tbodyBaseDatosTrilce');
  const countBadge = document.getElementById('bdFilteredCountBadge');
  const db = rendimientoData.base_datos || [];

  if (!tbody) return;

  const search = (document.getElementById('filterBdSearch')?.value || '').toLowerCase().trim();
  const filterCiclo = document.getElementById('filterBdCiclo')?.value || 'ALL';
  const filterDocente = document.getElementById('filterBdDocente')?.value || 'ALL';
  const filterEstado = document.getElementById('filterBdEstado')?.value || 'ALL';

  const filtered = db.filter(r => {
    // 1. Filtro de búsqueda
    if (search) {
      const match = (
        (r.docente || '').toLowerCase().includes(search) ||
        (r.asignatura || '').toLowerCase().includes(search) ||
        (r.seccion || '').toLowerCase().includes(search) ||
        (r.grupo || '').toLowerCase().includes(search) ||
        (r.dia || '').toLowerCase().includes(search) ||
        (r.ciclo || '').toLowerCase().includes(search)
      );
      if (!match) return false;
    }

    // 2. Filtro Ciclo
    if (filterCiclo !== 'ALL' && (r.ciclo || '').toUpperCase() !== filterCiclo.toUpperCase()) {
      return false;
    }

    // 3. Filtro Docente
    if (filterDocente !== 'ALL' && (r.docente || '').trim() !== filterDocente) {
      return false;
    }

    // 4. Filtro Estado
    if (filterEstado !== 'ALL') {
      const pctAprob = r.pct_aprobados;
      if (filterEstado === 'EXCELENTE' && pctAprob < 1) return false;
      if (filterEstado === 'RIESGO' && (pctAprob >= 0.5 && r.asistencia > 0)) return false;
      if (filterEstado === 'REGULAR' && (pctAprob === 1 || pctAprob < 0.5)) return false;
    }

    return true;
  });

  if (countBadge) {
    countBadge.textContent = `Mostrando ${filtered.length} de ${db.length} registros`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="19" class="text-center py-5 text-muted"><i class="bi bi-search me-1"></i>No se encontraron secciones con los filtros aplicados.</td></tr>`;
    return;
  }

  const html = filtered.map((r, idx) => {
    const pctAprob = ((r.pct_aprobados || 0) * 100).toFixed(0);
    const pctDesap = ((r.pct_desaprobados || 0) * 100).toFixed(0);
    const pctInh = ((r.pct_inh || 0) * 100).toFixed(0);
    const prom = r.promedio_aula ? Number(r.promedio_aula).toFixed(1) : '-';

    return `
      <tr>
        <td class="ps-3 text-center text-muted small">${r.id || (idx + 1)}</td>
        <td class="text-center"><span class="badge bg-light text-dark border fw-bold">${r.ciclo}</span></td>
        <td class="fw-bold text-dark" style="font-size: 0.8rem;">${r.docente}</td>
        <td style="font-size: 0.8rem;">${r.asignatura}</td>
        <td class="text-center"><span class="badge bg-primary-subtle text-primary">${r.seccion}</span></td>
        <td class="text-center small">${r.turno || '-'}</td>
        <td class="text-center small">${r.dia || '-'}</td>
        <td class="text-center fw-bold">${r.matriculados}</td>
        <td class="text-center text-danger fw-semibold">${r.n0_10}</td>
        <td class="text-center text-warning fw-semibold">${r.n11_15}</td>
        <td class="text-center text-success fw-semibold">${r.n16_20}</td>
        <td class="text-center">${r.asistencia}</td>
        <td class="text-center ${r.inhabilitados > 10 ? 'text-danger fw-bold' : 'text-muted'}">${r.inhabilitados}</td>
        <td class="text-center text-muted">${r.reservas}</td>
        <td class="text-center fw-bold" style="font-family: 'JetBrains Mono', monospace;">${prom}</td>
        <td class="text-center fw-bold text-success">${pctAprob}%</td>
        <td class="text-center text-danger">${pctDesap}%</td>
        <td class="text-center ${Number(pctInh) > 20 ? 'text-danger fw-bold' : 'text-muted'}">${pctInh}%</td>
        <td class="small text-muted" style="font-size: 0.72rem;">${r.fecha_inicio || ''} al ${r.fecha_termino || ''}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

// ==============================================================================
// 6. RENDERIZADO: PESTAÑA 3 (DASHBOARDS Y CÁLCULOS ANALÍTICOS)
// ==============================================================================
function renderCalculosCharts() {
  const calc = rendimientoData.calculos || {};
  const cursos = rendimientoData.dashboard_cursos || [];
  const db = rendimientoData.base_datos || [];

  // Calcular totales reales por rango de nota desde base_datos o calculos
  let n0_10 = 0, n11_15 = 0, n16_20 = 0;
  if (db.length > 0) {
    db.forEach(r => {
      n0_10 += Number(r.n0_10) || 0;
      n11_15 += Number(r.n11_15) || 0;
      n16_20 += Number(r.n16_20) || 0;
    });
  } else if (Array.isArray(calc.por_rango_nota) && calc.por_rango_nota.length >= 3) {
    n0_10 = Number(calc.por_rango_nota[0]?.estudiantes) || 0;
    n11_15 = Number(calc.por_rango_nota[1]?.estudiantes) || 0;
    n16_20 = Number(calc.por_rango_nota[2]?.estudiantes) || 0;
  }

  const totalRangos = n0_10 + n11_15 + n16_20;
  const pct0_10 = totalRangos > 0 ? ((n0_10 / totalRangos) * 100).toFixed(1) : '0.0';
  const pct11_15 = totalRangos > 0 ? ((n11_15 / totalRangos) * 100).toFixed(1) : '0.0';
  const pct16_20 = totalRangos > 0 ? ((n16_20 / totalRangos) * 100).toFixed(1) : '0.0';

  const elBadgeEval = document.getElementById('badgeCalculosEvaluados');
  if (elBadgeEval) elBadgeEval.textContent = `${totalRangos.toLocaleString('es-PE')} Evaluados`;

  const elR0 = document.getElementById('calcRango0_10');
  if (elR0) elR0.textContent = `${n0_10} (${pct0_10}%)`;

  const elR11 = document.getElementById('calcRango11_15');
  if (elR11) elR11.textContent = `${n11_15} (${pct11_15}%)`;

  const elR16 = document.getElementById('calcRango16_20');
  if (elR16) elR16.textContent = `${n16_20} (${pct16_20}%)`;

  // Renderizar tabla de cálculos de secciones y docentes siempre
  renderCalculosSeccionesTable();

  if (typeof Chart === 'undefined') return;

  // 1. Gráfico por Ciclo
  const ctxCiclos = document.getElementById('chartRendimientoCiclos');
  if (ctxCiclos) {
    if (chartCiclosInstance) chartCiclosInstance.destroy();

    const ciclosData = (calc.por_ciclo && calc.por_ciclo.length > 0) ? calc.por_ciclo : [];
    const labels = ciclosData.map(c => c.ciclo);

    chartCiclosInstance = new Chart(ctxCiclos, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Matriculados',
            data: ciclosData.map(c => c.matriculados),
            backgroundColor: '#CBD5E1',
            borderRadius: 6
          },
          {
            label: 'Evaluados (Asist.)',
            data: ciclosData.map(c => c.evaluados),
            backgroundColor: '#0284C7',
            borderRadius: 6
          },
          {
            label: 'Aprobados',
            data: ciclosData.map(c => c.aprobados),
            backgroundColor: '#059669',
            borderRadius: 6
          },
          {
            label: 'Desaprobados',
            data: ciclosData.map(c => c.desaprobados),
            backgroundColor: '#E11D48',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Plus Jakarta Sans', size: 11, weight: 'bold' } } },
          tooltip: {
            callbacks: {
              afterLabel: function(context) {
                const item = ciclosData[context.dataIndex];
                if (item && item.evaluados > 0) {
                  const pct = ((item.aprobados / item.evaluados) * 100).toFixed(1);
                  return `Tasa de Aprobación Ciclo: ${pct}%`;
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#F1F5F9' } }
        }
      }
    });
  }

  // 2. Gráfico de Distribución de Notas (Doughnut)
  const ctxNotas = document.getElementById('chartDistribucionNotas');
  if (ctxNotas) {
    if (chartNotasInstance) chartNotasInstance.destroy();

    chartNotasInstance = new Chart(ctxNotas, {
      type: 'doughnut',
      data: {
        labels: ['0 - 10 (Desaprobados)', '11 - 15 (Regulares)', '16 - 20 (Destacados)'],
        datasets: [{
          data: [n0_10, n11_15, n16_20],
          backgroundColor: ['#E11D48', '#F59E0B', '#10B981'],
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Plus Jakarta Sans', size: 10 } } }
        }
      }
    });
  }

  // 3. Gráfico de Tasa de Aprobación por Asignatura (Horizontal Bar)
  const ctxAprob = document.getElementById('chartAprobacionAsignaturas');
  if (ctxAprob) {
    if (chartAprobacionInstance) chartAprobacionInstance.destroy();

    const sortedCursos = [...cursos].sort((a, b) => a.pct_aprobacion - b.pct_aprobacion);
    const labels = sortedCursos.map(c => `[${c.ciclo}] ${c.asignatura.length > 25 ? c.asignatura.substring(0, 23) + '...' : c.asignatura}`);
    const values = sortedCursos.map(c => (c.pct_aprobacion * 100).toFixed(1));
    const colors = sortedCursos.map(c => {
      if (c.pct_aprobacion >= 0.8) return '#10B981'; // verde
      if (c.pct_aprobacion >= 0.5) return '#F59E0B'; // amarillo
      return '#E11D48'; // rojo
    });

    chartAprobacionInstance = new Chart(ctxAprob, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '% Aprobación',
          data: values,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) { return `Aprobación: ${ctx.raw}%`; }
            }
          }
        },
        scales: {
          x: { max: 100, beginAtZero: true, ticks: { callback: v => v + '%' } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // 4. Gráfico de Inhabilitaciones por Asignatura
  const ctxInhab = document.getElementById('chartInhabilitadosAsignaturas');
  if (ctxInhab) {
    if (chartInhabInstance) chartInhabInstance.destroy();

    const sortedInhab = [...cursos].sort((a, b) => b.inhabilitados - a.inhabilitados);
    const labels = sortedInhab.map(c => `[${c.ciclo}] ${c.asignatura.length > 20 ? c.asignatura.substring(0, 18) + '...' : c.asignatura}`);
    const values = sortedInhab.map(c => c.inhabilitados);

    chartInhabInstance = new Chart(ctxInhab, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Alumnos Inhabilitados',
          data: values,
          backgroundColor: '#991B1B',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } } },
          y: { beginAtZero: true }
        }
      }
    });
  }
}

function renderCalculosSeccionesTable() {
  const tbody = document.getElementById('tbodyCalculosSecciones');
  if (!tbody) return;

  const secciones = rendimientoData.calculos?.por_seccion_docente || [];
  if (secciones.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14" class="text-center py-4 text-muted">No hay registros de secciones calculadas disponibles.</td></tr>`;
    return;
  }

  tbody.innerHTML = secciones.map(s => `
    <tr>
      <td class="ps-3 text-center"><span class="badge bg-light text-dark border">${s.ciclo}</span></td>
      <td class="fw-bold">${s.asignatura}</td>
      <td class="text-center"><span class="badge bg-primary-subtle text-primary">${s.seccion}</span></td>
      <td>${s.docente}</td>
      <td class="text-center fw-bold">${s.matriculados}</td>
      <td class="text-center">${s.evaluados}</td>
      <td class="text-center text-success fw-bold">${s.aprobados}</td>
      <td class="text-center text-danger fw-bold">${s.desaprobados}</td>
      <td class="text-center ${s.inhabilitados > 10 ? 'text-danger fw-bold' : 'text-muted'}">${s.inhabilitados}</td>
      <td class="text-center text-muted">${s.reservas}</td>
      <td class="text-center fw-bold" style="font-family: 'JetBrains Mono', monospace;">${Number(s.promedio_aula).toFixed(1)}</td>
      <td class="text-center text-danger">${s.n0_10}</td>
      <td class="text-center text-warning">${s.n11_15}</td>
      <td class="text-center text-success">${s.n16_20}</td>
    </tr>
  `).join('');
}

// ==============================================================================
// 7. MOTOR DE SUBIDA Y PARSER ESTÁNDAR PARA TRILCE (EXCEL .XLSX / .XLS)
// ==============================================================================
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (file) {
    processExcelFile(file);
    // Resetear valor para permitir resubir el mismo archivo si es necesario
    event.target.value = '';
  }
}

function processExcelFile(file) {
  if (typeof XLSX === 'undefined') {
    showNotification('danger', 'La librería SheetJS no está cargada. Recargue la página.');
    return;
  }

  showNotification('info', `Procesando archivo oficial UCV: <strong>${file.name}</strong>...`);

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const parsed = parseTrilceWorkbook(workbook, file.name);
      if (!parsed || !parsed.base_datos || parsed.base_datos.length === 0) {
        throw new Error('No se encontraron registros válidos del formato oficial UCV-VA-017.');
      }

      // Actualizar estado en memoria
      rendimientoData = parsed;
      localStorage.setItem('sga_rendimiento_industrial_data', JSON.stringify(parsed));

      // Guardar en el servidor (Persistencia en data/rendimiento_industrial.json)
      saveRendimientoToServer(parsed);

      // Renderizar vistas de inmediato
      renderAllViews();

      showNotification('success', `
        <i class="bi bi-check-circle-fill me-1"></i>
        <strong>¡Reporte oficial UCV cargado con éxito!</strong> Se actualizaron <strong>${parsed.base_datos.length} secciones</strong> y se recalcularon los 3 dashboards automáticamente.
      `);
    } catch (err) {
      console.error('[UCV PARSER ERROR]', err);
      showNotification('danger', `Error al procesar el Excel oficial de la UCV: ${err.message}`);
    }
  };

  reader.onerror = function() {
    showNotification('danger', 'No se pudo leer el archivo seleccionado.');
  };

  reader.readAsArrayBuffer(file);
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, '').replace(/%/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parsePct(val, fallbackNum, fallbackDen) {
  if (val !== null && val !== undefined && String(val).trim() !== '' && !String(val).includes('#')) {
    const s = String(val).trim();
    if (s.endsWith('%')) {
      const n = parseFloat(s.replace('%', '').trim());
      if (!isNaN(n)) return n / 100;
    } else {
      const n = parseFloat(s);
      if (!isNaN(n)) {
        return n > 1 ? (n / 100) : n;
      }
    }
  }
  return fallbackDen > 0 ? (fallbackNum / fallbackDen) : 0;
}

/**
 * Parser inteligente que soporta tanto el Excel con las 3 hojas ("Dashboard", "Hoja1", "Calculos")
 * como un reporte crudo descargado de Trilce que contenga solo "Hoja1" / Formato UCV-VA-017.
 */
function parseTrilceWorkbook(workbook, fileName) {
  let hojaSheetName = null;
  let dashSheetName = null;

  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase();
    if (lower.includes('hoja1') || lower.includes('rendimiento') || lower.includes('trilce') || lower.includes('promedio')) {
      hojaSheetName = name;
    } else if (lower.includes('dash')) {
      dashSheetName = name;
    }
  }

  // Fallback a primera hoja si no se detectó por nombre
  if (!hojaSheetName && workbook.SheetNames.length > 0) {
    hojaSheetName = workbook.SheetNames[0];
  }

  const hojaSheet = workbook.Sheets[hojaSheetName];
  if (!hojaSheet) {
    throw new Error(`La hoja "${hojaSheetName}" no contiene datos.`);
  }

  const rawRows = XLSX.utils.sheet_to_json(hojaSheet, { header: 1 });
  if (!rawRows || rawRows.length < 4) {
    throw new Error('El reporte contiene muy pocas filas para ser un formato UCV válido.');
  }

  // Detectar título del reporte en las primeras filas (ej. Primer Promedio / Segundo Promedio)
  let tituloReporte = 'Rendimiento Académico: Segundo Promedio';
  for (let r = 0; r < Math.min(8, rawRows.length); r++) {
    const firstCell = String((rawRows[r] && rawRows[r][0]) || '').trim();
    if (firstCell.toLowerCase().includes('rendimiento')) {
      tituloReporte = firstCell;
      break;
    }
  }

  // Localizar fila de cabeceras
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(15, rawRows.length); r++) {
    const lineText = (rawRows[r] || []).map(c => String(c || '').toLowerCase()).join(' ');
    if (lineText.includes('docente') && (lineText.includes('asignatura') || lineText.includes('escuela') || lineText.includes('ciclo'))) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 7; // índice estándar en el formato oficial
  }

  // Extraer las filas de datos válidas (ignorando filas vacías o con errores tipo #REF!)
  const dataRows = rawRows.slice(headerRowIdx + 1).filter(r => {
    if (!r) return false;
    const filial = String(r[0] || '').trim();
    const docente = String(r[3] || '').trim();
    const asignatura = String(r[5] || '').trim();
    if (!filial && !docente && !asignatura) return false;
    if (filial.startsWith('#') || docente.startsWith('#') || asignatura.startsWith('#')) return false;
    return Boolean(docente || asignatura);
  });

  const baseDatos = dataRows.map((r, i) => {
    const matr = parseNum(r[11]);
    const n0_10 = parseNum(r[12]);
    const n11_15 = parseNum(r[14]);
    const n16_20 = parseNum(r[16]);
    const asist = parseNum(r[18]) || (n0_10 + n11_15 + n16_20);
    const inh = parseNum(r[19]);
    const res = parseNum(r[20]);
    const prom = parseNum(r[21]);
    const aprob = r[22] !== undefined && r[22] !== null && String(r[22]).trim() !== '' ? parseNum(r[22]) : (n11_15 + n16_20);
    const desap = r[24] !== undefined && r[24] !== null && String(r[24]).trim() !== '' ? parseNum(r[24]) : n0_10;
    const inhRes = r[26] !== undefined && r[26] !== null && String(r[26]).trim() !== '' ? parseNum(r[26]) : inh;

    return {
      id: i + 1,
      filial: String(r[0] || 'UCV CAMPUS LIMA NORTE').trim(),
      escuela: String(r[1] || 'INGENIERÍA INDUSTRIAL').trim(),
      ciclo: String(r[2] || '').trim(),
      docente: String(r[3] || '').trim(),
      condicion: String(r[4] || 'DTP').trim(),
      asignatura: String(r[5] || '').trim(),
      aula: String(r[6] || '').trim(),
      turno: String(r[7] || '').trim().startsWith('#') ? '' : String(r[7] || '').trim(),
      seccion: String(r[8] || '').trim(),
      grupo: String(r[9] || '').trim(),
      dia: String(r[10] || '').trim(),
      matriculados: matr,
      n0_10: n0_10,
      pct0_10: parsePct(r[13], n0_10, matr),
      n11_15: n11_15,
      pct11_15: parsePct(r[15], n11_15, matr),
      n16_20: n16_20,
      pct16_20: parsePct(r[17], n16_20, matr),
      asistencia: asist,
      inhabilitados: inh,
      reservas: res,
      promedio_aula: prom,
      aprobados: aprob,
      pct_aprobados: parsePct(r[23], aprob, matr),
      desaprobados: desap,
      pct_desaprobados: parsePct(r[25], desap, matr),
      inh_resumen: inhRes,
      pct_inh: parsePct(r[27], inh, matr),
      op_aprendizaje: r[28] || '',
      op_metodologia: r[29] || '',
      op_dominio: r[30] || '',
      conclusiones: r[31] || '',
      fecha_inicio: r[32] || '',
      fecha_termino: r[33] || ''
    };
  });

  // ==========================================================================
  // CÁLCULO AUTOMÁTICO DE MÉTRICAS AGREGADAS (DASHBOARD Y CALCULOS)
  // ==========================================================================
  const cursosMap = {};
  const ciclosMap = {};
  const seccionesCalculos = [];

  let totMatriculados = 0;
  let totEvaluados = 0;
  let totAprobados = 0;
  let totDesaprobados = 0;
  let totInhabilitados = 0;
  let totReservas = 0;
  let totN0_10 = 0;
  let totN11_15 = 0;
  let totN16_20 = 0;
  let sumPromedioWeighted = 0;

  baseDatos.forEach(r => {
    totMatriculados += r.matriculados;
    totEvaluados += r.asistencia;
    totAprobados += r.aprobados;
    totDesaprobados += r.desaprobados;
    totInhabilitados += r.inhabilitados;
    totReservas += r.reservas;
    totN0_10 += r.n0_10;
    totN11_15 += r.n11_15;
    totN16_20 += r.n16_20;
    if (r.promedio_aula && r.asistencia > 0) {
      sumPromedioWeighted += (r.promedio_aula * r.asistencia);
    }

    // Agrupación por Asignatura
    const keyCurso = `${r.ciclo}__${r.asignatura}`;
    if (!cursosMap[keyCurso]) {
      cursosMap[keyCurso] = {
        ciclo: r.ciclo,
        asignatura: r.asignatura,
        matriculados: 0,
        evaluados: 0,
        aprobados: 0,
        desaprobados: 0,
        inhabilitados: 0,
        weightedSum: 0
      };
    }
    cursosMap[keyCurso].matriculados += r.matriculados;
    cursosMap[keyCurso].evaluados += r.asistencia;
    cursosMap[keyCurso].aprobados += r.aprobados;
    cursosMap[keyCurso].desaprobados += r.desaprobados;
    cursosMap[keyCurso].inhabilitados += r.inhabilitados;
    cursosMap[keyCurso].weightedSum += (r.promedio_aula * r.asistencia);

    // Agrupación por Ciclo
    const cicloLabel = `Ciclo ${r.ciclo}`;
    if (!ciclosMap[cicloLabel]) {
      ciclosMap[cicloLabel] = {
        ciclo: cicloLabel,
        matriculados: 0,
        evaluados: 0,
        aprobados: 0,
        desaprobados: 0
      };
    }
    ciclosMap[cicloLabel].matriculados += r.matriculados;
    ciclosMap[cicloLabel].evaluados += r.asistencia;
    ciclosMap[cicloLabel].aprobados += r.aprobados;
    ciclosMap[cicloLabel].desaprobados += r.desaprobados;

    // Fila detallada de sección
    seccionesCalculos.push({
      ciclo: r.ciclo,
      asignatura: r.asignatura,
      seccion: r.seccion,
      docente: r.docente,
      matriculados: r.matriculados,
      evaluados: r.asistencia,
      aprobados: r.aprobados,
      desaprobados: r.desaprobados,
      inhabilitados: r.inhabilitados,
      reservas: r.reservas,
      promedio_aula: r.promedio_aula,
      n0_10: r.n0_10,
      n11_15: r.n11_15,
      n16_20: r.n16_20
    });
  });

  // Generar lista de cursos finalizados para el Dashboard
  const dashboardCursos = Object.values(cursosMap).map(c => {
    const pctAprob = c.evaluados > 0 ? (c.aprobados / c.evaluados) : 0;
    const pctDesap = c.evaluados > 0 ? (c.desaprobados / c.evaluados) : 0;
    const pctInh = c.matriculados > 0 ? (c.inhabilitados / c.matriculados) : 0;
    const prom = c.evaluados > 0 ? (c.weightedSum / c.evaluados) : 0;

    let estado = 'Regular';
    if (pctAprob >= 0.8) estado = 'Excelente';
    else if (pctAprob < 0.5) estado = 'En Riesgo';

    return {
      ciclo: c.ciclo,
      asignatura: c.asignatura,
      matriculados: c.matriculados,
      evaluados: c.evaluados,
      aprobados: c.aprobados,
      desaprobados: c.desaprobados,
      pct_aprobacion: pctAprob,
      pct_desaprobacion: pctDesap,
      inhabilitados: c.inhabilitados,
      pct_inhab: pctInh,
      promedio_aula: prom,
      estado: estado
    };
  });

  const kpis = {
    total_matriculados: totMatriculados,
    estudiantes_evaluados: totEvaluados,
    tasa_aprobacion: totEvaluados > 0 ? (totAprobados / totEvaluados) : 0,
    promedio_general_aula: totEvaluados > 0 ? (sumPromedioWeighted / totEvaluados) : 0,
    inhabilitados: totInhabilitados,
    pct_inhabilitados: totMatriculados > 0 ? (totInhabilitados / totMatriculados) : 0,
    reservas: totReservas,
    pct_reservas: totMatriculados > 0 ? (totReservas / totMatriculados) : 0,
    total_aprobados: totAprobados,
    total_desaprobados: totDesaprobados,
    asistencia_efectiva_pct: totMatriculados > 0 ? (totEvaluados / totMatriculados) : 0
  };

  const calculosCiclos = Object.values(ciclosMap);

  return {
    escuela: 'INGENIERÍA INDUSTRIAL',
    semestre: '2026-II',
    formato: 'UCV-VA-017',
    titulo_reporte: tituloReporte,
    ultima_actualizacion: new Date().toISOString(),
    kpis: kpis,
    dashboard_cursos: dashboardCursos,
    base_datos: baseDatos,
    calculos: {
      por_ciclo: calculosCiclos,
      por_rango_nota: [
        { rango: '0 - 10 (Desaprobados)', estudiantes: totN0_10, pct_distribucion: totEvaluados > 0 ? (totN0_10 / totEvaluados) : 0 },
        { rango: '11 - 15 (Aprobados Regulares)', estudiantes: totN11_15, pct_distribucion: totEvaluados > 0 ? (totN11_15 / totEvaluados) : 0 },
        { rango: '16 - 20 (Destacados)', estudiantes: totN16_20, pct_distribucion: totEvaluados > 0 ? (totN16_20 / totEvaluados) : 0 }
      ],
      por_seccion_docente: seccionesCalculos
    }
  };
}

// ==============================================================================
// 8. PERSISTENCIA EN EL SERVIDOR (API PHP / PYTHON)
// ==============================================================================
async function saveRendimientoToServer(payload) {
  const endpoints = ['api/rendimiento_industrial', 'api/rendimiento_industrial.php'];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        console.log(`[RENDIMIENTO] Guardado exitosamente en ${url}`);
        return;
      }
    } catch (e) {
      // Intentar siguiente
    }
  }
}

// ==============================================================================
// 9. RESTAURAR OFICIAL Y EXPORTAR EXCEL
// ==============================================================================
async function restaurarDatosOficiales() {
  if (!confirm('¿Desea restaurar los datos oficiales del reporte base de Ingeniería Industrial (57 secciones y 12 cursos analizados)?')) {
    return;
  }

  showNotification('info', 'Restableciendo datos oficiales...');

  try {
    const res = await fetch('api/rendimiento_industrial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' })
    });
    if (res.ok) {
      const result = await res.json();
      if (result.data) {
        rendimientoData = result.data;
        localStorage.setItem('sga_rendimiento_industrial_data', JSON.stringify(result.data));
        renderAllViews();
        showNotification('success', 'Datos restablecidos exitosamente a la versión base oficial.');
        return;
      }
    }
  } catch (e) {}

  // Fallback: reload fetch
  loadRendimientoData();
  showNotification('success', 'Datos recargados desde el archivo base oficial.');
}

function exportarBaseDatosExcel() {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS no se encuentra disponible.');
    return;
  }

  const db = rendimientoData.base_datos || [];
  if (db.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const rows = db.map(r => ({
    'Filial': r.filial,
    'Escuela': r.escuela,
    'Ciclo': r.ciclo,
    'Docente': r.docente,
    'Condición': r.condicion,
    'Asignatura': r.asignatura,
    'Aula': r.aula,
    'Turno': r.turno,
    'Sección': r.seccion,
    'Grupo': r.grupo,
    'Día': r.dia,
    'Matriculados': r.matriculados,
    'Notas 0-10': r.n0_10,
    'Notas 11-15': r.n11_15,
    'Notas 16-20': r.n16_20,
    'Total Asistencia': r.asistencia,
    'Inhabilitados': r.inhabilitados,
    'Reservas': r.reservas,
    'Promedio del Aula': r.promedio_aula,
    'Aprobados': r.aprobados,
    '% Aprobados': r.pct_aprobados,
    'Desaprobados': r.desaprobados,
    '% Desaprobados': r.pct_desaprobados,
    '% Inhabilitados': r.pct_inh,
    'Fecha Inicio': r.fecha_inicio,
    'Fecha Término': r.fecha_termino
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rendimiento_Industrial');

  const fechaStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Reporte_Rendimiento_Industrial_UCV_${fechaStr}.xlsx`);
}

function showNotification(type, message) {
  const alertEl = document.getElementById('statusAlert');
  const msgEl = document.getElementById('statusAlertMsg');
  if (alertEl && msgEl) {
    alertEl.className = `alert alert-${type} alert-dismissible fade show mb-3 shadow-xs`;
    msgEl.innerHTML = message;
    alertEl.style.display = 'block';
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        alertEl.style.display = 'none';
      }, 7000);
    }
  }
}
