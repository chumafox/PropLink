# PropLink

> Платформа недвижимости США (класс Zillow / Redfin / Realtor) с фокусом на **тотальное стирание границ в коммуникации** между всеми участниками сделки: покупатели, продавцы, инвесторы, агенты, кредиторы, тайтл-компании, адвокаты, контракторы — в одном инбоксе, на любом языке, из любого мессенджера.

---

## 1. Для чего этот проект

**Проблема:** в US real estate невозможно быстро и структурированно связаться с агентом и показать ему свой офер. Коммуникация размазана по email, SMS, FB Messenger, WhatsApp; участники говорят на разных языках; документы сделки теряются.

**Решение PropLink:**
- **Structured Offer Flow** — офер как структурированный объект (цена, earnest money, financing, contingencies, proof of funds), а не письмо в почту. Агент отвечает accept / decline / counter одной кнопкой.
- **Deal Room** — после принятия офера автоматически создаётся комната сделки: чеклист задач по ролям, версионированные документы, общий чат.
- **Omnichannel Inbox (как GHL CRM)** — сообщения из Facebook Page, Instagram DM, WhatsApp Business и X падают в единый мессенджер PropLink; ответ из PropLink уходит обратно в мессенджер клиента.
- **BYOK AI-переводчик** — каждый юзер читает все сообщения на своём языке, используя СВОЙ API-ключ (OpenAI / Anthropic / Kimi / DeepSeek / OpenRouter / локальные Ollama / LM Studio). Платформа не платит за токены.
- **Distressed & Foreclosure** — коннекторы к источникам каунти (lis pendens, NOD, auction, REO) с персональным добавлением источников.
- **API-first** — REST API v1, webhooks (HMAC), MCP-сервер для AI-агентов (Claude Code / Kimi Code / Codex).

**Вектор развития:** PropLink становится коммуникационным хабом сделки (transaction layer), а не просто каталогом листингов. Каталог — входная точка; ценность — в потоке офер → deal room → closing, к которому подключены все каналы и все роли.

---

## 2. Стек

| Слой | Технологии |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 3.4, shadcn/ui (40+ компонентов), react-router v7, Leaflet + OpenStreetMap, react-dropzone, papaparse |
| Backend | Hono (Node.js), tRPC 11 (end-to-end types, superjson), REST API v1 на том же Hono |
| DB | MySQL через Drizzle ORM — TiDB Cloud Serverless (`mode: "planetscale"`) |
| Auth | Kimi OAuth 2.0 + JWT-сессии (HS256, `APP_SECRET`); email/password (scrypt) для тестовых аккаунтов |
| AI | BYOK-перевод: OpenAI-compatible семейство + Anthropic Messages API |
| Storage | Cloudflare R2 (S3-compatible, presigned PUT/GET) — `@aws-sdk/client-s3` + presigner |
| Realtime | Polling 3 сек (MVP). WebSocket/SSE — в roadmap |
| Deploy | Docker (один контейнер: статика + API, порт 3000), превью на kimi.site |

---

## 3. Архитектура

```
┌─────────────────────────────── Docker (port 3000) ───────────────────────────────┐
│  React SPA (dist/public)  ← статика, отдаётся Hono                                │
│  Hono server:                                                                     │
│   • /api/trpc/*      — tRPC appRouter (все внутренние операции)                   │
│   • /api/v1/*        — REST API (Bearer plk_* ключи, rate limit 120 req/min)      │
│   • /mcp             — MCP-сервер (JSON-RPC 2.0, 16 инструментов для AI-агентов)  │
│   • /api/webhooks/channels/meta — webhooks Meta (FB/IG/WhatsApp в одном endpoint) │
│   • /sitemap.xml /robots.txt /llms.txt /feed.xml — SEO/GEO                        │
│   • /listings/:id    — server-side meta injection (OG + JSON-LD)                  │
└───────────────────────────────────────────────────────────────────────────────────┘
        │                │                    │                    │
   TiDB (MySQL)    Cloudflare R2       Meta Graph API        AI-провайдеры юзера
   20 таблиц       presigned URLs      (FB/IG/WhatsApp)     (BYOK, OpenAI-совм.)
```

