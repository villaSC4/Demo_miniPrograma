/**
 * ==============================================================================
 * WHATSAPP_SERVICE.JS - Microservicio Real de WhatsApp Web para Módulo PAU
 * Basado en @whiskeysockets/baileys (Multi-Device WebSockets)
 * ==============================================================================
 */

// Blindaje global contra excepciones y promesas no manejadas (Node.js v24+)
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[WA-PROCESS] Promesa no manejada capturada (evitando caída de Node):', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[WA-PROCESS] Excepción no capturada capturada (evitando caída de Node):', err?.message || err);
});

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
  isLidUser,
  Browsers
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

// Control de concurrencia y temporizadores únicos para el Socket
let isStartingSocket = false;
let reconnectTimer = null;
let qrWaiters = [];

// Helper para detectar si un JID o número corresponde al propio número conectado
function isSelfUser(jidOrPhone) {
  if (!jidOrPhone) return false;
  const myPhone = connectedAccount?.phone ? String(connectedAccount.phone).replace(/\D/g, '') : (sock?.user?.id ? (sock.user.id.split(':')[0] || sock.user.id.split('@')[0]).replace(/\D/g, '') : null);
  const myJidNorm = sock?.user?.id ? jidNormalizedUser(sock.user.id) : null;
  const raw = String(jidOrPhone).trim();
  const digits = raw.replace(/\D/g, '');

  if (myJidNorm && jidNormalizedUser(raw) === myJidNorm) return true;
  if (myPhone && digits) {
    if (digits === myPhone || digits.endsWith(myPhone) || myPhone.endsWith(digits)) return true;
  }
  return false;
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function cleanupPreviousSocket() {
  if (sock) {
    try {
      console.log('[WA-CLEANUP] Desmontando listeners y cerrando socket previo...');
      sock.ev.removeAllListeners();
      sock.end(undefined);
    } catch (e) {
      console.warn('[WA-CLEANUP] Aviso al limpiar socket previo:', e.message);
    }
    sock = null;
  }
}

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
async function startWhatsAppSocket(forceClean = false) {
  clearReconnectTimer();

  if (isStartingSocket) {
    console.log('[WA-ENGINE] Inicio de socket ya en progreso. Omitiendo llamada duplicada.');
    return;
  }

  isStartingSocket = true;

  try {
    cleanupPreviousSocket();

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
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false, // CLAVE: No descargar meses de chats antiguos que saturan sockets y causan Bad MAC
      markOnlineOnConnect: true, // Mantener online para que WhatsApp mantenga el túnel WebSocket vivo
      keepAliveIntervalMs: 25000, // Ping periódico cada 25 segundos para evitar desconexiones por inactividad
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 2000,
      maxMsgRetryCount: 3,
      getMessage: async (key) => {
        const chatMsgs = chatsData.messages[key.remoteJid] || [];
        const found = chatMsgs.find(m => m.id === key.id);
        if (found) {
          return { conversation: found.body || '' };
        }
        return undefined;
      }
    });

    isStartingSocket = false;

    // Guardado de credenciales
    sock.ev.on('creds.update', saveCreds);

    // Mapeo dinámico de número de teléfono y LID
    sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
      console.log(`[WA-MAP] phoneNumberShare recibido: ${lid} -> ${jid}`);
      if (lid && jid) {
        const cleanPhone = jid.split('@')[0];
        if (isSelfUser(cleanPhone) || isSelfUser(lid) || isSelfUser(jid)) return;
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
        if (isSelfUser(c.id) || isSelfUser(c.lid)) continue;
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
        if (isSelfUser(c.id) || isSelfUser(c.lid)) continue;
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

        // Notificar de inmediato a los clientes que solicitaron refresco rápido
        if (qrWaiters.length > 0) {
          const waiters = [...qrWaiters];
          qrWaiters = [];
          waiters.forEach(fn => {
            try { fn(currentQR); } catch (e) {}
          });
        }
      }

      if (connection === 'close') {
        currentQR = null;
        clearReconnectTimer();
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`[WA-ENGINE] Conexión cerrada. Código HTTP: ${statusCode}. Detalle: ${lastDisconnect?.error?.message || 'Cierre normal'}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[WA-ENGINE] Sesión cerrada desde el celular o desvinculada (401). Limpiando...');
          connectionStatus = 'DISCONNECTED';
          connectedAccount = null;
          try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
          } catch (e) {}
          broadcastSSE('status', { status: connectionStatus, user: null });
          reconnectTimer = setTimeout(() => startWhatsAppSocket(true), 2500);

        } else if (statusCode === DisconnectReason.connectionReplaced || statusCode === 440) {
          console.warn('[WA-ENGINE] Conexión reemplazada por otra sesión o navegador (Código 440). Se suspende reconexión automática para evitar bucle.');
          connectionStatus = 'DISCONNECTED';
          broadcastSSE('status', { status: connectionStatus, user: connectedAccount });

        } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
          console.log('[WA-ENGINE] WhatsApp solicita reinicio técnico (Código 515). Completando enlace con celular en 500ms...');
          reconnectTimer = setTimeout(() => startWhatsAppSocket(), 500);

        } else if (statusCode === DisconnectReason.badSession || statusCode === 500) {
          console.warn('[WA-ENGINE] Sesión inválida/dañada (Código 500). Purgando y solicitando nuevo QR...');
          connectionStatus = 'DISCONNECTED';
          try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
          } catch (e) {}
          broadcastSSE('status', { status: connectionStatus, user: null });
          reconnectTimer = setTimeout(() => startWhatsAppSocket(true), 2500);

        } else if (statusCode === 408 || lastDisconnect?.error?.message?.includes('QR refs attempts ended')) {
          console.log('[WA-ENGINE] Ciclo de código QR pausado por inactividad (408). Se generará un nuevo QR de inmediato cuando pulse "Actualizar QR".');
          connectionStatus = 'DISCONNECTED';
          currentQR = null;
          broadcastSSE('status', { status: connectionStatus });

        } else {
          console.log(`[WA-ENGINE] Desconexión de red/socket (Código ${statusCode}). Reintentando en 5 segundos...`);
          connectionStatus = 'DISCONNECTED';
          broadcastSSE('status', { status: connectionStatus });
          reconnectTimer = setTimeout(() => startWhatsAppSocket(), 5000);
        }

      } else if (connection === 'open') {
        currentQR = null;
        connectionStatus = 'CONNECTED';
        clearReconnectTimer();

        const userJid = sock.user.id;
        const phone = userJid.split(':')[0] || userJid.split('@')[0];
        connectedAccount = {
          jid: userJid,
          phone: phone,
          name: sock.user.name || 'Coordinación FIA UCV'
        };
        console.log(`[WA-ENGINE] ¡Conexión ESTABLE y PERMANENTE a WhatsApp establecida! Número vinculado: +${phone}`);
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
        if (!jid) continue;
        // Filtrar estrictamente canales de noticias, transmisiones de estado y grupos de WhatsApp ajenos a PAU
        if (jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter') || jid.includes('newsletter') || jid.endsWith('@g.us')) {
          continue;
        }

        const isFromMe = !!key.fromMe;
        const pushName = msg.pushName || '';
        const timestamp = (msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now());

        const normJid = jidNormalizedUser(jid);
        let cleanPhone = normJid.split('@')[0];
        if (lidToPhoneMap[normJid]) {
          cleanPhone = lidToPhoneMap[normJid];
        }

        // NUNCA registrar el propio número como chat (chat con uno mismo / message yourself / notas personales)
        if (isSelfUser(normJid) || isSelfUser(cleanPhone) || isSelfUser(jid)) {
          console.log(`[WA-FILTER] Omitiendo mensaje propio / chat con uno mismo (${cleanPhone})`);
          continue;
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

        let m = msg.message;
        // Desenvolver mensajes efímeros, temporales o de vista única que contienen emojis o multimedia
        if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
        if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
        if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
        if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;
        if (m.editedMessage?.message?.protocolMessage?.editedMessage) {
          m = m.editedMessage.message.protocolMessage.editedMessage;
        }

        // Manejo de Reacciones de WhatsApp con Emojis (👍, ❤️, 😂, 🙏, etc.)
        if (m.reactionMessage) {
          const targetMsgId = m.reactionMessage.key?.id;
          const emojiText = m.reactionMessage.text || '';
          console.log(`[WA-REACTION] Reacción con emoji recibida: "${emojiText}" para mensaje ${targetMsgId}`);
          
          if (chatsData.messages[normJid]) {
            const foundMsg = chatsData.messages[normJid].find(x => x.id === targetMsgId);
            if (foundMsg) {
              foundMsg.reaction = emojiText;
              saveChatsToDisk();
              broadcastSSE('reaction', {
                jid: normJid,
                messageId: targetMsgId,
                reaction: emojiText,
                fromMe: isFromMe
              });
            }
          }
          continue; // Las reacciones actualizan el mensaje existente, no crean un globo nuevo
        }

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
        } else if (m.stickerMessage) {
          messageType = 'sticker';
          bodyText = '🎭 Sticker';
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const fName = `in_stk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.webp`;
            fs.writeFileSync(path.join(MEDIA_DIR, fName), buffer);
            mediaUrl = `/api/whatsapp/media/${fName}`;
          } catch (e) {
            console.warn('[WA-MEDIA] Error descargando sticker:', e.message);
          }
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
          reaction: null,
          timestamp,
          status: isFromMe ? 'sent' : 'received'
        };

        // DEDUPLICACIÓN: Evitar guardar o retransmitir mensajes duplicados por ID
        if (!chatsData.messages[normJid]) chatsData.messages[normJid] = [];
        const msgExists = chatsData.messages[normJid].some(m => m.id === key.id);
        if (msgExists) {
          continue;
        }

        chatsData.messages[normJid].push(messageObj);

        // Actualizar datos del chat con teléfono claro y nombre de WhatsApp (pushName)
        const currentChat = chatsData.chats[normJid] || {};
        
        // CRÍTICO: Si el mensaje proviene de MÍ (isFromMe), NUNCA sobrescribir el nombre del contacto con el pushName del remitente (ej. 'Aaron_PV')
        let chatPushName = currentChat.pushName || null;
        let chatName = currentChat.name || null;

        if (!isFromMe && pushName) {
          // Solo cuando el mensaje es recibido desde el contacto externo, actualizamos su nombre
          chatPushName = pushName.trim();
          chatName = pushName.trim();
        } else if (!chatName) {
          chatName = chatPushName || cleanPhone;
        }

        chatsData.chats[normJid] = {
          jid: normJid,
          phone: cleanPhone,
          pushName: chatPushName,
          name: chatName,
          profilePic: profilePic || currentChat.profilePic || null,
          lastMessage: bodyText || (messageType === 'image' ? '📷 Foto' : messageType === 'video' ? '🎥 Video' : '📎 Archivo'),
          lastTimestamp: timestamp,
          unreadCount: isFromMe ? (currentChat.unreadCount || 0) : (currentChat.unreadCount || 0) + 1
        };

        saveChatsToDisk();
        broadcastSSE('message', { message: messageObj, chat: chatsData.chats[normJid] });
      }
    });

  } catch (error) {
    isStartingSocket = false;
    console.error('[WA-ENGINE] Error crítico en inicio de socket:', error);
    connectionStatus = 'DISCONNECTED';
    broadcastSSE('status', { status: connectionStatus, error: error.message });
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => startWhatsAppSocket(), 5000);
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
    'Content-Type': 'text/event-stream; charset=utf-8',
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

// 3. Obtener lista de chats (filtrando estrictamente canales de noticias, difusiones, grupos y el propio número)
app.get('/api/whatsapp/chats', (req, res) => {
  // Purgar de memoria y de disco cualquier residuo del propio número o de canales/grupos
  let purged = false;
  for (const k of Object.keys(chatsData.chats)) {
    const c = chatsData.chats[k];
    if (!c || isSelfUser(c.jid) || isSelfUser(c.phone) || isSelfUser(k) || c.jid.endsWith('@newsletter') || c.jid.endsWith('@broadcast') || c.jid.endsWith('@g.us')) {
      delete chatsData.chats[k];
      delete chatsData.messages[k];
      purged = true;
    }
  }
  if (purged) saveChatsToDisk();

  const list = Object.values(chatsData.chats)
    .filter(c => c && c.jid && !c.jid.endsWith('@newsletter') && !c.jid.endsWith('@broadcast') && !c.jid.endsWith('@g.us') && !isSelfUser(c.jid) && !isSelfUser(c.phone))
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
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

    if (isSelfUser(targetJid)) {
      return res.status(400).json({ error: 'No está permitido enviarse mensajes a sí mismo en la bandeja de atención PAU.' });
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
    if (!chatsData.messages[targetJid].some(m => m.id === messageObj.id)) {
      chatsData.messages[targetJid].push(messageObj);
    }

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
    if (!chatsData.messages[targetJid].some(m => m.id === messageObj.id)) {
      chatsData.messages[targetJid].push(messageObj);
    }

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

// 8. Desvincular Sesión (Cerrar sesión, limpiar credenciales y purgar data no relacionada)
app.all('/api/whatsapp/logout', async (req, res) => {
  try {
    console.log('[WA-ENGINE] Petición de desvinculación recibida. Cerrando sesión actual y limpiando datos...');
    clearReconnectTimer();
    cleanupPreviousSocket();

    connectionStatus = 'DISCONNECTED';
    connectedAccount = null;
    currentQR = null;

    // Eliminar credenciales físicas de sesión para forzar nuevo escaneo limpio
    try {
      if (fs.existsSync(SESSION_DIR)) {
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        fs.mkdirSync(SESSION_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('[WA-ENGINE] Advertencia limpiando SESSION_DIR:', e.message);
    }

    // Purgar chats previos del número anterior para no mezclar datos ajenos
    chatsData = { chats: {}, messages: {} };
    saveChatsToDisk();

    // Purgar archivos temporales en whatsapp_media
    try {
      const files = fs.readdirSync(MEDIA_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(MEDIA_DIR, file));
      }
    } catch (e) {}

    broadcastSSE('status', { status: connectionStatus, user: null });
    broadcastSSE('chats_cleared', {});

    res.json({ success: true, message: 'Sesión desvinculada exitosamente y datos purgados. Generando nuevo código QR...' });

    // Reiniciar socket de inmediato para que genere un nuevo código QR
    reconnectTimer = setTimeout(() => {
      console.log('[WA-ENGINE] Reiniciando cliente WhatsApp para nuevo escaneo...');
      startWhatsAppSocket(true);
    }, 600);
  } catch (err) {
    console.error('[WA-ENGINE] Error desvinculando sesión:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9. Actualización Rápida e Instantánea de Código QR (Bajo Demanda)
app.all('/api/whatsapp/refresh-qr', async (req, res) => {
  console.log('[WA-ENGINE] Petición de refresco forzado e instantáneo de código QR recibida.');
  try {
    currentQR = null;
    clearReconnectTimer();
    cleanupPreviousSocket();

    // Limpiar archivos temporales de sesión no autenticada para emisión inmediata de nuevo QR
    if (connectionStatus !== 'CONNECTED') {
      try {
        if (fs.existsSync(SESSION_DIR)) {
          fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
      } catch (e) {}
    }

    connectionStatus = 'CONNECTING';
    broadcastSSE('status', { status: connectionStatus });

    // Registrar promesa para resolver la respuesta HTTP exactamente cuando Baileys genere el QR
    let waiterFn = null;
    const qrPromise = new Promise((resolve) => {
      waiterFn = (qrDataUrl) => resolve(qrDataUrl);
      qrWaiters.push(waiterFn);
      setTimeout(() => {
        qrWaiters = qrWaiters.filter(w => w !== waiterFn);
        resolve(null);
      }, 7000);
    });

    // Iniciar socket Baileys sin demoras
    startWhatsAppSocket(true);

    const generatedQr = await qrPromise;
    if (generatedQr) {
      return res.json({ success: true, qr: generatedQr, status: 'QR_READY' });
    } else if (currentQR) {
      return res.json({ success: true, qr: currentQR, status: 'QR_READY' });
    } else {
      return res.json({ success: false, status: connectionStatus, message: 'Generando nuevo código QR, aguarde un instante...' });
    }
  } catch (err) {
    console.error('[WA-ENGINE] Error al refrescar código QR:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. Purgar datos de prueba y chats no relacionados bajo demanda
app.post('/api/whatsapp/clear-chats', (req, res) => {
  try {
    chatsData = { chats: {}, messages: {} };
    saveChatsToDisk();
    try {
      const files = fs.readdirSync(MEDIA_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(MEDIA_DIR, file));
      }
    } catch (e) {}
    broadcastSSE('chats_cleared', {});
    res.json({ success: true, message: 'Datos y chats purgados correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Reconexión manual controlada (para forzar reconexión si se pausó tras 440)
app.post('/api/whatsapp/reconnect', async (req, res) => {
  try {
    console.log('[WA-ENGINE] Solicitud de reconexión manual recibida.');
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      startWhatsAppSocket();
    }, 400);
    res.json({ success: true, message: 'Iniciando reconexión...' });
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
