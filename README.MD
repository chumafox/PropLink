# PropLink

> Платформа недвижимости США (класс Zillow / Redfin / Realtor) с фокусом на **тотальное стирание границ в коммуникации** между всеми участниками сделки: покупатели, продавцы, инвесторы, агенты, кредиторы, тайтл-компании, адвокаты, контракторы — в одном инбоксе, на любом языке, из любого мессенджера.

---

## 1. Для чего этот проект

**Проблема:** в US real estate невозможно быстро и структурированно связаться с агентом и показать ему свой офер. Коммуникация размазана по email, SMS, FB Messenger, WhatsApp; участники говорят на разных языках; документы сделки теряются.

**Решение PropLink:**
- **Structured Offer Flow** — офер как структурированный объект (цена, earnest money, financing, contingencies, proof of funds), а не письмо в почту. Агент отвечает accept / decline / counter одной кнопкой.
- **Deal Room** — после принятия офера автоматически создаётся комната сделки: чеклист задач по ролям, версионированные документы, общий чат.
- **Omnichannel Inbox (как GHL CRM)** — сообщения из Facebook Page, Instagram DM, WhatsApp Business, Telegram Bot и X падают в единый мессенджер PropLink; ответ из PropLink уходит обратно в мессенджер клиента.
- **BYOK AI-переводчик** — каждый юзер читает все сообщения на своём языке, используя СВОЙ API-ключ (OpenAI / Anthropic / Kimi / DeepSeek / OpenRouter / локальные Ollama / LM Studio). Платформа не платит за токены.
- **Zillow Import** — импорт данных объекта с Zillow по адресу одной кнопкой: цена, фото (до 40), площадь, характеристики — всё автоматически заполняется через RapidAPI.
- **Distressed & Foreclosure** — коннекторы к источникам каунти (lis pendens, NOD, auction, REO) с персональным добавлением источников.
- **API-first** — REST API v1, webhooks (HMAC), MCP-сервер для AI-агентов (Claude Code / Kimi Code / Codex).

**Вектор развития:** PropLink становится коммуникационным хабом сделки (transaction layer), а не просто каталогом листингов. Каталог — входная точка; ценность — в потоке офер → deal room → closing, к которому подключены все каналы и все роли.

---

## 2. Стек

| Слой | Технологии |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 3.4, shadcn/ui (53 компонента), react-router v7, Leaflet + OpenStreetMap, PapaParse, Recharts |
| Backend | Hono (Node.js), tRPC 11 (end-to-end types, superjson), REST API v1 на том же Hono |
| DB | MySQL через Drizzle ORM — TiDB Cloud Serverless; 23 таблицы, 11 миграций |
| Auth | Kimi OAuth 2.0 + JWT-сессии (HS256, `APP_SECRET`); email/password (scrypt) с rate-limiting |
| AI | BYOK-перевод: OpenAI-compatible семейство + Anthropic Messages API (8 провайдеров, 14+ языков) |
| Storage | Cloudflare R2 (S3-compatible, presigned PUT/GET) — `@aws-sdk/client-s3` + presigner |
| Integrations | Zillow (RapidAPI), Meta Graph API (FB/IG/WhatsApp), Telegram Bot API, X API v2, BatchData |
| SEO | Server-side OG/Twitter/JSON-LD injection, sitemap.xml, RSS, robots.txt с AI-краулерами |
| Realtime | Polling 3 сек (MVP). WebSocket/SSE — в roadmap |
| Deploy | Docker (один контейнер: статика + API, порт 3000) |

---

## 3. Архитектура

```
┌─────────────────────────────── Docker (port 3000) ───────────────────────────────┐
│  React SPA (dist/public)  ← статика, отдаётся Hono                                │
│  Hono server:                                                                     │
│   • /api/trpc/*      — tRPC appRouter (все внутренние операции)                   │
│   • /api/v1/*        — REST API (Bearer plk_* ключи, rate limit 120 req/min)      │
│   • /mcp             — MCP-сервер (JSON-RPC 2.0, 16 инструментов для AI-агентов)  │
│   • /api/webhooks/channels/meta     — webhooks Meta (FB/IG/WhatsApp)             │
│   • /api/webhooks/channels/telegram — webhook Telegram Bot                        │
│   • /sitemap.xml /robots.txt /llms.txt /feed.xml — SEO/GEO                        │
│   • /listings/:id    — server-side meta injection (OG + JSON-LD)                  │
└───────────────────────────────────────────────────────────────────────────────────┘
        │                │                    │                    │
   TiDB (MySQL)    Cloudflare R2       Meta Graph API        AI-провайдеры юзера
   23 таблицы      presigned URLs      + Telegram + X        (BYOK, OpenAI-совм.)
```

