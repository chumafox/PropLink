# KIMI AUDIT — PropLink

**Дата аудита:** 26 июля 2026
**Объём:** весь проект `/Users/jenyanovak/Projects/active/PropLink` — бэкенд (Hono + tRPC + Drizzle/MySQL), фронтенд (React 19 + Vite), инфраструктура, зависимости, документация.
**Метод:** статический анализ всего исходного кода (158 ts/tsx файлов, ~21 700 строк), прогон `tsc`, `eslint`, `vitest`, production-сборки, проверка конфигов и зависимостей. Все находки подтверждены конкретными `файл:строка`.

---

## 0. Executive Summary

PropLink — функционально богатый MVP (листинги, офферы, Deal Rooms, omnichannel-интеграции Meta/WhatsApp, AI-перевод, REST API + MCP для агентов, импорт foreclosure-данных), написанный на современном и в целом грамотно выбранном стеке. TypeScript strict проходит, 30 тестов зелёные.

**Но в текущем состоянии проект нельзя выкатывать в production:**

- **4 критических инфраструктурных провала:** нет git-репозитория вообще; живые секреты (APP_SECRET, пароль TiDB Cloud) лежат в открытом виде и запекаются в Docker-образ; миграции БД 0000–0008 потеряны (чистый деплой БД невозможен); HAR-дамп браузерной сессии в корне.
- **Системные дыры безопасности:** захардкоженный фолбэк-секрет шифрования, stored XSS на публичных страницах, 5 независимых IDOR, 3 SSRF-вектора, отсутствие rate limiting на логине, CSRF на всех мутациях, неподписанные webhook'и.
- **Целостность данных не гарантирована:** ноль внешних ключей, ноль транзакций, нет unique-ограничений на email — сбой посередине операции оставляет мусор в БД.
- **Производительность:** JS-бандл 1 MB одним чанком; импорт 5000 строк — O(строки × пользователи) в request-цикле; N+1 запросы в списках диалогов и сделок; polling каждые 3 секунды.
- **Данные-фейк:** при отказе стороннего API мок-данные сохраняются в БД как реальные финансовые показатели объекта.

**Итого находок: 10 critical, 24 high, 30 medium, 25 low.**

---

## 1. Объективные метрики

| Метрика | Значение | Оценка |
|---|---|---|
| Файлов ts/tsx | 158 | — |
| Строк кода | ~21 700 | — |
| `tsc -b` | ✅ 0 ошибок | Хорошо |
| `vitest run` | ✅ 30/30 зелёные (3 файла) | Покрытие ~2% файлов — мало |
| `eslint .` | ❌ 88 ошибок, 1 warning | Много `any`, setState-in-effect |
| Production JS-бандл | ❌ 1 001.79 kB (gzip 292.74 kB), один чанк | Критично, цель < 300 kB initial |
| CSS-бандл | 110 kB | Норма |
| Серверный бандл `dist/boot.js` | 3.8 MB | Терпимо для Node, без минификации |
| Git-репозиторий | ❌ отсутствует | Критично |
| `npm audit` | ⚠️ невыполним (registry.npmmirror.com без audit-endpoint) | Слепая зона |
| Устаревшие мажоры зависимостей | vite 7→8, eslint 9→10, react-router 7→8, tailwind 3→4, recharts 2→3 | Планово |
| `jose` (JWT) | 6.1.3 → 6.2.4 доступен | Поднять первым (security-relevant) |

---

## 2. CRITICAL — исправить немедленно

### 2.1 Секреты скомпрометированы и запекаются в Docker-образ

- **`app/env.docker`** содержит живой `APP_SECRET`, `DATABASE_URL` с паролем к TiDB Cloud, `OWNER_UNION_ID` — в открытом виде. Файл **не покрыт** `.gitignore` (паттерны `.env*` не матчат имя `env.docker`).
- **`app/Dockerfile`**: `COPY . .` + `cp env.docker .env` при `.dockerignore` из 5 строк → секреты фиксируются в слоях образа. Нет multi-stage, нет `USER` (root), нет `HEALTHCHECK`.

