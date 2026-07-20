# Moestika AI — Chat

Crafting Premium AI Experiences

**Moestika AI Chat** adalah aplikasi web chat AI premium dengan antarmuka seperti ChatGPT, didukung oleh **OpenCode Zen API** dan model **deepseek-v4-flash-free**. Streaming real-time, respons cepat, UI modern dengan tema gelap.

---

## ✨ Fitur

| Fitur | Detail |
|-------|--------|
| 💬 **AI Chat** | Percakapan real-time dengan AI |
| ⚡ **Streaming** | Respons muncul karakter per karakter |
| 🎨 **Moestika AI UI** | Desain premium, dark mode, glassmorphism |
| 📱 **Responsive** | Mobile-first, nyaman di HP & desktop |
| 🚀 **Cepat** | Ringan, tanpa framework berat |
| 🔒 **Privasi** | Chat via API langsung, tanpa database |
| 🆓 **Gratis** | Tidak perlu API key, gratis selamanya |

---

## 🚀 Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Node.js, Express.js
- **AI API:** OpenCode Zen (`deepseek-v4-flash-free`)
- **Streaming:** Server-Sent Events (SSE)
- **Deploy:** Cloudflare Tunnel + VPS Ubuntu

---

## 📦 Instalasi

```bash
git clone https://github.com/clickmamaheti-prog/moestika-aiWeb.git
cd moestika-aiWeb

npm install express

# Jalankan
node server.js
```

Buka `http://localhost:5090` di browser.

---

## 🔧 Konfigurasi

Semua konfigurasi ada di `server.js`:

```javascript
const PORT = 5090;                             // Port server
const MODEL = 'deepseek-v4-flash-free';        // Model AI
```

---

## 🖼️ Tampilan

| Desktop | Mobile |
|---------|--------|
| Chat layout dengan navbar premium | Responsive, full-height |

- Theme gelap premium
- Gradient accent (Cyan → Pink → Purple)
- Shimmer animation pada logo
- Typography: Plus Jakarta Sans + Inter

---

## 🌐 Domain

Akses langsung: [https://moestika.devculture.xyz](https://moestika.devculture.xyz)

---

## 📄 Lisensi

© 2026 **DevCult XII** — All rights reserved.

---

> Crafting Premium AI Experiences — Moestika AI
