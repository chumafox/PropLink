# K3 — Глубокий аудит PropLink

**Дата:** 2026-07-27
**Объект:** `/Users/jenyanovak/Projects/active/PropLink/app` (Hono + tRPC 11 + Drizzle/MySQL + React 19)
**Метод:** 4 параллельных аудита (backend/безопасность, слой данных, frontend, интеграции/инфра) + фактические прогоны `npm test` и `npm run check`.

---

## 0. Executive summary

Репозиторий находится в **некомпилируемом состоянии**: `npm run check` падает с **62 ошибками TypeScript** в 14 файлах. Часть ошибок — не косметика, а реальные сломанные фичи: accept офера не создаёт deal room (ошибка глотается молча), Telegram-канал не работает end-to-end, списки оферов/сделок/диалогов падают в рантайме из-за удалённой из схемы колонки `listings.title`. Сборка при этом проходит (esbuild не типизирует) — баги уезжают в прод незамеченными.

Тесты зелёные (30/30), но покрывают только zod-схемы, scrypt и константы uploads; один из тестов проверяет собственную копию regex'ов — **ложная зелень**. Критичный код (crypto, подписи webhook, SSRF-фильтр) тестами не покрыт.

Топ-5 действий:

1. Починить `tsc` (62 ошибки) и вернуть `listings.title` в схему (или удалить все обращения).
2. Закрыть SSRF в foreclosure-коннекторах (произвольный `sourceUrl` фетчится сервером без `checkUrlSSRF`).
3. Fail-closed подпись Meta webhook'ов (без appSecret сейчас принимаются поддельные сообщения).
4. Транзакционность accept-offer → deal room + guard по статусу офера.
5. Инфра-гигиена: `.env` в `.dockerignore`, `*.test.ts` из `.gitignore`, HEALTHCHECK без curl.

---

## 1. Состояние сборки и тестов

| Проверка | Результат |
|---|---|
| `npm test` (vitest) | **PASS** — 3 файла, 30 тестов (schemas 15, uploads 9, emailAuth 6) |
| `npm run check` (`tsc -b`) | **FAIL — 62 ошибки** |
| `npm run build` | проходит, но это ложное спокойствие: esbuild типы не проверяет |

Распределение ошибок `tsc`:
- `listings.title` удалён из `db/schema.ts:103-149`, но используется в 8 файлах (`queries/messaging.ts:100,111`, `offers.ts:21,37`, `deals.ts:57,98`, `savedSearches.ts:100,120,146,162`, `seo.ts:48`, `dealsRouter.ts:95`, `seed.ts`) — ~28 ошибок. При этом в снапшоте миграции `0010_snapshot.json` колонка есть → `db:generate` сейчас сгенерирует **деструктивный `DROP COLUMN title`**.
- `api/channels/telegram.ts` — 8 ошибок: сигнатуры `ensureShadowUser`/`ensureChannelConversation`/`ingestExternalMessage` не совпадают с `queries/channels.ts`.
- `api/queries/deals.ts:53,62` — 9 ошибок: `conversations`/`conversationParticipants` не импортированы.
- `api/lib/zillow.ts:1` — 6 ошибок: импорт несуществующего `../../env`.
- `api/foreclosure/adapters/` — 14 ошибок: DOM API (`document`, `HTMLElement`) в Node-контексте, несуществующие значения `VendorPlatform`.

---

## 2. Критичные находки

### 2.1. Бизнес-логика сломана

- **Accept офера не создаёт Deal Room.** `queries/deals.ts:53,62` — не импортированы таблицы → `createDealRoomFromOffer` падает с `ReferenceError`. Вызов в `offersRouter.ts:86` и `mcp.ts:353` обёрнут в `void ...catch(() => {})` — **офер помечается accepted, комната не создаётся, ошибка нигде не видна**.
- **Списки оферов/сделок/диалогов падают в рантайме** — обращения к `listings.title`, которого нет в схеме (см. §1): «Unknown column 'title'».
- **Telegram-канал сломан end-to-end** — рассинхрон сигнатур (`telegram.ts:45-64` vs `queries/channels.ts:109,146,190`) + `conversations.channel` enum не содержит `"telegram"` (insert упадёт), хотя `channelKinds` в схеме его включает.
- **Миграции 0000–0008 потеряны** — в `db/migrations/` только `0009`/`0010`, а `meta/_journal.json` ссылается на 11 миграций. Чистую БД миграциями не поднять (только generate-from-scratch).
- **`queries/foreclosures.ts:25`** — `searchForeclosures` на КАЖДЫЙ read выполняет `purgeOutdatedForeclosures()`: DELETE с 13 `LIKE '%…%'` (полный скан) в горячем пути поиска. Плюс захардкоженные «магические» caseNumber/адреса в коде.

