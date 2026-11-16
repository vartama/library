# 04 — `feature/book-filter-sort` (F4, F5)

> **Update setelah 03b (genre master):** filter memakai **id genre** (`?genreId=`), bukan nama. Chip genre diambil dari `GET /api/genres` (yang `bookCount > 0`), jadi `overview.genres` tidak diperlukan.

> **Implementasi:** `GET /api/books?genreId=&sortBy=title|stock&order=asc|desc` (default title asc; stock memakai tie-break title). Store `filters` + `setGenre`, `setSort`, `toggleSort`; hanya respons request terbaru yang dipakai. FilterBar disembunyikan saat perpustakaan kosong.
>
> **Update:** select **Sort by** dihapus atas permintaan user — sort (F5) hanya lewat header kolom **Title** dan **Stock**. Filter genre berupa **select** (`All genres` + genre yang punya buku), bukan chip; keterangan jumlah hasil (`N books`) dihapus — juga atas permintaan user.

## Tujuan
Filter buku berdasarkan genre dan sort berdasarkan title atau stock. Proses filter & sort dilakukan di server (query PostgreSQL via Bun ORM). UI mengikuti `FilterBar` dan header tabel di `BookTable`.

## Backend

### Endpoint

| Method | Path | Query | Response |
|---|---|---|---|
| `GET` | `/api/books` | `genreId?`, `sortBy?=title\|stock`, `order?=asc\|desc` | `200 { data: Book[] }` |
| `GET` | `/api/books/overview` | — | `200 { data: { totalBooks, totalCopies } }` |

- Kedua endpoint memakai `Authenticate` (role `admin` & `user`).
- Default: tanpa filter, `sortBy=title`, `order=asc`.
- `genreId` (jika diisi) harus berupa UUID valid → jika bukan UUID → `400`.
- `sortBy` (`title` \| `stock`) & `order` (`asc` \| `desc`) di luar whitelist → `400` (`validator` / explicit whitelist map).
- Query Bun:
  - Filter: `if filter.GenreID != nil { q.Where("b.genre_id = ?", *filter.GenreID) }`
  - Sort title (case-insensitive, tidak bergantung locale OS): `ORDER BY LOWER(b.title) ASC/DESC, b.id ASC`
  - Sort stock dengan tie-break title: `ORDER BY b.stock ASC/DESC, LOWER(b.title) ASC, b.id ASC`
  - **Penting:** jangan pernah menginterpolasi `sortBy` / `order` langsung ke `OrderExpr` tanpa mapping whitelist ke kolom SQL eksplisit (`switch` ke ekspresi tetap) agar aman dari SQL injection.

### File yang diubah
- `internal/handler/book_handler.go` — parse & validasi query (`genreId`, `sortBy`, `order`)
- `internal/repository/book_repo.go` — `FindAll(ctx, BookFilter{GenreID}, BookSort{SortBy, Order})`
- `internal/service/book_service.go` — `ListBooks(ctx, query)`

## Frontend

### Store — slice `books`
```
state tambahan: filters: { genre: 'All genres', sortBy: 'title', order: 'asc' }
actions:        setGenre(genre), setSort(sortBy, order), toggleSort(column)
                → masing-masing memanggil fetchBooks() dengan filter aktif
```
- Jika genre yang aktif tidak ada lagi di `overview.genres` (mis. buku terakhir genre itu dihapus) → reset ke `All genres`.
- `toggleSort(column)`: kolom sama → balik arah; kolom berbeda → kolom itu dengan arah asc.

### Komponen — `FilterBar.jsx` (di atas tabel)
- Kiri: label **Genre** + chip single-select (recipe **Chip**, `aria-pressed`): `All genres` (default) + `overview.genres`
- Kanan: jumlah hasil `aria-live="polite"` — `N books` / `1 book` — dan select **Sort by** (`w-56`) dengan 4 opsi:
  - `Title (A–Z)` → `title:asc` (default)
  - `Title (Z–A)` → `title:desc`
  - `Stock (low to high)` → `stock:asc`
  - `Stock (high to low)` → `stock:desc`

### Perubahan `BookTable`
- Header **Title** dan **Stock** menjadi tombol dengan `aria-sort` (`ascending` / `descending` / `none`) dan indikator `▲` / `▼` / `↕`.
- Tetap sinkron dengan select Sort by (state sama di store).
- Empty state saat filter aktif tapi kosong: `No books in this genre.`

## Test
- **BE** `internal/handler/book_query_test.go`:
  - filter `genreId` hanya mengembalikan buku di genre tsb
  - sort title asc/desc (case-insensitive) dan stock asc/desc urut benar (termasuk tie-break title)
  - `sortBy=price` / `order=random` / `genreId=invalid-uuid` → 400
- **FE**:
  - `FilterBar.test.jsx` — klik chip memanggil `setGenre`, ganti select memanggil `setSort`, jumlah hasil tampil benar
  - `BookTable.sort.test.jsx` — klik header Title dua kali membalik arah, `aria-sort` berubah

## Selesai jika
- [ ] Filter genre & sort title/stock berfungsi dari chip, select, dan header tabel, ketiganya sinkron
- [ ] Test hijau

## Saran commit
`feat(books): filter books by genre and sort by title or stock`
