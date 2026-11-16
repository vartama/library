# 02 â€” `chore/frontend-setup`

## Tujuan
Fondasi frontend React + Tailwind yang mengikuti `mei-library-design-system/` persis: tema (light/dark), font, shell aplikasi (header + tabs), komponen dasar, store, dan axios client.

> **Update (feature/auth):** layout tab diganti top bar + sidebar â€” lihat bagian "Penyimpangan" di `00-overview.md`. Komponen: `TopBar`, `Sidebar` (drawer < 768px), `ThemeToggle`, `UserMenu`, `ui/Icon`; `Tabs` dan `AppHeader` dihapus.

## Struktur Folder

```
frontend/
â”œâ”€â”€ index.html                # link Google Fonts (Figtree + Fraunces), <title>
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â””â”€â”€ client.js         # instance axios + interceptor error
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ ui/
â”‚   â”‚   â”‚   â”œâ”€â”€ Button.jsx    # variant: primary | accent | secondary | ghost | danger | danger-quiet; size: md | sm
â”‚   â”‚   â”‚   â”œâ”€â”€ Field.jsx     # label + control + error/hint (aria-invalid, aria-describedby)
â”‚   â”‚   â”‚   â”œâ”€â”€ Input.jsx     # + Select.jsx â€” recipe "Input / select"
â”‚   â”‚   â”‚   â”œâ”€â”€ Badge.jsx     # GenreBadge, StockBadge, DueBadge
â”‚   â”‚   â”‚   â”œâ”€â”€ Card.jsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Table.jsx     # Table, THead, TBody, Tr, Th, Td (+ kartu bertumpuk < 640px)
â”‚   â”‚   â”‚   â”œâ”€â”€ Dialog.jsx    # modal (role="dialog", aria-modal, shadow-pop)
â”‚   â”‚   â”‚   â”œâ”€â”€ Notice.jsx    # banner status (info / danger)
â”‚   â”‚   â”‚   â””â”€â”€ PageHeader.jsx # judul halaman + aksi di kanan
â”‚   â”‚   â”œâ”€â”€ AppHeader.jsx     # "Vartama Library" + "N copies on the shelf"
â”‚   â”‚   â””â”€â”€ Tabs.jsx          # Books | Lend books | History
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ classes.js        # string class recipes dari tailwind.md (satu tempat)
â”‚   â”‚   â”œâ”€â”€ stock.js          # stockStatus(n): out (0) | low (1â€“2) | ok (â‰¥3)
â”‚   â”‚   â”œâ”€â”€ date.js           # formatDate() â†’ "11 Oct 2026" (en-GB), todayISO()
â”‚   â”‚   â””â”€â”€ constants.js      # GENRES: Fiction, Science, History, Children, Technology, Biography
â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”œâ”€â”€ BooksPage.jsx     # placeholder
â”‚   â”‚   â”œâ”€â”€ LendPage.jsx      # placeholder
â”‚   â”‚   â””â”€â”€ HistoryPage.jsx   # placeholder
â”‚   â”œâ”€â”€ store/
â”‚   â”‚   â””â”€â”€ library.js        # satu store Zustand (diisi bertahap di branch fitur)
â”‚   â”œâ”€â”€ theme.js              # set data-theme di <html> sesuai prefers-color-scheme
â”‚   â”œâ”€â”€ App.jsx               # shell: header, tabs, notice, <Routes>
â”‚   â”œâ”€â”€ main.jsx
â”‚   â””â”€â”€ index.css             # blok tema dari tailwind.md (copy persis)
â”œâ”€â”€ tests/
â”‚   â””â”€â”€ setup.js              # import '@testing-library/jest-dom'
â”œâ”€â”€ tailwind.config.js
â”œâ”€â”€ postcss.config.js
â”œâ”€â”€ .env.example
â”œâ”€â”€ vite.config.js            # + konfigurasi vitest (jsdom, setupFiles)
â””â”€â”€ package.json
```

## Langkah

