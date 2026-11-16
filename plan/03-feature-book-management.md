# 03 — `feature/book-management` (F1, F2, F3 + seed)

## Tujuan
Tambah buku, hapus buku (dengan konfirmasi), lihat daftar buku, plus seed script data awal. UI mengikuti `BookTable`, `Button`, `Field`, `Badge` dan halaman Books di `Screens/preview.html`.

## Backend

### Migrasi — `internal/database/migrations/002_create_books.up.sql`
```sql
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT NOT NULL CHECK (genre IN ('Fiction', 'Science', 'History', 'Children', 'Technology', 'Biography')),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX books_title_lower_idx ON books (LOWER(title));
```
- `GENRES` = `Fiction, Science, History, Children, Technology, Biography` (sama dengan design system; simpan di `internal/constants/genres.go`).
- `LOWER(title)` unique karena peminjaman memilih buku berdasarkan judul (case-insensitive).
- `stock` boleh 0 di tabel (hasil peminjaman atau saat edit), tetapi saat **menambah** buku minimal 1 copy (aturan form "Copies").

### Model — `internal/model/book.go`

```go
type Book struct {
	bun.BaseModel `bun:"table:books,alias:b"`

	ID        uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Title     string    `bun:"title,notnull" json:"title"`
	Author    string    `bun:"author,notnull" json:"author"`
	Genre     string    `bun:"genre,notnull" json:"genre"`
	Stock     int       `bun:"stock,notnull" json:"stock"`
	CreatedAt time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}
```

### Endpoint

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/books` | — | `200 { data: Book[] }` |
| `GET` | `/api/books/overview` | — | `200 { data: { totalBooks, totalCopies } }` |
| `POST` | `/api/books` | `{ title, author, genre, stock }` | `201 { data: Book }` |
| `PATCH` | `/api/books/:id` | sebagian dari `{ title, author, genre, stock }` (stock ≥ 0) | `200 { data: Book }` |
| `DELETE` | `/api/books/:id` | — | `204` |

- `overview` dipakai header/sidebar "N copies on the shelf" (selalu total seluruh perpustakaan, tidak terpengaruh filter).
- Daftarkan `/overview` **sebelum** `/{id}` (atau pastikan `chi` mencocokkan route statis lebih dulu).

Akses (lihat `02b-feature-auth.md`):
- `GET /api/books`, `GET /api/books/overview` → `Authenticate` (role `admin` & `user`)
- `POST`, `PATCH`, `DELETE` → `Authenticate` + `Authorize("admin")`

Error:
- `401` belum login / token tidak valid
- `403` role `user` mencoba tambah/edit/hapus buku
- `400` body tidak valid / id bukan UUID valid
- `404` buku tidak ditemukan saat edit/delete
- `409` judul sudah ada → pesan `"A book with this title already exists."`

### Validasi (`validator/v10` + DTO)
- `CreateBookInput`: `Title` (trim, wajib), `Author` (trim, wajib), `Genre` (oneof `GENRES`), `Stock` (`int`, wajib, `>= 1`).
- `UpdateBookInput`: pakai **pointer fields** (`Title *string`, `Author *string`, `Genre *string`, `Stock *int`) supaya `stock: 0` bisa dibedakan dari field yang tidak dikirim; minimal satu field terisi, `Stock >= 0`.

### File

```
internal/constants/genres.go
internal/model/book.go
internal/repository/book_repo.go
  FindAll(ctx, filter, sort)    # filter & sort dipakai di branch 4
  FindByID(ctx, id) / FindByIDs(ctx, ids)
  GetOverview(ctx)              # SELECT COUNT(*), COALESCE(SUM(stock), 0)
  Create(ctx, book)
  Update(ctx, book)             # Bun NewUpdate().WherePK().Returning("*")
  DeleteByID(ctx, id)           # cek RowsAffected() == 0 → sql.ErrNoRows
internal/service/book_service.go
  ListBooks(ctx)
  GetOverview(ctx)
  CreateBook(ctx, input)        # map unique_violation (23505) → apperror.Conflict
  UpdateBook(ctx, id, input)    # map 404 & 409
  DeleteBook(ctx, id)           # apperror.NotFound jika RowsAffected == 0