**Структура репозитория:**
```
api/            — сервер: boot.ts, router.ts, *Router.ts, queries/ (Drizzle), 
                  channels/ (Meta/X + crypto), ai/ (BYOK перевод), 
                  foreclosure/ (коннекторы + нормализация), rest.ts, mcp.ts, seo.ts, geo.ts
src/            — React SPA: pages/, components/, hooks/, lib/
db/             — schema.ts (единая схема Drizzle) + migrations/
contracts/      — типы и константы, общие для фронта и бэка (роли, статусы)
Dockerfile      — node:20, npm ci → build → npm start
```

**Ключевые таблицы:** `users, profiles, listings, offers, imports, conversations, conversation_participants, messages, deal_rooms, deal_tasks, deal_documents, api_keys, webhooks, webhook_deliveries, foreclosure_records, county_connectors, saved_searches, notifications, buy_boxes, ai_settings, channel_connections`.

**Архитектурные решения, которые важно знать:**
- **Shadow users**: внешний контакт из FB/WhatsApp — это синтетический `users` row (`unionId = ext:{channel}:{externalId}`), поэтому вся логика чатов/перевода/уведомлений работает без ветвлений.
- **Lazy translation**: перевод делается при чтении, кэшируется в `messages.translations` (JSON: `{"ru": "..."}`) — за одно сообщение юзер никогда не платит дважды.
- **Шифрование секретов**: API-ключи юзеров (AI Bot) и токены каналов хранятся в AES-256-GCM (`api/channels/crypto.ts`, ключ из `APP_SECRET`).
- **Миграции**: `npm run db:generate` + ручное применение SQL (db:push интерактивен и зависает — не использовать).
- **FK-правило**: PK — `serial()` (bigint unsigned), поэтому FK-колонки — `bigint(..., { mode: "number", unsigned: true })`.

---

## 4. Реализованный функционал

### Каталог и сделки
- [x] Листинги: CRUD, фильтры, карта (Leaflet/OSM), фото (R2 upload или URL), 13 ролей юзеров
- [x] Offer Flow: структурированный офер → accept/decline/counter → авто-создание Deal Room
- [x] Deal Room: чеклист задач по ролям, версионированные документы (R2 private), статусы сделки
- [x] Дашборд: оферы входящие/исходящие, листинги, сделки, импорты, вкладки-URL (`/dashboard?tab=...`)
- [x] Импорт CSV/JSON (drag&drop, маппинг колонок, отчёт об ошибках)
- [x] Роли (13): buyer, investor, agent, title_company, private_lender, hard_money_lender, transaction_coordinator, attorney, gator_lender, **builder, fix_flip, contractor, deal_participant** (novation/JV)

### Коммуникация
- [x] Мессенджер: диалоги, вложения (R2 upload или URL), уведомления, unread-бейджи. Исправлены баги дублирования плавающих окон (Notes, Tasks) и гонки данных при создании новых диалогов (`activeConv` loading state).
- [x] **BYOK AI-переводчик**: 8 провайдеров (OpenAI, Anthropic, Kimi/Moonshot, DeepSeek, OpenRouter, Ollama, LM Studio, custom), 14 языков, автоперевод или по кнопке, «Show original», кэш в сообщении. Оптимизировано отображение статуса перевода для риалтайм обновлений.
- [x] **Omnichannel**: Facebook Messenger, Instagram DM, WhatsApp Business Cloud API — приём (webhook) и отправка (Graph API); X — отправка. Единый webhook `/api/webhooks/channels/meta`, verify-token, проверка подписи X-Hub-Signature-256
- [x] In-app уведомления (колокольчик, поллинг 15 сек). Добавлена очистка прочитанных уведомлений (иконка ластика) для поддержания чистоты инбокса.

