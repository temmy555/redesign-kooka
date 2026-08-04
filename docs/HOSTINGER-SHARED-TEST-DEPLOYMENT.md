# Hostinger Shared Testing Deployment

Panduan ini untuk mencoba KOOKA di Hostinger shared/Node.js hosting dengan:

- Next.js berjalan di Hostinger.
- PostgreSQL memakai server AWS yang sudah ada.
- Email memakai SMTP Hostinger.
- Redis tidak dipakai untuk testing awal.

> Catatan: ini cocok untuk testing/UAT online. Untuk production serius, VPS/Lightsail tetap lebih disarankan karena kontrol worker, storage, process manager, backup, dan firewall lebih jelas.

## 1. Pastikan Paket Hostinger Mendukung Node.js

Gunakan paket Hostinger yang memiliki fitur Node.js app. Jika panel hanya menyediakan PHP/static hosting tanpa Node.js app, project ini tidak bisa berjalan penuh karena KOOKA memakai Next.js server dan API route.

Minimal yang perlu tersedia:

- Node.js versi 22 atau lebih baru.
- Start command custom.
- Environment variables.
- Folder writable untuk private upload.
- Koneksi keluar ke database PostgreSQL AWS.

## 2. Siapkan Database PostgreSQL AWS

Di server PostgreSQL AWS:

1. Buat database khusus testing, misalnya `kooka_testing`.
2. Buat user khusus aplikasi, jangan pakai superuser.
3. Izinkan koneksi dari server Hostinger.
4. Gunakan password kuat.
5. Aktifkan SSL jika tersedia.

Contoh bentuk `DATABASE_URL`:

```text
postgresql://kooka_app:PASSWORD@HOST_AWS:5432/kooka_testing?sslmode=require
```

Jika koneksi dari Hostinger gagal, biasanya penyebabnya firewall/security group AWS belum mengizinkan IP server Hostinger.

## 3. Siapkan Email SMTP Hostinger

Buat email domain di Hostinger, misalnya:

```text
no-reply@domain-kooka.com
```

Catat:

- SMTP host
- SMTP port
- Username email
- Password email
- From address

Project memakai `SMTP_USER` dan `SMTP_PASSWORD` untuk login SMTP.

## 4. Siapkan Environment Variables

Isi environment variable di panel Node.js Hostinger:

```text
APP_ENV=production
APP_URL=https://subdomain-atau-domain-testing
BETTER_AUTH_SECRET=isi-random-minimal-32-karakter
DATA_ENCRYPTION_KEY=base64-32-byte-key
DATABASE_URL=postgresql://kooka_app:PASSWORD@HOST_AWS:5432/kooka_testing?sslmode=require
DB_POOL_MAX=3
DB_CONNECTION_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=10000
PRIVATE_STORAGE_ROOT=/home/USERNAME/kooka-private-files
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_FROM=KOOKA Residence <no-reply@domain-kooka.com>
SMTP_USER=no-reply@domain-kooka.com
SMTP_PASSWORD=password-email-hostinger
```

Untuk deployment testing tanpa Redis, kosongkan atau jangan isi:

```text
REDIS_URL
```

Dengan Redis kosong, worker akan polling outbox langsung dari PostgreSQL. Ini cukup untuk testing, tetapi bukan bentuk paling ideal untuk beban production.

Generate secret lokal:

```bash
openssl rand -base64 32
```

Gunakan hasil berbeda untuk `BETTER_AUTH_SECRET` dan `DATA_ENCRYPTION_KEY`.

## 5. Upload Source Code

Cara paling rapi:

1. Push project ke GitHub.
2. Di Hostinger, clone repository ke folder app.
3. Pastikan file rahasia tidak ikut masuk Git, terutama `.env.local`, `.data`, dan file upload.

Jika upload manual, jangan upload:

- `node_modules`
- `.next`
- `.next-uat`
- `.data`
- `.env.local`

## 6. Install Dependency

Di terminal Hostinger atau panel Node.js:

```bash
npm ci
```

Jika Hostinger tidak mendukung npm 11, gunakan npm bawaan Node 22 selama lockfile tetap terbaca.

## 7. Jalankan Migration Database

Setelah env `DATABASE_URL` benar:

```bash
npm run db:migrate
```

Lalu cek:

```bash
npm run db:status
npm run db:health
```

Untuk testing awal, seed data bisa disiapkan lewat script khusus/testing jika memang diperlukan. Jangan gunakan UAT reset untuk database production sungguhan.

## 8. Build Next.js

```bash
npm run build
```

Project sudah memakai `output: "standalone"`, jadi hasil build cocok untuk Node.js deployment.

## 9. Start Web App

Untuk testing sederhana di Hostinger Node.js app, gunakan start command:

```bash
npm run start
```

Jika Hostinger meminta entry file standalone, gunakan:

```bash
node .next/standalone/server.js
```

Pastikan port mengikuti mekanisme Hostinger. Jangan hardcode port jika panel sudah menyediakan `PORT`.

## 10. Start Worker

Worker dibutuhkan untuk memproses email, invoice/PDF, outbox retry, dan daily operation.

Jika Hostinger mengizinkan background process kedua, jalankan:

```bash
npm run worker
```

Untuk testing tanpa Redis, worker tetap bisa berjalan selama `DATABASE_URL` tersedia.

Jika Hostinger tidak menyediakan background worker, risiko testing:

- Email bisa tertunda.
- PDF/invoice background bisa tidak langsung selesai.
- Daily operation perlu dijalankan melalui tombol/manual fallback bila tersedia.

## 11. Hubungkan Domain Hostinger

Jika domain berada di Hostinger:

1. Buat subdomain testing, misalnya `uat.domain-kooka.com`.
2. Arahkan subdomain ke Node.js app di Hostinger.
3. Aktifkan SSL.
4. Set `APP_URL` sesuai domain final, misalnya `https://uat.domain-kooka.com`.

Jika app dipindah ke VPS/Lightsail nanti, domain cukup diarahkan via DNS A record ke IP VPS.

## 12. Smoke Test Setelah Online

Cek alur paling penting:

1. Landing page terbuka.
2. Cari kamar.
3. Buat booking online.
4. Lihat kode booking dan instruksi transfer.
5. Login Front Office.
6. Verifikasi pembayaran.
7. Check-in, alokasi kamar, dan checkout.
8. Buat pesanan F&B room charge dan standalone.
9. Cetak invoice.
10. Coba attendance dari HP.
11. Pastikan email booking/payment/invoice terkirim.

## 13. Batasan Mode Tanpa Redis

Redis boleh dihilangkan untuk testing Hostinger ini karena data penting tetap berada di PostgreSQL.

Yang berubah:

- Worker memakai polling langsung, bukan scheduler Redis/BullMQ.
- Cocok untuk beban kecil dan validasi fitur.
- Tidak ideal untuk production ramai atau multi-instance.

Untuk production final, pertimbangkan Redis kembali atau pindah ke VPS supaya worker dan scheduler lebih stabil.
