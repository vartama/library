# 02b â€” `feature/auth` (login JWT + role admin / user)

## Tujuan
Semua endpoint data hanya bisa diakses setelah login. Ada dua role:

| Role | Siapa | Hak akses |
|---|---|---|
| `admin` | Kepala pustakawan (Head Librarian) | Semua: kelola buku (tambah/hapus), pinjamkan buku, lihat riwayat |
| `user` | Staf perpustakaan | Lihat buku (filter/sort), pinjamkan buku, lihat riwayat. **Tidak bisa** tambah/hapus buku |

Dikerjakan **setelah** `chore/frontend-setup` dan **sebelum** `feature/book-management`, supaya setiap endpoint fitur langsung dipasangi middleware auth sejak dibuat.

Sengaja **tidak** dibuat (di luar lingkup tes): registrasi publik, CRUD user, reset password, refresh token. Akun dibuat lewat seed script.

## Matriks Akses Endpoint

| Endpoint | Tanpa login | `user` | `admin` |
|---|---|---|---|
| `GET /api/health` | âœ“ | âœ“ | âœ“ |
| `POST /api/auth/login` | âœ“ | âœ“ | âœ“ |
| `GET /api/auth/me` | 401 | âœ“ | âœ“ |
| `GET /api/books`, `GET /api/books/overview` | 401 | âœ“ | âœ“ |
| `POST /api/books` | 401 | **403** | âœ“ |
| `DELETE /api/books/:id` | 401 | **403** | âœ“ |
| `POST /api/lendings` | 401 | âœ“ | âœ“ |
| `GET /api/lendings` | 401 | âœ“ | âœ“ |

UI menyembunyikan aksi yang tidak diizinkan, tetapi **backend tetap yang menegakkan** aturan ini.

## Backend

### Dependency
- `github.com/golang-jwt/jwt/v5` â€” sign/verify JWT (HS256)
- `golang.org/x/crypto/bcrypt` â€” hash password (pure Go, tanpa CGO, aman untuk image alpine)
- `github.com/go-chi/httprate` â€” batasi percobaan login (10 kali / 15 menit per IP)

### ENV baru (`.env.example`)
```
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=8h
SEED_ADMIN_PASSWORD=admin123
SEED_USER_PASSWORD=user123
```
- `JWT_SECRET` wajib: `cmd/api` gagal start dengan pesan jelas jika kosong (sama seperti `DATABASE_URL`).
- `JWT_EXPIRES_IN` diparse dengan `time.ParseDuration` (default `8h`).
- Password seed hanya untuk demo; ditulis di README agar reviewer bisa login.

### Migrasi â€” `internal/database/migrations/001_create_users.up.sql`
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_username_lower_idx ON users (LOWER(username));
```

### Model â€” `internal/model/user.go`

```go
type User struct {
	bun.BaseModel `bun:"table:users,alias:u"`

	ID           uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Username     string    `bun:"username,notnull" json:"username"`
	Name         string    `bun:"name,notnull" json:"name"`
	PasswordHash string    `bun:"password_hash,notnull" json:"-"`
	Role         string    `bun:"role,notnull" json:"role"`
	CreatedAt    time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt    time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}
```
- `Username` disimpan lowercase & trim di service/repository; `PasswordHash` selalu bertag `json:"-"` agar tidak pernah bocor ke response JSON.

### Endpoint

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/auth/login` | `{ username, password }` | `200 { data: { token, user: { id, username, name, role } } }` |
| `GET` | `/api/auth/me` | â€” (Bearer token) | `200 { data: { id, username, name, role } }` |

Error:
- `400` body tidak valid
- `401` `"Incorrect username or password."` â€” pesan **sama** untuk username tidak ada maupun password salah (tidak membocorkan username mana yang terdaftar)
- `429` terlalu banyak percobaan login (`{ "message": "Too many login attempts. Please try again later." }`)

### Middleware
- `internal/middleware/auth.go`:
  - `Authenticate(tokenSvc)`:
    - Ambil header `Authorization: Bearer <token>`; tidak ada / format salah â†’ `401 "Sign in to continue."`
    - Verify JWT gagal / kedaluwarsa â†’ `401 "Your session has expired. Sign in again."`
    - Sukses â†’ simpan `AuthUser{ID, Username, Name, Role}` ke `r.Context()` (stateless, tanpa query DB), akses via `middleware.UserFromContext(ctx)`.
  - `Authorize(roles ...string)` â†’ role tidak cocok â†’ `403 "You do not have permission to do this."`

Pemakaian di route (diterapkan di branch fitur berikutnya):
```go
r.Route("/books", func(r chi.Router) {
	r.Use(middleware.Authenticate(tokenSvc))
	r.Get("/", bookHandler.List)
	r.With(middleware.Authorize(roles.Admin)).Post("/", bookHandler.Create)
	r.With(middleware.Authorize(roles.Admin)).Delete("/{id}", bookHandler.Delete)
})
```

### File
```
internal/constants/roles.go         # Admin = "admin", User = "user"
internal/model/user.go
internal/repository/user_repo.go    # FindByUsername(ctx, username), FindByID(ctx, id), Upsert(ctx, user)
internal/service/auth_service.go    # Login(ctx, username, password), GetProfile(ctx, id)
internal/handler/auth_handler.go    # Login, Me + LoginRequest struct + validator tags
internal/middleware/auth.go         # Authenticate, Authorize, UserFromContext
internal/auth/token.go              # SignToken(user), VerifyToken(token)
internal/auth/password.go           # HashPassword(plain), ComparePassword(plain, hash)
cmd/seed/main.go                    # seed users (ditambah books & lendings di branch 3)
```

