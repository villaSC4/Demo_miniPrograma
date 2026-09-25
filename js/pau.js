/**
 * ==============================================================================
 * PAU.JS - Módulo de Plataforma de Atención al Estudiante (PAU / PAE)
 * Seguimiento Centralizado de Correos y Tickets Institucionales (FIA - UCV Virtual)
 * ==============================================================================
 */

let allPauTickets = [];
let pauModalInstance = null;

// Carga inicial al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  const pauModalEl = document.getElementById('modalPauTicket');
  if (pauModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    pauModalInstance = new bootstrap.Modal(pauModalEl);
  }

  setupPauEventListeners();
  loadPauData();
});

// Configuración de escuchadores de eventos
function setupPauEventListeners() {
  document.getElementById('filterPauSearch')?.addEventListener('input', renderPauTable);
  document.getElementById('filterPauEscuela')?.addEventListener('change', renderPauTable);
  document.getElementById('filterPauEstado')?.addEventListener('change', renderPauTable);
  document.getElementById('filterPauVisto')?.addEventListener('change', renderPauTable);
  
  document.getElementById('btnResetPauFilters')?.addEventListener('click', () => {
    const s = document.getElementById('filterPauSearch'); if (s) s.value = '';
    const e = document.getElementById('filterPauEscuela'); if (e) e.value = 'ALL';
    const st = document.getElementById('filterPauEstado'); if (st) st.value = 'ALL';
    const v = document.getElementById('filterPauVisto'); if (v) v.value = 'ALL';
    renderPauTable();
  });

  document.getElementById('btnOpenNewPauModal')?.addEventListener('click', () => {
    openPauModal(null);
  });

  document.getElementById('btnSavePauTicket')?.addEventListener('click', savePauTicket);
  document.getElementById('btnExportPauExcel')?.addEventListener('click', exportPauExcel);
  document.getElementById('btnSyncPauInbox')?.addEventListener('click', syncPauInbox);
  document.getElementById('btnOpenPauWebhookModal')?.addEventListener('click', openPauWebhookModal);
}

// Carga de datos desde la API o archivo físico
async function loadPauData() {
  // Limpiar residuos de datos de prueba antiguos si estuvieran en localStorage
  try {
    const cachedRaw = localStorage.getItem('pau_tickets_data');
    if (cachedRaw && (cachedRaw.includes('carcev@ucvvirtual.edu.pe') || cachedRaw.includes('rcordovac@ucvvirtual.edu.pe') || cachedRaw.includes('ARCE VILLANUEVA'))) {
      localStorage.removeItem('pau_tickets_data');
    }
  } catch (e) {}

  try {
    let res;
    try {
      res = await fetch('/api/pau');
      if (!res.ok && res.status === 404) {
        res = await fetch('api/pau.php');
      }
    } catch (e) {
      res = await fetch('api/pau.php');
    }

    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Filtrar cualquier ticket demo residual
        allPauTickets = data.filter(t => t.correo !== 'carcev@ucvvirtual.edu.pe' && t.correo !== 'rcordovac@ucvvirtual.edu.pe');
        localStorage.setItem('pau_tickets_data', JSON.stringify(allPauTickets));
        renderPauMetrics();
        renderPauTable();
        return;
      }
    }
  } catch (err) {
    console.info('No se pudo conectar a /api/pau, verificando localStorage...', err);
  }

  // Fallback a localStorage sólo si contiene datos válidos del usuario
  const cached = localStorage.getItem('pau_tickets_data');
  if (cached !== null) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        allPauTickets = parsed.filter(t => t.correo !== 'carcev@ucvvirtual.edu.pe' && t.correo !== 'rcordovac@ucvvirtual.edu.pe');
        renderPauMetrics();
        renderPauTable();
        return;
      }
    } catch (e) {}
  }

  // Base limpia sin datos de prueba ficticios: lista para registrar datos reales
  allPauTickets = [];
  localStorage.setItem('pau_tickets_data', JSON.stringify([]));
  renderPauMetrics();
  renderPauTable();
}

