# 06 — `feature/lending-history` (F9)

## Tujuan
Menampilkan riwayat semua transaksi peminjaman, terbaru di atas. UI mengikuti `HistoryTable` dan halaman History di `Screens/preview.html`.

> **Update:** tabel History ditambah kolom **Lent by** (nama user dari `lentBy`, siapa yang mengonfirmasi peminjaman) supaya buku yang hilang bisa dilacak ke staf yang meminjamkannya. Data ini dari token login di server, tidak bisa diisi dari browser. Belum dibuat (menunggu konfirmasi): filter riwayat per staf, dan pencatatan siapa yang menambah/mengedit/menghapus buku.

## Backend

### Endpoint

| Method | Path | Response |
|---|---|---|
| `GET` | `/api/lendings` | `200 { data: Lending[] }` urut `createdAt` desc |

- Akses: `Authenticate` (role `admin` & `user`); tanpa token → `401`.
- `LendingRepository.FindAll(ctx)`:
  ```go
  db.NewSelect().
      Model(&lendings).
      Relation("Items").
      Order("l.created_at DESC").
      Scan(ctx)
  ```
- Tidak perlu join ke `books` — judul sudah tersimpan sebagai snapshot di `lending_items.title` (dan `book_id` `ON DELETE SET NULL` sehingga walau buku dihapus, baris riwayat tetap utuh).
- Tanpa pagination (cukup untuk lingkup tes; disebut sebagai future improvement di README).

## Frontend

### Store — slice `history`
```
state:   history, historyLoading, historyError
actions: fetchHistory()
```
- Dipanggil saat HistoryPage mount dan setelah `confirmLending()` sukses.

### Komponen
- **HistoryPage** — `h2` "Lending history", loading / error state.
- **HistoryTable** — satu baris per transaksi (bukan per buku):
  - **Date** — tanggal konfirmasi (`createdAt`), `whitespace-nowrap`, format `11 Oct 2026`
  - **Borrower** — nama `font-semibold` + telepon `text-[13px] text-muted` di bawahnya
  - **Books** — daftar bertumpuk `"<title> ×<qty>"`
  - **Due** — `DueBadge`
  - **Lent by** — `lentBy.name` (`text-[13px] text-muted`)
  - Empty state: `No lending yet.`
- Tidak menambah status lain (mis. overdue) karena tidak ada di design system.

## Test
- **BE** `internal/handler/lending_history_test.go` — buat 2 lending, `GET /api/lendings` mengembalikan keduanya dengan urutan terbaru dulu (`created_at DESC`); `title` tetap ada walau buku sudah dihapus (`DELETE /api/books/:id`).
- **FE** `HistoryTable.test.jsx` — render baris & daftar `Title ×qty`, format tanggal, empty state.

## Selesai jika
- [ ] Peminjaman baru langsung terlihat di halaman History
- [ ] Test hijau

## Saran commit
`feat(lending): view lending history`
