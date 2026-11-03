/**
 * ==========================================================================
 * CONTROL DE ASISTENCIA DOCENTE — SEMESTRE 2026-2
 * Facultad de Ingeniería y Arquitectura (UCV)
 * SISTEMA AISLADO
 * ==========================================================================
 */

// ============================================================================
// MÓDULO 1: FIRMA DIGITAL (Canvas Signature Pad)
// ============================================================================
class SignaturePad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.drawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.isEmpty = true;

    // Configuración del trazo
    this.ctx.strokeStyle = '#1E293B';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Ajustar resolución del canvas al tamaño real (retina)
    this._resizeCanvas();

    // Eventos de ratón
    canvas.addEventListener('mousedown', (e) => this._startDraw(e));
    canvas.addEventListener('mousemove', (e) => this._draw(e));
    canvas.addEventListener('mouseup', () => this._endDraw());
    canvas.addEventListener('mouseleave', () => this._endDraw());

    // Eventos táctiles (móvil)
    canvas.addEventListener('touchstart', (e) => this._handleTouch(e, 'start'), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._handleTouch(e, 'move'), { passive: false });
    canvas.addEventListener('touchend', () => this._endDraw(), { passive: true });

    // Deshabilitar scroll al dibujar
    canvas.style.touchAction = 'none';

    // Re-dibujar al cambiar tamaño
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.offsetWidth || 500;
    const height = rect.height || 160;
    const dpr = window.devicePixelRatio || 1;

    let dataUrl = null;
    if (!this.isEmpty) {
      try {
        dataUrl = this.canvas.toDataURL();
      } catch (e) {}
    }

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);

    // Restaurar configuración del trazo
    this.ctx.strokeStyle = '#1E293B';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (dataUrl) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = dataUrl;
    }
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  _startDraw(e) {
    this.drawing = true;
    const pos = this._getPos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);

    // Marcar como activo visualmente
    const wrap = this.canvas.closest('.signature-canvas-wrap');
    if (wrap) {
      wrap.classList.add('active');
      wrap.classList.add('has-signature');
    }
  }

  _draw(e) {
    if (!this.drawing) return;
    const pos = this._getPos(e);

    // Usar curvas cuadráticas para trazos suaves
    const midX = (pos.x + this.lastX) / 2;
    const midY = (pos.y + this.lastY) / 2;
    this.ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(midX, midY);

    this.lastX = pos.x;
    this.lastY = pos.y;
    this.isEmpty = false;
  }

  _endDraw() {
    if (this.drawing) {
      this.ctx.stroke();
    }
    this.drawing = false;
    const wrap = this.canvas.closest('.signature-canvas-wrap');
    if (wrap) wrap.classList.remove('active');
  }

  _handleTouch(e, type) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvt = {
      clientX: touch.clientX,
      clientY: touch.clientY
    };

    if (type === 'start') {
      this._startDraw(mouseEvt);
    } else {
      this._draw(mouseEvt);
    }
  }

  clear() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this.isEmpty = true;

    const wrap = this.canvas.closest('.signature-canvas-wrap');
    if (wrap) {
      wrap.classList.remove('has-signature');
      wrap.classList.remove('active');
    }
  }

  isBlank() {
    return this.isEmpty;
  }

  loadImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.clear();
      const dpr = window.devicePixelRatio || 1;
      const width = this.canvas.width / dpr;
      const height = this.canvas.height / dpr;

      // Calcular proporción adecuada para el canvas
      const maxW = width * 0.92;
      const maxH = height * 0.86;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;

      this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
      this.isEmpty = false;

      const wrap = this.canvas.closest('.signature-canvas-wrap');
      if (wrap) {
        wrap.classList.add('has-signature');
      }
    };
    img.src = dataUrl;
  }

  toDataURL() {
    if (this.isEmpty) return '';
    return this.canvas.toDataURL('image/png');
  }
}