// Guardar los datos en el servidor
async function persistPauData() {
  localStorage.setItem('pau_tickets_data', JSON.stringify(allPauTickets));
  renderPauMetrics();

  try {
    let res;
    try {
      res = await fetch('/api/pau', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allPauTickets)
      });
    } catch (e) {
      res = await fetch('api/pau.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allPauTickets)
      });
    }

    if (!res.ok && res.status === 404) {
      await fetch('api/pau.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allPauTickets)
      });
    }
  } catch (err) {
    console.warn('Error al persistir PAU en servidor:', err);
  }
}

// Actualizar contadores y métricas KPI
function renderPauMetrics() {
  const total = allPauTickets.length;
  const atendidos = allPauTickets.filter(t => t.estado_atencion === 'Atendido').length;
  const sinAtencion = allPauTickets.filter(t => t.estado_atencion === 'Sin Atención').length;
  const aprobados = allPauTickets.filter(t => t.visto_coordinacion === 'APROBADO').length;

  const pctAtendidos = total > 0 ? Math.round((atendidos / total) * 100) : 0;

  const kpiTotalEl = document.getElementById('kpiPauTotalMetric');
  if (kpiTotalEl) kpiTotalEl.textContent = total;

  const kpiPauTotal = document.getElementById('kpiPauTotal');
  if (kpiPauTotal) kpiPauTotal.textContent = total;

  document.querySelectorAll('.kpi-pau-total-val').forEach(el => el.textContent = total);

  const kpiAtendidosEl = document.getElementById('kpiPauAtendidos');
  if (kpiAtendidosEl) kpiAtendidosEl.textContent = `${atendidos} (${pctAtendidos}%)`;

  const kpiSinAtencionEl = document.getElementById('kpiPauSinAtencion');
  if (kpiSinAtencionEl) kpiSinAtencionEl.textContent = sinAtencion;

  const kpiAprobadosEl = document.getElementById('kpiPauAprobados');
  if (kpiAprobadosEl) kpiAprobadosEl.textContent = aprobados;

  // Actualizar badges en tarjetas superiores
  const badgeAreaPau = document.getElementById('badgeAreaPau');
  if (badgeAreaPau) badgeAreaPau.innerHTML = `<span id="kpiPauTotal">${total}</span> Correos`;

  const badgeTabPau = document.getElementById('badgeTabPau');
  if (badgeTabPau) badgeTabPau.textContent = total;
}

