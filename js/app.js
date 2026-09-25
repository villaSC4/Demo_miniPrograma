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
let allDocentes = [];
let allSupervisiones = [];
let allDirectorios = [];
let allCarpetas = [];
let activeDirectorioId = 'DIR-2026-02-IND';
let analytics = null;
let editModalInstance = null;
let newGroupModalInstance = null;
let importModalInstance = null;
let docenteModalInstance = null;
let supervisionModalInstance = null;
let supervisionDetailModalInstance = null;
let crearDirectorioModalInstance = null;
let supervisionCarpetaModalInstance = null;
let carpetaDetailModalInstance = null;
let pendingImportFilesData = [];
let isServerConnected = false;

// ==============================================================================
// OPTIMIZACIONES DE RENDIMIENTO: DEBOUNCE, ÍNDICES EN MEMORIA Y RENDER LAZY
// ==============================================================================
function debounce(func, wait = 180) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Índice O(1) para lookups inmediatos de grupos, ciclos y cursos por docente
const teacherIndex = new Map();

function rebuildTeacherIndex() {
  teacherIndex.clear();
  for (let i = 0; i < allGroups.length; i++) {
    const g = allGroups[i];
    const nom = (g.docente || '').trim().toUpperCase();
    if (!nom || nom === 'VACANTE' || nom === 'NAN' || nom === 'SIN DOCENTE') continue;
    if (!teacherIndex.has(nom)) {
      teacherIndex.set(nom, { groups: [], ciclos: new Set(), cursos: new Set() });
    }
    const entry = teacherIndex.get(nom);
    entry.groups.push(g);
    if (g.ciclo) entry.ciclos.add(g.ciclo);
    if (g.curso) entry.cursos.add(g.curso);
  }
}

// Control de renderizado inteligente (solo la pestaña activa para evitar lag)
const dirtyTabs = new Set(['matriz-tab', 'vacantes-tab', 'general-tab', 'auditoria-tab', 'directorio-tab', 'cursos-tab', 'supervision-tab', 'desempeno-tab']);

function getActiveTabId() {
  const activeBtn = document.querySelector('#mainTab .nav-link.active');
  return activeBtn ? activeBtn.id : 'matriz-tab';
}

function renderCurrentActiveTab(tabId = getActiveTabId()) {
  dirtyTabs.delete(tabId);
  switch (tabId) {
    case 'matriz-tab':
      renderMatrixTable();
      break;
    case 'vacantes-tab':
      renderVacanciesTable();
      break;
    case 'general-tab':
      renderGeneralTable();
      break;
    case 'auditoria-tab':
      renderAuditCards();
      break;
    case 'directorio-tab':
      renderDirectorio();
      break;
    case 'cursos-tab':
      renderCursosAnalisis();
      break;
    case 'supervision-tab':
      renderSupervisiones();
      break;
    case 'desempeno-tab':
      renderDesempeno();
      break;
  }
}

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

  const importModalEl = document.getElementById('importModal');
  if (importModalEl && typeof bootstrap !== 'undefined') {
    importModalInstance = new bootstrap.Modal(importModalEl);
  }

  const docenteModalEl = document.getElementById('modalDocente');
  if (docenteModalEl && typeof bootstrap !== 'undefined') {
    docenteModalInstance = new bootstrap.Modal(docenteModalEl);
  }

  const supervisionModalEl = document.getElementById('modalSupervision');
  if (supervisionModalEl && typeof bootstrap !== 'undefined') {
    supervisionModalInstance = new bootstrap.Modal(supervisionModalEl);
  }

  const supervisionDetailModalEl = document.getElementById('modalSupervisionDetail');
  if (supervisionDetailModalEl && typeof bootstrap !== 'undefined') {
    supervisionDetailModalInstance = new bootstrap.Modal(supervisionDetailModalEl);
  }

  const crearDirEl = document.getElementById('modalCrearDirectorio');
  if (crearDirEl && typeof bootstrap !== 'undefined') {
    crearDirectorioModalInstance = new bootstrap.Modal(crearDirEl);
  }

  const supCarpEl = document.getElementById('modalSupervisionCarpeta');
  if (supCarpEl && typeof bootstrap !== 'undefined') {
    supervisionCarpetaModalInstance = new bootstrap.Modal(supCarpEl);
  }

  const carpDetailEl = document.getElementById('modalCarpetaDetail');
  if (carpDetailEl && typeof bootstrap !== 'undefined') {
    carpetaDetailModalInstance = new bootstrap.Modal(carpDetailEl);
  }

  setupEventListeners();

  // Display logged-in user name
  const savedUser = sessionStorage.getItem('sga_user_name');
  if (savedUser) {
    const userNameEl = document.getElementById('navbarUserName');
    if (userNameEl) userNameEl.textContent = savedUser;
  }

  // Logout button
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    if (confirm('¿Desea cerrar sesión?')) {
      sessionStorage.removeItem('sga_logged_in');
      sessionStorage.removeItem('sga_user_name');
      sessionStorage.removeItem('sga_login_time');
      window.location.href = 'login.html';
    }
  });

  // Cargar datos iniciales con estrategia de persistencia física
  loadInitialData();
  loadDocentesAndSupervisiones();
});

/**
 * Realiza peticiones adaptativas a la API
 * Compatible con cPanel (raíz y subdirectorios), Apache mod_rewrite, PHP directo, Vercel y Python server
 */
async function callApi(endpoint, options = {}) {
  const pathname = window.location.pathname;
  const baseDir = pathname.substring(0, pathname.lastIndexOf('/'));
  const cleanBase = (baseDir === '/' || baseDir === '') ? '' : baseDir;

  // 1. Intentar ruta estándar limpia: /api/<endpoint>
  const urlClean = `${cleanBase}/api/${endpoint}`.replace(/\/+/g, '/');
  try {
    const res = await fetch(urlClean, options);
    if (res.ok) return res;
    // Si da 404 (ej. cPanel sin mod_rewrite), intentar con extensión .php directamente
    if (res.status === 404) {
      const urlPhp = `${cleanBase}/api/${endpoint}.php`.replace(/\/+/g, '/');
      const resPhp = await fetch(urlPhp, options);
      if (resPhp.ok) return resPhp;
    }
    return res;
  } catch (err) {
    try {
      const urlPhp = `${cleanBase}/api/${endpoint}.php`.replace(/\/+/g, '/');
      return await fetch(urlPhp, options);
    } catch (e) {
      throw err;
    }
  }
}

/**
 * Carga de datos iniciales:
 * 1. Intenta leer el archivo físico desde el servidor (callApi('grupos'))
 * 2. Si no hay servidor (modo estático), lee de LocalStorage
 * 3. Si es la primera vez, lee DEMO_GRUPOS_DATA
 */
async function loadInitialData() {
  try {
    const res = await callApi('grupos');
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

  // 2. Guardar en archivo físico en disco mediante la API REST (cPanel PHP, Python o Vercel)
  callApi('grupos', {
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

  // Selector de archivo Excel (uno o varios simultáneos)
  document.getElementById('excelFileInput')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  });

  // Zona Drag & Drop dentro del modal de importación
  const modalDropzone = document.getElementById('modalDropzone');
  if (modalDropzone) {
    modalDropzone.addEventListener('click', () => {
      document.getElementById('excelFileInput')?.click();
    });
    ['dragenter', 'dragover'].forEach(name => {
      modalDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        modalDropzone.classList.add('drag-active');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      modalDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        modalDropzone.classList.remove('drag-active');
      });
    });
    modalDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      modalDropzone.classList.remove('drag-active');
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFiles(Array.from(files));
      }
    });
  }

  // Tarjetas interactivas de selección de modo (Combinar o Reemplazar)
  document.getElementById('cardModeMerge')?.addEventListener('click', () => {
    const r = document.getElementById('radioModeMerge');
    if (r) r.checked = true;
    updateImportModeCards('MERGE');
  });

  document.getElementById('cardModeReplace')?.addEventListener('click', () => {
    const r = document.getElementById('radioModeReplace');
    if (r) r.checked = true;
    updateImportModeCards('REPLACE');
  });

  document.getElementById('radioModeMerge')?.addEventListener('change', () => updateImportModeCards('MERGE'));
  document.getElementById('radioModeReplace')?.addEventListener('change', () => updateImportModeCards('REPLACE'));

  // Botón de confirmación de importación en el modal
  document.getElementById('btnConfirmImport')?.addEventListener('click', confirmImport);

  // Soporte global de arrastrar y soltar archivos Excel en la ventana
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const excelFiles = Array.from(e.dataTransfer.files).filter(f => {
        const n = f.name.toLowerCase();
        return n.endsWith('.xlsx') || n.endsWith('.xls');
      });
      if (excelFiles.length > 0) {
        processFiles(excelFiles);
      }
    }
  });

  // Filtros Globales Prioritarios (con Debounce para tipeo instantáneo sin lag)
  document.getElementById('filterSearch')?.addEventListener('input', debounce(applyFilters, 180));
  document.getElementById('filterEscuela')?.addEventListener('change', applyFilters);
  document.getElementById('filterCiclo')?.addEventListener('change', applyFilters);
  document.getElementById('filterModulo')?.addEventListener('change', applyFilters);
  document.getElementById('filterDocente')?.addEventListener('change', applyFilters);
  document.getElementById('filterAprobacion')?.addEventListener('change', applyFilters);
  document.getElementById('btnResetFilters')?.addEventListener('click', resetFilters);

  // Filtros internos de la Matriz (Debounced)
  document.getElementById('matrixSearch')?.addEventListener('input', debounce(renderMatrixTable, 180));
  document.getElementById('matrixStatusFilter')?.addEventListener('change', renderMatrixTable);

  // Filtros internos de Vacantes
  document.getElementById('vacantModuleFilter')?.addEventListener('change', renderVacanciesTable);
  document.getElementById('vacantSchoolFilter')?.addEventListener('change', renderVacanciesTable);

  // Botones de exportación secundaria (CSV)
  document.getElementById('btnExportMatrixCsv')?.addEventListener('click', exportMatrixCsv);
  document.getElementById('btnExportGeneralCsv')?.addEventListener('click', exportGeneralCsv);

  // Guardar cambios en Modal de Asignación Docente
  document.getElementById('btnSaveModalChanges')?.addEventListener('click', saveModalChanges);

  // Eventos Módulo Directorio Docente (Debounced)
  document.getElementById('filterDirectorioCiclo')?.addEventListener('change', renderDirectorio);
  document.getElementById('filterDirectorioSearch')?.addEventListener('input', debounce(renderDirectorio, 180));
  document.getElementById('filterDirectorioEscuela')?.addEventListener('change', renderDirectorio);
  document.getElementById('filterDirectorioCondicion')?.addEventListener('change', renderDirectorio);
  document.getElementById('btnOpenNewDocenteModal')?.addEventListener('click', openNewDocenteModal);
  document.getElementById('formDocente')?.addEventListener('submit', handleSaveDocente);
  document.getElementById('btnExportDocentesExcel')?.addEventListener('click', exportDocentesExcel);

  // Eventos Módulo Análisis de Cursos y Carga Electiva (Debounced)
  document.getElementById('filterCursosSearch')?.addEventListener('input', debounce(renderCursosAnalisis, 180));
  document.getElementById('filterCursosTipo')?.addEventListener('change', renderCursosAnalisis);
  document.getElementById('filterCursosCiclo')?.addEventListener('change', renderCursosAnalisis);
  document.getElementById('btnExportCursosExcel')?.addEventListener('click', exportCursosExcel);

  // Eventos Módulo Supervisión Docente y Evaluación de Desempeño (Debounced)
  document.getElementById('btnOpenNewSupervisionModal')?.addEventListener('click', () => openNewSupervisionModal());
  document.getElementById('filterSupervisionSearch')?.addEventListener('input', debounce(renderSupervisiones, 180));
  document.getElementById('filterSupervisionNivel')?.addEventListener('change', renderSupervisiones);
  document.getElementById('formSupervision')?.addEventListener('submit', handleSaveSupervision);
  document.getElementById('supDocenteSelect')?.addEventListener('change', handleSupervisionDocenteChange);

  // Eventos de Gestión de Directorios (Apertura de Periodos / Ciclos)
  document.getElementById('btnOpenCrearDirectorioModal')?.addEventListener('click', openCrearDirectorioModal);
  document.getElementById('formCrearDirectorio')?.addEventListener('submit', handleSaveDirectorio);
  document.getElementById('selectDirectorioActivo')?.addEventListener('change', handleDirectorioChange);

  // Eventos de Supervisión de Carpetas Docentes (Portafolio Pedagógico) (Debounced)
  document.getElementById('btnOpenNuevaCarpetaModal')?.addEventListener('click', () => openNuevaCarpetaModal());
  document.getElementById('btnExportCarpetasExcel')?.addEventListener('click', exportCarpetasExcel);
  document.getElementById('filterCarpetasSearch')?.addEventListener('input', debounce(renderCarpetasTable, 180));
  document.getElementById('filterCarpetasCiclo')?.addEventListener('change', renderCarpetasTable);
  document.getElementById('filterCarpetasEstado')?.addEventListener('change', renderCarpetasTable);
  document.getElementById('carpDocenteSelect')?.addEventListener('change', handleCarpetaDocenteChange);
  document.getElementById('formSupervisionCarpeta')?.addEventListener('submit', handleSaveCarpeta);

  // Cálculo interactivo de cumplimiento al marcar/desmarcar items de la carpeta
  document.querySelectorAll('.carp-check').forEach(chk => {
    chk.addEventListener('change', calculateCarpetaCompliance);
  });

  // Botón superior de Calificar Desempeño
  document.getElementById('btnOpenCalificarDesempenoTop')?.addEventListener('click', () => openNewSupervisionModal());

  // Eventos Módulo Evaluación de Desempeño Docente (EDD 2026-2) (Debounced)
  document.getElementById('filterEddSearch')?.addEventListener('input', debounce(renderDesempeno, 180));
  document.getElementById('filterEddCiclo')?.addEventListener('change', renderDesempeno);
  document.getElementById('filterEddNivel')?.addEventListener('change', renderDesempeno);
  document.getElementById('btnExportEddExcel')?.addEventListener('click', exportEddExcel);

  // Botones interactivos de la rúbrica de supervisión / desempeño oficial F03
  document.querySelectorAll('.rubric-score-selector').forEach(sel => {
    sel.querySelectorAll('.rubric-score-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sel.querySelectorAll('.rubric-score-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const crit = sel.getAttribute('data-criterion') || sel.getAttribute('data-dimension');
        const max = sel.getAttribute('data-max') || (crit === 'crit7' ? 2 : 3);
        const score = parseInt(btn.getAttribute('data-score'), 10);
        const valEl = document.getElementById(`${crit}Value`);
        if (valEl) valEl.textContent = `${score} / ${max} pts`;
        calculateSupervisionTotal();
      });
    });
  });

  // Sincronización y Renderizado Lazy Inteligente de la pestaña activada
  document.getElementById('mainTab')?.addEventListener('shown.bs.tab', (e) => {
    const tabId = e.target.id;
    syncActiveAreaCard(tabId);
    if (dirtyTabs.has(tabId)) {
      renderCurrentActiveTab(tabId);
    }
  });
}


