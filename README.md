# Vartama Library

Web application for managing book inventory, genre master data, multi-book lending with pre-confirmation summary, and lending history.

## Tech Stack

- **Frontend:** React 19, Vite, React Router, Tailwind CSS `3.4.17`, Zustand, Axios `1.20.0`
- **Backend:** Go `1.26`, `chi/v5`, **Bun ORM** (`uptrace/bun` + `pgdriver`), `go-playground/validator/v10`, `golang-jwt/jwt/v5`, `bcrypt`, `httprate`
- **Database & Cache:** PostgreSQL 17 (with `bun/migrate` embedded SQL migrations), Redis 7 (`go-redis/v9`, fail-open)
- **Container:** Multi-stage Dockerfiles for Go backend and Nginx frontend + `docker-compose.yml`

## Project Structure

```
.
├── backend/
│   ├── cmd/api/            # HTTP server entrypoint
│   ├── cmd/seed/           # Database seeder (users, genres, up to 1000 books)
│   ├── internal/
│   │   ├── apperror/       # Structured HTTP errors
│   │   ├── auth/           # Password hashing & JWT service
│   │   ├── cache/          # Fail-open versioned Redis cache
│   │   ├── config/         # Environment config
│   │   ├── constants/      # Role constants
│   │   ├── database/       # Bun PostgreSQL setup + embedded SQL migrations
│   │   ├── handler/        # chi router & HTTP handlers
│   │   ├── middleware/     # Request logger, Authenticate, Authorize
│   │   ├── model/          # Bun models & response DTOs
│   │   ├── repository/     # PostgreSQL queries via Bun ORM
│   │   ├── seed/           # Curated + deterministic book generator
│   │   ├── service/        # Business logic & ACID lending transactions
│   │   └── validator/      # JSON decoding & validation helpers
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/                # React app (design-system tokens & components)
│   ├── tests/              # Vitest + React Testing Library specs
│   ├── Dockerfile
│   └── nginx.conf
├── docs/api-contract.md    # Mermaid architecture, ER, sequence diagrams & API spec
├── plan/                   # Step-by-step branch implementation plans
└── docker-compose.yml
```

## Prerequisites

- **Local development:** Go `1.26+`, Node `24+`, npm, Docker (for PostgreSQL / Redis)
- **Containerized:** Docker & Docker Compose

## Run Locally

1. Start PostgreSQL (and optionally Redis):
   ```bash
   docker compose up -d postgres redis
   ```
2. Configure, seed, and run the Go backend:
   ```bash
   cd backend
   cp .env.example .env
   go run ./cmd/seed
   go run ./cmd/api
   ```
3. Configure and run the frontend:
   ```bash
   cd frontend
   cp .env.example .env
   npm ci
   npm run dev
   ```
4. Open `http://localhost:5173`.

## Run via Docker

```bash
cp .env.example .env
# Set a secure JWT_SECRET in .env
docker compose up -d --build
docker compose run --rm backend /bin/seed
```

Open `http://localhost:8080`.

## Demo Accounts

| Username | Password | Role | Capabilities |
|---|---|---|---|
| `admin` | `admin123` | `admin` | Full access: manage books, manage genres, lend books, view history |
| `staff` | `user123` | `user` | View catalog, lend books, view history (cannot add/edit/delete books or genres) |

## Testing

- **Backend:**
  ```bash
  cd backend
  go test ./...
  ```
  (DB integration tests use `TEST_DATABASE_URL` when set and reachable.)
- **Frontend:**
  ```bash
  cd frontend
  npm test
  npm run lint
  npm run build
  ```

## API Documentation

See [docs/api-contract.md](docs/api-contract.md) for architecture diagrams, ER schema, sequence diagrams, and endpoint contracts.

## Design Notes

- **Atomic Lending Stock Updates:** Lending confirmation executes inside a PostgreSQL ACID transaction (`db.RunInTx`) with deterministic `SELECT ... FOR UPDATE` row locking (`ORDER BY id ASC`), preventing negative stock and deadlocks without manual rollback scripts.
- **UUID Primary Keys:** All entities use PostgreSQL `UUID` keys serialized as strings, ensuring exact compatibility with React `<select>` controls and frontend ID comparisons.
- **Deleted Book Preservation:** `lending_items.book_id` uses `ON DELETE SET NULL` while storing a `title` snapshot, allowing admins to delete books without losing lending history.
- **Fail-Open Cache:** Catalog reads (`GET /api/books`, `GET /api/books/overview`, `GET /api/genres`) use version-keyed Redis caching and automatically fall back to PostgreSQL if `REDIS_URL` is unset or Redis is unreachable.
