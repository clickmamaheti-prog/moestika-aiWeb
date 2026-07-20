const express = require('express');
const app = express();
const server = require('http').createServer(app);
const path = require('path');

const PORT = 5090;
const API_URL = 'https://opencode.ai/zen/v1';
const API_KEY = 'sk-wpGZgaE2Ojt9aSmbNfyHjJCTbgkwNYCLVyaoXRSw2XQwKiJz6JM5U07DI6Wj7evt'; // WARNING: Jangan push ke GitHub!

// ─── SECURITY ───
const rateLimit = {};
const RATE_MAX = 30; // requests per window
const RATE_WIN = 60000; // 1 minute
const MAX_MSG_LEN = 4000;
const MAX_HISTORY = 50;

app.set('trust proxy', 1);
app.use(express.json({limit:'5mb'}));

// Rate limiter
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    if (!rateLimit[ip]) rateLimit[ip] = [];
    rateLimit[ip] = rateLimit[ip].filter(t => t > now - RATE_WIN);
    if (rateLimit[ip].length >= RATE_MAX) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    rateLimit[ip].push(now);
    next();
});

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

// ─── STATIC ───
app.use(express.static(path.join(__dirname, 'public')));
// SPA fallback - catch all routes for React router
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/generate-image') || req.path.startsWith('/assets/') || req.path.startsWith('/favicon') || req.path.startsWith('/robots.txt') || req.path === '/models' || req.path === '/chat') return next();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Generate image endpoint — proxy with 60s timeout
app.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 500) {
        return res.status(400).json({ error: 'Invalid prompt' });
    }
    try {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&t=${Date.now()}`;
        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60000) });
        if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
        const buffer = await imgRes.arrayBuffer();
        res.json({ data: Buffer.from(buffer).toString('base64'), type: 'image/jpeg' });
    } catch (err) {
        console.error('Image error:', err.message);
        res.json({ error: 'Gagal generate gambar' });
    }
});
app.get('/models', async (req, res) => {
    try {
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` };
        const apiRes = await fetch(`${API_URL}/models`, { headers, signal: AbortSignal.timeout(10000) });
        const data = await apiRes.json();
        // Only show free models
        const allModels = data.data || [];
        const freeModels = allModels.filter(m => m.id.includes('free'));
        res.json({ models: freeModels.length > 0 ? freeModels : allModels });
    } catch (err) {
        console.error('Models error:', err.message);
        res.json({ error: err.message, models: [] });
    }
});

// React app API routes (with /api prefix)
app.get('/api/models', async (req, res) => {
    try {
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` };
        const apiRes = await fetch(`${API_URL}/models`, { headers, signal: AbortSignal.timeout(10000) });
        const data = await apiRes.json();
        const allModels = data.data || [];
        const freeModels = allModels.filter(m => m.id.includes('free'));
        const selected = freeModels.length > 0 ? freeModels : allModels;
        const named = selected.map(m => ({
            ...m,
            name: m.name || m.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace('Free', '(Free)')
        }));
        res.json({ models: named });
    } catch (err) {
        res.json({ error: err.message, models: [] });
    }
});

app.post('/api/chat', async (req, res) => {
    const { messages, model, modelId } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages required' });
    }
    // Validate message content
    for (const msg of messages) {
        if (typeof msg.content !== 'string' || msg.content.length > MAX_MSG_LEN) {
            return res.status(400).json({ error: 'Invalid message' });
        }
    }
    // Limit history length
    if (messages.length > MAX_HISTORY) {
        return res.status(400).json({ error: 'Too many messages' });
    }

    const selectedModel = model || modelId || 'nemotron-3-ultra-free';

    // Inject Moestika AI identity as system prompt
    const systemMsg = {
        role: 'system',
        content: 'Kamu adalah Moestika AI, asisten AI modern. Diciptakan oleh Devpelover REZA ROSDIANSYAH. Tugasmu: coding, menulis, analisis, produktivitas. Jawab ramah, informatif, profesional, bahasa Indonesia. Hanya sebut identitas lengkap jika ditanya "siapa kamu" atau "siapa pembuatmu". Jangan sebut identitas di setiap jawaban.'
    };
    const enhancedMessages = [systemMsg, ...messages];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` };

        const apiRes = await fetch(`${API_URL}/chat/completions`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: selectedModel,
                messages: enhancedMessages,
                stream: true,
                max_tokens: 4096,
            })
        });

        if (!apiRes.ok) {
            const err = await apiRes.text();
            res.write(`data: ${JSON.stringify({ error: `API Error: ${err}` })}\n\n`);
            res.end();
            return;
        }

        const reader = apiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            res.write(`data: ${JSON.stringify({ delta: content })}\n\n`);
                        }
                    } catch (e) {}
                }
            }
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

    } catch (err) {
        console.error('API error:', err.message);
        res.write(`data: ${JSON.stringify({ error: 'Mohon maaf, terjadi kesalahan. Coba lagi nanti.' })}\n\n`);
        res.end();
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Moestika AI Chat running on http://0.0.0.0:${PORT}`);
});
