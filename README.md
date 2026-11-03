# PDF Editor Gratis

Editor PDF berbasis web, gratis, tanpa daftar, tanpa watermark. Semua proses
berjalan **lokal di browser** — file PDF tidak pernah diunggah ke server mana pun.

## Fitur

- **Tambah teks** — klik di halaman, ketik, atur ukuran dan warna.
- **Pensil** — gambar bebas di halaman (coretan, lingkaran, tanda tangan
  coret, dll.), atur warna dan ketebalan garis.
- **Tanda tangan** — gambar di kanvas, atau unggah gambar tanda tangan.
  Tempel di halaman, tanda tangan langsung terpilih sehingga **slider
  ukuran di toolbar langsung membesarkan/mengecilkan**; juga bisa
  **seret untuk memindah** dan **tarik gagang biru untuk mengubah ukuran**,
  baik di mode Tanda tangan maupun mode Pilih. Penempelan juga hanya
  terjadi pada ketukan murni (bukan saat scroll), jadi geser layar tidak
  menambah tanda tangan liar.
- **Kunci edit global** — tombol 🔓/🔒 di ujung kanan baris alat (nempel
  di kanan atas layar, ikut sticky saat scroll). Saat terkunci, SEMUA
  edit dimatikan: teks, pensil, ceklis, tanda tangan, geser, ubah ukuran,
  hapus. Scroll tetap bisa, memilih elemen tetap bisa. Buka kunci dulu
  baru bisa mengedit lagi.
- **Geser elemen** — seret langsung di halaman (di HP, gestur seret
  pada elemen kini tidak lagi direbut jadi scroll) atau pakai tombol
  arah yang terpisah: **Geser tanda tangan** ← ↑ ↓ → dan **Geser
  ceklis** ← ↑ ↓ → (geser 6pt per ketuk). Tombol tanda tangan
  menggerakkan tanda tangan terpilih/terakhir ditempel; tombol ceklis
  menggerakkan centang terpilih/terakhir dibuat — tidak perlu
  memilih dulu. Di mode Ceklis, seret centang yang ada juga bisa
  memindahkannya (lepas tanpa geser = batalkan centang).
- **Ukuran presisi** — slider **Uk. tanda tangan** (60–300pt, tombol
  −/+ melompat 10pt) dan slider **Uk. ceklis** (6–40pt, tombol −/+
  1pt) di toolbar. Keduanya mengubah elemen terpilih/terakhir
  (tanda tangan menjaga proporsi, centang tetap terpusat di titik
  tengahnya), dan slider ceklis otomatis mengikuti ukuran centang
  yang dibuat/dipilih. Tidak ada lagi outline biru penanda terpilih
  di halaman — tampilan bersih saat menggeser/mengubah ukuran.
- **Pas kan ke kotak** — kalau centang sudah terlanjur digeser atau
  diubah ukurannya sampai keluar dari kotaknya, satu ketuk tombol
  ini mengembalikannya persis ke tengah kotak asalnya dengan ukuran
  pas (sisi terpendek kotak). Centang baru juga menyimpan ukuran
  kotaknya, jadi tombol ini selalu tepat.
- **Zoom cubit dua jari** — di HP, cubit/mekarkan dua jari di atas halaman
  untuk zoom in/out; zoom mengarah ke titik tengah cubitan (bukan ke tengah
  halaman), jadi bisa menargetkan area yang ingin diperbesar. Tombol
  − / + tetap tersedia.
- **Deteksi kotak & field** — tombol *Deteksi kotak & field* akan mencari:
  1. field formulir asli di PDF (kotak ceklis dan kolom tanda tangan), dan
  2. kotak kosong bergaris di halaman (untuk formulir hasil cetak/flatten).
  Kotak terdeteksi ditandai garis putus-putus oranye, kolom tanda tangan ungu.
- **Ceklis otomatis** — di mode Ceklis, ketukan di kotak kosong (atau di
  dekat kotaknya, radius 14pt — karena kotak form kecil dan ketukan jari
  tidak presisi) menambah centang yang menempel pas di tengah kotak
  terdekat, berapa pun bentuk kotaknya. Ketuk lagi untuk membatalkan.
  Ketukan jauh dari kotak tidak menambah apa-apa, jadi scroll tidak
  mungkin lagi menabur centang liar. (Coretan manual tetap bisa lewat
  Pensil bila perlu centang di luar kotak.)
- **Pilih / geser / hapus / urungkan / ulangi** — klik elemen untuk
  memilih, seret untuk memindah, tombol Delete untuk menghapus, tombol
  Urungkan untuk membatalkan langkah terakhir, tombol Ulangi untuk
  mengembalikan langkah yang diurungkan (juga lewat `Ctrl+Y` atau
  `Ctrl+Shift+Z`; `Ctrl+Z` untuk urungkan).
- **Unduh PDF** — hasil edit disimpan sebagai file PDF baru
  (`namafile-edited.pdf`), elemen menempel permanen di halaman.

## Cara pakai

1. Buka situsnya, klik **Buka PDF** (atau seret file PDF ke halaman).
2. Pilih alat di toolbar, kerjakan langsung di halaman.
3. Untuk tanda tangan: klik **Buat / unggah tanda tangan**, gambar atau
   unggah, klik **Pakai tanda tangan ini**, lalu klik di halaman untuk
   menempelkannya. Kalau dokumen punya kolom tanda tangan (ungu), klik
   kolomnya dan tanda tangan langsung pas di dalamnya.
4. Untuk ceklis: klik **Deteksi kotak & field**, pindah ke mode **Ceklis**,
   lalu ketuk kotaknya.
5. Klik **Unduh PDF**.

## Menjalankan lokal

Tidak perlu build step. Cukup sajikan folder ini lewat server statis apa pun,
misalnya:

```bash
python3 -m http.server 8000
```

lalu buka `http://localhost:8000`. (Membuka `index.html` langsung dengan
`file://` bisa gagal memuat PDF.js worker di sebagian browser.)

## Teknologi

- [PDF.js](https://mozilla.github.io/pdf.js/) — render halaman PDF.
- [pdf-lib](https://pdf-lib.js.org/) — menyimpan hasil edit ke PDF baru.
- JavaScript vanilla + HTML + CSS, tanpa framework dan tanpa backend.

## Keterbatasan

- Teks yang ditambahkan memakai font standar Helvetica (karakter Latin).
  Dokumen terenkripsi/dilindungi kata sandi tidak bisa dibuka.
- Deteksi kotak visual adalah heuristik (mencari persegi bergaris kosong);
  untuk formulir PDF asli, deteksi field jauh lebih akurat.
- Tanda tangan yang ditempel adalah gambar, bukan tanda tangan digital
  kriptografis (bukan sertifikat digital).