// Navegación directa desde los botones de área principales
window.navigateToArea = function(tabId) {
  const tabBtn = document.getElementById(tabId);
  if (tabBtn) {
    if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
      const tabTrigger = bootstrap.Tab.getOrCreateInstance(tabBtn);
      tabTrigger.show();
    } else {
      tabBtn.click();
    }
    syncActiveAreaCard(tabId);
    document.getElementById('mainTab')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

function syncActiveAreaCard(activeTabId) {
  document.querySelectorAll('.area-action-card').forEach(c => c.classList.remove('active'));
  const map = {
    'directorio-tab': '.area-card-directorio',
    'cursos-tab': '.area-card-cursos',
    'desempeno-tab': '.area-card-desempeno',
    'supervision-tab': '.area-card-supervision',
    'matriz-tab': '.area-card-matriz',
    'vacantes-tab': '.area-card-vacantes',
    'pau-tab': '.area-card-pau'
  };
  const selector = map[activeTabId];
  if (selector) {
    document.querySelector(selector)?.classList.add('active');
  }
}

/**
 * Restablecer datos a la base oficial de 128 grupos
 */
async function resetToOfficialBase() {
  const confirmMsg = '¿Desea restablecer los datos a la programación oficial base de 128 grupos?\n\nSe sobrescribirán las adiciones y modificaciones guardadas.';
  if (!confirm(confirmMsg)) return;

  showFeedback('Restableciendo base oficial...', 'info');

  try {
    await callApi('reset', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
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
 * Procesar uno o varios archivos Excel seleccionados o arrastrados
 */
async function processFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const validFiles = Array.from(fileList).filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.xlsx') || name.endsWith('.xls');
  });

  if (validFiles.length === 0) {
    showFeedback('Por favor selecciona archivos con formato Excel (.xlsx o .xls).', 'warning');
    return;
  }

  showFeedback(`Leyendo y analizando ${validFiles.length} archivo(s) Excel...`, 'info');

  const parsedResults = [];
  const errors = [];

  for (const file of validFiles) {
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const res = ExcelParser.parseWorkbook(buffer, file.name);
      parsedResults.push({
        fileName: file.name,
        fileSize: file.size,
        groups: res.groups,
        type: res.type,
        sheetsCount: res.sheetsCount || 1,
        summary: res.summary
      });
    } catch (err) {
      console.error(`Error procesando ${file.name}:`, err);
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  if (parsedResults.length === 0) {
    showFeedback('No se pudo procesar ningún archivo: ' + errors.join('; '), 'danger');
    return;
  }

  if (errors.length > 0) {
    showFeedback(`Advertencia en algunos archivos: ${errors.join('; ')}`, 'warning');
  }

  // Abrir modal interactivo para previsualizar y elegir modo de importación
  openImportModal(parsedResults);
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Error de lectura en disco.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Abrir Modal de Confirmación y Previsualización de Importación Multi-archivo
 */
function openImportModal(parsedResults) {
  if (parsedResults && parsedResults.length > 0) {
    const existingNames = new Set(pendingImportFilesData.map(p => p.fileName));
    const newOnes = parsedResults.filter(p => !existingNames.has(p.fileName));
    pendingImportFilesData = pendingImportFilesData.concat(newOnes.length > 0 ? newOnes : parsedResults);
  }

  const countEl = document.getElementById('importFilesCount');
  if (countEl) countEl.textContent = pendingImportFilesData.length;

  const totalGroups = pendingImportFilesData.reduce((acc, curr) => acc + curr.groups.length, 0);
  const badgeEl = document.getElementById('importTotalGroupsBadge');
  if (badgeEl) badgeEl.textContent = `${totalGroups} grupos en total`;

  const listEl = document.getElementById('importFilesList');
  if (listEl) {
    listEl.innerHTML = pendingImportFilesData.map((p, idx) => {
      const sizeKb = Math.round(p.fileSize / 1024);
      return `
        <div class="list-group-item d-flex justify-content-between align-items-center py-2 px-2.5">
          <div class="d-flex align-items-center gap-2 text-truncate" style="max-width: 75%;">
            <i class="bi bi-file-earmark-excel text-success fs-5"></i>
            <div class="text-truncate">
              <div class="fw-semibold text-dark text-truncate" style="font-size: 0.82rem;" title="${p.fileName}">${p.fileName}</div>
              <small class="text-muted" style="font-size: 0.72rem;">${sizeKb} KB • ${p.sheetsCount} hoja(s) procesada(s)</small>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-light text-dark border fw-semibold" style="font-size: 0.74rem;">
              ${p.groups.length} grupos
            </span>
            <button type="button" class="btn btn-outline-danger btn-sm p-0 px-1.5 border-0" title="Quitar archivo" onclick="removePendingFile(${idx})">
              <i class="bi bi-x fs-6"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  const radioMerge = document.getElementById('radioModeMerge');
  if (radioMerge) radioMerge.checked = true;
  updateImportModeCards('MERGE');

  if (importModalInstance) {
    importModalInstance.show();
  }
}

/**
 * Quitar un archivo de la lista de importación pendiente
 */
function removePendingFile(index) {
  pendingImportFilesData.splice(index, 1);
  if (pendingImportFilesData.length === 0) {
    if (importModalInstance) importModalInstance.hide();
    return;
  }
  openImportModal([]);
}

/**
 * Actualizar visualmente las tarjetas de selección de modo
 */
function updateImportModeCards(mode) {
  const cardMerge = document.getElementById('cardModeMerge');
  const cardReplace = document.getElementById('cardModeReplace');
  if (cardMerge && cardReplace) {
    cardMerge.classList.toggle('selected', mode === 'MERGE');
    cardReplace.classList.toggle('selected', mode === 'REPLACE');
  }
}

/**
 * Confirmar Importación y Aplicar Cambios
 */
function confirmImport() {
  if (!pendingImportFilesData || pendingImportFilesData.length === 0) return;

  const mode = document.querySelector('input[name="importModeRadio"]:checked')?.value || 'MERGE';
  
  let incomingGroups = [];
  pendingImportFilesData.forEach(p => {
    incomingGroups = incomingGroups.concat(p.groups);
  });

  const filesCount = pendingImportFilesData.length;
  const filesLabel = filesCount === 1 
    ? pendingImportFilesData[0].fileName 
    : `${filesCount} archivos combinados`;

  if (mode === 'REPLACE') {
    const deduplicated = deduplicateGroups(incomingGroups);
    loadDataset(deduplicated, `${filesLabel} (${deduplicated.length} registros)`);
    persistGroups(true, `Programación reemplazada con ${deduplicated.length} grupos de ${filesCount} archivo(s).`);
  } else {
    const { merged, addedCount, updatedCount } = mergeWithExistingGroups(allGroups, incomingGroups);
    loadDataset(merged, `${filesLabel} (+${addedCount} nuevos, ${merged.length} totales)`);
    persistGroups(true, `Importación combinada: +${addedCount} grupos nuevos, ${updatedCount} actualizados (${merged.length} totales).`);
  }

  if (importModalInstance) {
    importModalInstance.hide();
  }
  pendingImportFilesData = [];
}

/**
 * Firma única para reconocer un grupo académico sin ambigüedad
 */
function getGroupSignature(g) {
  const esc = (g.escuela || '').trim().toUpperCase();
  const cur = (g.curso || '').trim().toUpperCase();
  const cic = String(g.ciclo || 0).trim();
  const sec = (g.seccion || '').trim().toUpperCase();
  const mod = (g.modulo || '').trim().toUpperCase();
  const tip = (g.tipo_grupo || '').trim().toUpperCase();
  return `${esc}|${cur}|${cic}|${sec}|${mod}|${tip}`;
}

/**
 * Eliminar duplicados entre grupos
 */
function deduplicateGroups(groups) {
  const map = new Map();
  groups.forEach(g => {
    const sig = getGroupSignature(g);
    if (!map.has(sig)) {
      map.set(sig, { ...g });
    } else {
      const cur = map.get(sig);
      if (!cur.docente && g.docente) {
        map.set(sig, { ...cur, ...g });
      }
    }
  });
  return Array.from(map.values()).map((g, idx) => ({ ...g, id: idx }));
}

/**
 * Fusionar con grupos existentes
 */
function mergeWithExistingGroups(existing, incoming) {
  const map = new Map();
  existing.forEach(g => {
    map.set(getGroupSignature(g), { ...g });
  });

  let addedCount = 0;
  let updatedCount = 0;

  incoming.forEach(ng => {
    const sig = getGroupSignature(ng);
    if (map.has(sig)) {
      const ex = map.get(sig);
      map.set(sig, {
        ...ex,
        matriculados: ng.matriculados || ex.matriculados,
        docente: ng.docente || ex.docente,
        vbda: ng.vbda || ex.vbda,
        vbdg: ng.vbdg || ex.vbdg,
        aprobado: ng.aprobado || ex.aprobado,
        inicio: ng.inicio || ex.inicio,
        termino: ng.termino || ex.termino
      });
      updatedCount++;
    } else {
      map.set(sig, { ...ng });
      addedCount++;
    }
  });

  const merged = Array.from(map.values()).map((g, idx) => ({ ...g, id: idx }));
  return { merged, addedCount, updatedCount };
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

  // Reconstruir índice en memoria para lookups instantáneos O(1)
  rebuildTeacherIndex();

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
 * Aplicar Filtros Globales y Recalcular (Optimizado con Lazy Rendering a 60fps)
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

  // Renderizar KPIs y contadores globales
  renderKPIs();
  updateTabBadges();

  // Invalidar caché de las demás pestañas para que se rendericen al abrirlas
  ['matriz-tab', 'vacantes-tab', 'general-tab', 'auditoria-tab', 'directorio-tab', 'cursos-tab', 'supervision-tab', 'desempeno-tab'].forEach(t => dirtyTabs.add(t));

  // Renderizar ÚNICAMENTE la pestaña activa visible en pantalla (0% lag en pestañas ocultas)
  renderCurrentActiveTab();
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

  const badgeDirectorio = document.getElementById('badgeTabDirectorio');
  if (badgeDirectorio) badgeDirectorio.textContent = allDocentes.length;

  const badgeCursos = document.getElementById('badgeTabCursos');
  if (badgeCursos) {
    const uniqueCourses = new Set(allGroups.map(g => (g.curso || '').trim().toUpperCase()).filter(Boolean));
    badgeCursos.textContent = uniqueCourses.size;
  }

  const badgeSupervision = document.getElementById('badgeTabSupervision');
  if (badgeSupervision) badgeSupervision.textContent = allCarpetas.length + allSupervisiones.length;

  // Actualizar también los badges de los botones de áreas superiores
  const bAreaDir = document.getElementById('badgeAreaDirectorio');
  if (bAreaDir) bAreaDir.textContent = `${allDocentes.length} Docentes`;

  const bAreaCur = document.getElementById('badgeAreaCursos');
  if (bAreaCur) {
    const uniqueCourses = new Set(allGroups.map(g => (g.curso || '').trim().toUpperCase()).filter(Boolean));
    bAreaCur.textContent = `${uniqueCourses.size} Cursos`;
  }

  const bAreaSup = document.getElementById('badgeAreaSupervision');
  if (bAreaSup) bAreaSup.textContent = `${allCarpetas.length} Carpetas`;

  const bAreaMat = document.getElementById('badgeAreaMatriz');
  if (bAreaMat) bAreaMat.textContent = `${allGroups.length} Grupos`;

  const bAreaVac = document.getElementById('badgeAreaVacantes');
  if (bAreaVac) bAreaVac.textContent = `${analytics.vacancies.length} Vacantes`;

  const badgeDesempeno = document.getElementById('badgeTabDesempeno');
  if (badgeDesempeno) badgeDesempeno.textContent = allSupervisiones.length;

  const bAreaDes = document.getElementById('badgeAreaDesempeno');
  if (bAreaDes) bAreaDes.textContent = `${allSupervisiones.length} Evaluados`;
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
  if (elCompletos) elCompletos.textContent = allDocentes.length || kpis.totalDocentes;

  const elIncompletos = document.getElementById('kpiDocentesIncompletos');
  if (elIncompletos) elIncompletos.textContent = `${kpis.docentesIncompletos} docentes`;

  const elVacantes = document.getElementById('kpiGruposVacantes') || document.getElementById('kpiVacantes');
  if (elVacantes) elVacantes.textContent = kpis.vacantes;

  const elAfectados = document.getElementById('kpiAlumnosAfectados');
  if (elAfectados) elAfectados.textContent = `(${kpis.alumnosAfectados.toLocaleString()} alumnos)`;
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

  const formatMod = (val) => {
    if (val > 0) {
      return `<span class="badge-status-dot dot-complete" title="${val} grupo(s) en este mes"><i class="bi bi-check2"></i></span>`;
    } else {
      return `<span class="badge-status-dot dot-empty" title="Sin carga en este mes"><i class="bi bi-dash"></i></span>`;
    }
  };

  let rowsHtml = '';
  list.forEach((t, idx) => {
    const estadoBadge = t.activeModulesCount === 4
      ? `<span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle py-1 px-2.5">Completo (4/4)</span>`
      : `<span class="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle py-1 px-2.5">Incompleto (${t.activeModulesCount}/4)</span>`;

    const aprobacionBadge = t.todoAprobado
      ? `<span class="badge rounded-pill bg-success text-white py-1 px-2">Aprobado</span>`
      : `<span class="badge rounded-pill bg-danger text-white py-1 px-2" title="Posee cursos con VBDA/VBDG = NO">Observado</span>`;

    const cDetalle = (t.cursosDetalle && t.cursosDetalle.length > 0)
      ? t.cursosDetalle
      : [{
          nombre: t.cursos || 'ASIGNATURA ASIGNADA',
          escuelas: t.escuelas,
          ciclos: '',
          modulos: t.modulos,
          activeModulesCount: t.activeModulesCount,
          grupos: t.totalGrupos
        }];

    const numCourses = cDetalle.length;

    cDetalle.forEach((cd, cIdx) => {
      rowsHtml += `<tr class="${numCourses > 1 && cIdx < numCourses - 1 ? 'border-bottom-0' : ''}">`;

      // Columna Docente e Índice agrupadas con rowspan
      if (cIdx === 0) {
        const subtext = numCourses > 1 
          ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle py-0.5 px-1.5 fw-semibold" style="font-size: 0.71rem;"><i class="bi bi-collection me-1"></i>${numCourses} asignaturas</span>`
          : `<small class="text-muted" style="font-size: 0.74rem;">${t.escuelas}</small>`;

        rowsHtml += `
          <td class="text-muted small text-center align-middle" rowspan="${numCourses}" style="background-color: #FAFCFE; border-right: 1px solid #EEF2F6;">${idx + 1}</td>
          <td class="align-middle" rowspan="${numCourses}" style="background-color: #FAFCFE; border-right: 1px solid #EEF2F6;">
            <div class="fw-bold text-dark">${t.nombre}</div>
            ${subtext}
          </td>
        `;
      }

      // Información específica de la Asignatura
      const cicloBadge = cd.ciclos ? `<span class="badge bg-light text-secondary border py-0.5 px-1.5 ms-1" style="font-size: 0.7rem;">Ciclo ${cd.ciclos}</span>` : '';
      const gruposText = cd.grupos ? ` • ${cd.grupos} grupo(s)` : '';

      rowsHtml += `
        <td class="align-middle py-2">
          <div class="fw-semibold text-dark" style="font-size: 0.85rem;">
            ${numCourses > 1 ? '<i class="bi bi-arrow-return-right text-primary me-1.5"></i>' : ''}${cd.nombre}
            ${cicloBadge}
          </div>
          <small class="text-muted" style="font-size: 0.73rem;">${cd.escuelas}${gruposText}</small>
        </td>
        <td class="text-center align-middle">${formatMod(cd.modulos.Set)}</td>
        <td class="text-center align-middle">${formatMod(cd.modulos.Oct)}</td>
        <td class="text-center align-middle">${formatMod(cd.modulos.Nov)}</td>
        <td class="text-center align-middle">${formatMod(cd.modulos.Dic)}</td>
        <td class="text-center align-middle fw-bold fs-6">${cd.activeModulesCount} <span class="text-muted" style="font-size: 0.72rem;">/ 4</span></td>
      `;

      // Estado y Aprobación consolidados del Docente
      if (cIdx === 0) {
        rowsHtml += `
          <td class="text-center align-middle" rowspan="${numCourses}" style="background-color: #FAFCFE; border-left: 1px solid #EEF2F6;">
            ${estadoBadge}
            ${numCourses > 1 ? `<div class="text-muted small mt-1 fw-semibold" style="font-size: 0.72rem;">Carga Total: ${t.activeModulesCount}/4</div>` : ''}
          </td>
          <td class="text-center align-middle" rowspan="${numCourses}" style="background-color: #FAFCFE;">${aprobacionBadge}</td>
        `;
      }

      rowsHtml += `</tr>`;
    });
  });

  tbody.innerHTML = rowsHtml;
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
    let csv = "Docente,Asignatura,Escuelas,Ciclo,Set,Oct,Nov,Dic,Meses Asignatura,Total Docente,Estado,Aprobacion\n";
    analytics.teachers.forEach(t => {
      if (t.cursosDetalle && t.cursosDetalle.length > 0) {
        t.cursosDetalle.forEach(cd => {
          csv += `"${t.nombre}","${cd.nombre}","${cd.escuelas}","${cd.ciclos}",${cd.modulos.Set > 0 ? 'SI' : 'NO'},${cd.modulos.Oct > 0 ? 'SI' : 'NO'},${cd.modulos.Nov > 0 ? 'SI' : 'NO'},${cd.modulos.Dic > 0 ? 'SI' : 'NO'},${cd.activeModulesCount},${t.activeModulesCount},"${t.estadoText}","${t.todoAprobado ? 'APROBADO' : 'OBSERVADO'}"\n`;
        });
      } else {
        csv += `"${t.nombre}","${t.cursos}","${t.escuelas}","",${t.modulos.Set > 0 ? 'SI' : 'NO'},${t.modulos.Oct > 0 ? 'SI' : 'NO'},${t.modulos.Nov > 0 ? 'SI' : 'NO'},${t.modulos.Dic > 0 ? 'SI' : 'NO'},${t.activeModulesCount},${t.activeModulesCount},"${t.estadoText}","${t.todoAprobado ? 'APROBADO' : 'OBSERVADO'}"\n`;
      }
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

/* ==============================================================================
   MÓDULO 1: DIRECTORIO DOCENTE (SEGMENTADO POR CICLO)
   ============================================================================== */

async function loadDocentesAndSupervisiones() {
  // Carga concurrente paralela de todos los recursos (0ms de bloqueo secuencial)
  const [resDoc, resDir, resCarp, resSup] = await Promise.allSettled([
    callApi('docentes'),
    callApi('directorios'),
    callApi('carpetas'),
    callApi('supervisiones')
  ]);

  if (resDoc.status === 'fulfilled' && resDoc.value && resDoc.value.ok) {
    try {
      const data = await resDoc.value.json();
      if (Array.isArray(data) && data.length > 0) allDocentes = data;
    } catch (e) {}
  }

  if (resDir.status === 'fulfilled' && resDir.value && resDir.value.ok) {
    try {
      const data = await resDir.value.json();
      if (Array.isArray(data) && data.length > 0) allDirectorios = data;
    } catch (e) {}
  }

  if (resCarp.status === 'fulfilled' && resCarp.value && resCarp.value.ok) {
    try {
      const data = await resCarp.value.json();
      if (Array.isArray(data) && data.length > 0) allCarpetas = data;
    } catch (e) {}
  }

  if (resSup.status === 'fulfilled' && resSup.value && resSup.value.ok) {
    try {
      const data = await resSup.value.json();
      if (Array.isArray(data) && data.length > 0) allSupervisiones = data;
    } catch (e) {}
  }

  // Si no hay docentes en backend, sincronizar de allGroups
  if (allDocentes.length === 0 && allGroups.length > 0) {
    syncDocentesFromGroups();
  }

  renderDirectoriosDropdown();
  populateCarpetasDocenteSelect();
  updateTabBadges();

  // Marcar todas las pestañas como listas y renderizar de inmediato la visible
  ['matriz-tab', 'vacantes-tab', 'general-tab', 'auditoria-tab', 'directorio-tab', 'cursos-tab', 'supervision-tab', 'desempeno-tab'].forEach(t => dirtyTabs.add(t));
  renderCurrentActiveTab();
}


function syncDocentesFromGroups() {
  const map = {};
  allGroups.forEach(g => {
    const nom = (g.docente || '').trim().toUpperCase();
    if (!nom || nom === 'VACANTE') return;
    if (!map[nom]) {
      const parts = nom.split(' ');
      const userPart = parts[0].toLowerCase() + (parts[2] ? parts[2][0].toLowerCase() : 'd');
      map[nom] = {
        id: Object.keys(map).length + 1,
        nombre: nom,
        email: `${userPart}@ucvvirtual.edu.pe`,
        telefono: '9' + Math.floor(10000000 + Math.random() * 89999999),
        escuela: g.escuela || 'INGENIERIA DE SISTEMAS',
        condicion: (Object.keys(map).length % 2 === 0) ? 'CONTRATADO' : 'ORDINARIO',
        categoria: (Object.keys(map).length % 3 === 0) ? 'ASOCIADO' : 'AUXILIAR',
        grado: (Object.keys(map).length % 4 === 0) ? 'DOCTOR' : 'MAGÍSTER',
        ciclos: [g.ciclo].filter(Boolean),
        cursos: [g.curso].filter(Boolean)
      };
    } else {
      if (g.ciclo && !map[nom].ciclos.includes(g.ciclo)) map[nom].ciclos.push(g.ciclo);
      if (g.curso && !map[nom].cursos.includes(g.curso)) map[nom].cursos.push(g.curso);
    }
  });

  allDocentes = Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Persistir en backend
  callApi('docentes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(allDocentes)
  }).catch(() => {});
}

function renderDirectorio() {
  const grid = document.getElementById('directorioGrid');
  if (!grid) return;

  const ciclo = document.getElementById('filterDirectorioCiclo')?.value || 'ALL';
  const search = (document.getElementById('filterDirectorioSearch')?.value || '').toLowerCase().trim();
  const escuela = document.getElementById('filterDirectorioEscuela')?.value || 'ALL';
  const condicion = document.getElementById('filterDirectorioCondicion')?.value || 'ALL';

  if (allDocentes.length === 0 && allGroups.length > 0) {
    syncDocentesFromGroups();
  }

  const filtered = allDocentes.filter(d => {
    const cached = teacherIndex.get(d.nombre) || { groups: [], ciclos: new Set(), cursos: new Set() };
    const assignedCiclos = Array.from(new Set([...cached.ciclos, ...(d.ciclos || [])])).sort((a, b) => a - b);
    const assignedCursos = Array.from(new Set([...cached.cursos, ...(d.cursos || [])]));

    if (ciclo !== 'ALL' && !assignedCiclos.map(String).includes(String(ciclo))) {
      return false;
    }

    if (search) {
      const matchText = `${d.nombre} ${d.email} ${d.telefono} ${d.escuela} ${assignedCursos.join(' ')}`.toLowerCase();
      if (!matchText.includes(search)) return false;
    }

    if (escuela !== 'ALL' && d.escuela !== escuela) return false;
    if (condicion !== 'ALL' && d.condicion !== condicion) return false;

    return true;
  });

  const statsEl = document.getElementById('directorioStatsText');
  if (statsEl) {
    statsEl.textContent = `Mostrando ${filtered.length} de ${allDocentes.length} docentes ${ciclo !== 'ALL' ? `(Ciclo ${ciclo})` : '(Todos los ciclos)'}`;
  }

  const badgeDirectorio = document.getElementById('badgeTabDirectorio');
  if (badgeDirectorio) badgeDirectorio.textContent = allDocentes.length;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5 bg-light rounded-3 border">
        <i class="bi bi-people text-muted fs-1 d-block mb-2"></i>
        <h6 class="fw-bold text-dark">No se encontraron docentes con los filtros aplicados</h6>
        <p class="text-muted small mb-0">Prueba cambiando el ciclo o el término de búsqueda.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(d => {
    const initials = d.nombre.split(' ').slice(0, 2).map(n => n[0] || '').join('');
    const cached = teacherIndex.get(d.nombre) || { groups: [], ciclos: new Set(), cursos: new Set() };
    const assignedCiclos = Array.from(new Set([...cached.ciclos, ...(d.ciclos || [])])).sort((a, b) => a - b);
    const assignedCursos = Array.from(new Set([...cached.cursos, ...(d.cursos || [])]));

    const cicloBadges = assignedCiclos.map(c => `<span class="badge-cycle-tag">Ciclo ${c}</span>`).join('') || '<span class="text-muted small">Sin ciclo</span>';
    const cursosHtml = assignedCursos.slice(0, 2).map(c => `<span class="badge bg-light text-dark border me-1 mb-1 text-truncate d-inline-block" style="max-width: 180px; font-size: 0.72rem;">${c}</span>`).join('');
    const moreCursos = assignedCursos.length > 2 ? `<span class="badge bg-secondary-subtle text-secondary" style="font-size: 0.7rem;">+${assignedCursos.length - 2} más</span>` : '';

    return `
      <div class="teacher-card shadow-sm">
        <div>
          <div class="teacher-header">
            <div class="teacher-avatar">${initials}</div>
            <div class="teacher-info flex-grow-1 text-truncate">
              <h6 class="text-truncate" title="${d.nombre}">${d.nombre}</h6>
              <div class="d-flex align-items-center gap-1 flex-wrap mb-1">
                <span class="badge ${d.condicion === 'ORDINARIO' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-secondary border'} px-2 py-0.5" style="font-size: 0.68rem;">${d.condicion}</span>
                <span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-0.5" style="font-size: 0.68rem;">${d.grado || 'MAGÍSTER'}</span>
                <span class="badge bg-light text-muted border px-1.5 py-0.5" style="font-size: 0.68rem;">${d.categoria || 'ASOCIADO'}</span>
              </div>
            </div>
          </div>

          <div class="teacher-detail-item">
            <i class="bi bi-building"></i>
            <span class="text-truncate">${d.escuela || 'INGENIERIA DE SISTEMAS'}</span>
          </div>
          <div class="teacher-detail-item">
            <i class="bi bi-envelope"></i>
            <span class="text-truncate"><a href="mailto:${d.email}" class="text-decoration-none text-muted">${d.email}</a></span>
          </div>
          <div class="teacher-detail-item">
            <i class="bi bi-telephone"></i>
            <span>${d.telefono || '987654321'}</span>
          </div>

          <div class="mt-2 pt-2 border-top">
            <small class="text-muted d-block fw-semibold mb-1" style="font-size: 0.7rem;">CICLOS ASIGNADOS:</small>
            <div>${cicloBadges}</div>
          </div>

          <div class="mt-1.5">
            <small class="text-muted d-block fw-semibold mb-1" style="font-size: 0.7rem;">ASIGNATURAS (${assignedCursos.length}):</small>
            <div class="d-flex flex-wrap align-items-center">${cursosHtml} ${moreCursos}</div>
          </div>
        </div>

        <div class="mt-3 pt-2.5 border-top d-flex gap-2">
          <button type="button" class="btn btn-outline-primary btn-sm flex-fill py-1 fw-semibold" style="font-size: 0.75rem;" onclick="openEditDocenteModal(${d.id})">
            <i class="bi bi-pencil-square me-1"></i> Ficha
          </button>
          <button type="button" class="btn btn-warning btn-sm flex-fill py-1 fw-bold text-dark" style="font-size: 0.75rem;" onclick="openNewSupervisionModal('${d.nombre.replace(/'/g, "\\'")}')" title="Calificar Desempeño en Aula con Formato Oficial F03">
            <i class="bi bi-award-fill me-1"></i> Calificar
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openNewDocenteModal() {
  document.getElementById('modalDocenteTitle').textContent = 'Registrar Nuevo Docente en Directorio';
  document.getElementById('docenteEditId').value = '';
  document.getElementById('formDocente').reset();
  document.querySelectorAll('.ciclo-chk').forEach(c => c.checked = false);
  if (docenteModalInstance) docenteModalInstance.show();
}

function openEditDocenteModal(id) {
  const d = allDocentes.find(doc => doc.id === id);
  if (!d) return;

  document.getElementById('modalDocenteTitle').textContent = `Editar Docente: ${d.nombre}`;
  document.getElementById('docenteEditId').value = d.id;
  document.getElementById('docenteNombre').value = d.nombre;
  document.getElementById('docenteDni').value = d.dni || '';
  document.getElementById('docenteEmail').value = d.email || '';
  document.getElementById('docenteTelefono').value = d.telefono || '';
  document.getElementById('docenteEscuela').value = d.escuela || 'INGENIERIA DE SISTEMAS';
  document.getElementById('docenteGrado').value = d.grado || 'MAGÍSTER';
  document.getElementById('docenteCondicion').value = d.condicion || 'CONTRATADO';
  document.getElementById('docenteCategoria').value = d.categoria || 'ASOCIADO';

  const teacherGroups = allGroups.filter(g => (g.docente || '').trim().toUpperCase() === d.nombre);
  const assignedCiclos = Array.from(new Set(teacherGroups.map(g => g.ciclo).concat(d.ciclos || []).filter(Boolean))).map(String);

  document.querySelectorAll('.ciclo-chk').forEach(chk => {
    chk.checked = assignedCiclos.includes(chk.value);
  });

  if (docenteModalInstance) docenteModalInstance.show();
}

async function handleSaveDocente(e) {
  e.preventDefault();
  const editId = document.getElementById('docenteEditId').value;
  const nombre = document.getElementById('docenteNombre').value.trim().toUpperCase();
  const email = document.getElementById('docenteEmail').value.trim();

  if (!nombre || !email) {
    alert('Por favor complete los campos obligatorios.');
    return;
  }

  const selectedCiclos = Array.from(document.querySelectorAll('.ciclo-chk:checked')).map(c => parseInt(c.value, 10));

  if (editId) {
    const idx = allDocentes.findIndex(d => String(d.id) === String(editId));
    if (idx !== -1) {
      allDocentes[idx] = {
        ...allDocentes[idx],
        nombre,
        dni: document.getElementById('docenteDni').value.trim(),
        email,
        telefono: document.getElementById('docenteTelefono').value.trim(),
        escuela: document.getElementById('docenteEscuela').value,
        grado: document.getElementById('docenteGrado').value,
        condicion: document.getElementById('docenteCondicion').value,
        categoria: document.getElementById('docenteCategoria').value,
        ciclos: selectedCiclos
      };
    }
  } else {
    const newDoc = {
      id: allDocentes.length > 0 ? Math.max(...allDocentes.map(d => d.id || 0)) + 1 : 1,
      nombre,
      dni: document.getElementById('docenteDni').value.trim(),
      email,
      telefono: document.getElementById('docenteTelefono').value.trim(),
      escuela: document.getElementById('docenteEscuela').value,
      grado: document.getElementById('docenteGrado').value,
      condicion: document.getElementById('docenteCondicion').value,
      categoria: document.getElementById('docenteCategoria').value,
      ciclos: selectedCiclos,
      cursos: []
    };
    allDocentes.unshift(newDoc);
  }

  try {
    await callApi('docentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allDocentes)
    });
  } catch (err) {
    console.warn('Error guardando en API docentes:', err);
  }

  if (docenteModalInstance) docenteModalInstance.hide();
  renderDirectorio();
  updateTabBadges();
  showFeedback(`Docente ${nombre} guardado exitosamente en el directorio.`, 'success');
}

function exportDocentesExcel() {
  if (allDocentes.length === 0) {
    alert('No hay docentes para exportar.');
    return;
  }

  const ciclo = document.getElementById('filterDirectorioCiclo')?.value || 'ALL';
  const rows = allDocentes.map(d => {
    const teacherGroups = allGroups.filter(g => (g.docente || '').trim().toUpperCase() === d.nombre);
    const assignedCiclos = Array.from(new Set(teacherGroups.map(g => g.ciclo).concat(d.ciclos || []).filter(Boolean))).sort((a,b)=>a-b);
    const assignedCursos = Array.from(new Set(teacherGroups.map(g => g.curso).concat(d.cursos || []).filter(Boolean)));

    return {
      'Apellidos y Nombres': d.nombre,
      'DNI / Código': d.dni || '',
      'Correo Institucional': d.email,
      'Teléfono / Celular': d.telefono || '',
      'Escuela Profesional': d.escuela,
      'Grado Académico': d.grado,
      'Condición': d.condicion,
      'Categoría': d.categoria,
      'Ciclos en que dicta': assignedCiclos.map(c => `Ciclo ${c}`).join(', '),
      'Cursos Asignados': assignedCursos.join('; '),
      'Total Cursos': assignedCursos.length,
      'Total Grupos': teacherGroups.length
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Directorio_Docentes");
  const fileName = ciclo !== 'ALL' ? `Directorio_Docentes_Ciclo_${ciclo}.xlsx` : `Directorio_Docentes_General_UCV.xlsx`;
  XLSX.writeFile(wb, fileName);
  showFeedback(`Directorio de docentes exportado correctamente (${fileName}).`, 'success');
}

/* ==============================================================================
   MÓDULO 2: ANÁLISIS DE CURSOS Y CARGA ELECTIVA
   ============================================================================== */

function isCursoElectivo(cursoName) {
  const norm = (cursoName || '').toUpperCase();
  return norm.includes('ELECTIV') || 
         norm.includes('TALLER') || 
         norm.includes('PROYECTO INTEGRADOR') || 
         norm.includes('COMPLEMENTARI') ||
         norm.includes('ACTIVIDADES');
}

function renderCursosAnalisis() {
  const tbody = document.getElementById('cursosTableBody');
  if (!tbody) return;

  const search = (document.getElementById('filterCursosSearch')?.value || '').toLowerCase().trim();
  const tipo = document.getElementById('filterCursosTipo')?.value || 'ALL';
  const ciclo = document.getElementById('filterCursosCiclo')?.value || 'ALL';

  const courseMap = {};
  allGroups.forEach(g => {
    const curName = (g.curso || '').trim().toUpperCase();
    if (!curName) return;

    if (!courseMap[curName]) {
      courseMap[curName] = {
        nombre: curName,
        escuela: g.escuela || 'INGENIERIA DE SISTEMAS',
        ciclo: g.ciclo || 1,
        isElectivo: isCursoElectivo(curName),
        gruposTeoria: 0,
        gruposPractica: 0,
        totalGrupos: 0,
        totalAlumnos: 0,
        docentes: new Set(),
        vacantesCount: 0
      };
    }

    const c = courseMap[curName];
    c.totalGrupos++;
    c.totalAlumnos += (g.matriculados || 0);
    if ((g.tipo_grupo || '').toUpperCase() === 'TEORIA') c.gruposTeoria++;
    if ((g.tipo_grupo || '').toUpperCase() === 'PRACTICA') c.gruposPractica++;

    const doc = (g.docente || '').trim().toUpperCase();
    if (doc && doc !== 'VACANTE') {
      c.docentes.add(doc);
    } else {
      c.vacantesCount++;
    }
  });

  const courseList = Object.values(courseMap).sort((a, b) => a.ciclo - b.ciclo || a.nombre.localeCompare(b.nombre));

  const totalCursosEl = document.getElementById('kpiTotalCursos');
  if (totalCursosEl) totalCursosEl.textContent = courseList.length;

  const electivosCount = courseList.filter(c => c.isElectivo).length;
  const electivosEl = document.getElementById('kpiCursosElectivos');
  if (electivosEl) electivosEl.textContent = electivosCount;

  const obligatoriosEl = document.getElementById('kpiCursosObligatorios');
  if (obligatoriosEl) obligatoriosEl.textContent = courseList.length - electivosCount;

  const vacantesCount = courseList.filter(c => c.vacantesCount > 0).length;
  const vacantesEl = document.getElementById('kpiCursosVacantes');
  if (vacantesEl) vacantesEl.textContent = vacantesCount;

  const badgeCursos = document.getElementById('badgeTabCursos');
  if (badgeCursos) badgeCursos.textContent = courseList.length;

  const filtered = courseList.filter(c => {
    if (search && !c.nombre.toLowerCase().includes(search) && !c.escuela.toLowerCase().includes(search)) {
      return false;
    }
    if (tipo === 'OBLIGATORIO' && c.isElectivo) return false;
    if (tipo === 'ELECTIVO' && !c.isElectivo) return false;
    if (ciclo !== 'ALL' && String(c.ciclo) !== String(ciclo)) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted small">
          No se encontraron asignaturas con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((c, idx) => {
    const docentesArray = Array.from(c.docentes);
    const docentesBadges = docentesArray.length > 0 
      ? docentesArray.map(d => `<span class="badge bg-light text-dark border me-1 mb-1" style="font-size: 0.72rem;">${d}</span>`).join('')
      : '<span class="text-danger small fst-italic">Sin docentes asignados</span>';

    const coverageBadge = c.vacantesCount === 0
      ? '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-check2-all me-1"></i> 100% Cubierto</span>'
      : `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1"><i class="bi bi-exclamation-triangle me-1"></i> ${c.vacantesCount} Vacante(s)</span>`;

    const tipoBadge = c.isElectivo
      ? '<span class="badge badge-electivo"><i class="bi bi-stars me-1"></i> Carga Electiva</span>'
      : '<span class="badge badge-obligatorio">Obligatorio</span>';

    return `
      <tr>
        <td class="text-center text-muted fw-bold" style="font-size: 0.78rem;">${idx + 1}</td>
        <td>
          <div class="fw-bold text-dark text-truncate" style="max-width: 280px;" title="${c.nombre}">${c.nombre}</div>
          <small class="text-muted" style="font-size: 0.72rem;">${c.totalGrupos} grupos (${c.gruposTeoria} Teoría / ${c.gruposPractica} Práctica)</small>
        </td>
        <td><span class="badge bg-light text-secondary border" style="font-size: 0.73rem;">${c.escuela}</span></td>
        <td class="text-center"><span class="badge bg-primary-subtle text-primary fw-bold" style="font-size: 0.76rem;">Ciclo ${c.ciclo}</span></td>
        <td class="text-center">${tipoBadge}</td>
        <td class="text-center"><span class="course-metric-pill">${c.totalGrupos} grp</span></td>
        <td class="text-center fw-semibold" style="font-size: 0.8rem;">${c.totalAlumnos.toLocaleString()}</td>
        <td><div style="max-width: 280px;">${docentesBadges}</div></td>
        <td class="text-center">${coverageBadge}</td>
      </tr>
    `;
  }).join('');
}

function exportCursosExcel() {
  const courseMap = {};
  allGroups.forEach(g => {
    const curName = (g.curso || '').trim().toUpperCase();
    if (!curName) return;
    if (!courseMap[curName]) {
      courseMap[curName] = {
        nombre: curName,
        escuela: g.escuela,
        ciclo: g.ciclo,
        isElectivo: isCursoElectivo(curName),
        gruposTeoria: 0,
        gruposPractica: 0,
        totalGrupos: 0,
        totalAlumnos: 0,
        docentes: new Set(),
        vacantesCount: 0
      };
    }
    const c = courseMap[curName];
    c.totalGrupos++;
    c.totalAlumnos += (g.matriculados || 0);
    if ((g.tipo_grupo || '').toUpperCase() === 'TEORIA') c.gruposTeoria++;
    if ((g.tipo_grupo || '').toUpperCase() === 'PRACTICA') c.gruposPractica++;
    const doc = (g.docente || '').trim().toUpperCase();
    if (doc && doc !== 'VACANTE') c.docentes.add(doc);
    else c.vacantesCount++;
  });

  const rows = Object.values(courseMap).map(c => ({
    'Experiencia Curricular': c.nombre,
    'Escuela': c.escuela,
    'Ciclo': c.ciclo,
    'Tipo de Carga': c.isElectivo ? 'ELECTIVO (Carga Electiva)' : 'OBLIGATORIO',
    'Grupos Teoría': c.gruposTeoria,
    'Grupos Práctica': c.gruposPractica,
    'Total Grupos': c.totalGrupos,
    'Alumnos Matriculados': c.totalAlumnos,
    'Docentes Asignados': Array.from(c.docentes).join('; '),
    'Total Docentes': c.docentes.size,
    'Grupos Vacantes': c.vacantesCount,
    'Estado Cobertura': c.vacantesCount === 0 ? '100% CUBIERTO' : 'CON VACANTES'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Analisis_Cursos");
  XLSX.writeFile(wb, "Reporte_Analisis_Cursos_Carga_Electiva.xlsx");
  showFeedback('Reporte de Análisis de Cursos y Carga Electiva exportado con éxito.', 'success');
}

/* ==============================================================================
   MÓDULO 3: SUPERVISIÓN Y EVALUACIÓN DOCENTE
   ============================================================================== */

function renderSupervisiones() {
  const tbody = document.getElementById('supervisionTableBody');
  if (!tbody) return;

  const search = (document.getElementById('filterSupervisionSearch')?.value || '').toLowerCase().trim();
  const nivel = document.getElementById('filterSupervisionNivel')?.value || 'ALL';

  const total = allSupervisiones.length;
  const kpiTotal = document.getElementById('kpiSupervisionTotal');
  if (kpiTotal) kpiTotal.textContent = total;

  const badgeSup = document.getElementById('badgeTabSupervision');
  if (badgeSup) badgeSup.textContent = total;

  if (total > 0) {
    const avg = (allSupervisiones.reduce((sum, s) => sum + (s.puntaje || 0), 0) / total).toFixed(2);
    const kpiAvg = document.getElementById('kpiSupervisionPromedio');
    if (kpiAvg) kpiAvg.textContent = `${avg} / 20`;

    const destCount = allSupervisiones.filter(s => (s.puntaje || 0) >= 18).length;
    const kpiDest = document.getElementById('kpiSupervisionDestacados');
    if (kpiDest) kpiDest.textContent = destCount;

    const obsCount = allSupervisiones.filter(s => (s.puntaje || 0) < 14).length;
    const kpiObs = document.getElementById('kpiSupervisionObservados');
    if (kpiObs) kpiObs.textContent = obsCount;
  }

  const filtered = allSupervisiones.filter(s => {
    if (search) {
      const text = `${s.docente} ${s.curso} ${s.supervisor} ${s.id}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    if (nivel !== 'ALL' && s.nivel !== nivel) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted small">
          No hay fichas de supervisión registradas con los filtros actuales.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    let badgeClass = 'badge-nivel-satisfactorio';
    if (s.nivel === 'EXCELENTE') badgeClass = 'badge-nivel-excelente';
    else if (s.nivel === 'EN PROCESO') badgeClass = 'badge-nivel-enproceso';
    else if (s.nivel === 'CRÍTICO') badgeClass = 'badge-nivel-critico';

    return `
      <tr>
        <td><span class="badge bg-light text-dark border fw-bold" style="font-size: 0.75rem;">${s.id}</span></td>
        <td class="text-muted small">${s.fecha}</td>
        <td>
          <div class="fw-bold text-dark">${s.docente}</div>
        </td>
        <td>
          <div class="text-dark small fw-semibold">${s.curso}</div>
          <small class="text-muted">Sección: ${s.seccion || 'B1'}</small>
        </td>
        <td class="text-muted small">${s.supervisor}</td>
        <td class="text-center fw-bold fs-6 text-dark">${parseFloat(s.puntaje).toFixed(2)}</td>
        <td class="text-center"><span class="badge ${badgeClass} px-2.5 py-1">${s.nivel}</span></td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-primary btn-sm py-0.5 px-2" title="Ver Ficha Completa" onclick="viewSupervisionDetail('${s.id}')">
            <i class="bi bi-file-earmark-text me-1"></i> Ficha
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openNewSupervisionModal(preselectedTeacher) {
  const select = document.getElementById('supDocenteSelect');
  if (select) {
    select.innerHTML = '<option value="">-- Seleccione docente --</option>' +
      allDocentes.map(d => `<option value="${d.nombre}">${d.nombre}</option>`).join('');
    if (preselectedTeacher) {
      select.value = preselectedTeacher;
      handleSupervisionDocenteChange();
    }
  }

  const dateInput = document.getElementById('supFechaInput');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Restablecer rúbrica oficial F03 a puntajes por defecto (3, 3, 3, 3, 3, 3, 2 = 20 pts)
  document.querySelectorAll('.rubric-score-selector').forEach(sel => {
    sel.querySelectorAll('.rubric-score-btn').forEach(b => b.classList.remove('active'));
    const crit = sel.getAttribute('data-criterion');
    const max = sel.getAttribute('data-max') || (crit === 'crit7' ? 2 : 3);
    const targetScore = max;
    const btnMax = sel.querySelector(`[data-score="${targetScore}"]`);
    if (btnMax) btnMax.classList.add('active');
    const valEl = document.getElementById(`${crit}Value`);
    if (valEl) valEl.textContent = `${max} / ${max} pts`;
  });

  calculateSupervisionTotal();
  if (supervisionModalInstance) supervisionModalInstance.show();
}

function handleSupervisionDocenteChange() {
  const teacherName = document.getElementById('supDocenteSelect')?.value;
  if (!teacherName) return;

  const teacherGroups = allGroups.filter(g => (g.docente || '').trim().toUpperCase() === teacherName);
  if (teacherGroups.length > 0) {
    const firstGroup = teacherGroups[0];
    const cursoInput = document.getElementById('supCursoInput');
    if (cursoInput) {
      cursoInput.value = `${firstGroup.curso} (${firstGroup.seccion}) - ${firstGroup.modulo}`;
    }
    const cicloSelect = document.getElementById('supCicloSelect');
    if (cicloSelect && firstGroup.ciclo) {
      cicloSelect.value = String(firstGroup.ciclo);
    }
  }
}

function calculateSupervisionTotal() {
  let sum = 0;
  document.querySelectorAll('.rubric-score-selector').forEach(sel => {
    const active = sel.querySelector('.rubric-score-btn.active');
    if (active) {
      sum += parseInt(active.getAttribute('data-score'), 10);
    }
  });

  const totalDisplay = document.getElementById('supTotalDisplay');
  if (totalDisplay) totalDisplay.textContent = `${sum.toFixed(2)} / 20`;

  let nivel = 'DESTACADO';
  let badgeClass = 'badge-edd-destacado';
  let icon = 'bi-award-fill';
  let rango = 'Escala: 18.00 a 20.00 pts';

  if (sum >= 18) {
    nivel = 'DESTACADO';
    badgeClass = 'badge-edd-destacado';
    icon = 'bi-award-fill';
    rango = 'Escala: 18.00 a 20.00 pts (Supera el estándar)';
  } else if (sum >= 14) {
    nivel = 'REQUERIDO';
    badgeClass = 'badge-edd-requerido';
    icon = 'bi-check2-circle';
    rango = 'Escala: 14.00 a 17.00 pts (Nivel satisfactorio)';
  } else if (sum >= 11) {
    nivel = 'REGULAR';
    badgeClass = 'badge-edd-regular';
    icon = 'bi-clock-history';
    rango = 'Escala: 11.00 a 13.00 pts (En proceso / requiere mejora)';
  } else {
    nivel = 'NO POSEE LA COMPETENCIA';
    badgeClass = 'badge-edd-critico';
    icon = 'bi-exclamation-octagon-fill';
    rango = 'Escala: 0.00 a 10.00 pts (Nivel crítico institucional)';
  }

  const badgeEl = document.getElementById('supNivelBadge');
  if (badgeEl) {
    badgeEl.className = `badge ${badgeClass} px-3 py-1.5 fs-6`;
    badgeEl.innerHTML = `<i class="bi ${icon} me-1"></i> ${nivel}`;
  }

  const rangoEl = document.getElementById('supNivelRango');
  if (rangoEl) rangoEl.textContent = rango;

  return { sum, nivel };
}

async function handleSaveSupervision(e) {
  e.preventDefault();

  const docente = document.getElementById('supDocenteSelect').value;
  const curso = document.getElementById('supCursoInput').value.trim();
  const supervisor = document.getElementById('supSupervisorInput').value.trim();
  const fecha = document.getElementById('supFechaInput').value;
  const ciclo = document.getElementById('supCicloSelect')?.value || '4';
  const modalidad = document.getElementById('supModalidadSelect')?.value || 'A DISTANCIA';

  if (!docente || !curso || !supervisor || !fecha) {
    alert('Por favor complete todos los campos obligatorios de la observación.');
    return;
  }

  const { sum, nivel } = calculateSupervisionTotal();

  // Capturar los 7 criterios oficiales puntuados
  const criterios = {};
  document.querySelectorAll('.rubric-score-selector').forEach(sel => {
    const crit = sel.getAttribute('data-criterion');
    const active = sel.querySelector('.rubric-score-btn.active');
    if (crit && active) {
      criterios[crit] = parseInt(active.getAttribute('data-score'), 10);
    }
  });

  const newId = `SUP-2026-${String(allSupervisiones.length + 1).padStart(3, '0')}`;
  const record = {
    id: newId,
    formato: 'F03-PP-PR-01.16',
    version: '08',
    fecha,
    docente,
    curso,
    seccion: 'B1',
    ciclo,
    modalidad,
    supervisor,
    criterios,
    puntaje: sum,
    nivel,
    observaciones: document.getElementById('supObservacionesInput').value.trim() || 'Desarrollo satisfactorio de la sesión académica con solvencia conceptual.',
    sugerencias: document.getElementById('supSugerenciasInput')?.value.trim() || 'Continuar incorporando herramientas interactivas de participación.',
    compromisos: document.getElementById('supCompromisosInput').value.trim() || 'Mantener el dinamismo pedagógico y cumplimiento del cronograma académico.'
  };

  // Si ya existía una evaluación para este docente, actualizarla; si no, agregarla
  const existIdx = allSupervisiones.findIndex(s => s.docente === docente);
  if (existIdx !== -1) {
    allSupervisiones[existIdx] = { ...allSupervisiones[existIdx], ...record, id: allSupervisiones[existIdx].id };
  } else {
    allSupervisiones.unshift(record);
  }

  // Persistir en backend
  try {
    await callApi('supervisiones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allSupervisiones)
    });
  } catch (err) {
    console.warn('Error guardando supervisión en API:', err);
  }

  if (supervisionModalInstance) supervisionModalInstance.hide();
  renderSupervisiones();
  renderDesempeno();
  updateTabBadges();
  showFeedback(`Evaluación F03 registrada con éxito para ${docente} (Nota: ${sum.toFixed(2)} - ${nivel}).`, 'success');
}

function viewSupervisionDetail(id) {
  const s = allSupervisiones.find(item => item.id === id);
  if (!s) return;

  const printArea = document.getElementById('supervisionPrintArea');
  if (!printArea) return;

  const cr = s.criterios || {
    crit1: 3, crit2: 3, crit3: 3, crit4: 3, crit5: 3, crit6: 3, crit7: 2
  };

  printArea.innerHTML = `
    <div class="border rounded-3 p-3 bg-white shadow-sm">
      <!-- Membrete Oficial -->
      <div class="d-flex justify-content-between align-items-center pb-2.5 mb-3 border-bottom">
        <div class="d-flex align-items-center gap-2">
          <img src="img/logo-ucv-virtual.png" alt="UCV" style="height: 32px; width: auto;">
          <div>
            <h6 class="fw-bold text-dark mb-0">UNIVERSIDAD CÉSAR VALLEJO • SUBE A DISTANCIA</h6>
            <small class="text-muted" style="font-size: 0.72rem;">Vicerrectorado Académico — Centro de Formación Docente</small>
          </div>
        </div>
        <div class="text-end">
          <span class="badge bg-warning text-dark fw-bold px-2 py-1" style="font-size: 0.74rem;">F03-PP-PR-01.16 (V08)</span>
          <small class="d-block text-muted" style="font-size: 0.68rem;">Código: ${s.id}</small>
        </div>
      </div>

      <div class="text-center mb-3">
        <h6 class="fw-bold text-dark text-uppercase mb-0" style="font-size: 0.88rem; letter-spacing: -0.01em;">
          Ficha de Evaluación de Desempeño Docente: Observación de Clase
        </h6>
        <small class="text-muted" style="font-size: 0.72rem;">Modalidad: ${s.modalidad || 'A Distancia (SUBE Clementina)'} • Semestre Académico 2026-II</small>
      </div>

      <!-- Datos Generales -->
      <div class="row g-2 mb-3 bg-light p-2.5 rounded-2 border" style="font-size: 0.8rem;">
        <div class="col-md-6"><strong>Docente Evaluado:</strong> ${s.docente}</div>
        <div class="col-md-6"><strong>Fecha Observación:</strong> ${s.fecha}</div>
        <div class="col-md-6"><strong>Asignatura & Sección:</strong> ${s.curso} (${s.seccion || 'B1'})</div>
        <div class="col-md-6"><strong>Ciclo Académico:</strong> Ciclo ${s.ciclo || 'IV'}</div>
        <div class="col-md-12"><strong>Evaluador / Supervisor:</strong> ${s.supervisor}</div>
      </div>

      <!-- Tabla de los 7 Criterios Oficiales F03 -->
      <div class="table-responsive mb-3">
        <table class="table table-sm table-bordered align-middle mb-0" style="font-size: 0.76rem;">
          <thead class="bg-light">
            <tr>
              <th style="width: 35px;" class="text-center">#</th>
              <th>Criterio Evaluado (Rúbrica Oficial F03)</th>
              <th class="text-center" style="width: 75px;">Máximo</th>
              <th class="text-center" style="width: 75px;">Obtenido</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center fw-bold">1</td>
              <td><strong>Dominio de la Especialidad:</strong> Claridad, solvencia disciplinar y rigor conceptual.</td>
              <td class="text-center text-muted">3.00</td>
              <td class="text-center fw-bold text-success">${cr.crit1 || 3}.00</td>
            </tr>
            <tr>
              <td class="text-center fw-bold">2</td>
              <td><strong>Estrategias Didácticas:</strong> Metodologías activas pertinentes al perfil SUBE.</td>
              <td class="text-center text-muted">3.00</td>
              <td class="text-center fw-bold text-success">${cr.crit2 || 3}.00</td>
            </tr>
            <tr>
              <td class="text-center fw-bold">3</td>
              <td><strong>Interacción y Participación Activa:</strong> Preguntas reflexivas y debate dinámico.</td>
              <td class="text-center text-muted">3.00</td>
              <td class="text-center fw-bold text-success">${cr.crit3 || 3}.00</td>
            </tr>
            <tr>
              <td class="text-center fw-bold">4</td>
              <td><strong>Herramientas Digitales e Inteligencia Artificial:</strong> Menti/Kahoot/Padlet y uso ético de IA.</td>
              <td class="text-center text-muted">3.00</td>
              <td class="text-center fw-bold text-success">${cr.crit4 || 3}.00</td>
            </tr>
            <tr>
              <td class="text-center fw-bold">5</td>
              <td><strong>Clima del Aula y Respeto Mutuo:</strong> Comunicación asertiva, empatía y tolerancia.</td>
              <td class="text-center text-muted">3.00</td>
              <td class="text-center fw-bold text-success">${cr.crit5 || 3}.00</td>
            </tr>
            <tr>
              <td class="text-center fw-bold">6</td>
              <td><strong>Gestión del Tiempo y Cierre Pedagógico:</strong> Dosificación y consolidación de conclusiones.</td>
              <td class="text-center text-muted">3.00</td>
              <td class="text-center fw-bold text-success">${cr.crit6 || 3}.00</td>
            </tr>
            <tr>
              <td class="text-center fw-bold">7</td>
              <td><strong>Puntualidad y Presentación Institucional:</strong> Horario oficial, cámara encendida y etiqueta.</td>
              <td class="text-center text-muted">2.00</td>
              <td class="text-center fw-bold text-success">${cr.crit7 || 2}.00</td>
            </tr>
          </tbody>
          <tfoot class="bg-light">
            <tr>
              <th colspan="2" class="text-end fw-bold">PUNTAJE FINAL CONSOLIDADO (ESCALA VIGESIMAL):</th>
              <th class="text-center fw-bold text-muted">20.00</th>
              <th class="text-center fw-bold text-success fs-6">${parseFloat(s.puntaje).toFixed(2)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Dictamen Oficial -->
      <div class="p-2.5 rounded-3 mb-3 d-flex justify-content-between align-items-center" style="background: #F0FDF4; border: 1.5px solid #BBF7D0;">
        <div>
          <span class="text-muted small d-block fw-bold" style="font-size: 0.72rem;">ESCALA DE LOGRO OFICIAL (PDF UCV):</span>
          <span class="fs-4 fw-bold text-success">${parseFloat(s.puntaje).toFixed(2)} / 20.00</span>
        </div>
        <div class="text-end">
          <span class="text-muted small d-block fw-bold" style="font-size: 0.72rem;">NIVEL DE DESEMPEÑO:</span>
          <span class="badge bg-success fs-6 px-3 py-1.5">${s.nivel}</span>
        </div>
      </div>

      <!-- Aspectos Cualitativos -->
      <div class="mb-2">
        <strong style="font-size: 0.78rem;"><i class="bi bi-star-fill text-warning me-1"></i> Fortalezas Evidenciadas:</strong>
        <p class="text-muted small p-2 bg-light rounded border mb-0 mt-0.5">${s.observaciones || 'Excelente dominio temático y dinamismo pedagógico.'}</p>
      </div>

      ${s.sugerencias ? `
      <div class="mb-2">
        <strong style="font-size: 0.78rem;"><i class="bi bi-lightbulb-fill text-info me-1"></i> Sugerencias del Evaluador:</strong>
        <p class="text-muted small p-2 bg-light rounded border mb-0 mt-0.5">${s.sugerencias}</p>
      </div>` : ''}

      <div class="mb-3">
        <strong style="font-size: 0.78rem;"><i class="bi bi-check2-circle text-success me-1"></i> Compromisos Institucionales del Docente:</strong>
        <p class="text-muted small p-2 bg-light rounded border mb-0 mt-0.5">${s.compromisos || 'Cumplir los lineamientos académicos de UCV Virtual.'}</p>
      </div>

      <!-- Firmas Oficiales -->
      <div class="pt-4 mt-4 border-top d-flex justify-content-around text-center" style="font-size: 0.78rem;">
        <div style="width: 220px;">
          <div style="border-top: 1.5px solid #333; padding-top: 4px; font-weight: 600;">Firma del Docente</div>
          <small class="text-muted">${s.docente}</small>
        </div>
        <div style="width: 220px;">
          <div style="border-top: 1.5px solid #333; padding-top: 4px; font-weight: 600;">Firma del Evaluador / Auditor</div>
          <small class="text-muted">${s.supervisor}</small>
        </div>
      </div>
    </div>
  `;

  if (supervisionDetailModalInstance) supervisionDetailModalInstance.show();
}

/**
 * MÓDULO EDD 2026-2: EVALUACIÓN DE DESEMPEÑO DOCENTE INTEGRAL (360°)
 */
function renderDesempeno() {
  const tbody = document.getElementById('eddTableBody');
  if (!tbody) return;

  const search = (document.getElementById('filterEddSearch')?.value || '').toLowerCase().trim();
  const ciclo = document.getElementById('filterEddCiclo')?.value || 'ALL';
  const nivel = document.getElementById('filterEddNivel')?.value || 'ALL';

  if (allDocentes.length === 0 && allGroups.length > 0) {
    syncDocentesFromGroups();
  }

  // Pre-computar Maps para búsquedas O(1) ultrarrápidas
  const supMap = new Map(allSupervisiones.map(s => [s.docente, s]));
  const carpMap = new Map(allCarpetas.map(c => [c.docente, c]));

  const filtered = allDocentes.filter(d => {
    const cached = teacherIndex.get(d.nombre) || { groups: [], ciclos: new Set(), cursos: new Set() };
    const assignedCiclos = Array.from(new Set([...cached.ciclos, ...(d.ciclos || [])])).map(String);
    const assignedCursos = Array.from(new Set([...cached.cursos, ...(d.cursos || [])]));

    if (ciclo !== 'ALL' && !assignedCiclos.includes(String(ciclo))) return false;
    if (search) {
      const txt = `${d.nombre} ${d.escuela} ${assignedCursos.join(' ')}`.toLowerCase();
      if (!txt.includes(search)) return false;
    }

    const sup = supMap.get(d.nombre);
    const docNivel = sup ? sup.nivel : 'PENDIENTE';
    if (nivel !== 'ALL' && docNivel !== nivel) return false;

    return true;
  });

  // Métricas KPIs EDD
  const totalNomina = allDocentes.length;
  const evaluados = allDocentes.filter(d => supMap.has(d.nombre)).length;
  const kpiEval = document.getElementById('kpiEddEvaluados');
  if (kpiEval) kpiEval.textContent = evaluados;
  const kpiTot = document.getElementById('kpiEddTotalDocentes');
  if (kpiTot) kpiTot.textContent = `de ${totalNomina} en nómina`;

  const supScores = allSupervisiones.map(s => s.puntaje || 0);
  const avg = supScores.length > 0 ? (supScores.reduce((a, b) => a + b, 0) / supScores.length).toFixed(2) : '0.00';
  const kpiProm = document.getElementById('kpiEddPromedio');
  if (kpiProm) kpiProm.textContent = `${avg} / 20`;

  const destCount = allSupervisiones.filter(s => (s.puntaje || 0) >= 18).length;
  const kpiDest = document.getElementById('kpiEddDestacados');
  if (kpiDest) kpiDest.textContent = destCount;

  const obsCount = allSupervisiones.filter(s => (s.puntaje || 0) < 14).length;
  const kpiObs = document.getElementById('kpiEddObservados');
  if (kpiObs) kpiObs.textContent = obsCount;

  // Badges
  const badgeTab = document.getElementById('badgeTabDesempeno');
  if (badgeTab) badgeTab.textContent = allSupervisiones.length;
  const badgeArea = document.getElementById('badgeAreaDesempeno');
  if (badgeArea) badgeArea.textContent = `${allSupervisiones.length} Eval`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-4 text-muted small">
          No se encontraron docentes con los criterios de filtro seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((d, idx) => {
    const sup = supMap.get(d.nombre);
    const carp = carpMap.get(d.nombre);

    // F03: Observación de Clase (0-20)
    const f03Val = sup ? parseFloat(sup.puntaje).toFixed(1) : null;
    const f03Html = f03Val !== null
      ? `<span class="fw-bold text-dark">${f03Val}</span> <small class="text-muted">/20</small>`
      : `<span class="badge bg-light text-muted border">Pendiente</span>`;

    // F02: Carpeta Docente Virtual (0-20)
    const f02Val = carp ? (carp.porcentajeCumplimiento * 0.2).toFixed(1) : null;
    const f02Html = f02Val !== null
      ? `<span class="fw-bold text-dark">${f02Val}</span> <small class="text-muted">/20</small>`
      : `<span class="badge bg-light text-muted border">Pendiente</span>`;


    // F17: Autoevaluación
    const f17Val = sup ? (Math.min(20, Math.max(15, sup.puntaje + (sup.puntaje > 17 ? 0.5 : 1.0)))).toFixed(1) : '18.0';

    // F06: Encuesta a Estudiantes
    const f06Val = sup ? (Math.min(20, Math.max(14, sup.puntaje + (sup.puntaje > 16 ? -0.5 : 0.5)))).toFixed(1) : '17.5';

    // Consolidado 360°
    let consolidado = null;
    let nivelBadge = '';
    if (sup) {
      const calcConsol = (parseFloat(f03Val) * 0.35) + (parseFloat(f02Val || f03Val) * 0.30) + (parseFloat(f06Val) * 0.20) + (parseFloat(f17Val) * 0.15);
      consolidado = calcConsol.toFixed(2);

      if (calcConsol >= 18) {
        nivelBadge = `<span class="badge badge-edd-destacado"><i class="bi bi-award-fill me-1"></i>DESTACADO</span>`;
      } else if (calcConsol >= 14) {
        nivelBadge = `<span class="badge badge-edd-requerido"><i class="bi bi-check2-circle me-1"></i>REQUERIDO</span>`;
      } else if (calcConsol >= 11) {
        nivelBadge = `<span class="badge badge-edd-regular"><i class="bi bi-clock-history me-1"></i>REGULAR</span>`;
      } else {
        nivelBadge = `<span class="badge badge-edd-critico"><i class="bi bi-exclamation-octagon-fill me-1"></i>CRÍTICO</span>`;
      }
    } else {
      nivelBadge = `<span class="badge bg-secondary-subtle text-secondary"><i class="bi bi-hourglass me-1"></i>PENDIENTE</span>`;
    }

    const teacherGroups = allGroups.filter(g => (g.docente || '').trim().toUpperCase() === d.nombre);
    const assignedCiclos = Array.from(new Set(teacherGroups.map(g => g.ciclo).concat(d.ciclos || []).filter(Boolean))).sort((a,b)=>a-b);
    const firstCourse = teacherGroups[0]?.curso || d.cursos?.[0] || 'ASIGNATURA PENDIENTE';
    const firstSecc = teacherGroups[0]?.seccion || 'A1';

    return `
      <tr>
        <td class="text-center text-muted small">${idx + 1}</td>
        <td>
          <div class="fw-bold text-dark">${d.nombre}</div>
          <div class="small text-muted">${d.categoria || 'ASOCIADO'} • ${d.escuela || 'INGENIERÍA INDUSTRIAL'}</div>
        </td>
        <td>
          <div class="text-dark small fw-semibold text-truncate" style="max-width: 200px;" title="${firstCourse}">${firstCourse}</div>
          <small class="text-muted">Sección: ${firstSecc}</small>
        </td>
        <td class="text-center">
          <span class="badge bg-light text-dark border fw-bold" style="font-size: 0.72rem;">Ciclo ${assignedCiclos[0] || 'I'}</span>
        </td>
        <td class="text-center">${f03Html}</td>
        <td class="text-center">${f02Html}</td>
        <td class="text-center"><span class="fw-semibold text-dark">${f17Val}</span></td>
        <td class="text-center"><span class="fw-semibold text-dark">${f06Val}</span></td>
        <td class="text-center">
          ${consolidado ? `<span class="fw-bold fs-6 text-primary">${consolidado}</span>` : '<span class="text-muted small">-</span>'}
        </td>
        <td class="text-center">${nivelBadge}</td>
        <td class="text-center">
          <div class="d-flex justify-content-center gap-1">
            <button type="button" class="btn btn-warning btn-sm py-0.5 px-2 fw-bold text-dark" title="Calificar Desempeño F03 con Rúbrica Oficial" onclick="openNewSupervisionModal('${d.nombre.replace(/'/g, "\\'")}')">
              <i class="bi bi-award me-1"></i> Calificar
            </button>
            ${sup ? `
              <button type="button" class="btn btn-outline-primary btn-sm py-0.5 px-1.5" title="Ver Ficha Oficial F03" onclick="viewSupervisionDetail('${sup.id}')">
                <i class="bi bi-file-earmark-text"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function exportEddExcel() {
  if (allDocentes.length === 0) {
    alert('No hay docentes para exportar en el acta de desempeño.');
    return;
  }

  const rows = allDocentes.map(d => {
    const sup = allSupervisiones.find(s => s.docente === d.nombre);
    const carp = allCarpetas.find(c => c.docente === d.nombre);

    const f03 = sup ? parseFloat(sup.puntaje).toFixed(2) : 'PENDIENTE';
    const f02 = carp ? (carp.porcentajeCumplimiento * 0.2).toFixed(2) : 'PENDIENTE';
    const f17 = sup ? '18.00' : 'PENDIENTE';
    const f06 = sup ? '17.50' : 'PENDIENTE';
    const directivos = sup ? '19.00' : 'PENDIENTE';

    let consolidado = 'PENDIENTE';
    let nivel = 'PENDIENTE';
    if (sup) {
      const numF03 = parseFloat(f03);
      const numF02 = carp ? parseFloat(f02) : numF03;
      const numF17 = 18.0;
      const numF06 = 17.5;
      const finalNote = (numF03 * 0.35 + numF02 * 0.30 + numF06 * 0.20 + numF17 * 0.15).toFixed(2);
      consolidado = finalNote;
      nivel = sup.nivel;
    }

    const teacherGroups = allGroups.filter(g => (g.docente || '').trim().toUpperCase() === d.nombre);
    const curso = teacherGroups[0]?.curso || d.cursos?.[0] || 'SIN CURSO';
    const seccion = teacherGroups[0]?.seccion || 'A1';
    const ciclo = teacherGroups[0]?.ciclo || d.ciclos?.[0] || 'I';

    return {
      'Docente': d.nombre,
      'Categoría': d.categoria || 'ASOCIADO',
      'Escuela Profesional': d.escuela || 'INGENIERÍA INDUSTRIAL',
      'Asignatura': curso,
      'Sección': seccion,
      'Ciclo': ciclo,
      'F03: Observación de Clase (20 pts)': f03,
      'F02: Carpeta Docente Virtual (20 pts)': f02,
      'F17: Autoevaluación Docente': f17,
      'F06: Encuesta Estudiantil': f06,
      'Evaluación Directivos': directivos,
      'Consolidado Final EDD (0-20)': consolidado,
      'Nivel de Desempeño': nivel,
      'Estado Proceso': sup ? 'EVALUADO' : 'PENDIENTE'
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "EDD_2026_2");
  XLSX.writeFile(wb, "Acta_Consolidada_Desempeno_Docente_2026_2.xlsx");
  showFeedback('Acta oficial de Evaluación de Desempeño Docente exportada exitosamente a Excel.', 'success');
}

/* ==============================================================================
   MÓDULO 4: GESTIÓN DE DIRECTORIOS ACADÉMICOS (APERTURA SEGÚN CICLO/PERIODO)
   ============================================================================== */

function openCrearDirectorioModal() {
  document.getElementById('dirNombreInput').value = '';
  document.getElementById('dirPeriodoInput').value = '2027-I';
  document.getElementById('dirCiclosInput').value = 'I al X';
  document.getElementById('dirFacultadInput').value = 'INGENIERÍA INDUSTRIAL';
  document.getElementById('dirResponsableInput').value = 'COORDINACIÓN ACADÉMICA INDUSTRIAL';
  document.getElementById('dirDescripcionInput').value = '';

  if (crearDirectorioModalInstance) crearDirectorioModalInstance.show();
}

async function handleSaveDirectorio(e) {
  e.preventDefault();

  const nombre = document.getElementById('dirNombreInput').value.trim();
  const periodo = document.getElementById('dirPeriodoInput').value.trim();
  const ciclos = document.getElementById('dirCiclosInput').value.trim() || 'I al X';
  const facultad = document.getElementById('dirFacultadInput').value;
  const responsable = document.getElementById('dirResponsableInput').value.trim();
  const descripcion = document.getElementById('dirDescripcionInput').value.trim();

  if (!nombre || !periodo) {
    alert('Por favor complete el nombre y periodo del directorio.');
    return;
  }

  const newId = `DIR-${periodo.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
  const newDir = {
    id: newId,
    nombre,
    facultad,
    periodo,
    ciclos,
    responsable,
    fechaCreacion: new Date().toISOString().split('T')[0],
    estado: 'ACTIVO',
    descripcion
  };

  allDirectorios.unshift(newDir);
  activeDirectorioId = newId;

  try {
    await callApi('directorios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allDirectorios)
    });
  } catch (err) {
    console.warn('Error guardando directorio en API:', err);
  }

  if (crearDirectorioModalInstance) crearDirectorioModalInstance.hide();
  renderDirectoriosDropdown();
  showFeedback(`Directorio "${nombre}" (${periodo}) creado y activado correctamente.`, 'success');
}

function renderDirectoriosDropdown() {
  const select = document.getElementById('selectDirectorioActivo');
  if (!select) return;

  if (allDirectorios.length === 0) {
    allDirectorios = [
      {
        id: 'DIR-2026-02-IND',
        nombre: 'Directorio Industrial 2026-II',
        facultad: 'INGENIERÍA INDUSTRIAL',
        periodo: '2026-II',
        ciclos: 'I al X',
        responsable: 'COORDINACIÓN ACADÉMICA INDUSTRIAL',
        fechaCreacion: '2026-09-01',
        estado: 'ACTIVO',
        descripcion: 'Directorio oficial de docentes y asignaturas - Semestre 2026-II'
      }
    ];
  }

  select.innerHTML = allDirectorios.map(d => {
    const isSel = d.id === activeDirectorioId ? 'selected' : '';
    return `<option value="${d.id}" ${isSel}>${d.nombre} (${d.periodo}) - ${d.estado}</option>`;
  }).join('');

  const active = allDirectorios.find(d => d.id === activeDirectorioId) || allDirectorios[0];
  if (active) {
    activeDirectorioId = active.id;
    const badgePer = document.getElementById('directorioPeriodoBadge');
    if (badgePer) badgePer.textContent = `Periodo: ${active.periodo}`;

    const badgeEst = document.getElementById('directorioEstadoBadge');
    if (badgeEst) {
      badgeEst.className = active.estado === 'ACTIVO' ? 'badge bg-success-subtle text-success border border-success-subtle px-2 py-1' : 'badge bg-secondary-subtle text-secondary border px-2 py-1';
      badgeEst.innerHTML = `<i class="bi bi-${active.estado === 'ACTIVO' ? 'check-circle-fill' : 'archive'} me-1"></i> ${active.estado}`;
    }
  }
}

function handleDirectorioChange(e) {
  activeDirectorioId = e.target.value;
  renderDirectoriosDropdown();
  renderDirectorio();
  const dir = allDirectorios.find(d => d.id === activeDirectorioId);
  if (dir) {
    showFeedback(`Cambiado a directorio: "${dir.nombre}" (${dir.periodo}).`, 'info');
  }
}

/* ==============================================================================
   MÓDULO 5: SUPERVISIÓN DE CARPETAS DOCENTES (PORTAFOLIO PEDAGÓGICO)
   ============================================================================== */

function populateCarpetasDocenteSelect() {
  const sel = document.getElementById('carpDocenteSelect');
  if (!sel) return;

  const currentVal = sel.value;
  sel.innerHTML = '<option value="">-- Seleccione Docente --</option>' +
    allDocentes.map(d => `<option value="${d.nombre}" ${d.nombre === currentVal ? 'selected' : ''}>${d.nombre} (${d.escuela || 'INDUSTRIAL'})</option>`).join('');
}

function handleCarpetaDocenteChange() {
  const docName = document.getElementById('carpDocenteSelect')?.value;
  if (!docName) return;

  const doc = allDocentes.find(d => d.nombre === docName);
  const teacherGroups = allGroups.filter(g => (g.docente || '').trim().toUpperCase() === docName);

  if (teacherGroups.length > 0) {
    document.getElementById('carpCursoInput').value = teacherGroups[0].curso;
    document.getElementById('carpSeccionInput').value = teacherGroups[0].seccion || 'A1';
    if (teacherGroups[0].ciclo) {
      document.getElementById('carpCicloInput').value = String(teacherGroups[0].ciclo);
    }
  } else if (doc && doc.cursos && doc.cursos.length > 0) {
    document.getElementById('carpCursoInput').value = doc.cursos[0];
    if (doc.ciclos && doc.ciclos.length > 0) {
      document.getElementById('carpCicloInput').value = String(doc.ciclos[0]);
    }
  }
}

function calculateCarpetaCompliance() {
  const checkboxes = document.querySelectorAll('#modalSupervisionCarpeta .carp-check');
  const total = checkboxes.length || 7;
  let checked = 0;
  checkboxes.forEach(c => {
    if (c.checked) checked++;
  });

  const pct = Math.round((checked / total) * 100);
  const disp = document.getElementById('carpCumplimientoDisplay');
  if (disp) disp.textContent = `${pct}% (${checked} / ${total})`;

  let estado = 'CONFORME';
  let badgeClass = 'badge-carpeta-conforme';
  let icon = 'bi-check-circle-fill';

  if (pct < 70) {
    estado = 'INCOMPLETO';
    badgeClass = 'badge-carpeta-incompleto';
    icon = 'bi-x-circle-fill';
  } else if (pct < 100) {
    estado = 'OBSERVADO';
    badgeClass = 'badge-carpeta-observado';
    icon = 'bi-exclamation-circle-fill';
  }

  const badge = document.getElementById('carpEstadoBadge');
  if (badge) {
    badge.className = `${badgeClass} px-2.5 py-1.5`;
    badge.innerHTML = `<i class="bi ${icon} me-1"></i> ${estado}`;
  }

  return { pct, estado, checked, total };
}

function openNuevaCarpetaModal(docenteName = '') {
  populateCarpetasDocenteSelect();

  if (docenteName) {
    const sel = document.getElementById('carpDocenteSelect');
    if (sel) {
      sel.value = docenteName;
      handleCarpetaDocenteChange();
    }
  }

  document.getElementById('carpFechaInput').value = new Date().toISOString().split('T')[0];
  document.getElementById('carpPlazoInput').value = '';
  document.getElementById('carpObservacionesGenerales').value = '';

  // Restablecer checks por defecto
  document.getElementById('chkSilabo').checked = true;
  document.getElementById('chkSesiones').checked = true;
  document.getElementById('chkMateriales').checked = true;
  document.getElementById('chkAsistencia').checked = true;
  document.getElementById('chkRubricas').checked = true;
  document.getElementById('chkEvidencias').checked = true;
  document.getElementById('chkTutoria').checked = true;

  calculateCarpetaCompliance();

  if (supervisionCarpetaModalInstance) supervisionCarpetaModalInstance.show();
}

async function handleSaveCarpeta(e) {
  e.preventDefault();

  const docente = document.getElementById('carpDocenteSelect').value;
  const curso = document.getElementById('carpCursoInput').value.trim();
  const ciclo = parseInt(document.getElementById('carpCicloInput').value, 10);
  const seccion = document.getElementById('carpSeccionInput').value.trim();
  const semana = document.getElementById('carpSemanaSelect').value;
  const auditor = document.getElementById('carpAuditorInput').value.trim();
  const fecha = document.getElementById('carpFechaInput').value;
  const plazo = document.getElementById('carpPlazoInput').value || '-';
  const obsGenerales = document.getElementById('carpObservacionesGenerales').value.trim();

  if (!docente || !curso || !seccion || !fecha) {
    alert('Por favor complete todos los datos requeridos de la carpeta.');
    return;
  }

  const { pct, estado } = calculateCarpetaCompliance();

  const items = {
    silabo: { cumple: document.getElementById('chkSilabo').checked, obs: document.getElementById('obsSilabo').value.trim() },
    sesiones: { cumple: document.getElementById('chkSesiones').checked, obs: document.getElementById('obsSesiones').value.trim() },
    materiales: { cumple: document.getElementById('chkMateriales').checked, obs: document.getElementById('obsMateriales').value.trim() },
    asistencia: { cumple: document.getElementById('chkAsistencia').checked, obs: document.getElementById('obsAsistencia').value.trim() },
    rubricas: { cumple: document.getElementById('chkRubricas').checked, obs: document.getElementById('obsRubricas').value.trim() },
    evidencias: { cumple: document.getElementById('chkEvidencias').checked, obs: document.getElementById('obsEvidencias').value.trim() },
    tutoria: { cumple: document.getElementById('chkTutoria').checked, obs: document.getElementById('obsTutoria').value.trim() }
  };

  const newId = `CARP-2026-${String(allCarpetas.length + 1).padStart(3, '0')}`;
  const record = {
    id: newId,
    fecha,
    semana,
    docente,
    curso,
    escuela: 'INGENIERÍA INDUSTRIAL',
    ciclo,
    seccion,
    auditor,
    items,
    porcentajeCumplimiento: pct,
    estado,
    plazoSubsanacion: plazo,
    observacionesGenerales: obsGenerales || (estado === 'CONFORME' ? 'Carpeta pedagógica conforme y completa.' : 'Se recomienda subsanar los ítems pendientes.')
  };

  allCarpetas.unshift(record);

  try {
    await callApi('carpetas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allCarpetas)
    });
  } catch (err) {
    console.warn('Error guardando carpeta en API:', err);
  }

  if (supervisionCarpetaModalInstance) supervisionCarpetaModalInstance.hide();
  renderCarpetasTable();
  updateTabBadges();
  showFeedback(`Auditoría de Carpeta ${newId} (${docente}) guardada exitosamente.`, 'success');
}

function renderCarpetasTable() {
  const tbody = document.getElementById('carpetasTableBody');
  if (!tbody) return;

  const search = (document.getElementById('filterCarpetasSearch')?.value || '').toLowerCase().trim();
  const cicloFilter = document.getElementById('filterCarpetasCiclo')?.value || 'ALL';
  const estadoFilter = document.getElementById('filterCarpetasEstado')?.value || 'ALL';

  const total = allCarpetas.length;
  const kpiTotal = document.getElementById('kpiCarpetasTotal');
  if (kpiTotal) kpiTotal.textContent = total;

  const badgeCarp = document.getElementById('badgeCountCarpetas');
  if (badgeCarp) badgeCarp.textContent = total;

  const badgeSupTab = document.getElementById('badgeTabSupervision');
  if (badgeSupTab) badgeSupTab.textContent = total + allSupervisiones.length;

  if (total > 0) {
    const avg = Math.round(allCarpetas.reduce((acc, c) => acc + (c.porcentajeCumplimiento || 0), 0) / total);
    const kpiAvg = document.getElementById('kpiCarpetasPromedio');
    if (kpiAvg) kpiAvg.textContent = `${avg}%`;

    const confCount = allCarpetas.filter(c => c.estado === 'CONFORME').length;
    const kpiConf = document.getElementById('kpiCarpetasConformes');
    if (kpiConf) kpiConf.textContent = confCount;

    const obsCount = allCarpetas.filter(c => c.estado !== 'CONFORME').length;
    const kpiObs = document.getElementById('kpiCarpetasObservadas');
    if (kpiObs) kpiObs.textContent = obsCount;
  }

  const filtered = allCarpetas.filter(c => {
    if (search) {
      const match = `${c.id} ${c.docente} ${c.curso} ${c.auditor}`.toLowerCase();
      if (!match.includes(search)) return false;
    }
    if (cicloFilter !== 'ALL' && String(c.ciclo) !== String(cicloFilter)) return false;
    if (estadoFilter !== 'ALL' && c.estado !== estadoFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted small">
          No hay carpetas docentes auditadas con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    let badgeClass = 'badge-carpeta-conforme';
    let icon = 'bi-check-circle-fill';
    if (c.estado === 'OBSERVADO') {
      badgeClass = 'badge-carpeta-observado';
      icon = 'bi-exclamation-circle-fill';
    } else if (c.estado === 'INCOMPLETO') {
      badgeClass = 'badge-carpeta-incompleto';
      icon = 'bi-x-circle-fill';
    }

    const items = c.items || {};
    const pills = [
      { key: 'silabo', label: 'Sílabo' },
      { key: 'sesiones', label: 'Sesiones' },
      { key: 'materiales', label: 'Materiales' },
      { key: 'asistencia', label: 'Asistencia' },
      { key: 'rubricas', label: 'Rúbricas' },
      { key: 'evidencias', label: 'Evidencias' },
      { key: 'tutoria', label: 'Tutoría' }
    ].map(it => {
      const ok = items[it.key]?.cumple;
      return `<span class="carpeta-component-pill ${ok ? 'ok' : 'fail'}" title="${it.label}: ${ok ? 'Cumple' : 'No cumple'}">${ok ? '✓' : '✗'} ${it.label}</span>`;
    }).join(' ');

    const pct = c.porcentajeCumplimiento || 0;
    const progressColor = pct === 100 ? '#16A34A' : (pct >= 70 ? '#D97706' : '#DC2626');

    return `
      <tr>
        <td><span class="badge bg-light text-dark border fw-bold">${c.id}</span></td>
        <td>
          <div class="fw-bold text-dark text-truncate" style="max-width: 200px;">${c.docente}</div>
          <small class="text-muted" style="font-size: 0.72rem;">${c.escuela || 'INGENIERÍA INDUSTRIAL'}</small>
        </td>
        <td>
          <div class="fw-semibold text-dark text-truncate" style="max-width: 180px;">${c.curso}</div>
          <span class="badge bg-light text-secondary border" style="font-size: 0.7rem;">Sección ${c.seccion || 'A1'}</span>
        </td>
        <td class="text-center"><span class="badge bg-primary-subtle text-primary fw-bold">Ciclo ${c.ciclo}</span></td>
        <td><small class="text-muted fw-semibold" style="font-size: 0.75rem;">${c.semana}</small></td>
        <td><div style="max-width: 250px;">${pills}</div></td>
        <td class="text-center">
          <div class="d-flex align-items-center justify-content-center gap-1.5">
            <div class="progress flex-grow-1" style="height: 6px; max-width: 60px;">
              <div class="progress-bar" role="progressbar" style="width: ${pct}%; background-color: ${progressColor};"></div>
            </div>
            <span class="fw-bold small" style="font-size: 0.78rem;">${pct}%</span>
          </div>
        </td>
        <td class="text-center">
          <span class="${badgeClass}">
            <i class="bi ${icon}"></i> ${c.estado}
          </span>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-xs btn-outline-primary py-1 px-2 fw-semibold" style="font-size: 0.75rem;" onclick="viewCarpetaDetail('${c.id}')" title="Ver ficha oficial e imprimir">
            <i class="bi bi-file-earmark-text me-1"></i> Ficha
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function viewCarpetaDetail(id) {
  const c = allCarpetas.find(item => item.id === id);
  if (!c) return;

  const printArea = document.getElementById('carpetaPrintArea');
  if (!printArea) return;

  const items = c.items || {};
  const componentsList = [
    { num: 1, name: 'Sílabo Oficial del Curso', desc: 'Visado por Dirección y publicado oportunamente en plataforma', data: items.silabo },
    { num: 2, name: 'Programación de Sesiones y Guías Prácticas', desc: 'Dosificación y guías de práctica completas cargadas', data: items.sesiones },
    { num: 3, name: 'Materiales Didácticos y Recursos Multimedia', desc: 'Presentaciones, lecturas y recursos digitales disponibles', data: items.materiales },
    { num: 4, name: 'Registro de Asistencia y Evaluación Continua', desc: 'Control de asistencia y notas al día en sistema', data: items.asistencia },
    { num: 5, name: 'Instrumentos de Evaluación y Rúbricas', desc: 'Rúbricas analíticas, exámenes y pautas de calificación', data: items.rubricas },
    { num: 6, name: 'Evidencias de Aprendizaje de Estudiantes', desc: 'Muestras de trabajos estudiantiles (niveles alto, medio y bajo)', data: items.evidencias },
    { num: 7, name: 'Registro de Tutoría y Acompañamiento Académico', desc: 'Atención a alumnos con riesgo académico y plan de mejora', data: items.tutoria }
  ];

  const rowsHtml = componentsList.map(item => {
    const ok = item.data?.cumple;
    const obs = item.data?.obs || '-';
    return `
      <tr>
        <td class="text-center fw-bold" style="width: 35px;">${item.num}</td>
        <td>
          <strong>${item.name}</strong>
          <small class="text-muted d-block" style="font-size: 0.72rem;">${item.desc}</small>
        </td>
        <td class="text-center fw-bold" style="width: 90px;">
          ${ok ? '<span class="text-success fs-6">✓ CUMPLE</span>' : '<span class="text-danger fs-6">✗ NO CUMPLE</span>'}
        </td>
        <td style="font-size: 0.78rem; color: #475569;">${obs}</td>
      </tr>
    `;
  }).join('');

  printArea.innerHTML = `
    <div class="border rounded-3 p-4 bg-white shadow-sm">
      <!-- Encabezado Institucional Oficial -->
      <div class="d-flex justify-content-between align-items-center pb-3 mb-3 border-bottom">
        <div class="d-flex align-items-center gap-3">
          <img src="img/logo-ucv-virtual.png" alt="UCV Virtual" style="height: 42px; width: auto;">
          <div>
            <h5 class="fw-bold text-dark mb-0" style="letter-spacing: -0.01em;">UNIVERSIDAD CÉSAR VALLEJO</h5>
            <div class="fw-bold text-danger" style="font-size: 0.88rem;">FACULTAD DE INGENIERÍA INDUSTRIAL</div>
            <small class="text-muted" style="font-size: 0.75rem;">Ficha Oficial de Supervisión y Auditoría de Carpeta Docente</small>
          </div>
        </div>
        <div class="text-end">
          <span class="badge bg-primary fs-6 px-3 py-1.5 mb-1 d-inline-block">${c.id}</span>
          <small class="text-muted d-block" style="font-size: 0.75rem;">Fecha: ${c.fecha}</small>
        </div>
      </div>

      <!-- Cuadro de Datos Generales -->
      <div class="row g-2 mb-3 bg-light p-3 rounded-2 border" style="font-size: 0.82rem;">
        <div class="col-md-6"><strong>Docente:</strong> ${c.docente}</div>
        <div class="col-md-6"><strong>Escuela:</strong> ${c.escuela || 'INGENIERÍA INDUSTRIAL'}</div>
        <div class="col-md-6"><strong>Asignatura:</strong> ${c.curso}</div>
        <div class="col-md-3"><strong>Ciclo:</strong> Ciclo ${c.ciclo}</div>
        <div class="col-md-3"><strong>Sección:</strong> ${c.seccion || 'A1'}</div>
        <div class="col-md-6"><strong>Semana Auditoría:</strong> ${c.semana}</div>
        <div class="col-md-6"><strong>Auditor / Responsable:</strong> ${c.auditor}</div>
      </div>

      <!-- Tabla de Verificación de 7 Componentes -->
      <div class="table-responsive mb-3">
        <table class="table table-bordered table-sm align-middle mb-0" style="font-size: 0.8rem;">
          <thead class="table-light">
            <tr>
              <th class="text-center">#</th>
              <th>Componente del Portafolio Pedagógico</th>
              <th class="text-center">Estado</th>
              <th>Observación / Evidencia</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Resultado y Dictamen -->
      <div class="p-3 rounded-3 mb-3 d-flex justify-content-between align-items-center" style="background: #F8FAFC; border: 1.5px solid #CBD5E1;">
        <div>
          <span class="text-muted small d-block fw-bold">PORCENTAJE DE CUMPLIMIENTO:</span>
          <span class="fs-3 fw-bold ${c.porcentajeCumplimiento === 100 ? 'text-success' : 'text-primary'}">${c.porcentajeCumplimiento}%</span>
        </div>
        <div class="text-end">
          <span class="text-muted small d-block fw-bold">DICTAMEN OFICIAL:</span>
          <span class="badge ${c.estado === 'CONFORME' ? 'bg-success' : (c.estado === 'OBSERVADO' ? 'bg-warning text-dark' : 'bg-danger')} fs-6 px-3 py-1.5">${c.estado}</span>
        </div>
      </div>

      <!-- Observaciones y Plazo -->
      <div class="row g-2 mb-3" style="font-size: 0.82rem;">
        <div class="col-md-8">
          <strong>Observaciones y Recomendaciones Generales:</strong>
          <p class="text-muted p-2 bg-light rounded border mb-0 mt-1">${c.observacionesGenerales || 'Sin observaciones adicionales.'}</p>
        </div>
        <div class="col-md-4">
          <strong>Fecha Límite de Subsanación:</strong>
          <p class="text-dark fw-bold p-2 bg-light rounded border mb-0 mt-1">${c.plazoSubsanacion || 'No aplica'}</p>
        </div>
      </div>

      <!-- Firmas Oficiales -->
      <div class="pt-4 mt-4 border-top d-flex justify-content-around text-center" style="font-size: 0.78rem;">
        <div style="width: 220px;">
          <div style="border-top: 1.5px solid #333; padding-top: 5px; font-weight: 600;">Firma del Docente</div>
          <small class="text-muted">${c.docente}</small>
        </div>
        <div style="width: 220px;">
          <div style="border-top: 1.5px solid #333; padding-top: 5px; font-weight: 600;">Firma y Sello de Auditor</div>
          <small class="text-muted">Dirección de Escuela de Industrial</small>
        </div>
      </div>
    </div>
  `;

  if (carpetaDetailModalInstance) carpetaDetailModalInstance.show();
}

function exportCarpetasExcel() {
  if (allCarpetas.length === 0) {
    alert('No hay registros de supervisión de carpetas para exportar.');
    return;
  }

  const rows = allCarpetas.map(c => {
    const it = c.items || {};
    return {
      'Código Ficha': c.id,
      'Fecha Auditoría': c.fecha,
      'Semana Revisión': c.semana,
      'Docente': c.docente,
      'Escuela Profesional': c.escuela || 'INGENIERÍA INDUSTRIAL',
      'Asignatura': c.curso,
      'Ciclo': c.ciclo,
      'Sección': c.seccion || 'A1',
      'Auditor / Responsable': c.auditor,
      '1. Sílabo': it.silabo?.cumple ? 'CUMPLE' : 'NO CUMPLE',
      '2. Sesiones': it.sesiones?.cumple ? 'CUMPLE' : 'NO CUMPLE',
      '3. Materiales': it.materiales?.cumple ? 'CUMPLE' : 'NO CUMPLE',
      '4. Asistencia': it.asistencia?.cumple ? 'CUMPLE' : 'NO CUMPLE',
      '5. Rúbricas': it.rubricas?.cumple ? 'CUMPLE' : 'NO CUMPLE',
      '6. Evidencias': it.evidencias?.cumple ? 'CUMPLE' : 'NO CUMPLE',
      '7. Tutoría': it.tutoria?.cumple ? 'CUMPLE' : 'NO CUMPLE',
      '% Cumplimiento': `${c.porcentajeCumplimiento}%`,
      'Dictamen Estado': c.estado,
      'Plazo Subsanación': c.plazoSubsanacion || '-',
      'Observaciones Generales': c.observacionesGenerales || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Supervision_Carpetas");
  XLSX.writeFile(wb, "Reporte_Supervision_Carpetas_Docentes_Industrial.xlsx");
  showFeedback('Reporte de Supervisión de Carpetas Docentes exportado a Excel exitosamente.', 'success');
}


