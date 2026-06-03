#!/bin/bash
# Шаг 4: Действия после веб-установки Dolibarr
# Запускать ПОСЛЕ завершения установщика на http://<IP>/install/
set -e

INSTALL_DIR="/var/www/html/dolibarr"

echo "=== Пост-установочная настройка ==="

# Блокируем папку install (безопасность)
if [ -f "${INSTALL_DIR}/htdocs/install/install.lock" ]; then
    echo "install.lock уже существует"
else
    touch "${INSTALL_DIR}/htdocs/install/install.lock"
    chown www-data:www-data "${INSTALL_DIR}/htdocs/install/install.lock"
    echo "✅ install.lock создан"
fi

# Читаем данные БД из файла, созданного скриптом 01
if [ -f /root/.dolibarr_db.env ]; then
    source /root/.dolibarr_db.env
    echo ""
    echo "Данные БД из /root/.dolibarr_db.env:"
    echo "  DB_NAME: ${DB_NAME}"
    echo "  DB_USER: ${DB_USER}"
    echo "  DB_PASS: ${DB_PASS}"
fi

# Добавляем переменные в /home/ubuntu/.env (для бота)
ENV_FILE="/home/ubuntu/.env"
if [ -f "${ENV_FILE}" ]; then
    # Убираем старые значения если есть
    sed -i '/^BOLLENTE_DOLIBARR_URL=/d' "${ENV_FILE}"
    sed -i '/^BOLLENTE_DOLIBARR_KEY=/d' "${ENV_FILE}"
fi

echo "" >> "${ENV_FILE}"
echo "# Dolibarr (заполнить вручную после установки)" >> "${ENV_FILE}"
echo "BOLLENTE_DOLIBARR_URL=http://161.35.73.163" >> "${ENV_FILE}"
echo "BOLLENTE_DOLIBARR_KEY=<API_KEY_FROM_DOLIBARR>" >> "${ENV_FILE}"

echo ""
echo "✅ Готово! Следующие шаги:"
echo "  1. Войдите в Dolibarr: http://161.35.73.163"
echo "  2. Меню: Настройки → API/REST → Включить API, скопируйте ключ"
echo "  3. Обновите BOLLENTE_DOLIBARR_KEY в /home/ubuntu/.env"
echo "  4. Задеплойте Telegram-бота: bash /home/ubuntu/bollente/scripts/bollente_bot/setup.sh"
