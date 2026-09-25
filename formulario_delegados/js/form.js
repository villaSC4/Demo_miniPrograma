/**
 * ==========================================================================
 * REGISTRO INSTITUCIONAL DE ASISTENCIA — REUNIÓN DE DELEGADOS 2026-2
 * Facultad de Ingeniería y Arquitectura (UCV)
 * ==========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('attendanceForm');
  const formSectionWrapper = document.getElementById('formSectionWrapper');
  const successPanel = document.getElementById('successPanel');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnReset = document.getElementById('btnReset');
  const btnNuevoRegistro = document.getElementById('btnNuevoRegistro');
  const globalAlert = document.getElementById('globalAlert');
  const globalAlertText = document.getElementById('globalAlertText');

  // Campos de entrada
  const inputNombres = document.getElementById('apellidos_nombres');
  const inputCodigo = document.getElementById('codigo_alumno');
  const inputCorreo = document.getElementById('correo');
  const selectEscuela = document.getElementById('escuela_profesional');
  const inputAsignatura = document.getElementById('asignatura');
  const inputSeccion = document.getElementById('seccion');
  const inputCiclo = document.getElementById('ciclo');
  const checkDeclaracion = document.getElementById('declaracion_aceptada');
  const cicloBadgeText = document.getElementById('cicloBadgeText');
  const cicloBtns = document.querySelectorAll('.ciclo-btn-option');
  const complianceBox = document.getElementById('wrap_declaracion');

  // Elementos del Resumen de Constancia
  const resNombre = document.getElementById('resNombre');
  const resCodigo = document.getElementById('resCodigo');
  const resEscuela = document.getElementById('resEscuela');
  const resAsignatura = document.getElementById('resAsignatura');
  const resCicloSeccion = document.getElementById('resCicloSeccion');
  const resFecha = document.getElementById('resFecha');

  if (!form) return;

  // ==========================================================================
  // GESTIÓN DEL SELECTOR DE CICLO
  // ==========================================================================
  cicloBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cicloBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const cicloVal = btn.dataset.ciclo;
      inputCiclo.value = cicloVal;
      if (cicloBadgeText) {
        cicloBadgeText.textContent = `Ciclo ${cicloVal} Seleccionado`;
        cicloBadgeText.style.color = '#002855';
        cicloBadgeText.style.fontWeight = '700';
      }
      clearFieldError('wrap_ciclo');
    });
  });

  // Resaltado de caja de cumplimiento al marcar checkbox
  if (checkDeclaracion && complianceBox) {
    checkDeclaracion.addEventListener('change', () => {
      if (checkDeclaracion.checked) {
        complianceBox.classList.add('active');
        clearFieldError('wrap_declaracion');
      } else {
        complianceBox.classList.remove('active');
      }
    });
  }

  // Limpieza en tiempo real de errores al tipear y restricción estricta de 10 dígitos
  if (inputCodigo) {
    inputCodigo.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  [inputNombres, inputCodigo, inputCorreo, inputAsignatura, inputSeccion].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      const wrapper = inp.closest('.field-item');
      if (wrapper) wrapper.classList.remove('has-error');
      hideAlert();
    });
  });

  if (selectEscuela) {
    selectEscuela.addEventListener('change', () => {
      clearFieldError('wrap_escuela_profesional');
      hideAlert();
    });
  }

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
        const feedback = el.querySelector('.input-error-feedback span');
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
  // ENVÍO Y VALIDACIÓN DEL FORMULARIO
  // ==========================================================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    let isValid = true;
    let firstErrorElement = null;

    // 1. Validar Apellidos y Nombres
    const nombres = inputNombres.value.trim();
    if (!nombres || nombres.length < 4) {
      setFieldError('wrap_apellidos_nombres', 'Por favor ingrese sus apellidos y nombres completos.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_apellidos_nombres');
    }

    // 2. Validar Código de Alumno (Restricción de exactamente 10 dígitos numéricos)
    const codigo = inputCodigo.value.trim();
    if (!codigo || !/^\d{10}$/.test(codigo)) {
      setFieldError('wrap_codigo_alumno', 'El código de estudiante debe contener exactamente 10 dígitos numéricos (ej. 6500018511).');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_codigo_alumno');
    }

    // 3. Validar Escuela Profesional
    if (!selectEscuela.value) {
      setFieldError('wrap_escuela_profesional', 'Seleccione su Escuela Profesional.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_escuela_profesional');
    }

    // 4. Validar Asignatura
    const asignatura = inputAsignatura.value.trim();
    if (!asignatura || asignatura.length < 2) {
      setFieldError('wrap_asignatura', 'Ingrese el nombre de la asignatura.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_asignatura');
    }

    // 4b. Validar Sección (OBLIGATORIA)
    const seccion = inputSeccion.value.trim();
    if (!seccion || seccion.length < 1) {
      setFieldError('wrap_seccion', 'La sección o grupo de aula es obligatoria.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_seccion');
    }

    // 5. Validar Ciclo
    if (!inputCiclo.value) {
      setFieldError('wrap_ciclo', 'Haga clic en uno de los ciclos para seleccionarlo.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_ciclo');
    }

    // 6. Validar Declaración Jurada
    if (!checkDeclaracion.checked) {
      setFieldError('wrap_declaracion', 'Debe marcar la declaración de conformidad para continuar.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_declaracion');
    }

    if (!isValid) {
      showAlert('Por favor revise los campos señalados en rojo antes de registrar su asistencia.');
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Armar objeto de envío
    const payload = {
      apellidos_nombres: nombres,
      codigo_alumno: codigo,
      correo: inputCorreo.value.trim(),
      escuela_profesional: selectEscuela.value,
      asignatura: asignatura,
      seccion: inputSeccion.value.trim(),
      ciclo: inputCiclo.value,
      declaracion_aceptada: 1
    };

    // Estado visual en botón
    btnSubmit.disabled = true;
    const originalBtnText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<span class="spinner-sm"></span> Registrando Asistencia...';

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
        // Llenar Ficha de Constancia
        if (resNombre) resNombre.textContent = payload.apellidos_nombres;
        if (resCodigo) resCodigo.textContent = payload.codigo_alumno;
        if (resEscuela) resEscuela.textContent = payload.escuela_profesional;
        if (resAsignatura) resAsignatura.textContent = payload.asignatura;
        if (resCicloSeccion) {
          const sec = payload.seccion ? ` • Sección ${payload.seccion}` : '';
          resCicloSeccion.textContent = `Ciclo ${payload.ciclo}${sec}`;
        }
        if (resFecha) {
          resFecha.textContent = data.fecha || new Date().toLocaleString('es-PE');
        }

        // Mostrar pantalla de confirmación
        formSectionWrapper.style.display = 'none';
        successPanel.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const errorText = data.message || (data.errors ? data.errors.join(', ') : 'No se pudo registrar la asistencia.');
        showAlert(errorText);
      }
    } catch (err) {
      console.error('Error de comunicación:', err);
      showAlert('Error de conexión con el servidor. Verifique su acceso a internet.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalBtnText;
    }
  });

  // ==========================================================================
  // BOTÓN LIMPIAR CAMPOS
  // ==========================================================================
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('¿Desea restablecer todos los campos del formulario?')) {
        form.reset();
        inputCiclo.value = '';
        cicloBtns.forEach(b => b.classList.remove('selected'));
        if (cicloBadgeText) cicloBadgeText.textContent = 'Seleccione una opción';
        if (complianceBox) complianceBox.classList.remove('active');
        document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
        hideAlert();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // ==========================================================================
  // BOTÓN REGISTRAR A OTRO DELEGADO
  // ==========================================================================
  if (btnNuevoRegistro) {
    btnNuevoRegistro.addEventListener('click', () => {
      form.reset();
      inputCiclo.value = '';
      cicloBtns.forEach(b => b.classList.remove('selected'));
      if (cicloBadgeText) cicloBadgeText.textContent = 'Seleccione una opción';
      if (complianceBox) complianceBox.classList.remove('active');
      document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
      hideAlert();
      successPanel.classList.remove('active');
      formSectionWrapper.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

// ============================================================================
// MÓDULO: DESCARGA PROTEGIDA CON VALIDACIÓN DE CREDENCIALES
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

  /* ---- Abrir modal ---- */
  btnAbrir.addEventListener('click', () => {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { if (inputEmail) inputEmail.focus(); }, 280);
  });

  /* ---- Cerrar modal (botón X) ---- */
  function cerrarModal() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (authForm)   authForm.reset();
      if (alertError) alertError.classList.remove('show');
      if (inputEmail) inputEmail.classList.remove('input-error');
      if (inputPass)  inputPass.classList.remove('input-error');
      resetPwVisibility();
    }, 260);
  }

  if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal);

  /* Clic fuera del modal para cerrarlo */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal();
  });

  /* Tecla Escape */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) cerrarModal();
  });

  /* ---- Toggle mostrar/ocultar contraseña ---- */
  function resetPwVisibility() {
    if (inputPass)   inputPass.type = 'password';
    if (iconToggle)  iconToggle.className = 'bi bi-eye';
  }

  if (btnTogglePw) {
    btnTogglePw.addEventListener('click', () => {
      const isHidden = inputPass.type === 'password';
      inputPass.type = isHidden ? 'text' : 'password';
      iconToggle.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  }

  /* ---- Limpiar error al escribir ---- */
  [inputEmail, inputPass].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      inp.classList.remove('input-error');
      if (alertError) alertError.classList.remove('show');
    });
  });

  /* ---- Envío del formulario de autenticación ---- */
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email    = (inputEmail ? inputEmail.value.trim() : '');
      const password = (inputPass  ? inputPass.value.trim()  : '');

      /* Validación básica del cliente */
      let hasError = false;
      if (!email) {
        inputEmail && inputEmail.classList.add('input-error');
        hasError = true;
      }
      if (!password) {
        inputPass && inputPass.classList.add('input-error');
        hasError = true;
      }
      if (hasError) {
        mostrarErrorModal('Por favor complete el correo y la contraseña.');
        return;
      }

      /* Estado de carga */
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
          /* Credenciales válidas → guardar sesión y descargar el archivo sin navegar */
          sessionStorage.setItem('delegados_coord_auth', 'true');
          sessionStorage.setItem('delegados_coord_email', email);
          sessionStorage.setItem('delegados_coord_pass', password);

          const blob        = await response.blob();
          const disposition = response.headers.get('Content-Disposition') || '';
          let filename      = 'Delegados_2026-2.csv';
          const match       = disposition.match(/filename="?([^";\n]+)"?/i);
          if (match && match[1]) filename = match[1].trim();

          const url  = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href  = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);

          /* Cerrar modal tras iniciar la descarga */
          setTimeout(cerrarModal, 400);
        } else {
          /* Credenciales incorrectas */
          const data = await response.json().catch(() => ({}));
          const msg  = data.message || 'Credenciales incorrectas. Inténtelo de nuevo.';
          mostrarErrorModal(msg);
          if (inputEmail) inputEmail.classList.add('input-error');
          if (inputPass)  inputPass.classList.add('input-error');
        }
      } catch (err) {
        console.error('[Descarga] Error de red:', err);
        mostrarErrorModal('Error de conexión. Verifique su acceso a internet.');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalHTML;
      }
    });
  }

  function mostrarErrorModal(msg) {
    if (alertText)  alertText.textContent = msg;
    if (alertError) alertError.classList.add('show');
  }
})();

