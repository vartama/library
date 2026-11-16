# 00 â€” Overview Plan

Aplikasi web untuk Vartama Library: kelola buku (tambah, hapus, list, filter, sort) dan peminjaman multi-buku dengan ringkasan sebelum konfirmasi serta riwayat peminjaman.

## Stack

| Layer | Pilihan |
|---|---|
| Frontend | Vite + React, react-router, **Tailwind CSS `3.4.17`**, **Zustand** (satu store), **axios `1.20.0`** (pin exact) |
| Backend | Go 1.26, **chi/v5**, **Bun ORM** (`uptrace/bun` + `pgdriver`), `go-playground/validator/v10`, `go-chi/cors`, `slog` |
| Auth | JWT (`golang-jwt/jwt/v5`) + `golang.org/x/crypto/bcrypt`, role `admin` / `user`, rate limit login (`go-chi/httprate`) |
| Database | PostgreSQL 17 (via Docker) + migrasi SQL (`bun/migrate`) |
| Cache (branch 10) | Redis 7 (`redis/go-redis/v9`, fail-open) |
| Test BE | `go test` + `net/http/httptest` + `testify` (terhadap Postgres test DB) |
| Test FE | Vitest + React Testing Library + jsdom |
| Container | Dockerfile terpisah untuk BE & FE + `docker-compose.yml` |

## Referensi Desain (wajib diikuti di frontend)

Folder `mei-library-design-system/` (hasil Claude Design) adalah sumber kebenaran UI:

| File | Dipakai untuk |
|---|---|
| `DESIGN.md` / `README.md` | Aturan copy, warna, tipografi, layout, flow |
| `tailwind.md` | `tailwind.config.js`, blok tema `index.css`, **class recipes** (string class persis) |
| `tokens.json` | Daftar token + catatan pemakaian/kontras |
| `components/<Name>/README.md` | Aturan per komponen |
| `components/<Name>/preview.html` | Markup persis per komponen |
| `components/Screens/preview.html` | Prototype lengkap: perilaku, copy, dan pesan validasi |

Aturan utama: **jangan menambah warna, ukuran, atau copy di luar design system**; hanya pakai warna bertoken (`bg-brand`, `text-ink`, â€¦), tanpa hex mentah dan tanpa palet default Tailwind; tidak ada class `dark:` (tema gelap via `data-theme`).

Penyimpangan yang disetujui dari design system:
- **Layout:** top bar + **sidebar** (permintaan user, mengikuti referensi layout admin) menggantikan tiga tab di atas. Tetap memakai token design system; item aktif = `bg-brand-soft text-brand-text` + bar `brand`. Di bawah 768px sidebar menjadi drawer dari tombol menu.
- **Ikon:** ikon garis 1.5px / 20px / `currentColor` (sesuai catatan Iconography untuk ikon tambahan), path dari Heroicons (MIT).
- **Tema:** tombol ganti light/dark di top bar; default mengikuti OS, pilihan disimpan di `localStorage`.

Penyesuaian karena aplikasi ini memakai backend (bukan `localStorage` seperti di prototype):
- Data buku & riwayat berasal dari API; store Zustand memanggil API lalu menyimpan hasilnya.
- Nama field mengikuti API (`borrowerName`, `phoneNumber`, `dueDate`, `items[].quantity`), bukan nama di contoh state design system (`borrower`, `phone`, `due`, `qty`).

## Port & ENV

| Service | Dev lokal | Docker |
|---|---|---|
| PostgreSQL | `5432` | `5432` |
| Redis (branch 10) | `6379` | `6379` |
| Backend | `3000` | `3000` |
| Frontend | `5173` (Vite) | `8080` (nginx) |