### Seed â€” `cmd/seed/main.go`
Branch ini membuat `cmd/seed/main.go` dengan bagian **users**; branch 3 menambah bagian books dan lendings.
- Upsert berdasarkan `LOWER(username)` (`INSERT ... ON CONFLICT (LOWER(username)) DO UPDATE`) agar seed bisa dijalankan berulang tanpa duplikat:

  | Username | Name | Role | Password |
  |---|---|---|---|
  | `admin` | Head Librarian | `admin` | `SEED_ADMIN_PASSWORD` |
  | `staff` | Library Staff | `user` | `SEED_USER_PASSWORD` |

### Payload JWT
```json
{ "sub": "<userId-uuid>", "username": "admin", "name": "Head Librarian", "role": "admin", "iat": 0, "exp": 0 }
```
Hanya data non-rahasia; tidak ada password/hash di token.

## Frontend

### Store â€” slice `auth` di `store/library.js`
```
state:   token, user
actions: login(username, password), logout(), loadProfile()  â€” selector `selectIsAdmin`
```
- `token` & `user` disimpan di `localStorage` (Zustand `persist`, dibungkus try/catch) supaya refresh halaman tidak logout.
- `logout()` menghapus token dan mengosongkan data buku/riwayat di store.
- Catatan keamanan (ditulis di README): token di `localStorage` rentan jika ada XSS; untuk produksi bisa diganti cookie `httpOnly`. Dipilih Bearer token agar sederhana.

### API client (`api/client.js`)
- Request interceptor: tambahkan `Authorization: Bearer <token>` dari store.
- Response interceptor: status `401` (selain dari `/auth/login`) â†’ `logout()` + arahkan ke `/login` dengan notice `Your session has expired. Sign in again.`

### Routing
```
/login      â†’ LoginPage (tanpa header & tabs)
/*          â†’ <RequireAuth> â†’ shell aplikasi (header, tabs, halaman)
```
- `RequireAuth` â€” belum login â†’ redirect ke `/login`, simpan halaman tujuan; setelah login kembali ke halaman itu.
- Sudah login lalu buka `/login` â†’ redirect ke `/`.

### Komponen
Design system tidak punya layar login, jadi **LoginPage disusun hanya dari komponen yang sudah ada** (Card, Field, Input, Button primary) dan aturan copy yang sama â€” tanpa warna/ukuran baru:
- Halaman: nama aplikasi `font-display text-[28px]` di atas card `max-w-[420px] mx-auto`
- Card: judul `Sign in` (`text-lg font-bold`), field **Username** dan **Password** (`type="password"`, `autoComplete`)
- Tombol primary **Sign in** (disabled saat proses)
- Validasi: `Enter your username.` / `Enter your password.`
- Error server tampil sebagai banner `bg-danger-soft text-danger`: `Incorrect username or password.`

Header (`AppHeader`):
- Kanan: `N copies on the shelf` Â· `Signed in as <name> (Admin|Staff)` Â· tombol ghost **Sign out**

Akses berbasis role di UI:
- Helper `useCan()` / `isAdmin` dari store.
- Role `user`: tombol **+ Add book** dan kolom **Remove** di BookTable tidak dirender; empty state Books tanpa tombol Add book.

## Test
- **BE**
  - `internal/handler/auth_test.go` â€” login benar â†’ 200 + token valid berisi role; password salah / username tidak ada â†’ 401 dengan pesan sama; body kosong â†’ 400; `GET /api/auth/me` dengan token â†’ 200 tanpa `passwordHash`
  - `internal/middleware/auth_test.go` â€” tanpa header â†’ 401; token rusak â†’ 401; token kedaluwarsa â†’ 401; token valid â†’ `UserFromContext` terisi; role `user` ke route admin â†’ 403; `admin` â†’ lolos
  - `internal/auth/password_test.go` â€” hash â‰  plain, compare benar/salah
- **FE**
  - `LoginPage.test.jsx` â€” validasi field kosong, error server tampil, sukses memanggil `login` dan pindah halaman
  - `RequireAuth.test.jsx` â€” belum login diarahkan ke `/login`
  - `client.test.js` â€” header Authorization terpasang; 401 memanggil `logout`

## Dampak ke Branch Lain
- **03 book-management** â€” `GET` butuh `Authenticate`; `POST`/`PATCH`/`DELETE` butuh `Authorize("admin")`; UI menyembunyikan aksi admin untuk role `user`; test memakai helper `testutil.AuthHeader(t, tokenSvc, role)`.
- **04 filter-sort** â€” endpoint `GET` butuh `Authenticate`.
- **05 lending** â€” `POST /api/lendings` butuh `Authenticate`; lending menyimpan `lentBy: { id, name }` (siapa yang memproses) dari `UserFromContext`.
- **06 history** â€” `GET /api/lendings` butuh `Authenticate`.
- **07 docker** â€” tambah `JWT_SECRET`, `JWT_EXPIRES_IN`, `SEED_*_PASSWORD` di compose.
- **08 docs** â€” sequence diagram login, kolom "Auth" di tabel endpoint, akun demo di README.

## Selesai jika
- [ ] `go run ./cmd/seed` membuat akun `admin` & `staff`
- [ ] Login dari UI berhasil; refresh tetap login; Sign out kembali ke `/login`
- [ ] Endpoint data tanpa token â†’ 401; role `user` ke endpoint admin â†’ 403
- [ ] Server menolak start tanpa `JWT_SECRET`
- [ ] Test BE (`go test ./...`) & FE (`npm test`) hijau

## Saran commit
`feat(auth): add jwt login with admin and user roles`