### UI / UX Улучшения
- [x] Очистка навигации: удалены неиспользуемые вкладки из Navbar для фокуса на основных сценариях.
- [x] Advanced Mode в Dashboard: скрытие настроек API, Webhooks и AI Bot за переключателем-шестеренкой для чистоты интерфейса.
- [x] Интеграция BatchData: реализован плавающий UI в хедере чата (иконка BatchData). Подключен API-запрос к vac-scraper-api для получения финансовых данных по объекту (Est. Equity, Property Tax, Total Mortgage Balance, After Repair Value, Owner Name). Данные сохраняются в БД (`listings.batchData`) и перманентно отображаются в карточке чата.

### Данные и автоматизация
- [x] Distressed & Foreclosure (только в ЛК): записи по каунти, персональные коннекторы (JSON API — рабочий sync, HTML/PDF — зарегистрированы, нужны адаптеры)
- [x] Saved searches + алерты, Buy Box (инвесторский профиль с автоматчингом листингов)
- [x] Верификация лицензий агентов (админ-approve)
- [x] REST API v1: listings/offers/deals/foreclosures + OpenAPI spec, API-ключи `plk_*` (sha256)
- [x] Webhooks: HMAC-SHA256 подпись, лог доставок
- [x] **MCP-сервер**: 16 инструментов (search/create listings, offers, deals, messages, foreclosures, profile) — управление аккаунтом из Claude Code / Kimi Code / Codex
- [x] SEO: server-injected OG/Twitter/JSON-LD на листингах, sitemap.xml, RSS; GEO: robots.txt с AI-краулерами, llms.txt
- [x] Auth: Kimi OAuth + email/password без верификации (для тестовых аккаунтов)

---

## 5. Запланировано (ждёт разрешений / креденшелов)

| Фича | Что блокирует |
|---|---|
| Production FB/IG messaging | **Meta App Review** (разрешение `pages_messaging`) — подаётся владельцем Meta App |
| WhatsApp production | Верификация бизнеса в Meta + template-сообщения вне 24-часового окна |
| X (Twitter) DM — приём | Платный тариф X API (Basic+, от $200/мес) + Account Activity API |
| Google OAuth | Нужны Google Cloud credentials владельца (сейчас Kimi OAuth + email) |
| FB Groups | **Невозможно**: у Meta нет официального API чтения групп (ни у одного CRM) |
| Email-уведомления | Аккаунт Resend/Postmark (free tier 100 писем/день) |
| Promoted listings / монетизация | Stripe аккаунт |
| Mortgage & Equity раздел | Юридически ок (публичные записи каунти), нужен FCRA-дисплеймер + оценка баланса помечена как estimate |
| Шаблоны Deal Room | Код: чеклисты под Novation agreement и Fix & Flip проекты (роли уже есть) |
| Мобильные приложения | API готов (REST + MCP); обёртка React Native / Capacitor |

---

## 6. Инфраструктура: free tier → бесшовный production

**Принцип:** единственный артефакт — Docker-образ + строка MySQL + S3-креды. Каждый слой масштабируется независимо и без изменения кода.

| Сервис | Free tier | Путь масштабирования |
|---|---|---|
| **Compute: Render** (Docker web service) | Бесплатный инстанс (засыпает при простое) | $7 Starter → Standard autoscaling → тот же образ на Fly.io / AWS ECS Fargate |
| **DB: TiDB Cloud Serverless** | 25 ГБ + 250M RU/мес | Переключение на Dedicated в той же консоли, connection string не меняется; MySQL-совместимость = нет lock-in |
| **Storage: Cloudflare R2** | 10 ГБ/мес, **$0 за egress** | Pay-per-GB (~$0.015/ГБ), S3-совместимый API — код работает и с AWS S3 |
| **CDN/DNS/WAF: Cloudflare** | Free plan: DNS, кэш, SSL, DDoS-защита | Pro $20 при необходимости |
| **Cron: GitHub Actions** | 2000 мин/мес — дёргает `/api/cron/*` для sync коннекторов | Render Cron Jobs / отдельный worker |
| **Redis: Upstash** (когда понадобится) | 10k команд/день | Rate limiting, очереди ретраев вебхуков, кэш hot-листингов |
| **Email: Resend** | 100 писем/день | $20/мес за 50k |
| **Мониторинг: Sentry + UptimeRobot** | 5k событий/мес + 50 мониторов | Paid по росту |

