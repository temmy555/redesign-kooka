# Implementation Roadmap — KOOKA Residence

| Informasi  | Nilai                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| Versi      | 1.0                                                                     |
| Tanggal    | 2 Agustus 2026                                                          |
| Scope      | Phase 1A Core Lodging, Phase 1B Attendance, serta gate menuju Phase 2–3 |
| Cara kerja | Technical batch; langkah rinci tetap menjadi traceability checklist     |

## 1. Tujuan dan aturan eksekusi

Roadmap ini menjadi urutan kerja implementasi dan traceability checklist. Sejak keputusan Owner 2 Agustus 2026, langkah yang saling bergantung boleh dikerjakan sebagai satu technical batch tanpa dibahas satu per satu. Build, full quality, dan database verification boleh ditunda serta dijalankan Owner; status harus tetap membedakan kode yang sudah ditulis dari hasil yang sudah diverifikasi.

Aturan utama:

1. Hanya satu technical batch berstatus aktif pada satu workstream.
2. Guard, audit, security, dan focused test tetap ditulis bersama fitur. Eksekusi build/full quality/integration/UAT boleh ditunda, tetapi gap verifikasi wajib dicatat eksplisit.
3. Nilai produksi yang belum tersedia tetap menjadi open configuration; jangan memasukkan estimasi sekitar 15 kamar, tarif, rekening, tax, geofence, atau shift sebagai data production.
4. Migration hanya dijalankan pada local/disposable dan UAT sebelum production.
5. Mockup Versi 01 menjadi visual reference. SQLite/Cloudflare D1 pada preview tidak dijadikan production database.
6. Phase 2/3 tidak masuk diam-diam ketika membangun Phase 1.
7. Setiap perubahan scope dicatat di Scope Decision Register dan dinilai dampaknya terhadap schema, security, test, serta deployment.

Status:

- `DONE`: hasil dan verifikasi sudah tersedia.
- `IMPLEMENTED — UNVERIFIED`: kode sudah ditulis; migration/build/test/quality belum seluruhnya dijalankan.
- `NEXT`: langkah berikutnya yang direkomendasikan.
- `WAITING`: menunggu dependency atau langkah sebelumnya.
- `OWNER INPUT`: data/keputusan bisnis dapat disiapkan paralel.
- `DEFERRED`: tidak dikerjakan pada Phase 1.

## 2. Ringkasan urutan

| Langkah | Workstream                           | Hasil utama                                                           | Status                   |
| ------: | ------------------------------------ | --------------------------------------------------------------------- | ------------------------ |
|       0 | Product baseline                     | PRD, scope freeze, domain rules, readiness checklist                  | DONE                     |
|       1 | Architecture/database                | Approved architecture, Drizzle schema, generated SQL, constraint test | DONE                     |
|       2 | Canonical application root           | Next.js project root dan repository layout final                      | DONE                     |
|       3 | Dependency dan quality foundation    | Package lock, TypeScript, lint, test runner, CI baseline              | DONE                     |
|       4 | Local infrastructure                 | PostgreSQL, Redis, private volume, local email, health checks         | DONE                     |
|       5 | Database runtime                     | DB client, migration runner, dev seed, reset/test workflow            | DONE                     |
|       6 | Staff authentication                 | Better Auth, login/logout/session/recovery, ordinary password login   | DONE                     |
|       7 | RBAC dan employee identity           | Role/permission server-side serta User↔EmployeeProfile                | DONE                     |
|       8 | Shared platform services             | Audit, idempotency, outbox, worker, file adapter, security log        | DONE                     |
|       9 | Property/configuration admin         | Version/effective date/approval/impact preview                        | IMPLEMENTED — UNVERIFIED |
|      10 | Room dan resource master             | Room type/unit/amenity/capacity/extra bed                             | IMPLEMENTED — UNVERIFIED |
|      11 | Rate, tax, policy, document master   | Resolved pricing/configuration snapshots                              | IMPLEMENTED — UNVERIFIED |
|      12 | Availability dan quote               | Search kamar, nightly quote, transactional inventory hold             | IMPLEMENTED — UNVERIFIED |
|      13 | Reservation                          | Online/manual single dan multi-room booking                           | IMPLEMENTED — UNVERIFIED |
|      14 | Payment dan customer return flow     | Manual verification, code+email lookup, reminder/expiry               | IMPLEMENTED — UNVERIFIED |
|      15 | Room board dan allocation            | Live Room Monitor, assignment, block, room move                       | IMPLEMENTED — UNVERIFIED |
|      16 | Stay lifecycle                       | Arrival, optional registration, check-in/out, amendment               | IMPLEMENTED — UNVERIFIED |
|      17 | Folio dan financial document         | Ledger, payment/refund, combined/split invoice, PDF                   | IMPLEMENTED — UNVERIFIED |
|      18 | Housekeeping dan property operations | Cleaning, maintenance, damage, Lost & Found                           | IMPLEMENTED — UNVERIFIED |
|      19 | CMS dan public landing               | Versi 01, bilingual, display currency, authentic media                | IMPLEMENTED — UNVERIFIED |
|      20 | F&B paper-order entry                | Menu dan manual standalone/room-charge order                          | IMPLEMENTED — UNVERIFIED |
|      21 | Reporting dan daily operations       | Dashboard, daily rollover, reconciliation/export                      | IMPLEMENTED — UNVERIFIED |
|     22A | Staff UI foundation                  | Login, role shell, dashboard, live rooms, basic role workspaces       | IMPLEMENTED — UNVERIFIED |
|     22B | Phase 1A hardening                   | Security, concurrency, performance, accessibility, recovery           | IMPLEMENTED — UNVERIFIED |
|     22C | Admin & Operational UI               | Front Office actions, finance, master data, CMS, team, report         | IMPLEMENTED — UNVERIFIED |
|      23 | UAT preparation dan execution        | Synthetic UAT data, role scenarios, sign-off                          | IMPLEMENTED — UNVERIFIED |
|      24 | Production readiness                 | VPS, TLS, backup/restore, monitoring, offline/rollback                | WAITING                  |
|      25 | Phase 1A go-live                     | Opening data, Go/No-Go, release, hypercare                            | WAITING                  |
|      26 | Attendance configuration             | Geofence/shift/privacy/permission production values                   | OWNER INPUT              |
|      27 | Employee attendance                  | Mobile-first/PWA check-in/out dan self-history                        | WAITING                  |
|      28 | Admin attendance                     | Monitor, configuration, correction, safe export                       | WAITING                  |
|      29 | Phase 1B UAT dan release             | Attendance validation dan independent release                         | WAITING                  |
|      30 | Phase 2/3 review                     | Reprioritization dan change request baru                              | DEFERRED                 |

## 3. Dependency flow

