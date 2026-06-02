# Bollente — Claude Context

## Бизнес

Bollente — личный B2C розничный магазин отопительного оборудования.
Отдельный бизнес от SR Lux (инвесторского партнёрства).

| Параметр       | Значение                              |
|----------------|---------------------------------------|
| Владелец       | Суннатилла Таджиев                    |
| Ниша           | Котлы, радиаторы, конвекторы          |
| Рынок          | Узбекистан (B2C, розница)             |
| Instagram      | @bollente (15К подписчиков)           |
| Telegram бот   | @Bollente_bot                         |
| Google Maps    | Уста Ширин 111д, Ташкент              |

## Модель бизнеса

- Закупает товары у SR Lux по **оптовой цене**
- Продаёт клиентам по **розничной цене**
- Маржа (розница − опт) = **личная прибыль** владельца
- Также продаёт товары не из ассортимента SR Lux

## Сервер (Hetzner — ожидается)

| Параметр         | Значение               |
|------------------|------------------------|
| Провайдер        | Hetzner Cloud          |
| План             | CX22 (2 CPU, 4GB RAM)  |
| ОС               | Ubuntu 24.04           |
| Статус           | ⏳ Ожидаем верификацию |

## Стек (планируемый)

| Компонент  | Версия / путь                     |
|------------|-----------------------------------|
| Web-сервер | Apache2                           |
| PHP        | 8.3                               |
| БД         | MariaDB                           |
| Dolibarr   | v22 (новая установка)             |
| Python     | 3.12                              |

## Telegram бот

| Параметр       | Значение                                        |
|----------------|-------------------------------------------------|
| Бот            | @Bollente_bot                                   |
| Токен          | в /home/ubuntu/.env (НЕ в git)                  |
| Manager ID     | 792709276 (Суннатилла, аккаунт Bollente)        |
| Env var токен  | BOLLENTE_BOT_TOKEN                              |
| Env var менед. | BOLLENTE_MANAGER_CHAT_ID                        |
| Dolibarr URL   | BOLLENTE_DOLIBARR_URL (после установки)         |
| Dolibarr key   | BOLLENTE_DOLIBARR_KEY (после установки)         |
| AI             | ANTHROPIC_API_KEY (shared с SR Lux)             |

## Структура репозитория

```
bollente/
├── CLAUDE.md                 ← этот файл
├── .gitignore
├── scripts/
│   └── bollente_bot/         ← Telegram B2C бот
│       ├── bot.py
│       ├── requirements.txt
│       ├── bollente_bot.service
│       └── setup.sh
├── custom/
│   └── modules/              ← кастомные модули Dolibarr (будущее)
└── docs/
```

## Переменные окружения (.env на сервере, НЕ в git)

```
BOLLENTE_BOT_TOKEN=<токен от @BotFather>
BOLLENTE_MANAGER_CHAT_ID=792709276
BOLLENTE_DOLIBARR_URL=https://<домен>
BOLLENTE_DOLIBARR_KEY=<API ключ из Dolibarr>
ANTHROPIC_API_KEY=<ключ с console.anthropic.com>
```

## Деплой бота (после получения сервера)

```bash
git clone https://github.com/<username>/bollente.git /home/ubuntu/bollente
cd /home/ubuntu/bollente
bash scripts/bollente_bot/setup.sh
```

## Управление ботом

```bash
sudo systemctl status bollente-bot
sudo journalctl -fu bollente-bot
sudo systemctl restart bollente-bot
```

## Источники лидов (план)

| Канал       | Статус |
|-------------|--------|
| Telegram бот (@Bollente_bot) | ✅ готов |
| Instagram (@bollente)         | ⏳ возобновить |
| OLX.uz                        | ⏳ листинги    |
| Uzum Market                   | ⏳ листинги    |
| Google Maps                   | ✅ есть        |

## Pending задачи

| Задача                                    | Статус |
|-------------------------------------------|--------|
| Получить Hetzner VPS (верификация)        | ⏳     |
| Установить Dolibarr на Hetzner            | ⏳     |
| Задеплоить @Bollente_bot на сервер        | ⏳     |
| Наполнить каталог товарами                | ⏳     |
| Оживить Instagram @bollente               | ⏳     |
| Создать листинги OLX / Uzum               | ⏳     |
| Настроить домен для Bollente              | ⏳     |

## История изменений

| Дата       | Что сделано                              |
|------------|------------------------------------------|
| 2026-06-02 | Создан репозиторий, структура, бот готов |
