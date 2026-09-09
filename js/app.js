/**
==============================================================================
APP.JS - Controlador Principal de Interfaz, Persistencia Física y Bootstrap 5
==============================================================================
Maneja la lógica interactiva, actualización de tablas, creación de grupos,
asignación docente y sincronización permanente en archivo físico (data/grupos.json)
y LocalStorage (con compatibilidad nativa para despliegue en Vercel).
==============================================================================
*/

const STORAGE_KEY = 'sga_modular_grupos_v1';
let allGroups = [];
let filteredGroups = [];
let analytics = null;
let editModalInstance = null;
let newGroupModalInstance = null;
let isServerConnected = false;

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar modales de Bootstrap
  const modalEl = document.getElementById('editModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    editModalInstance = new bootstrap.Modal(modalEl);
  }

  const newGroupModalEl = document.getElementById('newGroupModal');
  if (newGroupModalEl && typeof bootstrap !== 'undefined') {
    newGroupModalInstance = new bootstrap.Modal(newGroupModalEl);
  }

  setupEventListeners();

  // Cargar datos iniciales con estrategia de persistencia física
  loadInitialData();
});

/**
 * Carga de datos iniciales:
 * 1. Intenta leer el archivo físico desde el servidor (/api/grupos)
 * 2. Si no hay servidor (modo estático), lee de LocalStorage
 * 3. Si es la primera vez, lee DEMO_GRUPOS_DATA
 */
async function loadInitialData() {
  try {
    const res = await fetch('/api/grupos');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        isServerConnected = true;
        updateStorageBadge(true);
        loadDataset(data, `Archivo Físico (${data.length} Grupos)`);
        // Respaldar también en LocalStorage como resguardo
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
        return;
      }
    }
  } catch (err) {
    console.info('API local no disponible, verificando almacenamiento del navegador...', err);
  }

  // Respaldo en LocalStorage
  isServerConnected = false;
  updateStorageBadge(false);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        loadDataset(parsed, `Guardado Local (${parsed.length} Grupos)`);
        return;
      }
    }
  } catch (e) {
    console.warn('Error leyendo LocalStorage:', e);
  }

  // Cargar datos base oficiales iniciales
  if (typeof DEMO_GRUPOS_DATA !== 'undefined' && DEMO_GRUPOS_DATA.length > 0) {
    loadDataset(DEMO_GRUPOS_DATA, 'Programación Base Oficial (128 Grupos)');
    persistGroups(false);
  }
}

/**
 * Persistencia en archivo físico y memoria local
 */
function persistGroups(showToast = true, toastMsg = 'Cambios guardados con éxito.') {
  // 1. Siempre guardar en LocalStorage del navegador
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allGroups));
  } catch (e) {
    console.warn('Error al guardar en LocalStorage:', e);
  }

  // 2. Guardar en archivo físico en disco mediante la API REST (servidor local o Vercel)
  fetch('/api/grupos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(allGroups)
  })
  .then(res => {
    if (res.ok) return res.json();
    throw new Error('Respuesta HTTP ' + res.status);
  })
  .then(result => {
    isServerConnected = true;
    updateStorageBadge(true);
    if (showToast) {
      showFeedback(`${toastMsg} (Guardado permanentemente en archivo físico)`, 'success');
    }
  })
  .catch(err => {
    isServerConnected = false;
    updateStorageBadge(false);
    if (showToast) {
      showFeedback(`${toastMsg} (Guardado en memoria del navegador)`, 'info');
    }
  });
}

/**
 * Actualizar indicador visual de persistencia en la barra superior
 */
function updateStorageBadge(connected) {
  const badge = document.getElementById('storageStatusBadge');
  if (!badge) return;
  if (connected) {
    badge.className = 'badge bg-success-subtle text-success px-2 py-1.5 fw-semibold border border-success-subtle d-none d-lg-inline';
    badge.innerHTML = '<i class="bi bi-hdd-fill me-1"></i> Archivo Guardado';
    badge.title = 'Los cambios se guardan permanentemente en el archivo físico data/grupos.json';
  } else {
    badge.className = 'badge bg-primary-subtle text-primary px-2 py-1.5 fw-semibold border border-primary-subtle d-none d-lg-inline';
    badge.innerHTML = '<i class="bi bi-browser-chrome me-1"></i> Guardado Local';
    badge.title = 'Guardado en LocalStorage del navegador';
  }
}

/**
 * Registro de Eventos
 */
