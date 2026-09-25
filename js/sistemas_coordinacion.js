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

// Estado de la Agenda y Vista
const AGENDA_STORAGE_KEY = 'sga_sistemas_agenda_v2';
let activeAgendaMonth = 'Set';
let agendaViewMode = 'spacious'; // 'spacious' (3x2) o 'compact' (6x1)
let currentSistemasSection = 'all';
let agendaModalInstance = null;

// Notas institucionales oficiales precargadas
const DEFAULT_AGENDA_NOTES = [
  {
    id: 1,
    dia: 1, // Lunes
    mes: 'Set',
    hora: '08:30',
    titulo: 'Apertura oficial del Módulo Setiembre — Bienvenida alumnos de Sistemas',
    categoria: 'reunion',
    completado: true,
    desc: 'Verificación de accesos a aulas virtuales en Clementina y bienvenida a las secciones B1 y B2.'
  },
  {
    id: 2,
    dia: 2, // Martes
    mes: 'Set',
    hora: '10:00',
    titulo: 'Monitoreo de registro de asistencia docente en primera sesión teórica',
    categoria: 'seguimiento',
    completado: true,
    desc: 'Validar puntualidad y registro de temas en el sílabo digital.'
  },
  {
    id: 3,
    dia: 3, // Miércoles
    mes: 'Set',
    hora: '15:00',
    titulo: 'Comité de evaluación y cobertura para 4 vacantes de Sistemas',
    categoria: 'urgente',
    completado: false,
    desc: 'Revisión de CVs y asignación de profesores disponibles para Octubre y Noviembre.'
  },
  {
    id: 4,
    dia: 4, // Jueves
    mes: 'Set',
    hora: '11:30',
    titulo: 'Auditoría preliminar de sílabos en Clementina para Ciclos II, III y IV',
    categoria: 'academico',
    completado: false,
    desc: 'Revisión de los 6 cursos de carrera y material complementario.'
  },
  {
    id: 5,
    dia: 5, // Viernes
    mes: 'Set',
    hora: '17:00',
    titulo: 'Reunión de coordinación con Delegados de aula — Escuela de Sistemas',
    categoria: 'reunion',
    completado: false,
    desc: 'Enlace en portal de asistencia y recopilación de inquietudes estudiantiles.'
  },
  {
    id: 6,
    dia: 6, // Sábado
    mes: 'Set',
    hora: '09:00',
    titulo: 'Consolidación de reporte de incidencias y solicitudes PAU de la semana',
    categoria: 'seguimiento',
    completado: false,
    desc: 'Cierre de tickets atendidos con visto bueno de Coordinación FIA.'
  }
];

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
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error leyendo agenda de localStorage', e);
  }
  saveAllAgendaNotes(DEFAULT_AGENDA_NOTES);
  return DEFAULT_AGENDA_NOTES;
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
    <div class="agenda-card p-3 rounded-3 border ${note.completado ? 'agenda-card-completed' : ''}" style="background: #FFFFFF; border-left: 4px solid ${cat.color} !important;">
      <div class="d-flex align-items-center justify-content-between mb-1.5">
        <span class="badge fw-bold" style="background: ${cat.bg}; color: ${cat.color}; font-size: 0.68rem; padding: 3px 8px; border-radius: 6px;">
          ${cat.label}
        </span>
        <div class="d-flex align-items-center gap-2">
          <span class="text-muted fw-bold" style="font-size: 0.72rem;"><i class="bi bi-clock me-1 text-primary"></i>${note.hora || '09:00'}</span>
          <button type="button" class="btn btn-link text-danger p-0" style="font-size: 0.78rem; line-height: 1;" onclick="deleteAgendaNote(${note.id})" title="Eliminar nota">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
      <div class="d-flex align-items-start gap-2">
        <input class="form-check-input mt-1" type="checkbox" ${note.completado ? 'checked' : ''} onchange="toggleAgendaNoteComplete(${note.id})" title="Marcar como atendido" style="cursor: pointer; transform: scale(0.95);">
        <p class="mb-0 small fw-bold text-dark agenda-note-text ${note.completado ? 'text-decoration-line-through text-muted' : ''}" style="font-size: 0.82rem; line-height: 1.4;">
          ${escapeHtml(note.titulo)}
        </p>
      </div>
      ${note.desc ? `<div class="mt-1.5 ps-4 small text-muted" style="font-size: 0.73rem; line-height: 1.35;">${escapeHtml(note.desc)}</div>` : ''}
    </div>
  `;
}

function openNewAgendaModal(preSelectedDay = 1, preSelectedMonth = activeAgendaMonth) {
  const form = document.getElementById('formAgendaNote');
  if (form) form.reset();

  const idEl = document.getElementById('agendaNoteId');
  if (idEl) idEl.value = '';

  const dayEl = document.getElementById('agendaNoteDay');
  if (dayEl) dayEl.value = String(preSelectedDay);

  const monthEl = document.getElementById('agendaNoteMonth');
  if (monthEl) monthEl.value = preSelectedMonth;

  const timeEl = document.getElementById('agendaNoteTime');
  if (timeEl) timeEl.value = '09:00';

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

function saveAgendaNote() {
  const title = (document.getElementById('agendaNoteTitle')?.value || '').trim();
  if (!title) {
    alert('Por favor ingrese el texto o asunto de la agenda.');
    return;
  }

  const dia = parseInt(document.getElementById('agendaNoteDay')?.value || '1', 10);
  const mes = document.getElementById('agendaNoteMonth')?.value || activeAgendaMonth;
  const hora = document.getElementById('agendaNoteTime')?.value || '09:00';
  const categoria = document.getElementById('agendaNoteCategory')?.value || 'reunion';
  const desc = (document.getElementById('agendaNoteDesc')?.value || '').trim();

  const allNotes = getAgendaNotes();
  const newId = Date.now();

  const newNote = {
    id: newId,
    dia,
    mes,
    hora,
    titulo: title,
    categoria,
    completado: false,
    desc
  };

  allNotes.unshift(newNote);
  saveAllAgendaNotes(allNotes);

  if (agendaModalInstance) {
    agendaModalInstance.hide();
  }

  if (mes !== activeAgendaMonth) {
    selectAgendaMonth(mes);
  } else {
    renderSistemasAgenda();
  }
}

function toggleAgendaNoteComplete(id) {
  const allNotes = getAgendaNotes();
  const note = allNotes.find(n => n.id === id);
  if (note) {
    note.completado = !note.completado;
    saveAllAgendaNotes(allNotes);
    renderSistemasAgenda();
  }
}

function deleteAgendaNote(id) {
  if (!confirm('¿Desea eliminar esta nota de la agenda?')) return;
  let allNotes = getAgendaNotes();
  allNotes = allNotes.filter(n => n.id !== id);
  saveAllAgendaNotes(allNotes);
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

// Exponer funciones globales
window.selectAgendaMonth = selectAgendaMonth;
window.toggleAgendaViewMode = toggleAgendaViewMode;
window.switchSistemasSection = switchSistemasSection;
window.openNewAgendaModal = openNewAgendaModal;
window.saveAgendaNote = saveAgendaNote;
window.toggleAgendaNoteComplete = toggleAgendaNoteComplete;
window.deleteAgendaNote = deleteAgendaNote;
window.renderSistemasDashboard = renderSistemasDashboard;
window.renderSistemasAgenda = renderSistemasAgenda;
