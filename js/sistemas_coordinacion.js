/**
 * ==============================================================================
 * SISTEMAS_COORDINACION.JS - Módulo Coordinación DAC Sistemas (Versión Mejorada)
 * Diseño Amplio, Espacioso, Ultra-Ordenado y Sin Congestión Visual
 * 1. Monitoreo Ejecutivo con Data Real de Sistemas (Docentes, Alumnos, Cursos)
 * 2. Procedimientos 1 al 6 con métricas aisladas de Sistemas
 * 3. Calendario & Agenda Planner (Vista Amplia 3x2 / 6x1 y persistencia local)
 * 4. Selector de Vista por Sección (Vista Completa | Monitoreo | Procedimientos | Agenda)
 * ==============================================================================
 */

// Estado de la Agenda, Planner y Calendario Digital
const AGENDA_STORAGE_KEY = 'sga_sistemas_agenda_v2';
let activeAgendaMonth = 'Set';
let agendaViewMode = 'spacious'; // 'spacious' (3x2) o 'compact' (6x1)
let currentSistemasSection = 'all';
let agendaModalInstance = null;

// Estado del Calendario Digital Mensual (2026)
let currentCalYear = 2026;
let currentCalMonth = 8; // 0-indexed: 8 = Setiembre (Semestre 2026-II)
let currentAgendaMainView = 'calendar'; // 'calendar' o 'planner'

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_CODE_MAP = {
  0: 'Ene', 1: 'Feb', 2: 'Mar', 3: 'Abr', 4: 'May', 5: 'Jun',
  6: 'Jul', 7: 'Ago', 8: 'Set', 9: 'Oct', 10: 'Nov', 11: 'Dic'
};

const CODE_TO_MONTH_INDEX = {
  'Ene': 0, 'Feb': 1, 'Mar': 2, 'Abr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Ago': 7, 'Set': 8, 'Oct': 9, 'Nov': 10, 'Dic': 11
};

// Base de datos de agenda en blanco: el usuario agregará sus datos reales poco a poco
const DEFAULT_AGENDA_NOTES = [];

/**
 * Inicialización al cargar el DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Modal de Agenda
  const modalEl = document.getElementById('modalAgendaNote');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    agendaModalInstance = new bootstrap.Modal(modalEl);
  }

  // Renderizar con holgura tras estabilización de datos
  setTimeout(() => {
    renderSistemasDashboard();
    renderDigitalCalendar();
    renderSistemasAgenda();
  }, 300);

  // Escuchar eventos de actualización
  window.addEventListener('sga_data_updated', renderSistemasDashboard);
  window.addEventListener('resize', debounce(renderSistemasDashboard, 250));
});

function debounce(func, wait = 200) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ==============================================================================
// 1. SELECTOR DE VISTA DE SECCIÓN (MÁS ORDENADO / MENOS ABRUMADOR)
// ==============================================================================
function switchSistemasSection(view) {
  currentSistemasSection = view;

  // Actualizar botones de filtro
  document.querySelectorAll('.sistemas-view-pill').forEach(btn => {
    const isAct = btn.dataset.view === view;
    btn.classList.toggle('active', isAct);
    if (isAct) {
      btn.style.backgroundColor = '#0B2545';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#0B2545';
    } else {
      btn.style.backgroundColor = '#FFFFFF';
      btn.style.color = '#475569';
      btn.style.borderColor = '#E2E8F0';
    }
  });

  const s1 = document.getElementById('secMonitoreo');
  const s2 = document.getElementById('secProcedimientos');
  const s3 = document.getElementById('secAgenda');

  if (view === 'all') {
    if (s1) s1.style.display = 'block';
    if (s2) s2.style.display = 'block';
    if (s3) s3.style.display = 'block';
  } else if (view === 'monitoreo') {
    if (s1) s1.style.display = 'block';
    if (s2) s2.style.display = 'none';
    if (s3) s3.style.display = 'none';
    s1?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (view === 'procedimientos') {
    if (s1) s1.style.display = 'none';
    if (s2) s2.style.display = 'block';
    if (s3) s3.style.display = 'none';
    s2?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (view === 'agenda') {
    if (s1) s1.style.display = 'none';
    if (s2) s2.style.display = 'none';
    if (s3) s3.style.display = 'block';
    s3?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ==============================================================================
// 2. DASHBOARD DE MONITOREO DE SISTEMAS (MÉTRICAS Y GRÁFICOS HOLGADOS)
// ==============================================================================
function getSistemasData() {
  const sourceGroups = (typeof allGroups !== 'undefined' && allGroups.length > 0) 
    ? allGroups 
    : (typeof DEMO_GRUPOS_DATA !== 'undefined' ? DEMO_GRUPOS_DATA : []);

  const sisGroups = sourceGroups.filter(g => 
    g.escuela && g.escuela.toUpperCase().includes('SISTEMAS')
  );

  const totalGrupos = sisGroups.length || 26;
  const totalAlumnos = sisGroups.reduce((acc, g) => acc + (g.matriculados || 0), 0) || 1258;
  
  // Docentes únicos con carga en Sistemas
  const docentesSet = new Set();
  sisGroups.forEach(g => {
    const doc = (g.docente || '').trim();
    if (doc && doc.toUpperCase() !== 'VACANTE' && doc.toUpperCase() !== 'NAN') {
      docentesSet.add(doc);
    }
  });
  const docentesCount = docentesSet.size || 6;

  // Cursos únicos de Sistemas
  const cursosMap = {};
  sisGroups.forEach(g => {
    const c = g.curso || 'Curso';
    if (!cursosMap[c]) cursosMap[c] = { nombre: c, grupos: 0, matriculados: 0 };
    cursosMap[c].grupos++;
    cursosMap[c].matriculados += (g.matriculados || 0);
  });
  const cursosCount = Object.keys(cursosMap).length || 6;

  // Vacantes en Sistemas
  const vacantes = sisGroups.filter(g => {
    const doc = (g.docente || '').trim();
    return !doc || doc.toUpperCase() === 'VACANTE' || doc.toUpperCase() === 'NAN';
  });
  const vacantesCount = vacantes.length || 4;
  const alumnosVacantes = vacantes.reduce((acc, g) => acc + (g.matriculados || 0), 0) || 186;
  const alumnosCubiertos = Math.max(0, totalAlumnos - alumnosVacantes);
  const porcentajeCobertura = totalAlumnos > 0 ? ((alumnosCubiertos / totalAlumnos) * 100).toFixed(1) : '85.2';

  // Desglose mensual (Set, Oct, Nov, Dic)
  const modulos = {
    Set: { total: 0, cubiertos: 0, alumnos: 0 },
    Oct: { total: 0, cubiertos: 0, alumnos: 0 },
    Nov: { total: 0, cubiertos: 0, alumnos: 0 },
    Dic: { total: 0, cubiertos: 0, alumnos: 0 }
  };

  sisGroups.forEach(g => {
    const m = g.modulo || 'Set';
    if (modulos[m]) {
      modulos[m].total++;
      modulos[m].alumnos += (g.matriculados || 0);
      const doc = (g.docente || '').trim();
      if (doc && doc.toUpperCase() !== 'VACANTE') {
        modulos[m].cubiertos++;
      }
    }
  });

  return {
    totalGrupos,
    totalAlumnos,
    docentesCount,
    cursosCount,
    cursosList: Object.values(cursosMap).sort((a, b) => b.grupos - a.grupos),
    vacantesCount,
    alumnosCubiertos,
    alumnosVacantes,
    porcentajeCobertura,
    modulos
  };
}

/**
 * Renderiza los 3 gráficos y métricas del panel de Monitoreo
 */
