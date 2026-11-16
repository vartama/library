# 01 â€” `chore/backend-setup`

## Tujuan
Fondasi backend Go (`chi/v5`) dengan struktur layered (`router â†’ handler â†’ service â†’ repository â†’ model`), koneksi PostgreSQL via **Bun ORM** dari ENV, runner migrasi SQL, dan error handling JSON terpusat. Belum ada fitur bisnis.

## Struktur Folder

```
backend/
â”œâ”€â”€ cmd/
â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â””â”€â”€ main.go               # load env, connect DB, run migrations, start HTTP server + graceful shutdown
â”‚   â””â”€â”€ seed/
â”‚       â””â”€â”€ main.go               # (diisi di branch 2b & 3)
â”œâ”€â”€ internal/
â”‚   â”œâ”€â”€ apperror/
â”‚   â”‚   â””â”€â”€ error.go              # struct AppError(StatusCode, Message, Details, Err) + helper NewBadRequest/NotFound/Conflict/Unauthorized/Forbidden
â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â””â”€â”€ env.go                # baca & validasi ENV (PORT, DATABASE_URL, TEST_DATABASE_URL, CORS_ORIGIN)
â”‚   â”œâ”€â”€ database/
â”‚   â”‚   â”œâ”€â”€ db.go                 # NewDB(dsn) via pgdriver + bun.NewDB(..., pgdialect.New()), Ping()
â”‚   â”‚   â””â”€â”€ migrations/
â”‚   â”‚       â””â”€â”€ migrations.go     # //go:embed *.sql + bun/migrate.Migrator
â”‚   â”œâ”€â”€ handler/
â”‚   â”‚   â”œâ”€â”€ router.go             # NewRouter(deps) http.Handler (tanpa Listen) â†’ mudah dites via httptest
â”‚   â”‚   â”œâ”€â”€ respond.go            # JSON(w, status, data), Error(w, err) mapping AppError / validator / pgdriver / sql.ErrNoRows
â”‚   â”‚   â””â”€â”€ health.go             # GET /api/health
â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â””â”€â”€ logger.go             # wrapper slog + recoverer + JSON 404/405 handler
â”‚   â”œâ”€â”€ model/
â”‚   â”œâ”€â”€ repository/
â”‚   â”œâ”€â”€ service/
â”‚   â”œâ”€â”€ testutil/
â”‚   â”‚   â””â”€â”€ db.go                 # SetupTestDB(t): koneksi TEST_DATABASE_URL, jalankan migrasi, TRUNCATE antar test
â”‚   â””â”€â”€ validator/
â”‚       â””â”€â”€ validate.go           # wrapper go-playground/validator/v10 + DecodeAndValidate(r, &dst) â†’ []FieldError
â”œâ”€â”€ .env.example
â”œâ”€â”€ go.mod
â””â”€â”€ go.sum
```

Root repo:
```
docker-compose.yml                # sementara hanya service postgres untuk dev & test
.gitignore                        # + task.md, gitlab.md, coverage.out, bin/
```

## Langkah

1. `mkdir backend && cd backend && go mod init vartama-library` (atau nama module netral sesuai repo).
2. Install dependency:
   - `github.com/go-chi/chi/v5`
   - `github.com/go-chi/cors`
   - `github.com/uptrace/bun`
   - `github.com/uptrace/bun/dialect/pgdialect`
   - `github.com/uptrace/bun/driver/pgdriver`
   - `github.com/uptrace/bun/migrate`
   - `github.com/go-playground/validator/v10`
   - `github.com/google/uuid`
   - `github.com/joho/godotenv`
   - `github.com/stretchr/testify`
3. `internal/config/env.go`:
   - Load `.env` dengan `godotenv.Load()` (abaikan error jika file tidak ada, agar ENV di Docker langsung terbaca).
   - Default `PORT=3000`, `CORS_ORIGIN=http://localhost:5173`.
   - `DATABASE_URL` dicek saat `cmd/api` / `cmd/seed` berjalan (bukan saat package init), supaya unit test yang tidak butuh DB tetap jalan.
4. `internal/database/db.go`:
   - `sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))`
   - `db := bun.NewDB(sqldb, pgdialect.New())`
   - Verifikasi koneksi dengan `db.PingContext(ctx)` (timeout 5 detik).
   - Opsional di mode dev: `bundebug.NewQueryHook(bundebug.WithVerbose(true))` jika `APP_ENV=development`.
