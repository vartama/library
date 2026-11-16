# 05 — `feature/lending` (F6, F7, F8)

## Tujuan
Meminjamkan beberapa buku sekaligus ke satu peminjam, menampilkan ringkasan (langkah 2 dari 2) sebelum konfirmasi, dan stok **hanya** berkurang saat konfirmasi. UI mengikuti `LendingForm`, `LendingSummary`, `Field` dan halaman Lend books di `Screens/preview.html`.

> **Implementasi:**
> - Response lending: `dueDate` sebagai `"YYYY-MM-DD"` (tanggal kalender, aman lintas zona waktu); `items: [{ bookId, title, quantity }]`; `lentBy: { id, name }`.
> - Buku yang sudah tidak ada → `404` "Some of these books are no longer in the library."; buku duplikat → `400` di `items.N.bookId` "This book is already in the list."
> - Dua peminjaman bersamaan untuk copy terakhir: satu `201`, satu `409`, stok tidak pernah negatif (ada test-nya).
> - Ringkasan: setelah `409`, stok terbaru dimuat ulang; baris yang kurang ditandai `Only N available` dan **Confirm lending dinonaktifkan** sampai diubah lewat Back to edit.
> - Seed ulang juga mengosongkan riwayat peminjaman (id buku berubah).

## Backend

### Migrasi — `internal/database/migrations/004_create_lendings.up.sql`
```sql
CREATE TABLE lendings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  due_date DATE NOT NULL,
  lent_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lent_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lending_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lending_id UUID NOT NULL REFERENCES lendings(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1)
);

CREATE INDEX lendings_created_at_idx ON lendings (created_at DESC);
CREATE INDEX lending_items_lending_id_idx ON lending_items (lending_id);
```
- `lending_items.title` disimpan sebagai teks snapshot agar riwayat tetap utuh walau buku dihapus (aturan `HistoryTable`).
- `lending_items.book_id` memakai `ON DELETE SET NULL` (bukan `RESTRICT`) agar buku yang pernah dipinjam tetap bisa dihapus oleh admin tanpa merusak riwayat peminjaman.
- `due_date` memakai tipe SQL `DATE` dan selalu diserialisasi sebagai `"YYYY-MM-DD"` (aman lintas zona waktu).

### Model — `internal/model/lending.go`

```go
type Lending struct {
	bun.BaseModel `bun:"table:lendings,alias:l"`

	ID           uuid.UUID      `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	BorrowerName string         `bun:"borrower_name,notnull" json:"borrowerName"`
	PhoneNumber  string         `bun:"phone_number,notnull" json:"phoneNumber"`
	DueDate      time.Time      `bun:"due_date,type:date,notnull" json:"-"`
	LentByID     *uuid.UUID     `bun:"lent_by_id,type:uuid" json:"-"`
	LentByName   string         `bun:"lent_by_name,notnull" json:"-"`
	CreatedAt    time.Time      `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	Items        []*LendingItem `bun:"rel:has-many,join:id=lending_id" json:"items"`
}

type LendingItem struct {
	bun.BaseModel `bun:"table:lending_items,alias:li"`

	ID        uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"-"`
	LendingID uuid.UUID  `bun:"lending_id,type:uuid,notnull" json:"-"`
	BookID    *uuid.UUID `bun:"book_id,type:uuid" json:"bookId"`
	Title     string     `bun:"title,notnull" json:"title"`
	Quantity  int        `bun:"quantity,notnull" json:"quantity"`
}
```
Response JSON dipetakan lewat DTO `LendingResponse` sehingga menghasilkan:
- `dueDate`: `DueDate.Format("2006-01-02")` (`"YYYY-MM-DD"`)
- `lentBy`: `{ "id": ..., "name": ... }`
- `items`: `[{ "bookId": ..., "title": ..., "quantity": ... }]`

### Endpoint

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/lendings` | lihat di bawah | `201 { data: Lending }` |

Akses: `Authenticate` (role `admin` & `user` boleh meminjamkan). Tanpa token → `401`.

```json
{
  "borrowerName": "Budi Santoso",
  "phoneNumber": "0812 3456 7890",
  "dueDate": "2026-10-25",
  "items": [
    { "bookId": "550e8400-e29b-41d4-a716-446655440001", "quantity": 2 },
    { "bookId": "550e8400-e29b-41d4-a716-446655440002", "quantity": 1 }
  ]
}
```