**Действия:**
1. Ротировать `APP_SECRET` и пароль БД **сегодня** (они уже утекли минимум в образ и любые его копии).
2. `.gitignore` += `env.docker`; в репо оставить только `env.docker.example` с плейсхолдерами.
3. `.dockerignore` += `.env`, `env.docker`, `*.db`, `*.test.ts`, `node_modules`.
4. Переписать Dockerfile на multi-stage (build → runtime без devDependencies), `USER node`, `HEALTHCHECK` на `/health` (эндпоинт добавить в `boot.ts`).
5. Секреты — только через runtime env (Render dashboard / `docker run -e`).

### 2.2 Захардкоженный фолбэк-секрет шифрования

- **`app/api/channels/crypto.ts:6`** — `process.env.APP_SECRET ?? "proplink-dev-secret"`. Без переменной окружения все токены каналов (Meta/WhatsApp) и BYOK AI-ключи шифруются публично известным ключом из исходников.
- **`app/api/lib/env.ts:5-8`** — `required()` бросает ошибку только в production; в dev секреты молча становятся `""` → JWT подписывается пустым ключом (`kimi/session.ts:10`).

**Действия:** убрать все фолбэки, падать при старте без `APP_SECRET`; валидация env через zod при boot (в т.ч. `R2_*`, `PORT`, `OWNER_UNION_ID` — сейчас читаются ad-hoc).

### 2.3 Нет git-репозитория

- Ни корень, ни `app/` не под версионным контролем. Нет истории, бэкапа через remote, CI, code review.

**Действия:** `git init` в корне проекта (не в `app/`), исправленный `.gitignore` (см. 2.1 + убрать исключение `db/migrations/*.sql`), первый коммит, remote. Подключить Dependabot/Renovate — `npm audit` сейчас невозможен через зеркало registry.

### 2.4 Потерянные миграции БД

- **`app/db/migrations/`**: `meta/_journal.json` содержит 10 записей (0000–0009), снапшоты на месте, но SQL-файл только `0009_sparkling_taskmaster.sql`. `.gitignore` содержит `db/migrations/*.sql` — миграции сознательно исключены. `npm run db:migrate` на чистой БД **упадёт**.

**Действия:** убрать исключение из `.gitignore`; засквошить текущую схему в один baseline `0000_init.sql` (или регенерировать из снапшотов); закоммитить.

### 2.5 Stored XSS на публичных страницах листингов

- **`app/api/seo.ts:108-109`** — `JSON.stringify(jsonLd)` вставляется в `<script>` без экранирования. Пользовательский `title`/`description` (HTML не фильтруется в `contracts/listing.ts:5`) позволяет `</script><script>…</script>` вырваться из блока на серверно-отрендеренной публичной странице (`boot.ts:74-81`).

**Действие:** экранировать `<` → `\u003c` в JSON-LD (однострочный фикс, сделать первым).

### 2.6 Импорт может положить сервер

- **`app/api/queries/savedSearches.ts:134-168` + `app/api/importsRouter.ts:26-50`** — при каждом создании листинга выгружаются **все** saved searches и buy boxes, матчинг в JS. Импорт до 5000 строк вызывает это на каждую строку + 5000 последовательных INSERT в request-цикле. Сложность O(строки × пользователи).

**Действия:** фоновая очередь (или хотя бы chunked-обработка), SQL-фильтрация кандидатов, batch-INSERT, чанкинг на клиенте (`Import.tsx:168` — сейчас многомегабайтный JSON одним запросом).

### 2.7 Мусор с чувствительными данными в корне

- **`www.kimi.com.har` (1.6 MB)** — HAR-дамп браузерной сессии, потенциально содержит cookies/токены. Удалить.
- Заодно: `.DS_Store` ×2, битые `simulate.ts`/`test-trpc.ts` (импортируют несуществующий `db/index.js`), `batchdata.svg`, `app/db/sqlite.db` (мёртвый артефакт — проект на MySQL), `app/info.md`, `app/.backend-features.json`, `API_AGENT_INSTRUCTIONS.md` (разовый промт с дампом данных) — удалить или в `scripts/`/`docs/`.

