#!/usr/bin/env python3
"""Bollente Telegram Sales Bot — B2C retail heating equipment, Uzbekistan."""

import logging
import os
import time
from datetime import datetime
from pathlib import Path

import httpx
from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    Update,
)
from telegram.constants import ChatAction, ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

# ── Config ────────────────────────────────────────────────────────────────────
for _env in [Path("/home/ubuntu/.env"), Path(__file__).parent / ".env"]:
    if _env.exists():
        load_dotenv(_env, override=False)

BOT_TOKEN       = os.environ.get("BOLLENTE_BOT_TOKEN", "")
DOLIBARR_URL    = os.getenv("BOLLENTE_DOLIBARR_URL", "")
DOLIBARR_KEY    = os.getenv("BOLLENTE_DOLIBARR_KEY", "")
ANTHROPIC_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
MANAGER_CHAT_ID = int(os.getenv("BOLLENTE_MANAGER_CHAT_ID", "0"))

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("bollente")

if not BOT_TOKEN:
    raise SystemExit("BOLLENTE_BOT_TOKEN not set. Add it to /home/ubuntu/.env")

# ── Conversation states ───────────────────────────────────────────────────────
LEAD_NAME, LEAD_PHONE, LEAD_CITY, LEAD_NEED = range(4)

# ── Dolibarr API + cache ──────────────────────────────────────────────────────
_cache: dict = {"products": [], "categories": [], "ts": 0.0}
CACHE_TTL = 300  # 5 min


async def _dol(path: str, params: dict | None = None) -> list | dict:
    if not DOLIBARR_URL or not DOLIBARR_KEY:
        return []
    url = f"{DOLIBARR_URL.rstrip('/')}/api/index.php/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=10, verify=False) as c:
        r = await c.get(url, headers={"DOLAPIKEY": DOLIBARR_KEY}, params=params or {})
        r.raise_for_status()
        return r.json()


async def load_catalog() -> tuple[list, list]:
    global _cache
    if time.time() - _cache["ts"] < CACHE_TTL:
        return _cache["products"], _cache["categories"]
    try:
        prods = await _dol("products", {
            "limit": 500, "sortfield": "label", "sortorder": "ASC", "mode": 1,
        })
        cats = await _dol("categories", {"type": "product", "limit": 50})
        if isinstance(prods, list):
            _cache["products"] = prods
        if isinstance(cats, list):
            _cache["categories"] = cats
        _cache["ts"] = time.time()
        log.info(f"Catalog refreshed: {len(_cache['products'])} products, {len(_cache['categories'])} cats")
    except Exception as e:
        log.warning(f"Dolibarr API error: {e}")
    return _cache["products"], _cache["categories"]


def _product_ctx(products: list) -> str:
    lines = []
    for p in products[:100]:
        name  = p.get("label", "")
        ref   = p.get("ref", "")
        price = float(p.get("price") or 0)
        stock = int(p.get("stock_reel") or 0)
        p_str = f"${price:.0f}" if price else "цена по запросу"
        s_str = f"есть {stock} шт" if stock > 0 else "под заказ"
        lines.append(f"• {name} [{ref}]: {p_str}, {s_str}")
    return "\n".join(lines) or "каталог загружается"


# ── AI ────────────────────────────────────────────────────────────────────────
_ai = AsyncAnthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None

_SYSTEM = """Ты — консультант-продавец компании Bollente (Ташкент, Узбекистан).
Bollente — розничный магазин систем отопления: котлы (газовые, электрические), \
алюминиевые и биметаллические радиаторы, конвекторы, тёплые полы.
Доставка по всему Узбекистану. Официальная гарантия. Есть рассрочка.
Instagram: @bollente

Правила ответа:
- Отвечай на языке клиента (русский или узбекский).
- Кратко и по делу: 2–4 предложения.
- Расчёт мощности: 100 Вт на 1 м² (стандарт для Узбекистана).
- Если клиент готов купить или нужен расчёт — предложи заявку: /zayavka
- Для больших объёмов (10+ секций / несколько котлов) — предложи персональный расчёт.
- Если нет точной цены — "уточните при оформлении заявки"."""


