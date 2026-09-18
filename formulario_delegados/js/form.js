/**
 * Control del Formulario de Asistencia
 * 1RA REUNIÓN DE DELEGADOS 2026-2
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('delegadosForm');
  const submitBtn = document.getElementById('submitBtn');
  const resetBtn = document.getElementById('resetBtn');
  const alertBanner = document.getElementById('alertBanner');
  const alertText = document.getElementById('alertText');
  const formWrapper = document.getElementById('formWrapper');
  const successCard = document.getElementById('successCard');
  const btnNewResp = document.getElementById('btnNewResp');
  const successFecha = document.getElementById('successFecha');

  if (!form) return;

  // Limpiar errores cuando el usuario escribe o interactúa
  const inputs = form.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
    input.addEventListener('change', () => clearFieldError(input));
  });

  function clearFieldError(input) {
    const card = input.closest('.form-card');
    if (card) {
      card.classList.remove('has-error');
    }
    hideAlert();
  }

  function setFieldError(input, message) {
    const card = input.closest('.form-card');
    if (card) {
      card.classList.add('has-error');
      const errSpan = card.querySelector('.field-error-text');
      if (errSpan && message) {
        errSpan.textContent = message;
      }
    }
  }

  function showAlert(msg) {
    if (alertBanner && alertText) {
      alertText.textContent = msg;
      alertBanner.classList.add('error');
      alertBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function hideAlert() {
    if (alertBanner) {
      alertBanner.classList.remove('error');
    }
  }

  // Manejador de Envío
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    let isValid = true;
    let firstInvalidCard = null;

    // 1. Validar Apellidos y Nombres
    const nombresInput = document.getElementById('apellidos_nombres');
    if (!nombresInput.value.trim() || nombresInput.value.trim().length < 4) {
      setFieldError(nombresInput, 'Esta pregunta es obligatoria. Ingrese sus apellidos y nombres completos.');
      isValid = false;
      if (!firstInvalidCard) firstInvalidCard = nombresInput.closest('.form-card');
    }

    // 2. Validar Código de Alumno
    const codigoInput = document.getElementById('codigo_alumno');
    if (!codigoInput.value.trim() || codigoInput.value.trim().length < 4) {
      setFieldError(codigoInput, 'Esta pregunta es obligatoria. Ingrese su código de estudiante.');
      isValid = false;
      if (!firstInvalidCard) firstInvalidCard = codigoInput.closest('.form-card');
    }

    // 3. Validar Escuela Profesional
    const escuelaInput = document.getElementById('escuela_profesional');
    if (!escuelaInput.value || escuelaInput.value === 'Elegir') {
      setFieldError(escuelaInput, 'Esta pregunta es obligatoria. Seleccione su escuela profesional.');
      isValid = false;
      if (!firstInvalidCard) firstInvalidCard = escuelaInput.closest('.form-card');
    }

    // 4. Validar Asignatura
    const asignaturaInput = document.getElementById('asignatura');
    if (!asignaturaInput.value.trim() || asignaturaInput.value.trim().length < 3) {
      setFieldError(asignaturaInput, 'Esta pregunta es obligatoria. Ingrese el nombre del curso.');
      isValid = false;
      if (!firstInvalidCard) firstInvalidCard = asignaturaInput.closest('.form-card');
    }

    // 5. Validar Ciclo
    const cicloInput = document.getElementById('ciclo');
    if (!cicloInput.value || cicloInput.value === 'Elegir') {
      setFieldError(cicloInput, 'Esta pregunta es obligatoria. Seleccione o indique su ciclo académico.');
      isValid = false;
      if (!firstInvalidCard) firstInvalidCard = cicloInput.closest('.form-card');
    }

    // 6. Validar Declaración
    const declaracionInput = document.getElementById('declaracion_aceptada');
    if (!declaracionInput.checked) {
      setFieldError(declaracionInput, 'Debe aceptar la declaración jurada y autorización de datos para registrar su asistencia.');
      isValid = false;
      if (!firstInvalidCard) firstInvalidCard = declaracionInput.closest('.form-card');
    }

    if (!isValid) {
      showAlert('Por favor completa todos los campos obligatorios marcados con asterisco (*).');
      if (firstInvalidCard) {
        firstInvalidCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Recopilar datos
    const payload = {
      apellidos_nombres: nombresInput.value.trim(),
      codigo_alumno: codigoInput.value.trim(),
      correo: (document.getElementById('correo')?.value || '').trim(),
      escuela_profesional: escuelaInput.value,
      asignatura: asignaturaInput.value.trim(),
      seccion: (document.getElementById('seccion')?.value || '').trim(),
      ciclo: cicloInput.value,
      declaracion_aceptada: 1
    };

    // Estado cargando
    submitBtn.disabled = true;
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border-sm"></span> Enviando...';

    try {
      const resp = await fetch('submit.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();

      if (resp.ok && data.success) {
        // Ocultar formulario y mostrar pantalla de confirmación
        formWrapper.style.display = 'none';
        successCard.classList.add('active');
        if (successFecha && data.fecha) {
          successFecha.textContent = `Registrado el ${data.fecha}`;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const errorMsg = data.message || (data.errors ? data.errors.join(', ') : 'Ocurrió un error al enviar el formulario.');
        showAlert(errorMsg);
      }
    } catch (err) {
      console.error('Error al enviar:', err);
      showAlert('No se pudo conectar con el servidor. Verifique su conexión a internet.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  });

  // Botón Borrar Formulario
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('¿Deseas restablecer todos los campos del formulario?')) {
        form.reset();
        document.querySelectorAll('.form-card.has-error').forEach(c => c.classList.remove('has-error'));
        hideAlert();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Botón Enviar otra respuesta
  if (btnNewResp) {
    btnNewResp.addEventListener('click', () => {
      form.reset();
      document.querySelectorAll('.form-card.has-error').forEach(c => c.classList.remove('has-error'));
      hideAlert();
      successCard.classList.remove('active');
      formWrapper.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});