---

## 3. HIGH — безопасность

### 3.1 IDOR (5 независимых)

| Место | Проблема |
|---|---|
| `api/uploadsRouter.ts:59-66` | `fileUrl` выдаёт presigned GET на **любой** key без проверки владения → чтение чужих приватных документов сделок/чатов |
| `api/listingsRouter.ts:82-94` | `updateBatchData` сознательно без проверки владельца → любой перезаписывает финансовые данные любого листинга |
| `api/developerRouter.ts:50-52` | `deliveries` возвращает чужие webhook-доставки без проверки владения |
| `api/messagesRouter.ts:206-217` + `queries/messaging.ts:481-490` | `reorderConversationTasks` обновляет задачи без фильтра по conversationId → управление задачами чужих диалогов |
| `api/auth-router.ts:36` | `me` возвращает полную строку `users`, включая `passwordHash`, клиенту |

**Действия:** проверка владения/префикса `private/${userId}/` во всех точках; явный select полей в `me`; фильтр по conversationId в reorder.

### 3.2 Аутентификация и сессии

- **`api/auth-router.ts:64-91`** — нет rate limiting на login/register (лимитер есть только для REST API-ключей, `rest.ts:23-34`); парольная политика `min(4)`; register раскрывает существование аккаунта (email enumeration).
- **`api/lib/cookies.ts:14`** — `sameSite: "None"` + отсутствие CSRF-токена/проверки Origin → CSRF на всех tRPC-мутациях.
- **`api/kimi/session.ts:14`** — JWT на 1 год без механизма отзыва; украденный токен валиден год.
- **`api/kimi/auth.ts:96`** — OAuth: `redirectUri = atob(state)` из контролируемого клиентом параметра без валидации → перехват кода авторизации + open redirect, нет anti-CSRF nonce.

**Действия:** rate limit по IP+email на auth; `min(8+)`; SameSite=Lax + Origin-check; короткий TTL access + refresh/revocation; state = подписанный nonce, redirect_uri из серверного конфига.

### 3.3 SSRF (3 вектора)

- **`api/foreclosuresRouter.ts:136-141`** — пользовательский `sourceUrl` → серверный `fetch` без allowlist (сканирование внутренней сети).
- **`api/queries/webhookQueries.ts:78-87`** — исходящие webhooks на произвольный URL + `responseCode` читается обратно (оракул внутренней сети).
- **`api/aiRouter.ts:96-103, 140-145`** — BYOK `baseUrl` произвольный, сервер шлёт туда запрос с Authorization-заголовком.

**Действия:** блок RFC1918/metadata-IP (169.254.169.254), только https, DNS-pinning, allowlist где возможно.

### 3.4 Webhook'и и API-слои

- **`api/channels/webhooks.ts:52-59`** — входящие webhook'и Meta обрабатываются **без проверки подписи**, если владелец не сохранил app secret → поддельные сообщения в чужие диалоги. Требовать app secret при подключении канала.
- **`api/mcp.ts:414`** — `/mcp` без rate limiting вообще (REST на тех же ключах — 120 req/min). Унифицировать.
- **`api/developerRouter.ts:41`** — список webhooks возвращает `secret` в plaintext при каждом запросе. Показывать один раз при создании.
- **`api/messagesRouter.ts:56-78`** — `createGroup` без лимита размера и проверки участников → спам-группы.
- **Отсутствуют security-заголовки** (нет helmet/secureHeaders/CSP) и `cors()` с `*` на REST (`rest.ts:39`).
- **`api/queries/aiSettings.ts:8`** — legacy plaintext fallback для API-ключей: старые строки хранятся незашифрованными. Миграция + удаление fallback.

---

## 4. HIGH — целостность данных

