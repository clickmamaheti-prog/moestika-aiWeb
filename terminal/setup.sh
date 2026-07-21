#!/bin/bash
# DevCult XII — Setup Terminal VPS2
# Jalanin di VPS2: bash <(curl -sL https://github.com/clickmamaheti-prog/moestika-terminal/raw/main/setup.sh)

set -e

echo "🚀 Setup Moestika Terminal — VPS2"

# 1. SSH Security
echo "[1] Mengamankan SSH..."
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config
sed -i 's/^#*MaxSessions.*/MaxSessions 2/' /etc/ssh/sshd_config
sed -i 's/^#*LoginGraceTime.*/LoginGraceTime 30/' /etc/ssh/sshd_config
echo "MaxStartups 2:50:5" >> /etc/ssh/sshd_config
systemctl restart sshd
echo "   ✅ SSH diamankan (password login dimatikan)"

# 2. Setup SSH Key dari VPS utama
echo "[2] Setup SSH Key..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Copy public key from main VPS
cat >> ~/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHx4dummykey Bob DevCult XII
EOF
chmod 600 ~/.ssh/authorized_keys
echo "   ✅ SSH Key terpasang"

# 3. Cloudflare Tunnel
echo "[3] Setup Cloudflare Tunnel..."
curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared version

mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'TUNEOF'
tunnel: 6e5fb3f9-e493-4143-ba00-86a00af3381c
credentials-file: /root/.cloudflared/credentials.json

ingress:
  - hostname: terminal.moestika.devculture.xyz
    service: http://localhost:3000
  - service: http_status:404
TUNEOF

echo "   ✅ Cloudflare Tunnel config siap"

# 4. Setup Node.js Terminal
echo "[4] Setup Terminal Server..."
cd /opt/moestika-terminal
npm install 2>/dev/null

cat > /etc/systemd/system/moestika-terminal.service << 'SVCEOF'
[Unit]
Description=Moestika Terminal
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/moestika-terminal
ExecStart=/usr/local/bin/node server.js
Restart=always
RestartSec=5
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable moestika-terminal
systemctl start moestika-terminal
echo "   ✅ Terminal server running"

# 5. Firewall (DDoS protection)
echo "[5] Firewall Rules..."
apt-get install -y iptables-persistent >/dev/null 2>&1

# Flush existing
iptables -F INPUT
iptables -F FORWARD

# Default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# SSH rate limit (max 3 koneksi per 30 detik)
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set --name SSH
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 30 --hitcount 3 --name SSH -j DROP
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Terminal HTTP (rate limited)
iptables -A INPUT -p tcp --dport 3000 -m connlimit --connlimit-above 10 -j REJECT
iptables -A INPUT -p tcp --dport 3000 -j ACCEPT

# DDoS: limit ICMP
iptables -A INPUT -p icmp -m limit --limit 5/second --limit-burst 10 -j ACCEPT
iptables -A INPUT -p icmp -j DROP

# DDoS: limit new connections per second
iptables -A INPUT -p tcp --syn -m limit --limit 20/s --limit-burst 40 -j ACCEPT
iptables -A INPUT -p tcp --syn -j DROP

# Save
iptables-save > /etc/iptables/rules.v4
netfilter-persistent save >/dev/null 2>&1
echo "   ✅ Firewall aktif (DDoS protection)"

echo ""
echo "═══════════════════════════════════════════"
echo "✅ SETUP SELESAI!"
echo "   Terminal: https://terminal.moestika.devculture.xyz"
echo "   SSH: root@bore.pub -p 22807 (key only)"
echo "═══════════════════════════════════════════"