function setupEventListeners() {
  // Botón abrir modal nuevo grupo
  document.getElementById('btnOpenNewGroupModal')?.addEventListener('click', openNewGroupModal);

  // Botón guardar nuevo grupo
  document.getElementById('btnSaveNewGroup')?.addEventListener('click', saveNewGroup);

  // Selector de módulo en modal nuevo grupo (actualiza fechas y docentes sugeridos)
  document.getElementById('newGroupModulo')?.addEventListener('change', handleNewGroupModuleChange);

  // Manejo de otra escuela en modal
  document.getElementById('newGroupEscuela')?.addEventListener('change', (e) => {
    const customInput = document.getElementById('newGroupCustomEscuela');
    if (customInput) {
      customInput.classList.toggle('d-none', e.target.value !== 'OTRA');
      if (e.target.value === 'OTRA') customInput.focus();
    }
  });

  // Botón restaurar base oficial
  document.getElementById('btnLoadDemo')?.addEventListener('click', resetToOfficialBase);

  // Botón descargar Excel actualizado
  document.getElementById('btnDownloadExcel')?.addEventListener('click', exportUpdatedExcel);

  // Botón descargar plantilla Excel de ejemplo / vacía
  document.getElementById('btnDownloadTemplate')?.addEventListener('click', downloadExcelTemplate);

  // Selector de archivo Excel
  document.getElementById('excelFileInput')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  });

  // Zona Drag & Drop
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    });
  }

  // Filtros Globales Prioritarios
  document.getElementById('filterSearch')?.addEventListener('input', applyFilters);
  document.getElementById('filterEscuela')?.addEventListener('change', applyFilters);
  document.getElementById('filterCiclo')?.addEventListener('change', applyFilters);
  document.getElementById('filterModulo')?.addEventListener('change', applyFilters);
  document.getElementById('filterDocente')?.addEventListener('change', applyFilters);
  document.getElementById('filterAprobacion')?.addEventListener('change', applyFilters);
  document.getElementById('btnResetFilters')?.addEventListener('click', resetFilters);

  // Filtros internos de la Matriz
  document.getElementById('matrixSearch')?.addEventListener('input', renderMatrixTable);
  document.getElementById('matrixStatusFilter')?.addEventListener('change', renderMatrixTable);

  // Filtros internos de Vacantes
  document.getElementById('vacantModuleFilter')?.addEventListener('change', renderVacanciesTable);
  document.getElementById('vacantSchoolFilter')?.addEventListener('change', renderVacanciesTable);

  // Botones de exportación secundaria (CSV)
  document.getElementById('btnExportMatrixCsv')?.addEventListener('click', exportMatrixCsv);
  document.getElementById('btnExportGeneralCsv')?.addEventListener('click', exportGeneralCsv);

  // Guardar cambios en Modal de Asignación Docente
  document.getElementById('btnSaveModalChanges')?.addEventListener('click', saveModalChanges);
}

/**
 * Restablecer datos a la base oficial de 128 grupos
 */
async function resetToOfficialBase() {
  const confirmMsg = '¿Desea restablecer los datos a la programación oficial base de 128 grupos?\n\nSe sobrescribirán las adiciones y modificaciones guardadas.';
  if (!confirm(confirmMsg)) return;

  showFeedback('Restableciendo base oficial...', 'info');

  try {
    await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.info('Servidor no disponible para reset, limpiando almacenamiento local.');
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}

  if (typeof DEMO_GRUPOS_DATA !== 'undefined' && DEMO_GRUPOS_DATA.length > 0) {
    loadDataset(DEMO_GRUPOS_DATA, 'Programación Base Oficial (128 Grupos)');
    persistGroups(true, 'Datos oficiales base de 128 grupos restablecidos.');
  }
}

/**
 * Procesar archivo Excel subido
 */
function processFile(file) {
  showFeedback('Leyendo y analizando archivo Excel...', 'info');

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buffer = e.target.result;
      const result = ExcelParser.parseWorkbook(buffer, file.name);

      loadDataset(result.groups, `${file.name} (${result.groups.length} registros)`);
      persistGroups(true, `Archivo ${file.name} procesado y guardado en archivo físico.`);
      showFeedback(result.summary, 'success');
    } catch (err) {
      console.error(err);
      showFeedback('Error al procesar archivo: ' + err.message, 'danger');
    }
  };
  reader.readAsArrayBuffer(file);
}

/**
 * Cargar datos en memoria y recalcular analíticas
 */
function loadDataset(groups, label) {
  allGroups = groups.map((g, idx) => ({
    id: g.id !== undefined ? g.id : idx,
    ...g,
    modulo: g.modulo || ExcelParser.getModuloFromDate(g.inicio)
  }));

  const labelEl = document.getElementById('activeDatasetBadge');
  if (labelEl) labelEl.textContent = label;

  populateFilterSelectors();
  applyFilters();
}

/**
 * Poblar selectores de Escuela y Ciclo dinámicamente
 */
function populateFilterSelectors() {
  const escuelaSelect = document.getElementById('filterEscuela');
  const cicloSelect = document.getElementById('filterCiclo');

  if (escuelaSelect) {
    const currentVal = escuelaSelect.value;
    const escuelas = Array.from(new Set(allGroups.map(g => g.escuela).filter(Boolean))).sort();
    escuelaSelect.innerHTML = '<option value="ALL">Todas las Escuelas</option>' +
      escuelas.map(e => `<option value="${e}">${e}</option>`).join('');
    if (escuelas.includes(currentVal)) escuelaSelect.value = currentVal;
  }

  if (cicloSelect) {
    const currentVal = cicloSelect.value;
    const ciclos = Array.from(new Set(allGroups.map(g => g.ciclo).filter(c => c !== undefined && c !== null))).sort((a, b) => a - b);
    cicloSelect.innerHTML = '<option value="ALL">Todos los Ciclos</option>' +
      ciclos.map(c => `<option value="${c}">Ciclo ${c}</option>`).join('');
    if (ciclos.map(String).includes(String(currentVal))) cicloSelect.value = currentVal;
  }
}

/**
 * Aplicar Filtros Globales y Recalcular
 */
