# Redesign Kooka

Project workspace untuk redesign landing page serta pembangunan satu aplikasi web terpadu bagi booking, operasional, admin, dan absensi karyawan KOOKA Residence Surabaya.

## Tujuan

- Meningkatkan direct booking melalui pengalaman web yang lebih ringkas, meyakinkan, dan berfokus pada kamar.
- Menerjemahkan arah visual **Urban Tropical Retreat** menjadi pengalaman boutique guesthouse yang tenang, hangat, hijau, dan personal.
- Menyatukan reservasi, inventory kamar, pembayaran manual, folio, dokumen, refund, dan housekeeping dalam satu sistem operasional.
- Menyiapkan fondasi untuk POS, services/tours, integrasi WhatsApp, payment gateway, OTA, dan sistem bisnis lain pada fase berikutnya.
- Menyediakan absensi karyawan sederhana melalui mobile dengan selfie, geofence lokasi kerja, mode shift, dan mode bebas.

Website saat ini: [kookaresidencesby.com](https://www.kookaresidencesby.com/)

## Scope

### Phase 1 — Core lodging MVP

- Landing page baru dan CMS dasar.
- House Rules bilingual/versioned dengan booking snapshot, online checkbox acknowledgement, dan pencatatan manual Front Office tanpa mewajibkan tanda tangan digital.
- Bahasa Indonesia/English dan pilihan tampilan harga IDR/USD/AUD; seluruh transaksi tetap diproses dalam IDR.
- Semua tarif kamar bersifat room-only terhadap makanan; F&B selalu dipesan dan ditagihkan terpisah, tanpa breakfast included.
- Pesanan makanan memakai formulir kertas di kamar; Front Office memasukkannya ke sistem sebagai standalone atau room charge setelah verifikasi.
- Master room type, unit fisik, amenity, rate, dan availability.
- Booking single/multi-room, booking manual, dan kode booking.
- Booking online wajib membayar 100% melalui transfer manual sebelum confirmation; deposit persentase/nominal tetap serta pay-at-check-in/checkout hanya tersedia untuk booking yang dibuat admin berizin.
- Customer tanpa login dapat kembali memakai booking code; email bersifat opsional sebagai verifikasi tambahan. Instruksi transfer, countdown deadline, reminder email, dan WhatsApp manual menjadi fondasi komunikasi Phase 1.
- Check-in fleksibel dengan foto identitas/KTP dan tanda tangan digital opsional melalui ponsel, tablet, atau upload file.
- Login, RBAC, dashboard, Live Room Monitor seluruh kamar, room board, room allocation, dan basic room move.
- Master data/configuration dengan version, effective date, impact preview, risk-based approval, archive, dan audit.
- Folio, invoice/proforma/receipt/refund note, PDF/print/email, dan refund manual.
- Basic manual F&B paper-order entry oleh Front Office dengan reference unik, standalone/room-charge route, price/tax snapshot, dan audit.
- Flexible Departure Clearance opsional per kamar dengan checklist singkat, issue routing, skip beralasan, dan tanpa menahan tamu tanpa batas.
- Jadwal cleaning otomatis dan akses khusus Cleaning.
- Maintenance issue/workflow, room block/Out of Order, return-to-service, dan Damage Charge Catalog yang dapat dimasukkan ke folio checkout.
- Lost & Found dengan pencatatan barang/inquiry, verifikasi klaim, chain of custody, pickup/shipping, retention, dan disposition.
- Automatic daily rollover, guaranteed late-arrival handling, no-show exception, dan daily close ringan.
- ETA serta early check-in/late checkout yang hanya disetujui Front Office berdasarkan room readiness, next arrival, occupancy, dan turnover time.
- Guest Request/special preference dasar dengan status review/accept/fulfill, target waktu, pre-arrival alert, routing ke workflow sumber, dan perlindungan data sensitif.
- Booking/stay amendment untuk date move, extension, shortening, early departure, dan partial multi-room change dengan atomic inventory serta adjustment/refund manual.
- Greenfield go-live tanpa legacy migration, dengan Opening Booking/block bila ada komitmen aktif, Go/No-Go, rollback/offline procedure, serta hypercare.
- Audit log untuk perubahan sensitif.

### Phase 1B — Employee Attendance MVP dalam aplikasi utama

- Route mobile-first/PWA untuk check-in/check-out dengan selfie dan lokasi pada geofence yang dikonfigurasi.
- Shift template dan shift assignment, serta Free Mode tanpa shift.
- Riwayat absensi pribadi serta koreksi langsung oleh admin berizin dengan alasan dan audit; tidak ada form koreksi mandiri.
- Admin attendance dashboard, konfigurasi titik absensi, rekap, serta export dasar.
- Admin attendance dan route karyawan berada pada aplikasi, identity/RBAC, private file-storage adapter, database, build, serta deployment yang sama. Phase 1 memakai persistent local VPS volume.
- Server route handler disediakan di dalam aplikasi yang sama; bukan API service atau backend terpisah.
- Phase 1B merupakan workstream yang disetujui tetapi bukan launch gate Phase 1A lodging.

### Phase 2 — Revenue extension

- Group booking, package, dan whole house.
- POS standalone dan room charge.
- Services/tours standalone dan folio charge.
- CMS galeri/video dan menu publik yang lebih lengkap.
- Laporan operasional dan revenue.
- Guest complaint/case management lengkap, SLA/escalation, service recovery, dan analytics; Phase 1 hanya memakai operational note serta workflow sumber yang diaudit.
- Cash point/session, opening float, expected-versus-actual cash, variance approval, dan Front Office handover; Phase 1 tetap mencatat payment tunai secara individual dan memakai SOP kas manual.
- Physical room-key tracking, issue/return/lost/damaged, room-move handover, dan checkout exception; Phase 1 memakai SOP kunci manual.
- Penitipan bagasi sebelum check-in/setelah checkout dengan tag, custody, pickup, overdue handling, dan konversi ke Lost & Found; Phase 1 memakai SOP/log manual bila titipan diterima.
- Visitor Log untuk pengunjung non-menginap, host/room reference, entry/exit, policy guard, overdue alert, dan konversi ke Additional Guest; Phase 1 memakai kebijakan serta catatan manual bila visitor diizinkan.
- Permintaan/kapasitas parkir, confirmation/waitlist, kendaraan datang/keluar, overflow parking, dan privacy masking; Phase 1 hanya memakai informasi terverifikasi serta catatan/konfirmasi manual.
- Digital Do Not Disturb, effective window, prolonged alert, clearance, dan audited emergency override; Phase 1 menggunakan tanda fisik serta exception `Deferred/Unable to Access` pada Cleaning Task.
- Emergency contact terstruktur, status kelengkapan, purpose notice, restricted access/audit, dan retention; Phase 1 menggunakan kontak booker/guest serta restricted note minimum bila benar-benar diperlukan.
- Minimum-age validation, minor/guardian linkage, responsible-adult/adjacent-room rule, exception approval, dan guardian acknowledgement; Phase 1 hanya memakai Adult/Child/Infant untuk capacity guard dan tidak menerapkan age guard di dalam sistem.
- Security/damage deposit dengan segregated balance, allocation, remainder refund, dispute/hold, dan reconciliation; Phase 1 hanya memakai booking deposit/down payment dan tidak menyamakannya dengan jaminan.
- House-rules violation/security incident management dengan severity, warning/escalation, restricted evidence, resolution, dan analytics; Phase 1 menggunakan policy/SOP serta source workflow.
- Digital Front Office operational handover dengan linked unresolved items dan acknowledgement; Phase 1 menggunakan SOP/catatan manual dan dashboard sumber.

### Phase 3 — Automation dan integration

- WhatsApp Business API.
- Payment gateway setelah verifikasi bisnis selesai.
- OTA/channel manager, dynamic pricing, accounting, dan inventory F&B.
- Integrasi smart lock atau key-card encoder hanya bila hardware dan kebutuhan operasional sudah ditetapkan.

Detail kebutuhan dan acceptance criteria tersedia di [docs/PRD.md](docs/PRD.md).

## Status proyek

**Status saat ini: Langkah 0–8 tervalidasi dan Technical Batch 1–7 (Langkah 9–22C) telah diimplementasikan. Fondasi Langkah 23 juga tersedia: database/data sintetis terpisah, empat akun role, scenario pack, evidence/defect register, automated verification, four-role credential smoke, dan browser smoke Cleaning telah lulus. Human UAT Owner, Front Office, Cleaning, F&B, content owner, tablet camera/signature, serta final device/accessibility sign-off masih menunggu. Login staf memakai email dan kata sandi biasa tanpa MFA. Langkah 24 production readiness belum dimulai.**

Fitur telah diklasifikasikan sebagai Phase 1, deferred, manual/SOP, integration, atau out of scope. Nilai operasional yang belum ditentukan dilacak sebagai open configuration dan diselesaikan sesuai gate pada checklist kesiapan. Seluruh migration sampai `0013` telah diterapkan pada database development dan local UAT. Tidak ada kamar, tarif, pajak, rekening, testimonial, jarak, atau policy produksi yang dibuat dari asumsi; seluruh fixture UAT ditandai sintetis.

## Struktur

```text
redesign-kooka/
├── .github/workflows/quality.yml
├── app/
├── src/
│   ├── db/schema/
│   ├── db/client.ts
│   ├── db/health.ts
│   ├── db/pool.ts
│   ├── jobs/
│   ├── modules/
│   ├── platform/
│   └── storage/
├── tests/
├── package.json
├── package-lock.json
├── eslint.config.mjs
├── infra/compose.yaml
├── next.config.ts
├── scripts/infra.mjs
├── scripts/db.mjs
├── scripts/db-integration.mjs
├── tsconfig.json
├── vitest.config.ts
├── database/
│   ├── MIGRATION-PLAN.md
│   └── migrations/after-drizzle/
├── drizzle/
├── drizzle.config.ts
├── README.md
└── docs/
    ├── AVAILABILITY-INVENTORY.md
    ├── BOOKING-STAY-AMENDMENTS.md
    ├── CHECKOUT-DEPARTURE-CLEARANCE.md
    ├── CMS-CONTENT-MEDIA.md
    ├── CMS-API.md
    ├── CONVERSATION-TRANSCRIPT.md
    ├── DATABASE-RUNTIME.md
    ├── DATABASE-SCHEMA.md
    ├── DEPENDENCY-QUALITY-BASELINE.md
    ├── EARLY-CHECKIN-LATE-CHECKOUT.md
    ├── FOLIO-FINANCIAL-LEDGER.md
    ├── GO-LIVE-CUTOVER-ROLLBACK.md
    ├── GROUP-PACKAGE-WHOLE-HOUSE.md
    ├── GUEST-OCCUPANCY-EXTRA-BED.md
    ├── GUEST-REQUESTS-PREFERENCES.md
    ├── IMPLEMENTATION-ROADMAP.md
    ├── LOCAL-INFRASTRUCTURE.md
    ├── LOST-FOUND-CUSTODY.md
    ├── MAINTENANCE-ASSET-DAMAGE.md
    ├── MASTER-DATA-CONFIGURATION-GOVERNANCE.md
    ├── MOBILE-ATTENDANCE.md
    ├── NOTIFICATIONS-CUSTOMER-COMMUNICATION.md
    ├── PHASE-1-READINESS-CHECKLIST.md
    ├── POS-SERVICES-TOURS.md
    ├── FNB-API.md
    ├── PRD.md
    ├── PRICING-RATES.md
    ├── PROJECT-CONTEXT.md
    ├── REPORTING-DASHBOARD-RECONCILIATION.md
    ├── SCOPE-DECISION-REGISTER.md
    ├── SECURITY-PRIVACY-RETENTION.md
    ├── STATE-TRANSITIONS.md
    ├── STAY-OPERATIONS-DAILY-CLOSE.md
    ├── TECHNICAL-ARCHITECTURE.md
    ├── TESTING-STRATEGY.md
    ├── UAT-DEFECT-REGISTER.md
    ├── UAT-EVIDENCE.md
    ├── UAT-PHASE-1.md
    └── WEBSITE-AUDIT.md
```

## Dokumen

- [Product Requirements Document](docs/PRD.md) — sumber kebutuhan produk lengkap.
- [Availability dan Inventory](docs/AVAILABILITY-INVENTORY.md) — room type/unit, hold, locking, assignment, block, dan pencegahan double booking.
- [Booking dan Stay Amendments](docs/BOOKING-STAY-AMENDMENTS.md) — date move, extension, shortening, early departure, atomic inventory, pricing, folio, cleaning, dan audit.
- [CMS, Content, dan Media](docs/CMS-CONTENT-MEDIA.md) — source-of-truth boundaries, bilingual workflow, revisions, authentic media, policy, trust content, dan publish.
- [CMS dan Public Landing API](docs/CMS-API.md) — route public/staff, lifecycle revisi, preview/publish, media staging/link, permission, dan gap menuju UAT.
- [Checkout dan Flexible Departure Clearance](docs/CHECKOUT-DEPARTURE-CLEARANCE.md) — pemeriksaan opsional, checklist, skip/reason, issue routing, multi-room, dan checkout guard.
- [PostgreSQL Database Schema Blueprint](docs/DATABASE-SCHEMA.md) — logical tables, relations, constraints, inventory claim/assignment, folio coverage, audit, dan migration sequence.
- [Database Runtime dan Migration Workflow](docs/DATABASE-RUNTIME.md) — server-only pool/Drizzle client, checksum/advisory-lock migration, synthetic seed, disposable verification, dan health route.
- [Dependency dan Quality Baseline](docs/DEPENDENCY-QUALITY-BASELINE.md) — exact package choices, quality commands, CI, security override register, dan removal trigger.
- [Early Check-in dan Late Checkout](docs/EARLY-CHECKIN-LATE-CHECKOUT.md) — ETA/request, Front Office approval, readiness/next-arrival guard, operational block, housekeeping, charge, dan audit.
- [Folio dan Financial Ledger](docs/FOLIO-FINANCIAL-LEDGER.md) — debit/credit, invoice combined/split, payment allocation, tax, dan document lifecycle.
- [Greenfield Go-Live, Cutover, dan Rollback](docs/GO-LIVE-CUTOVER-ROLLBACK.md) — initial setup tanpa legacy migration, Opening Booking, UAT, Go/No-Go, fallback, rollback, dan hypercare.
- [Guest, Occupancy, dan Extra Bed](docs/GUEST-OCCUPANCY-EXTRA-BED.md) — booker/guest roles, partial stay, flexible group billing, capacity, dan extra-bed resource.
- [Group, Package, dan Whole House](docs/GROUP-PACKAGE-WHOLE-HOUSE.md) — proposal/hold, composite inventory, versioned components, bundle pricing, dan exclusive-use rules.
- [Guest Request dan Preferensi](docs/GUEST-REQUESTS-PREFERENCES.md) — kategori, target booking/kamar/tamu, lifecycle, konfirmasi, routing, privasi, dan acceptance tests.
- [Implementation Roadmap](docs/IMPLEMENTATION-ROADMAP.md) — urutan kerja satu langkah pada satu waktu, dependency, owner input, verification, dan exit gate Phase 1A/1B.
- [Phase 1A UAT](docs/UAT-PHASE-1.md) — local environment, synthetic dataset, skenario per role, evidence, defect, dan sign-off gate.
- [Local Infrastructure](docs/LOCAL-INFRASTRUCTURE.md) — Docker Compose PostgreSQL/Redis/Mailpit/private volume, localhost ports, commands, environment, dan security boundary.
- [Lost & Found dan Chain of Custody](docs/LOST-FOUND-CUSTODY.md) — found item/inquiry, claim verification, custody, pickup/shipping, retention, disposition, dan audit.
- [Master Data dan Configuration Governance](docs/MASTER-DATA-CONFIGURATION-GOVERNANCE.md) — single-property master, version/effective date, snapshots, impact checker, risk-based approval, archive, dan secret boundary.
- [Master & Configuration Administration API](docs/MASTER-CONFIGURATION-API.md) — route/action Batch 1, lifecycle/approval, room master, rate resolution, encryption, migration, dan verification status.
- [Maintenance, Asset, dan Guest Damage Charge](docs/MAINTENANCE-ASSET-DAMAGE.md) — issue/work order, serviceability, return-to-service, damage catalog, customer assessment, folio charge, dan audit.
- [Mobile-first Employee Attendance](docs/MOBILE-ATTENDANCE.md) — satu deployment, route karyawan/admin, selfie/geofence, shift/Free Mode, correction, data model, security, dan acceptance criteria.
- [Notifications dan Customer Communication](docs/NOTIFICATIONS-CUSTOMER-COMMUNICATION.md) — akses booking tanpa login, deadline transfer, reminder, outbox, template, delivery status, dan alert internal.
- [POS, Services, dan Tours](docs/POS-SERVICES-TOURS.md) — order/fulfillment lifecycle, room-charge guard, settlement, resource scheduling, void, dan refund.
- [F&B Paper-Order API](docs/FNB-API.md) — public menu, menu master, input formulir kertas, room-charge guard, standalone receipt, dan cancellation/reversal.
- [Pricing dan Rate Rules](docs/PRICING-RATES.md) — nightly rate, quote/snapshot, room move adjustment, cancellation, dan refund manual.
- [Project Context](docs/PROJECT-CONTEXT.md) — konteks, prinsip data, keputusan scope, dan fase delivery.
- [Scope Decision Register](docs/SCOPE-DECISION-REGISTER.md) — klasifikasi Phase 1, deferred, manual/SOP, integration, out of scope, serta change control.
- [Phase 1 Readiness Checklist](docs/PHASE-1-READINESS-CHECKLIST.md) — gate ownership, configuration, content, security, build, UAT, dan go-live.
- [Dashboard, Live Room Monitor, Reporting, dan Reconciliation](docs/REPORTING-DASHBOARD-RECONCILIATION.md) — pantauan semua kamar, metric occupancy/revenue, laporan, export, dan exception reconciliation.
- [Staff UI Foundation](docs/STAFF-UI.md) — login email/password tanpa MFA, navigasi berbasis permission, Dashboard Harian, Live Room Monitor, serta batas scope UI 22A.
- [Phase 1A Hardening Baseline](docs/HARDENING-BASELINE.md) — origin/RBAC matrix, upload sanitization, retention dry-run, concurrency, queue/email/PDF recovery, performance, dan restore rehearsal.
- [Security, Privacy, dan Retention](docs/SECURITY-PRIVACY-RETENTION.md) — data classification, staff authentication, RBAC, private files, customer lookup, audit access, purge, dan backup.
- [Stay Operations dan Daily Close](docs/STAY-OPERATIONS-DAILY-CLOSE.md) — business date, automatic rollover, guaranteed late arrival, no-show, dan exception checklist.
- [State Transition Matrix](docs/STATE-TRANSITIONS.md) — aturan perpindahan status, guard, side effect, audit, dan recovery path.
- [Technical Architecture](docs/TECHNICAL-ARCHITECTURE.md) — single-deploy modular monolith, approved stack, VPS topology, Redis/outbox, local private files, backup, dan recovery.
- [Testing Strategy](docs/TESTING-STRATEGY.md) — test pyramid, coverage policy, critical scenarios, commands, dan feature Definition of Done.
- [Website Audit](docs/WEBSITE-AUDIT.md) — temuan audit awal dan arah redesign.
- [Conversation Transcript](docs/CONVERSATION-TRANSCRIPT.md) — catatan permintaan dan keputusan yang perlu dipertahankan untuk kelanjutan proyek.

## Batasan tahap awal

- Pembayaran belum memakai Xendit atau payment gateway lain.
- Bukti transfer dikirim customer melalui WhatsApp dan diverifikasi admin secara manual.
- WhatsApp berfungsi sebagai kanal komunikasi; status resmi dan data transaksi tetap berada di sistem.
- Tidak ada migrasi/import legacy; production dimulai dengan initial master/configuration dan Opening Booking/block hanya jika ada commitment yang masih berlaku.
- Mockup landing page sudah tersedia dan Versi 01 dipilih sebagai arah desain. Implementasi production landing/CMS kini berada di canonical Next.js root; mockup tetap terpisah dan runtime D1/Cloudflare preview tidak dibawa ke root. Next.js/PostgreSQL/Redis/local-private-storage pada satu VPS tetap menjadi baseline. Staff UI 22A sudah memiliki fondasi visual, sedangkan form/action operasional lengkap, production database/seed, final content, production environment, dan deployment belum dibuat.

## Menjalankan quality gate

```bash
npm ci
npm run quality
```

Command tersebut menjalankan format check, zero-warning lint, strict type-check, test/coverage, Drizzle schema check, production build, dan dependency audit.

## Menjalankan local infrastructure

Dengan Docker Desktop aktif:

```bash
npm run infra:up
npm run infra:status
npm run infra:health
npm run env:local
npm run db:migrate
npm run db:seed:dev
npm run db:health
```

PostgreSQL tersedia di `127.0.0.1:55432`, Redis di `127.0.0.1:56379`, Mailpit SMTP di `127.0.0.1:11025`, dan Mailpit UI di `http://127.0.0.1:18025`. Gunakan `npm run infra:down` untuk menghentikan service tanpa menghapus volume.

Gunakan `npm run db:status` untuk melihat applied/pending/checksum mismatch dan `npm run db:test` untuk verifikasi penuh pada database disposable. Endpoint application health tersedia pada `GET /api/health`.

Setelah aplikasi berjalan atau selesai di-deploy, jalankan `npm run smoke`
untuk local atau `npm run smoke:production` untuk production. Pemeriksaan ini
read-only dan mencakup aplikasi, database, indikator worker/outbox, konten,
ketersediaan, login staf, dan keadaan landing/maintenance. Konfigurasi lengkap
tersedia di [Automated Smoke Test](docs/SMOKE-TEST.md).

- Fitur baru setelah baseline memerlukan change request; perubahan nilai konfigurasi yang tidak memperluas fitur tetap mengikuti checklist dan approval policy.
