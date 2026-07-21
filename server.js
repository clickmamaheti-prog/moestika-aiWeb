const express = require('express');
const app = express();
const server = require('http').createServer(app);
const path = require('path');

// Load env khusus web (terpisah dari Hermes)
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch {}

const PORT = process.env.PORT || 5090;
const BASE_URL = process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1';
const API_URL = BASE_URL + '/chat/completions';
const API_MODELS = BASE_URL + '/models';

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/models', async (req, res) => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.OPENCODE_API_KEY) headers['Authorization'] = 'Bearer ' + process.env.OPENCODE_API_KEY;
    const resp = await fetch(API_MODELS, { headers });
    const data = await resp.json();
    const models = (data.data || []).filter(m => m.id.includes('free') && !m.id.includes('laguna')).slice(0, 10);
    res.json({ models: models.map(m => ({ id: m.id, name: m.id, free: true })) });
  } catch {
    res.json({ models: [{ id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', free: true }] });
  }
});

// POST /api/chat — streaming via OpenCode Zen
app.post('/api/chat', async (req, res) => {
  const { messages: rawMessages, modelId, temperature, topP } = req.body;
  // Fallback dari model dummy frontend ke model real
  const validModels = ['deepseek-v4-flash-free','mimo-v2.5-free','nemotron-3-ultra-free','north-mini-code-free','laguna-s-2.1-free'];
  const requested = (modelId || req.body.model || '').toLowerCase();
  const model = validModels.includes(requested) ? requested : 'nemotron-3-ultra-free';
  if (!rawMessages || !Array.isArray(rawMessages) || rawMessages.length === 0) {
    return res.status(400).json({ error: 'Payload tidak valid' });
  }
  
  // Inject identitas Moestika AI
  const systemMsg = { role: 'system', content: 'Kamu adalah Moestika AI, asisten AI premium yang elegan, cerdas, dan ramah. Diciptakan oleh DevCult XII. Jawab dengan hangat dan profesional dalam bahasa Indonesia. Gunakan gaya bicara yang natural dan membantu.' };
  const messages = rawMessages.some(m => m.role === 'system') ? rawMessages : [systemMsg, ...rawMessages];
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.OPENCODE_API_KEY) headers['Authorization'] = 'Bearer ' + process.env.OPENCODE_API_KEY;
    const apiRes = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature || 0.7,
        stream: true,
        max_tokens: 4096,
      })
    });
    if (!apiRes.ok) {
      const err = await apiRes.text();
      res.write(`data: ${JSON.stringify({ error: err })}\n\n`);
      res.end(); return;
    }
    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      for (const line of buf.split('\n')) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const d = JSON.parse(line.slice(6));
            const c = d.choices?.[0]?.delta?.content || '';
            if (c) res.write(`data: ${JSON.stringify({ delta: c })}\n\n`);
          } catch {}
        }
      }
      buf = '';
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// GET /api/clear — hapus semua data chat (localStorage)
app.get('/api/clear', (req, res) => {
  res.send(`<!DOCTYPE html><html><body><script>
    if(confirm('Hapus semua obrolan?')){
      localStorage.removeItem('chat-storage');
      location.href='/';
    } else { history.back(); }
  </script></body></html>`);
});

// ─── Fallback to index.html (SPA) ───
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Moestika AI (React) running on http://0.0.0.0:${PORT}`);
});
