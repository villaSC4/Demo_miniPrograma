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

  // Limpieza en tiempo real de errores al tipear
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

    // 2. Validar Código de Alumno
    const codigo = inputCodigo.value.trim();
    if (!codigo || codigo.length < 4) {
      setFieldError('wrap_codigo_alumno', 'Por favor ingrese su código institucional de estudiante.');
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
    if (!asignatura || asignatura.length < 3) {
      setFieldError('wrap_asignatura', 'Ingrese el nombre de la asignatura.');
      isValid = false;
      if (!firstErrorElement) firstErrorElement = document.getElementById('wrap_asignatura');
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
