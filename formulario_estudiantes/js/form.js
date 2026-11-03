/**
 * ==========================================================================
 * RESERVA DE ATENCIÓN ESTUDIANTIL — SEMESTRE 2026-2
 * Facultad de Ingeniería y Arquitectura (UCV)
 * Script de Control del Formulario y Validación en Tiempo Real
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reservationForm');
  const formSectionWrapper = document.getElementById('formSectionWrapper');
  const successPanel = document.getElementById('successPanel');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnReset = document.getElementById('btnReset');
  const btnNuevaReserva = document.getElementById('btnNuevaReserva');
  const globalAlert = document.getElementById('globalAlert');
  const globalAlertText = document.getElementById('globalAlertText');

  // Campos de entrada
  const inputNombres = document.getElementById('nombres_completos');
  const inputCodigo = document.getElementById('codigo_alumno');
  const selectCarrera = document.getElementById('carrera_profesional');
  const inputCorreo = document.getElementById('correo_institucional');
  const selectTipo = document.getElementById('tipo_atencion');
  const inputDetalle = document.getElementById('detalle_motivo');

  // Horario (Lunes a Jueves, 7 a 9 PM)
  const inputDia = document.getElementById('dia_atencion');
  const inputHorario = document.getElementById('horario_atencion');
  const dayBtns = document.querySelectorAll('.day-btn-option');
  const hourBtns = document.querySelectorAll('.hour-btn-option');
  const previewSchedule = document.getElementById('previewSchedule');
  const previewScheduleText = document.getElementById('previewScheduleText');

  // Elementos de la constancia post-envío
  const resTicket = document.getElementById('resTicket');
  const resNombre = document.getElementById('resNombre');
  const resCodigo = document.getElementById('resCodigo');
  const resCarrera = document.getElementById('resCarrera');
  const resCorreo = document.getElementById('resCorreo');
  const resTipo = document.getElementById('resTipo');
  const resHorario = document.getElementById('resHorario');
  const resFecha = document.getElementById('resFecha');

  // Control de Tema (Modo Luz / Modo Oscuro) Solicitado
  const btnThemeToggle = document.getElementById('themeToggleBtn');
  const themeToggleText = document.getElementById('themeToggleText');

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
      document.documentElement.setAttribute('data-theme', 'light');
      if (themeToggleText) themeToggleText.textContent = 'Modo Oscuro';
    } else {
      document.body.classList.remove('light-mode');
      document.documentElement.setAttribute('data-theme', 'dark');
      if (themeToggleText) themeToggleText.textContent = 'Modo Claro';
    }
    try {
      localStorage.setItem('pae_theme', theme);
    } catch (e) {}
  }

  const savedTheme = localStorage.getItem('pae_theme') || 'dark';
  applyTheme(savedTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.contains('light-mode');
      applyTheme(isLight ? 'dark' : 'light');
    });
  }

  if (!form) return;

  // ==========================================================================
  // 1. SELECTOR INTERACTIVO DE HORARIO (8 FRANJAS DE 15 MINUTOS - LUN Y JUE)
  // ==========================================================================
  let selectedDay = '';
  let selectedHour = '';
  let atencionesRegistradas = [];

  const SLOTS_LIST = [
    '7:00 PM - 7:15 PM',
    '7:15 PM - 7:30 PM',
    '7:30 PM - 7:45 PM',
    '7:45 PM - 8:00 PM',
    '8:00 PM - 8:15 PM',
    '8:15 PM - 8:30 PM',
    '8:30 PM - 8:45 PM',
    '8:45 PM - 9:00 PM'
  ];

  // Convertir hora en rango decimal para comparar solapamiento exacto
  function getSlotTimeRange(str) {
    if (!str) return null;
    str = String(str).toLowerCase().trim();
    // Franjas de 15 minutos oficiales
    if (str.includes('7:00') && str.includes('7:15')) return [19.0, 19.25];
    if (str.includes('7:15') && str.includes('7:30')) return [19.25, 19.5];
    if (str.includes('7:30') && str.includes('7:45')) return [19.5, 19.75];
    if (str.includes('7:45') && str.includes('8:00')) return [19.75, 20.0];
    if (str.includes('8:00') && str.includes('8:15')) return [20.0, 20.25];
    if (str.includes('8:15') && str.includes('8:30')) return [20.25, 20.5];
    if (str.includes('8:30') && str.includes('8:45')) return [20.5, 20.75];
    if (str.includes('8:45') && str.includes('9:00')) return [20.75, 21.0];
    // Soporte retrospectivo para turnos de 30 min y 1 hora
    if (str.includes('7:00') && str.includes('7:30')) return [19.0, 19.5];
    if (str.includes('7:30') && str.includes('8:00')) return [19.5, 20.0];
    if (str.includes('8:00') && str.includes('8:30')) return [20.0, 20.5];
    if (str.includes('8:30') && str.includes('9:00')) return [20.5, 21.0];
    if (str.includes('7:00') && str.includes('8:00')) return [19.0, 20.0];
    if (str.includes('8:00') && str.includes('9:00')) return [20.0, 21.0];
    return null;
  }

  // Verifica si dos franjas horarias se solapan (overlap)
  function checkSlotOverlap(slotA, slotB) {
    const rA = getSlotTimeRange(slotA);
    const rB = getSlotTimeRange(slotB);
    if (!rA || !rB) return slotA === slotB;
    return Math.max(rA[0], rB[0]) < Math.min(rA[1], rB[1]);
  }

  // Normalizar nombre de día (con/sin tilde)
  function normalizarDia(d) {
    d = (d || '').toLowerCase().trim();
    if (d.includes('lun')) return 'Lunes';
    if (d.includes('mar')) return 'Martes';
    if (d.includes('mie') || d.includes('mié')) return 'Miércoles';
    if (d.includes('jue')) return 'Jueves';
    if (d.includes('vie')) return 'Viernes';
    return d;
  }

  // Comprobar si un turno específico de un día ya está ocupado en la BD / lista
  function isSlotOcupado(dia, franja) {
    const diaNorm = normalizarDia(dia);
    return atencionesRegistradas.some(r => {
      if ((r.estado || '') === 'Cancelado') return false;
      const rDia = normalizarDia(r.dia_atencion);
      if (rDia !== diaNorm) return false;
      return checkSlotOverlap(r.horario_atencion, franja);
    });
  }

  // Cargar reservas existentes en tiempo real desde la API local / cPanel
  async function cargarHorariosOcupados() {
    const endpoints = [
      'api_atenciones.php',
      '../api/atenciones_dac.php',
      '../api/atenciones_dac',
      'https://dac-atiende.class-it.edu.pe/api_atenciones.php',
      'data/atenciones.json',
      '../data/atenciones.json'
    ];

    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep + (ep.includes('?') ? '&' : '?') + '_t=' + Date.now(), {
          headers: { 'Accept': 'application/json' }
        });
        if (resp.ok) {
          const resJson = await resp.json();
          const items = Array.isArray(resJson) ? resJson : (resJson.data || []);
          if (Array.isArray(items)) {
            atencionesRegistradas = items;
            break;
          }
        }
      } catch(e) {}
    }
    actualizarDisponibilidadGeneral();
  }

  // Actualizar contadores de cupos en los botones de día y estado de franjas
  function actualizarDisponibilidadGeneral() {
    const dias = ['Lunes', 'Viernes'];
    dias.forEach(d => {
      let ocupados = 0;
      SLOTS_LIST.forEach(slot => {
        if (isSlotOcupado(d, slot)) ocupados++;
      });
      const disponibles = Math.max(0, SLOTS_LIST.length - ocupados);

      const badgeId = 'badgeDay' + d;
      const badgeEl = document.getElementById(badgeId);
      if (badgeEl) {
        if (disponibles === 0) {
          badgeEl.className = 'day-quota-badge day-quota-pill day-full full';
          badgeEl.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i>Sin cupos';
        } else {
          badgeEl.className = 'day-quota-badge day-quota-pill';
          badgeEl.innerHTML = `<i class="bi bi-check2 me-1"></i>${disponibles} de 8 disp.`;
        }
      }
    });

    if (selectedDay) {
      actualizarHorariosPorDia(selectedDay);
    }
  }

  // Actualizar los 4 rectángulos de franjas horarias según el día seleccionado
  function actualizarHorariosPorDia(dia) {
    const slotIndicator = document.getElementById('slotDayIndicator');
    if (slotIndicator) {
      slotIndicator.textContent = `Día seleccionado: ${dia}`;
    }

    const currentHourBtns = document.querySelectorAll('.hour-btn-option');
    currentHourBtns.forEach(btn => {
      const slotHour = btn.dataset.hour;
      const pill = btn.querySelector('.slot-status-pill');
      const ocupado = isSlotOcupado(dia, slotHour);

      if (ocupado) {
        btn.classList.add('is-occupied');
        btn.disabled = true;
        if (btn.classList.contains('selected')) {
          btn.classList.remove('selected');
          selectedHour = '';
          updateSchedulePreview();
        }
        if (pill) {
          pill.className = 'slot-status-pill slot-occupied';
          pill.innerHTML = '<i class="bi bi-lock-fill"></i> Reservado';
        }
      } else {
        btn.classList.remove('is-occupied');
        btn.disabled = false;
        if (pill) {
          pill.className = 'slot-status-pill slot-avail';
          pill.innerHTML = '<i class="bi bi-check-circle-fill"></i> Disponible';
        }
      }
    });
  }

  function updateSchedulePreview() {
    if (selectedDay && selectedHour) {
      if (inputDia) inputDia.value = selectedDay;
      if (inputHorario) inputHorario.value = selectedHour;
      if (previewScheduleText) {
        previewScheduleText.innerHTML = `Día: <strong>${selectedDay}</strong> • Franja: <strong>${selectedHour}</strong>`;
      }
      if (previewSchedule) previewSchedule.style.display = 'flex';
      clearFieldError('wrap_horario');
    } else if (selectedDay) {
      if (previewScheduleText) {
        previewScheduleText.innerHTML = `Día: <strong>${selectedDay}</strong> (ahora elija una franja horaria disponible)`;
      }
      if (previewSchedule) previewSchedule.style.display = 'flex';
    } else {
      if (previewSchedule) previewSchedule.style.display = 'none';
    }
  }

  dayBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      seleccionarDia(btn.dataset.day, true);
    });
  });

  function seleccionarDia(dia, sincronizarCarrera = true) {
    dayBtns.forEach(b => {
      if (b.dataset.day === dia) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });
    selectedDay = dia;

    // Sincronizar carrera automáticamente con el día
    if (sincronizarCarrera && selectCarrera) {
      const carreraDeseada = dia === 'Lunes' ? 'Ingeniería de Sistemas' : 'Ingeniería Industrial';
      if (selectCarrera.value !== carreraDeseada) {
        selectCarrera.value = carreraDeseada;
        carreraBtns.forEach(b => {
          if (b.dataset.carrera === carreraDeseada) b.classList.add('selected');
          else b.classList.remove('selected');
        });
        clearFieldError('wrap_carrera_profesional');
        actualizarInfoEscuela(carreraDeseada);
      }
    }

    actualizarHorariosPorDia(selectedDay);
    updateSchedulePreview();
  }

  hourBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled || btn.classList.contains('is-occupied')) {
        showAlert('El horario seleccionado ya fue reservado por otro estudiante. Por favor elija un turno disponible.');
        return;
      }
      if (!selectedDay) {
        showAlert('Por favor seleccione primero un día de atención (Lunes: Sistemas, Viernes: Industrial).');
        return;
      }
      hourBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedHour = btn.dataset.hour;
      updateSchedulePreview();
    });
  });

  // Inicializar consulta de disponibilidad
  cargarHorariosOcupados();

  // ==========================================================================
  // RESTRICCIONES ESTRICTAS EN TIEMPO REAL (SOLICITADAS POR PROFESOR ARCE)
  // ==========================================================================

  // 1. NOMBRES Y APELLIDOS: SOLO LETRAS Y ESPACIOS (BLOQUEO DE NÚMEROS Y SÍMBOLOS)
  if (inputNombres) {
    inputNombres.addEventListener('input', (e) => {
      const original = e.target.value;
      // Permitir letras mayúsculas/minúsculas, tildes (áéíóúÁÉÍÓÚ), ñ/Ñ, diéresis (ü/Ü) y espacios
      const cleaned = original.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\-']/g, '');
      if (original !== cleaned) {
        e.target.value = cleaned;
        setFieldError('wrap_nombres_completos', 'Solo se permiten letras y espacios en Nombres y Apellidos (sin números).');
      } else {
        clearFieldError('wrap_nombres_completos');
      }
    });

    inputNombres.addEventListener('blur', () => {
      const val = inputNombres.value.trim().replace(/\s+/g, ' ');
      inputNombres.value = val;
      const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\-']{4,70}$/;
      if (!val || val.length < 4 || /\d/.test(val) || !nameRegex.test(val)) {
        setFieldError('wrap_nombres_completos', 'Ingrese sus nombres y apellidos completos válidos (solo letras, sin números).');
      } else {
        clearFieldError('wrap_nombres_completos');
      }
    });
  }

  // 2. CÓDIGO DE ALUMNO: ESTRICTAMENTE 10 DÍGITOS NUMÉRICOS (BLOQUEO DE LETRAS Y CARACTERES)
  if (inputCodigo) {
    inputCodigo.addEventListener('input', (e) => {
      const original = e.target.value;
      // Solo dígitos 0-9, máximo 10 caracteres
      const cleaned = original.replace(/\D/g, '').slice(0, 10);
      if (original !== cleaned) {
        e.target.value = cleaned;
        setFieldError('wrap_codigo_alumno', 'El código de alumno solo debe contener números (máximo 10 dígitos).');
      } else {
        clearFieldError('wrap_codigo_alumno');
      }
    });

    inputCodigo.addEventListener('blur', () => {
      const val = inputCodigo.value.trim();
      if (val && (val.length < 9 || val.length > 10 || !/^\d{9,10}$/.test(val))) {
        setFieldError('wrap_codigo_alumno', 'El código de alumno debe tener exactamente 10 dígitos numéricos (ej. 7000184920).');
      } else {
        clearFieldError('wrap_codigo_alumno');
      }
    });
  }

  // 3. CORREO INSTITUCIONAL: DEBE TERMINAR ESTRICTAMENTE EN @ucvvirtual.edu.pe SIN SUFIJOS
  if (inputCorreo) {
    inputCorreo.addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      // Si el alumno intenta añadir números o caracteres después de .pe (ej. pe11111111), recortar o advertir
      if (/@ucvvirtual\.edu\.pe.+/.test(val)) {
        const cleaned = val.replace(/(@ucvvirtual\.edu\.pe).*$/, '$1');
        e.target.value = cleaned;
        setFieldError('wrap_correo_institucional', 'El correo debe terminar estrictamente en @ucvvirtual.edu.pe sin caracteres adicionales.');
      } else {
        clearFieldError('wrap_correo_institucional');
      }
    });

    inputCorreo.addEventListener('blur', () => {
      let val = inputCorreo.value.trim().toLowerCase();
      if (!val) return;

      // Asistencia al estudiante: si solo colocó el usuario institucional sin @
      if (!val.includes('@') && /^[a-z0-9._%-]+$/.test(val)) {
        val = val + '@ucvvirtual.edu.pe';
        inputCorreo.value = val;
      } else if (val.endsWith('@')) {
        val = val + 'ucvvirtual.edu.pe';
        inputCorreo.value = val;
      }

      const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@ucvvirtual\.edu\.pe$/;
      if (!strictEmailRegex.test(val)) {
        setFieldError('wrap_correo_institucional', 'Debe ser un correo institucional válido terminado exactamente en @ucvvirtual.edu.pe.');
      } else {
        clearFieldError('wrap_correo_institucional');
      }
    });
  }

  if (inputDetalle) {
    inputDetalle.addEventListener('input', () => {
      clearFieldError('wrap_detalle_motivo');
    });
  }

  // ==========================================================================
  // CARDS 1, 2 Y 3: INTERACCIÓN Y DINAMISMO POR ESCUELA
  // ==========================================================================
  const cardEmail = document.getElementById('cardEmailEscuela');
  const cardContact = document.getElementById('cardContactEscuela');
  const cardZoom = document.getElementById('cardZoomEscuela');
  const schoolEmailVal = document.getElementById('schoolEmailVal');
  const schoolPhoneVal = document.getElementById('schoolPhoneVal');

  const modalZoom = document.getElementById('modalZoomEscuela');
  const btnCloseZoom = document.getElementById('btnCloseZoomModal');
  const btnCopiarZoomLink = document.getElementById('btnCopiarZoomLink');
  const toastPae = document.getElementById('toastPae');
  const toastPaeText = document.getElementById('toastPaeText');

  let toastTimer = null;
  function showToast(msg) {
    if (!toastPae) return;
    if (toastPaeText) toastPaeText.textContent = msg;
    toastPae.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastPae.classList.remove('show');
    }, 3200);
  }

  function actualizarInfoEscuela(carrera) {
    if (carrera === 'Ingeniería Industrial') {
      if (schoolEmailVal) schoolEmailVal.textContent = 'industrial.fia@ucvvirtual.edu.pe';
      if (schoolPhoneVal) schoolPhoneVal.textContent = '+51 989 316 285';
    } else {
      if (schoolEmailVal) schoolEmailVal.textContent = 'sistemas.fia@ucvvirtual.edu.pe';
      if (schoolPhoneVal) schoolPhoneVal.textContent = '+51 989 316 284';
    }
  }

  if (cardEmail) {
    cardEmail.addEventListener('click', () => {
      const email = schoolEmailVal ? schoolEmailVal.textContent.trim() : 'sistemas.fia@ucvvirtual.edu.pe';
      navigator.clipboard.writeText(email).then(() => {
        showToast(`✓ Correo de Escuela copiado: ${email}`);
      }).catch(() => {
        showToast(`Correo de Escuela: ${email}`);
      });
    });
  }

  if (cardContact) {
    cardContact.addEventListener('click', () => {
      const carrera = selectCarrera && selectCarrera.value ? selectCarrera.value : 'Ingeniería de Sistemas';
      const phone = carrera === 'Ingeniería Industrial' ? '51989316285' : '51989316284';
      const msg = encodeURIComponent(`Hola, soy estudiante de ${carrera} y deseo realizar una consulta a la Escuela Profesional.`);
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    });
  }

  if (cardZoom) {
    cardZoom.addEventListener('click', () => {
      if (modalZoom) {
        modalZoom.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  }

  if (btnCloseZoom) {
    btnCloseZoom.addEventListener('click', () => {
      if (modalZoom) {
        modalZoom.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  if (modalZoom) {
    modalZoom.addEventListener('click', (e) => {
      if (e.target === modalZoom) {
        modalZoom.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  if (btnCopiarZoomLink) {
    btnCopiarZoomLink.addEventListener('click', () => {
      navigator.clipboard.writeText('https://ucv-edu-pe.zoom.us/j/81934521098').then(() => {
        showToast('✓ Enlace permanente de Zoom de Escuela copiado.');
      });
    });
  }

  // Sincronización del selector rápido de Carreras (Sistemas vs Industrial)
  const carreraBtns = document.querySelectorAll('.carrera-btn-option');
  if (carreraBtns.length > 0 && selectCarrera) {
    carreraBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        carreraBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectCarrera.value = btn.dataset.carrera;
        clearFieldError('wrap_carrera_profesional');
        hideAlert();
        actualizarInfoEscuela(btn.dataset.carrera);

        // Auto-seleccionar Lunes para Sistemas y Viernes para Industrial
        const diaCorrespondiente = btn.dataset.carrera === 'Ingeniería de Sistemas' ? 'Lunes' : 'Viernes';
        seleccionarDia(diaCorrespondiente, false);
      });
    });

    selectCarrera.addEventListener('change', () => {
      carreraBtns.forEach(btn => {
        if (btn.dataset.carrera === selectCarrera.value) {
          btn.classList.add('selected');
        } else {
          btn.classList.remove('selected');
        }
      });
      actualizarInfoEscuela(selectCarrera.value);

      const diaCorrespondiente = selectCarrera.value === 'Ingeniería de Sistemas' ? 'Lunes' : 'Viernes';
      seleccionarDia(diaCorrespondiente, false);
    });
  }

  [selectCarrera, selectTipo].forEach(sel => {
    if (!sel) return;
    sel.addEventListener('change', () => {
      const wrap = sel.closest('.form-group-item') || sel.closest('.field-item');
      if (wrap) wrap.classList.remove('has-error');
      hideAlert();
    });
  });

  function clearFieldError(wrapperId) {
    const el = document.getElementById(wrapperId);
    if (el) el.classList.remove('has-error');
    hideAlert();
  }

  function setFieldError(wrapperId, message) {
    const el = document.getElementById(wrapperId);
    if (el) {
      el.classList.add('has-error');
      if (message) {
        const feedback = el.querySelector('.field-error-feedback span') || el.querySelector('.input-error-feedback span');
        if (feedback) feedback.textContent = message;
      }
    }
  }

  function showAlert(msg) {
    if (globalAlert && globalAlertText) {
      globalAlertText.textContent = msg;
      globalAlert.classList.add('show');
      globalAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function hideAlert() {
    if (globalAlert) globalAlert.classList.remove('show');
  }

  // ==========================================================================
  // 2. VALIDACIÓN Y ENVÍO DEL FORMULARIO
  // ==========================================================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    let isValid = true;
    let firstErrorElement = null;

    // 1. Validar Nombres y Apellidos (sin números, solo letras y espacios)
    const nombres = inputNombres.value.trim().replace(/\s+/g, ' ');
    inputNombres.value = nombres;
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\-']{4,70}$/;
    if (!nombres || nombres.length < 4 || /\d/.test(nombres) || !nameRegex.test(nombres)) {
      setFieldError('wrap_nombres_completos', 'Ingrese sus Nombres y Apellidos completos válidos (solo letras y espacios, sin números).');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_nombres_completos');
    }

    // 2. Validar Código de Alumno (exactamente 10 dígitos numéricos)
    const codigo = inputCodigo.value.trim();
    if (!codigo || codigo.length < 9 || codigo.length > 10 || !/^\d{9,10}$/.test(codigo)) {
      setFieldError('wrap_codigo_alumno', 'El Código de Alumno debe tener exactamente 10 dígitos numéricos (sin letras).');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_codigo_alumno');
    }

    // 3. Validar Carrera Profesional
    if (!selectCarrera.value) {
      setFieldError('wrap_carrera_profesional', 'Seleccione su Carrera Profesional (Ingeniería de Sistemas o Industrial).');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_carrera_profesional');
    }

    // 4. Validar Correo Institucional (debe terminar estrictamente en @ucvvirtual.edu.pe)
    const correo = inputCorreo.value.trim().toLowerCase();
    inputCorreo.value = correo;
    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@ucvvirtual\.edu\.pe$/;
    if (!correo || !strictEmailRegex.test(correo)) {
      setFieldError('wrap_correo_institucional', 'Ingrese un correo institucional válido terminado exactamente en @ucvvirtual.edu.pe sin caracteres adicionales.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_correo_institucional');
    }

    // 5. Validar Tipo de Atención (Reclamo vs Solicitud)
    if (!selectTipo.value) {
      setFieldError('wrap_tipo_atencion', 'Seleccione el Tipo de Atención requerido (Reclamo o Solicitud).');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_tipo_atencion');
    }

    // 6. Validar Día y Horario
    if (!selectedDay || !selectedHour) {
      setFieldError('wrap_horario', 'Debe seleccionar su día (Lunes: Sistemas, Viernes: Industrial) y una franja horaria de 15 minutos disponible.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_horario');
    } else if (selectCarrera && selectCarrera.value === 'Ingeniería de Sistemas' && selectedDay !== 'Lunes') {
      setFieldError('wrap_horario', 'Para Ingeniería de Sistemas la atención es exclusivamente los días Lunes (7:00 a 9:00 PM).');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_horario');
    } else if (selectCarrera && selectCarrera.value === 'Ingeniería Industrial' && selectedDay !== 'Viernes') {
      setFieldError('wrap_horario', 'Para Ingeniería Industrial la atención es exclusivamente los días Viernes (7:00 a 9:00 PM).');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_horario');
    } else if (isSlotOcupado(selectedDay, selectedHour)) {
      setFieldError('wrap_horario', `El turno de ${selectedDay} (${selectedHour}) ya fue reservado por otro estudiante. Por favor elija otro turno disponible.`);
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_horario');
    }

    if (!isValid) {
      showAlert('Por favor revise los campos señalados en rojo antes de enviar su solicitud.');
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Armar payload JSON
    const payload = {
      nombres_completos: nombres,
      codigo_alumno: codigo,
      carrera_profesional: selectCarrera.value,
      correo_institucional: correo,
      tipo_atencion: selectTipo.value,
      dia_atencion: selectedDay,
      horario_atencion: selectedHour,
      detalle_motivo: inputDetalle ? inputDetalle.value.trim() : ''
    };

    // Estado visual de carga
    btnSubmit.disabled = true;
    const originalBtnText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<span class="spinner-sm"></span> Registrando en PAE...';

    try {
      const response = await fetch('submit.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Registrar reserva en la memoria local para bloquear el turno de inmediato
        atencionesRegistradas.unshift({
          dia_atencion: payload.dia_atencion,
          horario_atencion: payload.horario_atencion,
          estado: 'Pendiente'
        });
        actualizarDisponibilidadGeneral();

        // Llenar Ficha de Constancia
        if (resTicket) resTicket.textContent = data.codigo_ticket || 'ATN-2026-REG';
        if (resNombre) resNombre.textContent = payload.nombres_completos;
        if (resCodigo) resCodigo.textContent = payload.codigo_alumno;
        if (resCarrera) resCarrera.textContent = payload.carrera_profesional;
        if (resCorreo) resCorreo.textContent = payload.correo_institucional;
        if (resTipo) resTipo.textContent = payload.tipo_atencion;
        if (resHorario) resHorario.textContent = `${payload.dia_atencion} • ${payload.horario_atencion}`;
        if (resFecha) resFecha.textContent = data.fecha || new Date().toLocaleString('es-PE');

        // Mostrar pantalla de confirmación
        formSectionWrapper.style.display = 'none';
        successPanel.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const formSide = document.querySelector('.form-side');
        if (formSide) formSide.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const errorText = data.message || (data.errors ? data.errors.join(', ') : 'No se pudo generar la reserva.');
        showAlert(errorText);
        if (response.status === 409 || data.error_code === 'HORARIO_OCUPADO') {
          await cargarHorariosOcupados();
        }
      }
    } catch (err) {
      console.error('Error de comunicación:', err);
      showAlert('Error de conexión con el servidor. Verifique su conexión a internet.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalBtnText;
    }
  });

  // ==========================================================================
  // 3. LIMPIAR FORMULARIO
  // ==========================================================================
  function resetAll() {
    form.reset();
    selectedDay = '';
    selectedHour = '';
    if (inputDia) inputDia.value = '';
    if (inputHorario) inputHorario.value = '';
    dayBtns.forEach(b => b.classList.remove('selected'));
    hourBtns.forEach(b => b.classList.remove('selected'));
    carreraBtns.forEach(b => b.classList.remove('selected'));
    if (previewSchedule) previewSchedule.style.display = 'none';
    document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
    hideAlert();
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('¿Desea restablecer todos los campos del formulario?')) {
        resetAll();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const formSide = document.querySelector('.form-side');
        if (formSide) formSide.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  if (btnNuevaReserva) {
    btnNuevaReserva.addEventListener('click', () => {
      resetAll();
      successPanel.classList.remove('active');
      formSectionWrapper.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const formSide = document.querySelector('.form-side');
      if (formSide) formSide.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

// ============================================================================
// MODAL DE DESCARGA PROTEGIDA DE EXCEL
// ============================================================================
(function () {
  const overlay     = document.getElementById('modalDescargaOverlay');
  const btnAbrir    = document.getElementById('btnAbrirDescarga');
  const btnCerrar   = document.getElementById('btnCerrarModal');
  const authForm    = document.getElementById('downloadAuthForm');
  const inputEmail  = document.getElementById('dlEmail');
  const inputPass   = document.getElementById('dlPass');
  const btnSubmit   = document.getElementById('btnDescargarExcel');
  const alertError  = document.getElementById('modalAlertError');
  const alertText   = document.getElementById('modalAlertText');
  const btnTogglePw = document.getElementById('btnTogglePw');
  const iconToggle  = document.getElementById('iconTogglePw');

  if (!overlay || !btnAbrir) return;

  btnAbrir.addEventListener('click', () => {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { if (inputEmail) inputEmail.focus(); }, 280);
  });

  function cerrarModal() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (authForm) authForm.reset();
      if (alertError) alertError.classList.remove('show');
      if (inputPass) inputPass.type = 'password';
      if (iconToggle) iconToggle.className = 'bi bi-eye';
    }, 260);
  }

  if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) cerrarModal();
  });

  if (btnTogglePw) {
    btnTogglePw.addEventListener('click', () => {
      const isHidden = inputPass.type === 'password';
      inputPass.type = isHidden ? 'text' : 'password';
      iconToggle.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email    = (inputEmail ? inputEmail.value.trim() : '');
      const password = (inputPass  ? inputPass.value.trim()  : '');

      if (!email || !password) {
        if (alertText) alertText.textContent = 'Ingrese el correo y la contraseña institucional.';
        if (alertError) alertError.classList.add('show');
        return;
      }

      btnSubmit.disabled = true;
      const originalHTML = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<span class="spinner-sm"></span> Verificando...';
      if (alertError) alertError.classList.remove('show');

      try {
        const response = await fetch('descargar.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (response.ok) {
          const blob = await response.blob();
          const disposition = response.headers.get('Content-Disposition') || '';
          let filename = 'Atenciones_Estudiantes_2026-2.csv';
          const match = disposition.match(/filename="?([^";\n]+)"?/i);
          if (match && match[1]) filename = match[1].trim();

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);

          setTimeout(cerrarModal, 400);
        } else {
          const data = await response.json().catch(() => ({}));
          const msg = data.message || 'Credenciales incorrectas de Coordinación.';
          if (alertText) alertText.textContent = msg;
          if (alertError) alertError.classList.add('show');
        }
      } catch (err) {
        if (alertText) alertText.textContent = 'Error de conexión. Inténtelo más tarde.';
        if (alertError) alertError.classList.add('show');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalHTML;
      }
    });
  }
})();