// ============================================================================
// MÓDULO 2: FORMULARIO PRINCIPAL
// ============================================================================
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
  const inputCodigo = document.getElementById('codigo_docente');
  const inputDni = document.getElementById('dni');
  const inputCorreo = document.getElementById('correo');
  const selectEscuela = document.getElementById('escuela_profesional');
  const inputAsignatura = document.getElementById('asignatura');
  const inputSeccion = document.getElementById('seccion');
  const inputCiclo = document.getElementById('ciclo');
  const cicloBadgeText = document.getElementById('cicloBadgeText');
  const cicloBtns = document.querySelectorAll('.ciclo-btn-option');
  const inputObservaciones = document.getElementById('observaciones');
  const checkDeclaracion = document.getElementById('declaracion_aceptada');
  const complianceBox = document.getElementById('wrap_declaracion');

  // Inicializar Firma Digital
  const signatureCanvas = document.getElementById('signatureCanvas');
  let signaturePad = null;
  if (signatureCanvas) {
    signaturePad = new SignaturePad(signatureCanvas);
  }

  // Elementos de Modos de Firma (Dibujar vs Subir)
  const tabDrawFirma = document.getElementById('tabDrawFirma');
  const tabUploadFirma = document.getElementById('tabUploadFirma');
  const sigUploadPanel = document.getElementById('sigUploadPanel');
  const sigDropzone = document.getElementById('sigDropzone');
  const sigFileInput = document.getElementById('sigFileInput');
  const btnTriggerFile = document.getElementById('btnTriggerFile');
  const sigFileLoadedInfo = document.getElementById('sigFileLoadedInfo');
  const sigFileName = document.getElementById('sigFileName');
  const sigFileSize = document.getElementById('sigFileSize');
  const btnRemoveSigFile = document.getElementById('btnRemoveSigFile');
  const sigCanvasHint = document.getElementById('sigCanvasHint');
  const sigPlaceholder = document.getElementById('sigPlaceholder');
  const btnClearFirma = document.getElementById('btnClearFirma');

  let uploadedFileBase64 = null;

  // Manejo de Pestañas de Firma
  if (tabDrawFirma && tabUploadFirma) {
    tabDrawFirma.addEventListener('click', () => {
      tabDrawFirma.classList.add('active');
      tabDrawFirma.setAttribute('aria-selected', 'true');
      tabUploadFirma.classList.remove('active');
      tabUploadFirma.setAttribute('aria-selected', 'false');
      if (sigUploadPanel) sigUploadPanel.style.display = 'none';
      if (sigCanvasHint) sigCanvasHint.innerHTML = '<i class="bi bi-pen me-1"></i>Recuadro de firma (dibuje con el ratón o con el dedo):';
      if (sigPlaceholder) sigPlaceholder.textContent = 'Dibuje su firma aquí con el ratón o con el dedo';
    });

    tabUploadFirma.addEventListener('click', () => {
      tabUploadFirma.classList.add('active');
      tabUploadFirma.setAttribute('aria-selected', 'true');
      tabDrawFirma.classList.remove('active');
      tabDrawFirma.setAttribute('aria-selected', 'false');
      if (sigUploadPanel) sigUploadPanel.style.display = 'block';
      if (sigCanvasHint) sigCanvasHint.innerHTML = '<i class="bi bi-eye me-1"></i>Vista previa de la firma:';
      if (sigPlaceholder) sigPlaceholder.textContent = 'Cargue o arrastre un archivo con su firma';
    });
  }

  // Función para procesar archivo cargado
  function processSignatureFile(file) {
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
      showAlert('Formato no válido. Debe seleccionar una imagen PNG, JPG o WEBP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showAlert('La imagen de la firma excede el límite máximo de 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedFileBase64 = e.target.result;
      if (signaturePad) {
        signaturePad.loadImage(uploadedFileBase64);
      }
      if (sigFileName) sigFileName.textContent = file.name;
      if (sigFileSize) {
        const kb = (file.size / 1024).toFixed(1);
        sigFileSize.textContent = kb + ' KB';
      }
      if (sigFileLoadedInfo) sigFileLoadedInfo.style.display = 'block';
      clearFieldError('wrap_firma');
      hideAlert();
    };
    reader.readAsDataURL(file);
  }

  if (btnTriggerFile && sigFileInput) {
    btnTriggerFile.addEventListener('click', (e) => {
      e.stopPropagation();
      sigFileInput.click();
    });
  }

  if (sigDropzone && sigFileInput) {
    sigDropzone.addEventListener('click', () => {
      sigFileInput.click();
    });

    sigDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      sigDropzone.classList.add('dragover');
    });

    sigDropzone.addEventListener('dragleave', () => {
      sigDropzone.classList.remove('dragover');
    });

    sigDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      sigDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processSignatureFile(e.dataTransfer.files[0]);
      }
    });

    sigFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processSignatureFile(e.target.files[0]);
      }
    });
  }

  if (btnRemoveSigFile) {
    btnRemoveSigFile.addEventListener('click', () => {
      if (sigFileInput) sigFileInput.click();
    });
  }

  if (btnClearFirma && signaturePad) {
    btnClearFirma.addEventListener('click', () => {
      signaturePad.clear();
      uploadedFileBase64 = null;
      if (sigFileInput) sigFileInput.value = '';
      if (sigFileLoadedInfo) sigFileLoadedInfo.style.display = 'none';
      clearFieldError('wrap_firma');
    });
  }

  // Elementos del Resumen de Constancia
  const resNombre = document.getElementById('resNombre');
  const resCodigo = document.getElementById('resCodigo');
  const resDni = document.getElementById('resDni');
  const resEscuela = document.getElementById('resEscuela');
  const resAsignatura = document.getElementById('resAsignatura');
  const resSeccion = document.getElementById('resSeccion');
  const resCiclo = document.getElementById('resCiclo');
  const resFecha = document.getElementById('resFecha');

  if (!form) return;

  // ==========================================================================
  // GESTIÓN DEL SELECTOR INSTITUCIONAL DE CICLOS ACADÉMICOS
  // ==========================================================================
  cicloBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cicloBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const cicloVal = btn.dataset.ciclo;
      if (inputCiclo) inputCiclo.value = cicloVal;
      if (cicloBadgeText) {
        cicloBadgeText.textContent = cicloVal + ' — Seleccionado';
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

  // Limpieza en tiempo real de errores al tipear y restricción de 8 dígitos para DNI
  if (inputDni) {
    inputDni.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
    });
  }

  [inputNombres, inputCodigo, inputDni, inputCorreo, inputAsignatura, inputSeccion, inputObservaciones].forEach(inp => {
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
      setFieldError('wrap_apellidos_nombres', 'Ingrese sus apellidos y nombres completos.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_apellidos_nombres');
    }

    // 2. Validar Código de Docente
    const codigo = inputCodigo ? inputCodigo.value.trim() : '';
    if (!codigo) {
      setFieldError('wrap_codigo_docente', 'Ingrese su código institucional de docente.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_codigo_docente');
    }

    // 3. Validar DNI (8 dígitos)
    const dni = inputDni.value.trim();
    if (!dni || !/^\d{8}$/.test(dni)) {
      setFieldError('wrap_dni', 'El DNI debe contener exactamente 8 dígitos numéricos.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_dni');
    }

    // 4. Validar Escuela Profesional
    if (!selectEscuela.value) {
      setFieldError('wrap_escuela_profesional', 'Seleccione su Escuela Profesional.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_escuela_profesional');
    }

    // 5. Validar Asignatura
    const asignatura = inputAsignatura.value.trim();
    if (!asignatura || asignatura.length < 2) {
      setFieldError('wrap_asignatura', 'Ingrese el nombre de la asignatura que dicta.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_asignatura');
    }

    // 6. Validar Sección / Grupo de Aula
    const seccion = inputSeccion ? inputSeccion.value.trim() : '';
    if (!seccion) {
      setFieldError('wrap_seccion', 'Ingrese la sección o grupo de aula correspondiente.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_seccion');
    }

    // 7. Validar Ciclo Académico
    if (!inputCiclo || !inputCiclo.value) {
      setFieldError('wrap_ciclo', 'Debe seleccionar el ciclo académico correspondiente.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_ciclo');
    }

    // 8. Validar Firma Digital
    if (signaturePad && signaturePad.isBlank()) {
      setFieldError('wrap_firma', 'Debe registrar su firma digital en el recuadro.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_firma');
    }

    // 9. Validar Declaración Jurada
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

    // Armar objeto de envío hacia MySQL
    const payload = {
      apellidos_nombres: nombres,
      codigo_docente: codigo,
      dni: dni,
      correo: inputCorreo.value.trim(),
      escuela_profesional: selectEscuela.value,
      asignatura: asignatura,
      seccion: seccion,
      ciclo: inputCiclo.value,
      observaciones: inputObservaciones ? inputObservaciones.value.trim() : '',
      firma: uploadedFileBase64 ? uploadedFileBase64 : (signaturePad ? signaturePad.toDataURL() : ''),
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
        if (resCodigo) resCodigo.textContent = payload.codigo_docente;
        if (resDni) resDni.textContent = payload.dni;
        if (resEscuela) resEscuela.textContent = payload.escuela_profesional;
        if (resAsignatura) resAsignatura.textContent = payload.asignatura;
        if (resSeccion) resSeccion.textContent = payload.seccion;
        if (resCiclo) resCiclo.textContent = payload.ciclo;
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
      showAlert('Error de conexión con el servidor. Verifique su acceso a la base de datos.');
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
        if (inputCiclo) inputCiclo.value = '';
        cicloBtns.forEach(b => b.classList.remove('selected'));
        if (cicloBadgeText) cicloBadgeText.textContent = 'Seleccione una opción';
        if (complianceBox) complianceBox.classList.remove('active');
        if (signaturePad) signaturePad.clear();
        uploadedFileBase64 = null;
        if (sigFileInput) sigFileInput.value = '';
        if (sigFileLoadedInfo) sigFileLoadedInfo.style.display = 'none';
        document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
        hideAlert();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // ==========================================================================
  // BOTÓN REGISTRAR A OTRO DOCENTE
  // ==========================================================================
  if (btnNuevoRegistro) {
    btnNuevoRegistro.addEventListener('click', () => {
      form.reset();
      if (inputCiclo) inputCiclo.value = '';
      cicloBtns.forEach(b => b.classList.remove('selected'));
      if (cicloBadgeText) cicloBadgeText.textContent = 'Seleccione una opción';
      if (complianceBox) complianceBox.classList.remove('active');
      if (signaturePad) signaturePad.clear();
      uploadedFileBase64 = null;
      if (sigFileInput) sigFileInput.value = '';
      if (sigFileLoadedInfo) sigFileLoadedInfo.style.display = 'none';
      document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
      hideAlert();
      successPanel.classList.remove('active');
      formSectionWrapper.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

// ============================================================================
// MÓDULO 3: DESCARGA PROTEGIDA CON VALIDACIÓN DE CREDENCIALES
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
          /* Credenciales válidas → descargar el archivo sin navegar */
          const blob        = await response.blob();
          const disposition = response.headers.get('Content-Disposition') || '';
          let filename      = 'Docentes_2026-2.csv';
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