```text
0 Product baseline ── DONE
        ↓
1 Architecture + physical DB ── DONE
        ↓
2 Application root ── DONE
        ↓
3 Dependencies/quality ── DONE → 4 Local infrastructure ── DONE → 5 DB runtime ── DONE
        ↓
6 Authentication ── DONE → 7 RBAC/employee ── DONE → 8 Shared services ── DONE
        ↓
9 Configuration → 10 Room master → 11 Commercial master ── IMPLEMENTED/UNVERIFIED
        ↓
12 Availability → 13 Reservation → 14 Payment/customer lookup ── IMPLEMENTED/UNVERIFIED
        ↓
15 Room board → 16 Stay → 17 Folio/documents → 18 Operations ── IMPLEMENTED/UNVERIFIED
        ↓
19 Landing/CMS → 20 F&B → 21 Reporting ── IMPLEMENTED/UNVERIFIED
        ↓
22A Staff UI → 22B Hardening → 22C Admin & Operational UI → 23 UAT → 24 Production readiness → 25 Go-live
        ↓
26–29 Attendance Phase 1B, kemudian 30 Phase 2/3 review
```

Attendance dapat mulai setelah Langkah 8 bila ada tim/workstream terpisah. Untuk pengerjaan benar-benar satu per satu, rekomendasi default adalah menyelesaikannya setelah Phase 1A agar lodging go-live tidak tertunda.

## 4. Detail setiap langkah

### Langkah 0 — Product baseline

Status: `DONE`.

Hasil tersedia:

- PRD 2.1, Scope Decision Register, Project Context, dan domain documents.
- Phase 1A/1B/2/3 serta deferred/manual/out-of-scope terpisah.
- State transition, availability, pricing, folio, security, dan readiness rules tersedia.

Exit gate: baseline dapat ditelusuri dan fitur baru wajib memakai change request.

### Langkah 1 — Architecture dan physical database

Status: `DONE`.

Hasil tersedia:

- Single-deploy modular-monolith architecture untuk Hostinger VPS.
- Next.js/PostgreSQL/Redis/persistent-private-volume baseline.
- Logical schema dan 128 Drizzle table definitions.
- Generated PostgreSQL SQL, hard constraints, dan migration plan.
- Disposable PostgreSQL 18 migration serta constraint smoke test lulus.

Exit gate: `drizzle-kit check` lulus, SQL dapat diterapkan pada empty PostgreSQL 18, mockup preview tidak berubah.

### Langkah 2 — Bentuk canonical application root

Status: `DONE`.

Tujuan: menjadikan root project sebagai satu aplikasi final tanpa merusak preview.

Pekerjaan:

- Inisialisasi canonical Next.js 16 App Router + TypeScript project di root.
- Pertahankan `docs`, `database`, `drizzle`, dan `src/db/schema` yang sudah ada.
- Buat layout modular: `app`, `src/modules`, `src/platform`, `src/db`, `src/jobs`, `src/storage`, `tests`.
- Pindahkan/adaptasi komponen visual Versi 01 dari mockup secara bertahap; jangan membawa D1/Cloudflare runtime ke production root.
- Tetapkan root sebagai satu package/repository source of truth.
- Tambahkan `.gitignore`, `.editorconfig`, environment example tanpa secret, dan command placeholders.

Verifikasi:

- Empty application dapat build dan start.
- Existing schema files tetap dapat di-import.
- Mockup preview tetap dapat dibuka dan tidak memiliki uncommitted change akibat pekerjaan ini.

Exit gate:

- Satu canonical application root disepakati.
- `build`, minimal route smoke test, dan type-check lulus.
- Belum ada feature UI atau production connection.

Hasil 2 Agustus 2026:

- Root menjadi canonical Next.js 16 App Router + React 19 + strict TypeScript application.
- Layout `app`, `src/modules`, `src/platform`, `src/db`, `src/jobs`, `src/storage`, dan `tests` tersedia tanpa memindahkan atau mengubah preview Versi 01.
- Environment example, ignore/editor configuration, package lock, standalone build target, dan command minimum tersedia.
- `typecheck`, foundation smoke test 2/2, production build, standalone server/route smoke test, `drizzle-kit check`, serta production dependency audit lulus.
- Tidak ada database runtime, Docker, authentication, API bisnis, atau production connection yang dimulai pada langkah ini.

### Langkah 3 — Dependency dan quality foundation

Status: `DONE`.

Tujuan: dependency repeatable dan quality gate tersedia sebelum fitur.

Pekerjaan:

- Pin Next.js, React, TypeScript, Drizzle, `pg`, Better Auth, Redis/BullMQ, validation, testing, logging, dan PDF/email dependencies yang benar-benar dipakai.
- Commit package lock.
- Konfigurasi strict TypeScript, ESLint, formatter, unit/integration test runner, coverage policy, serta build check.
- Buat CI baseline: install deterministik, lint, type-check, unit test, build, migration check.
- Tambahkan dependency/security audit yang tidak memblokir development secara tidak terkendali.
- Evaluasi advisory moderate dev-only pada dependency transitive `drizzle-kit`/`@esbuild-kit`/`esbuild`; jangan menerima auto-fix yang menurunkan Drizzle Kit secara breaking tanpa compatibility test.

Verifikasi: clean install pada environment baru menghasilkan hasil yang sama; seluruh quality command lulus.

Exit gate: developer tidak membutuhkan dependency dari folder mockup atau global installation.

Hasil 2 Agustus 2026:

- Runtime/tooling dependency dipilih dan dikunci exact; `package-lock.json`, Node/npm baseline, serta clean-install policy tersedia.
- PostgreSQL, Better Auth, Redis/BullMQ, Zod, Pino, Nodemailer, dan PDF-Lib baru dipasang sebagai dependency; belum ada runtime connection atau feature activation.
- ESLint zero-warning, Prettier, strict TypeScript, Vitest unit/integration layout, V8 coverage threshold 80%, schema check, build, dan security audit digabungkan dalam `npm run quality`.
- GitHub Actions quality workflow menjalankan `npm ci` dan gate yang sama.
- Clean `npm ci` lulus; 3 test files/4 tests lulus; foundation coverage 100%; production build dan audit seluruh dependency melaporkan 0 vulnerability.
- Patched transitive overrides serta removal trigger dicatat pada Dependency dan Quality Baseline; preview Versi 01 tetap tidak berubah.

### Langkah 4 — Local infrastructure

Status: `DONE`.

Tujuan: lingkungan pengembangan menyerupai deployment VPS tanpa memakai service production.

Pekerjaan:

- Docker Compose untuk PostgreSQL 18 dan Redis dengan health check serta named volume.
- Private upload volume di luar public directory.
- Local email catcher untuk verifikasi email tanpa mengirim ke customer.
- Environment validation; secret hanya melalui environment/secret file yang di-ignore.
- Pisahkan configuration local, test, UAT, dan production.

Verifikasi: service start/stop sehat, volume persisten, database/Redis tidak terbuka ke public interface secara default.

Exit gate: satu command terdokumentasi menyalakan dependency lokal dan health check lulus.

Hasil 2 Agustus 2026:

- Docker Compose memakai image exact PostgreSQL 18.4, Redis 8.8.1, Mailpit 1.30.5, serta Alpine 3.23.5 untuk private-volume initializer.
- `npm run infra:up` menghasilkan ignored local secret, memvalidasi config, menginisialisasi volume, menyalakan service, menunggu health, dan memverifikasi binding loopback.
- Host port khusus KOOKA adalah PostgreSQL `55432`, Redis `56379`, Mailpit SMTP `11025`, dan Mailpit UI `18025`; port standar container tetap tidak berubah.
- PostgreSQL/Redis health check, Mailpit `/readyz`, private volume access, serta loopback-only binding lulus. Port PostgreSQL lokal lain pada `5432` tidak dihentikan atau diubah.
- Persistence probe setelah container restart lulus untuk PostgreSQL, Redis AOF, Mailpit data, dan private-file volume; marker database/Redis/private-file dibersihkan setelah verifikasi.
- Environment validation dan template local/test/UAT/production tersedia; UAT/production menolak localhost, Mailpit, dan private storage di bawah `public`.
- Quality gate lulus dengan 5 test files/11 tests dan coverage 100%. Database client, application migration runtime, auth, dan fitur bisnis belum dimulai.

### Langkah 5 — Database runtime dan migration workflow

Status: `DONE`.

Tujuan: menghubungkan physical schema dengan application runtime secara aman.

Pekerjaan:

- Buat `pg` connection pool dengan batas konservatif.
- Buat Drizzle database client server-only.
- Rekonsiliasi generated SQL menjadi batch migration yang dapat direview.
- Terapkan hard constraints setelah generated tables.
- Sediakan migration command, test database reset, synthetic dev seed, dan migration status check.
- Jangan membuat production room seed dari estimasi 15 kamar.

Verifikasi:

- Empty database migrate berhasil.
- Migration kedua kali tidak menggandakan object.
- Disposable reset/recreate berhasil.
- Existing constraint smoke test tetap lulus.

Exit gate: application dapat menjalankan read-only health query; belum ada production migration.

Hasil 2 Agustus 2026:

- Server-only `pg` pool dan Drizzle client tersedia dengan default maksimum 8 koneksi.
- Dua reviewable migration batches dicatat melalui checksum history dan dijaga advisory lock/transaction.
- Empty migrate, second-run idempotency, hard-constraint smoke test, dan disposable reset/recreate lulus.
- Synthetic development seed idempoten hanya membuat placeholder property serta empat role; tidak membuat kamar/tarif.
- Local development schema telah dimigrasikan dan health query/route tersedia. Production migration tidak dijalankan dan ditolak oleh local runner.

### Langkah 6 — Staff authentication

Status: `DONE` — hardening review lulus 2 Agustus 2026.

Tujuan: satu login aman untuk seluruh staf.

Pekerjaan:

- Kunci exact Better Auth version/adapter dan sesuaikan auth-table contract.
- Email/password login, logout, session rotation, revoke, recovery, dan secure cookie.
- Login email/password biasa untuk seluruh role; MFA/TOTP tidak digunakan.
- Rate limit, login security event, dan generic error.
- Tidak membuat customer account/login.

Verifikasi: login success/failure, expired/revoked session, CSRF/session fixation, shared-device logout, dan recovery tests.

Exit gate: authenticated session dapat dikenali server-side; belum memberi akses modul tanpa permission.

Hasil 2 Agustus 2026:

- Auth-table contract direkonsiliasi: `auth_sessions.token_hash`→`token`, `auth_verifications.value_hash`→`value` (+`updated_at`), `auth_accounts.provider_account_id`→`account_id`, mengikuti default field contract Better Auth 1.6.25 apa adanya (bukan hash) — lihat migration `0003_auth_contract_alignment` dan rationale di `src/platform/auth.ts`. `auth_accounts.password_hash` tidak berubah karena memang berisi hash asli dari Better Auth.
- `src/platform/auth.ts`: instance Better Auth server-only dengan Drizzle adapter, email/password login (`minPasswordLength: 12`), hard session lifetime 8 jam (`disableSessionRefresh: true`), rate limit endpoint credential, `advanced.database.generateId: false`, serta hook `emailNormalized` server-side.
- `app/api/auth/[...all]/route.ts` memasang handler; `src/platform/session.ts` menyediakan `getCurrentSession`/`requireCurrentSession` untuk Server Component/route lain — belum melakukan permission check apa pun (Langkah 7).
- Keputusan 2 Agustus 2026 mengganti fondasi lama: plugin `twoFactor` dan permission gate MFA telah dihapus. Kolom/tabel migration `0004` dipertahankan sebagai artefak kompatibilitas yang tidak dipakai runtime agar riwayat migration tetap aman.
- Login/logout/password-reset menulis `security_events` (`AUTH_SESSION_CREATED`, `AUTH_SESSION_REVOKED`, `AUTH_PASSWORD_RESET`); penulisan best-effort di luar transaction Better Auth, bukan atomic.
- Sign-up publik dimatikan. `POST /api/setup/bootstrap-owner` menyediakan bootstrap satu kali dengan bearer secret, advisory lock, employee profile, property awal, role grant, dan mandatory audit; token bootstrap harus dihapus setelah berhasil.
- Password recovery aktif: Better Auth membuat token satu jam dan `sendResetPassword` memasukkan pekerjaan `auth.password-reset` ke transactional outbox; worker mempunyai handler SMTP nyata tanpa mencatat alamat email plaintext.
- Quality gate lulus: format, lint, typecheck, coverage, Drizzle check, production build, production/all-dependency audit (0 vulnerability), serta disposable PostgreSQL migration test. Browser UAT untuk shared-device logout tetap bagian langkah UAT, bukan defect fondasi auth.

### Langkah 7 — RBAC dan employee identity

Status: `DONE` — hardening review lulus 2 Agustus 2026.

Tujuan: menu dan action mengikuti permission yang sama pada server.

Pekerjaan:

- Seed role awal Owner, Front Office, Cleaning, dan F&B.
- Implement named permissions, user-role grant/effective period, dan route/action guard.
- Hubungkan `User` dengan optional `EmployeeProfile`.
- Field/file permissions untuk KTP, signature, payment/refund evidence, selfie, dan export.
- Menu navigation disusun dari permission, tetapi backend tetap menjadi enforcement resmi.

Owner input: final named permission matrix dan siapa yang menerima setiap role.

Verifikasi: privilege-escalation, cross-role access, self-role-edit, inactive employee, dan direct-route tests.

Exit gate: semua protected route default-deny dan mempunyai test role positif/negatif.

Hasil 2 Agustus 2026:

- Katalog `permissions` dan mapping `role_permissions` dipindahkan ke migration `0005_rbac_baseline_catalog` (bukan hanya dev seed) agar identik di setiap environment. Katalog ini eksplisit sebuah **scaffold**, diturunkan langsung dari deskripsi role yang sudah disetujui pada `docs/SECURITY-PRIVACY-RETENTION.md` §3 — bukan final named permission matrix; itu tetap Owner input yang belum diberikan. Permission sensitif (KTP, signature, payment evidence, selfie, export) dikatalogkan dengan `sensitive=true` tetapi sengaja tidak digrant ke role manapun secara default.
- Owner baseline sengaja hanya governance (`identity.role.manage`, `identity.permission.manage`, `identity.employee.manage`, `audit.view`, `security.config.manage`), bukan operational permission — Owner yang juga bertugas Front Office perlu digrant role `FRONT_OFFICE` terpisah melalui mekanisme grant yang sama.
- `src/platform/authorization.ts`: `getActivePermissionCodes`/`hasPermission`/`requirePermission` menghitung permission dari `user_roles` (effective-dated, property-scoped) → `role_permissions` → `permissions`, dengan dua deny-all gate: `users.status !== 'ACTIVE'` dan `employee_profiles.employment_status !== 'ACTIVE'` (employee tanpa profile tidak ikut terblokir gate kedua).
- `src/platform/rbac-admin.ts`: grant/revoke mewajibkan `identity.role.manage`, menolak self-role-edit, meminta alasan, serta menulis mutation dan mandatory redacted audit dalam satu transaction. Security event tetap menjadi monitoring tambahan.
- `src/platform/property.ts` menambah `getActivePropertyId()` (melempar error, bukan menebak, bila 0 atau >1 property aktif) karena setiap `user_roles` grant property-scoped.
- Dua route demonstrasi default-deny: `GET /api/staff/me/permissions` (session-gated, mengembalikan permission milik caller sendiri) dan `POST`/`DELETE /api/staff/role-grants` (permission-gated `identity.role.manage`, menolak self-target, tidak pernah memakai `propertyId` dari client).
- Private-file adapter sekarang mewajibkan named permission dan memanggil authorization service sendiri sebelum membaca bytes; route domain tidak dapat melewati guard karena lupa memanggilnya.
- Migration `0006_platform_safety_hardening` menolak periode grant user/role/property yang overlap. Permission list API menjadi sumber menu staff ketika halaman domain mulai dibuat; backend tetap enforcement resmi.
- Positive/negative route tests, inactive-user/employee, property scope, self-edit, ordinary-login permission, mandatory audit, migration constraints, dan production build lulus. Final permission assignment tetap input konfigurasi Owner, bukan pekerjaan kode yang ditunda.

### Langkah 8 — Shared platform services

Status: `DONE` — hardening review lulus 2 Agustus 2026.

Tujuan: fitur bisnis tidak membuat audit, retry, file, dan error handling masing-masing.

Pekerjaan:

- Audit writer dengan redaction.
- Idempotency middleware/service.
- Transactional outbox, BullMQ worker, retry/backoff, dan dead-letter/review state.
- Private local file-storage adapter dengan opaque key, validation, malware-scan hook, authorized access, dan purge state.
- Structured log/correlation ID, security event, error contract, health/readiness endpoint.
- Clock/business-date service untuk Asia/Jakarta.

Verifikasi: retry tidak menggandakan record; failed job dapat diulang; file tidak dapat diakses melalui public path; sensitive content tidak masuk log/audit.

Exit gate: seluruh feature module berikutnya memakai shared services ini.

Hasil 2 Agustus 2026:

- Seluruh tabel dasar berasal dari Langkah 1; migration `0006_platform_safety_hardening` menambahkan state/lease guard outbox serta role-period exclusion setelah concurrency review.
- `src/platform/clock.ts`: `getBusinessDate()` menghitung business date Asia/Jakarta dengan rollover default pukul 04:00 (dapat dikonfigurasi per pemanggilan), konsisten dengan PRD §19.1; timestamp aktual dan business date tetap dua nilai terpisah — module ini tidak menyimpan apa pun, hanya menghitung.
- `src/platform/redaction.ts` + `src/platform/logger.ts`: satu key-name denylist dipakai bersama oleh Pino structured logger dan audit writer, bukan Pino `redact` bawaan (path-based, tidak menjangkau nested object dinamis). Ini baseline safety net, bukan pengganti kehati-hatian caller.
- `recordAuditEvent()` sekarang fail-closed dan menerima transaction handle; `recordBestEffortAuditEvent()` hanya tersedia dengan nama eksplisit untuk diagnostic non-authoritative.
- `withIdempotency()` menjalankan claim, domain callback, outbox/audit caller, dan completion snapshot dalam satu transaction. Owner binding diperiksa, expired/stale key direklaim, dan rollback callback tidak meninggalkan mutation tanpa completion record.
- Outbox claim mengubah row menjadi `PROCESSING` dengan lease 30 menit sebelum row lock dilepas. Worker lain melewati lease aktif; crash recovery mereklaim lease stale. Completion/dead-letter dan `job_executions` commit atomik serta memeriksa lease owner.
- Worker memakai environment injection production dan hanya memuat `.env.local` sebagai fallback development. Handler `auth.password-reset` telah terpasang; interval dibaca setelah environment siap.
- `src/platform/file-storage.ts`: upload metadata+audit dan purge metadata+audit transactional; read memeriksa named permission, CLEAN/purge state, membaca bytes, lalu fail-closed bila access audit gagal. Opaque key, MIME/magic-byte validation, dan private root tetap berlaku.
- `src/platform/email.ts`: adapter Nodemailer tipis di atas `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` (Mailpit di development, relay nyata di uat/production); dokumentasi eksplisit bahwa pengiriman email fitur bisnis seharusnya lewat outbox job handler, bukan dipanggil langsung dari request handler.
- `src/platform/errors.ts`: kontrak `AppError`/`toErrorResponse` generik (`VALIDATION_ERROR`…`INTERNAL_ERROR`) agar unknown error tidak pernah membocorkan pesan asli ke client.
- `GET /api/health` diperluas: database tetap kritis (503 bila gagal), Redis dan outbox backlog dilaporkan sebagai `degraded` (200) karena keduanya non-authoritative per `docs/TECHNICAL-ARCHITECTURE.md` §4 — proses tetap bisa melayani booking-critical work walau Redis mati.
- Quality gate dan security audit lulus; disposable PostgreSQL test membuktikan empty/idempotent migration, constraints, concurrent two-worker claim tepat satu pemenang, stale-lease recovery, dan reset/recreate. Seluruh migration `0000`–`0006` juga berstatus applied pada database development.
- Risiko yang diterima untuk fondasi ini: AV engine nyata baru dipasang saat upload domain KTP/selfie dibangun; worker raw SQL dan service Drizzle tetap dua adapter yang dijaga contract/integration test; external provider side effect tetap wajib memakai event id sebagai idempotency reference karena distributed exactly-once tidak dapat dijamin hanya oleh database lokal.

### Langkah 9 — Property dan configuration administration

Status: `IMPLEMENTED — UNVERIFIED` sebagai bagian Technical Batch 1.

Tujuan: setting dapat diubah tanpa mengubah kode serta tidak menulis ulang histori.

Pekerjaan:

- Property profile dan operational setting.
- Draft/scheduled/active/retired version lifecycle.
- Separate approval status, effective date, impact preview, audit, dan archive.
- Policy, bank instruction, tax/service, exchange-rate display, document profile/sequence administration.
- Resolved-value viewer agar admin melihat nilai dan version source yang berlaku.

Owner input: P0 configuration owner, approval/risk rules, legal/payment data.

Verifikasi: effective-period overlap ditolak; historical snapshot tidak berubah; high-risk change membutuhkan guard yang benar.

Exit gate: module lain tidak membaca configuration hard-coded.

### Langkah 10 — Room, amenity, occupancy, dan resource master

Status: `IMPLEMENTED — UNVERIFIED` sebagai bagian Technical Batch 1.

Tujuan: membentuk inventory fisik yang benar.

Pekerjaan:

- CRUD/archive room type, versioned capacity, amenity, bed, dan extra-bed rule.
- Room unit dengan nomor string, sort order, active type period, serta separate room states.
- Shared extra-bed resource pool.
- Impact check sebelum room/type/capacity changes.
- Basic room-list dan master-data audit.