function applyFilters() {
  const search = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();
  const escuela = document.getElementById('filterEscuela')?.value || 'ALL';
  const ciclo = document.getElementById('filterCiclo')?.value || 'ALL';
  const modulo = document.getElementById('filterModulo')?.value || 'ALL';
  const docente = document.getElementById('filterDocente')?.value || 'ALL';
  const aprobacion = document.getElementById('filterAprobacion')?.value || 'ALL';

  filteredGroups = allGroups.filter(g => {
    if (search) {
      const target = `${g.curso} ${g.docente} ${g.seccion} ${g.escuela}`.toLowerCase();
      if (!target.includes(search)) return false;
    }
    if (escuela !== 'ALL' && g.escuela !== escuela) return false;
    if (ciclo !== 'ALL' && String(g.ciclo) !== String(ciclo)) return false;
    if (modulo !== 'ALL' && g.modulo !== modulo) return false;
    
    if (docente === 'CON_DOCENTE' && !g.docente) return false;
    if (docente === 'VACANTE' && g.docente) return false;

    if (aprobacion === 'APROBADO' && g.aprobado !== 'SI') return false;
    if (aprobacion === 'OBSERVADO' && (g.aprobado === 'SI' && g.vbda === 'SI')) return false;

    return true;
  });

  // Ejecutar motor analítico sobre el conjunto filtrado
  analytics = new AcademicAnalytics(filteredGroups, allGroups);

  // Actualizar resumen de filtrado
  const statsText = document.getElementById('filterStatsText');
  if (statsText) {
    const totalAlumnos = filteredGroups.reduce((sum, g) => sum + (g.matriculados || 0), 0);
    statsText.textContent = `Mostrando ${filteredGroups.length} de ${allGroups.length} grupos (${totalAlumnos.toLocaleString()} alumnos matriculados)`;
  }

  // Renderizar vistas
  renderKPIs();
  renderMatrixTable();
  renderVacanciesTable();
  renderGeneralTable();
  renderAuditCards();
  updateTabBadges();
}

/**
 * Restablecer Filtros a Valores por Defecto
 */
function resetFilters() {
  const ids = ['filterSearch', 'filterEscuela', 'filterCiclo', 'filterModulo', 'filterDocente', 'filterAprobacion'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT') el.value = '';
    if (el.tagName === 'SELECT') el.value = 'ALL';
  });
  applyFilters();
}

/**
 * Actualizar Badges en los encabezados de pestañas
 */
function updateTabBadges() {
  if (!analytics) return;
  const badgeMatriz = document.getElementById('badgeTabMatriz');
  if (badgeMatriz) badgeMatriz.textContent = analytics.teachers.length;

  const badgeVacantes = document.getElementById('badgeTabVacantes');
  if (badgeVacantes) badgeVacantes.textContent = analytics.vacancies.length;

  const badgeGeneral = document.getElementById('badgeTabGeneral');
  if (badgeGeneral) badgeGeneral.textContent = filteredGroups.length;

  const badgeAuditoria = document.getElementById('badgeTabAuditoria');
  if (badgeAuditoria) badgeAuditoria.textContent = analytics.audits.length;
}

/**
 * Renderizar Fila de Indicadores Clave (KPIs)
 */
function renderKPIs() {
  if (!analytics) return;
  const kpis = analytics.kpis;

  const elTotal = document.getElementById('kpiTotalGrupos');
  if (elTotal) elTotal.textContent = kpis.totalGrupos;

  const elCompletos = document.getElementById('kpiDocentesCompletos');
  if (elCompletos) elCompletos.textContent = `${kpis.docentesCompletos} / ${kpis.totalDocentes}`;

  const elIncompletos = document.getElementById('kpiDocentesIncompletos');
  if (elIncompletos) elIncompletos.textContent = `${kpis.docentesIncompletos} docentes`;

  const elVacantes = document.getElementById('kpiVacantes');
  if (elVacantes) elVacantes.textContent = `${kpis.vacantes} grupos`;

  const elAfectados = document.getElementById('kpiAlumnosAfectados');
  if (elAfectados) elAfectados.textContent = `${kpis.alumnosAfectados.toLocaleString()} alumnos`;
}

/**
 * Renderizar Pestaña 1: Matriz Modular Docente
 */
