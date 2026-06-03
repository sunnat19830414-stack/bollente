#!/bin/bash
# Шаг 2: Скачивание и установка Dolibarr v22
set -e

DOLIBARR_VERSION="22.0.0"
INSTALL_DIR="/var/www/html/dolibarr"
DOLIBARR_ARCHIVE="dolibarr-${DOLIBARR_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/Dolibarr/dolibarr/archive/refs/tags/${DOLIBARR_VERSION}.tar.gz"

echo "=== Установка Dolibarr ${DOLIBARR_VERSION} ==="

# Зависимости PHP
echo "--- Установка PHP-расширений ---"
apt-get install -y \
  php8.3 \
  php8.3-mysql \
  php8.3-gd \
  php8.3-curl \
  php8.3-intl \
  php8.3-mbstring \
  php8.3-xml \
  php8.3-zip \
  php8.3-soap \
  php8.3-imap \
  php8.3-ldap \
  libapache2-mod-php8.3

# Скачиваем Dolibarr
echo "--- Скачивание Dolibarr ${DOLIBARR_VERSION} ---"
cd /tmp
wget -q --show-progress -O "${DOLIBARR_ARCHIVE}" "${DOWNLOAD_URL}"

# Распаковываем
echo "--- Распаковка ---"
tar -xzf "${DOLIBARR_ARCHIVE}"
rm -rf "${INSTALL_DIR}"
mv "dolibarr-${DOLIBARR_VERSION}" "${INSTALL_DIR}"

# Создаём папку documents вне webroot
mkdir -p /var/lib/dolibarr/documents
chown -R www-data:www-data /var/lib/dolibarr
chmod 750 /var/lib/dolibarr

# Права на webroot
chown -R www-data:www-data "${INSTALL_DIR}"
find "${INSTALL_DIR}" -type d -exec chmod 755 {} \;
find "${INSTALL_DIR}" -type f -exec chmod 644 {} \;

echo ""
echo "✅ Dolibarr ${DOLIBARR_VERSION} распакован в ${INSTALL_DIR}"
echo "   Папка documents: /var/lib/dolibarr/documents"
