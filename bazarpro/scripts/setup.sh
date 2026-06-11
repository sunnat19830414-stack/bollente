#!/usr/bin/env bash
set -euo pipefail

REPO="/home/ubuntu/bollente"
BACKEND="$REPO/bazarpro/backend"
FRONTEND="$REPO/bazarpro/frontend"
SERVICE_NAME="bazarpro"
PORT=8000

echo "=== BazarPro Setup ==="

# System deps
apt-get update -qq
apt-get install -y python3.12-venv nodejs npm

# Pull latest
cd "$REPO"
git pull origin claude/dolibarr-server-setup-Lf4qQ || true

# Backend venv
python3 -m venv "$BACKEND/.venv"
source "$BACKEND/.venv/bin/activate"
pip install -q --upgrade pip
pip install -q -r "$BACKEND/requirements.txt"
deactivate

# Frontend build
cd "$FRONTEND"
npm install --silent
npm run build

# Systemd service
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=BazarPro ERP
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${BACKEND}
EnvironmentFile=/home/ubuntu/.env
ExecStart=${BACKEND}/.venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

echo ""
echo "=== Done ==="
echo "BazarPro is running on http://localhost:${PORT}"
echo "Status: systemctl status ${SERVICE_NAME}"
echo "Logs:   journalctl -fu ${SERVICE_NAME}"