**Структура репозитория:**
```
api/            — сервер: boot.ts, router.ts, *Router.ts, queries/ (Drizzle),
                  channels/ (Meta/Telegram/X + crypto), ai/ (BYOK перевод),
                  foreclosure/ (коннекторы + нормализация), kimi/ (OAuth),
                  lib/ (zillow, security, rateLimit, env, cookies),
                  rest.ts, mcp.ts, seo.ts, geo.ts
src/            — React SPA: pages/ (13 страниц), components/ (16 + 53 ui/),
                  hooks/, lib/, providers/
db/             — schema.ts (23 таблицы Drizzle) + migrations/ (11 миграций)
contracts/      — типы и константы, общие для фронта и бэка (роли, статусы, Zod-схемы)
Dockerfile      — node:20, multi-stage build, non-root USER
```

---

## 4. Схема базы данных (23 таблицы)

| Таблица | Назначение |
|---|---|
| `users` | Пользователи (email unique, unionId unique, роль user/admin) |
| `profiles` | Профессиональный профиль 1:1 (13 ролей, компания, лицензия, верификация) |
| `listings` | Листинги недвижимости (фото JSON[], batchData JSON, 6 типов, 5 статусов) |
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
| `channel_connections` | Подключённые каналы (FB/IG/WA/X/Telegram, AES-256-GCM encrypted) |
| `api_keys` | Developer API ключи (plk_*, sha256 hash) |
| `webhooks` | Пользовательские webhook-эндпоинты (HMAC-SHA256) |
| `webhook_deliveries` | Лог доставок вебхуков |

---

## 5. Реализованный функционал

### Каталог и листинги
- [x] Листинги: полный CRUD, фильтры (город, штат, цена, тип, beds/baths), карта Leaflet/OSM с bounding box search
- [x] Фото: до 40 URL или presigned upload в R2/S3
- [x] **Zillow Import**: импорт по адресу через RapidAPI — автозаполнение всех полей + до 40 фото
- [x] Импорт CSV/JSON (drag&drop, PapaParse, автомаппинг колонок, детальный отчёт об ошибках)
- [x] BatchData интеграция: equity, tax, mortgage balance, ARV, owner name — плавающий UI в чате
- [x] 6 типов недвижимости: house, condo, townhouse, multi_family, land, apartment
- [x] 13 профессиональных ролей: buyer, investor, agent, title_company, private_lender, hard_money_lender, transaction_coordinator, attorney, gator_lender, builder, fix_flip, contractor, deal_participant

### Сделки (Offer → Deal Room)
- [x] Structured Offer Flow: цена, earnest money, financing type (7 типов), closing days, contingencies, proof of funds
- [x] Ответ на офер: accept / decline / counter (с counter price и сообщением)
- [x] Автоматическое создание Deal Room при принятии офера
- [x] Deal Room: timeline-stepper статусов, чеклист задач по ролям, документы с версионированием, ссылка на общий чат
- [x] Webhook-уведомления (`deal.status_changed`) участникам

### Коммуникация
- [x] Мессенджер: 1-on-1 и групповые чаты, вложения (до 10 файлов), unread-бейджи
- [x] Заметки per-conversation (floating draggable), Kanban-задачи в чате, пиннинг и реордер чатов
- [x] Скрытие/показ сообщений per-user
- [x] **BYOK AI-переводчик**: 8 провайдеров × 14+ языков, lazy-перевод по кнопке, «Show original», кэш в `messages.translations`
- [x] **Omnichannel 5 каналов**: Facebook Messenger, Instagram DM, WhatsApp Business Cloud API, Telegram Bot, X (Twitter) DM
- [x] Shadow users: внешние контакты автоматически маппятся в `users` (`unionId = ext:{channel}:{id}`)
- [x] Подпись вебхуков: X-Hub-Signature-256 (Meta), x-telegram-bot-api-secret-token (Telegram)
- [x] In-app уведомления (колокольчик, polling 15 сек, очистка прочитанных)

