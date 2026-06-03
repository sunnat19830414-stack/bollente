#!/bin/bash
# Шаг 3: Настройка Apache для Dolibarr
set -e

SERVER_IP="161.35.73.163"
INSTALL_DIR="/var/www/html/dolibarr"

echo "=== Настройка Apache для Dolibarr ==="

# Активируем нужные модули
a2enmod rewrite headers

# Создаём VirtualHost
cat > /etc/apache2/sites-available/dolibarr.conf <<VHOST
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot ${INSTALL_DIR}/htdocs

    <Directory ${INSTALL_DIR}/htdocs>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Запрещаем доступ к служебным папкам
    <DirectoryMatch "^${INSTALL_DIR}/(conf|documents|scripts|dev)/">
        Require all denied
    </DirectoryMatch>

    ErrorLog \${APACHE_LOG_DIR}/dolibarr_error.log
    CustomLog \${APACHE_LOG_DIR}/dolibarr_access.log combined
</VirtualHost>
VHOST

# Отключаем default site, включаем dolibarr
a2dissite 000-default.conf 2>/dev/null || true
a2ensite dolibarr.conf

# PHP настройки для Dolibarr
cat > /etc/php/8.3/apache2/conf.d/99-dolibarr.ini <<PHP
memory_limit = 256M
upload_max_filesize = 64M
post_max_size = 64M
max_execution_time = 120
date.timezone = Asia/Tashkent
PHP

# Проверяем конфиг и перезапускаем
apache2ctl configtest
systemctl restart apache2

echo ""
echo "✅ Apache настроен!"
echo ""
echo "Откройте в браузере: http://${SERVER_IP}/install/"
echo "Там запустите веб-установщик Dolibarr."
