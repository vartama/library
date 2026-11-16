# 10 â€” `feature/catalog-at-scale` (seed 1000 buku, pagination, search, Redis)

## Tujuan
Aplikasi tetap cepat dan nyaman dipakai dengan katalog besar (1000+ buku).

## Backend

### Seed 1000 buku
- `internal/seed/generate_books.go` â€” generator **deterministik** (memakai `math/rand/v2` dengan `rand.NewPCG(seed1, seed2)` dari stdlib Go, tanpa dependency tambahan â†’ ikut ter-compile ke binary production). Judul unik (case-insensitive), penulis fiktif, tersebar rata ke 6 genre, stok bervariasi (Â±8 % habis, Â±13 % 1â€“2).
- `go run ./cmd/seed` (atau `/bin/seed` di Docker) â†’ 7 buku kurasi + 993 hasil generator = **1000**. Jumlah lain: `go run ./cmd/seed -books=50` atau ENV `SEED_BOOK_COUNT`.
- Batch insert per 500 baris lewat Bun (`db.NewInsert().Model(&chunk).Exec(ctx)`); setelah commit, seed juga menaikkan versi cache Redis (jika `REDIS_URL` terpasang).

### Pagination & search (`GET /api/books`)
- Migrasi `005_add_books_search_indexes.up.sql`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX books_title_trgm_idx ON books USING gin (title gin_trgm_ops);
  CREATE INDEX books_author_trgm_idx ON books USING gin (author gin_trgm_ops);
  ```
- Query baru: `search` (judul **atau** penulis, sebagian, case-insensitive via `ILIKE`, karakter khusus `%`, `_`, `\` di-escape agar literal, maks 100 karakter), `page` (â‰¥ 1, default 1), `limit` (1â€“100, default 20).
- Response tetap memakai amplop `{ "data": ... }` yang sama dengan frontend:
  `{ "data": { "items": [...], "page": 1, "limit": 20, "total": 1000, "totalPages": 50 } }`
- Urutan stabil (tie-break `LOWER(b.title) ASC, b.id ASC`) â†’ tidak ada buku muncul dua kali antar halaman.
- Repository `FindPage(ctx, filter, sort, page, limit)` menggunakan `q.Limit(limit).Offset(offset).ScanAndCount(ctx)` bawaan Bun ORM (atau `Count` + `Scan`).

### Redis (`github.com/redis/go-redis/v9`)
- `internal/cache/redis.go`: koneksi non-blocking saat startup (API tidak gagal start jika Redis mati), reconnect otomatis oleh pool `go-redis`, log outage sekali (pakai `atomic.Bool` state), dan bump cache version saat koneksi pulih (`OnConnect` / monitor reconnect).
- `internal/cache/catalog_cache.go`: read-through `Remember(ctx, name, params, dst, loader)` + `Invalidate(ctx)`.
  - Kunci: `vartama:catalog:v{version}:{name}:{params terurut}`; TTL `CACHE_TTL_SECONDS` (default 60s).
  - Invalidasi **per versi**: `INCR vartama:catalog:version` pada tambah/edit/hapus buku, CRUD genre, dan peminjaman (stok berubah).
  - **Fail-open**: tanpa `REDIS_URL` atau Redis down â†’ langsung query PostgreSQL. Saat Redis kembali â†’ versi dinaikkan.
  - Yang di-cache: halaman buku, overview, genres. **Tidak**: riwayat, login, semua write.
- Compose: service `redis:7-alpine` (`--maxmemory 64mb --maxmemory-policy volatile-lru --save ""`). `volatile-lru` supaya kunci versi (tanpa TTL) tidak pernah di-evict.
- `GET /api/health` â†’ `{ "data": { "status": "ok", "cache": "up" | "down" | "off" } }`.

## Frontend (tetap)
- Books: kolom **Search** (debounce 300 ms) di samping filter Genre; **footer datatable** di dalam kartu tabel: *Rows per page* (10/20/50/100) Â· "Showing 21â€“40 of 1,000 books" Â· Â« â€¹ 1 2 3 4 5 â€¦ 50 â€º Â» (halaman aktif `aria-current`, celah satu halaman ditampilkan sebagai angka). Search/genre/sort baru â†’ kembali ke halaman 1; halaman yang kosong setelah hapus â†’ pindah ke halaman terakhir.
- Lend books: pilih buku lewat **BookPicker** (combobox ARIA, search judul/penulis, 8 hasil, stok habis & judul yang sudah dipilih tidak bisa dipilih, keyboard â†‘ â†“ Enter Esc). `catalog` (semua buku) dihapus dari store. Setelah `409`/`404`, stok dari API dipakai langsung di ringkasan.

## Verifikasi (Docker, stack terpisah)
- Seed 1000 buku (< 1 detik di PostgreSQL batch insert); `total: 1000, totalPages: 50`.
- Halaman yang sama: cache miss â†’ cache hit lebih cepat (terlihat di log `slog.Debug` Cache hit).
- Pinjam 1 buku â†’ stok di daftar langsung berkurang, versi cache naik.
- Redis dihentikan â†’ API tetap 200, `/api/health` `cache: down`; Redis dinyalakan â†’ reconnect otomatis.

## Test
- BE (`go test ./...`): `book_pagination_test.go` (search literal `%`/`_`, page/limit, urutan stabil), `catalog_cache_test.go` (fake/mock Redis atau miniredis untuk cache hit/miss, version bump, fail-open), `generate_books_test.go` (deterministik, judul unik, distribusi genre/stok).
- FE (`npm test`): `books-search-pagination` & `lending` dengan `BookPicker` tetap sama.

## Saran commit
`feat(catalog): seed 1000 books, paginate and search the list, cache catalog reads in redis`