### Безопасность и аутентификация
- [x] Kimi OAuth 2.0 (JWKS remote validation) + email/password (scrypt)
- [x] JWT-сессии (HS256, jose, HttpOnly cookie, SameSite Lax, Secure flag)
- [x] CSRF guard (Origin/Host header validation на всех мутациях)
- [x] Rate limiting: login (10/min), register (5/min), REST API (120/min)
- [x] AES-256-GCM шифрование токенов каналов и AI-ключей
- [x] API ключи: `plk_*` prefix, sha256 hash, scopes, revocation
- [x] Input sanitization (XSS escaping в JSON-LD injection)

### Данные и автоматизация
- [x] Distressed & Foreclosure: поиск по каунти/штату/типу, статистика, персональные коннекторы
- [x] Saved Searches + алерты, Buy Box (инвесторский профиль с автоматчингом)
- [x] Верификация лицензий агентов (admin approve/reject flow)
- [x] REST API v1: listings / offers / deals / foreclosures + OpenAPI 3.0.3 spec
- [x] Webhooks: HMAC-SHA256 подпись, лог доставок с response codes
- [x] **MCP-сервер**: 16 инструментов для AI-агентов (Claude Code, Kimi Code, Codex)

### SEO / GEO
- [x] Server-side meta injection: OG tags, Twitter cards, canonical URLs
- [x] Schema.org JSON-LD: RealEstateListing, PostalAddress, GeoCoordinates, BreadcrumbList
- [x] Dynamic sitemap.xml (до 2000 активных листингов)
- [x] RSS 2.0 feed (последние 50 листингов)
- [x] robots.txt с explicit allow для AI-краулеров (GPTBot, ClaudeBot, PerplexityBot, Grok)
- [x] llms.txt для AI-контекста

---

## 6. tRPC API (полная карта)

<details>
<summary>Развернуть все 80+ процедур</summary>

| Namespace | Процедура | Тип | Доступ |
|---|---|---|---|
| `ping` | `ping` | Query | Public |
| **auth** | `me`, `register`, `login`, `logout` | Query/Mutation | Mixed |
| **profile** | `me`, `upsert` | Query/Mutation | Authed |
| **listings** | `search`, `byId`, `mine`, `create`, `update`, `updateBatchData`, `remove`, `importFromZillow` | Mixed | Mixed |
| **offers** | `create`, `sent`, `received`, `respond`, `withdraw` | Mixed | Authed |
| **deals** | `list`, `byId`, `addTask`, `toggleTask`, `addDocument`, `updateStatus` | Mixed | Authed |
| **messages** | `conversations`, `chatContacts`, `createGroup`, `unreadCount`, `startWithOwner`, `messages`, `send`, `markRead`, `translate`, `hideMessage`, `unhideMessage`, `setListing`, `setNotes`, `setPinnedFiles`, `getTasks`, `createTask`, `updateTaskStatus`, `deleteTask`, `reorderTasks`, `togglePinConversation`, `reorderConversations` | Mixed | Authed |
| **channels** | `list`, `connectMeta`, `connectWhatsApp`, `connectX`, `connectTelegram`, `disconnect` | Mixed | Authed |
| **foreclosures** | `search`, `stats`, `connectors`, `addConnector`, `removeConnector`, `sync` | Mixed | Authed |
| **imports** | `create`, `list` | Mixed | Authed |
| **notifications** | `list`, `unreadCount`, `markAllRead`, `clearRead`, `savedSearches`, `createSavedSearch`, `deleteSavedSearch`, `buyBox`, `upsertBuyBox`, `buyBoxMatches` | Mixed | Authed |
| **verification** | `request`, `pending`, `decide` | Mixed | Authed/Admin |
| **developer** | `createKey`, `keys`, `revokeKey`, `createWebhook`, `webhooks`, `deleteWebhook`, `deliveries` | Mixed | Authed |
| **ai** | `getSettings`, `saveSettings`, `deleteSettings`, `testConnection`, `getModels` | Mixed | Authed |
| **uploads** | `available`, `presign`, `fileUrl` | Mixed | Authed |