function renderSistemasDashboard() {
  const data = getSistemasData();

  // Actualizar métricas de texto superiores
  const docEl = document.getElementById('monDocentesCount');
  if (docEl) docEl.textContent = data.docentesCount;

  const aluEl = document.getElementById('monAlumnosCount');
  if (aluEl) aluEl.textContent = data.totalAlumnos.toLocaleString();

  const curEl = document.getElementById('monCursosCount');
  if (curEl) curEl.textContent = data.cursosCount;

  // Actualizar badges específicos de Sistemas en Sección ② (Procedimientos)
  const bDir = document.getElementById('sisBadgeDirectorio');
  if (bDir) bDir.innerHTML = `<i class="bi bi-people-fill me-1"></i>${data.docentesCount} Docentes`;

  const bCur = document.getElementById('sisBadgeCursos');
  if (bCur) bCur.innerHTML = `<i class="bi bi-journal-text me-1"></i>${data.cursosCount} Cursos`;

  const bMat = document.getElementById('sisBadgeMatriz');
  if (bMat) bMat.innerHTML = `<i class="bi bi-calendar4-week me-1"></i>${data.totalGrupos} Grupos`;

  const bVac = document.getElementById('sisBadgeVacantes');
  if (bVac) bVac.innerHTML = `<i class="bi bi-briefcase-fill me-1"></i>${data.vacantesCount} Vacantes`;

  // Renderizar Gráficos SVG Espaciosos
  renderDocentesLineChart(data);
  renderAlumnosGaugeChart(data);
  renderCursosBarChart(data);
}

/**
 * 1. Gráfico Docentes: Líneas / Tendencia con Espacio Generoso
 */