### 2.2. Безопасность — backend

- **SSRF в foreclosure-коннекторах.** Любой авторизованный юзер создаёт коннектор с произвольным `sourceUrl` (`foreclosuresRouter.ts:80`), `sync` делает серверный `fetch(sourceUrl)` без `checkUrlSSRF` (защита есть только для webhook'ов и AI baseUrl). Достижимы `http://`, метаданные облака `169.254.169.254`, exfil через поле `raw`. SPA-адаптер дополнительно ведёт headless-браузер на внутренний URL.
- **Подпись Meta webhook — fail-open.** `channels/webhooks.ts:51-60`: X-Hub-Signature-256 проверяется, только если владелец сохранил appSecret. Без него любой POST инжектит поддельные входящие сообщения в чужие чаты и создаёт shadow users. Нужен fail-closed: appSecret обязателен при подключении Meta.

### 2.3. Безопасность — frontend

- **Stored XSS через вложения.** `Messages.tsx:1231-1243`, `DealRoom.tsx:277-283`, `Messages.tsx:616,622` — URL вложений/документов/пинов вводится свободным текстом и попадает в `<a href>`/`<iframe src>` без валидации схемы. `javascript:alert(document.cookie)` исполнится по клику контрагента в origin приложения.
- **Мок-данные как факт.** `FloatingBatchData.tsx:72-93` — захардкоженный внешний endpoint с `Bearer DUMMY_TOKEN` в клиентском коде; при ошибке авторизации молча подставляются **выдуманные** equity/tax/liens, которые сохраняются в БД как реальные финансовые данные листинга.

### 2.4. Инфраструктура

- **`.env` попадает в Docker build-контекст.** `.dockerignore` (5 строк) его не исключает; `Dockerfile:8` делает `COPY . .` — секреты оседают в слоях builder-стадии. Комментарий в Dockerfile:9 сам признаёт проблему («should be dockerignored»), но она не исправлена.
- **`*.test.ts` в `.gitignore:30`** — все три тестовых файла существуют только локально и не попадают в репозиторий.
- **HEALTHCHECK мёртв** — `Dockerfile:32-33` использует `curl`, которого нет в `node:20-slim` → контейнер перманентно `unhealthy`.

---

## 3. Важные находки

### 3.1. Целостность данных и гонки

- `queries/offers.ts:60` `respondToOffer` не проверяет текущий статус — можно принять отозванный/отклонённый офер, отвечать повторно; гонка withdraw↔accept. Нужен guard в `UPDATE ... WHERE status IN (...)`.
- Accept offer → deal room не в одной транзакции со сменой статуса (`offersRouter.ts:78-87`).
- `deals.ts:212-220` `addDocument` — read-max(version)+insert вне транзакции → дубли версий; нет unique `(dealRoomId, name, version)`.
- Дедуп webhook-ретраев check-then-insert без unique на `messages.externalId` (`schema.ts:328`) → дубли при конкурентной доставке + полный скан messages на каждое событие.
- Нет unique на `conversation_participants(conversationId, userId)` и `hidden_messages(userId, messageId)` → дубли участников; `onDuplicateKeyUpdate` в `messaging.ts:366-373` никогда не срабатывает.
- `channels.ts:109-142` `ensureShadowUser`: read-then-insert; при гонке duplicate-key кидает исключение → webhook вернёт 200, а сообщение потеряется.
- Гонка `ensureChannelConversation` (нет составного индекса `conversations(connectionId, externalThreadId)`) → дубли бесед при параллельных webhook'ах.
- `buy_boxes.userId`, `ai_settings.userId` — без FK, удаление юзера оставляет сирот.

### 3.2. Производительность

- `queries/messaging.ts:31-138` `listConversationsForUser` — N+1: 3–4 запроса на каждый диалог (50 чатов ≈ 200 запросов на один полл, а поллинг каждые 3 сек). Аналогично `findDirectConversation` (`:140-161`) и `deals.ts:110-133` `listDealsForUser`.
- `savedSearches.ts:134-167` `notifyListingMatches` — на каждый новый листинг вычитывает ВСЕ saved searches и buy boxes в память, матчит в JS.
- `foreclosure_records`: `auctionDate`/`filingDate` — `varchar(32)` (нет диапазонных запросов/сортировки), `caseNumber` без индекса при дедупе по нему.
- Frontend: нет code splitting — весь бандл ~1 MB (13 страниц + leaflet + dnd-kit + papaparse одним `index-*.js`); публичная главная тянет мессенджер и карту.
- Polling: сообщения 3 сек, список чатов 5 сек, задачи 3 сек, бейджи 15 сек ×2 — до ~30 запросов/мин на открытый чат. Оптимистичные pin/reorder (`Messages.tsx:786-788`) визуально откатываются каждые 5 сек до подтверждения сервера.
- `trpc.tsx:10` — QueryClient без дефолтов: все запросы рефетчатся при каждом маунте/фокусе окна.

### 3.3. Безопасность (важное, не критичное)

- Сессии JWT HS256 на **1 год** без серверной ревокации (`kimi/session.ts:14`); logout чистит только cookie.
- Rate-limit логина ключуется по `x-forwarded-for` (`auth-router.ts:46,73`) — заголовок подделывается, брутфорс-защита обходится; лимитер in-memory (не работает при >1 инстансе). Пароль от 4 символов (`:32`).
- `queries/listings.ts:83` `findListingById` не фильтрует `status` — черновики/архив чужих листингов читаются по последовательному id через tRPC/REST/MCP; публично отдаётся `ownerPhone`.
- Исходящие `fetch` к Meta/Telegram/X без таймаутов (`meta.ts:50-64`, `telegram.ts:18`, `x.ts:21`) — зависший внешний API подвесит `messagesRouter.send`.
- BYOK с локальными провайдерами не работает из коробки: дефолтные baseUrl ollama/lmstudio — `http://localhost:*`, а `checkUrlSSRF` разрешает только HTTPS (`translate.ts:22-23`, `lib/security.ts:7`).

### 3.4. Frontend — баги UX

- `Dashboard.tsx:126-129` — `navigate("/onboarding")` в теле рендера (не в useEffect) — ошибка React, гонки.
- `Login.tsx:16` — OAuth `state = btoa(redirectUri)` без CSRF-nonce → OAuth login CSRF.
- `NewListing.tsx:89-112` — форма перезаписывается при любом refetch (фокус окна) — правки затираются.
- `SavedSearchesTab.tsx:17-21` + `Listings.tsx:105-124` — «Run» сохранённого поиска восстанавливает только `q`, фильтры теряются: фича фактически не работает.
- Мутации без `onError` (юзер не узнает о сбое): withdraw offer, toggleTask, revokeKey, deleteHook, hide/unhide, pin/reorder, все task-мутации, setNotes.
- `api/uploads.test.ts:36-37` — тест проверяет собственную копию regex'ов; копия устарела, тест **ложно-зелёный**.

---

## 4. Минорные находки (сводно)

- **Backend:** account enumeration при регистрации (`auth-router.ts:50`); redirect-URI проверка `host.includes("localhost")` пропускает `localhost.evil.com` (`kimi/auth.ts:101`); `scopes` у plk_* ключей сохраняются, но нигде не проверяются; REST query-параметры без валидации (NaN в drizzle); `upsertUser` перезапишет чужую строку при коллизии по email; повсеместный `void promise.catch(() => {})` без логирования; `createGroup` без лимита участников и без согласия добавляемых; MCP: body без лимита, price без валидации, нет rate-limit.
- **Данные:** `getMessages` — жёсткий limit 500 без пагинации; `like(city, '%…%')` обесценивает индекс; `totalUnread` — тяжёлый COUNT в горячем пути; `db/relations.ts` пустой (relational `with:`-запросы не будут работать); reorder-циклы UPDATE вне транзакции.
- **Frontend:** `markRead` на каждый poll при активном чате; вложения теряются при ошибке отправки (`Messages.tsx:884-887`); `photoIdx` не сбрасывается при смене листинга; `MapContainer` ремаунтится при каждом фильтре; UI-тексты на русском в `Distressed.tsx` (против конвенции); 5 почти идентичных Floating*-компонентов; мёртвый код `AuthLayout*`; a11y — icon-only кнопки без aria-label; loading-заглушки `return null` вместо скелетонов.
- **Инфра:** `decryptToken` глотает ошибки в `null` (тихие пропуски отправки при смене APP_SECRET, нет ротации ключа); legacy plaintext AI-ключи читаются как есть; лимит 25 МБ на upload проверяется только по заявленному клиентом size; `CMD ["npm","start"]` (npm как PID 1) + раздутый образ (prod-deps не нужны — сервер сбандлен); webhook-эндпоинты без rate-limit, глобальный bodyLimit 50MB; `seo.ts:113` regex title без флага `s`; SSRF-проверка резолвит только A-записи + TOCTOU/DNS-rebinding.

---

## 5. Что сделано хорошо

- Подпись Meta webhook — `timingSafeEqual` по сырому телу; токены каналов в API не утекают (только `hasToken`).
- AES-256-GCM для секретов: случайный IV, auth tag, версионирование `v1.`; AI-ключи маскируются в API.
- `seo.ts` экранирует HTML и `<` в JSON-LD.
- Обязательные env валидируются zod'ом при старте; VITE_-утечек нет (клиент читает только публичные значения).
- Shadow users + lazy translation с кэшем в `messages.translations` — чистые архитектурные решения.
- SSRF-фильтр для webhook URL и AI baseUrl существует (проблема только в том, что он не применён к foreclosure).

---

## 6. Приоритезированный план

**P0 — разблокировать репозиторий (1–2 дня):**
1. Вернуть `listings.title` в `db/schema.ts` (или выпилить все обращения) + синхронизировать миграции; восстановить миграции 0000–0008 (generate-from-scratch в отдельный каталог и склеить).
2. `queries/deals.ts`: импорты + транзакция accept→deal room; убрать молчаливый `void catch`.
3. Telegram: привести сигнатуры к `queries/channels.ts`, добавить `"telegram"` в `conversations.channel` enum (миграция).
4. `api/lib/zillow.ts`, `foreclosure/adapters/*` — починить или удалить закомментированный рассинхрон.
5. Ввести правило: PR не мёрджится без зелёного `npm run check` (pre-commit hook / CI).

**P1 — безопасность (2–3 дня):**
6. `checkUrlSSRF` на foreclosure `sourceUrl` (+ запрет http://, allowlist портов).
7. Meta webhook: appSecret обязателен при подключении → fail-closed.
8. Валидация схемы URL вложений на фронте (только https:) + экранирование.
9. Убрать мок-fallback в `FloatingBatchData.tsx`, вынести endpoint в env.
10. `.env` в `.dockerignore`; `*.test.ts` из `.gitignore`; HEALTHCHECK на `node -e fetch`; unique-индексы: `messages.externalId`, `conversation_participants(conversationId,userId)`, `hidden_messages(userId,messageId)`.

**P2 — устойчивость и перф (неделя):**
11. Guard статусов в `respondToOffer`; таймауты на исходящие fetch каналов; rate-limit per-account и не по XFF.
12. N+1 в `listConversationsForUser`/`listDealsForUser` → JOIN'ы/агрегации; purge foreclosure из read-пути в cron.
13. Code splitting по роутам (React.lazy); дефолты QueryClient (staleTime, refetchOnWindowFocus: false).
14. Тесты: crypto round-trip + tamper, Meta signature (валид/фейк), дедуп webhook, translate SSRF; починить ложно-зелёный uploads-тест (импортировать константы вместо копии).

**P3 — UX-полировка:** navigate из рендера в useEffect, onError у всех мутаций, OAuth state nonce, saved searches фильтры, очистка мёртвого кода, i18n-консистентность.