**Бюджет:** MVP — **$0** · ранняя production — **~$10–15/мес** (Render Starter + домен) · рост — $30–100/мес по факту.

**Env-переменные (все в `.env` / env.docker):**
```
DATABASE_URL          — TiDB (обязательна)
APP_ID / APP_SECRET   — Kimi OAuth + ключ шифрования токенов
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL
                      — файловое хранилище (пусто = fallback на URL-вложения)
```

---

## 7. Рекомендации следующему разработчику (AI или human)

### Приоритет 1 — довести до production-ready
1. **Meta App Review** — пройти верификацию бизнеса и получить `pages_messaging` (единственный блокер для реального omnichannel).
2. **Настроить R2** (5 минут: bucket + API token + public URL) — включит реальные загрузки файлов; код уже готов и протестирован по контрактам.
3. **WebSocket/SSE вместо поллинга** в мессенджере (сейчас 3-сек polling — на 1000+ юзеров станет узким местом). Точка входа: `src/pages/Messages.tsx`, `api/messagesRouter.ts`.
4. **Upstash Redis** для rate-limit REST API (сейчас in-memory — не работает при >1 инстансе) и очереди ретраев webhook-доставок (`webhook_deliveries` уже логирует).

### Приоритет 2 — ценность продукта
5. **Шаблоны Deal Room под тип сделки**: Novation agreement (документы: novation agreement, addendum, investor disclosure) и Fix & Flip (scope of work, draw schedule, ARV tracker). Роли `deal_participant`, `fix_flip`, `contractor` уже в схеме.
6. **Реальные foreclosure-коннекторы**: интерфейс `CountyConnector` и авто-нормализация JSON API готовы (`api/foreclosure/`); HTML/PDF-источники требуют кастомных адаптеров — можно строить на curl_cffi-подобном подходе через отдельный scraping-worker (у владельца есть экспертиза).
7. **Email-уведомления** через Resend: новый офер, новое сообщение, матч saved search. Таблица `notifications` — источник событий.
8. **i18n интерфейса** (сейчас UI на английском, переводятся только сообщения): react-i18next, начать с EN/RU/ES.

### Приоритет 3 — качество
9. **Тесты**: Vitest для queries (паттерн уже есть в `api/foreclosure/normalize` test), Playwright для критических флоу (offer → deal room).
10. **Sentry** на фронт и бэк; структурированные логи вместо console.error.
11. **Code splitting** — бандл ~888 kB, разбить по роутам (React.lazy).
12. **Оптимистичные апдейты** в чате (сейчас invalidate после мутации).

### Что НЕ делать
- Не переезжать с MySQL/TiDB без причины — Drizzle-схема и `planetscale` mode уже решены.
- Не хранить файлы в БД или на диске контейнера (эфемерно) — только R2/S3.
- Не добавлять серверный рендеринг ради SEO — server-side meta injection уже закрывает краулеров.
- Не брать на платформу стоимость AI — BYOK-модель сознательная, она же фича (юзеры со своими подписками/локальными моделями).

---

## 8. Быстрый старт для разработчика

```bash
npm install
npm run db:generate          # после изменений db/schema.ts → SQL в db/migrations/
# применить SQL вручную (db:push НЕ использовать — зависает интерактивно)
npm run dev                  # http://localhost:3000 (HMR)
npm run check                # type-check (обязателен перед коммитом)
npm run build                # production build → dist/
npm start                    # production server :3000
```

**Тестовые аккаунты** (email auth, без верификации):
- `agent@test.dev` / `test1234` — агент
- `investor@test.dev` / `test1234` — инвестор (AI Bot: DeepSeek → русский, автоперевод)
- между ними есть диалог «Test chat EN ↔ RU» для проверки перевода

**Демо-данные:** 12 листингов (Austin/Phoenix/Tampa/Atlanta), foreclosure-записи (Maricopa AZ, Harris TX, Hillsborough FL), демо-сделка с Deal Room.

---

*PropLink — communication layer для US real estate. Каталог привлекает, офер вовлекает, deal room удерживает, omnichannel + перевод стирают границы.*