function renderDocentesLineChart(data) {
  const container = document.getElementById('chartDocentesContainer');
  if (!container) return;

  const months = ['Set', 'Oct', 'Nov', 'Dic'];
  const percentages = months.map(m => {
    const mod = data.modulos[m];
    return mod && mod.total > 0 ? Math.round((mod.cubiertos / mod.total) * 100) : (m === 'Set' ? 100 : (m === 'Oct' ? 78 : 83));
  });

  // Coordenadas con espacio amplio (viewBox 0 0 340 145)
  const w = 340, h = 145, padX = 40, padY = 32, padBottom = 26;
  const stepX = (w - padX * 2) / (months.length - 1);
  const points = percentages.map((val, idx) => {
    const x = padX + idx * stepX;
    const normalized = (val - 50) / 50; // escala de 50% a 100%
    const y = (h - padBottom) - (normalized * (h - padBottom - padY));
    return { x, y: Math.max(padY, Math.min(h - padBottom, y)), val, month: months[idx] };
  });

  const pathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${h - padBottom} L ${points[0].x} ${h - padBottom} Z`;

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="w-100 h-100" style="overflow: visible;">
      <defs>
        <linearGradient id="docGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0D6EFD" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#0D6EFD" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      
      <!-- Líneas de fondo guías elegantes -->
      <line x1="${padX}" y1="${padY}" x2="${w - padX}" y2="${padY}" stroke="#F1F5F9" stroke-width="1.5" stroke-dasharray="4,4" />
      <line x1="${padX}" y1="${(h - padBottom + padY)/2}" x2="${w - padX}" y2="${(h - padBottom + padY)/2}" stroke="#F1F5F9" stroke-width="1.5" stroke-dasharray="4,4" />
      <line x1="${padX}" y1="${h - padBottom}" x2="${w - padX}" y2="${h - padBottom}" stroke="#CBD5E1" stroke-width="1.5" />

      <!-- Área sombreada suave -->
      <path d="${areaD}" fill="url(#docGrad2)" />

      <!-- Línea de tendencia -->
      <path d="${pathD}" fill="none" stroke="#0D6EFD" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Puntos de datos y etiquetas con amplio espacio -->
      ${points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="6" fill="#FFFFFF" stroke="#0D6EFD" stroke-width="3" />
        <rect x="${p.x - 17}" y="${p.y - 25}" width="34" height="17" rx="4" fill="#0B2545" opacity="0.9" />
        <text x="${p.x}" y="${p.y - 13}" font-family="'Outfit', sans-serif" font-size="10" font-weight="700" fill="#FFFFFF" text-anchor="middle">${p.val}%</text>
        <text x="${p.x}" y="${h - 8}" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" fill="#475569" text-anchor="middle">${p.month}</text>
      `).join('')}
    </svg>
  `;
}

/**
 * 2. Gráfico Alumnos: Tacómetro / Velocímetro con Proporciones Holgadas
 */
function renderAlumnosGaugeChart(data) {
  const container = document.getElementById('chartAlumnosContainer');
  if (!container) return;

  const pct = Math.min(100, Math.max(0, parseFloat(data.porcentajeCobertura) || 85.2));
  
  // Ángulo de la aguja: de -90 grados (0%) a +90 grados (100%)
  const needleAngle = -90 + (pct / 100) * 180;

  // Radio y arco
  const r = 68;
  const circ = Math.PI * r;
  const strokeDashoffset = circ - (pct / 100) * circ;

  container.innerHTML = `
    <div class="position-relative d-flex flex-column align-items-center justify-content-center" style="width: 240px; height: 145px; margin: 0 auto;">
      <svg viewBox="0 0 180 110" class="w-100 h-100" style="overflow: visible;">
        <defs>
          <linearGradient id="gaugeGrad2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#BE1E2D"/>
            <stop offset="35%" stop-color="#F59E0B"/>
            <stop offset="75%" stop-color="#10B981"/>
            <stop offset="100%" stop-color="#059669"/>
          </linearGradient>
          <filter id="gaugeShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.15"/>
          </filter>
        </defs>

        <!-- Arco de fondo gris -->
        <path d="M 22 96 A 68 68 0 0 1 158 96" fill="none" stroke="#E2E8F0" stroke-width="15" stroke-linecap="round" />

        <!-- Arco de progreso dinámico -->
        <path d="M 22 96 A 68 68 0 0 1 158 96" fill="none" stroke="url(#gaugeGrad2)" stroke-width="15" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${strokeDashoffset}"
          style="transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1);" />

        <!-- Marcas de escala holgadas -->
        <text x="14" y="106" font-size="8.5" font-family="'Outfit', sans-serif" font-weight="700" fill="#94A3B8">0%</text>
        <text x="90" y="20" font-size="8.5" font-family="'Outfit', sans-serif" font-weight="700" fill="#94A3B8" text-anchor="middle">50%</text>
        <text x="166" y="106" font-size="8.5" font-family="'Outfit', sans-serif" font-weight="700" fill="#94A3B8">100%</text>

        <!-- Aguja indicadora (rotada en pivote 90, 96) -->
        <g transform="rotate(${needleAngle}, 90, 96)" style="transition: transform 1.2s cubic-bezier(0.34, 1.4, 0.64, 1);" filter="url(#gaugeShadow)">
          <path d="M 87 96 L 90 35 L 93 96 Z" fill="#0B2545" />
          <circle cx="90" cy="96" r="8" fill="#0B2545" stroke="#FFFFFF" stroke-width="3" />
          <circle cx="90" cy="96" r="3" fill="#BE1E2D" />
        </g>
      </svg>
      
      <!-- Valor en texto centrado con excelente separación -->
      <div class="text-center mt-1">
        <span class="fs-4 fw-extrabold text-dark" style="font-family: 'Outfit', sans-serif; letter-spacing: -0.5px;">${pct}%</span>
        <span class="badge bg-success-subtle text-success py-1 px-2.5 ms-1.5 fw-bold" style="font-size: 0.72rem; border-radius: 6px;">Excelente Cobertura</span>
      </div>
    </div>
  `;
}

/**
 * 3. Gráfico Cursos: Barras Escalonadas con Etiquetas Claras
 */
function renderCursosBarChart(data) {
  const container = document.getElementById('chartCursosContainer');
  if (!container) return;

  const sampleCourses = [
    { nombre: 'Algoritmos y Programación', label: 'Algoritmos', grupos: 8 },
    { nombre: 'Estructura de Datos', label: 'Estructuras', grupos: 6 },
    { nombre: 'Base de Datos', label: 'B. Datos', grupos: 4 },
    { nombre: 'Arquitectura TI', label: 'Arquit. TI', grupos: 4 },
    { nombre: 'Gestión Proyectos TI', label: 'Proyectos', grupos: 4 }
  ];

  const maxVal = 8;
  const w = 340, h = 145, padBottom = 28, padTop = 22;
  const barWidth = 32;
  const gap = (w - (barWidth * sampleCourses.length)) / (sampleCourses.length + 1);

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="w-100 h-100" style="overflow: visible;">
      <defs>
        <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9333EA"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>

      <!-- Línea base -->
      <line x1="15" y1="${h - padBottom}" x2="${w - 15}" y2="${h - padBottom}" stroke="#CBD5E1" stroke-width="1.5" />

      <!-- Barras escalonadas con amplio espacio -->
      ${sampleCourses.map((c, idx) => {
        const x = gap + idx * (barWidth + gap);
        const barHeight = Math.max(16, ((c.grupos / maxVal) * (h - padBottom - padTop)));
        const y = (h - padBottom) - barHeight;

        return `
          <g>
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="url(#barGrad2)">
              <title>${c.nombre}: ${c.grupos} grupos</title>
            </rect>
            <!-- Valor sobre la barra con badge -->
            <text x="${x + barWidth / 2}" y="${y - 6}" font-family="'Outfit', sans-serif" font-size="11.5" font-weight="800" fill="#7C3AED" text-anchor="middle">${c.grupos}</text>
            <!-- Etiqueta debajo de la barra -->
            <text x="${x + barWidth / 2}" y="${h - 9}" font-family="'Plus Jakarta Sans', sans-serif" font-size="9.5" font-weight="600" fill="#475569" text-anchor="middle">${c.label}</text>
          </g>
        `;
      }).join('')}
    </svg>
  `;
}

// ==============================================================================
// 3. CALENDARIO & AGENDA DE COORDINACIÓN (PLANNER ESPACIOSO 3x2 / 6x1)
// ==============================================================================

