# Technical Architecture — KOOKA Residence

| Informasi | Nilai |
|---|---|
| Versi | 1.0 Draft |
| Tanggal | 2 Agustus 2026 |
| Scope | Baseline arsitektur sebelum implementasi |
| Status | Disetujui; physical PostgreSQL/Drizzle dan local infrastructure sudah tervalidasi, application database runtime/production deployment belum diimplementasikan |

## 1. Keputusan utama

KOOKA dibangun sebagai **satu modular monolith** dan dideploy satu kali pada VPS Hostinger. Landing page, booking customer, customer booking lookup, admin operasional, CMS, serta attendance karyawan berada dalam satu codebase dan satu aplikasi.

Baseline stack:

- Next.js 16 App Router, React 19, dan TypeScript.
- PostgreSQL 18 sebagai transactional source of truth.
- Drizzle ORM dan `node-postgres` untuk akses database serta migration terkontrol.
- Better Auth untuk autentikasi staf, dilengkapi RBAC aplikasi yang diperiksa server-side.
- Redis dan BullMQ untuk queue, retry, scheduled work, serta pekerjaan asynchronous.
- Persistent local file storage pada volume VPS untuk Phase 1; bukan browser `localStorage`.
- Docker Compose untuk application, PostgreSQL, Redis, dan reverse proxy.
- Satu repository, satu build pipeline, dan satu deployment unit.

VPS Hostinger KVM 2 dengan 2 vCPU, 8 GB RAM, 100 GB NVMe, dan 8 TB bandwidth dinilai cukup sebagai titik awal untuk sekitar 15 kamar serta trafik KOOKA pada fase awal. Kecukupan production tetap bergantung pada monitoring CPU, memory, disk, I/O, queue, database connection, backup, dan pertumbuhan media.

## 2. Batas modular

```text
Web/PWA routes
├── Public landing dan booking
├── Customer booking lookup tanpa login
├── Staff/admin lodging operations
├── Staff attendance mobile-first
└── CMS dan configuration
        │
        ▼
Next.js server actions/route handlers
├── Identity dan RBAC
├── Reservation dan inventory
├── Stay dan room operations
├── Folio dan financial documents
├── Housekeeping/maintenance
├── CMS/communication
└── Attendance
        │
        ├── PostgreSQL — authoritative data
        ├── Redis/BullMQ — queue dan transient coordination
        └── Private local storage — file objects
```

Modul mempunyai boundary kode dan permission sendiri, tetapi tidak menjadi service, repository, database, atau deployment terpisah.

## 3. Route dan autentikasi

- Staf menggunakan satu login dan satu session. Menu ditentukan oleh role/permission.
- Role F&B, Cleaning, Front Office, dan Owner dapat melihat attendance pribadi melalui login yang sama jika memiliki employee profile aktif.
- Customer tidak memiliki login atau user account.
- Customer membuka booking melalui booking code ber-entropi tinggi + email yang cocok, kemudian menerima short-lived lookup session.
- Attendance menggunakan secure same-origin HttpOnly session cookie; tidak memerlukan mobile token system terpisah.
- Semua mutation divalidasi dan diotorisasi di server. Client tidak dipercaya untuk user ID, role, nominal, status, official timestamp, atau hasil geofence.

## 4. PostgreSQL, Redis, dan job

PostgreSQL menjadi sumber resmi untuk booking, inventory, assignment, state, folio, payment, refund, document, attendance, audit, file metadata, idempotency, dan durable job/outbox record.

Redis digunakan hanya untuk data yang boleh dibangun ulang, antara lain:

- BullMQ queue dan retry schedule.
- Rate limiting serta abuse control.
- Cache pendek dan coordination non-authoritative.

Booking, payment, inventory, folio balance, attendance event, dan permission tidak boleh hanya disimpan di Redis. Hilangnya Redis tidak boleh menghilangkan transaksi bisnis yang sudah berhasil.

Pola transactional outbox digunakan untuk pekerjaan yang harus mengikuti commit database, misalnya email, PDF render, expiry hold, reminder, dan scheduled rollover. Worker mengambil outbox/job yang sudah committed dan menjalankannya secara idempotent.

## 5. File storage lokal

`Local storage` berarti direktori privat pada persistent VPS volume, bukan Web Storage pada browser dan bukan filesystem sementara container.

Aturan minimum:

- File body disimpan di volume privat di luar public web root.
- PostgreSQL hanya menyimpan metadata dan opaque storage key.
- Download/preview melewati authorization server-side; tidak ada permanent public URL.
- Nama object tidak memuat nama tamu, email, nomor KTP, atau booking code lengkap.
- Validasi MIME/signature, size, dimension, dan malware scan dilakukan sebelum file dinyatakan siap.
- KTP, signature, selfie attendance, payment/refund proof, dan evidence mempunyai permission serta retention category berbeda.
- Database backup dan file backup dibuat konsisten, terenkripsi, diuji restore, serta disimpan di lokasi kedua. Disk VPS yang sama bukan backup.

S3-compatible object storage dapat menggantikan adapter storage pada fase berikutnya tanpa mengubah domain model.

## 6. Deployment baseline

Container minimum:

1. Reverse proxy dengan TLS.
2. Next.js application/web process.
3. Worker process dari image aplikasi yang sama.
4. PostgreSQL.
5. Redis.

Application dan worker boleh menggunakan image yang sama dengan command berbeda. PostgreSQL dan Redis tidak diekspos ke public internet. Upload volume, database volume, dan Redis volume dipisahkan. Environment secret tidak disimpan di repository atau tabel configuration biasa.

Untuk VPS 8 GB, resource limit serta connection pool wajib dikonfigurasi konservatif. Jalankan satu application instance dan satu worker kecil terlebih dahulu; scale hanya berdasarkan metric. Hindari menjalankan preview environment, database analytics berat, atau media transcoding besar pada node production yang sama.

## 7. Reliability dan recovery minimum

- Health check terpisah untuk web, database, Redis, worker, queue age, disk capacity, dan backup freshness.
- Structured log memakai request/correlation ID dan tidak memuat highly sensitive data.
- Database migration dijalankan sebagai explicit deployment step dan hanya sekali.
- Daily encrypted database backup, incremental/lebih sering sesuai RPO yang disetujui, serta off-server file backup.
- Restore drill sebelum Go/No-Go.
- Deployment rollback tidak otomatis me-rollback schema atau menghapus data.
- Offline Operations Log tersedia ketika aplikasi tidak dapat digunakan, kemudian direkonsiliasi setelah pulih.

## 8. Bukan bagian baseline

- Microservices, Kubernetes, dan database per modul.
- Backend/API attendance terpisah.
- Native Android/iOS application.
- SSO.
- S3/CDN sebagai dependency wajib Phase 1.
- Redis sebagai source of truth atau distributed locking utama untuk inventory.
- Read replica, sharding, dan multi-region deployment.

## 9. Konsekuensi keputusan

Arsitektur ini menjaga deployment sederhana dan biaya awal rendah, namun menuntut disiplin modular, backup off-server, observability, dan batas akses file yang kuat. Local private storage cukup untuk fase awal, tetapi pertumbuhan galeri/video atau kebutuhan high availability dapat menjadi trigger untuk memindahkan object storage ke layanan terpisah.

Model database rinci tersedia di [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md).
