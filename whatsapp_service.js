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
  jidDecode,
  jidNormalizedUser,
  isLidUser
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
let lidToPhoneMap = {};
let contactProfilePics = {};
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
      browser: ['UCV PAU Virtual', 'Chrome', '120.0.0']
    });

    // Guardado de credenciales
    sock.ev.on('creds.update', saveCreds);

    // Mapeo dinámico de número de teléfono y LID
    sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
      console.log(`[WA-MAP] phoneNumberShare recibido: ${lid} -> ${jid}`);
      if (lid && jid) {
        const cleanPhone = jid.split('@')[0];
        lidToPhoneMap[lid] = cleanPhone;
        if (chatsData.chats[lid]) {
          chatsData.chats[lid].phone = cleanPhone;
          saveChatsToDisk();
          broadcastSSE('chat_update', chatsData.chats[lid]);
        }
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) {
        if (c.lid && c.id) {
          const cleanPhone = c.id.split('@')[0];
          lidToPhoneMap[c.lid] = cleanPhone;
          if (chatsData.chats[c.lid]) {
            chatsData.chats[c.lid].phone = cleanPhone;
            if (c.notify || c.name) chatsData.chats[c.lid].pushName = c.notify || c.name;
          }
        }
        if (c.imgUrl) {
          contactProfilePics[c.id] = c.imgUrl;
          if (c.lid) contactProfilePics[c.lid] = c.imgUrl;
          if (chatsData.chats[c.id]) chatsData.chats[c.id].profilePic = c.imgUrl;
          if (c.lid && chatsData.chats[c.lid]) chatsData.chats[c.lid].profilePic = c.imgUrl;
        }
      }
      saveChatsToDisk();
    });

    sock.ev.on('contacts.update', (updates) => {
      for (const c of updates) {
        if (c.lid && c.id) {
          const cleanPhone = c.id.split('@')[0];
          lidToPhoneMap[c.lid] = cleanPhone;
          if (chatsData.chats[c.lid]) {
            chatsData.chats[c.lid].phone = cleanPhone;
            if (c.notify || c.name) chatsData.chats[c.lid].pushName = c.notify || c.name;
          }
        }
        if (c.imgUrl) {
          contactProfilePics[c.id] = c.imgUrl;
          if (c.lid) contactProfilePics[c.lid] = c.imgUrl;
          if (chatsData.chats[c.id]) chatsData.chats[c.id].profilePic = c.imgUrl;
          if (c.lid && chatsData.chats[c.lid]) chatsData.chats[c.lid].profilePic = c.imgUrl;
        }
      }
      saveChatsToDisk();
    });

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
        console.log(`[WA-ENGINE] Conexión cerrada. Código: ${statusCode}. Reintentar: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          connectionStatus = 'DISCONNECTED';
          connectedAccount = null;
          try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
          } catch (e) {}
          broadcastSSE('status', { status: connectionStatus, user: null });
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
        const pushName = msg.pushName || '';
        const timestamp = (msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now());

        const normJid = jidNormalizedUser(jid);
        let cleanPhone = normJid.split('@')[0];
        if (lidToPhoneMap[normJid]) {
          cleanPhone = lidToPhoneMap[normJid];
        }

        // Consultar o cachear foto de perfil
        let profilePic = chatsData.chats[normJid]?.profilePic || contactProfilePics[normJid] || null;
        if (!profilePic && sock) {
          sock.profilePictureUrl(normJid, 'preview').then(pic => {
            if (pic) {
              if (chatsData.chats[normJid]) chatsData.chats[normJid].profilePic = pic;
              contactProfilePics[normJid] = pic;
              saveChatsToDisk();
              broadcastSSE('chat_update', chatsData.chats[normJid]);
            }
          }).catch(() => {});
        }

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
          jid: normJid,
          fromMe: isFromMe,
          senderName: isFromMe ? 'Tú (Coordinación)' : (pushName || cleanPhone),
          type: messageType,
          body: bodyText,
          mediaUrl,
          fileName,
          timestamp,
          status: isFromMe ? 'sent' : 'received'
        };

        // Guardar en la estructura de chats
        if (!chatsData.messages[normJid]) chatsData.messages[normJid] = [];
        chatsData.messages[normJid].push(messageObj);

        // Actualizar datos del chat con teléfono claro y nombre de WhatsApp (pushName)
        const currentChat = chatsData.chats[normJid] || {};
        chatsData.chats[normJid] = {
          jid: normJid,
          phone: cleanPhone,
          pushName: pushName || currentChat.pushName || null,
          name: pushName || currentChat.name || cleanPhone,
          profilePic: profilePic || currentChat.profilePic || null,
          lastMessage: bodyText || (messageType === 'image' ? '📷 Foto' : messageType === 'video' ? '🎥 Video' : '📎 Archivo'),
          lastTimestamp: timestamp,
          unreadCount: isFromMe ? 0 : (currentChat.unreadCount || 0) + 1
        };

        saveChatsToDisk();
        broadcastSSE('message', { message: messageObj, chat: chatsData.chats[normJid] });
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
  const norm = jidNormalizedUser(jid);
  const msgs = chatsData.messages[norm] || chatsData.messages[jid] || [];

  if (chatsData.chats[norm]) {
    chatsData.chats[norm].unreadCount = 0;
    saveChatsToDisk();
  } else if (chatsData.chats[jid]) {
    chatsData.chats[jid].unreadCount = 0;
    saveChatsToDisk();
  }
  res.json(msgs);
});

// 5. Consultar foto de perfil en tiempo real de WhatsApp
app.get('/api/whatsapp/profile-pic/:jid', async (req, res) => {
  const jid = decodeURIComponent(req.params.jid);
  try {
    if (!sock || connectionStatus !== 'CONNECTED') {
      return res.json({ url: null });
    }
    const norm = jidNormalizedUser(jid);
    if (chatsData.chats[norm]?.profilePic) {
      return res.json({ url: chatsData.chats[norm].profilePic });
    }
    const pic = await sock.profilePictureUrl(norm, 'preview').catch(() => null);
    if (pic) {
      if (chatsData.chats[norm]) chatsData.chats[norm].profilePic = pic;
      contactProfilePics[norm] = pic;
      saveChatsToDisk();
      return res.json({ url: pic });
    }
    res.json({ url: null });
  } catch (err) {
    res.json({ url: null });
  }
});

// 6. Enviar mensaje de texto
app.post('/api/whatsapp/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Parámetros requeridos: to, message' });
  }

  if (connectionStatus !== 'CONNECTED' || !sock) {
    return res.status(503).json({ error: 'WhatsApp no está conectado. Escanea el código QR primero.' });
  }

  try {
    let targetJid = to.trim();
    if (targetJid.includes('@')) {
      targetJid = jidNormalizedUser(targetJid);
    } else {
      let digits = targetJid.replace(/\D/g, '');
      if (digits.length === 9 && digits.startsWith('9')) {
        digits = '51' + digits; // Prefijo Perú
      }
      targetJid = `${digits}@s.whatsapp.net`;
    }

    console.log(`[WA-SEND] Enviando mensaje a targetJid: ${targetJid}`);
    const sent = await sock.sendMessage(targetJid, { text: message.trim() });
    const timestamp = Date.now();

    const messageObj = {
      id: sent.key.id,
      jid: targetJid,
      fromMe: true,
      senderName: 'Tú (Coordinación)',
      type: 'text',
      body: message.trim(),
      mediaUrl: null,
      timestamp,
      status: 'sent'
    };

    if (!chatsData.messages[targetJid]) chatsData.messages[targetJid] = [];
    chatsData.messages[targetJid].push(messageObj);

    let phone = targetJid.split('@')[0];
    if (lidToPhoneMap[targetJid]) {
      phone = lidToPhoneMap[targetJid];
    }

    const currentChat = chatsData.chats[targetJid] || {};
    chatsData.chats[targetJid] = {
      jid: targetJid,
      phone: phone,
      pushName: currentChat.pushName || null,
      name: currentChat.pushName || currentChat.name || phone,
      profilePic: currentChat.profilePic || contactProfilePics[targetJid] || null,
      lastMessage: message.trim(),
      lastTimestamp: timestamp,
      unreadCount: 0
    };

    saveChatsToDisk();
    broadcastSSE('message', { message: messageObj, chat: chatsData.chats[targetJid] });

    res.json({ success: true, message: messageObj });
  } catch (err) {
    console.error('[WA-SEND] Error al enviar texto:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Enviar Multimedia (Imágenes, Videos, Documentos)
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
    let targetJid = to.trim();
    if (targetJid.includes('@')) {
      targetJid = jidNormalizedUser(targetJid);
    } else {
      let digits = targetJid.replace(/\D/g, '');
      if (digits.length === 9 && digits.startsWith('9')) {
        digits = '51' + digits;
      }
      targetJid = `${digits}@s.whatsapp.net`;
    }

    console.log(`[WA-MEDIA] Enviando archivo a targetJid: ${targetJid}`);
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

    const sent = await sock.sendMessage(targetJid, sendPayload);
    const timestamp = Date.now();
    const mediaUrl = `/api/whatsapp/media/${file.filename}`;

    const messageObj = {
      id: sent.key.id,
      jid: targetJid,
      fromMe: true,
      senderName: 'Tú (Coordinación)',
      type: messageType,
      body: caption || file.originalname,
      mediaUrl,
      fileName: file.originalname,
      timestamp,
      status: 'sent'
    };

    if (!chatsData.messages[targetJid]) chatsData.messages[targetJid] = [];
    chatsData.messages[targetJid].push(messageObj);

    let phone = targetJid.split('@')[0];
    if (lidToPhoneMap[targetJid]) {
      phone = lidToPhoneMap[targetJid];
    }

    const currentChat = chatsData.chats[targetJid] || {};
    chatsData.chats[targetJid] = {
      jid: targetJid,
      phone: phone,
      pushName: currentChat.pushName || null,
      name: currentChat.pushName || currentChat.name || phone,
      profilePic: currentChat.profilePic || contactProfilePics[targetJid] || null,
      lastMessage: caption || (messageType === 'image' ? '📷 Foto' : messageType === 'video' ? '🎥 Video' : '📎 Archivo'),
      lastTimestamp: timestamp,
      unreadCount: 0
    };

    saveChatsToDisk();
    broadcastSSE('message', { message: messageObj, chat: chatsData.chats[targetJid] });

    res.json({ success: true, message: messageObj });
  } catch (err) {
    console.error('[WA-MEDIA] Error al enviar archivo:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Desvincular Sesión (Cerrar sesión)
app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
    }
    connectionStatus = 'DISCONNECTED';
    connectedAccount = null;
    currentQR = null;
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    broadcastSSE('status', { status: connectionStatus, user: null });
    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
    setTimeout(startWhatsAppSocket, 1500);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iniciar Servidor Express y Conexión WhatsApp
app.listen(PORT, () => {
  console.log('==========================================================');
  console.log(`[OK] Microservicio WhatsApp PAU corriendo en http://localhost:${PORT}`);
  console.log('==========================================================');
  startWhatsAppSocket();
});
