# Panduan Uji Fitur Aktif

Dokumen ini hanya mencakup fitur yang disetujui untuk Phase 1/1B. Fitur yang tercatat `DEFERRED` pada scope decision register tidak dimasukkan.

## Urutan setup Owner

Login sebagai Owner, buka **Pengaturan**, lalu lakukan urutan berikut:

1. **Kamar** — tambah amenity, tambah jenis kamar, tambah nomor kamar, dan (bila digunakan) resource `EXTRA_BED`.
2. **Harga & pajak** — buat tax profile, rate plan per jenis kamar, instruksi transfer, kebijakan pembatalan/refund, serta kurs tampilan USD/AUD.
3. **Properti** — simpan jam check-in/out, batas pembayaran online, dan harga extra bed.
4. **Konten & menu** — unggah foto asli dan buat kategori/menu yang akan tampil pada landing page.

Jangan memakai nilai UAT sebagai data produksi. Jumlah kamar, tarif, rekening, tax, koordinat absensi, dan shift harus diisi dari data resmi Owner.

## Skenario yang sudah dapat diuji

### Jenis dan nomor kamar

- Pengaturan → Kamar → **Tambah jenis kamar**.
- Isi kode, nama Indonesia/English, kapasitas, extra bed, amenity, dan alasan.
- Simpan; jenis baru langsung aktif dan muncul pada pilihan **Tambah nomor kamar** serta form booking.
- Gunakan **Edit** untuk versi baru, **Arsipkan** untuk menutup penjualan baru, dan **Ubah jenis unit kamar** untuk mengganti kategori nomor kamar dengan audit.

### Booking sampai checkout

- Front Office → buat quote single/multi-room → reserve.
- Catat/verifikasi transfer manual.
- Alokasikan nomor kamar, lakukan check-in, optional KTP/foto/signature, room move, lalu checkout.
- Tamu online kembali memakai kode booking; email opsional sebagai verifikasi tambahan dan tidak ada login customer.

### F&B kertas

- F&B → tambahkan beberapa menu ke satu formulir.
- Nomor dibuat otomatis `YYMMDDNN` dan melewati nomor yang sudah pernah dipakai.
- Pesanan dapat dibebankan ke folio kamar atau standalone.
- Status hanya dapat maju berurutan; pembatalan membalik room charge dan standalone dapat dibayar serta menerbitkan kuitansi.

### Cleaning dan maintenance

- Housekeeping → buat jadwal otomatis atau cleaning task manual.
- Untuk tamu yang sedang pergi dan meminta kamar dibersihkan, pilih **Permintaan tamu** dan izin masuk **Tamu mengizinkan**.
- Status task: Assigned → In Progress → Cleaned → Inspected.
- Maintenance dapat dibuat untuk nomor kamar, diberi dampak Blocked/Out of Order, dan diselesaikan dari layar yang sama.

## Pemeriksaan otomatis terakhir

- Lint: lulus tanpa warning.
- Type-check: lulus.
- Automated test: 70 file, 597 test lulus.

Human UAT, kamera tablet nyata, koordinat geofence absensi, data produksi, deployment VPS, dan backup/restore production tetap memerlukan perangkat atau input Owner.
