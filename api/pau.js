// api/pau.js - Vercel Serverless Function para Módulo PAE
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

  // GET: Obtener lista de correos PAE
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

      // Persistencia manual: reemplazo completo de la lista de tickets
      if (Array.isArray(body)) {
        try {
          fs.writeFileSync(TMP_FILE, JSON.stringify(body, null, 2), 'utf-8');
        } catch (e) {}
        return res.status(200).json({ status: 'success', count: body.length });
      }

      return res.status(400).json({ error: 'Se esperaba una lista de solicitudes PAE' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error procesando solicitud PAE', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
};