Owner input: daftar final kamar, type, kapasitas, amenity, extra bed, serta initial serviceability.

Verifikasi: duplicate room number, overlapping type period, capacity reduction conflict, dan archive referenced master tests.

Exit gate: inventory produksi belum diaktifkan sampai data real ditandatangani.

### Langkah 11 — Rate, tax, payment-policy, dan document master

Status: `IMPLEMENTED — UNVERIFIED` sebagai bagian Technical Batch 1.

Tujuan: quote menggunakan nilai resolved dan booking menyimpan snapshot.

Pekerjaan:

- Rate plan, base/weekday/weekend/season/special-date rules serta deterministic priority.
- Tax/service/No Tax profile per kategori.
- Online full-payment serta manual deposit/pay-at-property policy.
- Payment deadline/reminder, cancellation/no-show, House Rules, dan document profile.
- IDR official dan USD/AUD display-rate configuration.

Owner input: tarif, tax validation, bank, policy text, dan identity dokumen produksi.

Verifikasi: missing-rate/no-zero guard, rule priority, stale currency, tax snapshot, dan document-sequence concurrency.

Exit gate: synthetic rate/policy set dapat menghasilkan quote deterministik.

Hasil implementasi Technical Batch 1, 2 Agustus 2026:

- Tiga default-deny API admin tersedia untuk property setting, room master, dan commercial master; property scope selalu diambil server-side.
- Version lifecycle, optional/risk-based approval, effective date, resolved setting viewer, impact preview, archive guard, transaction, advisory lock, dan mandatory audit tersedia.
- Nomor kamar tetap string sehingga nomor single digit valid; room type dipisahkan melalui effective-dated type period dan room state tetap tiga dimensi terpisah.
- Rate plan mendukung base/week-pattern/seasonal/special-date serta exact-date override dengan resolver deterministik dan larangan implicit zero rate.
- Official value tetap IDR; USD/AUD memakai expiring display snapshot. Bank account dan tax identity memakai AES-256-GCM, sedangkan response/audit hanya membawa metadata aman.
- Migration `0007_master_configuration_controls`, permission catalog, serta focused test versioning/encryption sudah ditulis tanpa membuat production seed.
- Atas keputusan Owner, migration, type-check, test, build, dan full quality belum dijalankan. Karena itu exit gate Langkah 9–11 belum dinyatakan lulus dan status tidak ditulis `DONE`.

### Langkah 12 — Availability search dan quote

Status: `IMPLEMENTED — UNVERIFIED` sebagai bagian Technical Batch 2.

Tujuan: customer dapat mencari room type yang benar-benar tersedia.

Pekerjaan:

- Search request validation: dates, room count, guests, extra bed.
- Generate/extend `inventory_days` horizon.
- Availability calculation dari capacity dan active claims.
- Nightly pricing/tax/display-currency quote snapshot dengan expiry.
- Short checkout-session hold dan final transactional recheck.
- Deterministic row-lock order untuk multi-room/multi-night.

Verifikasi: last-unit race, multi-room atomicity, same-day turnover, block, extra-bed shortage, retry/idempotency, dan expired quote.

Exit gate: concurrency test membuktikan hard overbooking tidak terjadi.

### Langkah 13 — Online dan manual reservation

Status: `IMPLEMENTED — UNVERIFIED` sebagai bagian Technical Batch 2.

Tujuan: membuat satu/multi-room reservation tanpa langsung memilih nomor kamar.

Pekerjaan:

- Customer booking form serta admin manual booking.
- Booking code high-entropy, booker/guest/room-line model, nightly snapshot, master folio creation.
- Online payment hold dan deadline; manual payment policy selection.
- Policy acknowledgement dan source-specific validation.
- Cancel/expire actions dengan atomic claim release.

Verifikasi: single/multi-room, duplicate submit, partial failure rollback, policy snapshot, expiry, dan admin manual booking tests.

Exit gate: booking baru menghasilkan reservation, room lines, claims, folio, dan outbox secara atomik.

### Langkah 14 — Payment, lookup, dan customer communication

Status: `IMPLEMENTED — UNVERIFIED` sebagai bagian Technical Batch 2.

Tujuan: booking online dapat kembali diakses dan dikonfirmasi setelah transfer manual.

Pekerjaan:

- Booking code lookup dengan email opsional sebagai verifikasi tambahan, generic error, rate limit, dan short-lived session.
- Proforma/payment instruction dan deadline countdown.
- Pending verification queue, verify/reject/void/reversal.
- Confirmation hanya setelah online verified 100%.
- Email reminder/expiry/verified/rejected/confirmation melalui outbox.
- WhatsApp manual/deep link tetap communication channel, bukan source of truth.

Verifikasi: wrong-email enumeration, partial payment, review hold, late proof, duplicate verify, void, expired hold, dan notification dedupe.

Exit gate: customer journey booking→transfer→verification→confirmation lulus integration test.

Hasil implementasi Technical Batch 2, 2 Agustus 2026:

- Public availability, quote, reservation, serta code+email customer return API tersedia tanpa customer login; session lookup memakai opaque HttpOnly token berumur pendek, generic error, rate limit, security event, dan audit.
- Inventory horizon berasal dari unit fisik/effective room type. Quote mengunci room-type/date secara deterministik, mengambil nightly rate/tax/display snapshot, dan membuat checkout hold 15 menit.
- Single/multi-room reservation online/manual dibuat atomik tanpa nomor kamar, termasuk booker guest, policy acknowledgement, room/night snapshot, inventory claim, master folio/bucket/room charge, status event, audit, dan outbox.
- Online booking selalu required payment 100% IDR dengan default deadline 2 jam atau 1 jam same-day; admin booking dapat memakai full/fixed/percentage/pay-at-checkin/pay-at-checkout.
- Front Office dapat mencatat bukti/reference, verify/reject/void payment. Pending verification yang diterima sebelum deadline menjadi review hold; full verified online payment mengubah booking menjadi confirmed/guaranteed serta payment claim menjadi committed.
- Worker topic untuk quote expiry, guarded reservation expiry, dan transactional email tersedia. Expiry melepaskan claim tepat satu kali; reminder dibatalkan ketika payment selesai.
- Migration `0008_booking_transaction_flow`, focused domain/contract tests, dan dokumentasi `BOOKING-API.md` sudah ditulis tanpa production seed.
- Formatting, zero-warning lint, strict type-check, 201 automated tests, schema check, production build, dan dependency audit telah lulus pada pemeriksaan 2 Agustus 2026. Full quality masih gagal karena coverage global 21,56% belum memenuhi threshold 80%; migration dan integration/concurrency gate belum dijalankan. Exit gate Langkah 12–14 belum dinyatakan lulus dan seluruh kode tetap berstatus `IMPLEMENTED — UNVERIFIED`.

### Langkah 15 — Room board, allocation, Live Room Monitor, dan block

Tujuan: Front Office melihat dan mengatur semua kamar dari satu layar.

Pekerjaan:

- Room board/calendar dan unassigned-arrival queue.
- Assignment yang memvalidasi room type, unit state, dan physical room-night claim.
- Live Room Monitor dengan active guest, next arrival, housekeeping, serviceability, dan stale indicator.
- Shared Display Mode dengan masking.
- Maintenance block/Out of Order serta basic room move.

Verifikasi: assignment/block collision, two-admin race, room move cleaning, masking, unassigned booking, dan stale-refresh tests.

Exit gate: setiap active room unit tampil tepat sekali dan tidak dapat double-assigned.

### Langkah 16 — Stay, check-in/out, dan amendment

Tujuan: mengelola operasional tamu tanpa mencampurkan reservation dan stay status.

Pekerjaan:

- Arrival/due-in/in-house/due-out/checked-out/no-show actions per room stay.
- Optional KTP/guest photo/signature capture/decline/skip.
- Early check-in/late checkout Front Office decision.
- Extension, date move, shortening, partial multi-room, early departure.
- Guaranteed no-show retain/release workflow.
- Flexible Departure Clearance.

Verifikasi: partial multi-room arrival, optional capture failure, readiness override, extension conflict, midnight late arrival, early departure, and checkout guard.

Exit gate: seluruh state transition terjadi melalui business action dan audit, bukan generic dropdown.

### Langkah 17 — Folio, invoice, payment allocation, dan refund

Tujuan: seluruh nilai dapat ditelusuri dari satu master folio.

Pekerjaan:

- Immutable debit/credit posting dan reversal.
- Room charge, discount, adjustment, payment, refund, damage, serta F&B source linkage.
- Billing bucket untuk payer/group flexibility.
- Proforma, combined/room-only/split/custom invoice coverage.
- Receipt, refund note, PDF render, print, email, void/supersede.
- Manual refund attempts/proof serta payment allocation.

Verifikasi: balance equation, duplicate posting, reversal, split coverage, combined consistency, tax/no-tax, document number race, refund retry, dan folio close/reopen.

Exit gate: setiap angka pada dokumen dapat ditelusuri ke source folio entry dan tidak ada duplicate final coverage.

### Langkah 18 — Housekeeping, maintenance, damage, dan Lost & Found

Tujuan: menutup workflow property operations Phase 1A.

Pekerjaan:

- Automatic checkout/stayover/room-move/deep-clean/public-area tasks.
- Assigned/In Progress/Cleaned/Inspected serta Deferred/Unable to Access.
- Physical DND reason dan guest-requested cleaning.
- Maintenance issue, room block, Out of Order, Return to Service.
- Damage catalog/incident/assessment→folio charge.
- Lost & Found item, evidence, claim, custody, pickup/shipping/disposition.

Owner input: checklist/SLA/evidence, damage price/tax, Lost & Found retention/custody rules.

Verifikasi: checkout turnover, DND, failed inspection, return-to-service, damage reversal, high-value custody, dan retention guard.

Exit gate: room readiness hanya benar setelah workflow sumbernya selesai.

Hasil implementasi Technical Batch 3, 2 Agustus 2026:

- Live Room Monitor, Shared Display masking, physical room-night assignment/block, serta room move dengan price treatment, audit, dan cleaning task tersedia melalui staff API.
- Stay business actions memisahkan reservation/stay/room/cleaning state. Check-in readiness guard, optional identity/photo/signature outcome, early/late decision, flexible checkout, dan guaranteed no-show retain/release tersedia.
- Master folio mendukung immutable debit/credit/reversal, source linkage, tax components, combined/room-only/custom document coverage, document numbering/snapshot, PDF render/email worker, payment allocation, dan refund transfer manual.
- Housekeeping queue mencakup daily checkout/stayover generation, guest-away request, DND/deferred/unable-to-access, Cleaned→Inspected readiness; maintenance, damage-to-folio, dan Lost & Found custody/claim juga tersedia.
- Migration `0009_operational_workflows`, focused contract tests, dan dokumentasi `OPERATIONS-API.md` sudah ditulis tanpa production seed.
- Amendment kompleks (extension/date move/shortening/partial multi-room), document void/supersede, Lost & Found pickup/shipping/disposition action, serta automatic scheduler wiring belum selesai dan tetap menjadi gap Batch 3 sebelum exit gate.
- Formatting, zero-warning lint, strict type-check, 201 automated tests, schema check, production build, dan dependency audit telah lulus pada pemeriksaan 2 Agustus 2026. Full quality masih gagal karena coverage global 21,56% belum memenuhi threshold 80%; migration dan database concurrency test Batch 3 belum dijalankan. Exit gate Langkah 15–18 belum dinyatakan lulus dan seluruh kode tetap `IMPLEMENTED — UNVERIFIED`.

### Langkah 19 — CMS dan public landing Versi 01

Status: `IMPLEMENTED — UNVERIFIED`.

Hasil Technical Batch 4:

- Landing Versi 01 responsive dengan section ringkas, authentic baseline media, ID/EN, pilihan IDR/USD/AUD, booking search, dan sticky mobile CTA.
- Bilingual CMS revision, review, protected preview, publish, archive/restore, transactional audit/outbox, dan approved safe baseline.
- Public room content berasal dari operational master; CMS menolak price/capacity/availability dan hanya menampilkan room yang memiliki authentic published media.
- Private media staging, scan/publication gate, rights/alt bilingual, public delivery, serta link media ke section dan room type.
- Metadata canonical/hreflang/Open Graph, protected noindex preview, migration `0010`, API documentation, dan automated coverage tests.

Verifikasi yang sudah lulus: format, lint, strict type-check, 467 test dengan global coverage threshold, Drizzle schema check, production build, dependency audit 0 vulnerability, dan disposable PostgreSQL migration sampai `0010`. Browser/accessibility/performance QA, final Owner content, AV engine nyata, serta UI staff visual masih menunggu; exit gate production belum lulus.

Tujuan: mengganti mockup menjadi landing/booking production experience.

Pekerjaan:

- Implement visual Versi 01 dengan responsive/mobile behavior.
- CMS page/section revision, translation, preview/review/publish.
- Room content dari operational master; tidak menggandakan price/capacity.
- ID/EN control, IDR/USD/AUD display control, sticky mobile booking CTA.
- Authentic KOOKA media, trust strip, verified testimonial, real location/distance, FAQ.
- SEO, accessibility, performance, image/video handling.

Owner input: authentic photos, final bilingual content, verified facts/testimonials/location.

Verifikasi: mobile journey, keyboard/screen-reader, performance budget, broken translation, stale exchange rate, and publish rollback.

Exit gate: placeholder/unverified copy tidak muncul pada production preview.

### Langkah 20 — Basic manual F&B paper-order entry

Status teknis: `IMPLEMENTED — UNVERIFIED`. Public menu bilingual, display estimate IDR/USD/AUD, versioned menu master, paper reference/idempotency, printed-price snapshot, standalone payment/receipt, guarded room charge, fulfillment transition, cancellation/reversal, audit, RBAC Front Office, migration `0011`, dan automated tests sudah tersedia. Data produksi dan UAT Owner tetap menjadi exit gate.

Tujuan: Front Office memasukkan formulir kertas secara aman.

Pekerjaan:

- Public menu item/price/availability dari master.
- Unique paper reference, item/version/price/tax snapshot.
- Standalone atau room-charge routing dengan guest/room verification.
- Cancel/reversal dan receipt/folio linkage.

