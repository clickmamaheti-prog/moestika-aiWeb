const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const pty = require('node-pty');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// ─── SECURITY ───
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 menit
const RATE_LIMIT = 30; // max request per window
const RATE_WINDOW = 60000; // 1 menit
const CONNECTIONS_PER_IP = 3; // max 3 koneksi per IP

const rateMap = new Map();
const connMap = new Map();
const sessions = new Map();
let connId = 0;

// Reject semua method kecuali GET
app.use((req, res, next) => {
  if (req.method !== 'GET') return res.status(405).end();
  next();
});

app.use(express.static('public'));
app.get('/health', (req, res) => res.send('OK'));

// Rate limiting per IP
function rateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || [];
  const recent = entry.filter(t => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  rateMap.set(ip, recent);
  return false;
}

// Bersihin rate map tiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of rateMap) {
    rateMap.set(ip, times.filter(t => now - t < RATE_WINDOW));
  }
}, 300000);

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || 'unknown';
  const id = ++connId;

  // Rate limit
  if (rateLimit(ip)) {
    ws.close(1008, 'Rate limited');
    return;
  }

  // Max connections per IP
  const ipConns = connMap.get(ip) || 0;
  if (ipConns >= CONNECTIONS_PER_IP) {
    ws.close(1008, 'Max connections reached');
    return;
  }
  connMap.set(ip, ipConns + 1);

  // Session timeout 30 menit
  const sessionTimer = setTimeout(() => {
    ws.close(1008, 'Session expired (30 menit)');
  }, SESSION_TIMEOUT);

  sessions.set(id, { ip, start: Date.now() });

  const term = pty.spawn('/bin/bash', [], {
    name: 'xterm-256color', cols: 80, rows: 24,
    cwd: '/root',
    env: { TERM: 'xterm-256color', HOME: '/root', USER: 'guest' }
  });

  ws.on('message', (data) => {
    try {
      const cmd = JSON.parse(data);
      if (cmd.resize) term.resize(cmd.resize[0], cmd.resize[1]);
    } catch {
      // Block perintah berbahaya
      const msg = data.toString();
      const blocked = ['passwd', 'chpasswd', 'usermod', 'sudo', 'su ', 'chmod 777', 'rm -rf', 'mkfs', 'dd if='];
      if (blocked.some(b => msg.includes(b))) {
        term.write(`\r\n\x1b[31m⛔ Perintah diblokir untuk keamanan\x1b[0m\r\n$ `);
        return;
      }
      term.write(msg);
    }
  });

  term.onData((data) => {
    try { ws.send(data); } catch {}
  });

  ws.on('close', () => {
    clearTimeout(sessionTimer);
    term.kill();
    sessions.delete(id);
    const curr = connMap.get(ip) || 1;
    connMap.set(ip, Math.max(0, curr - 1));
    // Log session
    const session = sessions.get(id);
    if (session) {
      const dur = Math.round((Date.now() - session.start) / 1000);
      console.log(`🔚 Session ${id} dari ${ip} — ${dur}s`);
    }
  });

  console.log(`🟢 Session ${id} dari ${ip}`);
});

server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Terminal on :${PORT}`));
