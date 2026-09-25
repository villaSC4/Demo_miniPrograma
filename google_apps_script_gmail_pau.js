/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT: VINCULACIÓN AUTOMÁTICA GMAIL -> PLATAFORMA PAU (UCV VIRTUAL)
 * Cuenta de Monitoreo: coordinacion.fia@ucvvirtual.edu.pe
 * =========================================================================================
 * 
 * INSTRUCCIONES DE INSTALACIÓN EN 3 MINUTOS:
 * 1. Inicia sesión en Google con la cuenta institucional de Coordinación FIA.
 * 2. Ingresa a: https://script.google.com y haz clic en "+ Nuevo proyecto".
 * 3. Borra todo el código que aparezca y pega este archivo completo.
 * 4. Modifica la variable WEBHOOK_URL con el dominio real de tu cPanel:
 *    Ejemplo: const WEBHOOK_URL = "https://minisistema.tu-dominio.com/api/pau.php";
 * 5. Haz clic en el ícono del Disco ("Guardar proyecto").
 * 6. Haz clic en "Ejecutar" (Run) de la función 'sincronizarCorreosConMinisistema' para otorgar permisos iniciales de lectura de Gmail.
 * 7. Ve al menú lateral "Activadores" (ícono del reloj despertador) -> "Añadir activador":
 *    - Función que se ejecutará: sincronizarCorreosConMinisistema
 *    - Origen del evento: Según tiempo (Time-driven)
 *    - Tipo de temporizador: Temporizador por minutos (Minutes timer) -> Cada 5 o 10 minutos.
 *    ¡Y listo! Cada vez que llegue un correo a la facultad, aparecerá automáticamente en la web con Estado "🟡 Sin Atención".
 */

// URL del Endpoint en tu servidor cPanel (o localhost para pruebas)
const WEBHOOK_URL = "https://uvsube.class-it.edu.pe/api/pau.php";

// Token de seguridad institucional para autenticar las peticiones
const SECRET_TOKEN = "UCV_FIA_PAU_2026";

/**
 * Función principal: Busca correos recientes no leídos o etiquetados en la bandeja
 */
function sincronizarCorreosConMinisistema() {
  try {
    // Busca los últimos 15 correos no leídos en la bandeja de entrada (últimos 3 días)
    const query = 'in:inbox is:unread newer_than:3d';
    const threads = GmailApp.search(query, 0, 15);

    if (threads.length === 0) {
      Logger.log("Bandeja al día: No hay correos nuevos no leídos por sincronizar.");
      return;
    }

    Logger.log("Se encontraron " + threads.length + " hilos de correo nuevos. Procesando...");

    for (let i = 0; i < threads.length; i++) {
      const messages = threads[i].getMessages();
      if (messages.length === 0) continue;

      // Tomamos el mensaje más reciente del hilo
      const msg = messages[messages.length - 1];

      if (msg.isUnread()) {
        const fromRaw = msg.getFrom();
        const subject = msg.getSubject() || "Consulta / Solicitud Académica";
        const date = msg.getDate();
        const bodySnippet = msg.getPlainBody().substring(0, 300);

        // Extraer nombre y correo limpio del remitente
        let senderName = fromRaw;
        let senderEmail = fromRaw;
        const match = fromRaw.match(/(.*)<(.*)>/);
        if (match) {
          senderName = match[1].replace(/"/g, '').trim();
          senderEmail = match[2].trim();
        }

        // Formato DD/MM/AAAA HH:MM
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const fechaFormatted = dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + min;

        // Clasificación preliminar de Escuela según palabras clave
        let escuela = "Ingeniería Industrial";
        const textToCheck = (subject + " " + bodySnippet).toLowerCase();
        if (textToCheck.includes("sistemas") || textToCheck.includes("software") || textToCheck.includes("redes") || textToCheck.includes("programación") || textToCheck.includes("computación")) {
          escuela = "Ingeniería de Sistemas";
        }

        // Estructura de datos idéntica a la que espera el minisistema
        const payload = {
          action: "incoming_email",
          token: SECRET_TOKEN,
          remitente: senderName.toUpperCase(),
          correo: senderEmail,
          asunto: subject,
          fecha_correo: fechaFormatted,
          escuela: escuela,
          telefono: "",
          observaciones: bodySnippet.replace(/[\r\n]+/g, ' ').trim()
        };

        const options = {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
        const resCode = response.getResponseCode();
        const resText = response.getContentText();

        Logger.log("Sincronizado [" + senderEmail + "] - HTTP " + resCode + ": " + resText);

        // Opcional: Descomentar la siguiente línea si deseas que los correos procesados se marquen como leídos
        // msg.markRead();
      }
    }
  } catch (error) {
    Logger.log("Error durante la sincronización: " + error.toString());
  }
}

/**
 * Función de prueba manual rápida
 */
function probarConexionWebhook() {
  const payloadPrueba = {
    action: "incoming_email",
    token: SECRET_TOKEN,
    remitente: "ALUMNO PRUEBA SISTEMA",
    correo: "alumno.prueba@ucvvirtual.edu.pe",
    asunto: "CONSULTA DE HORARIOS Y GRUPOS MODULARES 2026-2",
    fecha_correo: "24/09/2026 23:15",
    escuela: "Ingeniería de Sistemas",
    telefono: "+51 987 654 321",
    observaciones: "Correo de prueba enviado desde Google Apps Script para validar conexión con cPanel."
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payloadPrueba),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
  Logger.log("Resultado de prueba: " + response.getContentText());
}
