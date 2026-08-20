# Automated Smoke Test

Smoke test KOOKA memeriksa alur kritis secara **read-only** setelah aplikasi
dijalankan atau selesai di-deploy. Test tidak membuat booking, pembayaran,
pesanan F&B, ataupun data operasional lainnya.

## Pemeriksaan default

- aplikasi dan PostgreSQL dapat diakses;
- schema database sudah siap;
- antrean outbox tidak macet (indikator worker berjalan);
- CMS landing page bahasa Inggris dapat dibaca;
- katalog menu bahasa Inggris dapat dibaca;
- pencarian ketersediaan dapat dijalankan tanpa membuat booking;
- halaman login staf dapat dibuka;
- landing page publik atau halaman maintenance tampil dengan benar.

Redis boleh tidak tersedia karena deployment KOOKA saat ini memang dapat
berjalan tanpa Redis. Kondisi tersebut ditampilkan sebagai peringatan, bukan
kegagalan. Outbox yang macet tetap dianggap gagal karena dapat menandakan
worker berhenti.

## Menjalankan di local

Jalankan aplikasi dan worker di terminal terpisah, lalu:

```bash
npm run smoke
```

Default URL adalah `http://127.0.0.1:3000`. Untuk port UAT:

```bash
npm run smoke -- --url http://127.0.0.1:3100
```

## Menjalankan terhadap production

```bash
npm run smoke:production
```

Saat website seharusnya sudah dibuka untuk publik, gunakan gate yang lebih
ketat agar test gagal bila maintenance masih aktif:

```bash
SMOKE_EXPECT_MAINTENANCE=off npm run smoke:production
```

Saat maintenance memang harus aktif:

```bash
SMOKE_EXPECT_MAINTENANCE=on npm run smoke:production
```

## Memeriksa landing production di balik maintenance

Password tidak disimpan di repository. Berikan password preview hanya untuk
proses yang menjalankan smoke test:

```bash
SMOKE_PREVIEW_PASSWORD='password-preview-anda' npm run smoke:production
```

Test akan login ke maintenance preview, menyimpan cookie sementara di memory,
dan memastikan landing page sebenarnya dapat dibuka.

## Memeriksa login staf (opsional)

```bash
SMOKE_STAFF_EMAIL='owner@example.com' \
SMOKE_STAFF_PASSWORD='password-staf' \
npm run smoke:production
```

Credential hanya dibaca dari environment proses. Test melakukan login dan
memastikan permission session dapat di-resolve, tetapi tidak menjalankan aksi
administrasi atau transaksi.

## Output mesin/CI

Gunakan JSON dan exit code. Exit code `0` berarti seluruh pemeriksaan lulus;
exit code `1` berarti sedikitnya satu pemeriksaan gagal.

```bash
npm run smoke:production -- --json
```

Timeout default adalah 10 detik per pemeriksaan dan dapat diubah:

```bash
npm run smoke -- --url http://127.0.0.1:3000 --timeout 20000
```
