# PropLink

> Платформа недвижимости США (класс Zillow / Redfin / Realtor) с фокусом на **тотальное стирание границ в коммуникации** между всеми участниками сделки: покупатели, продавцы, инвесторы, агенты, кредиторы, тайтл-компании, адвокаты, контракторы — в одном инбоксе, на любом языке, из любого мессенджера, с полноценной админкой и поддержкой AI-агентов по протоколу MCP.

[![Production](https://img.shields.io/badge/Production-Live%20on%20Render-emerald?style=flat-square)](https://proplink-app.onrender.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20100%25-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Database-TiDB%20Cloud%20Serverless-orange?style=flat-square)](https://pingcap.com/ai/)

---

## 🌐 Живой Продакшн
- **Production URL:** [https://proplink-app.onrender.com](https://proplink-app.onrender.com)
- **Admin Hub:** [https://proplink-app.onrender.com/admin](https://proplink-app.onrender.com/admin) *(защищён: `role === "admin"`)*
- **MCP Endpoint:** `https://proplink-app.onrender.com/mcp` *(JSON-RPC 2.0 над Streamable HTTP)*

---

## 1. Для чего этот проект

**Проблема:** В US real estate невозможно быстро и структурированно связаться с агентом и показать ему свой офер. Коммуникация размазана по email, SMS, FB Messenger, WhatsApp; участники говорят на разных языках; документы сделки теряются.

**Решение PropLink:**
- **Structured Offer Flow** — офер как структурированный объект (цена, earnest money, financing, contingencies, proof of funds), а не письмо в почту. Агент отвечает accept / decline / counter одной кнопкой.
- **Deal Room** — после принятия офера автоматически создаётся комната сделки: чеклист задач по ролям, версионированные документы, общий чат.
- **Admin Hub (`/admin`)** — полноценный центр управления: системные метрики, модерация листингов, одобрение лицензий агентов, управление ролями юзеров, блокировка (ban/unban) и строгое удаление пользователей с защитой от дурака.
- **Omnichannel Inbox** — сообщения из Facebook Page, Instagram DM, WhatsApp Business, Telegram Bot и X падают в единый мессенджер PropLink; ответ из PropLink уходит обратно в мессенджер клиента.
- **BYOK AI-переводчик** — каждый юзер читает все сообщения на своём языке, используя СВОЙ API-ключ (OpenAI / Anthropic / Kimi / DeepSeek / OpenRouter / Ollama / LM Studio).
- **Zillow Import** — импорт данных объекта с Zillow по адресу одной кнопкой: цена, фото (до 40), площадь, характеристики.
- **Distressed & Foreclosure** — коннекторы к источникам каунти (lis pendens, NOD, auction, REO) с персональным добавлением источников.
- **MCP Server (21 инструмент)** — полная поддержка AI-агентов (Claude Code / Kimi Code / Codex / Antigravity) для автоматического управления каталогом, оферами, сделками и административными функциями.

---

## 2. Стек Технологий

| Слой | Технологии |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 3.4, Radix UI / shadcn/ui, react-router v7, Leaflet + OpenStreetMap, PapaParse, Recharts, Lucide Icons |
| **Backend** | Hono 4 (Node.js), tRPC 11 (end-to-end types, superjson), REST API v1, MCP Server v1 |
| **DB & ORM** | MySQL 8 (TiDB Cloud Serverless Токио) через Drizzle ORM — 23 таблицы с полными FK и индексами |
| **Auth** | Kimi OAuth 2.0 + JWT-сессии (HS256, HttpOnly cookie); email/password (scrypt) с rate-limiting |
| **AI Engine** | BYOK-перевод: OpenAI-compatible + Anthropic Messages API (8 провайдеров, 14+ языков) |
| **Storage** | Cloudflare R2 (S3-compatible, presigned PUT/GET) — `@aws-sdk/client-s3` |
| **Integrations** | Zillow (RapidAPI), Meta Graph API (FB/IG/WhatsApp), Telegram Bot API, X API v2 |
| **CI/CD & Deploy** | GitHub Actions (`.github/workflows/deploy.yml`), Render Web Service (`render.yaml` Blueprint), esbuild bundle (`dist/boot.js`) |

---

## 3. Архитектура и Структура Проекта

```
┌─────────────────────────────── Render Web Service ───────────────────────────────┐
│  React SPA (dist/public)  ← статика, отдаётся Hono                                │
│  Hono Server:                                                                     │
│   • /api/trpc/*      — tRPC appRouter (включая adminRouter)                       │
│   • /api/v1/*        — REST API (Bearer plk_* ключи, rate limit 120 req/min)      │
│   • /mcp             — MCP-сервер (JSON-RPC 2.0, 21 инструмент для AI-агентов)    │
│   • /api/webhooks/*  — Webhooks Meta & Telegram                                   │
│   • /sitemap.xml     — SEO/GEO метаинъекции                                       │
└───────────────────────────────────────────────────────────────────────────────────┘
        │                │                    │                    │
   TiDB (MySQL)    Cloudflare R2       Meta Graph API        AI-провайдеры юзера
   23 таблицы      presigned URLs      + Telegram + X        (BYOK, OpenAI-совм.)
```

**Структура репозитория:**
```
PropLink/
├── .github/workflows/deploy.yml   # GitHub Actions CI/CD
├── render.yaml                    # Render Blueprint Specification
└── app/
    ├── api/                       # Бэкенд Hono & tRPC
    │   ├── boot.ts                # Серверный entrypoint
    │   ├── adminRouter.ts         # tRPC эндпоинты админки
    │   ├── mcp.ts                 # MCP сервер (21 инструмент)
    │   ├── queries/               # Drizzle базы данных (adminQueries, users, etc.)
    │   └── lib/                   # Auth, env, zillow, security
    ├── contracts/                 # Общие Zod схемы и типы
    ├── db/                        # Drizzle схема (23 таблицы)
    │   └── schema.ts
    ├── src/                       # React Frontend
    │   ├── pages/                 # Страницы (Admin, Dashboard, Listings, etc.)
    │   └── components/            # UI компоненты (Navbar, Dialogs, ListingCard)
    └── package.json
```

---

## 4. Схема Базы Данных (23 таблицы)

| Таблица | Назначение |
|---|---|
| `users` | Пользователи (email unique, unionId unique, роль user/admin, статус banned 0/1) |
| `profiles` | Профессиональный профиль 1:1 (13 ролей, компания, лицензия, верификация) |
| `listings` | Листинги недвижимости (title, фото JSON[], 6 типов, 5 статусов) |
| `offers` | Структурированные оферы (7 типов финансирования, контингенции, статусы) |
| `deal_rooms` | Комнаты сделок (lifecycle: open → under_contract → closing → closed) |
| `deal_tasks` | Задачи сделки по ролям (buyer/seller/agent/title) |
| `deal_documents` | Документы сделки (версионирование, R2 storage) |
| `conversations` | Чат-треды (внутренние + omnichannel bridge, group/direct) |
| `conversation_participants` | M:N участники + заметки + пиннинг + сортировка |
| `conversation_tasks` | Kanban-задачи внутри чата (todo/in_progress/done) |
| `messages` | Сообщения (вложения JSON, переводы JSON cache) |
| `hidden_messages` | Per-user скрытие сообщений |
| `imports` | История bulk-импортов CSV/JSON |
| `foreclosure_records` | Записи foreclosure/pre-foreclosure по каунти |
| `county_connectors` | Пользовательские источники данных каунти |
| `saved_searches` | Сохранённые поисковые запросы с алертами |
| `buy_boxes` | Инвесторский профиль покупателя (автоматчинг) |
| `notifications` | In-app уведомления (колокольчик) |
| `ai_settings` | BYOK AI настройки (провайдер, ключ, модель, язык) |
| `channel_connections` | Подключённые каналы (FB/IG/WA/X/Telegram, AES-256-GCM) |
| `api_keys` | Developer API ключи (plk_*, sha256 hash) |
| `webhooks` | Пользовательские webhook-эндпоинты (HMAC-SHA256) |
| `webhook_deliveries` | Лог доставок вебхуков |

---

## 5. Подробный Функционал

### 🛡️ Admin Hub (`/admin`) & Безопасность
- [x] **Системные Метрики**: просмотр активных юзеров, лицензий, листингов, сделок и статуса тикетов.
- [x] **Verification Center**: проверка и одобрение лицензий агентов в 1 клик.
- [x] **User Management**: поиск юзеров, смена ролей, назначение админов.
- [x] **Защита от Дурака (Strict Safety Modals)**:
  - *Запрет на случайное удаление*: Для удаления юзера администратор **обязан вручную ввести точный email** пользователя.
  - *Блокировка (Ban/Unban)*: Подтверждающий диалог блокировки с немедленным баном входе на бэкенде.
- [x] **Listing Moderation**: смена статусов объектов (active, draft, pending, sold, archived).

### 🤖 AI Agent MCP Server (21 инструмент)
AI-агенты могут управлять системой через MCP-протокол:
- `proplink_admin_get_metrics` — системная статистика
- `proplink_admin_list_users` — поиск и фильтрация юзеров
- `proplink_admin_set_user_role` — управление ролями
- `proplink_admin_ban_user` — блокировка/разблокировка
- `proplink_admin_delete_user` — удаление аккаунтов
- `proplink_admin_verify_pro` — верификация риелторов
- `proplink_admin_moderate_listing` — модерация объектов
- *+ 14 базовых инструментов для работы с листингами, оферами и сообщениями.*

### 🏠 Каталог, Оферы и Сделки
- [x] **Zillow Import**: автоматическое скачивание всех характеристик и до 40 фото по адресу объекта.
- [x] **Structured Offers**: отправка и принятие оферов с автоматическим созданием Deal Room.
- [x] **BYOK Переводчик**: мгновенный перевод чатов на 14+ языков с использованием собственного API-ключа.
- [x] **Omnichannel**: единый инбокс для Telegram, WhatsApp, Instagram, Facebook и Twitter.

---

## 6. Команды Разработки и Сборки

Все команды запускаются в папке `app/`:

```bash
cd app

# Запуск локального сервера разработки
npm run dev

# Проверка типов TypeScript (Strict)
npm run check

# Сборка продакшн бандла (Vite + esbuild)
npm run build

# Запуск продакшн сервера
npm run start
```

---

## 7. Развёртывание (Deployment)

1. Внесите изменения в `app/src` или `app/api`.
2. Проверьте сборку: `npm run check && npm run build`.
3. Сделайте коммит и пуш: `git commit -am "feat: ..." && git push origin main`.
4. Render автоматически соберет проект и развернет на **https://proplink-app.onrender.com**.