Owner input: menu final, form/reference rule, tax, hours, mismatch and paper-retention policy.

Verifikasi: duplicate reference, wrong-room, changed price, standalone payment, room charge, cancel/reversal.

Exit gate: satu paper item hanya dapat membuat satu source charge.

### Langkah 21 — Reporting dan daily operations

Status: `IMPLEMENTED — UNVERIFIED` sebagai Technical Batch 6. Dashboard membaca sumber transaksi langsung; rollover otomatis/fallback, exception workflow, privacy-safe CSV, permission/audit, dan migration `0012` tersedia. Format, zero-warning lint, strict type-check, 59 test files/541 tests, coverage global di atas threshold, schema check, production build, dependency audit, disposable PostgreSQL migration sampai `0012`, serta clean/idempotent synthetic reconciliation exit gate sudah lulus. Status tetap belum `DONE` sampai permission/value produksi dan UAT dashboard/operasional disetujui Owner.

Tujuan: menyediakan monitoring dan reconciliation tanpa membuat source of truth baru.

Pekerjaan:

- Arrival/departure/upcoming/unassigned/payment/cleaning/maintenance/refund queues.
- Automatic daily rollover dan lightweight daily close exception list.
- Occupancy, revenue, outstanding balance, refund, and operational summaries.
- CSV export dengan permission dan privacy masking.
- Reconciliation query untuk inventory, assignment, folio, payment, document, dan attendance readiness.

Verifikasi: timezone/business-date rollover, stale queue, report-to-source reconciliation, masked export, large-range guard.

Exit gate: tidak ada unresolved critical reconciliation mismatch pada synthetic data.

### Langkah 22A — Staff UI foundation

Tujuan: menyediakan pintu masuk dan pantauan operasional yang dapat digunakan oleh setiap role tanpa menggandakan sumber data bisnis.

Status: `IMPLEMENTED — UNVERIFIED`. Verifikasi otomatis format, lint, strict type-check, unit/component test dengan global coverage threshold, dan production build sudah lulus. Browser/device accessibility QA dan UAT staf nyata belum dilakukan.

Pekerjaan yang sudah tersedia:

- Login staf email/password biasa yang memakai Better Auth yang sama; tidak ada MFA/TOTP, signup, atau login customer.
- Shell operasional responsive dengan menu yang disaring memakai named permission dari server.
- Dashboard Harian yang membaca report direct-source, menampilkan occupancy, arrival/departure, unassigned room, payment review, outstanding folio, dan perhatian operasional.
- Live Room Monitor berbasis unit fisik dengan status occupancy, stay, housekeeping, serviceability, next arrival, filter, dan refresh berkala.
- Privacy guard untuk role yang hanya memiliki `room.board.view`: nama tamu dan kode booking selalu dimasking walaupun client mencoba meminta tampilan penuh.
- Workspace baca dasar Housekeeping dan F&B agar role terkait mempunyai landing operasional dalam satu login.
- State loading, error, stale-data, empty, akses ditolak, responsive mobile/tablet, focus state, skip link, dan reduced-motion baseline.

Belum termasuk dalam 22A dan tetap menjadi pekerjaan UI berikutnya:

- Form/action booking, payment verification, check-in/out, room move, folio/invoice/refund, dan full housekeeping/F&B workflow.
- UI administration untuk property/configuration, room/rate/tax/policy, CMS/media/menu, user/role, reporting/export, dan audit.
- Browser/device matrix, accessibility audit nyata, performance/load baseline, serta UAT per role.

Exit gate: login dan seluruh route 22A lolos test/build, akses menu mengikuti permission, dan room-board-only viewer tidak dapat membuka identitas tamu. Status menjadi `DONE` setelah browser/device QA serta UAT Owner/Front Office/Cleaning/F&B.

### Langkah 22B — Phase 1A hardening

Tujuan: memastikan fitur yang terlihat selesai juga aman dan dapat dipulihkan.

Status: `IMPLEMENTED — UNVERIFIED`. Technical hardening, disposable PostgreSQL concurrency gate, local performance baseline, dan local database restore rehearsal sudah lulus. AV engine nyata, full CSP nonce, browser/device/screen-reader matrix, private-storage restore evidence, dan accepted-risk/UAT Owner masih menunggu.

Pekerjaan yang tersedia:

- Concurrency/idempotency test untuk one-owner key, physical room-night collision, outbox lease/recovery, dan daily rollover replay.
- Authorization matrix, session contract seluruh staff API, shared room privacy guard, dan same-origin mutation guard.
- Security headers, upload dimension/metadata sanitization, sensitive-file access test, retention/purge dry-run, dan audit/URL redaction.
- Queue failure/retry/dead-letter, stable email Message-ID, serta PDF render/email retry recovery.
- Local performance baseline sesuai skala guesthouse dan script aman untuk target terkontrol.
- Accessibility/responsive baseline serta browser/device matrix yang harus diisi melalui UAT evidence.
- Dependency/security review serta localhost-only database/private-storage restore rehearsal.

Exit gate: tidak ada critical/high unresolved defect; AV/CSP/browser/private-storage gaps ditutup atau diterima eksplisit sebagai risk oleh Owner.

### Langkah 22C — Admin & Operational UI (Technical Batch 7)

Status: `IMPLEMENTED — UNVERIFIED`. Structured UI, permission guard, route pendukung, focused test, lint, type-check, global coverage gate, production build, serta unauthenticated browser smoke test sudah lulus. UAT transaksi dengan session masing-masing role, camera/file-picker permission pada tablet nyata, signature canvas, screen-reader, dan final device matrix masih menunggu Langkah 23.

Tujuan: membuka workflow Phase 1A yang sudah tersedia di backend melalui antarmuka terstruktur untuk Owner, Front Office, Cleaning, dan F&B.

Pekerjaan:

- Front Office desk untuk booking manual multi-room, pembayaran, check-in/out, no-show, optional KTP/foto/tanda tangan, room assignment/move, folio, invoice, dan refund manual.
- Antrean booking dan pembayaran yang dapat dipilih langsung tanpa menyalin identifier dari database.
- Workspace operasional penuh untuk housekeeping/maintenance serta paper-order F&B.
- Workspace Owner/Admin untuk property configuration, room master, commercial/tax/rate, CMS/media/menu, staf/role, audit, laporan, rollover, reconciliation, dan export.
- Navigasi permission-aware, structured validation, confirmation/result state, responsive layout, serta audit-safe mutation melalui route server yang sudah ada.

Verifikasi: focused component/route test, permission navigation matrix, lint/type-check, production build, dan browser smoke test per role.

Exit gate: workflow utama Phase 1A dapat dilakukan dari UI tanpa input JSON atau akses database langsung; data produksi yang belum tersedia tetap tidak diisi sebagai asumsi.

### Langkah 23 — UAT preparation dan execution

Status: `IMPLEMENTED — UNVERIFIED`. Local environment/data, automated verification, four-role credential smoke, dan Cleaning browser smoke lulus. Human scenario execution, tablet camera/signature, device/accessibility matrix, defect retest operasional, dan per-role sign-off masih menunggu. Login seluruh role memakai email/password biasa tanpa MFA.

