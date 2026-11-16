# 07 â€” `chore/docker` (plus point)

## Tujuan
Frontend dan backend dijadikan **image terpisah**; koneksi database dari **ENV**; seluruh stack bisa jalan dengan satu perintah.

> **Catatan implementasi:**
> - Image terpisah: `vartama-library-backend` (multi-stage Go + Alpine ~25 MB, user non-root `appuser`, healthcheck `/api/health`) dan `vartama-library-frontend` (~49 MB, nginx 1.27 alpine, hanya file hasil build).
> - Port host bisa diubah: `FRONTEND_PORT` (8080), `BACKEND_PORT` (3000), `POSTGRES_PORT` (5432). Jika port diubah, sesuaikan juga `VITE_API_URL` dan `CORS_ORIGIN`.
> - `JWT_SECRET` wajib: tanpa nilai, `docker compose` berhenti dengan pesan "Set JWT_SECRET in .env".
> - `TZ=Asia/Jakarta`: binary Go meng-import `_ "time/tzdata"` (dan image runtime memasang `ca-certificates` + `tzdata`) sehingga pengecekan "Due date must be after today" konsisten di container Alpine.
> - nginx: SPA fallback (refresh di `/lend`, `/history`, `/genres` â†’ 200), aset ber-hash di-cache 1 tahun, `index.html` `no-cache`.
> - Image backend hanya berisi binary `/bin/api` dan `/bin/seed` (migrasi SQL & seed data sudah ter-embed via `//go:embed`), tanpa `.env` maupun source/test.
> - `docker compose up -d postgres` tetap bisa dipakai untuk development lokal.

## File

```
backend/Dockerfile
backend/.dockerignore
frontend/Dockerfile
frontend/.dockerignore
frontend/nginx.conf
docker-compose.yml        # diperluas dari versi branch 1
.env.example              # (root) variabel untuk compose
```

## Backend â€” `backend/Dockerfile` (multi-stage)
```dockerfile
FROM golang:1.26-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/seed ./cmd/seed

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata wget \
 && adduser -D -u 10001 appuser
COPY --from=build /bin/api /bin/api
COPY --from=build /bin/seed /bin/seed
USER appuser
EXPOSE 3000
CMD ["/bin/api"]
```
`.dockerignore`: `.env`, `*.log`, `bin/`, `coverage.out`, `.git`

## Frontend â€” `frontend/Dockerfile` (multi-stage, tetap)
```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```
`nginx.conf`: serve static + SPA fallback (`try_files $uri $uri/ /index.html;`) agar refresh di `/lend` & `/history` tidak 404.

> Catatan: variabel `VITE_*` dibaca saat **build**, jadi `VITE_API_URL` dikirim sebagai build arg. Karena browser yang memanggil API, nilainya URL yang bisa diakses dari host (`http://localhost:3000/api`), bukan `http://backend:3000`.

## `docker-compose.yml`
```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-vartama_library}
    ports: ["${POSTGRES_PORT:-5432}:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-vartama_library}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL:-postgres://postgres:postgres@postgres:5432/vartama_library?sslmode=disable}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:8080}
      JWT_SECRET: ${JWT_SECRET:?Set JWT_SECRET in .env}
      # "Due date must be after today" uses the server's date: use the library's time zone.
      TZ: ${TZ:-Asia/Jakarta}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-8h}
      SEED_ADMIN_PASSWORD: ${SEED_ADMIN_PASSWORD:-admin123}
      SEED_USER_PASSWORD: ${SEED_USER_PASSWORD:-user123}
    ports: ["${BACKEND_PORT:-3000}:3000"]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: ${VITE_API_URL:-http://localhost:3000/api}
    ports: ["${FRONTEND_PORT:-8080}:80"]
    depends_on: [backend]

volumes:
  postgres-data:
```

Seed di Docker:
```bash
docker compose run --rm backend /bin/seed
```

`JWT_SECRET` sengaja tanpa default (`:?`): compose berhenti dengan pesan jelas jika belum diisi di `.env` root, supaya secret tidak pernah ter-hardcode.

## Langkah verifikasi
1. `cp .env.example .env` (isi `JWT_SECRET`), lalu `docker compose up -d --build`
2. `docker compose run --rm backend /bin/seed`
3. Buka `http://localhost:8080` â†’ login sebagai `admin` dan `staff`, list buku, pinjam, history berfungsi
4. `docker images` â†’ ada dua image terpisah (backend & frontend)
5. Refresh langsung di `http://localhost:8080/history` â†’ tidak 404

## Selesai jika
- [ ] Seluruh stack jalan via compose
- [ ] `DATABASE_URL` dan `JWT_SECRET` dibaca dari ENV / `.env`, tidak ada secret di image
- [ ] Dua image terpisah ter-build

## Saran commit
`chore(docker): add separate dockerfiles for frontend and go backend with postgres compose setup`