</details>

---

## 7. REST API v1

Аутентификация через `Authorization: Bearer plk_...`. Rate limit: 120 req/min.

```
GET    /api/v1/openapi.json          — OpenAPI 3.0.3 спецификация
GET    /api/v1/listings               — Поиск листингов (q, city, state, propertyType, price range, sort, limit, offset)
GET    /api/v1/listings/:id           — Листинг по ID
POST   /api/v1/listings               — Создать листинг
PATCH  /api/v1/listings/:id           — Обновить листинг
DELETE /api/v1/listings/:id           — Удалить листинг
GET    /api/v1/offers?box=sent|received — Оферы
POST   /api/v1/offers                 — Отправить офер
GET    /api/v1/deals                  — Список сделок
GET    /api/v1/foreclosures           — Поиск foreclosure-записей
```

---

## 8. MCP-сервер (16 инструментов)

Streamable HTTP JSON-RPC 2.0 на `/mcp`. Для интеграции с Claude Code, Kimi Code, Codex.

| Инструмент | Описание |
|---|---|
| `proplink_search_listings` | Поиск по каталогу (текст, город, цена, beds) |
| `proplink_get_listing` | Детали листинга по ID |
| `proplink_list_my_listings` | Мои листинги |
| `proplink_create_listing` | Создать листинг |
| `proplink_update_listing` | Обновить листинг |
| `proplink_delete_listing` | Удалить листинг |
| `proplink_make_offer` | Отправить офер |
| `proplink_list_offers` | Список оферов |
| `proplink_respond_offer` | Ответить на офер |
| `proplink_list_deals` | Список сделок |
| `proplink_get_deal` | Детали Deal Room |
| `proplink_list_conversations` | Список чатов |
| `proplink_send_message` | Отправить сообщение |
| `proplink_search_foreclosures` | Поиск foreclosure |
| `proplink_get_profile` | Мой профиль |
| `proplink_update_profile` | Обновить профиль |

---

## 9. Фронтенд (13 страниц)

| Страница | Route | Описание |
|---|---|---|
| Home | `/` | Лендинг: hero search, фичи, featured listings, ролевая матрица |
| Login | `/login` | Email/password + Kimi OAuth, режим register/login |
| Onboarding | `/onboarding` | Wizard: роль, компания, лицензия, рынки, bio |
| Listings | `/listings` | Каталог: карта Leaflet, фильтры, grid/map toggle, saved search |
| ListingDetail | `/listings/:id` | Карточка: фото карусель, BatchData, Make Offer, Message Agent |
| NewListing | `/listings/new` | Форма: ручной ввод + **Zillow Import** по адресу |
| Dashboard | `/dashboard` | Панель: листинги, оферы, сделки, импорты, AI Bot, Channels, API Keys, Webhooks, Verification |
| DealRoom | `/deals/:id` | Сделка: timeline, задачи, документы, чат |
| Messages | `/messages` | Омниканальный инбокс: 5 каналов, группы, перевод, задачи, заметки |
| Import | `/import` | Bulk import: drag&drop CSV/JSON, preview, валидация |
| Distressed | `/distressed` | Foreclosure hub: поиск, статистика, коннекторы |
| Developers | `/developers` | API docs: REST, MCP, ключи, rate limits |
| NotFound | `*` | 404 |

---

## 10. Архитектурные решения

- **Shadow users**: внешний контакт из FB/WhatsApp/Telegram — это синтетический `users` row (`unionId = ext:{channel}:{externalId}`), поэтому вся логика чатов/перевода/уведомлений работает без ветвлений.
- **Lazy translation**: перевод делается при чтении, кэшируется в `messages.translations` (JSON: `{"ru": "..."}`) — за одно сообщение юзер никогда не платит дважды.
- **Шифрование секретов**: токены каналов и AI-ключи хранятся в AES-256-GCM (`api/channels/crypto.ts`, ключ из `APP_SECRET`).
- **FK constraints**: полные FK с cascade delete на всех 23 таблицах (миграция `0010_lazy_thunderbolts`).
- **Composite indexes**: `listings_status_city_price_idx`, `msg_conv_created_idx` — для быстрого поиска и пагинации.
- **Миграции**: `npm run db:generate` + ручное применение SQL (db:push интерактивен и зависает — не использовать).

