// api/grupos.js - Vercel Serverless Function
const fs = require('fs');
const path = require('path');

const TMP_FILE = '/tmp/grupos.json';
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'grupos.json');
const BASE_DATA_FILE = path.join(process.cwd(), 'data', 'grupos_base.json');

function getInitialData() {
  if (fs.existsSync(LOCAL_DATA_FILE)) {
    return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf-8'));
  }
  if (fs.existsSync(BASE_DATA_FILE)) {
    return JSON.parse(fs.readFileSync(BASE_DATA_FILE, 'utf-8'));
  }
  return [];
}

module.exports = (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Obtener grupos
  if (req.method === 'GET') {
    try {
      if (fs.existsSync(TMP_FILE)) {
        const data = fs.readFileSync(TMP_FILE, 'utf-8');
        return res.status(200).json(JSON.parse(data));
      }
      const initial = getInitialData();
      return res.status(200).json(initial);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al leer grupos', details: err.message });
    }
  }

  // POST: Guardar o restablecer grupos
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const { action, groups } = body || {};

      if (action === 'reset') {
        const base = getInitialData();
        try {
          fs.writeFileSync(TMP_FILE, JSON.stringify(base, null, 2), 'utf-8');
        } catch (e) {}
        return res.status(200).json({
          status: 'success',
          count: base.length,
          message: 'Datos restablecidos a la versión base oficial.'
        });
      }

      // Si el body es un array directo de grupos o { groups: [...] }
      const groupsToSave = Array.isArray(body) ? body : groups;
      if (!Array.isArray(groupsToSave)) {
        return res.status(400).json({ error: 'Se esperaba un array de grupos.' });
      }

      try {
        fs.writeFileSync(TMP_FILE, JSON.stringify(groupsToSave, null, 2), 'utf-8');
      } catch (e) {
        // En caso de que /tmp no esté disponible, no rompemos la respuesta
        console.warn('Advertencia al escribir en /tmp:', e.message);
      }

      return res.status(200).json({
        status: 'success',
        count: groupsToSave.length,
        message: `Guardados ${groupsToSave.length} grupos exitosamente.`
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al guardar grupos', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
};
