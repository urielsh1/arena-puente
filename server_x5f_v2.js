// SERVIDOR PUENTE V2 - ARENA LIVE - @perro1insano
// Versión que NO se cae si no estás en vivo. Solo espera.

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const TIKTOK_USER = 'perro1insano';
let tiktokConectado = false;
let TikTokLib = null;
try { TikTokLib = require('tiktok-live-connector'); } catch(e) { console.log('TikTok lib no cargada, modo espera:', e.message); }

app.get('/', (req, res) => {
  res.send('Arena Live Puente OK - @' + TIKTOK_USER + ' - TikTok: ' + (tiktokConectado ? 'conectado' : 'en espera, prende tu Live'));
});
app.get('/estado', (req, res) => {
  res.json({ usuario: TIKTOK_USER, tiktok_conectado: tiktokConectado, clientes: wss.clients.size });
});

function mandarATodos(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { try { if (c.readyState === 1) c.send(msg); } catch(e) {} });
  console.log('-> juego:', msg);
}

function mapearRegalo(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('rose')) return 'rosa';
  if (n.includes('capybara') || n.includes('capibara')) return 'capibara';
  if (n.includes('donut') || n.includes('doughnut')) return 'donut';
  if (n.includes('galaxy') || n.includes('galaxia')) return 'galaxia';
  if (n.includes('love') || n.includes('heart') || n.includes('finger') || n.includes('quiereme')) return 'quiereme';
  return null;
}

async function conectarTikTok() {
  if (!TikTokLib) { console.log('Sin libreria TikTok, reintentando en 30s'); setTimeout(conectarTikTok, 30000); return; }
  try {
    const tiktok = new TikTokLib.WebcastPushConnection(TIKTOK_USER);
    // Si no estás en vivo, esto falla pero NO tumba el servidor, solo reintenta
    await tiktok.connect();
    tiktokConectado = true;
    console.log('Conectado a TikTok Live @' + TIKTOK_USER);
    mandarATodos({ sistema: 'Conectado a @' + TIKTOK_USER });

    tiktok.on('chat', data => {
      try { mandarATodos({ comentario: (data.user?.nickname || 'alguien') + ': ' + data.comment }); } catch(e) {}
    });
    tiktok.on('gift', data => {
      try {
        if (!data.repeat_end) return;
        const tipo = mapearRegalo(data.giftName);
        if (!tipo) return;
        const usuario = '@' + (data.user?.uniqueId || data.user?.nickname || 'donador');
        const cantidad = data.repeat_count || data.count || 1;
        console.log('REGALO:', usuario, tipo, 'x' + cantidad);
        mandarATodos({ comentario: usuario + ' envió ' + tipo + ' x' + cantidad });
        mandarATodos({ tipo, usuario, cantidad });
      } catch(e) { console.log('Error gift', e.message); }
    });
    tiktok.on('disconnected', () => {
      tiktokConectado = false;
      console.log('Desconectado de TikTok, reintentando en 15s');
      setTimeout(conectarTikTok, 15000);
    });
  } catch (err) {
    tiktokConectado = false;
    console.log('TikTok no disponible (¿estás en vivo?) - reintentando en 15s:', err.message);
    setTimeout(conectarTikTok, 15000);
  }
}

wss.on('connection', (ws) => {
  console.log('Juego conectado al puente');
  try { ws.send(JSON.stringify({ sistema: 'Conectado al puente @' + TIKTOK_USER })); } catch(e) {}
});

process.on('uncaughtException', (e) => { console.log('Error no fatal, sigo vivo:', e.message); });
process.on('unhandledRejection', (e) => { console.log('Rechazo no fatal, sigo vivo:', e && e.message); });

const PORT = process.env.PORT || 3000;
server.on('error', (e) => { console.log('Error de servidor, sigo intentando:', e.message); });
server.listen(PORT, () => {
  console.log('Puente prendido en puerto ' + PORT);
  conectarTikTok();
});