async def ai_reply(text: str, history: list, products: list) -> str:
    if not _ai:
        return "Консультант временно недоступен. Оставьте заявку: /zayavka"
    system = _SYSTEM + "\n\nАктуальный каталог:\n" + _product_ctx(products)
    msgs = (history or [])[-10:] + [{"role": "user", "content": text}]
    try:
        r = await _ai.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=system,
            messages=msgs,
        )
        return r.content[0].text
    except Exception as e:
        log.error(f"Claude error: {e}")
        return "Произошла ошибка. Попробуйте позже или оставьте заявку: /zayavka"


# ── Keyboards ────────────────────────────────────────────────────────────────
def kb_main() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🛍 Каталог",        callback_data="catalog"),
            InlineKeyboardButton("🤖 Консультант",     callback_data="ai_chat"),
        ],
        [InlineKeyboardButton("📋 Оставить заявку",   callback_data="lead")],
        [
            InlineKeyboardButton("💳 Рассрочка",       callback_data="credit"),
            InlineKeyboardButton("📞 Контакты",        callback_data="contacts"),
        ],
    ])


def kb_cancel_reply() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup([["❌ Отмена"]], resize_keyboard=True, one_time_keyboard=True)


PAGE_SIZE = 8


# ── /start  /menu ─────────────────────────────────────────────────────────────
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    name = update.effective_user.first_name or "друг"
    await update.message.reply_text(
        f"🔥 Salom {name}! Привет!\n\n"
        "*Bollente* — котлы, радиаторы, конвекторы.\n"
        "Тепло в вашем доме — наша забота 🏠\n"
        "Доставка по всему Узбекистану 🇺🇿\n\n"
        "Выберите действие:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=kb_main(),
    )


async def cmd_menu(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("Главное меню:", reply_markup=kb_main())


# ── Catalog helpers ───────────────────────────────────────────────────────────
async def _show_catalog(q) -> None:
    _, cats = await load_catalog()
    rows = []
    for c in cats[:12]:
        cid = c.get("id") or c.get("rowid", 0)
        lbl = c.get("label", "Категория")
        rows.append([InlineKeyboardButton(f"📂 {lbl}", callback_data=f"cat|{cid}|0")])
    rows.append([InlineKeyboardButton("📦 Все товары", callback_data="cat|all|0")])
    rows.append([InlineKeyboardButton("◀ Назад",       callback_data="menu")])
    await q.edit_message_text(
        "🛍 *Каталог* — выберите категорию:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(rows),
    )


async def _show_cat_page(q, cat_id: str, page: int) -> None:
    prods, _ = await load_catalog()
    if cat_id != "all":
        items = [
            p for p in prods
            if any(
                str(c.get("id", c.get("rowid", ""))) == cat_id
                for c in (p.get("categories") or [])
            )
        ]
        if not items:
            items = prods
    else:
        items = prods

    total = len(items)
    s, e  = page * PAGE_SIZE, min((page + 1) * PAGE_SIZE, total)
    rows  = []
    for p in items[s:e]:
        pid   = p.get("id") or p.get("rowid", 0)
        lbl   = (p.get("label") or "")[:38]
        price = float(p.get("price") or 0)
        stock = int(p.get("stock_reel") or 0)
        icon  = "✅" if stock > 0 else "📦"
        p_str = f"${price:.0f}" if price else "?"
        rows.append([InlineKeyboardButton(
            f"{icon} {lbl} — {p_str}",
            callback_data=f"prod|{pid}",
        )])
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("◀ Пред", callback_data=f"cat|{cat_id}|{page - 1}"))
    if e < total:
        nav.append(InlineKeyboardButton("След ▶", callback_data=f"cat|{cat_id}|{page + 1}"))
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton("◀ К категориям", callback_data="catalog")])

    if not items:
        await q.edit_message_text(
            "Каталог пока не загружен. Оставьте заявку — пришлём прайс!",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("📋 Оставить заявку", callback_data="lead")],
                [InlineKeyboardButton("◀ Назад", callback_data="menu")],
            ]),
        )
        return

    await q.edit_message_text(
        f"Товары {s + 1}–{e} из {total}:",
        reply_markup=InlineKeyboardMarkup(rows),
    )