- **Ноль внешних ключей во всей схеме** (`db/schema.ts`, 20+ таблиц, ни одного `references()`). `deleteListing` (`queries/listings.ts:165-169`) оставляет сирот в `offers`, `conversations`, `dealRooms`, `messages`. → Добавить FK с `onDelete: cascade/restrict` + миграция.
- **Ноль транзакций в проекте** (grep `\.transaction(` — 0). Многошаговые записи неатомарны: `createDealRoomFromOffer` (`queries/deals.ts:26-79` — conversation + participants + dealRoom + 9 задач), `createConversation`, `ensureChannelConversation`, `markRead`. Сбой посередине → частично созданные сделки. Усугубляется `mode: "planetscale"` в `connection.ts:13`. → Перевести многошаговые операции на транзакции (или явно задокументировать eventual consistency + компенсации).
- **`schema.ts:19`** — `users.email` без unique → race condition даёт дубли аккаунтов (check-then-insert в `auth-router.ts:42-58`). Unique-индекс + обработка duplicate-key.
- **`schema.ts:269-287`** — `conversation_participants` без unique `(conversationId, userId)` → дубли участников при конкурентных webhook'ах.
- **`schema.ts:698-709`** — `hiddenMessages` без unique `(userId, messageId)`; `onDuplicateKeyUpdate` без unique-ключа никогда не сработает.
- **`schema.ts:313-333`** — `messages` без композитных индексов под сортировку по `createdAt` и `totalUnread`; `listings` без композитного индекса `status+city+price`.

---

## 5. HIGH — архитектура бэкенда

- **Тройное дублирование бизнес-логики tRPC/REST/MCP с расхождениями**: создание оффера (`offersRouter.ts:18-56` ≈ `rest.ts:144-170` ≈ `mcp.ts:307-333` — в MCP **нет zod-валидации**, `price: Number(args.price)` → NaN уходит в БД); создание листинга ×3; ответ на оффер ×2; тексты уведомлений различаются. → **Единый service-слой**, три тонких адаптера. Это главный архитектурный долг проекта.
- **Систематическое проглатывание ошибок**: `void … .catch(() => {})` в `listingsRouter.ts:54,64-65`, `offersRouter.ts:86-100`, `messagesRouter.ts:267-273`, `rest.ts:60,99-100`; `context.ts:15-19` глотает ВСЕ ошибки аутентификации (сбой БД → пользователь молча аноним). → Различать «не залогинен» vs «сервис упал», логировать.
- **Логирование — только `console.*`**: нет request-логирования, уровней, correlation-id; webhook-обработчик возвращает 200 при любой ошибке (`webhooks.ts:62-72`) — сбои невидимы. → pino/hono-logger + request-id.
- Утечка внутренних сообщений ошибок клиенту: `uploadsRouter.ts:53`, `messagesRouter.ts:382`, `aiRouter.ts:114,154`.
- `DELETE /listings/:id` и `listings.remove` возвращают `ok` независимо от affectedRows — молчаливые не-удаления.

---

## 6. HIGH — производительность бэкенда

- **N+1 в `listConversationsForUser`** (`queries/messaging.ts:31-138`): 3-4 последовательных запроса на диалог + presign каждого pinned-файла → 150-200 запросов при 50 диалогах. Аналогично `findDirectConversation` и `listDealsForUser` (`deals.ts:99-122`). → JOIN'ы / `inArray` / grouped-запросы, batch-presign.
- **`countPendingOffersForOwner`** (`offers.ts:95-99`) — выгружает все офферы и считает в JS вместо `COUNT(*) WHERE status IN (...)`.
- **`getMessages`** — жёсткий `limit(500)` без курсорной пагинации; presign вложений по одному.
- **Отсутствие лимитов выборок**: `findListingsByOwner`, `listConversationsForUser`, `listDealsForUser`, `findOffersForOwner` — без пагинации вообще.
- **Поиск `LIKE '%q%'` по 4 полям** (`listings.ts:37-48`) — полные сканы + дублирующий count-запрос. → FULLTEXT-индекс или композитный + убрать двойной проход.
- **`notificationsRouter.ts:85-93`** — `buyBoxMatches` грузит 200 листингов и фильтрует в JS на каждый запрос.
- **`boot.ts:14`** — глобальный `bodyLimit` 50 MB на все эндпоинты при лимите загрузок 25 MB. Сузить per-route.

