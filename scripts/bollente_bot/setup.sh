#!/bin/bash
set -e
VENV="/home/ubuntu/bollente-bot-venv"
REPO="/home/ubuntu/bollente"
BOT_DIR="$REPO/scripts/bollente_bot"

echo "=== Bollente Bot Setup ==="

# Create virtualenv
if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
    echo "✅ Virtualenv created: $VENV"
fi

# Install dependencies
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet -r "$BOT_DIR/requirements.txt"
echo "✅ Dependencies installed"

# Check required env vars
ENV_FILE="/home/ubuntu/.env"
MISSING=0
for VAR in BOLLENTE_BOT_TOKEN BOLLENTE_MANAGER_CHAT_ID; do
    if ! grep -q "^$VAR=" "$ENV_FILE" 2>/dev/null; then
        echo "⚠️  Missing in .env: $VAR"
        MISSING=1
    fi
done
for VAR in BOLLENTE_DOLIBARR_URL BOLLENTE_DOLIBARR_KEY; do
    if ! grep -q "^$VAR=" "$ENV_FILE" 2>/dev/null; then
        echo "ℹ️  Not set yet (add when Dolibarr is ready): $VAR"
    fi
done
if ! grep -q "^ANTHROPIC_API_KEY=" "$ENV_FILE" 2>/dev/null; then
    echo "ℹ️  ANTHROPIC_API_KEY not set — AI consultant will show fallback message"
fi

if [ $MISSING -eq 1 ]; then
    echo "❌ Add missing vars to $ENV_FILE and re-run setup.sh"
    exit 1
fi

# Install systemd service
sudo cp "$BOT_DIR/bollente_bot.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bollente-bot
sudo systemctl restart bollente-bot
echo "✅ Service installed and started"

echo ""
echo "=== Done ==="
echo "Status:  sudo systemctl status bollente-bot"
echo "Logs:    sudo journalctl -fu bollente-bot"
echo "Restart: sudo systemctl restart bollente-bot"