### Validasi (disamakan dengan design system)
- `borrowerName` wajib (trim, tidak kosong)
- `phoneNumber`: setelah membuang spasi, `+`, `-`, `(`, `)` harus **9–15 digit** (`^\d{9,15}$`)
- `dueDate`: format `YYYY-MM-DD`, **setelah hari ini** (bandingkan tanggal kalender terhadap `time.Now()` pada zona waktu server `TZ`)
- `items` minimal 1, `bookId` UUID valid, `quantity` integer ≥ 1
- `bookId` tidak boleh duplikat dalam satu transaksi → `400` di field `items.<N>.bookId`: `"This book is already in the list."`

### Alur service — `LendingService.CreateLending(ctx, payload, currentUser)` (F7)
Seluruh proses dibungkus dalam **transaksi ACID PostgreSQL** (`db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error { ... })`):
1. Urutkan `bookIDs` secara deterministik (`slices.Sort` berdasarkan string UUID) untuk mencegah deadlock saat dua transaksi bersamaan meminjam buku yang sama dalam urutan berbeda.
2. Lock & ambil baris buku via `tx.NewSelect().Model(&books).Where("id IN (?)", bun.In(bookIDs)).Order("id ASC").For("UPDATE").Scan(ctx)`:
   - Jika ada buku yang tidak ditemukan (`len(books) != len(bookIDs)`) → return `404` `"Some of these books are no longer in the library."` (transaksi otomatis rollback).
3. Cek stok semua item: kumpulkan item dengan `quantity > book.Stock`. Jika ada → return `409` `"Not enough copies available."` + `details: [{ bookId, title, requested, available }]` (transaksi otomatis rollback, stok sama sekali tidak berubah).
4. Kurangi stok setiap item di dalam `tx`:
   ```go
   res, err := tx.NewUpdate().
       Model((*model.Book)(nil)).
       Set("stock = stock - ?", item.Quantity).
       Set("updated_at = NOW()").
       Where("id = ? AND stock >= ?", item.BookID, item.Quantity).
       Exec(ctx)
   ```
   (Jika `RowsAffected == 0`, kembalikan `409` → rollback otomatis).
5. Insert ke `lendings` dan `lending_items` (`title` snapshot dari langkah 2, `lent_by_id` & `lent_by_name` dari `currentUser`) di dalam `tx`.
6. Commit transaksi; return `LendingResponse`.

> Berbeda dengan MongoDB tanpa replica set, PostgreSQL + Bun ORM mendukung transaksi ACID penuh + row-level lock (`FOR UPDATE`), sehingga rollback terjadi otomatis oleh database dan stok tidak pernah negatif.

### File
```
internal/model/lending.go
internal/repository/lending_repo.go   # CreateWithItemsTx(ctx, tx, lending, items), FindAll(ctx) (branch 6)
internal/repository/book_repo.go      # + FindByIDsForUpdateTx(ctx, tx, ids), DecrementStockTx(ctx, tx, id, qty)
internal/service/lending_service.go   # CreateLending (db.RunInTx)
internal/handler/lending_handler.go   # Create + request validation (phone, dueDate, duplicate bookId)
```

## Frontend

### Data buku untuk form
Form butuh **semua** buku (termasuk stok 0, ditampilkan disabled), tidak terpengaruh filter halaman Books. Slice `books` menambah `catalog` (hasil `GET /api/books?sortBy=title&order=asc`) + `fetchCatalog()`.

### Store — slice `lending`
```
state:   lines: [{ bookId: '', quantity: '1' }],
         borrower: { borrowerName: '', phoneNumber: '', dueDate: '' },
         errors, step: 'edit' | 'review', submitting, submitError
actions: addLine(), removeLine(i), updateLine(i, partial), setBorrowerField(name, value),
         review()          → validasi; jika lolos step = 'review'
         backToEdit()      → step = 'edit' (semua nilai tetap)
         confirmLending()  → POST, lalu reset form, refetch books/overview/catalog(/history),
                             setNotice('Lending confirmed. Stock has been updated.'), navigate('/')
```
- Saat meninggalkan tab Lend books → `step` kembali ke `edit` (isi form tetap), sesuai prototype.
- Validasi di `lib/lendingValidation.js` (pure function, mudah dites), pesan persis dari prototype:
  - buku belum dipilih → `Choose a book.`
  - quantity bukan integer ≥ 1 → `Enter a whole number, 1 or more.`
  - quantity > stok → `Only N available.`
  - nama kosong → `Enter the borrower's name.`
  - telepon tidak 9–15 digit → `Enter a phone number with 9–15 digits.`
  - due date kosong → `Choose a due date.`; ≤ hari ini → `Due date must be after today.`