5. `internal/database/migrations/migrations.go`:
   - Embed file SQL (`//go:embed *.sql`) ke `migrate.NewMigrations()` dengan `Discover(fsys)`.
   - `RunMigrations(ctx, db)` memanggil `migrator.Init(ctx)` lalu `migrator.Migrate(ctx)`.
   - Jalankan otomatis saat startup `cmd/api` dan `cmd/seed` (idempoten).
6. `internal/handler/router.go` (`NewRouter`):
   - `r.Use(middleware.RealIP, slogLogger, middleware.Recoverer)`
   - `cors.Handler(cors.Options{ AllowedOrigins: []string{cfg.CORSOrigin}, AllowedMethods: ..., AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"} })`
   - `r.NotFound` â†’ JSON `404 { "message": "Route not found." }`
   - `r.MethodNotAllowed` â†’ JSON `405 { "message": "Method not allowed." }`
   - Mount `/api` dengan `GET /api/health` â†’ `200 { "data": { "status": "ok" } }`.
7. `internal/handler/respond.go` (Error Handler terpusat):
   - `*apperror.AppError` â†’ status & `message` (+ `details` bila ada)
   - `validator.ValidationErrors` / `[]apperror.FieldError` â†’ `400` `{ "message": "Validation failed.", "details": [...] }`
   - `pgdriver.Error` (`err.Field('C')`):
     - `23505` (`unique_violation`) â†’ `409`
     - `23503` (`foreign_key_violation`) â†’ `409` / `400` (sesuai konteks)
   - `errors.Is(err, sql.ErrNoRows)` â†’ `404`
   - Error parse UUID (`uuid.Parse`) â†’ `400`
   - Malformed JSON (`json.SyntaxError` / `io.EOF`) â†’ `400`
   - Lainnya â†’ `500` `{ "message": "Internal server error." }` (detail error hanya di-log lewat `slog.Error`)
8. `internal/validator/validate.go`:
   - Helper `DecodeAndValidate(r *http.Request, dst any) error`: decode JSON body (`DisallowUnknownFields` atau strict types) + jalankan `validate.Struct(dst)`, ubah error menjadi `[]apperror.FieldError` dengan nama field JSON (`json` tag).
9. `cmd/api/main.go`:
   - Import `_ "time/tzdata"` agar `TZ` bekerja di container minimal.
   - Load config, konek DB, jalankan migrasi, buat router, jalankan `http.Server` dengan graceful shutdown (`SIGINT` / `SIGTERM`).
10. `.env.example` (di `backend/`):
    ```
    PORT=3000
    DATABASE_URL=postgres://postgres:postgres@localhost:5432/vartama_library?sslmode=disable
    TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/vartama_library_test?sslmode=disable
    CORS_ORIGIN=http://localhost:5173
    ```
11. `docker-compose.yml` awal (root):
    ```yaml
    services:
      postgres:
        image: postgres:17-alpine
        environment:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: vartama_library
        ports: ["5432:5432"]
        volumes:
          - postgres-data:/var/lib/postgresql/data
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U postgres -d vartama_library"]
          interval: 5s
          timeout: 5s
          retries: 5
    volumes:
      postgres-data:
    ```
    (Buat database test `vartama_library_test` satu kali via `docker compose exec postgres createdb -U postgres vartama_library_test` atau init SQL script di `docker-entrypoint-initdb.d`).
12. `.gitignore` tambahkan: `task.md`, `gitlab.md`, `coverage.out`, `backend/bin/`.

## Test
- `internal/handler/health_test.go`: memakai `httptest.NewRecorder()` terhadap `NewRouter`:
  - `GET /api/health` â†’ `200 { "data": { "status": "ok" } }`
  - `GET /api/unknown` â†’ `404` JSON `{ "message": "Route not found." }`
- `internal/testutil/db.go`: helper test DB (`SetupTestDB(t)`) yang memakai `TEST_DATABASE_URL`, menjalankan migrasi Bun sekali per test suite, dan membersihkan tabel dengan `TRUNCATE ... RESTART IDENTITY CASCADE` untuk dipakai branch berikutnya.

## Selesai jika
- [ ] `docker compose up -d postgres` lalu `go run ./cmd/api` â†’ server jalan & terkoneksi PostgreSQL
- [ ] `GET /api/health` mengembalikan 200
- [ ] `go test ./...` hijau
- [ ] `git status` tidak menampilkan `task.md` / `gitlab.md`

## Saran commit
`chore(backend): scaffold go chi app with bun orm, postgres migrations and error handling`