- Backend: `PORT`, `DATABASE_URL`, `TEST_DATABASE_URL`, `CORS_ORIGIN`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD`, `REDIS_URL` (branch 10)
- Frontend: `VITE_API_URL` (build-time)

> **Catatan ID & Kontrak JSON:** Semua primary key di PostgreSQL memakai `UUID` (`uuid` di DB, string di JSON) agar kontrak API ke frontend tetap identik (value `<select>`, perbandingan ID string di React, validasi UUID â†’ `400`).

## Urutan Branch

| # | Branch | Isi | Requirement |
|---|---|---|---|
| 1 | `chore/backend-setup` | Scaffold Go + chi, koneksi PostgreSQL (Bun ORM), migrasi, error handling | Tech |
| 2 | `chore/frontend-setup` | Scaffold React + Tailwind dari design system, tabs, komponen dasar, axios client | Tech |
| 2b | `feature/auth` | Login JWT, role `admin` / `user`, middleware `Authenticate` & `Authorize`, halaman login | Tambahan (hak akses) |
| 3 | `feature/book-management` | Tambah, edit, hapus, list buku + seed script | F1, F2, F3, seed |
| 3b | `feature/genre-master` | Master data genre (CRUD admin), buku mereferensikan genre (`genre_id` FK) | Tambahan |
| 4 | `feature/book-filter-sort` | Filter genre, sort title/stock | F4, F5 |
| 5 | `feature/lending` | Pinjam multi-buku, ringkasan, kurangi stok atomik dalam transaksi SQL saat konfirmasi | F6, F7, F8 |
| 6 | `feature/lending-history` | Riwayat peminjaman | F9 |
| 7 | `chore/docker` | Dockerfile BE (multi-stage Go) & FE (nginx), compose lengkap | Plus point |
| 8 | `docs/contract-and-readme` | Diagram kontrak Mermaid + README | Docs |
| 9 | â€” | Checklist submit (lihat `09-final-checklist.md`) | Submission |
| 10 | `feature/catalog-at-scale` | Seed 1000 buku, pagination, search `ILIKE`, cache Redis (fail-open) | Scale |

Detail tiap branch ada di file `01-â€¦` sampai `10-â€¦` (termasuk `02b-feature-auth.md` dan `03b-feature-genre-master.md`).

## Urutan Pengerjaan di Dalam Branch Fitur (2b, 3â€“6, 10)

Selalu **backend dulu**, frontend setelah API-nya jalan dan teruji:

1. **Backend:** migrasi SQL â†’ model Bun â†’ repository â†’ service â†’ validator/DTO â†’ handler â†’ route
2. **Test backend** (`go test ./...` + `httptest`) hijau, lalu cek manual endpoint (curl / REST client)
3. **Frontend:** api module â†’ store slice â†’ komponen â†’ halaman
4. **Test frontend** hijau, lalu uji manual di browser terhadap backend lokal

Dengan begitu kontrak API sudah pasti sebelum UI dibuat, dan tiap branch tetap berisi satu fitur utuh (BE + FE) yang bisa di-merge sendiri.

## Alur Git (manual)

Setiap branch dibuat dari `main` terbaru dan di-merge kembali ke `main` sebelum lanjut ke branch berikutnya:

```bash
git checkout main
git pull
git checkout -b <nama-branch>
# ... kerjakan ...
git add .
git commit -m "<pesan commit>"
git push -u origin <nama-branch>
# merge ke main (lewat Merge Request GitLab atau lokal):
git checkout main
git merge --no-ff <nama-branch>
git push origin main
```

> Ketentuan tes: semua perubahan harus berakhir di `main`. Pastikan semua branch sudah ter-merge sebelum submit.

## Prinsip

- Sederhana dan langsung â€” jangan overengineering.
- Layered backend: `router â†’ handlers â†’ services â†’ repositories â†’ models` (dengan `internal/` package).
- Semua endpoint data wajib login (`Authenticate`); tambah/edit/hapus buku & kelola genre khusus `admin` (`Authorize("admin")`). UI menyembunyikan aksi yang tidak diizinkan, backend yang menegakkan.
- Format response konsisten:
  - Sukses: `{ "data": ... }`
  - Error: `{ "message": "...", "details"?: [{ "field": "...", "message": "..." }] }`
- Aturan validasi **sama** di backend (`validator/v10` + custom rules) dan frontend, mengikuti design system (mis. telepon 9â€“15 digit, due date setelah hari ini).
- Setiap branch fitur menyertakan unit test-nya sendiri.
- `task.md` dan `gitlab.md` **tidak boleh** ter-commit (sudah masuk `.gitignore` di branch 1).
