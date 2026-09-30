// api/pau.js - Vercel Serverless Function para Módulo PAU
const fs = require('fs');
const path = require('path');

const TMP_FILE = '/tmp/pau_correos.json';
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'pau_correos.json');

function getInitialData() {
  if (fs.existsSync(TMP_FILE)) {
    try { return JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8')); } catch (e) {}
  }
  if (fs.existsSync(LOCAL_DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf-8')); } catch (e) {}
  }
  return [];
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Obtener lista de correos PAU
  if (req.method === 'GET') {
    const data = getInitialData();
    return res.status(200).json(data);
  }

  // POST: Guardar o agregar tickets
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      if (!body) {
        return res.status(400).json({ error: 'Body vacío' });
      }

      let existing = getInitialData();

      // Caso array: reemplazo completo de la lista
      if (Array.isArray(body)) {
        try {
          fs.writeFileSync(TMP_FILE, JSON.stringify(body, null, 2), 'utf-8');
        } catch (e) {}
        return res.status(200).json({ status: 'success', count: body.length });
      }

      // Caso individual (nuevo correo / webhook)
      const correo = (body.correo || '').trim();
      const asunto = (body.asunto || 'SIN ASUNTO').trim();

      const exists = existing.find(item => 
        (item.correo || '').toLowerCase() === correo.toLowerCase() && 
        (item.asunto || '').toLowerCase() === asunto.toLowerCase()
      );

      if (exists) {
        return res.status(200).json({ status: 'already_exists', ticket: exists });
      }

      const maxId = existing.reduce((max, item) => Math.max(max, parseInt(item.id || 0, 10)), 0);
      const now = new Date();
      const nowStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const newTicket = {
        id: maxId + 1,
        fecha_correo: body.fecha_correo || nowStr,
        remitente: (body.remitente || 'ALUMNO / DOCENTE UCV').toUpperCase(),
        correo: correo,
        escuela: body.escuela || 'Ingeniería Industrial',
        telefono: body.telefono || '',
        asunto: asunto,
        estado_atencion: 'Sin Atención',
        visto_coordinacion: 'SIN APROBACIÓN',
        fecha_respuesta: '-',
        observaciones: (body.observaciones || 'Sincronizado vía PAU').trim()
      };

      existing.unshift(newTicket);
      try {
        fs.writeFileSync(TMP_FILE, JSON.stringify(existing, null, 2), 'utf-8');
      } catch (e) {}

      return res.status(200).json({ status: 'success', ticket: newTicket });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error procesando solicitud PAU', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
};
