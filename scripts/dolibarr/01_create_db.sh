#!/bin/bash
# Шаг 1: Создание базы данных MariaDB для Dolibarr
set -e

DB_NAME="dolibarr"
DB_USER="dolibarr"
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"

echo "=== Создание БД для Dolibarr ==="

# Создаём БД и пользователя
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo ""
echo "✅ БД создана успешно!"
echo ""
echo "Сохраните эти данные — они понадобятся при установке Dolibarr:"
echo "  DB_NAME: ${DB_NAME}"
echo "  DB_USER: ${DB_USER}"
echo "  DB_PASS: ${DB_PASS}"
echo ""

# Сохраняем пароль в защищённый файл
ENV_FILE="/root/.dolibarr_db.env"
cat > "${ENV_FILE}" <<ENV
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
ENV
chmod 600 "${ENV_FILE}"
echo "Данные также сохранены в ${ENV_FILE} (chmod 600)"
