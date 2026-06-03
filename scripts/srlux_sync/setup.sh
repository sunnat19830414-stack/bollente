#!/bin/bash
set -e
DIR="/home/ubuntu/bollente/scripts/srlux_sync"

echo "=== Установка SR Lux → Dolibarr sync ==="

cp "$DIR/srlux_sync.service" /etc/systemd/system/srlux-sync.service
cp "$DIR/srlux_sync.timer"   /etc/systemd/system/srlux-sync.timer

systemctl daemon-reload
systemctl enable srlux-sync.timer
systemctl start srlux-sync.timer

echo "✅ Таймер установлен (каждые 30 минут)"
echo ""
echo "Запускаем первую синхронизацию..."
systemctl start srlux-sync.service

echo ""
echo "Статус:  systemctl status srlux-sync.timer"
echo "Логи:    journalctl -fu srlux-sync"