// ============================================================================
// MÓDULO: ESTANDARIZACIÓN Y CONFIGURACIÓN DEL MEMBRETADO PARA AÑOS POSTERIORES
// ============================================================================
(function () {
  // Modal 1: Login de Coordinación (Replicado tal cual del Excel)
  const overlayLogin = document.getElementById('modalLoginMembreteOverlay');
  const btnCerrarLogin = document.getElementById('btnCerrarModalLoginMembrete');
  const formLogin = document.getElementById('membreteAuthForm');
  const inputMbEmail = document.getElementById('mbEmail');
  const inputMbPass = document.getElementById('mbPass');
  const btnToggleMbPw = document.getElementById('btnToggleMbPw');
  const iconToggleMbPw = document.getElementById('iconToggleMbPw');
  const alertLogin = document.getElementById('modalLoginMembreteAlert');
  const alertLoginText = document.getElementById('modalLoginMembreteAlertText');
  const btnSubmitLogin = document.getElementById('btnValidarLoginMembrete');

  // Modal 2: Configuración del Membrete
  const overlayConfig = document.getElementById('modalConfigMembreteOverlay');
  const btnAbrir = document.getElementById('btnAbrirConfigMembrete');
  const btnCerrarConfig = document.getElementById('btnCerrarModalMembrete');
  const formMembrete = document.getElementById('formConfigMembrete');
  const alertMembrete = document.getElementById('modalMembreteAlert');
  const alertMembreteText = document.getElementById('modalMembreteAlertText');
  const btnCerrarSesion = document.getElementById('btnCerrarSesionCoord');
  const lblCoordEmail = document.getElementById('lblCoordEmail');
  const btnRestablecer = document.getElementById('btnRestablecerMembrete');
  const btnGuardar = document.getElementById('btnGuardarMembrete');

  // Campos de edición
  const inputTitulo = document.getElementById('cfgTitulo');
  const inputSemestre = document.getElementById('cfgSemestre');
  const inputFecha = document.getElementById('cfgFecha');
  const inputPrograma = document.getElementById('cfgPrograma');
  const inputFacultad = document.getElementById('cfgFacultad');
  const inputMensaje = document.getElementById('cfgMensaje');

  let currentConfig = {
    titulo_reunion: "REUNIÓN DE DELEGADOS 2026-2",
    semestre: "2026-II",
    fecha_evento: "24 de Septiembre de 2026",
    programa: "SUBE A Distancia",
    facultad: "Facultad de Ingeniería y Arquitectura",
    subtitulo: "Facultad de Ingeniería y Arquitectura • Programa SUBE",
    mensaje_bienvenida: "Estimados(as) delegados(as): Por encargo de la Dirección de Escuela y la Coordinación Académica, les damos la cordial bienvenida a la reunión de delegados del semestre. Por favor, registren sus datos de filiación y asignatura como evidencia formal de participación y representatividad estudiantil."
  };

  function isCoordAuth() {
    return sessionStorage.getItem('delegados_coord_auth') === 'true';
  }

  function getCoordEmail() {
    return sessionStorage.getItem('delegados_coord_email') || 'coordinacion.fia@ucvvirtual.edu.pe';
  }

  function getCoordPass() {
    return sessionStorage.getItem('delegados_coord_pass') || 'DelegadosFIA2026';
  }

  // Cargar configuración guardada al iniciar
  async function initMembrete() {
    const local = localStorage.getItem('delegados_membrete_config');
    if (local) {
      try {
        currentConfig = { ...currentConfig, ...JSON.parse(local) };
        applyMembreteUI(currentConfig);
      } catch (e) {}
    }

    try {
      let res;
      try {
        res = await fetch('config_membrete.php');
      } catch (e) {
        res = await fetch('/formulario_delegados/config_membrete.php');
      }
      if (res && res.ok) {
        const data = await res.json();
        currentConfig = { ...currentConfig, ...data };
        localStorage.setItem('delegados_membrete_config', JSON.stringify(currentConfig));
        applyMembreteUI(currentConfig);
      }
    } catch (err) {
      console.warn('Usando configuración local de membrete:', err);
    }
  }

  function applyMembreteUI(cfg) {
    const pill = document.getElementById('headerPillText');
    const mainTitle = document.getElementById('formMainTitle');
    const mainSub = document.getElementById('formMainSubtitle');
    const mainMsg = document.getElementById('formMainMessage');
    const confirmTitle = document.getElementById('confirmMeetingTitle');

    if (pill) {
      pill.textContent = `${cfg.programa} • Semestre ${cfg.semestre} • ${cfg.fecha_evento}`;
    }
    if (mainTitle) {
      mainTitle.textContent = cfg.titulo_reunion;
    }
    if (mainSub) {
      mainSub.textContent = cfg.subtitulo || `${cfg.facultad} • Programa ${cfg.programa}`;
    }
    if (mainMsg && cfg.mensaje_bienvenida) {
      mainMsg.textContent = cfg.mensaje_bienvenida;
    }
    if (confirmTitle) {
      confirmTitle.textContent = cfg.titulo_reunion;
    }
    document.title = `${cfg.titulo_reunion} — ${cfg.facultad} | UCV`;
  }

  // --- Manejo del botón superior "⚙️ Membrete" ---
  if (btnAbrir) {
    btnAbrir.addEventListener('click', () => {
      if (isCoordAuth()) {
        abrirModalConfig();
      } else {
        abrirModalLogin();
      }
    });
  }

  // Abrir modal de login
  function abrirModalLogin() {
    if (!overlayLogin) return;
    overlayLogin.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (alertLogin) alertLogin.classList.remove('show');
    if (inputMbEmail) {
      inputMbEmail.value = sessionStorage.getItem('delegados_coord_email') || 'coordinacion.fia@ucvvirtual.edu.pe';
    }
    if (inputMbPass) inputMbPass.value = '';
    setTimeout(() => { if (inputMbPass) inputMbPass.focus(); }, 250);
  }

  function cerrarModalLogin() {
    if (!overlayLogin) return;
    overlayLogin.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (btnCerrarLogin) btnCerrarLogin.addEventListener('click', cerrarModalLogin);

  if (overlayLogin) {
    overlayLogin.addEventListener('click', (e) => {
      if (e.target === overlayLogin) cerrarModalLogin();
    });
  }

  // Toggle contraseña en login
  if (btnToggleMbPw && inputMbPass) {
    btnToggleMbPw.addEventListener('click', () => {
      const isHidden = (inputMbPass.type === 'password');
      inputMbPass.type = isHidden ? 'text' : 'password';
      if (iconToggleMbPw) iconToggleMbPw.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  }

  // Envío del formulario de Login para Membrete
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = inputMbEmail ? inputMbEmail.value.trim() : '';
      const password = inputMbPass ? inputMbPass.value.trim() : '';

      if (!email || !password) {
        mostrarErrorLogin('Por favor complete el correo y la contraseña institucional.');
        return;
      }

      btnSubmitLogin.disabled = true;
      const originalHtml = btnSubmitLogin.innerHTML;
      btnSubmitLogin.innerHTML = '<span class="spinner-sm"></span> Verificando...';
      if (alertLogin) alertLogin.classList.remove('show');

      try {
        let res;
        try {
          res = await fetch('config_membrete.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email, password })
          });
        } catch (e) {
          res = await fetch('/formulario_delegados/config_membrete.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email, password })
          });
        }

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          // Sesión iniciada con éxito
          sessionStorage.setItem('delegados_coord_auth', 'true');
          sessionStorage.setItem('delegados_coord_email', email);
          sessionStorage.setItem('delegados_coord_pass', password);

          cerrarModalLogin();
          setTimeout(abrirModalConfig, 250);
        } else {
          mostrarErrorLogin(data.message || 'Credenciales incorrectas. Verifique el correo y la contraseña.');
        }
      } catch (err) {
        console.error('Error de autenticación:', err);
        // Fallback local si el servidor no responde
        if ((email.toLowerCase() === 'coordinacion.fia@ucvvirtual.edu.pe' || email.toLowerCase() === 'coordinacion.fia') && (password === 'DelegadosFIA2026' || password === 'ucv2026')) {
          sessionStorage.setItem('delegados_coord_auth', 'true');
          sessionStorage.setItem('delegados_coord_email', email);
          sessionStorage.setItem('delegados_coord_pass', password);
          cerrarModalLogin();
          setTimeout(abrirModalConfig, 250);
        } else {
          mostrarErrorLogin('Error de conexión o credenciales no válidas.');
        }
      } finally {
        btnSubmitLogin.disabled = false;
        btnSubmitLogin.innerHTML = originalHtml;
      }
    });
  }

  function mostrarErrorLogin(msg) {
    if (alertLoginText) alertLoginText.textContent = msg;
    if (alertLogin) alertLogin.classList.add('show');
  }

  // --- Modal de Configuración del Membrete (Desbloqueado tras login) ---
  function abrirModalConfig() {
    if (!overlayConfig) return;
    overlayConfig.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (lblCoordEmail) {
      lblCoordEmail.textContent = getCoordEmail();
    }

    // Rellenar valores actuales
    if (inputTitulo) inputTitulo.value = currentConfig.titulo_reunion || '';
    if (inputSemestre) inputSemestre.value = currentConfig.semestre || '';
    if (inputFecha) inputFecha.value = currentConfig.fecha_evento || '';
    if (inputPrograma) inputPrograma.value = currentConfig.programa || '';
    if (inputFacultad) inputFacultad.value = currentConfig.facultad || '';
    if (inputMensaje) inputMensaje.value = currentConfig.mensaje_bienvenida || '';

    if (alertMembrete) alertMembrete.classList.remove('show');
  }

  function cerrarModalConfig() {
    if (!overlayConfig) return;
    overlayConfig.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (btnCerrarConfig) btnCerrarConfig.addEventListener('click', cerrarModalConfig);

  if (overlayConfig) {
    overlayConfig.addEventListener('click', (e) => {
      if (e.target === overlayConfig) cerrarModalConfig();
    });
  }

  // Cerrar sesión
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', () => {
      sessionStorage.removeItem('delegados_coord_auth');
      sessionStorage.removeItem('delegados_coord_email');
      sessionStorage.removeItem('delegados_coord_pass');
      cerrarModalConfig();
      alert('Sesión de Coordinación finalizada.');
    });
  }

  // Restablecer valores estándar
  if (btnRestablecer) {
    btnRestablecer.addEventListener('click', async () => {
      if (!confirm('¿Desea restablecer el membretado oficial a los valores estándar de la REUNIÓN DE DELEGADOS 2026-2?')) {
        return;
      }

      btnRestablecer.disabled = true;
      try {
        let res;
        try {
          res = await fetch('config_membrete.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset', password: getCoordPass() })
          });
        } catch (e) {
          res = await fetch('/formulario_delegados/config_membrete.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset', password: getCoordPass() })
          });
        }

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          currentConfig = { ...currentConfig, ...data.config };
          localStorage.setItem('delegados_membrete_config', JSON.stringify(currentConfig));
          applyMembreteUI(currentConfig);
          alert('✅ Membretado oficial restablecido exitosamente.');
          cerrarModalConfig();
        } else {
          alert(data.message || 'No se pudo restablecer el membrete.');
        }
      } catch (err) {
        console.error('Error al resetear membrete:', err);
      } finally {
        btnRestablecer.disabled = false;
      }
    });
  }

  // Guardar configuración del membrete (sin necesidad de volver a ingresar contraseña)
  if (formMembrete) {
    formMembrete.addEventListener('submit', async (e) => {
      e.preventDefault();

      const updated = {
        action: 'update',
        titulo_reunion: inputTitulo ? inputTitulo.value.trim() : currentConfig.titulo_reunion,
        semestre: inputSemestre ? inputSemestre.value.trim() : currentConfig.semestre,
        fecha_evento: inputFecha ? inputFecha.value.trim() : currentConfig.fecha_evento,
        programa: inputPrograma ? inputPrograma.value.trim() : currentConfig.programa,
        facultad: inputFacultad ? inputFacultad.value.trim() : currentConfig.facultad,
        subtitulo: `${inputFacultad ? inputFacultad.value.trim() : currentConfig.facultad} • Programa ${inputPrograma ? inputPrograma.value.trim() : currentConfig.programa}`,
        mensaje_bienvenida: inputMensaje ? inputMensaje.value.trim() : currentConfig.mensaje_bienvenida,
        password: getCoordPass()
      };

      btnGuardar.disabled = true;
      const originalText = btnGuardar.innerHTML;
      btnGuardar.innerHTML = '<span class="spinner-sm"></span> Guardando...';

      try {
        let response;
        try {
          response = await fetch('config_membrete.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          });
        } catch (e) {
          response = await fetch('/formulario_delegados/config_membrete.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          });
        }

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
          currentConfig = { ...currentConfig, ...updated };
          localStorage.setItem('delegados_membrete_config', JSON.stringify(currentConfig));
          applyMembreteUI(currentConfig);

          alert('✅ Membretado oficial actualizado exitosamente para el formulario.');
          cerrarModalConfig();
        } else {
          mostrarErrorMembrete(data.message || 'Error al guardar la configuración.');
        }
      } catch (err) {
        console.error('Error al guardar membrete:', err);
        mostrarErrorMembrete('Error de conexión con el servidor.');
      } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = originalText;
      }
    });
  }

  function mostrarErrorMembrete(msg) {
    if (alertMembreteText) alertMembreteText.textContent = msg;
    if (alertMembrete) alertMembrete.classList.add('show');
  }

  // Inicializar al cargar la página
  initMembrete();
})();