// Renderizado de la tabla principal
function renderPauTable() {
  const tbody = document.getElementById('pauTableBody');
  if (!tbody) return;

  const q = (document.getElementById('filterPauSearch')?.value || '').toLowerCase().trim();
  const esc = document.getElementById('filterPauEscuela')?.value || 'ALL';
  const est = document.getElementById('filterPauEstado')?.value || 'ALL';
  const vis = document.getElementById('filterPauVisto')?.value || 'ALL';

  const filtered = allPauTickets.filter(t => {
    if (esc !== 'ALL' && t.escuela !== esc) return false;
    if (est !== 'ALL' && t.estado_atencion !== est) return false;
    if (vis !== 'ALL' && t.visto_coordinacion !== vis) return false;
    if (q) {
      const matchRemitente = (t.remitente || '').toLowerCase().includes(q);
      const matchCorreo = (t.correo || '').toLowerCase().includes(q);
      const matchAsunto = (t.asunto || '').toLowerCase().includes(q);
      const matchObs = (t.observaciones || '').toLowerCase().includes(q);
      if (!matchRemitente && !matchCorreo && !matchAsunto && !matchObs) return false;
    }
    return true;
  });

  const countText = document.getElementById('pauFilteredCountText');
  if (countText) {
    countText.textContent = `Mostrando ${filtered.length} de ${allPauTickets.length} solicitudes de correo`;
  }

  if (filtered.length === 0) {
    if (allPauTickets.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5">
            <div class="py-5 px-3 text-center">
              <div class="d-inline-flex align-items-center justify-content-center rounded-circle bg-light border mb-3 shadow-xs" style="width: 76px; height: 76px;">
                <i class="bi bi-inbox text-primary fs-1"></i>
              </div>
              <h5 class="fw-bold text-dark mb-2">Bandeja de Atención Lista para Nuevos Registros</h5>
              <p class="text-muted small mx-auto mb-4" style="max-width: 540px; line-height: 1.6;">
                Se han eliminado todos los datos de prueba. Aquí se ingresarán las solicitudes y correos reales de los estudiantes y docentes para su atención y seguimiento por coordinación.
              </p>
              <div class="d-flex justify-content-center gap-2 flex-wrap">
                <button type="button" class="btn btn-primary px-4 py-2 fw-semibold rounded-pill shadow-sm" onclick="openPauModal(null)">
                  <i class="bi bi-plus-circle-fill me-1"></i> + Registrar Solicitud / Correo
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5 text-muted">
            <i class="bi bi-funnel fs-1 d-block mb-2 text-secondary opacity-50"></i>
            <span class="fw-semibold">No se encontraron correos ni solicitudes con los filtros aplicados.</span>
          </td>
        </tr>
      `;
    }
    return;
  }

  let html = '';
  filtered.forEach((t, index) => {
    // 1. Estado de Atención (Atendido: Verde / Sin Atención: Amarillo)
    const isAtendido = (t.estado_atencion === 'Atendido');
    const estadoBadge = isAtendido
      ? `<button type="button" class="btn btn-sm rounded-pill border-0 shadow-xs badge-pau-atendido" 
          onclick="togglePauEstado(${t.id})" 
          title="Clic para alternar a: Sin Atención"
          style="background-color: #16A34A !important; color: #FFFFFF !important; font-size: 0.8rem !important; font-weight: 700 !important; padding: 6px 14px !important; border: 1px solid #15803D !important; cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
          <i class="bi bi-check-circle-fill me-1 text-white"></i>Atendido
        </button>`
      : `<button type="button" class="btn btn-sm rounded-pill border-0 shadow-xs badge-pau-sin-atencion" 
          onclick="togglePauEstado(${t.id})" 
          title="Clic para alternar a: Atendido"
          style="background-color: #FEF08A !important; color: #854D0E !important; font-size: 0.8rem !important; font-weight: 800 !important; padding: 6px 14px !important; border: 1.5px solid #EAB308 !important; cursor: pointer;">
          <i class="bi bi-clock-history me-1" style="color: #A16207;"></i>Sin Atención
        </button>`;

    // 2. Visto de Coordinación (APROBADO: Azul / SIN APROBACIÓN: Gris)
    const isAprobado = (t.visto_coordinacion === 'APROBADO');
    const vistoBadge = isAprobado
      ? `<button type="button" class="btn btn-sm rounded-pill border-0 shadow-xs badge-pau-aprobado" 
          onclick="togglePauVisto(${t.id})" 
          title="Clic para alternar a: SIN APROBACIÓN"
          style="background-color: #0284C7 !important; color: #FFFFFF !important; font-size: 0.8rem !important; font-weight: 700 !important; padding: 6px 14px !important; border: 1px solid #0369A1 !important; cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
          <i class="bi bi-patch-check-fill me-1 text-white"></i>APROBADO
        </button>`
      : `<button type="button" class="btn btn-sm rounded-pill border-0 shadow-xs badge-pau-sin-aprobacion" 
          onclick="togglePauVisto(${t.id})" 
          title="Clic para alternar a: APROBADO"
          style="background-color: #F1F5F9 !important; color: #334155 !important; font-size: 0.8rem !important; font-weight: 700 !important; padding: 6px 14px !important; border: 1.5px solid #CBD5E1 !important; cursor: pointer;">
          <i class="bi bi-dash-circle me-1" style="color: #64748B;"></i>SIN APROBACIÓN
        </button>`;

    // 3. Fecha de Respuesta
    const respBadge = (t.fecha_respuesta && t.fecha_respuesta !== '-')
      ? `<span class="badge rounded-pill" style="background-color: #DCFCE7 !important; color: #15803D !important; border: 1px solid #86EFAC !important; font-size: 0.78rem !important; font-weight: 700 !important; padding: 5px 10px !important;">
          <i class="bi bi-calendar-check me-1 text-success"></i>${t.fecha_respuesta}
        </span>`
      : `<span class="badge rounded-pill" style="background-color: #FEF3C7 !important; color: #92400E !important; border: 1px solid #FCD34D !important; font-size: 0.76rem !important; font-weight: 700 !important; padding: 4px 10px !important;">
          <i class="bi bi-hourglass-split me-1" style="color: #D97706;"></i>Pendiente
        </span>`;

    // 4. Escuela Badge
    const isIndustrial = (t.escuela || '').includes('Industrial');
    const escuelaBadge = isIndustrial
      ? `<span class="badge rounded-pill" style="background: #FEE2E2; color: #BE1E2D; font-size: 0.7rem; font-weight: 700; border: 1px solid #FECACA;">Industrial</span>`
      : `<span class="badge rounded-pill" style="background: #E0E7FF; color: #4338CA; font-size: 0.7rem; font-weight: 700; border: 1px solid #C7D2FE;">Sistemas</span>`;

    html += `
      <tr>
        <td class="text-center fw-bold text-muted" style="width: 45px;">${index + 1}</td>
        
        <!-- Fecha de Correo -->
        <td style="width: 140px; white-space: nowrap;">
          <div class="fw-semibold text-dark" style="font-size: 0.84rem;">
            <i class="bi bi-envelope-at text-primary me-1"></i>${t.fecha_correo}
          </div>
        </td>

        <!-- Remitente y Escuela -->
        <td style="min-width: 180px;">
          <div class="fw-bold text-dark text-truncate" style="font-size: 0.86rem; max-width: 220px;" title="${t.remitente}">
            ${t.remitente}
          </div>
          <div class="mt-0.5">${escuelaBadge}</div>
        </td>

        <!-- Correo de quien viene -->
        <td style="min-width: 170px;">
          <div class="d-flex align-items-center gap-1.5">
            <a href="mailto:${t.correo}?subject=RE: ${encodeURIComponent(t.asunto)}" class="text-decoration-none fw-semibold text-primary" style="font-size: 0.82rem;" title="Enviar correo a ${t.correo}">
              ${t.correo}
            </a>
            <button type="button" class="btn btn-link btn-sm p-0 text-muted" onclick="copyToClipboard('${t.correo}')" title="Copiar correo">
              <i class="bi bi-clipboard" style="font-size: 0.78rem;"></i>
            </button>
          </div>
        </td>

        <!-- Asunto -->
        <td style="min-width: 260px;">
          <div class="fw-semibold text-dark text-truncate" style="font-size: 0.84rem; max-width: 320px;" title="${t.asunto}">
            ${t.asunto}
          </div>
          ${t.observaciones ? `<small class="text-muted text-truncate d-block" style="font-size: 0.72rem; max-width: 320px;" title="${t.observaciones}"><i class="bi bi-info-circle me-1"></i>${t.observaciones}</small>` : ''}
        </td>

        <!-- Estado de Atención (Verde / Amarillo) -->
        <td class="text-center" style="width: 135px;">
          ${estadoBadge}
        </td>

        <!-- Visto de Coordinación (APROBADO / SIN APROBACIÓN) -->
        <td class="text-center" style="width: 155px;">
          ${vistoBadge}
        </td>

        <!-- Fecha de Respuesta -->
        <td class="text-center" style="width: 140px; white-space: nowrap;">
          ${respBadge}
        </td>

        <!-- Acciones -->
        <td class="text-center" style="width: 140px;">
          <div class="d-inline-flex align-items-center gap-1.5">
            <a href="mailto:${t.correo}?subject=RE: ${encodeURIComponent(t.asunto)}" class="btn btn-outline-primary btn-sm p-1.5" style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;" title="Responder correo al estudiante">
              <i class="bi bi-reply-fill fs-6"></i>
            </a>
            ${t.telefono ? `
              <a href="https://wa.me/${t.telefono.replace(/[^0-9]/g, '')}?text=Estimado(a)%20${encodeURIComponent(t.remitente)},%20le%20escribimos%20de%20la%20Coordinaci%C3%B3n%20FIA%20respecto%20a%20su%20solicitud%20PAU." target="_blank" rel="noopener noreferrer" class="btn btn-outline-success btn-sm p-1.5" style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;" title="Contactar por WhatsApp">
                <i class="bi bi-whatsapp fs-6"></i>
              </a>
            ` : ''}
            <button type="button" class="btn btn-outline-secondary btn-sm p-1.5" style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;" onclick="openPauModal(${t.id})" title="Editar solicitud">
              <i class="bi bi-pencil-square fs-6"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm p-1.5" style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;" onclick="deletePauTicket(${t.id})" title="Eliminar registro">
              <i class="bi bi-trash fs-6"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Notificación flotante de confirmación táctil interactiva
window.showPauToast = function(message, type = 'success') {
  let container = document.getElementById('pauToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pauToastContainer';
    container.style.cssText = 'position: fixed; bottom: 25px; right: 25px; z-index: 10000; display: flex; flex-direction: column; gap: 8px; pointer-events: none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = (type === 'success') ? '#16A34A' : ((type === 'warning') ? '#D97706' : ((type === 'info') ? '#0284C7' : '#334155'));
  const icon = (type === 'success') ? 'bi-check-circle-fill' : ((type === 'warning') ? 'bi-clock-history' : ((type === 'info') ? 'bi-patch-check-fill' : 'bi-info-circle-fill'));
  
  toast.style.cssText = `
    background: ${bg};
    color: #FFFFFF;
    font-size: 0.84rem;
    font-weight: 700;
    padding: 10px 18px;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(12px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
  `;
  toast.innerHTML = `<i class="bi ${icon} fs-6 text-white"></i> <span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
};

// Alternar en 1 clic: Atendido (Verde) <-> Sin Atención (Amarillo)
window.togglePauEstado = function(id) {
  const ticket = allPauTickets.find(t => t.id === id);
  if (!ticket) return;

  if (ticket.estado_atencion === 'Atendido') {
    ticket.estado_atencion = 'Sin Atención';
    ticket.fecha_respuesta = '-';
    showPauToast(`Estado actualizado: Sin Atención (Pendiente)`, 'warning');
  } else {
    ticket.estado_atencion = 'Atendido';
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    ticket.fecha_respuesta = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    showPauToast(`Estado actualizado: Atendido ✅ (${ticket.fecha_respuesta})`, 'success');
  }

  persistPauData();
  renderPauTable();
};

// Alternar en 1 clic: APROBADO <-> SIN APROBACIÓN
window.togglePauVisto = function(id) {
  const ticket = allPauTickets.find(t => t.id === id);
  if (!ticket) return;

  ticket.visto_coordinacion = (ticket.visto_coordinacion === 'APROBADO')
    ? 'SIN APROBACIÓN'
    : 'APROBADO';

  const isApr = (ticket.visto_coordinacion === 'APROBADO');
  showPauToast(
    `Visto Coordinación: ${ticket.visto_coordinacion} ${isApr ? '🔵' : '⚪'}`,
    isApr ? 'info' : 'secondary'
  );

  persistPauData();
  renderPauTable();
};

// Abrir modal de nuevo registro o edición
window.openPauModal = function(id) {
  const modalEl = document.getElementById('modalPauTicket');
  if (!modalEl) return;

  const titleEl = document.getElementById('modalPauTitle');
  const idInput = document.getElementById('pauFormId');
  const fechaInput = document.getElementById('pauFormFecha');
  const remitenteInput = document.getElementById('pauFormRemitente');
  const correoInput = document.getElementById('pauFormCorreo');
  const escuelaInput = document.getElementById('pauFormEscuela');
  const telefonoInput = document.getElementById('pauFormTelefono');
  const asuntoInput = document.getElementById('pauFormAsunto');
  const estadoInput = document.getElementById('pauFormEstado');
  const vistoInput = document.getElementById('pauFormVisto');
  const fechaRespInput = document.getElementById('pauFormFechaRespuesta');
  const obsInput = document.getElementById('pauFormObs');

  if (id) {
    const t = allPauTickets.find(item => item.id === id);
    if (!t) return;
    if (titleEl) titleEl.textContent = 'Editar Solicitud PAU';
    if (idInput) idInput.value = t.id;
    if (fechaInput) fechaInput.value = t.fecha_correo || '';
    if (remitenteInput) remitenteInput.value = t.remitente || '';
    if (correoInput) correoInput.value = t.correo || '';
    if (escuelaInput) escuelaInput.value = t.escuela || 'Ingeniería Industrial';
    if (telefonoInput) telefonoInput.value = t.telefono || '';
    if (asuntoInput) asuntoInput.value = t.asunto || '';
    if (estadoInput) estadoInput.value = t.estado_atencion || 'Sin Atención';
    if (vistoInput) vistoInput.value = t.visto_coordinacion || 'SIN APROBACIÓN';
    if (fechaRespInput) fechaRespInput.value = (t.fecha_respuesta && t.fecha_respuesta !== '-') ? t.fecha_respuesta : '';
    if (obsInput) obsInput.value = t.observaciones || '';
  } else {
    if (titleEl) titleEl.textContent = 'Registrar Nuevo Correo / Solicitud PAU';
    if (idInput) idInput.value = '';
    
    // Fecha y hora actual por defecto
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    if (fechaInput) fechaInput.value = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    if (remitenteInput) remitenteInput.value = '';
    if (correoInput) correoInput.value = '';
    if (escuelaInput) escuelaInput.value = 'Ingeniería Industrial';
    if (telefonoInput) telefonoInput.value = '+51 9';
    if (asuntoInput) asuntoInput.value = '';
    if (estadoInput) estadoInput.value = 'Sin Atención';
    if (vistoInput) vistoInput.value = 'SIN APROBACIÓN';
    if (fechaRespInput) fechaRespInput.value = '';
    if (obsInput) obsInput.value = '';
  }

  if (pauModalInstance) {
    pauModalInstance.show();
  } else {
    new bootstrap.Modal(modalEl).show();
  }
};

// Guardar ticket desde el formulario modal
function savePauTicket() {
  const idInput = document.getElementById('pauFormId');
  const fecha = document.getElementById('pauFormFecha')?.value.trim();
  const remitente = document.getElementById('pauFormRemitente')?.value.trim();
  const correo = document.getElementById('pauFormCorreo')?.value.trim();
  const escuela = document.getElementById('pauFormEscuela')?.value || 'Ingeniería Industrial';
  const telefono = document.getElementById('pauFormTelefono')?.value.trim();
  const asunto = document.getElementById('pauFormAsunto')?.value.trim();
  const estado = document.getElementById('pauFormEstado')?.value || 'Sin Atención';
  const visto = document.getElementById('pauFormVisto')?.value || 'SIN APROBACIÓN';
  let fechaResp = document.getElementById('pauFormFechaRespuesta')?.value.trim() || '-';
  const obs = document.getElementById('pauFormObs')?.value.trim();

  if (!remitente || !correo || !asunto) {
    alert('Por favor complete los campos obligatorios: Remitente, Correo y Asunto.');
    return;
  }

  // Si está marcado como Atendido pero no tiene fecha de respuesta, generar fecha actual
  if (estado === 'Atendido' && (!fechaResp || fechaResp === '-')) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    fechaResp = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  const existingId = idInput ? parseInt(idInput.value, 10) : null;

  if (existingId) {
    const idx = allPauTickets.findIndex(t => t.id === existingId);
    if (idx !== -1) {
      allPauTickets[idx] = {
        ...allPauTickets[idx],
        fecha_correo: fecha,
        remitente,
        correo,
        escuela,
        telefono,
        asunto,
        estado_atencion: estado,
        visto_coordinacion: visto,
        fecha_respuesta: fechaResp,
        observaciones: obs
      };
    }
  } else {
    const newId = allPauTickets.length > 0 ? Math.max(...allPauTickets.map(t => t.id)) + 1 : 1;
    allPauTickets.unshift({
      id: newId,
      fecha_correo: fecha,
      remitente,
      correo,
      escuela,
      telefono,
      asunto,
      estado_atencion: estado,
      visto_coordinacion: visto,
      fecha_respuesta: fechaResp,
      observaciones: obs
    });
  }

  persistPauData();
  renderPauTable();

  const modalEl = document.getElementById('modalPauTicket');
  const instance = bootstrap.Modal.getInstance(modalEl);
  if (instance) instance.hide();
}

// Eliminar ticket
window.deletePauTicket = function(id) {
  const t = allPauTickets.find(item => item.id === id);
  if (!t) return;

  if (confirm(`¿Desea eliminar la solicitud de ${t.remitente}?`)) {
    allPauTickets = allPauTickets.filter(item => item.id !== id);
    persistPauData();
    renderPauTable();
  }
};

// Exportar a Excel con la estructura exacta del Google Sheet del PAU
function exportPauExcel() {
  if (typeof XLSX === 'undefined') {
    alert('La librería XLSX no está cargada.');
    return;
  }

  const rows = allPauTickets.map((t, idx) => ({
    'IT': idx + 1,
    'FECHA REGISTRO': t.fecha_correo,
    'REMITENTE': t.remitente,
    'CORREO': t.correo,
    'ESCUELA': t.escuela,
    'ASUNTO': t.asunto,
    'ESTADO': t.estado_atencion,
    'VISTO BUENO': t.visto_coordinacion,
    'FECHA RESPUESTA': t.fecha_respuesta || '-',
    'OBSERVACIONES': t.observaciones || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PAU_Industrial_Sistemas");
  XLSX.writeFile(wb, "PAU_Atencion_Estudiantes_Industrial_Sistemas_2026-2.xlsx");
}

// Utilidad para copiar al portapapeles
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert(`Correo copiado al portapapeles: ${text}`);
  }).catch(() => {
    prompt('Copie el correo manualmente:', text);
  });
};

// Sincronizar bandeja en tiempo real
window.syncPauInbox = async function() {
  const btn = document.getElementById('btnSyncPauInbox');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Sincronizando...`;
  }

  await loadPauData();

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-check2 text-success fs-6 me-1"></i> Sincronizado`;
    setTimeout(() => {
      btn.innerHTML = originalHtml;
    }, 2000);
  }
};

// Abrir modal de vinculación con Gmail Webhook
window.openPauWebhookModal = function() {
  const modalEl = document.getElementById('modalPauWebhook');
  if (!modalEl) return;

  // Calcular URL real del Webhook según el origen actual
  const currentBase = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
  const isPhp = window.location.protocol.startsWith('http') && !window.location.port.includes('8000');
  const webhookUrl = isPhp ? `${currentBase}/api/pau.php` : `${window.location.origin}/api/pau`;

  const inputUrl = document.getElementById('pauWebhookUrlDisplay');
  if (inputUrl) {
    inputUrl.value = webhookUrl;
  }

  // Cargar código del Google Apps Script adaptado
  const scriptArea = document.getElementById('pauScriptCodeSnippet');
  if (scriptArea) {
    scriptArea.value = `// GOOGLE APPS SCRIPT: VINCULACIÓN AUTOMÁTICA GMAIL -> PAU UCV
const WEBHOOK_URL = "${webhookUrl}";
const SECRET_TOKEN = "UCV_FIA_PAU_2026";

function sincronizarCorreosConMinisistema() {
  const threads = GmailApp.search('in:inbox is:unread newer_than:3d', 0, 10);
  for (let i = 0; i < threads.length; i++) {
    const msg = threads[i].getMessages().pop();
    if (msg && msg.isUnread()) {
      const from = msg.getFrom();
      const subject = msg.getSubject() || "Consulta Académica";
      const match = from.match(/(.*)<(.*)>/);
      const name = match ? match[1].trim() : from;
      const email = match ? match[2].trim() : from;
      
      const payload = {
        action: "incoming_email",
        token: SECRET_TOKEN,
        remitente: name.toUpperCase(),
        correo: email,
        asunto: subject,
        fecha_correo: Utilities.formatDate(msg.getDate(), "GMT-5", "dd/MM/yyyy HH:mm"),
        escuela: subject.toLowerCase().includes("sistemas") ? "Ingeniería de Sistemas" : "Ingeniería Industrial",
        observaciones: msg.getPlainBody().substring(0, 250)
      };

      UrlFetchApp.fetch(WEBHOOK_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
    }
  }
}`;
  }

  new bootstrap.Modal(modalEl).show();
};

// Copiar URL del Webhook
window.copyWebhookUrl = function() {
  const input = document.getElementById('pauWebhookUrlDisplay');
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    alert(`URL copiada al portapapeles:\n${input.value}`);
  }).catch(() => {
    prompt('Copie la URL manualmente:', input.value);
  });
};