function renderMatrixTable() {
  if (!analytics) return;
  const tbody = document.getElementById('matrixTableBody');
  if (!tbody) return;

  const search = (document.getElementById('matrixSearch')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('matrixStatusFilter')?.value || 'ALL';

  let list = analytics.teachers;

  if (search) {
    list = list.filter(t => t.nombre.toLowerCase().includes(search) || t.cursos.toLowerCase().includes(search));
  }
  if (statusFilter === 'COMPLETE') {
    list = list.filter(t => t.activeModulesCount === 4);
  } else if (statusFilter === 'INCOMPLETE') {
    list = list.filter(t => t.activeModulesCount < 4);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No se encontraron docentes con el filtro seleccionado.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((t, idx) => {
    const formatMod = (val) => {
      if (val > 0) {
        return `<span class="badge-status-dot dot-complete" title="${val} curso(s) programado(s)"><i class="bi bi-check2"></i></span>`;
      } else {
        return `<span class="badge-status-dot dot-empty" title="Sin carga en este mes"><i class="bi bi-dash"></i></span>`;
      }
    };

    const estadoBadge = t.activeModulesCount === 4
      ? `<span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle py-1 px-2.5">Completo (4/4)</span>`
      : `<span class="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle py-1 px-2.5">Incompleto (${t.activeModulesCount}/4)</span>`;

    const aprobacionBadge = t.todoAprobado
      ? `<span class="badge rounded-pill bg-success text-white py-1 px-2">Aprobado</span>`
      : `<span class="badge rounded-pill bg-danger text-white py-1 px-2" title="Posee cursos con VBDA/VBDG = NO">Observado</span>`;

    return `
      <tr>
        <td class="text-muted small text-center">${idx + 1}</td>
        <td>
          <div class="fw-semibold text-dark">${t.nombre}</div>
          <small class="text-muted" style="font-size: 0.75rem;">${t.escuelas}</small>
        </td>
        <td class="small text-secondary" style="max-width: 240px; white-space: normal; line-height: 1.3;">
          ${t.cursos}
        </td>
        <td class="text-center">${formatMod(t.modulos.Set)}</td>
        <td class="text-center">${formatMod(t.modulos.Oct)}</td>
        <td class="text-center">${formatMod(t.modulos.Nov)}</td>
        <td class="text-center">${formatMod(t.modulos.Dic)}</td>
        <td class="text-center fw-bold fs-6">${t.activeModulesCount} <span class="text-muted" style="font-size: 0.72rem;">/ 4</span></td>
        <td class="text-center">${estadoBadge}</td>
        <td class="text-center">${aprobacionBadge}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Renderizar Pestaña 2: Bolsa de Vacantes
 */
function renderVacanciesTable() {
  if (!analytics) return;
  const tbody = document.getElementById('vacanciesTableBody');
  if (!tbody) return;

  const modFilter = document.getElementById('vacantModuleFilter')?.value || 'ALL';
  const schoolFilter = document.getElementById('vacantSchoolFilter')?.value || 'ALL';

  let list = analytics.vacancies;

  if (modFilter !== 'ALL') {
    list = list.filter(v => v.modulo === modFilter);
  }
  if (schoolFilter !== 'ALL') {
    list = list.filter(v => v.escuela === schoolFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted"><i class="bi bi-check-circle text-success me-1"></i> No hay vacantes pendientes con los filtros actuales.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(v => {
    const modBadge = `<span class="badge bg-secondary-subtle text-secondary border py-1 px-2 fw-bold">${v.modulo}</span>`;
    
    // Sugerencias de docentes libres
    let candidatesHtml = '<span class="text-muted small">Sin candidatos libres</span>';
    if (v.candidates && v.candidates.length > 0) {
      candidatesHtml = v.candidates.slice(0, 3).map(c => 
        `<button type="button" class="btn btn-xs btn-outline-primary py-0.5 px-2 me-1 mb-1" style="font-size: 0.73rem;" onclick="assignCandidateDirect(${v.id}, '${c.replace(/'/g, "\\'")}')">
          <i class="bi bi-person-plus me-1"></i>${c.split(' ')[0]} ${c.split(' ')[1] || ''}
        </button>`
      ).join('');
      if (v.candidates.length > 3) {
        candidatesHtml += `<span class="badge bg-light text-muted border py-0.5 px-1.5" style="font-size: 0.7rem;">+${v.candidates.length - 3}</span>`;
      }
    }

    return `
      <tr>
        <td>${modBadge}</td>
        <td class="small fw-semibold text-secondary">${v.escuela}</td>
        <td class="text-center text-muted fw-semibold">${v.ciclo}</td>
        <td class="fw-semibold text-dark">${v.curso}</td>
        <td><span class="badge bg-light text-dark border">${v.seccion}</span></td>
        <td class="small text-muted">${v.tipo_grupo}</td>
        <td class="text-end fw-bold text-danger">${v.matriculados}</td>
        <td class="small text-muted" style="font-size: 0.75rem;">${v.inicio} al ${v.termino}</td>
        <td style="max-width: 250px;">${candidatesHtml}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-primary-app py-0.5 px-2.5" style="font-size: 0.78rem;" onclick="openEditModal(${v.id})">
            <i class="bi bi-person-check me-1"></i>Asignar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Renderizar Pestaña 3: Tarjetas de Auditoría y Observaciones
 */
function renderAuditCards() {
  if (!analytics) return;
  const container = document.getElementById('auditCardsContainer');
  if (!container) return;

  const audits = analytics.audits;
  if (audits.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-success">
        <i class="bi bi-shield-check display-4"></i>
        <h5 class="mt-2 fw-bold">Sin Observaciones Críticas</h5>
        <p class="text-muted small">Todos los grupos analizados cumplen las reglas de consistencia de la programación académica.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = audits.map(a => {
    const isCritical = a.tipo === 'danger';
    const borderClass = isCritical ? 'border-danger' : 'border-warning';
    const badgeBg = isCritical ? 'bg-danger text-white' : 'bg-warning text-dark';
    const iconClass = isCritical ? 'bi bi-exclamation-octagon text-danger' : 'bi bi-exclamation-triangle text-warning';

    return `
      <div class="col-md-6">
        <div class="card h-100 border ${borderClass} shadow-sm p-3" style="border-radius: 10px;">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="d-flex align-items-center gap-2">
              <i class="${iconClass} fs-5"></i>
              <h6 class="fw-bold text-dark mb-0" style="font-size: 0.86rem;">${a.titulo}</h6>
            </div>
            <span class="badge rounded-pill ${badgeBg} py-0.5 px-2" style="font-size: 0.7rem;">${a.badge}</span>
          </div>
          <p class="text-secondary mb-2" style="font-size: 0.8rem; line-height: 1.4;">${a.descripcion}</p>
          <div class="text-muted bg-light px-2.5 py-1.5 rounded border" style="font-size: 0.74rem; max-height: 85px; overflow-y: auto;">
            ${a.detalle}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderizar Pestaña 4: Base General de Grupos
 */
function renderGeneralTable() {
  const tbody = document.getElementById('generalTableBody');
  if (!tbody) return;

  if (filteredGroups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="text-center py-4 text-muted">No se encontraron registros con los filtros seleccionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredGroups.map((g, i) => {
    const docHtml = g.docente 
      ? `<span class="fw-semibold text-dark">${g.docente}</span>`
      : `<span class="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle">Vacante</span>`;

    const vbdaBadge = g.vbda === 'SI' 
      ? `<span class="text-success fw-bold">SI</span>`
      : `<span class="text-danger fw-bold">NO</span>`;

    const vbdgBadge = g.vbdg === 'SI' 
      ? `<span class="text-success fw-bold">SI</span>`
      : `<span class="text-danger fw-bold">NO</span>`;

    const aprobBadge = g.aprobado === 'SI'
      ? `<span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle">SI</span>`
      : `<span class="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle">NO</span>`;

    return `
      <tr>
        <td class="text-muted small text-center">${i + 1}</td>
        <td class="small fw-semibold text-secondary">${g.escuela}</td>
        <td class="text-center text-muted fw-semibold">${g.ciclo}</td>
        <td class="fw-semibold text-dark">${g.curso}</td>
        <td><span class="badge bg-light text-dark border">${g.seccion}</span></td>
        <td class="small text-muted">${g.tipo_grupo}</td>
        <td class="text-end fw-bold">${g.matriculados}</td>
        <td>${docHtml}</td>
        <td class="text-center">${vbdaBadge}</td>
        <td class="text-center">${vbdgBadge}</td>
        <td class="text-center">${aprobBadge}</td>
        <td class="small text-muted">${g.inicio}</td>
        <td class="text-center">
          <div class="d-flex justify-content-center gap-1">
            <button class="btn btn-sm btn-outline-secondary py-0.5 px-1.5" style="font-size: 0.76rem;" onclick="openEditModal(${g.id})" title="Editar / Asignar Docente">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger py-0.5 px-1.5" style="font-size: 0.76rem;" onclick="deleteGroup(${g.id})" title="Eliminar Grupo">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Abrir Modal para Asignar / Editar Docente de un Grupo Existente
 */
function openEditModal(groupId) {
  const group = allGroups.find(g => g.id === groupId);
  if (!group) return;

  document.getElementById('modalGroupId').value = groupId;
  document.getElementById('modalGroupTitle').textContent = `${group.curso} (${group.seccion})`;
  document.getElementById('modalGroupMeta').textContent = `${group.escuela} • Ciclo ${group.ciclo} • Módulo ${group.modulo} • ${group.matriculados} matriculados`;

  // Poblar select con docentes registrados
  const teacherSelect = document.getElementById('modalTeacherSelect');
  const allTeacherNames = Array.from(new Set(allGroups.map(g => g.docente).filter(Boolean))).sort();

  teacherSelect.innerHTML = '<option value="">-- Dejar como Vacante (Sin Docente) --</option>' +
    allTeacherNames.map(name => {
      const isFree = analytics && analytics.teachers.some(t => t.nombre === name && t.modulos[group.modulo] === 0);
      const suffix = isFree ? ' [Disponible este mes]' : '';
      const isSelected = name === group.docente ? 'selected' : '';
      return `<option value="${name}" ${isSelected}>${name}${suffix}</option>`;
    }).join('');

  document.getElementById('modalCustomTeacher').value = '';
  document.getElementById('modalSelectVBDA').value = group.vbda || 'SI';
  document.getElementById('modalSelectAprobado').value = group.aprobado || 'SI';

  if (editModalInstance) {
    editModalInstance.show();
  }
}

/**
 * Asignar directamente un candidato libre desde la bolsa de vacantes
 */
function assignCandidateDirect(groupId, teacherName) {
  const index = allGroups.findIndex(g => g.id === groupId);
  if (index === -1) return;

  allGroups[index].docente = teacherName;
  allGroups[index].vbda = 'SI';
  allGroups[index].vbdg = 'SI';
  allGroups[index].aprobado = 'SI';

  persistGroups(true, `Docente ${teacherName} asignado al grupo "${allGroups[index].curso} (${allGroups[index].seccion})".`);
  applyFilters();
}

/**
 * Guardar Cambios del Modal de Edición
 */
function saveModalChanges() {
  const id = parseInt(document.getElementById('modalGroupId').value);
  const index = allGroups.findIndex(g => g.id === id);
  if (index === -1) return;

  const selectedTeacher = document.getElementById('modalTeacherSelect').value;
  const customTeacher = document.getElementById('modalCustomTeacher').value.trim().toUpperCase();
  const finalTeacher = customTeacher || selectedTeacher;

  const vb = document.getElementById('modalSelectVBDA').value;
  const aprobado = document.getElementById('modalSelectAprobado').value;

  // Actualizar objeto en memoria
  allGroups[index].docente = finalTeacher;
  allGroups[index].vbda = vb;
  allGroups[index].vbdg = vb;
  allGroups[index].aprobado = aprobado;

  if (editModalInstance) {
    editModalInstance.hide();
  }

  persistGroups(true, `Grupo "${allGroups[index].curso} (${allGroups[index].seccion})" actualizado con éxito.`);
  applyFilters();
}

/**
 * ==============================================================================
 * NUEVO GRUPO: Formulario, Validación y Persistencia
 * ==============================================================================
 */

/**
 * Abrir Modal para Añadir Nuevo Grupo
 */
function openNewGroupModal() {
  document.getElementById('newGroupCurso').value = '';
  document.getElementById('newGroupSeccion').value = 'B1';
  document.getElementById('newGroupTipo').value = 'TEORIA';
  document.getElementById('newGroupMatriculados').value = '40';
  document.getElementById('newGroupModulo').value = 'Set';
  document.getElementById('newGroupInicio').value = '01-09-2026';
  document.getElementById('newGroupTermino').value = '03-10-2026';
  document.getElementById('newGroupCustomDocente').value = '';
  document.getElementById('newGroupVBDA').value = 'SI';
  document.getElementById('newGroupAprobado').value = 'SI';
  document.getElementById('newGroupEscuela').value = 'INGENIERIA DE SISTEMAS';
  document.getElementById('newGroupCiclo').value = '1';

  const customEscuela = document.getElementById('newGroupCustomEscuela');
  if (customEscuela) {
    customEscuela.value = '';
    customEscuela.classList.add('d-none');
  }

  populateNewGroupTeachers('Set');

  if (newGroupModalInstance) {
    newGroupModalInstance.show();
  }
}

/**
 * Cambiar módulo en el formulario de nuevo grupo (sugiere fechas y filtra disponibilidad)
 */
function handleNewGroupModuleChange() {
  const mod = document.getElementById('newGroupModulo').value;
  const inicioInput = document.getElementById('newGroupInicio');
  const terminoInput = document.getElementById('newGroupTermino');

  if (mod === 'Set') {
    inicioInput.value = '01-09-2026';
    terminoInput.value = '03-10-2026';
  } else if (mod === 'Oct') {
    inicioInput.value = '05-10-2026';
    terminoInput.value = '31-10-2026';
  } else if (mod === 'Nov') {
    inicioInput.value = '02-11-2026';
    terminoInput.value = '28-11-2026';
  } else if (mod === 'Dic') {
    inicioInput.value = '01-12-2026';
    terminoInput.value = '19-12-2026';
  }

  populateNewGroupTeachers(mod);
}

/**
 * Poblar docentes en el formulario de nuevo grupo indicando disponibilidad en el mes
 */
function populateNewGroupTeachers(selectedModule) {
  const select = document.getElementById('newGroupDocenteSelect');
  if (!select) return;

  const allTeacherNames = Array.from(new Set(allGroups.map(g => g.docente).filter(Boolean))).sort();

  select.innerHTML = '<option value="">-- Dejar como Vacante (Sin Docente Asignado) --</option>' +
    allTeacherNames.map(name => {
      const isFree = analytics && analytics.teachers.some(t => t.nombre === name && t.modulos[selectedModule] === 0);
      const suffix = isFree ? ' [Disponible este mes]' : '';
      return `<option value="${name}">${name}${suffix}</option>`;
    }).join('');
}

/**
 * Guardar Nuevo Grupo en Archivo Físico y Memoria
 */
function saveNewGroup() {
  const escuelaSelect = document.getElementById('newGroupEscuela').value;
  const customEscuela = document.getElementById('newGroupCustomEscuela').value.trim().toUpperCase();
  const escuela = (escuelaSelect === 'OTRA' && customEscuela) ? customEscuela : escuelaSelect;

  const ciclo = parseInt(document.getElementById('newGroupCiclo').value);
  const curso = document.getElementById('newGroupCurso').value.trim().toUpperCase();
  const seccion = document.getElementById('newGroupSeccion').value.trim().toUpperCase();
  const tipo = document.getElementById('newGroupTipo').value;
  const matriculados = parseInt(document.getElementById('newGroupMatriculados').value) || 0;
  const modulo = document.getElementById('newGroupModulo').value;
  const inicio = document.getElementById('newGroupInicio').value.trim() || '01-09-2026';
  const termino = document.getElementById('newGroupTermino').value.trim() || '03-10-2026';

  const selectedDocente = document.getElementById('newGroupDocenteSelect').value;
  const customDocente = document.getElementById('newGroupCustomDocente').value.trim().toUpperCase();
  const finalDocente = customDocente || selectedDocente;

  const vbda = document.getElementById('newGroupVBDA').value;
  const aprobado = document.getElementById('newGroupAprobado').value;

  if (!curso) {
    alert('Por favor ingrese el nombre de la asignatura.');
    document.getElementById('newGroupCurso').focus();
    return;
  }
  if (!seccion) {
    alert('Por favor ingrese la sección.');
    document.getElementById('newGroupSeccion').focus();
    return;
  }

  // Generar ID único incremental
  const newId = allGroups.length > 0 ? Math.max(...allGroups.map(g => g.id || 0)) + 1 : 1;
  const newGroup = {
    id: newId,
    escuela,
    ciclo,
    curso,
    seccion,
    tipo_grupo: tipo,
    matriculados,
    docente: finalDocente,
    vbda,
    vbdg: vbda,
    aprobado,
    inicio,
    termino,
    modulo
  };

  // Insertar al inicio de la colección para visibilidad inmediata
  allGroups.unshift(newGroup);

  if (newGroupModalInstance) {
    newGroupModalInstance.hide();
  }

  // Persistir en archivo físico y LocalStorage
  persistGroups(true, `Grupo "${curso} (${seccion})" añadido y guardado con éxito.`);

  // Actualizar filtros y vistas
  populateFilterSelectors();
  applyFilters();
}

/**
 * Eliminar un grupo con confirmación
 */
function deleteGroup(groupId) {
  const group = allGroups.find(g => g.id === groupId);
  if (!group) return;

  const msg = `¿Está seguro de eliminar el siguiente grupo?\n\n• Asignatura: ${group.curso}\n• Sección: ${group.seccion} (${group.tipo_grupo})\n• Escuela: ${group.escuela}\n• Módulo: ${group.modulo}\n\nEsta acción se guardará permanentemente.`;
  if (!confirm(msg)) return;

  allGroups = allGroups.filter(g => g.id !== groupId);

  persistGroups(true, `Grupo "${group.curso} (${group.seccion})" eliminado exitosamente.`);
  populateFilterSelectors();
  applyFilters();
}

/**
 * ==============================================================================
 * EXPORTACIÓN Y REPORTES
 * ==============================================================================
 */

/**
 * Exportar archivo Excel (.xlsx) actualizado con TODOS los registros guardados
 */
function exportUpdatedExcel() {
  if (allGroups.length === 0) {
    alert('No hay información cargada para exportar.');
    return;
  }

  try {
    const rows = allGroups.map(g => ({
      'Escuela': g.escuela,
      'Ciclo': g.ciclo,
      'Experiencia Curricular': g.curso,
      'Sección': g.seccion,
      'Tipo Grupo': g.tipo_grupo,
      'Nro. Matriculados': g.matriculados,
      'Docente': g.docente,
      'VBDA': g.vbda,
      'VBDG': g.vbdg,
      'Aprobado': g.aprobado,
      'Inicio': g.inicio,
      'Término': g.termino,
      'Módulo': g.modulo
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Programacion_Grupos");
    XLSX.writeFile(wb, "Reporte_Programacion_Grupos_Actualizado.xlsx");

    showFeedback('Archivo Excel (.xlsx) actualizado descargado correctamente.', 'success');
  } catch (err) {
    console.error(err);
    alert('Error al generar Excel: ' + err.message);
  }
}

/**
 * Descargar Plantilla Excel (.xlsx) oficial con filas de ejemplo e instrucciones
 */
function downloadExcelTemplate() {
  try {
    const sampleRows = [
      {
        'Escuela': 'INGENIERIA DE SISTEMAS',
        'Ciclo': 2,
        'Experiencia Curricular': 'ALGORITMOS Y PROGRAMACIÓN',
        'Sección': 'B1',
        'Tipo Grupo': 'TEORIA',
        'Nro. Matriculados': 60,
        'Docente': 'AMACHE SANCHEZ MILTON FREDDY',
        'VBDA': 'SI',
        'VBDG': 'SI',
        'Aprobado': 'SI',
        'Inicio': '01-09-2026',
        'Término': '03-10-2026',
        'Módulo': 'Set'
      },
      {
        'Escuela': 'INGENIERIA DE SISTEMAS',
        'Ciclo': 2,
        'Experiencia Curricular': 'ALGORITMOS Y PROGRAMACIÓN',
        'Sección': 'B1',
        'Tipo Grupo': 'PRACTICA',
        'Nro. Matriculados': 60,
        'Docente': 'AMACHE SANCHEZ MILTON FREDDY',
        'VBDA': 'SI',
        'VBDG': 'SI',
        'Aprobado': 'SI',
        'Inicio': '07-09-2026',
        'Término': '21-09-2026',
        'Módulo': 'Set'
      },
      {
        'Escuela': 'INGENIERIA INDUSTRIAL',
        'Ciclo': 4,
        'Experiencia Curricular': 'QUÍMICA GENERAL',
        'Sección': 'B1',
        'Tipo Grupo': 'TEORIA',
        'Nro. Matriculados': 45,
        'Docente': '',
        'VBDA': 'NO',
        'VBDG': 'NO',
        'Aprobado': 'NO',
        'Inicio': '05-10-2026',
        'Término': '31-10-2026',
        'Módulo': 'Oct'
      },
      {
        'Escuela': 'INGENIERIA DE SISTEMAS',
        'Ciclo': 6,
        'Experiencia Curricular': 'INTELIGENCIA ARTIFICIAL',
        'Sección': 'B2',
        'Tipo Grupo': 'TEORIA',
        'Nro. Matriculados': 40,
        'Docente': 'OLMOS SALDIVAR DAVID',
        'VBDA': 'SI',
        'VBDG': 'SI',
        'Aprobado': 'SI',
        'Inicio': '02-11-2026',
        'Término': '28-11-2026',
        'Módulo': 'Nov'
      }
    ];

    const instructions = [
      { 'Columna': 'Escuela', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre oficial de la escuela profesional', 'Ejemplo': 'INGENIERIA DE SISTEMAS' },
      { 'Columna': 'Ciclo', 'Obligatorio': 'SÍ', 'Descripción': 'Número de ciclo académico (1 al 10)', 'Ejemplo': '2' },
      { 'Columna': 'Experiencia Curricular', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre de la asignatura o materia', 'Ejemplo': 'ALGORITMOS Y PROGRAMACIÓN' },
      { 'Columna': 'Sección', 'Obligatorio': 'SÍ', 'Descripción': 'Código identificador de la sección', 'Ejemplo': 'B1' },
      { 'Columna': 'Tipo Grupo', 'Obligatorio': 'SÍ', 'Descripción': 'Modalidad: TEORIA o PRACTICA', 'Ejemplo': 'TEORIA' },
      { 'Columna': 'Nro. Matriculados', 'Obligatorio': 'SÍ', 'Descripción': 'Cantidad de alumnos inscritos', 'Ejemplo': '60' },
      { 'Columna': 'Docente', 'Obligatorio': 'NO (Opcional)', 'Descripción': 'Docente asignado. Dejar vacío si es vacante', 'Ejemplo': 'AMACHE SANCHEZ MILTON FREDDY' },
      { 'Columna': 'VBDA', 'Obligatorio': 'NO', 'Descripción': 'Visto bueno académico (SI/NO)', 'Ejemplo': 'SI' },
      { 'Columna': 'VBDG', 'Obligatorio': 'NO', 'Descripción': 'Visto bueno general (SI/NO)', 'Ejemplo': 'SI' },
      { 'Columna': 'Aprobado', 'Obligatorio': 'NO', 'Descripción': 'Aprobación oficial (SI/NO)', 'Ejemplo': 'SI' },
      { 'Columna': 'Inicio', 'Obligatorio': 'SÍ', 'Descripción': 'Fecha de inicio (formato DD-MM-YYYY)', 'Ejemplo': '01-09-2026' },
      { 'Columna': 'Término', 'Obligatorio': 'SÍ', 'Descripción': 'Fecha de término (formato DD-MM-YYYY)', 'Ejemplo': '03-10-2026' },
      { 'Columna': 'Módulo', 'Obligatorio': 'NO (Opcional)', 'Descripción': 'Módulo modular (Set, Oct, Nov, Dic)', 'Ejemplo': 'Set' }
    ];

    const ws1 = XLSX.utils.json_to_sheet(sampleRows);
    const ws2 = XLSX.utils.json_to_sheet(instructions);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Plantilla_Grupos");
    XLSX.utils.book_append_sheet(wb, ws2, "Guia_Instrucciones");
    XLSX.writeFile(wb, "Plantilla_Importacion_Programacion_Academica.xlsx");

    showFeedback('Plantilla Excel de importación descargada con datos de ejemplo e instrucciones.', 'success');
  } catch (err) {
    console.error(err);
    alert('Error al generar plantilla: ' + err.message);
  }
}

/**
 * Exportar a CSV según la pestaña activa
 */
function exportMatrixCsv() {
  const activeTabEl = document.querySelector('#mainTab .nav-link.active');
  const tabId = activeTabEl ? activeTabEl.getAttribute('data-bs-target') : '#tab-matriz';

  if (tabId === '#tab-vacantes') {
    if (!analytics || analytics.vacancies.length === 0) return;
    let csv = "Modulo,Escuela,Ciclo,Curso,Seccion,Tipo,Matriculados,Inicio,Termino\n";
    analytics.vacancies.forEach(v => {
      csv += `"${v.modulo}","${v.escuela}",${v.ciclo},"${v.curso}","${v.seccion}","${v.tipo_grupo}",${v.matriculados},"${v.inicio}","${v.termino}"\n`;
    });
    downloadBlob(csv, "Reporte_Bolsa_Vacantes.csv", "text/csv;charset=utf-8;");
  } else if (tabId === '#tab-general') {
    exportGeneralCsv();
  } else {
    if (!analytics || analytics.teachers.length === 0) return;
    let csv = "Docente,Cursos Asignados,Escuelas,Set,Oct,Nov,Dic,Total Modulos,Estado,Aprobacion\n";
    analytics.teachers.forEach(t => {
      csv += `"${t.nombre}","${t.cursos}","${t.escuelas}",${t.modulos.Set > 0 ? 'SI' : 'NO'},${t.modulos.Oct > 0 ? 'SI' : 'NO'},${t.modulos.Nov > 0 ? 'SI' : 'NO'},${t.modulos.Dic > 0 ? 'SI' : 'NO'},${t.activeModulesCount},"${t.estadoText}","${t.todoAprobado ? 'APROBADO' : 'CON RECHAZOS'}"\n`;
    });
    downloadBlob(csv, "Reporte_Matriz_Modular_Docentes.csv", "text/csv;charset=utf-8;");
  }
}

/**
 * Exportar Base General a CSV
 */
function exportGeneralCsv() {
  if (filteredGroups.length === 0) return;
  let csv = "Escuela,Ciclo,Curso,Seccion,Tipo Grupo,Matriculados,Docente,VBDA,VBDG,Aprobado,Inicio,Termino,Modulo\n";
  filteredGroups.forEach(g => {
    csv += `"${g.escuela}",${g.ciclo},"${g.curso}","${g.seccion}","${g.tipo_grupo}",${g.matriculados},"${g.docente}","${g.vbda}","${g.vbdg}","${g.aprobado}","${g.inicio}","${g.termino}","${g.modulo}"\n`;
  });
  downloadBlob(csv, "Programacion_General_Grupos.csv", "text/csv;charset=utf-8;");
}

function showFeedback(message, type = 'info') {
  const alertEl = document.getElementById('uploadAlert');
  if (alertEl) {
    alertEl.className = `alert alert-${type} alert-dismissible fade show py-2 small mb-0`;
    alertEl.style.display = 'block';
    alertEl.innerHTML = `
      <span>${message}</span>
      <button type="button" class="btn-close py-2" onclick="this.parentElement.style.display='none';"></button>
    `;
  }
}

function downloadBlob(content, fileName, mimeType) {
  const blob = new Blob(["\ufeff" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