Tujuan: pengguna operasional memvalidasi workflow nyata menggunakan data sintetis.

Pekerjaan:

- UAT environment terpisah.
- Synthetic room/rate/booking/payment/stay/folio/cleaning data.
- Scenario pack untuk Owner, Front Office, Cleaning, F&B, dan content owner.
- Defect triage, retest, acceptance evidence, dan sign-off.

Owner input: data konfigurasi hampir-final dan pengguna UAT.

Exit gate: seluruh P0/build-critical P1 selesai dan per-role UAT sign-off tercatat.

Hasil 2 Agustus 2026:

- Database lokal khusus `kooka_phase1_uat_test`, environment/port/private directory terpisah, credential acak yang di-ignore, reset guard, serta credential rotation/revoke-session workflow tersedia.
- Dataset sintetis berisi empat role, enam kamar bernomor tunggal, dua tipe kamar, rate/tax UAT, empat lifecycle booking, payment review, active stay/folio, tiga cleaning task termasuk `GUEST_AWAY_REQUEST`, dan dua menu F&B.
- `uat:prepare`, independent `uat:verify`, serta credential login/role landing Owner, Front Office, Cleaning, dan F&B lulus. Owner/Front Office langsung memperoleh permission sesuai role setelah login; tidak ada enrollment MFA.
- Browser smoke Cleaning lulus dari login sampai queue Housekeeping; tiga task dan request ketika tamu pergi tampil tanpa console error. Tidak ada status task yang dimutasi karena itu bagian human UAT.
- Scenario pack, evidence sheet, severity/exit gate, dan defect register tersedia. Dua defect environment lokal ditemukan, diperbaiki, dan lulus retest.
- Exit gate belum lulus karena sign-off operasional manusia dan device/accessibility evidence belum tersedia; Langkah 24 tetap `WAITING`.

### Langkah 24 — Production readiness

Tujuan: membuat deployment dapat dioperasikan dan dipulihkan.

Pekerjaan:

- Provision VPS, DNS/TLS, Docker Compose production, firewall, private network/volume.
- Secret management, resource limit, database connection pool.
- Encrypted off-server database/file backup dan restore test.
- Monitoring CPU/RAM/disk/database/Redis/worker/queue/backup/security event.
- Deployment/rollback runbook, maintenance mode, Offline Operations Log.
- Production migration dry-run pada clone/disposable environment.

Exit gate: Go/No-Go checklist, rollback/offline procedure, restore evidence, dan responsible owner tersedia.

### Langkah 25 — Phase 1A Go-Live dan hypercare

Tujuan: mengaktifkan aplikasi tanpa migrasi legacy.

Pekerjaan:

- Input/sign-off master production.
- Opening Booking/block hanya untuk commitment aktif yang masih berlaku.
- Final reconciliation serta Go/No-Go.
- Deploy, migrate once, seed controlled data, smoke test, redirect/launch.
- Hypercare queue, incident ownership, daily reconciliation, and rollback decision window.

Exit gate: operasi harian stabil, critical queue kosong, backup sukses, dan Owner menutup hypercare.

### Langkah 26 — Attendance production configuration

Status: `OWNER INPUT`, dapat disiapkan paralel setelah Step 8.

Tetapkan:

- Supported browser/device dan PWA behavior.
- Attendance location, coordinates, radius, accepted GPS accuracy.
- Selfie policy/retention/access.
- Shift template/window/tolerance/cross-midnight serta Free Mode eligibility/max duration.
- Direct-admin correction permission dan reason/evidence rule.

Exit gate: privacy notice, permission, retention, dan operational values disetujui.

### Langkah 27 — Employee attendance route

Tujuan: karyawan menggunakan login yang sama untuk attendance.

Pekerjaan:

- `/staff/attendance` serta personal history.
- Kamera depan, current location, server-side geofence dan official server time.
- Shift/Free Mode check-in/out, idempotency, failure recovery.
- Tidak menampilkan shift hari ini dan tidak membuat correction-request form.

Verifikasi: permission denial, inaccurate GPS, duplicate submit, cross-midnight, forgotten checkout, private selfie access.

Exit gate: employee hanya melihat data sendiri dan event asli append-only.

### Langkah 28 — Admin attendance

Tujuan: admin mengelola attendance tanpa HRIS/payroll scope.

Pekerjaan:

- Employee/location/shift/assignment administration.
- Daily monitor, exception, open session, geofence summary.
- Direct admin correction dengan before/after/reason/audit.
- Privacy-safe CSV export dan restricted selfie view.

Verifikasi: correction preserves original event, export masking, inactive employee, permission and access-audit tests.

Exit gate: seluruh admin action mempunyai named permission serta audit.

### Langkah 29 — Phase 1B UAT dan release

Tujuan: merilis attendance secara independen dari lodging.

Pekerjaan:

- Device/browser/geofence boundary UAT pada titik sebenarnya.
- Shift dan Free Mode, cross-midnight, duplicate/offline failure, direct correction.
- Retention/access/export verification.
- Independent Go/No-Go serta support instruction.

Exit gate: attendance sign-off tercatat; release tidak mengubah lodging lifecycle.

### Langkah 30 — Phase 2/3 review

Status: `DEFERRED`.

Setelah Phase 1 stabil, lakukan change request/prioritization baru untuk group/package/whole house, full POS, services/tours, deferred operation modules, WhatsApp API, payment gateway, OTA/channel manager, accounting/inventory integration, atau smart lock. Setiap activation memerlukan scope, schema delta, migration, security, UAT, dan deployment plan tersendiri.

## 5. Input Owner yang tidak menghalangi Langkah 2–8

Input berikut dapat dikumpulkan paralel dan baru menjadi blocker pada langkah domain terkait:

- Daftar final kamar/type/capacity/amenity/extra bed.
- Tarif, tax/service, rekening, payment/cancellation/no-show policy.
- Legal document identity dan bilingual content.
- Permission matrix, retention, privacy/purpose text.
- Cleaning/maintenance/damage/Lost & Found rules.
- Menu F&B dan paper-order procedure.
- Authentic media, verified testimonials, dan location facts.
- Attendance geofence, shift, device, selfie, and retention values.

Daftar P0/P1 lengkap tetap dikelola pada [PHASE-1-READINESS-CHECKLIST.md](PHASE-1-READINESS-CHECKLIST.md), bukan diduplikasi sebagai checklist baru di sini.

## 6. Cara menjalankan langkah berikutnya

Ketika Owner mengatakan “lanjut”, default pekerjaan adalah melanjutkan **Langkah 23: human UAT execution dan sign-off** memakai scenario pack. Langkah 24 belum dimulai sebelum gate UAT lulus. Setelah selesai, laporan harus memuat:

- file/perubahan yang dibuat;
- command/test yang dijalankan dan hasilnya;
- keputusan/asumsi;
- hal yang sengaja belum dikerjakan;
- apakah exit gate lulus;
- satu rekomendasi langkah berikutnya.

Jika verification ditunda oleh Owner, kode boleh berlanjut ke batch berikutnya dengan status `IMPLEMENTED — UNVERIFIED`; seluruh gate yang tertunda tetap wajib dituntaskan sebelum UAT/go-live.
