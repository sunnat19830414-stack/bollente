# Установка Dolibarr на сервер DigitalOcean (161.35.73.163)

**Предусловие:** LAMP уже установлен (Apache2, MariaDB, PHP8.3).

## Порядок выполнения

```bash
# На сервере, от root:

# 1. Клонируем репо (если ещё нет)
git clone https://github.com/sunnat19830414-stack/bollente.git /home/ubuntu/bollente

# 2. Права на скрипты
chmod +x /home/ubuntu/bollente/scripts/dolibarr/*.sh

# 3. Создаём БД (запомните пароль из вывода!)
bash /home/ubuntu/bollente/scripts/dolibarr/01_create_db.sh

# 4. Скачиваем и устанавливаем Dolibarr v22
bash /home/ubuntu/bollente/scripts/dolibarr/02_install_dolibarr.sh

# 5. Настраиваем Apache
bash /home/ubuntu/bollente/scripts/dolibarr/03_configure_apache.sh
```

## Веб-установщик

После шага 5 откройте в браузере:

```
http://161.35.73.163/install/
```

На шаге "База данных" введите:
- Хост: `localhost`
- Имя БД: `dolibarr`
- Пользователь: `dolibarr`
- Пароль: (из вывода скрипта 01 или из `/root/.dolibarr_db.env`)

## После веб-установки

```bash
bash /home/ubuntu/bollente/scripts/dolibarr/04_post_install.sh
```
