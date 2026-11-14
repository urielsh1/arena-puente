// SERVIDOR PUENTE - ARENA LIVE - @perro1insano
// Este es el servidor que lee tu Live de TikTok y le manda los regalos al juego.
// Se necesita internet todo el momento en el servidor y en el juego.

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const TIKTOK_USER = 'perro1insano'; // tu @ sin @
let tiktok = null;
let conectadoTikTok = false;

// Para que Render sepa que está vivo
app.get('/', (req, res) => {
  res.send('Arena Live Puente - Conectado a @' + TIKTOK_USER + ' - TikTok conectado: ' + conectadoTikTok);
});
app.get('/estado', (req, res) => {
  res.json({ usuario: TIKTOK_USER, tiktok_conectado: conectadoTikTok, clientes: wss.clients.size });
});

// Mandar a todos los juegos conectados
function mandarATodos(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(msg);
  });
  console.log('-> juego:', msg);
}

// Mapa de regalos de TikTok a regalos del juego
function mapearRegalo(nombreTikTok) {
  const n = (nombreTikTok || '').toLowerCase();
  if (n.includes('rose')) return 'rosa';
  if (n.includes('quiereme') || n.includes('love') || n.includes('heart') || n.includes('finger')) return 'quiereme';
  if (n.includes('capybara') || n.includes('capibara')) return 'capibara';
  if (n.includes('donut') || n.includes('doughnut')) return 'donut';
  if (n.includes('galaxy') || n.includes('galaxia')) return 'galaxia';
  return null;
}

async function conectarTikTok() {
  if (tiktok) { try { await tiktok.disconnect(); } catch(e) {} }
  tiktok = new WebcastPushConnection(TIKTOK_USER);
  tiktok.connect().then(() => {
    conectadoTikTok = true;
    console.log('Conectado a TikTok Live @' + TIKTOK_USER);
    mandarATodos({ sistema: 'Conectado a @' + TIKTOK_USER });
  }).catch(err => {
    conectadoTikTok = false;
    console.log('No se pudo conectar a TikTok, reintentando en 10s. ¿Estás en vivo?', err.message);
    setTimeout(conectarTikTok, 10000);
  });

  // CHAT: "Juan: hola"
  tiktok.on('chat', data => {
    const texto = data.user?.nickname + ': ' + data.comment;
    mandarATodos({ comentario: texto });
  });

  // REGALOS: "Juan envió rosa x5"
  tiktok.on('gift', data => {
    // TikTok manda los regalos repetidos, solo tomamos cuando ya terminó el combo
    if (data.repeat_end) {
      const tipo = mapearRegalo(data.giftName);
      if (!tipo) {
        console.log('Regalo no mapeado:', data.giftName);
        return;
      }
      const usuario = '@' + (data.user?.uniqueId || data.user?.nickname || 'donador');
      const cantidad = data.repeat_count || data.count || 1;
      console.log('REGALO:', usuario, tipo, 'x' + cantidad);
      // Formato que el juego ya entiende
      mandarATodos({ comentario: usuario + ' envió ' + tipo + ' x' + cantidad });
      mandarATodos({ tipo: tipo, usuario: usuario, cantidad: cantidad });
    }
  });

  tiktok.on('disconnected', () => {
    conectadoTikTok = false;
    console.log('Desconectado de TikTok, reintentando en 10s');
    setTimeout(conectarTikTok, 10000);
  });
}

wss.on('connection', (ws) => {
  console.log('Juego conectado al puente');
  ws.send(JSON.stringify({ sistema: 'Conectado al puente @' + TIKTOK_USER }));
  ws.on('message', (msg) => {
    try {
      const d = JSON.parse(msg.toString());
      if (d.accion === 'conectar') console.log('Juego pide conectar a', d.usuario);
    } catch(e) {}
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Puente prendido en puerto ' + PORT);
  conectarTikTok();
});
