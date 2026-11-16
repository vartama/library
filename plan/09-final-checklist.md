# 09 — Final Checklist (sebelum submit)

## Repo
- [ ] Semua branch sudah di-merge ke `main` dan `main` sudah di-push
- [ ] Repo GitLab **private**
- [ ] `rsft.leaders@gmail.com` ditambahkan sebagai **Developer**
- [ ] `task.md` & `gitlab.md` tidak ada di repo (`git ls-files | grep -E "task.md|gitlab.md"` kosong)
- [ ] Tidak ada nama/brand terlarang (lihat daftar di `task.md`) di file **maupun** riwayat commit:
  ```bash
  git grep -i -E "<nama-1>|<nama-2>|<nama-3>"
  git log --all -i -E --grep="<nama-1>|<nama-2>|<nama-3>"
  ```
  Cek juga nama package di `package.json`, judul halaman (`index.html`), dan gambar.
- [ ] Tidak ada `.env` asli / secret ter-commit (hanya `.env.example`)

## Kualitas
- [ ] `go test ./...` dan `go vet ./...` hijau di `backend/`
- [ ] `npm test` hijau dan `npm run build` sukses di `frontend/`
- [ ] `npm audit` (frontend) tanpa temuan high/critical; `npm ls axios` → `1.20.0`
- [ ] UI cocok dengan `mei-library-design-system/components/Screens/preview.html` (copy, warna, light & dark)
- [ ] Clone bersih → ikuti README → aplikasi jalan (lokal & Docker)

## Fitur (uji manual)
- [ ] F1 Tambah buku
- [ ] F2 Hapus buku
- [ ] F3 List buku
- [ ] F4 Filter genre
- [ ] F5 Sort title & stock
- [ ] F6 Pinjam multi-buku (title, qty, nama, telepon, due date)
- [ ] F7 Stok berkurang otomatis; qty > stok ditolak
- [ ] F8 Ringkasan sebelum konfirmasi
- [ ] F9 Riwayat peminjaman
- [ ] Login `admin` → bisa tambah/hapus buku
- [ ] Login `staff` → tidak ada tombol tambah/hapus; request langsung ke API → 403
- [ ] Tanpa login → diarahkan ke halaman Sign in; API → 401

## Screenshot untuk email
0. Halaman Sign in
1. Halaman Books sebagai admin (list + form "Add a book")
1b. Halaman Books sebagai staff (tanpa tombol tambah/hapus)
2. Dialog "Remove this book?"
3. Chip genre aktif
4. Sort by stock
5. Form Lend books dengan ≥ 2 buku + contoh pesan validasi
6. Lending summary — step 2 of 2 (F8)
7. Books setelah konfirmasi (notice "Lending confirmed. Stock has been updated." + stok berkurang)
8. Halaman Lending history
9. (opsional) Tema gelap
10. (opsional) `docker compose ps` / Docker Desktop menampilkan container berjalan

## Email
- Kepada: `rsft.leaders@gmail.com`
- Subject: `Recruitment Test Full Stack - [Nama Lengkap] [Nama Vendor]`
- Isi: link repo GitLab private + screenshot terlampir + akun demo (`admin` / `staff`)