async def _show_product(q, prod_id: int) -> None:
    prods, _ = await load_catalog()
    p = next((x for x in prods if (x.get("id") or x.get("rowid")) == prod_id), None)
    if not p:
        await q.edit_message_text(
            "Товар не найден.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("◀ Каталог", callback_data="catalog")
            ]]),
        )
        return

    name  = p.get("label", "—")
    ref   = p.get("ref", "—")
    price = float(p.get("price") or 0)
    stock = int(p.get("stock_reel") or 0)
    desc  = (p.get("description") or "").strip()[:300]

    lines = [f"*{name}*", f"`{ref}`", ""]
    if price:
        lines.append(f"💰 Цена: *${price:.2f}*")
    else:
        lines.append("💰 Цена по запросу")
    lines.append("✅ В наличии: %d шт" % stock if stock > 0 else "📦 Под заказ")
    if desc:
        lines += ["", desc]

    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 Заказать", callback_data="lead")],
        [InlineKeyboardButton("◀ Назад",    callback_data="catalog")],
    ])
    await q.edit_message_text(
        "\n".join(lines),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=kb,
    )


# ── Callback router ───────────────────────────────────────────────────────────
async def on_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    q = update.callback_query
    await q.answer()
    d = q.data

    if d == "menu":
        await q.edit_message_text("Главное меню:", reply_markup=kb_main())

    elif d == "catalog":
        await _show_catalog(q)

    elif d.startswith("cat|"):
        _, cid, pg = d.split("|", 2)
        await _show_cat_page(q, cid, int(pg))

    elif d.startswith("prod|"):
        await _show_product(q, int(d.split("|", 1)[1]))

    elif d == "ai_chat":
        ctx.user_data["history"] = []
        await q.edit_message_text(
            "🤖 *AI-консультант Bollente*\n\n"
            "Задайте любой вопрос:\n\n"
            "• _Какой котёл выбрать для дома 100 м²?_\n"
            "• _Сколько секций радиатора нужно?_\n"
            "• _Чем биметалл отличается от алюминия?_\n\n"
            "Для меню: /menu | Для заявки: /zayavka",
            parse_mode=ParseMode.MARKDOWN,
        )

    elif d == "credit":
        await q.edit_message_text(
            "💳 *Рассрочка Bollente*\n\n"
            "Покупайте сейчас — платите частями!\n\n"
            "• Рассрочка 0% на 3–12 месяцев\n"
            "• Оформление за 15 минут\n"
            "• Без первоначального взноса\n\n"
            "Оставьте заявку — уточним условия для вашего заказа:",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("📋 Оставить заявку", callback_data="lead")],
                [InlineKeyboardButton("◀ Назад",            callback_data="menu")],
            ]),
        )

    elif d == "contacts":
        await q.edit_message_text(
            "📞 *Bollente — Контакты*\n\n"
            "📍 Ташкент, Уста Ширин 111д\n"
            "📸 Instagram: @bollente\n\n"
            "⏰ Пн–Сб: 9:00–18:00\n\n"
            "Оставьте заявку — перезвоним в течение часа!",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("📋 Оставить заявку", callback_data="lead")],
                [InlineKeyboardButton("◀ Назад",            callback_data="menu")],
            ]),
        )


# ── AI chat (free-text handler) ───────────────────────────────────────────────
async def on_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    text = (update.message.text or "").strip()
    if not text:
        return
    await update.message.chat.send_action(ChatAction.TYPING)
    prods, _ = await load_catalog()
    history  = ctx.user_data.get("history", [])
    reply    = await ai_reply(text, history, prods)
    history.append({"role": "user",      "content": text})
    history.append({"role": "assistant", "content": reply})
    ctx.user_data["history"] = history[-16:]
    await update.message.reply_text(
        reply,
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("📋 Оставить заявку", callback_data="lead"),
            InlineKeyboardButton("🏠 Меню",            callback_data="menu"),
        ]]),
    )


# ── Lead ConversationHandler ──────────────────────────────────────────────────
async def lead_entry_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["lead"] = {}
    await update.message.reply_text(
        "📋 *Заявка* (шаг 1/4)\n\nКак вас зовут?",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=kb_cancel_reply(),
    )
    return LEAD_NAME


async def lead_entry_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    q = update.callback_query
    await q.answer()
    ctx.user_data["lead"] = {}
    await q.edit_message_text(
        "📋 *Заявка* (шаг 1/4)\n\nКак вас зовут?\n_(Для отмены: /cancel)_",
        parse_mode=ParseMode.MARKDOWN,
    )
    return LEAD_NAME


