# Local Infrastructure — KOOKA Residence

| Informasi | Nilai          |
| --------- | -------------- |
| Versi     | 1.0            |
| Tanggal   | 2 Agustus 2026 |
| Roadmap   | Langkah 4      |

## Services

| Service         | Image                       | Host access                 | Data                         |
| --------------- | --------------------------- | --------------------------- | ---------------------------- |
| PostgreSQL      | `postgres:18.4-alpine3.23`  | `127.0.0.1:55432`           | Named volume `postgres_data` |
| Redis           | `redis:8.8.1-alpine3.23`    | `127.0.0.1:56379`           | Named volume `redis_data`    |
| Mailpit SMTP/UI | `axllent/mailpit:v1.30.5`   | `127.0.0.1:11025/18025`     | Named volume `mailpit_data`  |
| Private files   | `alpine:3.23.5` initializer | Tidak memiliki network/port | Named volume `private_files` |

PostgreSQL, Redis, dan Mailpit berada pada project-scoped Docker bridge network. Host port hanya di-bind ke loopback. Konfigurasi ini untuk development laptop, bukan file deployment production.

## Start dan stop

Pastikan Docker Desktop sudah berjalan, lalu:

```bash
npm run infra:up
```

Command tersebut membuat `.env.infrastructure` dengan random local passwords bila belum ada, memvalidasi Compose, menginisialisasi private volume, menyalakan services, menunggu readiness, dan memastikan semua port loopback-only.

Command operasional:

```bash
npm run infra:status
npm run infra:health
npm run infra:down
```

`infra:down` tidak menghapus named volume. Tidak ada reset/delete-volume command karena penghapusan data harus menjadi tindakan eksplisit.

Mailpit UI tersedia di `http://127.0.0.1:18025`. Email yang dikirim ke SMTP local ditangkap Mailpit dan tidak dikirim ke customer nyata. Port host memakai range khusus KOOKA agar tidak bentrok dengan PostgreSQL/Redis/Mailpit lain; port internal container tetap standar.

## Application environment

Jalankan `npm run env:local` untuk membuat ignored `.env.local` dari kredensial `.env.infrastructure`. File dibuat bermode `0600` dan tidak ditimpa bila sudah ada. Database runtime dan migration workflow tersedia pada [DATABASE-RUNTIME.md](DATABASE-RUNTIME.md).

Template `config/environments` memisahkan local, test, UAT, dan production. Validation menolak localhost/Mailpit pada UAT/production serta menolak private storage di bawah folder `public`.

## Security boundaries

- Secret local hanya disimpan dalam `.env.infrastructure`/`.env.local` yang di-ignore dan mode file infrastructure dipaksa `0600`.
- Database dan Redis tidak pernah di-bind ke `0.0.0.0`.
- Redis memakai password, AOF, dan `noeviction`; Redis bukan source of truth.
- Private file volume tidak mempunyai public route dan storage initializer tidak mempunyai network.
- UAT/production membutuhkan secret serta volume terpisah; contoh local tidak boleh digunakan ulang.
- `infra:down` mempertahankan data; backup/restore production tetap Roadmap Langkah 24.