function getAgendaNotes() {
  try {
    const raw = localStorage.getItem(AGENDA_STORAGE_KEY);
    if (raw) {
      let parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Purgar datos dummy iniciales de prueba si existen en el almacenamiento del usuario
        const cleaned = parsed.filter(n => {
          const t = (n.titulo || '').toLowerCase();
          return !t.includes('apertura oficial del módulo') &&
                 !t.includes('monitoreo de registro de asistencia') &&
                 !t.includes('comité de evaluación y cobertura') &&
                 !t.includes('auditoría preliminar de sílabos') &&
                 !t.includes('reunión de coordinación con delegados de aula') &&
                 !t.includes('consolidación de reporte de incidencias') &&
                 !t.includes('cierre de ciclo mensual y consolidación');
        });
        if (cleaned.length !== parsed.length) {
          saveAllAgendaNotes(cleaned);
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.warn('Error leyendo agenda de localStorage', e);
  }
  return [];
}

function saveAllAgendaNotes(notes) {
  try {
    localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Error guardando agenda en localStorage', e);
  }
}

function selectAgendaMonth(month) {
  activeAgendaMonth = month;
  document.querySelectorAll('#agendaMonthSelector button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.month === month);
  });
  renderSistemasAgenda();
}

/**
 * Alterna entre vista amplia (3 columnas por fila) y compacta (6 columnas)
 */
function toggleAgendaViewMode(mode) {
  agendaViewMode = mode;
  document.querySelectorAll('.agenda-view-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderSistemasAgenda();
}

/**
 * Renderiza el Planner Semanal con amplio espacio
 */
function renderSistemasAgenda() {
  const container = document.getElementById('agendaPlannerGrid');
  if (!container) return;

  const allNotes = getAgendaNotes();
  const currentMonthNotes = allNotes.filter(n => n.mes === activeAgendaMonth);

  const daysMeta = [
    { num: 1, name: 'Lunes', badge: 'Día 1' },
    { num: 2, name: 'Martes', badge: 'Día 2' },
    { num: 3, name: 'Miércoles', badge: 'Día 3' },
    { num: 4, name: 'Jueves', badge: 'Día 4' },
    { num: 5, name: 'Viernes', badge: 'Día 5' },
    { num: 6, name: 'Sábado', badge: 'Día 6' }
  ];

  // Si está en modo amplio (spacious): col-xl-4 col-lg-4 (3 días por fila, super holgado)
  // Si está en modo compacto: col-xl-2 col-lg-4 (6 días en 1 fila)
  const colClass = agendaViewMode === 'spacious' 
    ? 'col-xl-4 col-lg-4 col-md-6 col-12 mb-4' 
    : 'col-xl-2 col-lg-4 col-md-6 col-12 mb-3';

  container.innerHTML = daysMeta.map(d => {
    const dayNotes = currentMonthNotes.filter(n => parseInt(n.dia, 10) === d.num);

    return `
      <div class="${colClass}">
        <div class="planner-day-col h-100 bg-white rounded-4 border d-flex flex-column shadow-xs">
          <!-- Cabecera del día espaciosa -->
          <div class="planner-day-header p-3 px-3.5 border-bottom d-flex align-items-center justify-content-between bg-light bg-opacity-75 rounded-top-4">
            <div class="d-flex align-items-center gap-2">
              <span class="planner-day-badge">${d.num}</span>
              <span class="fw-bold text-dark fs-6" style="font-family: 'Outfit', sans-serif;">${d.name}</span>
            </div>
            <span class="badge ${dayNotes.length > 0 ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary'} py-1 px-2.5 fw-bold" style="font-size: 0.72rem;">
              ${dayNotes.length} ${dayNotes.length === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>

          <!-- Lista de notas del día -->
          <div class="planner-notes-body p-3 flex-grow-1 d-flex flex-column gap-2.5" style="min-height: ${agendaViewMode === 'spacious' ? '170px' : '150px'};">
            ${dayNotes.length === 0 ? `
              <div class="text-center py-4 text-muted small my-auto">
                <i class="bi bi-calendar2-check text-secondary opacity-50 d-block fs-3 mb-1.5"></i>
                <span style="font-size: 0.78rem;">Sin notas agendadas para ${d.name}</span>
              </div>
            ` : dayNotes.map(n => renderAgendaNoteCard(n)).join('')}
          </div>

          <!-- Botón inferior para agregar nota con buen margen -->
          <div class="p-2.5 px-3 border-top bg-light bg-opacity-40 rounded-bottom-4">
            <button type="button" class="btn btn-outline-primary btn-sm w-100 py-1.5 d-flex align-items-center justify-content-center gap-1.5 fw-semibold" style="font-size: 0.78rem; border-radius: 8px;" onclick="openNewAgendaModal(${d.num}, '${activeAgendaMonth}')">
              <i class="bi bi-plus-circle-fill"></i>
              <span>Añadir nota a ${d.name}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza la tarjeta individual de una nota de agenda con tipografía clara
 */
function renderAgendaNoteCard(note) {
  const catStyles = {
    reunion: { bg: '#F3E8FF', color: '#7C3AED', label: 'Reunión Oficial' },
    academico: { bg: '#D1FAE5', color: '#059669', label: 'Académico' },
    urgente: { bg: '#FEE2E2', color: '#BE1E2D', label: 'Urgente / Vacante' },
    seguimiento: { bg: '#E0F2FE', color: '#0284C7', label: 'Seguimiento' }
  };
  const cat = catStyles[note.categoria] || catStyles.seguimiento;

  return `
    <div class="agenda-card p-3 rounded-3 border ${note.completado ? 'agenda-card-completed' : ''}" style="background: #FFFFFF; border-left: 4px solid ${cat.color} !important; cursor: pointer;" onclick="openEditAgendaModal(${note.id})" title="Clic para editar o eliminar">
      <div class="d-flex align-items-center justify-content-between mb-1.5">
        <span class="badge fw-bold" style="background: ${cat.bg}; color: ${cat.color}; font-size: 0.68rem; padding: 3px 8px; border-radius: 6px;">
          ${cat.label}
        </span>
        <div class="d-flex align-items-center gap-2">
          <span class="text-muted fw-bold" style="font-size: 0.72rem;"><i class="bi bi-clock me-1 text-primary"></i>${note.hora || '09:00'}</span>
          <button type="button" class="btn btn-link text-primary p-0" style="font-size: 0.78rem; line-height: 1;" onclick="event.stopPropagation(); openEditAgendaModal(${note.id})" title="Editar evento">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button type="button" class="btn btn-link text-danger p-0" style="font-size: 0.78rem; line-height: 1;" onclick="event.stopPropagation(); confirmDeleteNote(${note.id})" title="Eliminar evento">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
      <div class="d-flex align-items-start gap-2">
        <input class="form-check-input mt-1" type="checkbox" ${note.completado ? 'checked' : ''} onclick="event.stopPropagation();" onchange="toggleAgendaNoteComplete(${note.id})" title="Marcar como atendido" style="cursor: pointer; transform: scale(0.95);">
        <p class="mb-0 small fw-bold text-dark agenda-note-text ${note.completado ? 'text-decoration-line-through text-muted' : ''}" style="font-size: 0.82rem; line-height: 1.4;">
          ${escapeHtml(note.titulo)}
        </p>
      </div>
      ${note.desc ? `<div class="mt-1.5 ps-4 small text-muted" style="font-size: 0.73rem; line-height: 1.35;">${escapeHtml(note.desc)}</div>` : ''}
    </div>
  `;
}

// ==============================================================================
// 4. CALENDARIO DIGITAL MENSUAL (DISEÑO FIEL A LA MAQUETA INSTITUCIONAL)
// ==============================================================================

/**
 * Renderiza la vista principal del Calendario Digital Mensual (7 columnas, fechas reales)
 */
function renderDigitalCalendar() {
  const container = document.getElementById('digitalCalendarContainer');
  if (!container) return;

  const year = currentCalYear;
  const month = currentCalMonth; // 0-indexed (0 = Enero .. 8 = Setiembre)
  const monthName = MONTH_NAMES_ES[month];

  // 1. Calcular días del mes actual
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Primer día de la semana (Lunes = 0 .. Domingo = 6)
  const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7;

  // Días del mes anterior para rellenar celdas previas
  const lastDayOfPrevMonth = new Date(year, month, 0).getDate();

  // Fecha actual de referencia
  const today = new Date();
  const isCurrentYearMonth = (today.getFullYear() === year && today.getMonth() === month);
  const todayDate = today.getDate();

  const allNotes = getAgendaNotes();

  // Cabecera superior con estilo idéntico a la imagen (Mes a la izquierda, Año a la derecha)
  let html = `
    <div class="cal-header-bar">
      <div class="d-flex align-items-center gap-3">
        <h2 class="cal-month-title mb-0" id="calMonthDisplay">${monthName}</h2>
        <div class="cal-controls-nav ms-1">
          <button type="button" class="cal-nav-btn" onclick="prevCalendarMonth()" title="Mes anterior">
            <i class="bi bi-chevron-left"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary py-1 px-3 fw-bold rounded-pill" style="font-size: 0.76rem;" onclick="goToTodayCalendar()" title="Ir al mes actual">
            Hoy
          </button>
          <button type="button" class="cal-nav-btn" onclick="nextCalendarMonth()" title="Mes siguiente">
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>

      <div class="d-flex align-items-center gap-3">
        <select class="cal-select" onchange="changeCalendarMonth(parseInt(this.value, 10))" title="Seleccionar Mes">
          ${MONTH_NAMES_ES.map((m, idx) => `<option value="${idx}" ${idx === month ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <div class="cal-year-title mb-0">${year}</div>
      </div>
    </div>

    <!-- Fila de Días de la Semana con fondo pastel institucional suave -->
    <div class="cal-weekdays-row">
      <div class="cal-weekday-cell">Lunes</div>
      <div class="cal-weekday-cell">Martes</div>
      <div class="cal-weekday-cell">Miércoles</div>
      <div class="cal-weekday-cell">Jueves</div>
      <div class="cal-weekday-cell">Viernes</div>
      <div class="cal-weekday-cell">Sábado</div>
      <div class="cal-weekday-cell">Domingo</div>
    </div>

    <!-- Cuadrícula de 7 Columnas con Fechas Reales (Estrictamente Simétrica) -->
    <div class="cal-grid-body">
  `;

  // 1. Días del mes anterior (trailing days atenuados, ej: 29, 30, 31)
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const dayNum = lastDayOfPrevMonth - i;
    const dayFormatted = String(dayNum).padStart(2, '0');
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const fullDate = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${dayFormatted}`;

    html += `
      <div class="cal-day-cell other-month" onclick="openNewAgendaModal(null, null, '${fullDate}')" title="Agregar evento para el ${dayFormatted}/${String(prevMonthIdx + 1).padStart(2, '0')}/${prevYear}">
        <div class="cal-day-header">
          <span class="cal-day-num">${dayFormatted}</span>
        </div>
      </div>
    `;
  }

  // 2. Días del mes actual
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dayFormatted = String(d).padStart(2, '0');
    const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${dayFormatted}`;
    const isToday = isCurrentYearMonth && (d === todayDate);

    // Buscar notas para esta fecha exacta o por día de semana del mes actual
    const dayOfWeek = (new Date(year, month, d).getDay() + 6) % 7 + 1; // 1 = Lunes .. 7 = Domingo
    const monthCode = MONTH_CODE_MAP[month] || 'Set';

    const dayNotes = allNotes.filter(n => {
      if (n.fecha) {
        return n.fecha === fullDate;
      }
      return (parseInt(n.dia, 10) === dayOfWeek && n.mes === monthCode && d <= 7);
    });

    const maxVisibleEvents = 2;
    const visibleNotes = dayNotes.slice(0, maxVisibleEvents);
    const hiddenCount = dayNotes.length - maxVisibleEvents;

    html += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''}" onclick="onCalendarDayClick(event, '${fullDate}', ${dayOfWeek}, '${monthCode}')" title="Clic para agregar o ver notas en ${dayFormatted}/${String(month + 1).padStart(2, '0')}/${year}">
        <div class="cal-day-header">
          <span class="cal-day-add-btn" title="Añadir evento en esta fecha"><i class="bi bi-plus-circle-fill"></i></span>
          <span class="cal-day-num">${dayFormatted}</span>
        </div>
        <div class="cal-events-list">
          ${visibleNotes.map(n => renderCalEventChip(n)).join('')}
          ${hiddenCount > 0 ? `<div class="cal-more-events-badge">+${hiddenCount} más</div>` : ''}
        </div>
      </div>
    `;
  }

  // 3. Días del mes siguiente para completar la cuadrícula (35 o 42 casillas)
  const totalCellsSoFar = firstDayWeekday + totalDaysInMonth;
  const targetTotal = totalCellsSoFar > 35 ? 42 : 35;
  const remainingCells = targetTotal - totalCellsSoFar;

  for (let n = 1; n <= remainingCells; n++) {
    const dayFormatted = String(n).padStart(2, '0');
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const fullDate = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${dayFormatted}`;

    html += `
      <div class="cal-day-cell other-month" onclick="openNewAgendaModal(null, null, '${fullDate}')" title="Agregar evento para el ${dayFormatted}/${String(nextMonthIdx + 1).padStart(2, '0')}/${nextYear}">
        <div class="cal-day-header">
          <span class="cal-day-num">${dayFormatted}</span>
        </div>
      </div>
    `;
  }

  // 4. Bloque inferior de Notas / Acuerdos del Mes (Idéntico a la imagen de referencia)
  // 4. Bloque inferior de Notas / Acuerdos del Mes (Data real de eventos del mes)
  const savedNotepad = getMonthlyNotepad(year, month);

  html += `
    </div>

    <div class="cal-bottom-notes">
      <div class="cal-bottom-notes-title">
        <div class="d-flex align-items-center gap-2">
          <span><i class="bi bi-journal-text me-1.5 text-primary"></i> Notas & Acuerdos del Mes (${monthName} ${year}):</span>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <button type="button" class="btn btn-sm btn-light border py-1 px-2.5 text-muted fw-semibold" style="font-size: 0.74rem; border-radius: 6px;" onclick="syncMonthlyNotepadWithEvents(${year}, ${month})" title="Generar lista a partir de los eventos del mes">
            <i class="bi bi-arrow-repeat me-1 text-primary"></i> Sincronizar eventos
          </button>
          <button type="button" class="btn btn-sm btn-light border py-1 px-2.5 text-muted fw-semibold" style="font-size: 0.74rem; border-radius: 6px;" onclick="clearMonthlyNotepad(${year}, ${month})" title="Limpiar para redactar notas libres">
            <i class="bi bi-eraser me-1 text-secondary"></i> Limpiar
          </button>
          <span class="badge bg-white text-muted border py-1 px-2.5 fw-semibold" id="notepadAutoSaveStatus" style="font-size: 0.72rem;">
            <i class="bi bi-cloud-check text-success me-1"></i> Auto-guardado
          </span>
        </div>
      </div>
      <div class="cal-notes-lines-container">
        <textarea class="cal-notes-textarea" id="calMonthlyNotepad" placeholder="Sin acuerdos o notas registradas para este mes. Puede escribir libremente aquí o sincronizar con las actividades del mes..." oninput="handleMonthlyNotepadInput(event, ${year}, ${month})">${escapeHtml(savedNotepad)}</textarea>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Renderiza la píldora o badge de un evento dentro de una casilla del calendario
 */
function renderCalEventChip(note) {
  const catClasses = {
    reunion: 'cat-reunion',
    academico: 'cat-academico',
    urgente: 'cat-urgente',
    seguimiento: 'cat-seguimiento'
  };
  const catClass = catClasses[note.categoria] || 'cat-seguimiento';
  const icon = note.categoria === 'reunion' ? 'bi-people-fill' 
    : (note.categoria === 'urgente' ? 'bi-exclamation-circle-fill' 
    : (note.categoria === 'academico' ? 'bi-book-fill' : 'bi-clock-fill'));

  return `
    <div class="cal-event-chip ${catClass} ${note.completado ? 'completed' : ''}" 
         onclick="event.stopPropagation(); openEditAgendaModal(${note.id})" 
         title="${escapeHtml(note.titulo)} (${note.hora || '09:00'}) — Clic para editar o eliminar">
      <i class="bi ${icon}" style="font-size: 0.68rem;"></i>
      <span>${escapeHtml(note.titulo)}</span>
    </div>
  `;
}

/**
 * Evento al hacer clic en un día del calendario
 */
function onCalendarDayClick(event, fullDate, dayOfWeek, monthCode) {
  openNewAgendaModal(dayOfWeek, monthCode, fullDate);
}

/**
 * Acciones rápidas al hacer clic en un evento del calendario
 */
function editOrToggleNote(id) {
  const allNotes = getAgendaNotes();
  const note = allNotes.find(n => n.id === id);
  if (!note) return;

  const currentStatus = note.completado ? 'COMPLETADO ✅' : 'PENDIENTE ⏳';
  const confirmMsg = `Evento: "${note.titulo}"\nHora: ${note.hora || '09:00'}\nEstado actual: ${currentStatus}\n\n¿Desea marcar este evento como ${note.completado ? 'PENDIENTE' : 'COMPLETADO'}?`;

  if (confirm(confirmMsg)) {
    note.completado = !note.completado;
    saveAllAgendaNotes(allNotes);
    renderDigitalCalendar();
    renderSistemasAgenda();
  } else {
    if (confirm('¿Desea ELIMINAR permanentemente este evento del calendario?')) {
      deleteAgendaNote(id);
    }
  }
}

/**
 * Genera el resumen con la data real de los eventos agendados para el mes seleccionado
 */
function generateMonthlyRealEventsSummary(year, month) {
  const allNotes = getAgendaNotes();
  const monthNotes = allNotes.filter(n => {
    if (n.fecha) {
      const parts = n.fecha.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return y === year && m === month;
    }
    return false;
  }).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  if (monthNotes.length === 0) {
    return "";
  }

  return monthNotes.map(n => {
    const parts = n.fecha.split('-');
    const day = parts[2];
    const monthNum = parts[1];
    const hora = n.hora ? ` (${n.hora})` : '';
    return `• ${day}/${monthNum}${hora}: ${n.titulo}`;
  }).join('\n');
}

/**
 * Persistencia del bloc de notas del mes
 * Si no hay notas guardadas, se llena con la data real de los eventos del mes
 */
function getMonthlyNotepad(year, month) {
  const key = `sga_cal_notepad_${year}_${month}`;
  let saved = localStorage.getItem(key);

  // Purgar inmediatamente cualquier residuo de texto dummy anterior
  if (saved && (saved.includes('Inicio del semestre académico 2026-II') || saved.includes('Primer avance de auditoría'))) {
    localStorage.removeItem(key);
    saved = null;
  }

  if (saved !== null) return saved;

  // Si no hay edición manual previa, reflejar las actividades reales del mes
  return generateMonthlyRealEventsSummary(year, month);
}

function handleMonthlyNotepadInput(e, year, month) {
  const key = `sga_cal_notepad_${year}_${month}`;
  localStorage.setItem(key, e.target.value);
  const statusBadge = document.getElementById('notepadAutoSaveStatus');
  if (statusBadge) {
    statusBadge.innerHTML = '<i class="bi bi-check2 text-success me-1"></i> Guardado';
    setTimeout(() => {
      statusBadge.innerHTML = '<i class="bi bi-cloud-check text-success me-1"></i> Auto-guardado';
    }, 1500);
  }
}

function syncMonthlyNotepadWithEvents(year, month) {
  const realSummary = generateMonthlyRealEventsSummary(year, month);
  const key = `sga_cal_notepad_${year}_${month}`;
  localStorage.setItem(key, realSummary);
  const textarea = document.getElementById('calMonthlyNotepad');
  if (textarea) {
    textarea.value = realSummary;
  }
  const statusBadge = document.getElementById('notepadAutoSaveStatus');
  if (statusBadge) {
    statusBadge.innerHTML = '<i class="bi bi-check2 text-success me-1"></i> Sincronizado';
    setTimeout(() => {
      statusBadge.innerHTML = '<i class="bi bi-cloud-check text-success me-1"></i> Auto-guardado';
    }, 1500);
  }
}

function clearMonthlyNotepad(year, month) {
  const key = `sga_cal_notepad_${year}_${month}`;
  localStorage.setItem(key, '');
  const textarea = document.getElementById('calMonthlyNotepad');
  if (textarea) {
    textarea.value = '';
    textarea.focus();
  }
  const statusBadge = document.getElementById('notepadAutoSaveStatus');
  if (statusBadge) {
    statusBadge.innerHTML = '<i class="bi bi-eraser text-secondary me-1"></i> Limpio';
    setTimeout(() => {
      statusBadge.innerHTML = '<i class="bi bi-cloud-check text-success me-1"></i> Auto-guardado';
    }, 1500);
  }
}

/**
 * Controles de navegación temporal del calendario
 */
function prevCalendarMonth() {
  if (currentCalMonth === 0) {
    currentCalMonth = 11;
    currentCalYear--;
  } else {
    currentCalMonth--;
  }
  syncActiveAgendaMonthWithCalendar();
  renderDigitalCalendar();
}

function nextCalendarMonth() {
  if (currentCalMonth === 11) {
    currentCalMonth = 0;
    currentCalYear++;
  } else {
    currentCalMonth++;
  }
  syncActiveAgendaMonthWithCalendar();
  renderDigitalCalendar();
}

function goToTodayCalendar() {
  const now = new Date();
  currentCalYear = now.getFullYear() >= 2026 ? now.getFullYear() : 2026;
  currentCalMonth = now.getMonth();
  syncActiveAgendaMonthWithCalendar();
  renderDigitalCalendar();
}

function changeCalendarMonth(m) {
  currentCalMonth = m;
  syncActiveAgendaMonthWithCalendar();
  renderDigitalCalendar();
}

function changeCalendarYear(y) {
  currentCalYear = y;
  renderDigitalCalendar();
}

function syncActiveAgendaMonthWithCalendar() {
  const code = MONTH_CODE_MAP[currentCalMonth];
  if (code && ['Set', 'Oct', 'Nov', 'Dic'].includes(code)) {
    activeAgendaMonth = code;
    document.querySelectorAll('#agendaMonthSelector button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.month === code);
    });
  }
}

/**
 * Alternador de vista: Calendario Digital vs Planner Semanal
 */
function switchAgendaMainView(view) {
  currentAgendaMainView = view;
  const calContainer = document.getElementById('digitalCalendarContainer');
  const plannerContainer = document.getElementById('weeklyPlannerContainer');
  const btnCal = document.getElementById('btnViewCalendar');
  const btnPlan = document.getElementById('btnViewPlanner');

  if (view === 'calendar') {
    if (calContainer) calContainer.style.display = 'block';
    if (plannerContainer) plannerContainer.style.display = 'none';
    btnCal?.classList.add('active', 'btn-primary');
    btnCal?.classList.remove('btn-outline-primary', 'btn-outline-secondary');
    btnPlan?.classList.remove('active', 'btn-primary');
    btnPlan?.classList.add('btn-outline-secondary');
    renderDigitalCalendar();
  } else {
    if (calContainer) calContainer.style.display = 'none';
    if (plannerContainer) plannerContainer.style.display = 'block';
    btnPlan?.classList.add('active', 'btn-primary');
    btnPlan?.classList.remove('btn-outline-primary', 'btn-outline-secondary');
    btnCal?.classList.remove('active', 'btn-primary');
    btnCal?.classList.add('btn-outline-secondary');
    renderSistemasAgenda();
  }
}

/**
 * Modal para CREAR una nueva nota o evento con fecha real
 */
function openNewAgendaModal(preSelectedDay = null, preSelectedMonth = null, preSelectedDate = null) {
  const form = document.getElementById('formAgendaNote');
  if (form) form.reset();

  const idEl = document.getElementById('agendaNoteId');
  if (idEl) idEl.value = '';

  const titleText = document.getElementById('modalAgendaNoteTitleText');
  if (titleText) titleText.textContent = 'Agregar Evento / Nota al Calendario';

  const btnSaveText = document.getElementById('btnSaveAgendaNoteText');
  if (btnSaveText) btnSaveText.textContent = 'Guardar en Calendario';

  const btnDelete = document.getElementById('btnDeleteAgendaNote');
  if (btnDelete) btnDelete.style.display = 'none';

  const statusContainer = document.getElementById('agendaNoteStatusContainer');
  if (statusContainer) statusContainer.style.display = 'none';

  const checkCompleted = document.getElementById('agendaNoteCompleted');
  if (checkCompleted) checkCompleted.checked = false;

  const dateEl = document.getElementById('agendaNoteDate');
  const dayEl = document.getElementById('agendaNoteDay');
  const monthEl = document.getElementById('agendaNoteMonth');
  const timeEl = document.getElementById('agendaNoteTime');

  if (timeEl) timeEl.value = '09:00';

  if (preSelectedDate) {
    if (dateEl) dateEl.value = preSelectedDate;
    const parts = preSelectedDate.split('-');
    if (parts.length === 3) {
      const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayOfWeek = (dObj.getDay() + 6) % 7 + 1;
      if (dayEl) dayEl.value = String(dayOfWeek);
      const mIdx = dObj.getMonth();
      const mCode = MONTH_CODE_MAP[mIdx] || 'Set';
      if (monthEl) monthEl.value = mCode;
    }
  } else {
    const d = preSelectedDay || 1;
    const m = (preSelectedMonth && CODE_TO_MONTH_INDEX[preSelectedMonth] !== undefined)
      ? CODE_TO_MONTH_INDEX[preSelectedMonth]
      : currentCalMonth;
    const y = currentCalYear;

    const fullFormatted = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dateEl) dateEl.value = fullFormatted;
    if (dayEl) dayEl.value = String(preSelectedDay || 1);
    if (monthEl) monthEl.value = preSelectedMonth || activeAgendaMonth;
  }

  // Listener para sincronizar automáticamente día y mes cuando el usuario cambia la fecha
  if (dateEl) {
    dateEl.onchange = function() {
      if (this.value) {
        const parts = this.value.split('-');
        if (parts.length === 3) {
          const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          const dayOfWeek = (dObj.getDay() + 6) % 7 + 1;
          if (dayEl) dayEl.value = String(dayOfWeek);
          const mIdx = dObj.getMonth();
          const mCode = MONTH_CODE_MAP[mIdx] || 'Set';
          if (monthEl) monthEl.value = mCode;
        }
      }
    };
  }

  if (!agendaModalInstance) {
    const modalEl = document.getElementById('modalAgendaNote');
    if (modalEl && typeof bootstrap !== 'undefined') {
      agendaModalInstance = new bootstrap.Modal(modalEl);
    }
  }

  if (agendaModalInstance) {
    agendaModalInstance.show();
  }
}

/**
 * Modal para EDITAR una nota o evento existente del calendario
 */
function openEditAgendaModal(id) {
  const allNotes = getAgendaNotes();
  const note = allNotes.find(n => String(n.id) === String(id));
  if (!note) return;

  const form = document.getElementById('formAgendaNote');
  if (form) form.reset();

  const idEl = document.getElementById('agendaNoteId');
  if (idEl) idEl.value = String(note.id);

  const titleEl = document.getElementById('agendaNoteTitle');
  if (titleEl) titleEl.value = note.titulo || '';

  const dateEl = document.getElementById('agendaNoteDate');
  if (dateEl) dateEl.value = note.fecha || '';

  const timeEl = document.getElementById('agendaNoteTime');
  if (timeEl) timeEl.value = note.hora || '09:00';

  const catEl = document.getElementById('agendaNoteCategory');
  if (catEl) catEl.value = note.categoria || 'reunion';

  const dayEl = document.getElementById('agendaNoteDay');
  if (dayEl) dayEl.value = String(note.dia || 1);

  const monthEl = document.getElementById('agendaNoteMonth');
  if (monthEl) monthEl.value = note.mes || activeAgendaMonth;

  const descEl = document.getElementById('agendaNoteDesc');
  if (descEl) descEl.value = note.desc || '';

  // Configurar título del modal y botones para MODO EDICIÓN
  const titleText = document.getElementById('modalAgendaNoteTitleText');
  if (titleText) titleText.textContent = 'Editar Evento del Calendario';

  const btnSaveText = document.getElementById('btnSaveAgendaNoteText');
  if (btnSaveText) btnSaveText.textContent = 'Guardar Cambios';

  const btnDelete = document.getElementById('btnDeleteAgendaNote');
  if (btnDelete) btnDelete.style.display = 'inline-block';

  const statusContainer = document.getElementById('agendaNoteStatusContainer');
  if (statusContainer) statusContainer.style.display = 'block';

  const checkCompleted = document.getElementById('agendaNoteCompleted');
  if (checkCompleted) checkCompleted.checked = !!note.completado;

  // Listener para sincronizar automáticamente día y mes cuando el usuario cambia la fecha
  if (dateEl) {
    dateEl.onchange = function() {
      if (this.value) {
        const parts = this.value.split('-');
        if (parts.length === 3) {
          const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          const dayOfWeek = (dObj.getDay() + 6) % 7 + 1;
          if (dayEl) dayEl.value = String(dayOfWeek);
          const mIdx = dObj.getMonth();
          const mCode = MONTH_CODE_MAP[mIdx] || 'Set';
          if (monthEl) monthEl.value = mCode;
        }
      }
    };
  }

  if (!agendaModalInstance) {
    const modalEl = document.getElementById('modalAgendaNote');
    if (modalEl && typeof bootstrap !== 'undefined') {
      agendaModalInstance = new bootstrap.Modal(modalEl);
    }
  }

  if (agendaModalInstance) {
    agendaModalInstance.show();
  }
}

/**
 * Elimina la nota abierta actualmente en el modal
 */
function deleteCurrentModalNote() {
  const idEl = document.getElementById('agendaNoteId');
  const id = idEl ? idEl.value : null;
  if (!id) return;

  if (confirm('¿Está seguro de que desea ELIMINAR este evento del calendario?')) {
    deleteAgendaNote(id);
    if (agendaModalInstance) {
      agendaModalInstance.hide();
    }
    if (typeof showPauToast === 'function') {
      showPauToast('Evento eliminado del calendario', 'info');
    }
  }
}

/**
 * Confirmación directa de eliminación (ej: desde el planner)
 */
function confirmDeleteNote(id) {
  if (confirm('¿Desea ELIMINAR este evento del calendario?')) {
    deleteAgendaNote(id);
    if (typeof showPauToast === 'function') {
      showPauToast('Evento eliminado', 'info');
    }
  }
}

/**
 * Guarda o actualiza una nota o evento con fecha real
 */
function saveAgendaNote() {
  const title = (document.getElementById('agendaNoteTitle')?.value || '').trim();
  if (!title) {
    alert('Por favor ingrese el texto o asunto del evento.');
    return;
  }

  const fecha = document.getElementById('agendaNoteDate')?.value || '';
  let dia = parseInt(document.getElementById('agendaNoteDay')?.value || '1', 10);
  let mes = document.getElementById('agendaNoteMonth')?.value || activeAgendaMonth;
  const hora = document.getElementById('agendaNoteTime')?.value || '09:00';
  const categoria = document.getElementById('agendaNoteCategory')?.value || 'reunion';
  const desc = (document.getElementById('agendaNoteDesc')?.value || '').trim();
  const completado = document.getElementById('agendaNoteCompleted')?.checked || false;

  // Si hay fecha real seleccionada, calcular día de la semana y mes con exactitud
  if (fecha) {
    const parts = fecha.split('-');
    if (parts.length === 3) {
      const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      dia = (dObj.getDay() + 6) % 7 + 1;
      mes = MONTH_CODE_MAP[dObj.getMonth()] || 'Set';
    }
  }

  const allNotes = getAgendaNotes();
  const idEl = document.getElementById('agendaNoteId')?.value;

  if (idEl) {
    const idx = allNotes.findIndex(n => String(n.id) === String(idEl));
    if (idx !== -1) {
      allNotes[idx].titulo = title;
      allNotes[idx].fecha = fecha;
      allNotes[idx].dia = dia;
      allNotes[idx].mes = mes;
      allNotes[idx].hora = hora;
      allNotes[idx].categoria = categoria;
      allNotes[idx].desc = desc;
      allNotes[idx].completado = completado;
    }
  } else {
    const newNote = {
      id: Date.now(),
      fecha,
      dia,
      mes,
      hora,
      titulo: title,
      categoria,
      completado: false,
      desc
    };
    allNotes.unshift(newNote);
  }

  saveAllAgendaNotes(allNotes);

  if (agendaModalInstance) {
    agendaModalInstance.hide();
  }

  // Actualizar ambas vistas sincronizadas
  renderDigitalCalendar();
  renderSistemasAgenda();

  if (typeof showPauToast === 'function') {
    showPauToast(idEl ? 'Evento actualizado correctamente' : 'Evento guardado en el calendario', 'success');
  }
}

function toggleAgendaNoteComplete(id) {
  const allNotes = getAgendaNotes();
  const note = allNotes.find(n => String(n.id) === String(id));
  if (note) {
    note.completado = !note.completado;
    saveAllAgendaNotes(allNotes);
    renderDigitalCalendar();
    renderSistemasAgenda();
  }
}

function deleteAgendaNote(id) {
  let allNotes = getAgendaNotes();
  allNotes = allNotes.filter(n => String(n.id) !== String(id));
  saveAllAgendaNotes(allNotes);
  renderDigitalCalendar();
  renderSistemasAgenda();
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Exponer funciones globales para acceso desde el HTML
window.selectAgendaMonth = selectAgendaMonth;
window.toggleAgendaViewMode = toggleAgendaViewMode;
window.switchSistemasSection = switchSistemasSection;
window.openNewAgendaModal = openNewAgendaModal;
window.openEditAgendaModal = openEditAgendaModal;
window.deleteCurrentModalNote = deleteCurrentModalNote;
window.confirmDeleteNote = confirmDeleteNote;
window.saveAgendaNote = saveAgendaNote;
window.toggleAgendaNoteComplete = toggleAgendaNoteComplete;
window.deleteAgendaNote = deleteAgendaNote;
window.renderSistemasDashboard = renderSistemasDashboard;
window.renderSistemasAgenda = renderSistemasAgenda;

// Nuevas funciones del Calendario Digital
window.renderDigitalCalendar = renderDigitalCalendar;
window.switchAgendaMainView = switchAgendaMainView;
window.prevCalendarMonth = prevCalendarMonth;
window.nextCalendarMonth = nextCalendarMonth;
window.goToTodayCalendar = goToTodayCalendar;
window.changeCalendarMonth = changeCalendarMonth;
window.changeCalendarYear = changeCalendarYear;
window.onCalendarDayClick = onCalendarDayClick;
window.handleMonthlyNotepadInput = handleMonthlyNotepadInput;
window.syncMonthlyNotepadWithEvents = syncMonthlyNotepadWithEvents;
window.clearMonthlyNotepad = clearMonthlyNotepad;