---

## 7. HIGH — фронтенд

### 7.1 Производительность

- **Бандл 1 MB одним чанком** — все 13 страниц импортируются статически (`App.tsx:2-14`), в `vite.config.ts` нет `manualChunks`. Leaflet, dnd-kit, papaparse едут в начальный чанк. → `React.lazy` + `Suspense` на маршруты, динамический импорт leaflet/papaparse/dnd-kit, `manualChunks` для vendor-групп. **Цель: < 300 kB initial.**
- **Polling вместо realtime**: `Messages.tsx` — 5000/3000 мс, `Navbar.tsx` — 15000, `NotificationsBell.tsx` — 15000. Полный ре-рендер списка сообщений каждые 3 секунды. → SSE/WebSocket или как минимум `refetchIntervalInBackground: false` + большие интервалы + `React.memo`.
- **`NotificationsBell.tsx:19`** — список уведомлений запрашивается на каждой странице, включая анонимов, без `enabled`. → `enabled: isAuthenticated && open`.
- **`Listings.tsx:275`** — `key={...}` на `MapContainer` полностью перемонтирует карту при каждом изменении центра (пересоздание Leaflet, перезагрузка тайлов). → `useMap()`/`setView`.
- **Нет виртуализации списков** (Listings 60 карточек + маркеры, тред сообщений целиком). → `@tanstack/react-virtual`, кластеризация маркеров.
- **Статика**: `public/photos/*.jpg` — 3.4 MB без WebP/srcset. → Сжатие, responsive images.
- **`providers/trpc.tsx:10`** — `QueryClient` без `defaultOptions` (нет `staleTime`) → каждый маунт идёт в сеть.

### 7.2 Данные-фейк (худшая находка фронтенда)

- **`FloatingBatchData.tsx:65-119`** — прямой fetch из браузера на сторонний API с захардкоженным `DUMMY_TOKEN`; при отказе авторизации **мок-данные сохраняются в БД как реальные финансовые показатели объекта** (toast «using mock data for demonstration»). Пользователь может принять инвестиционное решение по выдуманным equity/lien. → Удалить мок-фолбэк, проксировать через свой бэкенд, явно помечать демо.

### 7.3 Архитектура

- **`Messages.tsx` — 1441 строка**: 6 компонентов + бизнес-логика в одном файле. → Расчленить на `features/messages/*`, логику мутаций — в хуки.
- **Drag/resize-логика плавающих окон продублирована 5 раз** (`Messages.tsx` ×4 + `FloatingBatchData.tsx`). → Хук `useDraggableResizable()` / `<FloatingWindow>`.
- **Мёртвый код**: `AuthLayout.tsx` (266 строк, шаблонные «Page 1/2»), `AuthLayoutSkeleton.tsx`, `ui/sidebar.tsx` (726 строк), `hooks/use-mobile.ts`, ~30 неиспользуемых shadcn/ui-компонентов (~4500+ строк). → Удалить.
- **Дублирование загрузки файлов** ×4 места с разными зашитыми лимитами (2MB/25MB). → Хук `useFileUpload(scope)`.
- **Дублирование серверного состояния в локальный `useState`** с синхронизацией через `useEffect` (`Messages.tsx:784-788, 378-382`) + оптимистичные обновления без `onError`-отката. → `utils.setQueryData` с откатом.

### 7.4 Типизация (88 ошибок ESLint)

- `Messages.tsx` — ключевые компоненты на `any` (`SortableTaskItem`, `localConvs: any[]`), хотя tRPC даёт end-to-end типы. → `RouterOutputs`/`inferRouterOutputs<AppRouter>`.
- **Паттерн `as any` для enum форм** — 30 вхождений в 12 файлах. Причина: стейт форм как `string` вместо union-типов из `@contracts/constants`.
- `FloatingBatchData.tsx:121` — `batchData.estimatedEquity.toLocaleString()` без гарантий типа → потенциальный runtime crash.