internal/handler/book_handler.go
```

### Seed — `cmd/seed/main.go`
- Bagian users sudah ada dari branch 2b (upsert akun `admin` & `staff`); branch ini menambah bagian books.
- Jalankan dalam transaksi (`db.RunInTx`): hapus data `books` (dan `lendings` bila sudah ada) lalu bulk insert via Bun (`db.NewInsert().Model(&books).Exec(ctx)`) dari data embed `internal/seed/data/books.json`.
- Data awal mengikuti prototype (stok bervariasi termasuk 0, 1, 2 agar semua status badge terlihat):

  | Title | Author | Genre | Stock |
  |---|---|---|---|
  | River of Salt | Adaeze Okafor | Fiction | 2 |
  | The Pragmatic Gardener | Lena Ortiz | Science | 6 |
  | Tiny Dragons at Bedtime | Sam Hart | Children | 0 |
  | A Short History of Tea | Mira Chen | History | 4 |
  | Clean Interfaces | Joel Barros | Technology | 3 |
  | Letters from the Harbour | Nadia Rahman | Fiction | 8 |
  | The Quiet Mathematician | Ola Berg | Biography | 1 |

- Log jumlah buku, lalu tutup koneksi DB.

> **Update:** form tambah buku menjadi **modal** (`BookFormDialog`, dipakai juga untuk **Edit book**). Tombol baris: secondary kecil **Edit** + danger-quiet **Remove**. Notice edit: `Saved changes to “<title>”.` Edit boleh stok 0 (`Enter a whole number, 0 or more.`). Judul di riwayat peminjaman tidak ikut berubah (snapshot).

## Frontend

### Store — slice `books` di `store/library.js`
```
state:   books, overview: { totalBooks, totalCopies }, booksLoading, booksError
actions: fetchBooks(), fetchOverview(), addBook(payload), removeBook(id)
```
- Setelah `addBook` / `removeBook` → refetch `books` + `overview`, set `notice`:
  - `Added “<title>”.`
  - `Removed “<title>”.`

### API — `api/books.api.js`
`getBooks(params)`, `getOverview()`, `createBook(payload)`, `deleteBook(id)`

### Komponen (copy persis dari prototype)
- **BooksPage**
  - Baris judul: `h2` "Books" (`font-display text-[28px] font-semibold leading-[34px]`) + tombol primary **"+ Add book"**
  - Form tambah inline (muncul saat tombol diklik), lalu tabel
- **AddBookForm** — card `grid gap-4 sm:grid-cols-2`, judul "Add a book"
  - Fields: **Title**, **Author**, **Genre** (select `GENRES`, default Fiction), **Copies** (number, min 1, default 1)
  - Validasi saat submit (`noValidate`):
    - Title kosong → `Enter the book title.`
    - Author kosong → `Enter the author.`
    - Copies bukan integer ≥ 1 → `Enter a whole number, 1 or more.`
  - Tombol: secondary **Cancel** (reset form) + primary **Save book**
  - Error dari server (mis. 409) ditampilkan di bawah field Title
- **BookTable**
  - Kolom: **Title** (judul `font-display` + author `text-[13px] text-muted` di bawahnya), **Genre** (`GenreBadge`), **Stock** (rata kanan, `tabular-nums`, angka tebal + `StockBadge`), kolom aksi (`sr-only` "Actions")
  - Tombol baris: danger-quiet kecil **Remove** dengan `aria-label="Remove <title>"`
  - Empty state: `No books yet. Add your first book.`
- **RemoveBookDialog** (pakai `Dialog`)
  - Judul: `Remove this book?`
  - Isi: `“<title>” and its N copies will be removed from the library. Past lending history is kept.` (`copy` jika 1)
  - Tombol: secondary **Cancel** + danger **Remove book**
- **Sidebar** — "N copies on the shelf" dari `overview.totalCopies` (di bawah tanggal; dulu di header sebelum layout sidebar).
- **Role `user`** — tombol **+ Add book**, form tambah, dan kolom Remove tidak dirender; empty state hanya teks `No books yet.` (tanpa ajakan menambah buku).

## Test
- **BE** `internal/handler/book_test.go` (`httptest` + test Postgres DB):
  - POST valid → 201; tanpa title / genre di luar enum / stock 0 → 400; judul duplikat (termasuk beda huruf besar/kecil) → 409
  - PATCH partial update (termasuk `stock: 0`) → 200; judul duplikat → 409; id tidak ada → 404
  - GET mengembalikan buku yang dibuat (dengan UUID `id` string)
  - `overview` menghitung total buku & total copy
  - DELETE → 204; id tidak ada → 404; id bukan UUID → 400
  - Akses: tanpa token → 401; token role `user` ke POST/PATCH/DELETE → 403; role `user` ke GET → 200 (pakai helper `testutil.AuthHeader`)
- **FE**:
  - `AddBookForm.test.jsx` — pesan validasi persis muncul; submit valid memanggil `addBook`
  - `BookTable.test.jsx` — render baris & badge sesuai stok, empty state, klik Remove membuka dialog dengan nama buku
  - `RemoveBookDialog.test.jsx` — Cancel tidak menghapus, "Remove book" memanggil `removeBook`
  - `BooksPage.role.test.jsx` — role `user` tidak melihat tombol Add book & Remove

## Selesai jika
- [ ] `go run ./cmd/seed` mengisi data, tampil di halaman Books
- [ ] Tambah, edit & hapus buku berfungsi dari UI, notice muncul, jumlah copy di sidebar ter-update
- [ ] Tampilan cocok dengan `Screens/preview.html` (light & dark)
- [ ] Test BE (`go test ./...`) & FE (`npm test`) hijau

## Saran commit
`feat(books): add, remove and list books with seed script`