---

## 11. Запланировано (ждёт разрешений / креденшелов)

| Фича | Что блокирует |
|---|---|
| Production FB/IG messaging | **Meta App Review** (разрешение `pages_messaging`) |
| WhatsApp production | Верификация бизнеса в Meta + template-сообщения вне 24h окна |
| X (Twitter) DM — приём | Платный тариф X API (Basic+, от $200/мес) |
| Google OAuth | Нужны Google Cloud credentials (сейчас Kimi OAuth + email) |
| Email-уведомления | Аккаунт Resend/Postmark |
| Promoted listings / монетизация | Stripe аккаунт |
| WebSocket/SSE realtime | Замена polling 3 сек в мессенджере |
| Мобильные приложения | API готов (REST + MCP); обёртка React Native / Capacitor |
| CI/CD | GitHub Actions (пока нет) |

---

## 12. Инфраструктура: free tier → production

| Сервис | Free tier | Масштабирование |
|---|---|---|
| **Compute: Render** (Docker) | Бесплатный инстанс | $7 Starter → autoscaling |
| **DB: TiDB Cloud Serverless** | 25 ГБ + 250M RU/мес | Dedicated tier, connection string не меняется |
| **Storage: Cloudflare R2** | 10 ГБ, **$0 egress** | Pay-per-GB (~$0.015/ГБ), S3-compatible |
| **CDN/DNS/WAF: Cloudflare** | Free plan | Pro $20 при необходимости |
| **Redis: Upstash** (когда нужен) | 10k команд/день | Rate limiting, очереди, кэш |
| **Email: Resend** | 100 писем/день | $20/мес за 50k |

**Бюджет:** MVP — **$0** · ранняя production — **~$10–15/мес** · рост — $30–100/мес.

---

## 13. Быстрый старт

```bash
cd app
cp .env.example .env           # заполнить DATABASE_URL, APP_ID, APP_SECRET
npm install
npm run db:generate            # после изменений db/schema.ts → SQL миграции
# применить SQL вручную (db:push НЕ использовать)
npm run dev                    # http://localhost:3000 (HMR + backend)
npm run check                  # type-check
npm run build && npm start     # production build :3000
```

**Docker:**
```bash
cd app
docker build -t proplink .
docker run -p 3000:3000 --env-file .env proplink
```

**Тестовые аккаунты (20 инвесторов + 10 профессионалов):**

Все аккаунты зарегистрированы на `@testdomain.local`. 10 инвесторов имеют по 2 реальных листинга (Palm Coast, FL — данные с Zillow). 10 профессионалов (buyer, private_lender, hard_money_lender, transaction_coordinator, gator_lender, contractor, title_company, attorney, deal_participant) — без листингов.

Полный список учётных записей: `TestZ/UsersData.md`.

**Env-переменные:**
```
DATABASE_URL              — MySQL/TiDB (обязательна)
APP_ID / APP_SECRET       — Kimi OAuth + ключ шифрования
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL
ZILLOW_RAPIDAPI_KEY       — ключ для Zillow Import (RapidAPI)
```

---

## 14. История изменений

| Коммит | Описание |
|---|---|
| `a2e33b4` | Initial commit — полная платформа: каталог, оферы, deal rooms, мессенджер, omnichannel, BYOK AI, foreclosures, REST API, MCP, SEO |
| `b06d947` | Zillow integration (import по адресу + seed 20 объектов), QA Playwright E2E тесты, миграция 0010 (FK constraints, composite indexes, UNIQUE email), security hardening (XSS, rate limiting, input sanitization), удаление title из схемы, cleanup mock данных |

---

*PropLink — communication layer для US real estate. Каталог привлекает, офер вовлекает, deal room удерживает, omnichannel + перевод стирают границы.*