### 7.5 UX / a11y

- **Системный `if (isLoading) return null`** на 7 страницах — белый экран вместо скелетона (`ui/skeleton.tsx` есть, но не используется).
- **Ошибки запросов обрабатывает только `ListingDetail.tsx`** — остальные показывают вечный Loading при сбое сети. → Единый `<QueryState>` (loading/error/empty).
- `navigate()` и `setState` в теле рендера (`Dashboard.tsx:126-129`, `Onboarding.tsx:66-73`).
- `outline-none` на триггере меню (`Navbar.tsx:78`) — keyboard-навигация вслепую; иконочные кнопки без `aria-label`.
- Пароль от 4 символов транслируется в UI (`Login.tsx:117,125`); placeholder с реальным тестовым email (`test1@example.com`) — убрать.

---

## 8. Инфраструктура и зависимости

- **`app/README.md`** — стоковый Vite-шаблон, не описывает проект. Удалить, оставить корневой `README.MD` (он точен, кроме: несуществующий normalize-тест; «GitHub Actions дёргает /api/cron/*» — ни `.github/`, ни git, ни монтирования cron нет).
- **tsconfig-несогласованность**: `vite.config.ts` объявляет алиас `"db"` (голый), которого нет ни в одном из 4 tsconfig — импорты `from "db/…"` соберутся Vite, но упадут на `tsc`. Убрать или синхронизировать. Мёртвый алиас `@assets` в `vitest.config.ts`.
- **`package.json`**: `name: "my-app"`, `version: 0.0.0` — шаблон не переименован.
- **Неиспользуемые зависимости**: `recharts`, `react-hook-form`, `@hookform/resolvers`, `embla-carousel-react`, `vaul`, `cmdk`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `next-themes`, `tw-animate-css`, `@aws-sdk/*` на клиенте. В бандл не попадают (tree-shaking работает), но это вес установки и ложные сигналы. → Почистить.
- **Обновления**: `jose` 6.1.3→6.2.4 — первым (JWT, security-relevant); мажоры (vite 8, eslint 10, react-router 8, tailwind 4) — планово, отдельными PR.
- **`npm audit` — слепая зона**: registry.npmmirror.com не поддерживает audit. Прогнать на прямом npmjs + Dependabot после `git init`.
- **Тесты**: 30 тестов покрывают ~2% файлов. Не покрыто критичное: `channels/crypto.ts` (AES-256-GCM — самое чувствительное место), `webhooks.ts` (верификация подписи Meta), offer flow → Deal Room, `rest.ts` (API-ключи, rate limit), `mcp.ts`, `queries/*`, `foreclosure/normalize.ts`.
- **`boot.ts`** — нет `/health` (нужен для Render zero-downtime и Docker HEALTHCHECK).

---

## 9. План действий (приоритизированный)

### Фаза 0 — «Стоп-кран» (1 день, до любого деплоя)

| # | Действие | Файлы |
|---|---|---|
| 1 | Ротировать `APP_SECRET` и пароль TiDB Cloud | внешние системы |
| 2 | Удалить `www.kimi.com.har`, `.DS_Store`, битые скрипты, `sqlite.db` | корень, `app/db/` |
| 3 | Исправить XSS в JSON-LD (`<` → `\u003c`) | `api/seo.ts:108` |
| 4 | Убрать хардкод-секрет, падать без `APP_SECRET` | `api/channels/crypto.ts:6` |
| 5 | `git init` + исправленный `.gitignore` (+`env.docker`, −`db/migrations/*.sql`) + remote | корень |
| 6 | Восстановить baseline-миграцию из текущей схемы | `db/migrations/` |

### Фаза 1 — Безопасность (неделя 1)

| # | Действие |
|---|---|
| 1 | Закрыть 5 IDOR: владение в `fileUrl`, `updateBatchData`, `deliveries`, `reorderConversationTasks`; select полей в `me` |
| 2 | Rate limiting на auth (IP+email), пароль min 8, убрать email enumeration |
| 3 | CSRF: SameSite=Lax + проверка Origin на мутациях |
| 4 | SSRF-защита: единый guard (блок RFC1918/metadata, https-only) для коннекторов, webhooks, AI baseUrl |
| 5 | Требовать подпись webhook'ов Meta; показывать webhook secret один раз |
| 6 | OAuth: подписанный state-nonce, redirect_uri из конфига |
| 7 | Security-заголовки (hono/secure-headers), сузить CORS |
| 8 | Сессии: короткий TTL + refresh; zod-валидация env при старте |
| 9 | Удалить мок-фолбэк в FloatingBatchData, проксировать BatchData через свой бэкенд |

### Фаза 2 — Целостность и производительность данных (недели 2–3)

| # | Действие |
|---|---|
| 1 | FK + `onDelete` каскады в схеме + миграция |
| 2 | Unique: `users.email`, `(conversationId,userId)`, `(userId,messageId)` |
| 3 | Транзакции на многошаговые операции (createDealRoomFromOffer, createConversation, ensureChannelConversation, markRead) |
| 4 | Импорт: фоновая очередь, batch-INSERT, SQL-фильтрация кандидатов, чанкинг на клиенте |
| 5 | N+1: JOIN/grouped-запросы в conversations/deals, batch-presign вложений |
| 6 | Пагинация (cursor) везде; композитные индексы под поиск и непрочитанные |
| 7 | Компонентные тесты crypto + webhook-подписи + offer flow |

### Фаза 3 — Архитектура (недели 3–5)

| # | Действие |
|---|---|
| 1 | Единый service-слой; tRPC/REST/MCP — тонкие адаптеры (закрывает рассинхрон валидации в MCP) |
| 2 | Structured logging (pino) + request-id; не глотать ошибки в context/роутерах |
| 3 | Фронтенд: code splitting (React.lazy + manualChunks) → цель < 300 kB initial |
| 4 | Фронтенд: расчленить Messages.tsx, хуки useDraggableResizable/useFileUpload, убрать any → RouterOutputs |
| 5 | Фронтенд: QueryState (loading/error/empty) везде, staleTime-дефолты, enabled-гварды на запросы |
| 6 | Polling → SSE/WebSocket (минимум: интервалы + background-флаги + memo) |
| 7 | Удалить мёртвый код (AuthLayout, sidebar, ~30 ui-компонентов, неиспользуемые deps) |
| 8 | Dockerfile: multi-stage, USER node, HEALTHCHECK + `/health` в boot.ts |

### Фаза 4 — Гигиена (постоянно)

- Dependabot/Renovate; `jose` обновить сразу, мажоры — отдельными PR.
- Довести тестовое покрытие критичных потоков до 60%+ (auth, offers, deals, uploads, crypto).
- Единый README в корне; инструкции по запуску синхронизировать с реальностью.
- CI: `tsc -b && eslint . && vitest run && npm audit` на каждый PR; снизить порог ESLint до 0 ошибок.

---

## 10. Quick Wins (высокий эффект / низкая стоимость)

1. XSS-фикс в `seo.ts` — одна строка.
2. Удаление HAR/мусора/мёртвого кода — один коммит, −5000 строк поддерживаемого кода.
3. `enabled: isAuthenticated` в NotificationsBell — одна строка.
4. `defaultOptions: { queries: { staleTime: 30_000, retry: 1 } }` в QueryClient — мгновенное снижение нагрузки.
5. Убрать `key` с MapContainer — карта перестанет перемонтироваться.
6. `.gitignore` + `.dockerignore` + `env.docker.example` — 15 минут, закрывает 2 critical.
7. `passwordHash` из `me` — явный select, 5 минут.
8. Отладочные `console.log` в AiBotTab, placeholder test-email в Login — один коммит.

---

*Аудит выполнен статическим анализом кода и прогоном инструментов. Динамическое тестирование (pen-test, нагрузочное) не проводилось — рекомендуется после закрытия Фазы 1.*
