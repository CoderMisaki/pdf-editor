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
- **Kunci tanda tangan** — tombol 🔒 di toolbar. Saat terkunci, scroll
  dan ketukan tidak akan menambah, memindah, atau mengubah ukuran tanda
  tangan (tanda tangan yang sudah ada tetap tampil dan ikut ke-scroll
  bersama halaman, tidak tertutup elemen lain). Matikan kunci untuk
  menempel/mengedit lagi.
- **Deteksi kotak & field** — tombol *Deteksi kotak & field* akan mencari:
  1. field formulir asli di PDF (kotak ceklis dan kolom tanda tangan), dan
  2. kotak kosong bergaris di halaman (untuk formulir hasil cetak/flatten).
  Kotak terdeteksi ditandai garis putus-putus oranye, kolom tanda tangan ungu.
- **Ceklis otomatis** — di mode Ceklis, ketuk kotak kosong yang terdeteksi
  dan tanda centang langsung muncul pas di tengah kotaknya, berapa pun
  bentuk kotaknya. Ketuk lagi untuk membatalkan. Ketuk di luar kotak untuk
  menaruh centang bebas. Ketuk hanya dihitung bila jari tidak bergeser
  (geser = scroll, bukan ketuk), jadi scroll tidak sengaja menambah centang.
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