async def step_name(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    t = update.message.text.strip()
    if t == "❌ Отмена":
        return await lead_cancel(update, ctx)
    ctx.user_data.setdefault("lead", {})["name"] = t
    await update.message.reply_text(
        f"Отлично, {t}! 👋\n\n📱 *Шаг 2/4:* Ваш номер телефона?",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=kb_cancel_reply(),
    )
    return LEAD_PHONE


async def step_phone(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    t = update.message.text.strip()
    if t == "❌ Отмена":
        return await lead_cancel(update, ctx)
    ctx.user_data["lead"]["phone"] = t
    await update.message.reply_text(
        "🏙 *Шаг 3/4:* В каком городе вы находитесь?",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=kb_cancel_reply(),
    )
    return LEAD_CITY


async def step_city(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    t = update.message.text.strip()
    if t == "❌ Отмена":
        return await lead_cancel(update, ctx)
    ctx.user_data["lead"]["city"] = t
    await update.message.reply_text(
        "🔥 *Шаг 4/4:* Что вас интересует?\n_(Котёл, радиаторы, конвекторы — укажите подробнее)_",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=kb_cancel_reply(),
    )
    return LEAD_NEED


async def step_need(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    t = update.message.text.strip()
    if t == "❌ Отмена":
        return await lead_cancel(update, ctx)

    lead = ctx.user_data.get("lead", {})
    lead["need"]    = t
    lead["time"]    = datetime.now().strftime("%d.%m.%Y %H:%M")
    lead["tg_id"]   = update.effective_user.id
    lead["tg_user"] = update.effective_user.username or ""

    await _notify_manager(update.get_bot(), lead)

    await update.message.reply_text(
        "✅ *Заявка принята!*\n\n"
        "Мы свяжемся с вами в течение часа.\n"
        "Спасибо, что выбрали Bollente! 🔥",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardRemove(),
    )
    await update.message.reply_text("Главное меню:", reply_markup=kb_main())
    ctx.user_data.pop("lead", None)
    return ConversationHandler.END


async def lead_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data.pop("lead", None)
    await update.message.reply_text("Отменено.", reply_markup=ReplyKeyboardRemove())
    await update.message.reply_text("Главное меню:", reply_markup=kb_main())
    return ConversationHandler.END


async def _notify_manager(bot, lead: dict) -> None:
    if not MANAGER_CHAT_ID:
        log.warning("BOLLENTE_MANAGER_CHAT_ID not set — lead not forwarded")
        return
    msg = (
        "🔔 *Новая заявка — Bollente Bot*\n\n"
        f"👤 Имя: {lead.get('name', '—')}\n"
        f"📱 Телефон: `{lead.get('phone', '—')}`\n"
        f"🏙 Город: {lead.get('city', '—')}\n"
        f"🔥 Интерес: {lead.get('need', '—')}\n"
        f"🕐 Время: {lead.get('time', '—')}\n"
        f"💬 TG: @{lead.get('tg_user', '')} (id: {lead.get('tg_id', '')})"
    )
    try:
        await bot.send_message(MANAGER_CHAT_ID, msg, parse_mode=ParseMode.MARKDOWN)
        log.info(f"Lead forwarded: {lead.get('name')} / {lead.get('phone')}")
    except Exception as e:
        log.error(f"Failed to notify manager: {e}")


# ── Application setup ─────────────────────────────────────────────────────────
def main() -> None:
    app = Application.builder().token(BOT_TOKEN).build()

    lead_conv = ConversationHandler(
        entry_points=[
            CommandHandler("zayavka", lead_entry_cmd),
            CallbackQueryHandler(lead_entry_cb, pattern="^lead$"),
        ],
        states={
            LEAD_NAME:  [MessageHandler(filters.TEXT & ~filters.COMMAND, step_name)],
            LEAD_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, step_phone)],
            LEAD_CITY:  [MessageHandler(filters.TEXT & ~filters.COMMAND, step_city)],
            LEAD_NEED:  [MessageHandler(filters.TEXT & ~filters.COMMAND, step_need)],
        },
        fallbacks=[
            CommandHandler("cancel", lead_cancel),
            CommandHandler("menu",   cmd_menu),
        ],
        allow_reentry=True,
    )

    app.add_handler(CommandHandler("start",   cmd_start))
    app.add_handler(CommandHandler("menu",    cmd_menu))
    app.add_handler(lead_conv)
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))

    log.info("Bollente Sales Bot starting 🔥")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
