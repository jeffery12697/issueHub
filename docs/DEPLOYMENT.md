# Deployment

## Local Development (Docker Compose)
```yaml
services:
  db:        PostgreSQL 16 (with ltree extension)
  redis:     Redis 7
  backend:   FastAPI (uvicorn --reload)
  frontend:  Vite dev server
```

## Environment Variables

### Backend
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async DSN (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis DSN (`redis://localhost:6379/0`) |
| `SECRET_KEY` | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default: 15 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Default: 7 |
| `STORAGE_BACKEND` | `local` or `s3` |
| `S3_BUCKET` / `S3_ENDPOINT` | Object storage config (Phase 4) |

### Frontend
| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API base URL |
| `VITE_WS_BASE_URL` | WebSocket base URL |

## Commands
```bash
# Start all services
docker compose up -d

# Run migrations
docker compose exec backend alembic upgrade head

# Backend only (local)
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend only (local)
cd frontend && npm run dev
```

## Production Notes
- Run FastAPI with Gunicorn + Uvicorn workers: `gunicorn app.main:app -k uvicorn.workers.UvicornWorker`
- Nginx as reverse proxy; WebSocket upgrade headers required
- PostgreSQL `ltree` extension must be enabled: `CREATE EXTENSION IF NOT EXISTS ltree;`
- Run Alembic migrations before deploying new backend version