// Copiar Código de Google Apps Script
window.copyGoogleScriptCode = function() {
  const area = document.getElementById('pauScriptCodeSnippet');
  if (!area) return;
  navigator.clipboard.writeText(area.value).then(() => {
    alert('Código de Google Apps Script copiado con éxito. Ahora pégalo en script.google.com con la cuenta de coordinación.');
  }).catch(() => {
    prompt('Copie el código:', area.value);
  });
};

// Enviar Correo de Prueba en Vivo (Simulación del Webhook)
window.sendTestIncomingEmail = async function() {
  const btn = document.getElementById('btnTestWebhookEmail');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Enviando correo de prueba...`;
  }

  const sampleEmails = [
    {
      remitente: "CARLOS RAMIREZ NAVARRO",
      correo: "carlos.ramirezn@ucvvirtual.edu.pe",
      escuela: "Ingeniería de Sistemas",
      asunto: "SOLICITUD: HABILITACIÓN DE EVALUACIÓN REZAGADA - CICLO VII",
      observaciones: "El estudiante solicita rendir la evaluación rezagada por motivos de salud acreditados."
    },
    {
      remitente: "VALERIA FLORES MENDOZA",
      correo: "valeria.floresm@ucvvirtual.edu.pe",
      escuela: "Ingeniería Industrial",
      asunto: "CONSULTA: CRUCE DE HORARIOS EN ASIGNATURA MODULAR INVESTIGACIÓN DE OPERACIONES",
      observaciones: "Alumna de ciclo VI reporta cruce de sesiones de clase en Trilce."
    },
    {
      remitente: "DIEGO PAREDES ALARCON",
      correo: "diego.paredesa@ucvvirtual.edu.pe",
      escuela: "Ingeniería de Sistemas",
      asunto: "REPORTE: ENLACE DE SESIÓN ZOOM NO APARECE EN BLACKBOARD",
      observaciones: "Delegado de aula solicita actualización del enlace recurrente de la clase."
    }
  ];

  // Elegir uno aleatorio
  const randomEmail = sampleEmails[Math.floor(Math.random() * sampleEmails.length)];

  try {
    let endpoint = '/api/pau';
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(randomEmail)
      });
    } catch(e) {
      endpoint = 'api/pau.php';
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(randomEmail)
      });
    }

    if (!res.ok && res.status === 404) {
      endpoint = 'api/pau.php';
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(randomEmail)
      });
    }

    if (res && res.ok) {
      await loadPauData();

      // Cerrar modal
      const modalEl = document.getElementById('modalPauWebhook');
      const inst = bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();

      alert(`✅ ¡Correo de prueba recibido por el Webhook!\n\nRemitente: ${randomEmail.remitente}\nAsunto: ${randomEmail.asunto}\n\nHa ingresado automáticamente a la bandeja de solicitudes con Estado "Sin Atención" (Amarillo).`);
    } else {
      alert('No se pudo procesar la prueba. Verifique que el servidor esté activo.');
    }
  } catch (err) {
    console.error('Error al probar webhook:', err);
    alert('Error al conectar con la API de sincronización: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
};
