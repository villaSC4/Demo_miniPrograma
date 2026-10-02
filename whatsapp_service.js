/**
 * ==============================================================================
 * WHATSAPP_SERVICE.JS - Microservicio Real de WhatsApp Web para Módulo PAU
 * Basado en @whiskeysockets/baileys (Multi-Device WebSockets)
 * ==============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const multer = require('multer');
const pino = require('pino');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  jidDecode
} = require('@whiskeysockets/baileys');

// Configuración de Directorios
const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const SESSION_DIR = path.join(DATA_DIR, 'whatsapp_session');
const MEDIA_DIR = path.join(DATA_DIR, 'whatsapp_media');
const CHATS_FILE = path.join(DATA_DIR, 'whatsapp_chats.json');

// Asegurar existencia de directorios
[DATA_DIR, SESSION_DIR, MEDIA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configuración de Multer para carga de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeName = `out_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 64 * 1024 * 1024 } // 64 MB
});

// Estado Global del Servicio
let sock = null;
let currentQR = null;
let connectionStatus = 'DISCONNECTED'; // 'DISCONNECTED', 'QR_READY', 'CONNECTING', 'CONNECTED'
let connectedAccount = null;
let sseClients = [];
let chatsData = {
  chats: {},
  messages: {}
};

// Cargar historial persistido
function loadChatsFromDisk() {
  try {
    if (fs.existsSync(CHATS_FILE)) {
      const raw = fs.readFileSync(CHATS_FILE, 'utf-8');
      chatsData = JSON.parse(raw);
      if (!chatsData.chats) chatsData.chats = {};
      if (!chatsData.messages) chatsData.messages = {};
    }
  } catch (err) {
    console.error('[WA-STORE] Error al leer chats:', err.message);
  }
}

function saveChatsToDisk() {
  try {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(chatsData, null, 2), 'utf-8');
  } catch (err) {
    console.error('[WA-STORE] Error al guardar chats:', err.message);
  }
}
loadChatsFromDisk();

// Transmisión en tiempo real vía SSE (Server-Sent Events)
function broadcastSSE(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(payload);
    } catch (e) {}
  });
}

// Inicialización del Socket Baileys
async function startWhatsAppSocket() {
  try {
    console.log('[WA-ENGINE] Iniciando cliente WhatsApp...');
    connectionStatus = 'CONNECTING';
    broadcastSSE('status', { status: connectionStatus });

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WA-ENGINE] Usando versión Baileys v${version.join('.')} (Última: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      browser: ['UCV PAU Virtual', 'Chrome', '120.0.0']
    });

    // Guardado de credenciales
    sock.ev.on('creds.update', saveCreds);

    // Actualización de Conexión y Código QR
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[WA-ENGINE] Nuevo código QR generado para escaneo.');
        currentQR = await QRCode.toDataURL(qr);
        connectionStatus = 'QR_READY';
        broadcastSSE('qr', { qr: currentQR, status: connectionStatus });
      }

      if (connection === 'close') {
        currentQR = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WA-ENGINE] Conexión cerrada. Razón código: ${statusCode}. Reintentar: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          connectionStatus = 'DISCONNECTED';
          connectedAccount = null;
          // Limpiar sesión al cerrar sesión manualmente
          try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
          } catch (e) {}
          broadcastSSE('status', { status: connectionStatus, user: null });
          // Reiniciar para generar nuevo QR limpio
          setTimeout(startWhatsAppSocket, 2000);
        } else {
          connectionStatus = 'DISCONNECTED';
          broadcastSSE('status', { status: connectionStatus });
          setTimeout(startWhatsAppSocket, 3000);
        }
      } else if (connection === 'open') {
        currentQR = null;
        connectionStatus = 'CONNECTED';
        const userJid = sock.user.id;
        const phone = userJid.split(':')[0] || userJid.split('@')[0];
        connectedAccount = {
          jid: userJid,
          phone: phone,
          name: sock.user.name || 'Coordinación FIA UCV'
        };
        console.log(`[WA-ENGINE] ¡Conexión exitosa a WhatsApp! Número vinculado: +${phone}`);
        broadcastSSE('status', { status: connectionStatus, user: connectedAccount });
      }
    });

    // Recepción de Mensajes en Tiempo Real
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (!messages || messages.length === 0) return;

      for (const msg of messages) {
        if (!msg.message) continue;
        const key = msg.key;
        const jid = key.remoteJid;
        if (!jid || jid === 'status@broadcast') continue;

        const isFromMe = !!key.fromMe;
        const pushName = msg.pushName || 'Contacto UCV';
        const timestamp = (msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now());

        let messageType = 'text';
        let bodyText = '';
        let mediaUrl = null;
        let fileName = null;

        const m = msg.message;
        if (m.conversation) {
          bodyText = m.conversation;
        } else if (m.extendedTextMessage?.text) {
          bodyText = m.extendedTextMessage.text;
        } else if (m.imageMessage) {
          messageType = 'image';
          bodyText = m.imageMessage.caption || '';
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const fName = `in_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
            fs.writeFileSync(path.join(MEDIA_DIR, fName), buffer);
            mediaUrl = `/api/whatsapp/media/${fName}`;
          } catch (e) {
            console.warn('[WA-MEDIA] Error descargando imagen:', e.message);
          }
        } else if (m.videoMessage) {
          messageType = 'video';
          bodyText = m.videoMessage.caption || '';
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const fName = `in_vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.mp4`;
            fs.writeFileSync(path.join(MEDIA_DIR, fName), buffer);
            mediaUrl = `/api/whatsapp/media/${fName}`;
          } catch (e) {
            console.warn('[WA-MEDIA] Error descargando video:', e.message);
          }
        } else if (m.audioMessage) {
          messageType = 'audio';
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const fName = `in_aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.mp3`;
            fs.writeFileSync(path.join(MEDIA_DIR, fName), buffer);
            mediaUrl = `/api/whatsapp/media/${fName}`;
          } catch (e) {}
        } else if (m.documentMessage) {
          messageType = 'document';
          fileName = m.documentMessage.fileName || 'documento.pdf';
          bodyText = fileName;
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const fName = `in_doc_${Date.now()}_${fileName}`;
            fs.writeFileSync(path.join(MEDIA_DIR, fName), buffer);
            mediaUrl = `/api/whatsapp/media/${fName}`;
          } catch (e) {}
        }

        const messageObj = {
          id: key.id,
          jid,
          fromMe: isFromMe,
          senderName: isFromMe ? 'Tú (Coordinación)' : pushName,
          type: messageType,
          body: bodyText,
          mediaUrl,
          fileName,
          timestamp,
          status: isFromMe ? 'sent' : 'received'
        };

        // Guardar en la estructura de chats
        if (!chatsData.messages[jid]) chatsData.messages[jid] = [];
        chatsData.messages[jid].push(messageObj);

        // Actualizar datos del chat
        const cleanPhone = jid.split('@')[0];
        chatsData.chats[jid] = {
          jid,
          phone: cleanPhone,
          name: pushName || cleanPhone,
          lastMessage: bodyText || (messageType === 'image' ? '📷 Foto' : messageType === 'video' ? '🎥 Video' : '📎 Archivo'),
          lastTimestamp: timestamp,
          unreadCount: isFromMe ? 0 : (chatsData.chats[jid]?.unreadCount || 0) + 1
        };

        saveChatsToDisk();
        broadcastSSE('message', { message: messageObj, chat: chatsData.chats[jid] });
      }
    });

  } catch (error) {
    console.error('[WA-ENGINE] Error crítico en inicio de socket:', error);
    connectionStatus = 'DISCONNECTED';
    broadcastSSE('status', { status: connectionStatus, error: error.message });
    setTimeout(startWhatsAppSocket, 5000);
  }
}

// Configuración de la API REST Express
const app = express();
const PORT = process.env.WA_PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos multimedia descargados
app.use('/api/whatsapp/media', express.static(MEDIA_DIR));

// 1. Estado y QR
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    status: connectionStatus,
    hasQR: !!currentQR,
    user: connectedAccount
  });
});

app.get('/api/whatsapp/qr', (req, res) => {
  res.json({
    status: connectionStatus,
    qr: currentQR
  });
});

// 2. Stream en tiempo real vía SSE
app.get('/api/whatsapp/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const clientId = Date.now();
  const clientObj = { id: clientId, res };
  sseClients.push(clientObj);

  // Enviar estado inicial inmediato
  res.write(`event: status\ndata: ${JSON.stringify({ status: connectionStatus, user: connectedAccount })}\n\n`);
  if (currentQR) {
    res.write(`event: qr\ndata: ${JSON.stringify({ qr: currentQR, status: connectionStatus })}\n\n`);
  }

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// 3. Obtener lista de chats
app.get('/api/whatsapp/chats', (req, res) => {
  const list = Object.values(chatsData.chats).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  res.json(list);
});

// 4. Obtener mensajes de un contacto específico
app.get('/api/whatsapp/messages/:jid', (req, res) => {
  const jid = decodeURIComponent(req.params.jid);
  const msgs = chatsData.messages[jid] || [];
  // Resetear contador de no leídos al abrir conversación
  if (chatsData.chats[jid]) {
    chatsData.chats[jid].unreadCount = 0;
    saveChatsToDisk();
  }
  res.json(msgs);
});

// 5. Enviar mensaje de texto
app.post('/api/whatsapp/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Parámetros requeridos: to, message' });
  }

  if (connectionStatus !== 'CONNECTED' || !sock) {
    return res.status(503).json({ error: 'WhatsApp no está conectado. Escanea el código QR primero.' });
  }

  try {
    let cleanPhone = to.replace(/\D/g, '');
    if (!cleanPhone.includes('@')) {
      cleanPhone = `${cleanPhone}@s.whatsapp.net`;
    }

    const sent = await sock.sendMessage(cleanPhone, { text: message.trim() });
    const timestamp = Date.now();

    const messageObj = {
      id: sent.key.id,
      jid: cleanPhone,
      fromMe: true,
      senderName: 'Tú (Coordinación)',
      type: 'text',
      body: message.trim(),
      mediaUrl: null,
      timestamp,
      status: 'sent'
    };

    if (!chatsData.messages[cleanPhone]) chatsData.messages[cleanPhone] = [];
    chatsData.messages[cleanPhone].push(messageObj);

    chatsData.chats[cleanPhone] = {
      jid: cleanPhone,
      phone: cleanPhone.split('@')[0],
      name: chatsData.chats[cleanPhone]?.name || cleanPhone.split('@')[0],
      lastMessage: message.trim(),
      lastTimestamp: timestamp,
      unreadCount: 0
    };

    saveChatsToDisk();
    broadcastSSE('message', { message: messageObj, chat: chatsData.chats[cleanPhone] });

    res.json({ success: true, message: messageObj });
  } catch (err) {
    console.error('[WA-SEND] Error al enviar texto:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 6. Enviar Multimedia (Imágenes, Videos, Documentos)
app.post('/api/whatsapp/send-media', upload.single('file'), async (req, res) => {
  const { to, caption } = req.body;
  const file = req.file;

  if (!to || !file) {
    return res.status(400).json({ error: 'Parámetros requeridos: to, archivo multimedia' });
  }

  if (connectionStatus !== 'CONNECTED' || !sock) {
    return res.status(503).json({ error: 'WhatsApp no está conectado.' });
  }

  try {
    let cleanPhone = to.replace(/\D/g, '');
    if (!cleanPhone.includes('@')) {
      cleanPhone = `${cleanPhone}@s.whatsapp.net`;
    }

    const fileBuffer = fs.readFileSync(file.path);
    const mime = file.mimetype || '';
    let sendPayload = {};
    let messageType = 'document';

    if (mime.startsWith('image/')) {
      messageType = 'image';
      sendPayload = { image: fileBuffer, caption: caption || '' };
    } else if (mime.startsWith('video/')) {
      messageType = 'video';
      sendPayload = { video: fileBuffer, caption: caption || '' };
    } else if (mime.startsWith('audio/')) {
      messageType = 'audio';
      sendPayload = { audio: fileBuffer, mimetype: mime };
    } else {
      sendPayload = { document: fileBuffer, mimetype: mime, fileName: file.originalname };
    }

    const sent = await sock.sendMessage(cleanPhone, sendPayload);
    const timestamp = Date.now();
    const mediaUrl = `/api/whatsapp/media/${file.filename}`;

    const messageObj = {
      id: sent.key.id,
      jid: cleanPhone,
      fromMe: true,
      senderName: 'Tú (Coordinación)',
      type: messageType,
      body: caption || file.originalname,
      mediaUrl,
      fileName: file.originalname,
      timestamp,
      status: 'sent'
    };

    if (!chatsData.messages[cleanPhone]) chatsData.messages[cleanPhone] = [];
    chatsData.messages[cleanPhone].push(messageObj);

    chatsData.chats[cleanPhone] = {
      jid: cleanPhone,
      phone: cleanPhone.split('@')[0],
      name: chatsData.chats[cleanPhone]?.name || cleanPhone.split('@')[0],
      lastMessage: messageType === 'image' ? '📷 Foto enviada' : messageType === 'video' ? '🎥 Video enviado' : '📎 Documento',
      lastTimestamp: timestamp,
      unreadCount: 0
    };

    saveChatsToDisk();
    broadcastSSE('message', { message: messageObj, chat: chatsData.chats[cleanPhone] });

    res.json({ success: true, message: messageObj });
  } catch (err) {
    console.error('[WA-SEND-MEDIA] Error enviando archivo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 7. Cerrar Sesión y Desvincular
app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (e) {}

  try {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  } catch (e) {}

  connectionStatus = 'DISCONNECTED';
  connectedAccount = null;
  currentQR = null;
  broadcastSSE('status', { status: connectionStatus, user: null });

  setTimeout(startWhatsAppSocket, 1500);
  res.json({ success: true, message: 'Sesión cerrada exitosamente.' });
});

// Iniciar servidor HTTP y Baileys
app.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(`[OK] Microservicio WhatsApp PAU corriendo en http://localhost:${PORT}`);
  console.log(`==========================================================`);
  startWhatsAppSocket();
});
