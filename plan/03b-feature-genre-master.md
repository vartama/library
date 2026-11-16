# 03b — `feature/genre-master` (master data genre)

## Tujuan
Genre bukan lagi daftar tetap di kode, melainkan **master data** yang dikelola admin dari menu **Genres**. Buku menyimpan **referensi (id)** ke genre, sehingga mengganti nama genre langsung berlaku di semua bukunya.

## Backend

### Migrasi — `internal/database/migrations/003_create_genres.up.sql`
```sql
CREATE TABLE genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX genres_name_lower_idx ON genres (LOWER(name));

-- Backfill jika sudah ada buku dari branch 03
INSERT INTO genres (name)
SELECT DISTINCT genre FROM books
ON CONFLICT DO NOTHING;

ALTER TABLE books ADD COLUMN genre_id UUID REFERENCES genres(id) ON DELETE RESTRICT;

UPDATE books b
SET genre_id = g.id
FROM genres g
WHERE LOWER(b.genre) = LOWER(g.name);

ALTER TABLE books ALTER COLUMN genre_id SET NOT NULL;
ALTER TABLE books DROP COLUMN genre;

CREATE INDEX books_genre_id_idx ON books (genre_id);
```
- `ON DELETE RESTRICT` mencegah genre dihapus di level DB selama masih dipakai buku; service juga mengecek `CountByGenre` untuk mengembalikan pesan 409 yang ramah.

### Model — `internal/model/genre.go` & update `Book`
```go
type Genre struct {
	bun.BaseModel `bun:"table:genres,alias:g"`

	ID        uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name      string    `bun:"name,notnull" json:"name"`
	CreatedAt time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

// GenreSummary untuk response di Book.genre dan GET /api/genres
type GenreSummary struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	BookCount *int      `json:"bookCount,omitempty"`
}
```
- `Book` memakai `GenreID uuid.UUID \`bun:"genre_id,notnull,type:uuid" json:"-"\`` + relasi Bun `Genre *Genre \`bun:"rel:belongs-to,join:genre_id=id"\``.
- Response JSON buku selalu mengembalikan `genre: { id, name }` (via DTO `BookResponse` atau custom struct tag di `Genre` summary) agar konsisten dengan kontrak frontend.

### Endpoint
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| `GET` | `/api/genres` | login | `[{ id, name, bookCount }]`, urut `LOWER(name)` |
| `POST` | `/api/genres` | admin | `{ name }` → 201; nama kosong 400; duplikat 409 |
| `PATCH` | `/api/genres/:id` | admin | rename; duplikat 409; tidak ada 404 |
| `DELETE` | `/api/genres/:id` | admin | 204; **masih dipakai buku → 409** `“Fiction” still has 2 books. Move or remove them first.` |

Perubahan endpoint buku:
- Body `POST/PATCH /api/books` memakai **`genreId`** (UUID, bukan nama). Format bukan UUID atau genre tidak ada → `400 { "message": "Validation failed.", "details": [{ "field": "genreId", "message": "Choose a genre." }] }`.

### File
```
internal/model/genre.go
internal/repository/genre_repo.go   # FindAllWithBookCount (LEFT JOIN books + GROUP BY), FindByID, Create, UpdateName, DeleteByID
internal/repository/book_repo.go    # + Relation("Genre") di FindAll/FindByID, CountByGenre(ctx, genreID)
internal/service/genre_service.go   # ListGenres, CreateGenre, UpdateGenre, DeleteGenre (cek dipakai)
internal/handler/genre_handler.go
internal/seed/data/genres.json      # 6 genre awal (menggantikan constants/genres.go)
```

### Seed
Genre dan buku di-seed ulang dalam satu transaksi: hapus `lendings`/`books`/`genres`, insert genre dari `genres.json`, lalu petakan nama genre buku → `genre_id`.

> Data lama (tanpa tabel `genres`) otomatis dimigrasikan oleh `003_create_genres.up.sql`, atau jalankan ulang `go run ./cmd/seed`.

## Frontend
- Menu sidebar **Genres** (bagian Collection), **hanya admin**. `RequireAdmin` mengarahkan role lain ke Books.
- Halaman Genres: tabel **Genre** (badge) | **Books** (jumlah) | **Rename** / **Remove**.
- Modal **Add a genre** / **Rename genre** (field Name; hint saat rename: `Every book in this genre shows the new name.`).
- **Remove**: genre tanpa buku → konfirmasi `Remove this genre?`; genre yang masih dipakai → dialog `This genre is still in use` yang menjelaskan alasannya (tanpa tombol hapus).
- Notice: `Added genre “…”.`, `Saved changes to “…”.`, `Removed genre “…”.`
- Form buku: pilihan genre diambil dari API (default genre pertama); payload `genreId`.
- Store: slice `genres` (`fetchGenres`, `addGenre`, `updateGenre`, `removeGenre`); perubahan buku ikut me-refresh `bookCount` genre, rename genre ikut me-refresh daftar buku.

## Test
- BE `internal/handler/genre_test.go` (list + bookCount, CRUD, duplikat case-insensitive, tolak hapus yang dipakai, akses) dan update `internal/handler/book_test.go` (`genreId`, genre tidak ada, rename terlihat di buku).
- FE `tests/genres.test.jsx` (list, tambah, validasi, duplikat, rename, hapus, genre dipakai, staff diarahkan ke Books).

## Saran commit
`feat(genres): manage genres as master data`