1. `npm create vite@latest frontend -- --template react` (dari root; folder `frontend` kosong).
2. Install:
   - deps: `react-router-dom zustand`
   - **axios pinned:** `npm install axios@1.20.0 --save-exact`
   - devDeps: `tailwindcss@3.4.17 postcss autoprefixer` (`--save-exact` untuk tailwind, versi sama dengan prototype)
   - devDeps test: `vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
3. Hapus boilerplate Vite (logo, `App.css`).
4. **Tailwind dari design system:**
   - `tailwind.config.js` â€” salin persis isi dari `tailwind.md`. Karena project Vite memakai ESM (`"type": "module"`), ganti `module.exports =` menjadi `export default`.
   - `postcss.config.js` â€” `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`
   - `src/index.css` â€” salin persis blok tema (`@tailwind â€¦`, variabel `:root` / `[data-theme="dark"]`, `@layer base { body â€¦ }`).
   - `index.html` â€” tambahkan link font:
     `https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap`
   - `<title>Vartama Library</title>`
5. `lib/classes.js` â€” ekspor string dari tabel **Class recipes** (`BTN_BASE`, `BTN.primary`, `INPUT`, `LABEL`, `ERROR`, `CARD`, `TABLE_WRAP`, `TH`, `TD`, `CHIP`, `TAB`, `BADGE`, â€¦) supaya tidak ada class yang diketik ulang/berbeda di tiap komponen. Varian kecil (`!min-h-8 !px-3 !py-1 !text-[13px]`) diambil dari `Screens/preview.html`.
6. **Tema:** `theme.js` set `document.documentElement.dataset.theme` ke `dark`/`light` sesuai `prefers-color-scheme` dan dengarkan perubahannya. Tanpa class `dark:`.
7. **Shell aplikasi** (lihat `Screens/preview.html`):
   - Container `mx-auto max-w-[1040px] px-6 pb-12 pt-6`
   - `AppHeader` â€” nama aplikasi `font-display text-[22px] font-semibold` + teks muted "N copies on the shelf" (dari store, diisi di branch 3)
   - `Tabs` â€” `nav role="tablist"` berisi `NavLink` dengan `role="tab"` dan `aria-selected={isActive}` memakai recipe **Tab**. Label: **Books** (`/`), **Lend books** (`/lend`), **History** (`/history`); `*` â†’ redirect `/`.
   - `Notice` â€” banner `rounded-md border border-brand bg-brand-soft px-4 py-3 text-brand-text font-semibold`, ditampilkan di bawah tabs bila `notice` di store terisi; dikosongkan saat pindah tab.
   - `<main className="flex flex-col gap-6">`
8. **Komponen UI dasar** â€” buat dari `components/<Name>/preview.html` + README:
   - `Button` â€” label diawali kata kerja; hanya satu `primary` per view.
   - `Field` â€” label selalu terlihat di atas kontrol (`gap-1.5`), error `text-xs text-danger` dengan `id` yang dirujuk `aria-describedby`, hint `text-xs text-muted`.
   - `Badge` â€” `StockBadge` menurunkan status dari angka: `â–  Out of stock` / `â–² Low` / `â— In stock`; `GenreBadge`; `DueBadge` (`bg-accent-soft text-accent`).
   - `Dialog` â€” overlay `fixed inset-0 grid place-items-center bg-black/50 p-4`, panel `max-w-[420px] rounded-lg border border-line bg-raised p-6 shadow-pop`; tutup dengan Esc, fokus awal di tombol Cancel.
9. `store/library.js` â€” kerangka Zustand: `notice`, `setNotice(msg)`, `clearNotice()`. Slice `books`, `lending`, `history` ditambahkan di branch fitur.
10. `api/client.js`:
    ```js
    import axios from 'axios';

    const client = axios.create({
      baseURL: import.meta.env.VITE_API_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    client.interceptors.response.use(
      (res) => res.data?.data,
      (err) => {
        const message = err.response?.data?.message || err.message || 'Request failed';
        const error = new Error(message);
        error.details = err.response?.data?.details;
        error.status = err.response?.status;
        return Promise.reject(error);
      },
    );

    export default client;
    ```
11. `.env.example`: `VITE_API_URL=http://localhost:3000/api`
12. Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

## Responsif
- Satu kolom, lebar konten maks 1040px.
- Di bawah 640px tabel berubah menjadi kartu bertumpuk (aturan `DESIGN.md`). Implementasi: di `Table.jsx` sediakan pola `sm:table` + fallback kartu (`<thead>` disembunyikan, tiap `<td>` menampilkan label kolom). Dipakai oleh BookTable, ringkasan, dan HistoryTable.

## Test
- `tests/App.test.jsx` â€” tiga tab tampil, klik tab mengubah `aria-selected` dan halaman, path tak dikenal â†’ Books, notice hilang saat pindah tab.
- `tests/lib.test.js` â€” `stockStatus`, `formatDate`, `todayISO`, `cx`.
- `tests/ui.test.jsx` â€” Button (variant, disabled), Field (label, hint, error + aria), badge stok & due, Dialog (fokus ke Cancel, Escape menutup).
- `tests/client.test.js` â€” interceptor axios: resolve ke `data`, reject dengan message/status/details dari API.

> Catatan: `npm audit` melaporkan celah di dependency build Tailwind 3 (`braces`, `postcss-selector-parser`). Hanya dipakai saat build, tidak ikut ke CSS hasil; tetap v3 karena design system ditulis untuk Tailwind 3.

## Selesai jika
- [ ] `npm run dev` â†’ header, tiga tab, dan halaman placeholder tampil sesuai `Screens/preview.html`
- [ ] Tema gelap aktif otomatis saat OS dark mode, tanpa class `dark:`
- [ ] Tidak ada hex mentah / warna default Tailwind di `src/` (cek `grep -rE "#[0-9a-fA-F]{3,6}|(red|blue|gray|slate)-[0-9]" src` kosong, kecuali `index.css`)
- [ ] `npm ls axios` â†’ `axios@1.20.0`; `package.json` tanpa `^` untuk axios & tailwind
- [ ] `npm test` hijau, `npm run build` sukses

## Saran commit
`chore(frontend): scaffold react app with tailwind design tokens, tabs and base components`