### Komponen
- **LendPage**
  - `h2` "Lend books"
  - Jika tidak ada buku dengan stok > 0 → card `Nothing available to lend. Add stock on the Books page.`
  - `step === 'edit'` → `LendingForm`; `step === 'review'` → `LendingSummary`
- **LendingForm** (card `flex flex-col gap-6`, `noValidate`)
  - Bagian "Books to lend" (`text-lg font-bold`), satu baris per buku (`LendingLine`):
    - **Book title** — select `Select a book…` + opsi `"<title> (N available)"`; stok 0 dan judul yang sudah dipilih di baris lain → `disabled`
    - **Quantity** (`w-28`, number min 1) dengan hint `Max N` setelah buku dipilih
    - **Remove** (danger-quiet kecil) hanya jika baris > 1
  - Tombol secondary kecil **+ Add another book** — disabled jika jumlah baris ≥ jumlah buku yang tersedia
  - Grid `sm:grid-cols-3`: **Borrower's name**, **Phone number** (`inputMode="tel"`, placeholder `e.g. 0812 3456 7890`), **Due date** (`type="date"`, hint `Must be after today.`)
  - Tombol accent **Review lending** (rata kanan). Tidak pernah "Lend".
- **LendingSummary** (F8) — card `max-w-[680px]`
  - Header `bg-brand-soft`: `Step 2 of 2 · Check before confirming` (`text-brand-text`) + judul `Lending summary` (`font-display`)
  - `dl`: **Borrower**, **Phone**, **Due date** (`DueBadge`, format `11 Oct 2026`)
  - Tabel: **Book** | **Qty** | **Stock after** (`N → N-qty`), angka rata kanan `tabular-nums`
  - Footer: `Total: X copies · Y titles` (singular `copy` / `title`)
  - Tombol: ghost **Back to edit** + primary **Confirm lending** (disabled selama `submitting`)
  - Error server (mis. 409) tampil sebagai banner `bg-danger-soft text-danger` di dalam card, beserta detail buku yang kurang

## Test
- **BE** `internal/handler/lending_test.go`:
  - sukses → 201, stok tiap buku berkurang sesuai qty, `title` snapshot & `lentBy` tersimpan
  - tanpa token → 401; role `user` → 201 (boleh meminjamkan)
  - qty > stok → 409 + `details`, **stok semua buku tidak berubah** (atomik)
  - `bookId` tidak ada → 404; `bookId` duplikat → 400 di `items.1.bookId`; `bookId` bukan UUID → 400
  - telepon `12345` / dueDate hari ini / items kosong → 400; telepon `0812 3456 7890` → valid
  - konkurensi (`sync.WaitGroup` 2 goroutine paralel untuk copy terakhir): tepat satu `201` dan satu `409`, stok akhir `0` (tidak negatif)
- **FE**:
  - `lendingValidation.test.js` — setiap pesan error di atas
  - `LendingForm.test.jsx` — tambah/hapus baris, judul terpakai & stok 0 disabled, hint `Max N`
  - `LendingSummary.test.jsx` — data tampil benar, `Stock after` benar, total copies/titles, Back tidak memanggil API, Confirm memanggil `confirmLending`

## Selesai jika
- [ ] Bisa meminjam ≥ 2 buku dalam satu transaksi dari UI
- [ ] Ringkasan tampil sebelum data dikirim; Back to edit menyimpan semua isian
- [ ] Setelah konfirmasi: kembali ke Books dengan notice, stok & jumlah copy ter-update
- [ ] Peminjaman melebihi stok ditolak (client & server)
- [ ] Test hijau

## Saran commit
`feat(lending): lend multiple books with review step and stock deduction on confirm`
