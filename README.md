# n8n-gateway

Лёгкий HTTP-шлюз перед n8n с очередью на Redis.

---

## Требования

- Docker + Docker Compose
- Файл `.env` в корне проекта

**Минимальный `.env`:**
```env
N8N_URL=http://your-n8n-host:5678
CONCURRENCY=5
```

---

## Разработка

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Сервер стартует на `http://localhost:8000`
- Исходники монтируются из `./src` — изменения подхватываются без пересборки
- Логи выводятся в консоль через `pino-pretty`

Остановить:
```bash
docker compose -f docker-compose.dev.yml down
```

---

## Продакшн

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- Сервер стартует на `http://localhost:8000`
- Redis запускается автоматически, gateway ждёт его healthcheck
- Логи пишутся в volume `n8n_gateway_logs` → `/app/logs/app.log` с ротацией по дням

Посмотреть логи:
```bash
docker compose -f docker-compose.prod.yml logs -f gateway
```

Остановить:
```bash
docker compose -f docker-compose.prod.yml down
```

Остановить и удалить volumes:
```bash
docker compose -f docker-compose.prod.yml down -v
```

---

## Эндпоинты

### `GET /health`

Проверка состояния сервиса. Возвращает статус Redis, размер очереди и uptime.

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "redis": "connected",
  "queueSize": 3,
  "uptime": 42.5
}
```

---

### `POST /webhook/*` — синхронный вызов

Запрос блокируется до получения ответа от n8n (таймаут 30 секунд). Подходит когда нужен результат выполнения workflow.

```bash
curl -X POST http://localhost:8000/webhook/my-workflow \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

Ответ приходит напрямую от n8n — статус и тело пробрасываются как есть.

---

### `POST /webhook-async/*` — асинхронный вызов

Запрос сразу возвращает `202 Accepted` и кладёт задачу в очередь. Подходит для долгих workflow или когда результат не нужен немедленно.

```bash
curl -X POST http://localhost:8000/webhook-async/my-workflow \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

```json
{
  "status": "queued",
  "jobId": "42"
}
```

Внутри gateway путь `/webhook-async/my-workflow` автоматически переписывается в `/webhook/my-workflow` при проксировании к n8n.

---

## Переменные окружения

- `N8N_URL` — URL инстанса n8n, обязательно
- `REDIS_URL` — подключение к Redis, по умолчанию `redis://redis:6379`
- `PORT` — порт сервера, по умолчанию `8000`
- `LOG_LEVEL` — уровень логирования, `debug` в dev / `info` в prod
- `LOG_DIR` — директория логов (только прод), по умолчанию `./logs`
- `CONCURRENCY` — число параллельных задач из очереди
